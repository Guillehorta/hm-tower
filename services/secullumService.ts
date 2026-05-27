import { db } from '../src/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, Timestamp, writeBatch, onSnapshot } from 'firebase/firestore';
import { SecullumEmployee } from '../types';

const SECULLUM_COLLECTION = 'secullum_employees';
const LOCAL_SECULLUM_KEY = 'fs_cache_secullum_employees';
const LOCAL_SYNC_METADATA_KEY = 'fs_cache_secullum_sync_metadata';

const fallbackSecullumCallbacks = new Set<(data: SecullumEmployee[]) => void>();

function getLocalSecullumEmployees(): SecullumEmployee[] {
  const cached = localStorage.getItem(LOCAL_SECULLUM_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (_) {}
  }
  return [];
}

function saveLocalSecullumEmployees(data: SecullumEmployee[]) {
  try {
    localStorage.setItem(LOCAL_SECULLUM_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn(`LocalStorage write failed for key ${LOCAL_SECULLUM_KEY}:`, e);
    try {
      // Crop to the last/most recent 100 secullum employees as fallback to fit storage limits
      localStorage.setItem(LOCAL_SECULLUM_KEY, JSON.stringify(data.slice(-100)));
    } catch (e2) {
      console.error(`Failed to write fallback cache for key ${LOCAL_SECULLUM_KEY}:`, e2);
    }
  }
  fallbackSecullumCallbacks.forEach(cb => {
    try {
      cb(data);
    } catch (e) {
      console.error("Error executing callback for secullum employees:", e);
    }
  });
}

export const secullumService = {
  async upsertEmployees(employeesData: any[]): Promise<void> {
    const now = Date.now();
    const current = getLocalSecullumEmployees();

    for (const remoteData of employeesData) {
      // Secullum API IDs can be 'id' or 'Id'
      const remoteId = (remoteData.id || remoteData.Id)?.toString();
      if (!remoteId || remoteId === 'sync_metadata') continue;

      const secullumEmployee: SecullumEmployee = {
        id: remoteId,
        data: remoteData,
        lastImportedAt: now
      };

      const idx = current.findIndex(emp => emp.id === remoteId);
      if (idx >= 0) {
        current[idx] = { ...current[idx], ...secullumEmployee };
      } else {
        current.push(secullumEmployee);
      }
    }
    
    // Save to local storage first
    saveLocalSecullumEmployees(current);

    // Try committing to Firestore
    try {
      const batch = writeBatch(db);
      for (const remoteData of employeesData) {
        const remoteId = (remoteData.id || remoteData.Id)?.toString();
        if (!remoteId || remoteId === 'sync_metadata') continue;

        const docRef = doc(db, SECULLUM_COLLECTION, remoteId);
        
        const secullumEmployee: SecullumEmployee = {
          id: remoteId,
          data: remoteData,
          lastImportedAt: now
        };
        
        batch.set(docRef, secullumEmployee, { merge: true });
      }
      await batch.commit();
    } catch (error) {
      console.warn("Firestore collection [secullum_employees] quota error, saved in offline cache:", error);
    }
  },

  subscribeSecullumEmployees(callback: (data: SecullumEmployee[]) => void): () => void {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, SECULLUM_COLLECTION), (snapshot) => {
        const data = snapshot.docs
          .map(doc => doc.data() as SecullumEmployee)
          .filter(emp => emp.id !== 'sync_metadata');
        
        saveLocalSecullumEmployees(data);
        callback(data);
      }, (error) => {
        console.warn("Error subscribing to secullum employees, using cache-back:", error);
        callback(getLocalSecullumEmployees());
      });
    } catch (err) {
      console.warn("Firestore subscription crash for secullum employees:", err);
      callback(getLocalSecullumEmployees());
    }

    fallbackSecullumCallbacks.add(callback);
    return () => {
      unsub();
      fallbackSecullumCallbacks.delete(callback);
    };
  },

  async getAllSecullumEmployees(): Promise<SecullumEmployee[]> {
    try {
      const querySnapshot = await getDocs(collection(db, SECULLUM_COLLECTION));
      const data = querySnapshot.docs
        .map(doc => doc.data() as SecullumEmployee)
        .filter(emp => emp.id !== 'sync_metadata');
      saveLocalSecullumEmployees(data);
      return data;
    } catch (error) {
      console.warn("Firestore getAllSecullumEmployees failed, returning cache:", error);
      return getLocalSecullumEmployees();
    }
  },

  async linkToEmployee(secullumId: string, employeeId: string): Promise<void> {
    const current = getLocalSecullumEmployees();
    const idx = current.findIndex(emp => emp.id === secullumId);
    if (idx >= 0) {
      current[idx] = { ...current[idx], linkedEmployeeId: employeeId };
      saveLocalSecullumEmployees(current);
    }

    try {
      const docRef = doc(db, SECULLUM_COLLECTION, secullumId);
      await setDoc(docRef, { linkedEmployeeId: employeeId }, { merge: true });
    } catch (error) {
      console.warn("Firestore linkToEmployee quota/offline error, linked locally:", error);
    }
  },

  async getLastTimeLogSync(): Promise<number | null> {
    const localMeta = localStorage.getItem(LOCAL_SYNC_METADATA_KEY);
    if (localMeta) {
      try {
        const ts = Number(localMeta);
        if (!isNaN(ts)) return ts;
      } catch (_) {}
    }

    try {
      const docRef = doc(db, SECULLUM_COLLECTION, 'sync_metadata');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.data && typeof data.data.lastSyncTimestamp === 'number') {
          try {
            localStorage.setItem(LOCAL_SYNC_METADATA_KEY, data.data.lastSyncTimestamp.toString());
          } catch (e) {
            console.warn("Failed to set LOCAL_SYNC_METADATA_KEY in localStorage:", e);
          }
          return data.data.lastSyncTimestamp;
        }
      }
    } catch (error) {
      console.warn("Error fetching last sync from database, returning local timestamp:", error);
    }

    return localMeta ? Number(localMeta) : null;
  },

  async saveLastTimeLogSync(timestamp: number): Promise<void> {
    try {
      localStorage.setItem(LOCAL_SYNC_METADATA_KEY, timestamp.toString());
    } catch (e) {
      console.warn("Failed to update LOCAL_SYNC_METADATA_KEY in localStorage:", e);
    }

    try {
      const docRef = doc(db, SECULLUM_COLLECTION, 'sync_metadata');
      const secullumEmployee: SecullumEmployee = {
        id: 'sync_metadata',
        data: {
          lastSyncTimestamp: timestamp
        },
        lastImportedAt: Date.now()
      };
      await setDoc(docRef, secullumEmployee, { merge: true });
    } catch (error) {
      console.warn("Error committing sync metadata, saved only in offline cache:", error);
    }
  }
};
