import { Employee, TimeLog, Company, Project, JobFunction, User, LaborTracking, DailyMeasurement, Contract, ContractMeasurement, Supplier, ServiceExecution, FVS, WeatherLog, WorkDiary } from '../types';
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
  where,
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
  console.warn(`[Offline Fallback Mode] Firestore Error [${operationType}] at [${path}]:`, error);
  // Do not rethrow the error, silently swallow and allow system to run on local fallback
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
  WEATHER_LOGS: 'weatherlogs',
  WORK_DIARIES: 'workdiaries'
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
  subscribeWorkDiaries: (callback: (data: WorkDiary[]) => void) => () => void;
  subscribeUsers: (callback: (data: User[]) => void) => () => void;
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
  getUserByEmail: (email: string) => Promise<User | null>;
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
  saveWorkDiary: (diary: WorkDiary) => Promise<void>;
  deleteWorkDiary: (id: string) => Promise<void>;
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

// Seeding standard high quality default mock data if the app is starting freshly
function getInitialSeedData(key: string): any[] {
  switch (key) {
    case 'companies':
      return [
        {
          id: 'comp-1',
          name: 'HM Tower Engenharia Ltda',
          cnpj: '12.345.678/0001-90',
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
        }
      ];
    case 'projects':
      return [
        {
          id: 'proj-1',
          code: 'OBRA-001',
          name: 'Residencial Park Central',
          status: 'Ativa',
          constructionUnits: [
            { id: 'u-t1-101', name: 'Torre 1 - Apto 101' },
            { id: 'u-t1-102', name: 'Torre 1 - Apto 102' },
            { id: 'u-t2-101', name: 'Torre 2 - Apto 101' },
            { id: 'u-t2-102', name: 'Torre 2 - Apto 102' }
          ],
          costStructure: [
            { id: 'c-1', name: 'Fundação e Estruturas', servicePaths: [] },
            { id: 'c-2', name: 'Alvenaria de Vedação', servicePaths: [] },
            { id: 'c-3', name: 'Revestimento Interno', servicePaths: [] },
            { id: 'c-4', name: 'Pintura', servicePaths: [] }
          ],
          fvsMapping: {
            "Fundação e Estruturas": "fvs-1",
            "Alvenaria de Vedação": "fvs-2"
          },
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
        }
      ];
    case 'jobfunctions':
      return [
        { id: 'job-1', name: 'Mestre de Obras', createdAt: Date.now() },
        { id: 'job-2', name: 'Pedreiro', createdAt: Date.now() },
        { id: 'job-3', name: 'Carpinteiro', createdAt: Date.now() },
        { id: 'job-4', name: 'Armador', createdAt: Date.now() },
        { id: 'job-5', name: 'Servente', createdAt: Date.now() }
      ];
    case 'employees':
      return [
        {
          id: 'emp-1',
          name: 'CARLOS MATHEUS DA SILVA',
          role: 'Pedreiro',
          cpf: '123.456.789-10',
          status: 'Ativo',
          project: 'proj-1',
          createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000
        },
        {
          id: 'emp-2',
          name: 'ANA SOUZA DE OLIVEIRA',
          role: 'Mestre de Obras',
          cpf: '987.654.321-00',
          status: 'Ativo',
          project: 'proj-1',
          createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000
        }
      ];
    case 'users':
      return [
        {
          id: 'user-guille',
          name: 'Guilherme Horta',
          cpf: '000.000.000-00',
          phone: '',
          email: 'guillehorta81@gmail.com',
          role: 'Administrador',
          companies: ['comp-1'],
          projects: ['proj-1'],
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
        }
      ];
    case 'fvs':
      return [
        {
          id: 'fvs-1',
          code: 'FVS-EST-01',
          name: 'Inspeção de Armadura e Fôrmas',
          revision: 'Rev.01',
          items: [
            'Verificação de prumo e nível das fôrmas',
            'Limpeza e aplicação de desmoldante',
            'Espaçadores e cobrimento das armaduras',
            'Grau de estanqueidade das emendas'
          ],
          createdAt: Date.now()
        },
        {
          id: 'fvs-2',
          code: 'FVS-ALV-01',
          name: 'Inspeção de Alvenaria',
          revision: 'Rev.02',
          items: [
            'Prumo, nível e alinhamento das fiadas',
            'Espessura das juntas de argamassa',
            'Amarração e vinculações nos pilares',
            'Qualidade dos blocos e argamassa'
          ],
          createdAt: Date.now()
        }
      ];
    default:
      return [];
  }
}

