import { db } from '../src/firebase';
import { collection, doc, setDoc, getDocs, query, where, Timestamp, writeBatch, onSnapshot } from 'firebase/firestore';
import { SecullumEmployee } from '../types';

const SECULLUM_COLLECTION = 'secullum_employees';

export const secullumService = {
  async upsertEmployees(employeesData: any[]): Promise<void> {
    const batch = writeBatch(db);
    const now = Date.now();

    for (const remoteData of employeesData) {
      // Secullum API IDs can be 'id' or 'Id'
      const remoteId = (remoteData.id || remoteData.Id)?.toString();
      if (!remoteId) continue;

      const docRef = doc(db, SECULLUM_COLLECTION, remoteId);
      
      const secullumEmployee: SecullumEmployee = {
        id: remoteId,
        data: remoteData,
        lastImportedAt: now
      };
      
      batch.set(docRef, secullumEmployee, { merge: true });
    }

    await batch.commit();
  },

  subscribeSecullumEmployees(callback: (data: SecullumEmployee[]) => void): () => void {
    return onSnapshot(collection(db, SECULLUM_COLLECTION), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as SecullumEmployee));
    }, (error) => {
      console.error("Error subscribing to secullum employees:", error);
    });
  },

  async getAllSecullumEmployees(): Promise<SecullumEmployee[]> {
    const querySnapshot = await getDocs(collection(db, SECULLUM_COLLECTION));
    return querySnapshot.docs.map(doc => doc.data() as SecullumEmployee);
  },

  async linkToEmployee(secullumId: string, employeeId: string): Promise<void> {
    const docRef = doc(db, SECULLUM_COLLECTION, secullumId);
    await setDoc(docRef, { linkedEmployeeId: employeeId }, { merge: true });
  }
};
