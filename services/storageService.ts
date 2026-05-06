
import { Employee, TimeLog, Company, Project, JobFunction, User, LaborTracking, DailyMeasurement, Contract, ContractMeasurement, Supplier, ServiceExecution, FVS, WeatherLog } from '../types';
import { db } from '../src/firebase';
import { 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  console.error(`Firestore Error [${operationType}] at [${path}]:`, error);
  throw error;
};

const KEYS = {
  EMPLOYEES: 'employees',
  LOGS: 'timelogs',
  COMPANIES: 'companies',
  PROJECTS: 'projects',
  JOB_FUNCTIONS: 'jobfunctions',
  USERS: 'users',
  CURRENT_USER: 'facepoint_current_user',
  LABOR_TRACKING: 'labortracking',
  MEASUREMENTS: 'measurements',
  CONTRACTS: 'contracts',
  CONTRACT_MEASUREMENTS: 'contractmeasurements',
  SUPPLIERS: 'suppliers',
  SERVICE_EXECUTIONS: 'executions',
  FVS: 'fvs',
  WEATHER_LOGS: 'weatherlogs'
};

interface StorageService {
  subscribeFVS: (callback: (data: FVS[]) => void) => () => void;
  subscribeProjects: (callback: (data: Project[]) => void) => () => void;
  subscribeEmployees: (callback: (data: Employee[]) => void) => () => void;
  subscribeSuppliers: (callback: (data: Supplier[]) => void) => () => void;
  subscribeContracts: (callback: (data: Contract[]) => void) => () => void;
  subscribeContractMeasurements: (callback: (data: ContractMeasurement[]) => void) => () => void;
  subscribeExecutions: (callback: (data: ServiceExecution[]) => void) => () => void;
  subscribeCompanies: (callback: (data: Company[]) => void) => () => void;
  subscribeJobFunctions: (callback: (data: JobFunction[]) => void) => () => void;
  subscribeLaborTrackings: (callback: (data: LaborTracking[]) => void) => () => void;
  subscribeLogs: (callback: (data: TimeLog[]) => void) => () => void;
  subscribeWeatherLogs: (callback: (data: WeatherLog[]) => void) => () => void;
  getProjects: () => Promise<Project[]>;
  getEmployees: () => Promise<Employee[]>;
  getSuppliers: () => Promise<Supplier[]>;
  saveSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  getContracts: () => Promise<Contract[]>;
  saveContract: (contract: Contract) => Promise<void>;
  deleteContract: (id: string) => Promise<void>;
  getContractMeasurements: () => Promise<ContractMeasurement[]>;
  saveContractMeasurement: (m: ContractMeasurement) => Promise<void>;
  deleteContractMeasurement: (id: string) => Promise<void>;
  getFVS: () => Promise<FVS[]>;
  saveFVS: (fvs: FVS) => Promise<void>;
  deleteFVS: (id: string) => Promise<void>;
  getUsers: () => Promise<User[]>;
  getUser: (id: string) => Promise<User | null>;
  saveUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  getCurrentUser: () => User | null;
  setCurrentUser: (user: User | null) => void;
  saveProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  saveEmployee: (employee: Employee) => Promise<void>;
  saveEmployees: (employees: Employee[]) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  saveLog: (log: TimeLog) => Promise<void>;
  saveLogs: (logs: TimeLog[]) => Promise<void>;
  deleteLogs: (ids: string[]) => Promise<void>;
  saveServiceExecution: (execution: ServiceExecution) => Promise<void>;
  saveServiceExecutions: (executions: ServiceExecution[]) => Promise<void>;
  saveCompany: (company: Company) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  saveJobFunction: (jobFunction: JobFunction) => Promise<void>;
  deleteJobFunction: (id: string) => Promise<void>;
  getLaborTrackings: () => Promise<LaborTracking[]>;
  saveLaborTracking: (tracking: LaborTracking) => Promise<void>;
  saveLaborTrackings: (trackings: LaborTracking[]) => Promise<void>;
  deleteLaborTrackings: (ids: string[]) => Promise<void>;
  getMeasurements: () => Promise<DailyMeasurement[]>;
  saveMeasurement: (m: DailyMeasurement) => Promise<void>;
  saveWeatherLog: (log: WeatherLog) => Promise<void>;
}