// In-Memory set of fallback observer clients
const fallbackCallbacks: { [key: string]: Set<(data: any[]) => void> } = {};

function registerFallbackCallback(key: string, callback: (data: any[]) => void): () => void {
  if (!fallbackCallbacks[key]) {
    fallbackCallbacks[key] = new Set();
  }
  fallbackCallbacks[key].add(callback);
  return () => {
    fallbackCallbacks[key]?.delete(callback);
  };
}

function triggerFallbackCallbacks(key: string) {
  const callbacks = fallbackCallbacks[key];
  if (callbacks) {
    const data = getLocalCollection(key);
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error("Error running fallback callback for", key, e);
      }
    });
  }
}

function getLocalCollection(key: string): any[] {
  const cached = localStorage.getItem(`fs_cache_${key}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error("Error parsing local cache for key", key, e);
    }
  }
  const defaults = getInitialSeedData(key);
  // Instantly write defaults to cache so they stay initialized
  try {
    localStorage.setItem(`fs_cache_${key}`, JSON.stringify(defaults));
  } catch (e) {
    console.warn(`Failed to set default cache for key ${key} due to storage limits:`, e);
  }
  return defaults;
}

function saveLocalCollection(key: string, data: any[], trigger = true) {
  try {
    localStorage.setItem(`fs_cache_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`LocalStorage write failed for key fs_cache_${key}:`, e);
    
    // Proactively handle QuotaExceededError or general storage limit failures
    if (key === KEYS.LOGS) {
      try {
        // Trim to most recent 50 logs, and strip capturedPhoto for logs past index 3 to fit limits
        const trimmedData = data.slice(0, 50).map((item, idx) => {
          if (idx > 3 && item.capturedPhoto) {
            return { ...item, capturedPhoto: "" };
          }
          return item;
        });
        localStorage.setItem(`fs_cache_${key}`, JSON.stringify(trimmedData));
        console.log(`Successfully stored space-optimized version of ${key} to localStorage.`);
      } catch (e2) {
        console.warn("Optimized write failed, stripping all base64 photos from cached logs...", e2);
        try {
          // Fallback: keep only up to 20 logs and strip all photos entirely
          const minimalData = data.slice(0, 20).map(item => ({ ...item, capturedPhoto: "" }));
          localStorage.setItem(`fs_cache_${key}`, JSON.stringify(minimalData));
        } catch (e3) {
          console.error("Critical: Failed to save any log cache to localStorage", e3);
        }
      }
    } else {
      // General item pruning fallback for other collections
      try {
        const trimmedData = data.slice(-50);
        localStorage.setItem(`fs_cache_${key}`, JSON.stringify(trimmedData));
      } catch (e2) {
        console.error(`Could not save trimmed fallback cache for key ${key}:`, e2);
      }
    }
  }
  if (trigger) {
    triggerFallbackCallbacks(key);
  }
}

