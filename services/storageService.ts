
import { Employee, TimeLog, Company, Project, JobFunction, User, LaborTracking, DailyMeasurement, Contract, ContractMeasurement, Supplier, ServiceExecution, FVS, WeatherLog } from '../types';

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

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/data${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro na requisição');
  }
  return response.json();
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

// Helper for generic subscription pattern using the API
const createSubscription = (table: string, callback: (data: any) => void) => {
  let active = true;
  const fetchAndCallback = async () => {
    try {
      const data = await apiFetch(`/${table}`);
      if (active) callback(data);
    } catch (e) {
      console.error(`Sub error for ${table}:`, e);
    }
  };
  
  fetchAndCallback();
  // Simplified: Poll every 30 seconds if real-time is not via SSE/WebSockets
  const interval = setInterval(fetchAndCallback, 30000);

  return () => {
    active = false;
    clearInterval(interval);
  };
};

export const storageService: StorageService = {
  // Sync Listeners
  subscribeFVS: (cb) => createSubscription(KEYS.FVS, cb),
  subscribeProjects: (cb) => createSubscription(KEYS.PROJECTS, cb),
  subscribeEmployees: (cb) => createSubscription(KEYS.EMPLOYEES, cb),
  subscribeSuppliers: (cb) => createSubscription(KEYS.SUPPLIERS, cb),
  subscribeContracts: (cb) => createSubscription(KEYS.CONTRACTS, cb),
  subscribeContractMeasurements: (cb) => createSubscription(KEYS.CONTRACT_MEASUREMENTS, cb),
  subscribeExecutions: (cb) => createSubscription(KEYS.SERVICE_EXECUTIONS, cb),
  subscribeCompanies: (cb) => createSubscription(KEYS.COMPANIES, cb),
  subscribeJobFunctions: (cb) => createSubscription(KEYS.JOB_FUNCTIONS, cb),
  subscribeLaborTrackings: (cb) => createSubscription(KEYS.LABOR_TRACKING, cb),
  subscribeLogs: (cb) => createSubscription(KEYS.LOGS, cb),
  subscribeWeatherLogs: (cb) => createSubscription(KEYS.WEATHER_LOGS, cb),

  // CRUD Operations
  getProjects: () => apiFetch(`/${KEYS.PROJECTS}`),
  getEmployees: () => apiFetch(`/${KEYS.EMPLOYEES}`),
  getSuppliers: () => apiFetch(`/${KEYS.SUPPLIERS}`),
  saveSupplier: (supplier) => apiFetch(`/${KEYS.SUPPLIERS}`, { method: 'POST', body: JSON.stringify(supplier) }),
  deleteSupplier: (id) => apiFetch(`/${KEYS.SUPPLIERS}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),
  
  getContracts: () => apiFetch(`/${KEYS.CONTRACTS}`),
  saveContract: (contract) => apiFetch(`/${KEYS.CONTRACTS}`, { method: 'POST', body: JSON.stringify(contract) }),
  deleteContract: (id) => apiFetch(`/${KEYS.CONTRACTS}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),

  getContractMeasurements: () => apiFetch(`/${KEYS.CONTRACT_MEASUREMENTS}`),
  saveContractMeasurement: (m) => apiFetch(`/${KEYS.CONTRACT_MEASUREMENTS}`, { method: 'POST', body: JSON.stringify(m) }),
  deleteContractMeasurement: (id) => apiFetch(`/${KEYS.CONTRACT_MEASUREMENTS}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),

  getFVS: () => apiFetch(`/${KEYS.FVS}`),
  saveFVS: (fvs) => apiFetch(`/${KEYS.FVS}`, { method: 'POST', body: JSON.stringify(fvs) }),
  deleteFVS: (id) => apiFetch(`/${KEYS.FVS}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),

  getUsers: () => apiFetch(`/${KEYS.USERS}`),
  getUser: (id) => apiFetch(`/${KEYS.USERS}/${id}`),
  saveUser: (user) => apiFetch(`/${KEYS.USERS}`, { method: 'POST', body: JSON.stringify(user) }),
  deleteUser: (id) => apiFetch(`/${KEYS.USERS}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),

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

  saveCompany: (company) => apiFetch(`/${KEYS.COMPANIES}`, { method: 'POST', body: JSON.stringify(company) }),
  deleteCompany: (id) => apiFetch(`/${KEYS.COMPANIES}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),

  saveJobFunction: (jf) => apiFetch(`/${KEYS.JOB_FUNCTIONS}`, { method: 'POST', body: JSON.stringify(jf) }),
  deleteJobFunction: (id) => apiFetch(`/${KEYS.JOB_FUNCTIONS}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),

  getLaborTrackings: () => apiFetch(`/${KEYS.LABOR_TRACKING}`),
  saveLaborTracking: (t) => apiFetch(`/${KEYS.LABOR_TRACKING}`, { method: 'POST', body: JSON.stringify(t) }),
  saveLaborTrackings: (trackings) => apiFetch(`/${KEYS.LABOR_TRACKING}`, { method: 'POST', body: JSON.stringify(trackings) }),
  deleteLaborTrackings: (ids) => apiFetch(`/${KEYS.LABOR_TRACKING}`, { method: 'DELETE', body: JSON.stringify({ ids }) }),

  getMeasurements: () => apiFetch(`/${KEYS.MEASUREMENTS}`),
  saveMeasurement: (m) => apiFetch(`/${KEYS.MEASUREMENTS}`, { method: 'POST', body: JSON.stringify(m) }),

  saveProject: (p) => apiFetch(`/${KEYS.PROJECTS}`, { method: 'POST', body: JSON.stringify(p) }),
  deleteProject: (id) => apiFetch(`/${KEYS.PROJECTS}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),

  saveEmployee: (emp) => apiFetch(`/${KEYS.EMPLOYEES}`, { method: 'POST', body: JSON.stringify(emp) }),
  saveEmployees: (employees) => apiFetch(`/${KEYS.EMPLOYEES}`, { method: 'POST', body: JSON.stringify(employees) }),
  deleteEmployee: (id) => apiFetch(`/${KEYS.EMPLOYEES}`, { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),

  saveLog: (log) => apiFetch(`/${KEYS.LOGS}`, { method: 'POST', body: JSON.stringify(log) }),
  saveLogs: (logs) => apiFetch(`/${KEYS.LOGS}`, { method: 'POST', body: JSON.stringify(logs) }),
  deleteLogs: (ids) => apiFetch(`/${KEYS.LOGS}`, { method: 'DELETE', body: JSON.stringify({ ids }) }),

  saveServiceExecution: (ex) => apiFetch(`/${KEYS.SERVICE_EXECUTIONS}`, { method: 'POST', body: JSON.stringify(ex) }),
  saveServiceExecutions: (exs) => apiFetch(`/${KEYS.SERVICE_EXECUTIONS}`, { method: 'POST', body: JSON.stringify(exs) }),

  saveWeatherLog: (log) => apiFetch(`/${KEYS.WEATHER_LOGS}`, { method: 'POST', body: JSON.stringify(log) }),
};