// Helper to remove/replace undefined values before saving to Firestore (recursive)
const sanitizeForFirestore = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  
  const result: any = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val === undefined) {
      result[key] = null;
    } else if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
      result[key] = sanitizeForFirestore(val);
    } else {
      result[key] = val;
    }
  });
  return result;
};

export const storageService: StorageService = {
  // Sync Listeners
  subscribeFVS: (callback: (data: FVS[]) => void) => {
    return onSnapshot(collection(db, KEYS.FVS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as FVS));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.FVS));
  },

  subscribeProjects: (callback: (data: Project[]) => void) => {
    return onSnapshot(collection(db, KEYS.PROJECTS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Project));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.PROJECTS));
  },

  subscribeEmployees: (callback: (data: Employee[]) => void) => {
    return onSnapshot(collection(db, KEYS.EMPLOYEES), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Employee));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.EMPLOYEES));
  },

  subscribeSuppliers: (callback: (data: Supplier[]) => void) => {
    return onSnapshot(collection(db, KEYS.SUPPLIERS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Supplier));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.SUPPLIERS));
  },

  subscribeContracts: (callback: (data: Contract[]) => void) => {
    return onSnapshot(collection(db, KEYS.CONTRACTS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Contract));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.CONTRACTS));
  },

  subscribeContractMeasurements: (callback: (data: ContractMeasurement[]) => void) => {
    return onSnapshot(collection(db, KEYS.CONTRACT_MEASUREMENTS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as ContractMeasurement));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.CONTRACT_MEASUREMENTS));
  },

  subscribeExecutions: (callback: (data: ServiceExecution[]) => void) => {
    return onSnapshot(collection(db, KEYS.SERVICE_EXECUTIONS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as ServiceExecution));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.SERVICE_EXECUTIONS));
  },

  subscribeCompanies: (callback: (data: Company[]) => void) => {
    return onSnapshot(collection(db, KEYS.COMPANIES), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Company));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.COMPANIES));
  },

  subscribeJobFunctions: (callback: (data: JobFunction[]) => void) => {
    return onSnapshot(collection(db, KEYS.JOB_FUNCTIONS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as JobFunction));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.JOB_FUNCTIONS));
  },
  
  subscribeLaborTrackings: (callback: (data: LaborTracking[]) => void) => {
    return onSnapshot(collection(db, KEYS.LABOR_TRACKING), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as LaborTracking));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.LABOR_TRACKING));
  },

  subscribeLogs: (callback: (data: TimeLog[]) => void) => {
    return onSnapshot(collection(db, KEYS.LOGS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as TimeLog));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.LOGS));
  },

  subscribeWeatherLogs: (callback: (data: WeatherLog[]) => void) => {
    return onSnapshot(collection(db, KEYS.WEATHER_LOGS), (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as WeatherLog));
    }, (err) => handleFirestoreError(err, OperationType.LIST, KEYS.WEATHER_LOGS));
  },

  // CRUD Operations
  getProjects: async (): Promise<Project[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.PROJECTS));
      return snap.docs.map(doc => doc.data() as Project);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.PROJECTS);
      return [];
    }
  },

  getEmployees: async (): Promise<Employee[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.EMPLOYEES));
      return snap.docs.map(doc => doc.data() as Employee);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.EMPLOYEES);
      return [];
    }
  },

  getSuppliers: async (): Promise<Supplier[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.SUPPLIERS));
      return snap.docs.map(doc => doc.data() as Supplier);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.SUPPLIERS);
      return [];
    }
  },

  saveSupplier: async (supplier: Supplier) => {
    try {
      const sanitized = sanitizeForFirestore(supplier);
      await setDoc(doc(db, KEYS.SUPPLIERS, supplier.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.SUPPLIERS}/${supplier.id}`);
    }
  },

  deleteSupplier: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.SUPPLIERS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.SUPPLIERS}/${id}`);
    }
  },

  getContracts: async (): Promise<Contract[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.CONTRACTS));
      return snap.docs.map(doc => doc.data() as Contract);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.CONTRACTS);
      return [];
    }
  },

  saveContract: async (contract: Contract) => {
    try {
      const sanitized = sanitizeForFirestore(contract);
      await setDoc(doc(db, KEYS.CONTRACTS, contract.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.CONTRACTS}/${contract.id}`);
    }
  },

  getContractMeasurements: async (): Promise<ContractMeasurement[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.CONTRACT_MEASUREMENTS));
      return snap.docs.map(doc => doc.data() as ContractMeasurement);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.CONTRACT_MEASUREMENTS);
      return [];
    }
  },

  saveContractMeasurement: async (m: ContractMeasurement) => {
    try {
      const sanitized = sanitizeForFirestore(m);
      await setDoc(doc(db, KEYS.CONTRACT_MEASUREMENTS, m.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.CONTRACT_MEASUREMENTS}/${m.id}`);
    }
  },

  deleteContractMeasurement: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.CONTRACT_MEASUREMENTS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.CONTRACT_MEASUREMENTS}/${id}`);
    }
  },
  getFVS: async (): Promise<FVS[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.FVS));
      return snap.docs.map(doc => doc.data() as FVS);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.FVS);
      return [];
    }
  },

  saveFVS: async (fvs: FVS) => {
    try {
      const sanitized = sanitizeForFirestore(fvs);
      await setDoc(doc(db, KEYS.FVS, fvs.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.FVS}/${fvs.id}`);
    }
  },

  deleteFVS: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.FVS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.FVS}/${id}`);
    }
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.USERS));
      return snap.docs.map(doc => doc.data() as User);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.USERS);
      return [];
    }
  },

  getUser: async (id: string): Promise<User | null> => {
    try {
      const docRef = doc(db, KEYS.USERS, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as User) : null;
    } catch (err) {
      // Don't log error for 403 on getUser during login check if it's expected not to exist
      // handleFirestoreError(err, OperationType.GET, `${KEYS.USERS}/${id}`);
      return null;
    }
  },

  saveUser: async (user: User) => {
    try {
      const sanitized = sanitizeForFirestore(user);
      await setDoc(doc(db, KEYS.USERS, user.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.USERS}/${user.id}`);
    }
  },

  deleteUser: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.USERS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.USERS}/${id}`);
    }
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  },

  saveCompany: async (company: Company) => {
    try {
      const sanitized = sanitizeForFirestore(company);
      await setDoc(doc(db, KEYS.COMPANIES, company.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.COMPANIES}/${company.id}`);
    }
  },

  deleteCompany: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.COMPANIES, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.COMPANIES}/${id}`);
    }
  },

  saveJobFunction: async (jobFunction: JobFunction) => {
    try {
      const sanitized = sanitizeForFirestore(jobFunction);
      await setDoc(doc(db, KEYS.JOB_FUNCTIONS, jobFunction.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.JOB_FUNCTIONS}/${jobFunction.id}`);
    }
  },

  deleteJobFunction: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.JOB_FUNCTIONS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.JOB_FUNCTIONS}/${id}`);
    }
  },

  getLaborTrackings: async (): Promise<LaborTracking[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.LABOR_TRACKING));
      return snap.docs.map(doc => doc.data() as LaborTracking);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.LABOR_TRACKING);
      return [];
    }
  },

  saveLaborTracking: async (tracking: LaborTracking) => {
    try {
      const sanitized = sanitizeForFirestore(tracking);
      await setDoc(doc(db, KEYS.LABOR_TRACKING, tracking.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.LABOR_TRACKING}/${tracking.id}`);
    }
  },

  saveLaborTrackings: async (trackings: LaborTracking[]) => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < trackings.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = trackings.slice(i, i + 500);
        chunk.forEach(t => {
          const sanitized = sanitizeForFirestore(t);
          const docRef = doc(db, KEYS.LABOR_TRACKING, t.id);
          batch.set(docRef, sanitized);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, KEYS.LABOR_TRACKING);
    }
  },

  deleteLaborTrackings: async (ids: string[]) => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = ids.slice(i, i + 500);
        chunk.forEach(id => {
          const docRef = doc(db, KEYS.LABOR_TRACKING, id);
          batch.delete(docRef);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, KEYS.LABOR_TRACKING);
    }
  },

  getMeasurements: async (): Promise<DailyMeasurement[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.MEASUREMENTS));
      return snap.docs.map(doc => doc.data() as DailyMeasurement);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.MEASUREMENTS);
      return [];
    }
  },

  saveMeasurement: async (m: DailyMeasurement) => {
    try {
      const sanitized = sanitizeForFirestore(m);
      await setDoc(doc(db, KEYS.MEASUREMENTS, m.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.MEASUREMENTS}/${m.id}`);
    }
  },

  deleteContract: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.CONTRACTS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.CONTRACTS}/${id}`);
    }
  },

  deleteProject: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.PROJECTS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.PROJECTS}/${id}`);
    }
  },

  saveProject: async (project: Project) => {
    try {
      const sanitized = sanitizeForFirestore(project);
      await setDoc(doc(db, KEYS.PROJECTS, project.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.PROJECTS}/${project.id}`);
    }
  },

  saveEmployee: async (employee: Employee) => {
    try {
      const sanitized = sanitizeForFirestore(employee);
      await setDoc(doc(db, KEYS.EMPLOYEES, employee.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.EMPLOYEES}/${employee.id}`);
    }
  },

  saveEmployees: async (employees: Employee[]) => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < employees.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = employees.slice(i, i + 500);
        chunk.forEach(emp => {
          const sanitized = sanitizeForFirestore(emp);
          const docRef = doc(db, KEYS.EMPLOYEES, emp.id);
          batch.set(docRef, sanitized);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, KEYS.EMPLOYEES);
    }
  },

  deleteEmployee: async (id: string) => {
    try {
      await deleteDoc(doc(db, KEYS.EMPLOYEES, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${KEYS.EMPLOYEES}/${id}`);
    }
  },

  saveLog: async (log: TimeLog) => {
    try {
      const sanitized = sanitizeForFirestore(log);
      await setDoc(doc(db, KEYS.LOGS, log.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.LOGS}/${log.id}`);
    }
  },

  saveLogs: async (logs: TimeLog[]) => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      // Firestore batches are limited to 500 operations
      for (let i = 0; i < logs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = logs.slice(i, i + 500);
        
        chunk.forEach(log => {
          const sanitized = sanitizeForFirestore(log);
          const docRef = doc(db, KEYS.LOGS, log.id);
          batch.set(docRef, sanitized);
        });
        
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, KEYS.LOGS);
    }
  },

  deleteLogs: async (ids: string[]) => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = ids.slice(i, i + 500);
        chunk.forEach(id => {
          const docRef = doc(db, KEYS.LOGS, id);
          batch.delete(docRef);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, KEYS.LOGS);
    }
  },

  saveServiceExecution: async (execution: ServiceExecution) => {
    try {
      const sanitized = sanitizeForFirestore(execution);
      await setDoc(doc(db, KEYS.SERVICE_EXECUTIONS, execution.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.SERVICE_EXECUTIONS}/${execution.id}`);
    }
  },

  saveServiceExecutions: async (executions: ServiceExecution[]) => {
    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < executions.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = executions.slice(i, i + 500);
        chunk.forEach(ex => {
          const sanitized = sanitizeForFirestore(ex);
          const docRef = doc(db, KEYS.SERVICE_EXECUTIONS, ex.id);
          batch.set(docRef, sanitized);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, KEYS.SERVICE_EXECUTIONS);
    }
  },

  saveWeatherLog: async (log: WeatherLog) => {
    try {
      const sanitized = sanitizeForFirestore(log);
      await setDoc(doc(db, KEYS.WEATHER_LOGS, log.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${KEYS.WEATHER_LOGS}/${log.id}`);
    }
  }
};