export const storageService: StorageService = {
  // Sync Listeners
  subscribeFVS: (callback: (data: FVS[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.FVS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as FVS);
        saveLocalCollection(KEYS.FVS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.FVS);
        callback(getLocalCollection(KEYS.FVS));
      });
    } catch (err) {
      console.warn("Failed FVS setup:", err);
      callback(getLocalCollection(KEYS.FVS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.FVS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeProjects: (callback: (data: Project[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.PROJECTS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Project);
        saveLocalCollection(KEYS.PROJECTS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.PROJECTS);
        callback(getLocalCollection(KEYS.PROJECTS));
      });
    } catch (err) {
      console.warn("Failed Projects setup:", err);
      callback(getLocalCollection(KEYS.PROJECTS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.PROJECTS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeEmployees: (callback: (data: Employee[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.EMPLOYEES), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Employee);
        saveLocalCollection(KEYS.EMPLOYEES, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.EMPLOYEES);
        callback(getLocalCollection(KEYS.EMPLOYEES));
      });
    } catch (err) {
      console.warn("Failed Employees setup:", err);
      callback(getLocalCollection(KEYS.EMPLOYEES));
    }
    const unsubFallback = registerFallbackCallback(KEYS.EMPLOYEES, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeSuppliers: (callback: (data: Supplier[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.SUPPLIERS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Supplier);
        saveLocalCollection(KEYS.SUPPLIERS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.SUPPLIERS);
        callback(getLocalCollection(KEYS.SUPPLIERS));
      });
    } catch (err) {
      console.warn("Failed Suppliers setup:", err);
      callback(getLocalCollection(KEYS.SUPPLIERS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.SUPPLIERS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeContracts: (callback: (data: Contract[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.CONTRACTS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Contract);
        saveLocalCollection(KEYS.CONTRACTS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.CONTRACTS);
        callback(getLocalCollection(KEYS.CONTRACTS));
      });
    } catch (err) {
      console.warn("Failed Contracts setup:", err);
      callback(getLocalCollection(KEYS.CONTRACTS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.CONTRACTS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeContractMeasurements: (callback: (data: ContractMeasurement[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.CONTRACT_MEASUREMENTS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as ContractMeasurement);
        saveLocalCollection(KEYS.CONTRACT_MEASUREMENTS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.CONTRACT_MEASUREMENTS);
        callback(getLocalCollection(KEYS.CONTRACT_MEASUREMENTS));
      });
    } catch (err) {
      console.warn("Failed Contract Measurements setup:", err);
      callback(getLocalCollection(KEYS.CONTRACT_MEASUREMENTS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.CONTRACT_MEASUREMENTS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeExecutions: (callback: (data: ServiceExecution[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.SERVICE_EXECUTIONS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as ServiceExecution);
        saveLocalCollection(KEYS.SERVICE_EXECUTIONS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.SERVICE_EXECUTIONS);
        callback(getLocalCollection(KEYS.SERVICE_EXECUTIONS));
      });
    } catch (err) {
      console.warn("Failed Executions setup:", err);
      callback(getLocalCollection(KEYS.SERVICE_EXECUTIONS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.SERVICE_EXECUTIONS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeCompanies: (callback: (data: Company[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.COMPANIES), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Company);
        saveLocalCollection(KEYS.COMPANIES, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.COMPANIES);
        callback(getLocalCollection(KEYS.COMPANIES));
      });
    } catch (err) {
      console.warn("Failed Companies setup:", err);
      callback(getLocalCollection(KEYS.COMPANIES));
    }
    const unsubFallback = registerFallbackCallback(KEYS.COMPANIES, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeJobFunctions: (callback: (data: JobFunction[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.JOB_FUNCTIONS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as JobFunction);
        saveLocalCollection(KEYS.JOB_FUNCTIONS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.JOB_FUNCTIONS);
        callback(getLocalCollection(KEYS.JOB_FUNCTIONS));
      });
    } catch (err) {
      console.warn("Failed Job Functions setup:", err);
      callback(getLocalCollection(KEYS.JOB_FUNCTIONS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.JOB_FUNCTIONS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },
  
  subscribeLaborTrackings: (callback: (data: LaborTracking[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.LABOR_TRACKING), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as LaborTracking);
        saveLocalCollection(KEYS.LABOR_TRACKING, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.LABOR_TRACKING);
        callback(getLocalCollection(KEYS.LABOR_TRACKING));
      });
    } catch (err) {
      console.warn("Failed Labor Trackings setup:", err);
      callback(getLocalCollection(KEYS.LABOR_TRACKING));
    }
    const unsubFallback = registerFallbackCallback(KEYS.LABOR_TRACKING, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeLogs: (callback: (data: TimeLog[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.LOGS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as TimeLog);
        saveLocalCollection(KEYS.LOGS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.LOGS);
        callback(getLocalCollection(KEYS.LOGS));
      });
    } catch (err) {
      console.warn("Failed Logs setup:", err);
      callback(getLocalCollection(KEYS.LOGS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.LOGS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeWeatherLogs: (callback: (data: WeatherLog[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.WEATHER_LOGS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as WeatherLog);
        saveLocalCollection(KEYS.WEATHER_LOGS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.WEATHER_LOGS);
        callback(getLocalCollection(KEYS.WEATHER_LOGS));
      });
    } catch (err) {
      console.warn("Failed Weather Logs setup:", err);
      callback(getLocalCollection(KEYS.WEATHER_LOGS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.WEATHER_LOGS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeWorkDiaries: (callback: (data: WorkDiary[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.WORK_DIARIES), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as WorkDiary);
        saveLocalCollection(KEYS.WORK_DIARIES, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.WORK_DIARIES);
        callback(getLocalCollection(KEYS.WORK_DIARIES));
      });
    } catch (err) {
      console.warn("Failed Work Diaries setup:", err);
      callback(getLocalCollection(KEYS.WORK_DIARIES));
    }
    const unsubFallback = registerFallbackCallback(KEYS.WORK_DIARIES, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  subscribeUsers: (callback: (data: User[]) => void) => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, KEYS.USERS), (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as User);
        saveLocalCollection(KEYS.USERS, data, false);
        callback(data);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, KEYS.USERS);
        callback(getLocalCollection(KEYS.USERS));
      });
    } catch (err) {
      console.warn("Failed Users setup:", err);
      callback(getLocalCollection(KEYS.USERS));
    }
    const unsubFallback = registerFallbackCallback(KEYS.USERS, callback);
    return () => {
      unsub();
      unsubFallback();
    };
  },

  // CRUD Operations
  getProjects: async (): Promise<Project[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.PROJECTS));
      const data = snap.docs.map(doc => doc.data() as Project);
      saveLocalCollection(KEYS.PROJECTS, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.PROJECTS);
      return getLocalCollection(KEYS.PROJECTS);
    }
  },

  getEmployees: async (): Promise<Employee[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.EMPLOYEES));
      const data = snap.docs.map(doc => doc.data() as Employee);
      saveLocalCollection(KEYS.EMPLOYEES, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.EMPLOYEES);
      return getLocalCollection(KEYS.EMPLOYEES);
    }
  },

  getSuppliers: async (): Promise<Supplier[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.SUPPLIERS));
      const data = snap.docs.map(doc => doc.data() as Supplier);
      saveLocalCollection(KEYS.SUPPLIERS, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.SUPPLIERS);
      return getLocalCollection(KEYS.SUPPLIERS);
    }
  },

  saveSupplier: async (supplier: Supplier) => {
    const key = KEYS.SUPPLIERS;
    const current = getLocalCollection(key);
    const index = current.findIndex(s => s.id === supplier.id);
    if (index >= 0) {
      current[index] = supplier;
    } else {
      current.push(supplier);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(supplier);
      await setDoc(doc(db, key, supplier.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${supplier.id}`);
    }
  },

  deleteSupplier: async (id: string) => {
    const key = KEYS.SUPPLIERS;
    const current = getLocalCollection(key).filter(s => s.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  getContracts: async (): Promise<Contract[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.CONTRACTS));
      const data = snap.docs.map(doc => doc.data() as Contract);
      saveLocalCollection(KEYS.CONTRACTS, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.CONTRACTS);
      return getLocalCollection(KEYS.CONTRACTS);
    }
  },

  saveContract: async (contract: Contract) => {
    const key = KEYS.CONTRACTS;
    const current = getLocalCollection(key);
    const index = current.findIndex(c => c.id === contract.id);
    if (index >= 0) {
      current[index] = contract;
    } else {
      current.push(contract);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(contract);
      await setDoc(doc(db, key, contract.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${contract.id}`);
    }
  },

  getContractMeasurements: async (): Promise<ContractMeasurement[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.CONTRACT_MEASUREMENTS));
      const data = snap.docs.map(doc => doc.data() as ContractMeasurement);
      saveLocalCollection(KEYS.CONTRACT_MEASUREMENTS, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.CONTRACT_MEASUREMENTS);
      return getLocalCollection(KEYS.CONTRACT_MEASUREMENTS);
    }
  },

  saveContractMeasurement: async (m: ContractMeasurement) => {
    const key = KEYS.CONTRACT_MEASUREMENTS;
    const current = getLocalCollection(key);
    const index = current.findIndex(x => x.id === m.id);
    if (index >= 0) {
      current[index] = m;
    } else {
      current.push(m);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(m);
      await setDoc(doc(db, key, m.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${m.id}`);
    }
  },

  deleteContractMeasurement: async (id: string) => {
    const key = KEYS.CONTRACT_MEASUREMENTS;
    const current = getLocalCollection(key).filter(x => x.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  getFVS: async (): Promise<FVS[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.FVS));
      const data = snap.docs.map(doc => doc.data() as FVS);
      saveLocalCollection(KEYS.FVS, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.FVS);
      return getLocalCollection(KEYS.FVS);
    }
  },

  saveFVS: async (fvs: FVS) => {
    const key = KEYS.FVS;
    const current = getLocalCollection(key);
    const index = current.findIndex(f => f.id === fvs.id);
    if (index >= 0) {
      current[index] = fvs;
    } else {
      current.push(fvs);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(fvs);
      await setDoc(doc(db, key, fvs.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${fvs.id}`);
    }
  },

  deleteFVS: async (id: string) => {
    const key = KEYS.FVS;
    const current = getLocalCollection(key).filter(f => f.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.USERS));
      const data = snap.docs.map(doc => doc.data() as User);
      saveLocalCollection(KEYS.USERS, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.USERS);
      return getLocalCollection(KEYS.USERS);
    }
  },

  getUser: async (id: string): Promise<User | null> => {
    try {
      const docRef = doc(db, KEYS.USERS, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const u = docSnap.data() as User;
        // Merge into cache
        const users = getLocalCollection(KEYS.USERS);
        const idx = users.findIndex(item => item.id === u.id);
        if (idx >= 0) { users[idx] = u; } else { users.push(u); }
        saveLocalCollection(KEYS.USERS, users, false);
        return u;
      }
      const localUsers = getLocalCollection(KEYS.USERS);
      return localUsers.find(u => u.id === id) || null;
    } catch (err) {
      const localUsers = getLocalCollection(KEYS.USERS);
      return localUsers.find(u => u.id === id) || null;
    }
  },

  getUserByEmail: async (email: string): Promise<User | null> => {
    try {
      const q = query(collection(db, KEYS.USERS), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const u = snap.docs[0].data() as User;
        const users = getLocalCollection(KEYS.USERS);
        const idx = users.findIndex(item => item.id === u.id);
        if (idx >= 0) { users[idx] = u; } else { users.push(u); }
        saveLocalCollection(KEYS.USERS, users, false);
        return u;
      }
      const localUsers = getLocalCollection(KEYS.USERS);
      return localUsers.find(u => u.email === email) || null;
    } catch (err) {
      const localUsers = getLocalCollection(KEYS.USERS);
      return localUsers.find(u => u.email === email) || null;
    }
  },

  saveUser: async (user: User) => {
    const key = KEYS.USERS;
    const current = getLocalCollection(key);
    const index = current.findIndex(u => u.id === user.id);
    if (index >= 0) {
      current[index] = user;
    } else {
      current.push(user);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(user);
      await setDoc(doc(db, key, user.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${user.id}`);
    }
  },

  deleteUser: async (id: string) => {
    const key = KEYS.USERS;
    const current = getLocalCollection(key).filter(u => u.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) {
      try {
        localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
      } catch (e) {
        console.error("Failed to save current user to localStorage due to storage limits:", e);
      }
    } else {
      localStorage.removeItem(KEYS.CURRENT_USER);
    }
  },

  saveCompany: async (company: Company) => {
    const key = KEYS.COMPANIES;
    const current = getLocalCollection(key);
    const index = current.findIndex(c => c.id === company.id);
    if (index >= 0) {
      current[index] = company;
    } else {
      current.push(company);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(company);
      await setDoc(doc(db, key, company.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${company.id}`);
    }
  },

  deleteCompany: async (id: string) => {
    const key = KEYS.COMPANIES;
    const current = getLocalCollection(key).filter(c => c.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  saveJobFunction: async (jobFunction: JobFunction) => {
    const key = KEYS.JOB_FUNCTIONS;
    const current = getLocalCollection(key);
    const index = current.findIndex(j => j.id === jobFunction.id);
    if (index >= 0) {
      current[index] = jobFunction;
    } else {
      current.push(jobFunction);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(jobFunction);
      await setDoc(doc(db, key, jobFunction.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${jobFunction.id}`);
    }
  },

  deleteJobFunction: async (id: string) => {
    const key = KEYS.JOB_FUNCTIONS;
    const current = getLocalCollection(key).filter(j => j.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  getLaborTrackings: async (): Promise<LaborTracking[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.LABOR_TRACKING));
      const data = snap.docs.map(doc => doc.data() as LaborTracking);
      saveLocalCollection(KEYS.LABOR_TRACKING, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.LABOR_TRACKING);
      return getLocalCollection(KEYS.LABOR_TRACKING);
    }
  },

  saveLaborTracking: async (tracking: LaborTracking) => {
    const key = KEYS.LABOR_TRACKING;
    const current = getLocalCollection(key);
    const index = current.findIndex(t => t.id === tracking.id);
    if (index >= 0) {
      current[index] = tracking;
    } else {
      current.push(tracking);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(tracking);
      await setDoc(doc(db, key, tracking.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${tracking.id}`);
    }
  },

  saveLaborTrackings: async (trackings: LaborTracking[]) => {
    const key = KEYS.LABOR_TRACKING;
    const current = getLocalCollection(key);
    // Add all or update
    trackings.forEach(t => {
      const idx = current.findIndex(x => x.id === t.id);
      if (idx >= 0) { current[idx] = t; } else { current.push(t); }
    });
    saveLocalCollection(key, current);

    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < trackings.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = trackings.slice(i, i + 500);
        chunk.forEach(t => {
          const sanitized = sanitizeForFirestore(t);
          const docRef = doc(db, key, t.id);
          batch.set(docRef, sanitized);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, key);
    }
  },

  deleteLaborTrackings: async (ids: string[]) => {
    const key = KEYS.LABOR_TRACKING;
    const current = getLocalCollection(key).filter(t => !ids.includes(t.id));
    saveLocalCollection(key, current);

    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = ids.slice(i, i + 500);
        chunk.forEach(id => {
          const docRef = doc(db, key, id);
          batch.delete(docRef);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, key);
    }
  },

  getMeasurements: async (): Promise<DailyMeasurement[]> => {
    try {
      const snap = await getDocs(collection(db, KEYS.MEASUREMENTS));
      const data = snap.docs.map(doc => doc.data() as DailyMeasurement);
      saveLocalCollection(KEYS.MEASUREMENTS, data, false);
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, KEYS.MEASUREMENTS);
      return getLocalCollection(KEYS.MEASUREMENTS);
    }
  },

  saveMeasurement: async (m: DailyMeasurement) => {
    const key = KEYS.MEASUREMENTS;
    const current = getLocalCollection(key);
    const index = current.findIndex(x => x.id === m.id);
    if (index >= 0) {
      current[index] = m;
    } else {
      current.push(m);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(m);
      await setDoc(doc(db, key, m.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${m.id}`);
    }
  },

  deleteContract: async (id: string) => {
    const key = KEYS.CONTRACTS;
    const current = getLocalCollection(key).filter(c => c.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  deleteProject: async (id: string) => {
    const key = KEYS.PROJECTS;
    const current = getLocalCollection(key).filter(p => p.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  saveProject: async (project: Project) => {
    const key = KEYS.PROJECTS;
    const current = getLocalCollection(key);
    const index = current.findIndex(p => p.id === project.id);
    if (index >= 0) {
      current[index] = project;
    } else {
      current.push(project);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(project);
      await setDoc(doc(db, key, project.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${project.id}`);
    }
  },

  saveEmployee: async (employee: Employee) => {
    const key = KEYS.EMPLOYEES;
    const current = getLocalCollection(key);
    const index = current.findIndex(e => e.id === employee.id);
    if (index >= 0) {
      current[index] = employee;
    } else {
      current.push(employee);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(employee);
      await setDoc(doc(db, key, employee.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${employee.id}`);
    }
  },

  saveEmployees: async (employees: Employee[]) => {
    const key = KEYS.EMPLOYEES;
    const current = getLocalCollection(key);
    employees.forEach(emp => {
      const idx = current.findIndex(x => x.id === emp.id);
      if (idx >= 0) { current[idx] = emp; } else { current.push(emp); }
    });
    saveLocalCollection(key, current);

    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < employees.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = employees.slice(i, i + 500);
        chunk.forEach(emp => {
          const sanitized = sanitizeForFirestore(emp);
          const docRef = doc(db, key, emp.id);
          batch.set(docRef, sanitized);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, key);
    }
  },

  deleteEmployee: async (id: string) => {
    const key = KEYS.EMPLOYEES;
    const current = getLocalCollection(key).filter(e => e.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${key}/${id}`);
    }
  },

  saveLog: async (log: TimeLog) => {
    const key = KEYS.LOGS;
    const current = getLocalCollection(key);
    const index = current.findIndex(l => l.id === log.id);
    if (index >= 0) {
      current[index] = log;
    } else {
      current.push(log);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(log);
      await setDoc(doc(db, key, log.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${log.id}`);
    }
  },

  saveLogs: async (logs: TimeLog[]) => {
    const key = KEYS.LOGS;
    const current = getLocalCollection(key);
    logs.forEach(log => {
      const idx = current.findIndex(x => x.id === log.id);
      if (idx >= 0) { current[idx] = log; } else { current.push(log); }
    });
    saveLocalCollection(key, current);

    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < logs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = logs.slice(i, i + 500);
        
        chunk.forEach(log => {
          const sanitized = sanitizeForFirestore(log);
          const docRef = doc(db, key, log.id);
          batch.set(docRef, sanitized);
        });
        
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, key);
    }
  },

  deleteLogs: async (ids: string[]) => {
    const key = KEYS.LOGS;
    const current = getLocalCollection(key).filter(log => !ids.includes(log.id));
    saveLocalCollection(key, current);

    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = ids.slice(i, i + 500);
        chunk.forEach(id => {
          const docRef = doc(db, key, id);
          batch.delete(docRef);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, key);
    }
  },

  saveServiceExecution: async (execution: ServiceExecution) => {
    const key = KEYS.SERVICE_EXECUTIONS;
    const current = getLocalCollection(key);
    const index = current.findIndex(x => x.id === execution.id);
    if (index >= 0) {
      current[index] = execution;
    } else {
      current.push(execution);
    }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(execution);
      await setDoc(doc(db, key, execution.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${execution.id}`);
    }
  },

  saveServiceExecutions: async (executions: ServiceExecution[]) => {
    const key = KEYS.SERVICE_EXECUTIONS;
    const current = getLocalCollection(key);
    executions.forEach(ex => {
      const idx = current.findIndex(x => x.id === ex.id);
      if (idx >= 0) { current[idx] = ex; } else { current.push(ex); }
    });
    saveLocalCollection(key, current);

    try {
      const { writeBatch } = await import('firebase/firestore');
      for (let i = 0; i < executions.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = executions.slice(i, i + 500);
        chunk.forEach(ex => {
          const sanitized = sanitizeForFirestore(ex);
          const docRef = doc(db, key, ex.id);
          batch.set(docRef, sanitized);
        });
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, key);
    }
  },

  saveWeatherLog: async (log: WeatherLog) => {
    const key = KEYS.WEATHER_LOGS;
    const current = getLocalCollection(key);
    const idx = current.findIndex(x => x.id === log.id);
    if (idx >= 0) { current[idx] = log; } else { current.push(log); }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(log);
      await setDoc(doc(db, key, log.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${log.id}`);
    }
  },

  saveWorkDiary: async (diary: WorkDiary) => {
    const key = KEYS.WORK_DIARIES;
    const current = getLocalCollection(key);
    const idx = current.findIndex(x => x.id === diary.id);
    if (idx >= 0) { current[idx] = diary; } else { current.push(diary); }
    saveLocalCollection(key, current);

    try {
      const sanitized = sanitizeForFirestore(diary);
      await setDoc(doc(db, key, diary.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${diary.id}`);
    }
  },

  deleteWorkDiary: async (id: string) => {
    const key = KEYS.WORK_DIARIES;
    let current = getLocalCollection(key);
    current = current.filter(x => x.id !== id);
    saveLocalCollection(key, current);

    try {
      await deleteDoc(doc(db, key, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${key}/${id}`);
    }
  }
};
