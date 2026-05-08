
import React, { useState, useEffect, useMemo } from 'react';
import { Camera } from './components/Camera';
import { ProjectHierarchyEditor } from './components/ProjectHierarchyEditor';
import { CostStructureEditor } from './components/CostStructureEditor';
import { QualityMappingEditor } from './components/QualityMappingEditor';
import { LaborTrackingView } from './components/LaborTracking';
import { ContractMeasurementsView } from './components/ContractMeasurements';
import { SuppliersView } from './components/Suppliers';
import { EmployeeAdminView } from './components/EmployeeAdmin';
import { ConfirmModal } from './components/ConfirmModal';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { generateId } from './src/lib/utils';
import { PlanningView } from './components/Planning';
import { QualityModule } from './components/QualityModule';
import { TimeTrackingModule } from './components/TimeTrackingModule';
import { WeatherView } from './components/WeatherView';
import { MainDashboard } from './components/MainDashboard';
import { weatherService } from './services/weatherService';
import { auth, db } from './src/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { Employee, TimeLog, LogType, Location, Company, Project, JobFunction, User, UserRole, ConstructionUnit, LaborTracking, DailyMeasurement, CostCenter, Contract, ContractMeasurement, Supplier, ServiceExecution, FVS, WeatherLog } from './types';

type ViewType = 'dashboard' | 'register' | 'admin' | 'companies' | 'projects' | 'functions' | 'daily_report' | 'period_report' | 'users' | 'login' | 'measurements' | 'suppliers' | 'employees' | 'planning' | 'quality' | 'labor_tracking' | 'weather';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('register');
  const [isMaodeObraOpen, setIsMaodeObraOpen] = useState(true);
  const [isCadastrosOpen, setIsCadastrosOpen] = useState(false);
  const [isRelatoriosOpen, setIsRelatoriosOpen] = useState(false);
  const [isMedicoesOpen, setIsMedicoesOpen] = useState(false);
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);
  const [isQualityOpen, setIsQualityOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isWeatherSynced, setIsWeatherSynced] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [trackings, setTrackings] = useState<LaborTracking[]>([]);
  const [measurements, setMeasurements] = useState<DailyMeasurement[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractMeasurements, setContractMeasurements] = useState<ContractMeasurement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [serviceExecutions, setServiceExecutions] = useState<ServiceExecution[]>([]);
  const [fvsList, setFvsList] = useState<FVS[]>([]);
  const [weatherLogs, setWeatherLogs] = useState<WeatherLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Form states for new user
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserCPF, setNewUserCPF] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserCompanies, setNewUserCompanies] = useState<string[]>([]);
  const [newUserProjects, setNewUserProjects] = useState<string[]>([]);
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.USER);

  // Form states for new company
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCNPJ, setNewCompanyCNPJ] = useState('');

  // Form states for new project
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCity, setNewProjectCity] = useState('');
  const [newProjectLatitude, setNewProjectLatitude] = useState<number | undefined>(undefined);
  const [newProjectLongitude, setNewProjectLongitude] = useState<number | undefined>(undefined);
  const [newProjectStatus, setNewProjectStatus] = useState<'Ativa' | 'Inativa'>('Ativa');
  const [newProjectConstructionUnits, setNewProjectConstructionUnits] = useState<ConstructionUnit[]>([]);
  const [newProjectCostStructure, setNewProjectCostStructure] = useState<CostCenter[]>([]);
  const [newProjectFvsMapping, setNewProjectFvsMapping] = useState<{ [servicePath: string]: string }>({});
  const [projectFormTab, setProjectFormTab] = useState<'eap' | 'cost' | 'quality'>('eap');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);

  // Form states for new job function
  const [editingJobFunctionId, setEditingJobFunctionId] = useState<string | null>(null);
  const [newJobFunctionName, setNewJobFunctionName] = useState('');

  // Report filters
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Find or create user in Firestore
        storageService.getUser(firebaseUser.uid).then(user => {
          if (!user) {
            user = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Usuário',
              cpf: '',
              phone: '',
              email: firebaseUser.email || '',
              role: firebaseUser.email === 'guillehorta81@gmail.com' ? UserRole.ADMIN : UserRole.USER,
              companies: [],
              projects: [],
              createdAt: Date.now()
            };
            storageService.saveUser(user);
          }
          setCurrentUser(user);
          storageService.setCurrentUser(user);
          if (view === 'login' || view === 'register') setView('dashboard');
        });
      } else {
        setCurrentUser(null);
        storageService.setCurrentUser(null);
        setView('login');
      }
      setIsAuthReady(true);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Subscriptions based on roles
    const isManager = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

    const unsubFvs = storageService.subscribeFVS(setFvsList);
    const unsubProjects = storageService.subscribeProjects(setProjects);
    const unsubEmployees = storageService.subscribeEmployees(setEmployees);
    const unsubCompanies = storageService.subscribeCompanies(setCompanies);
    const unsubJobFunctions = storageService.subscribeJobFunctions(setJobFunctions);
    const unsubWeather = storageService.subscribeWeatherLogs(setWeatherLogs);
    const unsubTrackings = storageService.subscribeLaborTrackings(setTrackings);

    // Manager+ only data
    let unsubSuppliers = () => {};
    let unsubContracts = () => {};
    let unsubContractM = () => {};
    let unsubExecutions = () => {};
    let unsubLogs = () => {};

    if (isManager) {
      unsubSuppliers = storageService.subscribeSuppliers(setSuppliers);
      unsubContracts = storageService.subscribeContracts(setContracts);
      unsubContractM = storageService.subscribeContractMeasurements(setContractMeasurements);
      unsubExecutions = storageService.subscribeExecutions(setServiceExecutions);
      unsubLogs = storageService.subscribeLogs(setLogs);
    }

    return () => {
      unsubFvs();
      unsubProjects();
      unsubEmployees();
      unsubCompanies();
      unsubJobFunctions();
      unsubWeather();
      unsubTrackings();
      if (isManager) {
        unsubSuppliers();
        unsubContracts();
        unsubContractM();
        unsubExecutions();
        unsubLogs();
      }
    };
  }, [currentUser]);

  // Weather Auto-Sync Logic
  useEffect(() => {
    if (projects.length > 0 && !isWeatherSynced && weatherLogs.length >= 0) {
      const now = new Date();
      const hour = now.getHours();
      
      // Auto-sync if it's after 6 AM
      if (hour >= 6) {
        weatherService.syncYesterdayWeather(projects, weatherLogs);
        setIsWeatherSynced(true);
      }
    }
  }, [projects, weatherLogs, isWeatherSynced]);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
      setFeedback({ type: 'error', msg: "Erro ao fazer login com Google." });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      storageService.setCurrentUser(null);
      setView('login');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleLogin = async () => {
    try {
      if (!loginEmail || !loginPassword) {
        setFeedback({ type: 'error', msg: "Preencha e-mail e senha." });
        return;
      }
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      console.error("Login Error:", error);
      setFeedback({ type: 'error', msg: "E-mail ou senha incorretos." });
    }
    clearFeedback();
  };

  const clearFeedback = () => setTimeout(() => setFeedback(null), 5000);

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setFeedback({ type: 'error', msg: "Geolocalização não suportada neste navegador." });
        resolve({ latitude: 0, longitude: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => {
          console.warn("Geolocation warning:", err.message);
          // If permission is denied or location unavailable, we still resolve with 0,0 
          // to allow the app to function, but we don't show a blocking error toast
          // unless it's a critical system error.
          resolve({ latitude: 0, longitude: 0 });
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  };

  const handlePointRegistration = async (photo: string) => {
    setIsProcessing(true);
    try {
      const location = await getCurrentLocation();
      const result = await geminiService.verifyFace(photo, employees);

      if (result.match && result.employeeId) {
        const employee = employees.find(e => e.id === result.employeeId);
        if (employee) {
          // Determine if it's an Entry or Exit based on last log
          const lastLog = logs.find(l => l.employeeId === employee.id);
          const type = (!lastLog || lastLog.type === LogType.OUT) ? LogType.IN : LogType.OUT;

          const newLog: TimeLog = {
            id: generateId(),
            employeeId: employee.id,
            employeeName: employee.name,
            type,
            timestamp: Date.now(),
            location,
            capturedPhoto: photo,
            verified: true,
            confidence: result.confidence
          };

          storageService.saveLog(newLog);
          setFeedback({ type: 'success', msg: `Ponto de ${type} registrado: ${employee.name}` });
          setView('dashboard');
        }
      } else {
        setFeedback({ type: 'error', msg: result.message || "Rosto não reconhecido. Tente novamente." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', msg: "Ocorreu um erro ao processar o registro." });
    } finally {
      setIsProcessing(false);
      clearFeedback();
    }
  };

  const handleCreateCompany = () => {
    if (!newCompanyName || !newCompanyCNPJ) {
      setFeedback({ type: 'error', msg: "Preencha todos os campos da empresa." });
      return;
    }

    const newComp: Company = {
      id: editingCompanyId || generateId(),
      name: newCompanyName,
      cnpj: newCompanyCNPJ,
      createdAt: Date.now()
    };

    storageService.saveCompany(newComp);
    setFeedback({ type: 'success', msg: editingCompanyId ? "Empresa atualizada com sucesso!" : "Empresa cadastrada com sucesso!" });
    setNewCompanyName('');
    setNewCompanyCNPJ('');
    setEditingCompanyId(null);
    clearFeedback();
  };

  const handleEditCompany = (comp: Company) => {
    setNewCompanyName(comp.name);
    setNewCompanyCNPJ(comp.cnpj);
    setEditingCompanyId(comp.id);
  };

  const handleCreateProject = () => {
    if (!newProjectCode || !newProjectName) {
      setFeedback({ type: 'error', msg: "Preencha todos os campos da obra." });
      return;
    }

    const newProj: Project = {
      id: editingProjectId || generateId(),
      code: newProjectCode,
      name: newProjectName,
      status: newProjectStatus,
      constructionUnits: newProjectConstructionUnits,
      costStructure: newProjectCostStructure,
      fvsMapping: newProjectFvsMapping,
      city: newProjectCity,
      latitude: newProjectLatitude,
      longitude: newProjectLongitude,
      createdAt: Date.now()
    };

    storageService.saveProject(newProj);
    setFeedback({ type: 'success', msg: editingProjectId ? "Obra atualizada com sucesso!" : "Obra cadastrada com sucesso!" });
    setNewProjectCode('');
    setNewProjectName('');
    setNewProjectCity('');
    setNewProjectLatitude(undefined);
    setNewProjectLongitude(undefined);
    setNewProjectStatus('Ativa');
    setNewProjectConstructionUnits([]);
    setNewProjectCostStructure([]);
    setNewProjectFvsMapping({});
    setEditingProjectId(null);
    setIsAddingProject(false);
    clearFeedback();
  };

  const handleEditProject = (proj: Project) => {
    setNewProjectCode(proj.code);
    setNewProjectName(proj.name);
    setNewProjectCity(proj.city || '');
    setNewProjectLatitude(proj.latitude);
    setNewProjectLongitude(proj.longitude);
    setNewProjectStatus(proj.status);
    setNewProjectConstructionUnits(proj.constructionUnits || []);
    setNewProjectCostStructure(proj.costStructure || []);
    setNewProjectFvsMapping(proj.fvsMapping || {});
    setEditingProjectId(proj.id);
    setIsAddingProject(true);
  };

  const handleCreateJobFunction = () => {
    if (!newJobFunctionName) {
      setFeedback({ type: 'error', msg: "Preencha o nome da função." });
      return;
    }

    const newJF: JobFunction = {
      id: editingJobFunctionId || generateId(),
      name: newJobFunctionName,
      createdAt: Date.now()
    };

    storageService.saveJobFunction(newJF);
    setFeedback({ type: 'success', msg: editingJobFunctionId ? "Função atualizada com sucesso!" : "Função cadastrada com sucesso!" });
    setNewJobFunctionName('');
    setEditingJobFunctionId(null);
    clearFeedback();
  };

  const handleEditJobFunction = (jf: JobFunction) => {
    setNewJobFunctionName(jf.name);
    setEditingJobFunctionId(jf.id);
  };

  const handleSaveEmployee = (employee: Employee) => {
    storageService.saveEmployee(employee);
  };

  const handleSaveEmployees = (employees: Employee[]) => {
    storageService.saveEmployees(employees);
  };

  const handleDeleteEmployee = (id: string) => {
    storageService.deleteEmployee(id);
  };

  const handleImportLogs = async (newLogs: TimeLog[]) => {
    await storageService.saveLogs(newLogs);
    setFeedback({ type: 'success', msg: `${newLogs.length} registros importados com sucesso!` });
    clearFeedback();
  };

  const handleDeleteLogs = async (ids: string[]) => {
    await storageService.deleteLogs(ids);
  };

  const handleSaveServiceExecution = (execution: ServiceExecution) => {
    setServiceExecutions(prev => {
      const idx = prev.findIndex(e => e.id === execution.id || (e.servicePath === execution.servicePath && e.componentPath === execution.componentPath));
      if (idx >= 0) {
        const next = [...prev];
        // Preserve the existing ID if found by path/component to avoid duplicates in Firestore
        const existingId = next[idx].id;
        const updatedExecution = { ...next[idx], ...execution, id: existingId };
        next[idx] = updatedExecution;
        storageService.saveServiceExecution(updatedExecution);
        return next;
      }
      storageService.saveServiceExecution(execution);
      return [...prev, execution];
    });
  };

  const handleSaveServiceExecutions = (executions: ServiceExecution[]) => {
    setServiceExecutions(executions);
    storageService.saveServiceExecutions(executions);
  };

  const handleSaveTracking = (tracking: LaborTracking) => {
    storageService.saveLaborTracking(tracking);
  };

  const handleSaveTrackings = (newTrackings: LaborTracking[]) => {
    storageService.saveLaborTrackings(newTrackings);
  };

  const handleDeleteTrackings = (ids: string[]) => {
    storageService.deleteLaborTrackings(ids);
  };

  const handleSaveMeasurement = (measurement: DailyMeasurement) => {
    storageService.saveMeasurement(measurement);
  };

  const handleSaveContract = (contract: Contract) => {
    storageService.saveContract(contract);
  };

  const handleSaveContractMeasurement = (measurement: ContractMeasurement) => {
    storageService.saveContractMeasurement(measurement);
  };

  const handleDeleteContractMeasurement = (id: string) => {
    const measurementToDelete = contractMeasurements.find(m => m.id === id);
    if (!measurementToDelete) return;

    const contractId = measurementToDelete.contractId;
    const relatedMeasurements = contractMeasurements
      .filter(m => m.contractId === contractId)
      .sort((a, b) => b.measurementNumber - a.measurementNumber);

    if (relatedMeasurements.length > 0 && relatedMeasurements[0].id !== id) {
      setFeedback({ type: 'error', msg: "Apenas a última medição pode ser excluída." });
      return;
    }

    storageService.deleteContractMeasurement(id);
    setContractMeasurements(prev => prev.filter(m => m.id !== id));
  };

  const handleDeleteContract = (id: string) => {
    const hasMeasurements = contractMeasurements.some(m => m.contractId === id);
    if (hasMeasurements) {
      setFeedback({ type: 'error', msg: "Um contrato só pode ser excluído se todas as medições forem removidas primeiro." });
      return;
    }

    storageService.deleteContract(id);
    setContracts(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateProjectTeams = (projectId: string, teams: string[]) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedProject = { ...project, teams };
      storageService.saveProject(updatedProject);
    }
  };

  const handleCreateUser = () => {
    if (!newUserName || !newUserEmail || !newUserPassword || !newUserRole || !newUserCPF) {
      setFeedback({ type: 'error', msg: "Preencha os campos obrigatórios." });
      return;
    }

    const newUser: User = {
      id: editingUserId || generateId(),
      name: newUserName,
      cpf: newUserCPF,
      phone: newUserPhone,
      email: newUserEmail,
      password: newUserPassword,
      companies: newUserCompanies,
      projects: newUserProjects,
      role: newUserRole,
      createdAt: Date.now()
    };

    storageService.saveUser(newUser);
    setFeedback({ type: 'success', msg: editingUserId ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!" });
    
    // Reset form
    setNewUserName('');
    setNewUserCPF('');
    setNewUserPhone('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserCompanies([]);
    setNewUserProjects([]);
    setNewUserRole(UserRole.USER);
    setEditingUserId(null);
    
    setView('users');
    clearFeedback();
  };

  const handleEditUser = (user: User) => {
    setNewUserName(user.name);
    setNewUserCPF(user.cpf);
    setNewUserPhone(user.phone);
    setNewUserEmail(user.email);
    setNewUserPassword(user.password || '');
    setNewUserCompanies(user.companies || []);
    setNewUserProjects(user.projects || []);
    setNewUserRole(user.role);
    setEditingUserId(user.id);
  };

  const userCompanies = useMemo(() => {
    if (!currentUser) return [];
    return companies.filter(c => currentUser.role === UserRole.ADMIN || currentUser.companies?.includes(c.name));
  }, [companies, currentUser]);

  const userProjects = useMemo(() => {
    if (!currentUser) return [];
    return projects.filter(p => currentUser.role === UserRole.ADMIN || currentUser.projects?.includes(p.name));
  }, [projects, currentUser]);

  const handleFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    clearFeedback();
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Carregando ambiente...</p>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-emerald-500/10 blur-[120px] rounded-full"></div>
        
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl p-10 rounded-[40px] border border-white/20 shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 transform -rotate-6 mb-6">
              <i className="fas fa-tower-observation text-4xl text-white"></i>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight text-center">TowerUP Pro</h1>
            <p className="text-slate-400 text-sm mt-2 font-medium">Gestão Inteligente de Obras</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </button>
            <p className="text-center text-slate-500 text-xs mt-6">
              Ao entrar, você concorda com nossos Termos e Privacidade
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-indigo-900 text-white flex flex-col shadow-xl z-20 transition-all duration-300 relative`}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-10 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg z-30 hover:bg-indigo-400 transition-colors"
          title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          <i className={`fas fa-chevron-${isSidebarCollapsed ? 'right' : 'left'} text-[10px]`}></i>
        </button>

        <div className={`p-6 flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
            <i className="fas fa-tower-observation text-xl"></i>
          </div>
          {!isSidebarCollapsed && <span className="text-xl font-bold tracking-tight truncate">TowerUP</span>}
        </div>
        
        <nav className="flex-1 mt-4 px-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {currentUser && (
            <button 
              onClick={() => setView('dashboard')}
              className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${view === 'dashboard' ? 'bg-indigo-800' : 'hover:bg-indigo-800/50'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={isSidebarCollapsed ? 'Dashboard' : ''}
            >
              <i className="fas fa-chart-line w-5 shrink-0"></i> 
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>
          )}

          <div className="pt-2">
            <button 
              onClick={() => !isSidebarCollapsed && setIsMaodeObraOpen(!isMaodeObraOpen)}
              className={`w-full text-left px-4 py-2 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between hover:text-white transition ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={isSidebarCollapsed ? 'Mão-de-obra' : ''}
            >
              {isSidebarCollapsed ? <i className="fas fa-users-cog w-5 text-center"></i> : <span>Mão-de-obra</span>}
              {!isSidebarCollapsed && <i className={`fas fa-chevron-${isMaodeObraOpen ? 'down' : 'right'} text-[10px]`}></i>}
            </button>

            {isMaodeObraOpen && !isSidebarCollapsed && (
              <div className="mt-1 space-y-1 ml-2 border-l border-indigo-800/50">
                <button 
                  onClick={() => setView('register')}
                  className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'register' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                >
                  <i className="fas fa-camera w-4"></i> Registro de Ponto
                </button>
                <button 
                  onClick={() => setView('labor_tracking')}
                  className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'labor_tracking' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                >
                  <i className="fas fa-clipboard-list w-4"></i> Apontamento de Mão-de-Obra
                </button>
              </div>
            )}
            
            {/* Collapsed view items for MaodeObra */}
            {isSidebarCollapsed && (
              <>
                <button 
                  onClick={() => setView('register')}
                  className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${view === 'register' ? 'bg-indigo-800' : 'hover:bg-indigo-800/50'} justify-center px-0`}
                  title="Registro de Ponto"
                >
                  <i className="fas fa-camera w-5 shrink-0"></i> 
                </button>
                <button 
                  onClick={() => setView('labor_tracking')}
                  className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${view === 'labor_tracking' ? 'bg-indigo-800' : 'hover:bg-indigo-800/50'} justify-center px-0`}
                  title="Apontamento de Mão-de-Obra"
                >
                  <i className="fas fa-clipboard-list w-5 shrink-0"></i> 
                </button>
              </>
            )}
          </div>
          
          {currentUser && (
            <div className="pt-2">
              <button 
                onClick={() => !isSidebarCollapsed && setIsCadastrosOpen(!isCadastrosOpen)}
                className={`w-full text-left px-4 py-2 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between hover:text-white transition ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                title={isSidebarCollapsed ? 'Cadastros' : ''}
              >
                {isSidebarCollapsed ? <i className="fas fa-folder-open w-5 text-center"></i> : <span>Cadastros</span>}
                {!isSidebarCollapsed && <i className={`fas fa-chevron-${isCadastrosOpen ? 'down' : 'right'} text-[10px]`}></i>}
              </button>
              
              {isCadastrosOpen && !isSidebarCollapsed && (
                <div className="mt-1 space-y-1 ml-2 border-l border-indigo-800/50">
                  {currentUser.role === UserRole.ADMIN && (
                    <>
                      <button 
                        onClick={() => setView('companies')}
                        className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'companies' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                      >
                        <i className="fas fa-building w-4"></i> Empresas
                      </button>
                      <button 
                        onClick={() => setView('projects')}
                        className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'projects' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                      >
                        <i className="fas fa-hard-hat w-4"></i> Obras
                      </button>
                      <button 
                        onClick={() => setView('suppliers')}
                        className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'suppliers' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                      >
                        <i className="fas fa-truck w-4"></i> Fornecedores
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setView('employees')}
                    className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'employees' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                  >
                    <i className="fas fa-users w-4"></i> Colaboradores
                  </button>
                  {currentUser.role === UserRole.ADMIN && (
                    <>
                      <button 
                        onClick={() => setView('functions')}
                        className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'functions' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                      >
                        <i className="fas fa-briefcase w-4"></i> Funções
                      </button>
                      <button 
                        onClick={() => setView('users')}
                        className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'users' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                      >
                        <i className="fas fa-user-shield w-4"></i> Usuários
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            <button 
              onClick={() => !isSidebarCollapsed && setIsPlanningOpen(!isPlanningOpen)}
              className={`w-full text-left px-4 py-2 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between hover:text-white transition ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={isSidebarCollapsed ? 'Planejamento' : ''}
            >
              {isSidebarCollapsed ? <i className="fas fa-tasks w-5 text-center"></i> : <span>Planejamento</span>}
              {!isSidebarCollapsed && <i className={`fas fa-chevron-${isPlanningOpen ? 'down' : 'right'} text-[10px]`}></i>}
            </button>
            
            {isPlanningOpen && !isSidebarCollapsed && (
              <div className="mt-1 space-y-1 ml-2 border-l border-indigo-800/50">
                <button 
                  onClick={() => setView('planning')}
                  className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'planning' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                >
                  <i className="fas fa-sitemap w-4"></i> Estrutura Analítica
                </button>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button 
              onClick={() => !isSidebarCollapsed && setIsRelatoriosOpen(!isRelatoriosOpen)}
              className={`w-full text-left px-4 py-2 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between hover:text-white transition ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={isSidebarCollapsed ? 'Relatórios' : ''}
            >
              {isSidebarCollapsed ? <i className="fas fa-file-alt w-5 text-center"></i> : <span>Relatórios</span>}
              {!isSidebarCollapsed && <i className={`fas fa-chevron-${isRelatoriosOpen ? 'down' : 'right'} text-[10px]`}></i>}
            </button>
            
            {isRelatoriosOpen && !isSidebarCollapsed && (
              <div className="mt-1 space-y-1 ml-2 border-l border-indigo-800/50">
                <button 
                  onClick={() => setView('daily_report')}
                  className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'daily_report' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                >
                  <i className="fas fa-calendar-day w-4"></i> Relatório Diário
                </button>
                <button 
                  onClick={() => setView('period_report')}
                  className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'period_report' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                >
                  <i className="fas fa-calendar-alt w-4"></i> Relatório por Período
                </button>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button 
              onClick={() => !isSidebarCollapsed && setIsMedicoesOpen(!isMedicoesOpen)}
              className={`w-full text-left px-4 py-2 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between hover:text-white transition ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={isSidebarCollapsed ? 'Medições' : ''}
            >
              {isSidebarCollapsed ? <i className="fas fa-calculator w-5 text-center"></i> : <span>Medições</span>}
              {!isSidebarCollapsed && <i className={`fas fa-chevron-${isMedicoesOpen ? 'down' : 'right'} text-[10px]`}></i>}
            </button>
            
            {isMedicoesOpen && !isSidebarCollapsed && (
              <div className="mt-1 space-y-1 ml-2 border-l border-indigo-800/50">
                <button 
                  onClick={() => setView('measurements')}
                  className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'measurements' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                >
                  <i className="fas fa-file-invoice-dollar w-4"></i> Medição de Contratos
                </button>
              </div>
            )}
          </div>
          <div className="pt-2">
            <button 
              onClick={() => !isSidebarCollapsed && setIsQualityOpen(!isQualityOpen)}
              className={`w-full text-left px-4 py-2 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center justify-between hover:text-white transition ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={isSidebarCollapsed ? 'Qualidade' : ''}
            >
              {isSidebarCollapsed ? <i className="fas fa-check-double w-5 text-center"></i> : <span>Qualidade</span>}
              {!isSidebarCollapsed && <i className={`fas fa-chevron-${isQualityOpen ? 'down' : 'right'} text-[10px]`}></i>}
            </button>
            
            {isQualityOpen && !isSidebarCollapsed && (
              <div className="mt-1 space-y-1 ml-2 border-l border-indigo-800/50">
                <button 
                  onClick={() => setView('quality')}
                  className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'quality' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                >
                  <i className="fas fa-clipboard-check w-4"></i> Cadastro FVS
                </button>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button 
              onClick={() => setView('weather')}
              className={`w-full text-left px-4 py-2 text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center gap-3 hover:text-white transition ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={isSidebarCollapsed ? 'Clima' : ''}
            >
              <i className="fas fa-cloud-sun w-5 text-center"></i>
              {!isSidebarCollapsed && <span>Clima</span>}
            </button>
          </div>
        </nav>

        <div className={`p-4 border-t border-indigo-800/50 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold shrink-0">
              {currentUser ? currentUser.name.substring(0, 2).toUpperCase() : 'FP'}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{currentUser ? currentUser.name : 'Visitante'}</p>
                <p className="text-[10px] text-indigo-300 truncate">{currentUser ? currentUser.email : 'Não logado'}</p>
              </div>
            )}
            {!isSidebarCollapsed && (
              currentUser ? (
                <button onClick={handleLogout} className="text-indigo-300 hover:text-white transition" title="Sair">
                  <i className="fas fa-sign-out-alt text-sm"></i>
                </button>
              ) : (
                <button onClick={() => setView('login')} className="text-indigo-300 hover:text-white transition" title="Entrar">
                  <i className="fas fa-sign-in-alt text-sm"></i>
                </button>
              )
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm">
          <h1 className="text-lg font-semibold text-slate-700">
            {view === 'dashboard' && 'Painel de Controle'}
            {view === 'register' && 'Registro Biométrico'}
            {view === 'employees' && 'Administração de Colaboradores'}
            {view === 'admin' && 'Configurações do Sistema'}
            {view === 'companies' && 'Administração de Empresas'}
            {view === 'projects' && 'Administração de Obras'}
            {view === 'functions' && 'Administração de Funções'}
            {view === 'users' && 'Administração de Usuários'}
            {view === 'daily_report' && 'Relatório Diário'}
            {view === 'period_report' && 'Relatório por Período'}
            {view === 'measurements' && 'Medição de Contratos'}
            {view === 'labor_tracking' && 'Apontamento de Mão-de-Obra'}
            {view === 'planning' && 'Planejamento de Obras'}
            {view === 'weather' && 'Histórico Climático'}
          </h1>
          <div className="flex items-center gap-4">
             <div className="text-right">
               <div className="text-sm font-medium text-slate-900">{new Date().toLocaleDateString('pt-BR')}</div>
               <div className="text-xs text-slate-500">Sistema Online</div>
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 border border-slate-300">
               <i className="fas fa-user"></i>
             </div>
          </div>
        </header>

        {/* Feedback Toast */}
        {feedback && (
          <div className={`fixed top-20 right-8 z-50 animate-bounce px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 ${
            feedback.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
            <i className={`fas ${feedback.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            <span className="font-medium">{feedback.msg}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Dashboard View */}
          {view === 'dashboard' && currentUser && (
            <div className="max-w-7xl mx-auto">
              <MainDashboard 
                projects={projects}
                employees={employees}
                logs={logs}
                weatherLogs={weatherLogs}
                serviceExecutions={serviceExecutions}
                fvs={fvsList}
                currentUser={currentUser}
              />
            </div>
          )}

          {/* Register Point View */}
          {view === 'register' && (
            <TimeTrackingModule 
              employees={employees}
              logs={logs}
              projects={projects}
              companies={companies}
              onRegisterPoint={handlePointRegistration}
              onImportLogs={handleImportLogs}
              onDeleteLogs={handleDeleteLogs}
              isProcessing={isProcessing}
            />
          )}

          {/* Admin / Management View */}
          {view === 'admin' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                  <i className="fas fa-cogs"></i>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Configurações do Sistema</h3>
                <p className="text-slate-500 mb-8">Utilize o menu lateral para gerenciar Empresas, Obras, Funções e Usuários.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <button onClick={() => setView('companies')} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition">
                        <i className="fas fa-building"></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Empresas</div>
                        <div className="text-xs text-slate-500">Gerenciar parceiros e contratantes</div>
                      </div>
                    </div>
                  </button>
                  <button onClick={() => setView('projects')} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition">
                        <i className="fas fa-hard-hat"></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Obras</div>
                        <div className="text-xs text-slate-500">Configurar canteiros e estruturas</div>
                      </div>
                    </div>
                  </button>
                  <button onClick={() => setView('employees')} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition">
                        <i className="fas fa-users"></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Colaboradores</div>
                        <div className="text-xs text-slate-500">Gestão de pessoal e documentos</div>
                      </div>
                    </div>
                  </button>
                  <button onClick={() => setView('suppliers')} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition">
                        <i className="fas fa-truck"></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Fornecedores</div>
                        <div className="text-xs text-slate-500">Cadastro de prestadores de serviço</div>
                      </div>
                    </div>
                  </button>
                  <button onClick={() => setView('functions')} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition">
                        <i className="fas fa-briefcase"></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Funções</div>
                        <div className="text-xs text-slate-500">Cargos e CBOs do sistema</div>
                      </div>
                    </div>
                  </button>
                  <button onClick={() => setView('users')} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition">
                        <i className="fas fa-user-shield"></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Usuários</div>
                        <div className="text-xs text-slate-500">Controle de acesso e permissões</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Companies View */}
          {view === 'companies' && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Form to add company */}
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">{editingCompanyId ? 'Editar Empresa' : 'Nova Empresa'}</h3>
                    {editingCompanyId && (
                      <button 
                        onClick={() => {
                          setEditingCompanyId(null);
                          setNewCompanyName('');
                          setNewCompanyCNPJ('');
                        }}
                        className="text-xs text-rose-500 font-medium hover:underline"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Nome da Empresa</label>
                      <input 
                        type="text" 
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ex: Construtora Silva"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">CNPJ</label>
                      <input 
                        type="text" 
                        value={newCompanyCNPJ}
                        onChange={(e) => setNewCompanyCNPJ(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="00.000.000/0000-00"
                      />
                    </div>

                    <button 
                      onClick={handleCreateCompany}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                      {editingCompanyId ? 'Salvar Alterações' : 'Cadastrar Empresa'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Company List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Empresas Cadastradas</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {companies.length === 0 ? (
                      <div className="col-span-2 py-20 text-center">
                        <i className="fas fa-building text-4xl text-slate-200 mb-4"></i>
                        <p className="text-slate-400">Nenhuma empresa cadastrada ainda.</p>
                      </div>
                    ) : (
                      companies.map(comp => (
                        <div key={comp.id} className="group relative bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm border border-slate-100">
                            <i className="fas fa-building text-xl"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 truncate">{comp.name}</h4>
                            <p className="text-xs text-slate-500 truncate">CNPJ: {comp.cnpj}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => handleEditCompany(comp)}
                              className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center transition-all"
                            >
                              <i className="fas fa-edit text-xs"></i>
                            </button>
                            <button 
                              onClick={() => {
                                storageService.deleteCompany(comp.id);
                                setCompanies(prev => prev.filter(c => c.id !== comp.id));
                              }}
                              className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Projects View */}
          {view === 'projects' && (
            <div className="max-w-6xl mx-auto space-y-8">
              
              {/* Project List with Filter */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="font-bold text-slate-800 text-lg">Obras Cadastradas</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 md:w-64">
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                      <input 
                        type="text" 
                        placeholder="Filtrar por nome..."
                        value={projectSearchTerm}
                        onChange={(e) => setProjectSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        setIsAddingProject(!isAddingProject);
                        if (!isAddingProject) {
                          setEditingProjectId(null);
                          setNewProjectCode('');
                          setNewProjectName('');
                          setNewProjectStatus('Ativa');
                          setNewProjectConstructionUnits([]);
                          setNewProjectCostStructure([]);
                          setNewProjectFvsMapping({});
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                    >
                      <i className={`fas ${isAddingProject ? 'fa-times' : 'fa-plus'}`}></i>
                      {isAddingProject ? 'Cancelar' : 'Nova Obra'}
                    </button>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects?.filter(p => p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())).length === 0 ? (
                    <div className="col-span-full py-12 text-center">
                      <i className="fas fa-hard-hat text-4xl text-slate-200 mb-4"></i>
                      <p className="text-slate-400">Nenhuma obra encontrada.</p>
                    </div>
                  ) : (
                    projects?.filter(p => p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()))
                      .map(proj => (
                        <div key={proj.id} className="group relative bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm border border-slate-100">
                            <i className="fas fa-hard-hat text-xl"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 truncate">{proj.name}</h4>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                proj.status === 'Ativa' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'
                              }`}>
                                {proj.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">Código: {proj.code}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {proj.constructionUnits && proj.constructionUnits.length > 0 && (
                                <div className="flex items-center gap-1 text-[9px] text-indigo-500 font-bold uppercase">
                                  <i className="fas fa-sitemap"></i>
                                  {proj.constructionUnits.length} Unidades
                                </div>
                              )}
                              {proj.costStructure && proj.costStructure.length > 0 && (
                                <div className="flex items-center gap-1 text-[9px] text-amber-500 font-bold uppercase">
                                  <i className="fas fa-wallet"></i>
                                  {proj.costStructure.length} Centros de Custo
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => handleEditProject(proj)}
                              className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center shadow-sm transition-all"
                            >
                              <i className="fas fa-edit text-xs"></i>
                            </button>
                            <button 
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: "Confirmar Exclusão",
                                  message: "Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.",
                                  onConfirm: () => {
                                    storageService.deleteProject(proj.id);
                                    setProjects(prev => prev.filter(p => p.id !== proj.id));
                                  }
                                });
                              }}
                              className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center shadow-sm transition-all"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Project Form (Add/Edit) */}
              {isAddingProject && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">{editingProjectId ? 'Editar Obra' : 'Nova Obra'}</h3>
                      <p className="text-slate-500 text-sm">Preencha as informações básicas e a estrutura do projeto.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsAddingProject(false);
                        setEditingProjectId(null);
                      }}
                      className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition flex items-center justify-center"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Código da Obra</label>
                      <input 
                        type="text" 
                        value={newProjectCode}
                        onChange={(e) => setNewProjectCode(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ex: OB001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Nome da Obra</label>
                      <input 
                        type="text" 
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ex: Edifício Central"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Cidade</label>
                      <input 
                        type="text" 
                        value={newProjectCity}
                        onChange={(e) => setNewProjectCity(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ex: São Paulo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Latitude</label>
                      <input 
                        type="number" 
                        step="any"
                        value={newProjectLatitude || ''}
                        onChange={(e) => setNewProjectLatitude(parseFloat(e.target.value) || undefined)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ex: -23.5505"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Longitude</label>
                      <input 
                        type="number" 
                        step="any"
                        value={newProjectLongitude || ''}
                        onChange={(e) => setNewProjectLongitude(parseFloat(e.target.value) || undefined)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ex: -46.6333"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Status</label>
                      <div className="flex gap-6 h-[50px] items-center">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="projStatus" 
                            checked={newProjectStatus === 'Ativa'}
                            onChange={() => setNewProjectStatus('Ativa')}
                            className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition">Ativa</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input 
                            type="radio" 
                            name="projStatus" 
                            checked={newProjectStatus === 'Inativa'}
                            onChange={() => setNewProjectStatus('Inativa')}
                            className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-rose-600 transition">Inativa</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100">
                    <div className="flex border-b border-slate-200 mb-6">
                      <button
                        onClick={() => setProjectFormTab('eap')}
                        className={`px-6 py-3 text-sm font-bold transition-all relative ${projectFormTab === 'eap' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Estrutura Analítica (EAP)
                        {projectFormTab === 'eap' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
                      </button>
                      <button
                        onClick={() => setProjectFormTab('cost')}
                        className={`px-6 py-3 text-sm font-bold transition-all relative ${projectFormTab === 'cost' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Estrutura de Custo
                        {projectFormTab === 'cost' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
                      </button>
                      <button
                        onClick={() => setProjectFormTab('quality')}
                        className={`px-6 py-3 text-sm font-bold transition-all relative ${projectFormTab === 'quality' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Qualidade
                        {projectFormTab === 'quality' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
                      </button>
                    </div>

                    {projectFormTab === 'eap' ? (
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <ProjectHierarchyEditor 
                          units={newProjectConstructionUnits} 
                          onChange={setNewProjectConstructionUnits} 
                        />
                      </div>
                    ) : projectFormTab === 'cost' ? (
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <CostStructureEditor 
                          costStructure={newProjectCostStructure}
                          onChange={setNewProjectCostStructure}
                          constructionUnits={newProjectConstructionUnits}
                        />
                      </div>
                    ) : (
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <QualityMappingEditor 
                          costStructure={newProjectCostStructure}
                          fvsList={fvsList}
                          mapping={newProjectFvsMapping}
                          onChange={setNewProjectFvsMapping}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-10 flex justify-end">
                    <button 
                      onClick={handleCreateProject}
                      className="px-10 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-3"
                    >
                      <i className="fas fa-save"></i>
                      {editingProjectId ? 'Salvar Alterações' : 'Cadastrar Obra'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
          {/* Job Functions View */}
          {view === 'functions' && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Form to add job function */}
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">{editingJobFunctionId ? 'Editar Função' : 'Nova Função'}</h3>
                    {editingJobFunctionId && (
                      <button 
                        onClick={() => {
                          setEditingJobFunctionId(null);
                          setNewJobFunctionName('');
                        }}
                        className="text-xs text-rose-500 font-medium hover:underline"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Nome da Função</label>
                      <input 
                        type="text" 
                        value={newJobFunctionName}
                        onChange={(e) => setNewJobFunctionName(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ex: Armador"
                      />
                    </div>

                    <button 
                      onClick={handleCreateJobFunction}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                      {editingJobFunctionId ? 'Salvar Alterações' : 'Cadastrar Função'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Job Function List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Funções Cadastradas</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobFunctions.length === 0 ? (
                      <div className="col-span-2 py-20 text-center">
                        <i className="fas fa-briefcase text-4xl text-slate-200 mb-4"></i>
                        <p className="text-slate-400">Nenhuma função cadastrada ainda.</p>
                      </div>
                    ) : (
                      jobFunctions?.map(jf => (
                        <div key={jf.id} className="group relative bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm border border-slate-100">
                            <i className="fas fa-briefcase text-xl"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 truncate">{jf.name}</h4>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => handleEditJobFunction(jf)}
                              className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center transition-all"
                            >
                              <i className="fas fa-edit text-xs"></i>
                            </button>
                            <button 
                              onClick={() => {
                                storageService.deleteJobFunction(jf.id);
                                setJobFunctions(prev => prev.filter(f => f.id !== jf.id));
                              }}
                              className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Users Management View */}
          {view === 'users' && currentUser?.role === UserRole.ADMIN && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">{editingUserId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                    {editingUserId && (
                      <button onClick={() => {
                        setEditingUserId(null);
                        setNewUserName('');
                        setNewUserCPF('');
                        setNewUserPhone('');
                        setNewUserEmail('');
                        setNewUserPassword('');
                        setNewUserCompanies([]);
                        setNewUserProjects([]);
                        setNewUserRole(UserRole.USER);
                      }} className="text-xs text-rose-500 font-medium hover:underline">Cancelar</button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Nome Completo</label>
                      <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">CPF</label>
                        <input type="text" value={newUserCPF} onChange={(e) => setNewUserCPF(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Telefone</label>
                        <input type="text" value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
                      <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Senha</label>
                      <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Empresas</label>
                        <div className="relative group">
                          <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer truncate">
                            {newUserCompanies.length === 0 ? 'Selecione' : `${newUserCompanies.length} selecionadas`}
                          </div>
                          <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 hidden group-hover:block p-2 max-h-48 overflow-y-auto">
                            {companies?.map(c => (
                              <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-xs text-slate-700">
                                <input 
                                  type="checkbox" 
                                  checked={newUserCompanies.includes(c.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) setNewUserCompanies([...newUserCompanies, c.name]);
                                    else setNewUserCompanies(newUserCompanies.filter(name => name !== c.name));
                                  }}
                                />
                                {c.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Obras</label>
                        <div className="relative group">
                          <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer truncate">
                            {newUserProjects.length === 0 ? 'Selecione' : `${newUserProjects.length} selecionadas`}
                          </div>
                          <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 hidden group-hover:block p-2 max-h-48 overflow-y-auto">
                            {projects?.map(p => (
                              <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-xs text-slate-700">
                                <input 
                                  type="checkbox" 
                                  checked={newUserProjects.includes(p.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) setNewUserProjects([...newUserProjects, p.name]);
                                    else setNewUserProjects(newUserProjects.filter(name => name !== p.name));
                                  }}
                                />
                                {p.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Usuário</label>
                      <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as UserRole)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                        {Object.values(UserRole)?.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </div>
                    <button onClick={handleCreateUser} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg">
                      {editingUserId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Usuários do Sistema</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 gap-4">
                    {users?.map(u => (
                      <div key={u.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-800">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email} • {u.role}</div>
                          <div className="text-[10px] text-indigo-500 uppercase font-bold mt-1">
                            {u.companies?.join(', ') || 'Sem Empresa'} | {u.projects?.join(', ') || 'Sem Obra'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditUser(u)} className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-indigo-500 flex items-center justify-center transition shadow-sm"><i className="fas fa-edit text-xs"></i></button>
                          <button onClick={async () => {
                            if (u.id === 'admin-001') return;
                            await storageService.deleteUser(u.id);
                          }} className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-rose-500 flex items-center justify-center transition shadow-sm"><i className="fas fa-trash-alt text-xs"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily Report View */}
          {view === 'daily_report' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800">Relatório Diário - {new Date().toLocaleDateString('pt-BR')}</h3>
                  <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2">
                    <i className="fas fa-print"></i> Imprimir
                  </button>
                </div>

                {/* Grouping Logic */}
                {(() => {
                  const today = new Date().toDateString();
                  const todayLogs = logs.filter(l => {
                    const isToday = new Date(l.timestamp).toDateString() === today;
                    if (!isToday) return false;
                    if (!currentUser || currentUser.role === UserRole.ADMIN) return true;
                    const emp = employees.find(e => e.id === l.employeeId);
                    return emp && currentUser.companies?.includes(emp.company) && emp.projects?.some(p => currentUser.projects?.includes(p));
                  });
                  
                  // Group by project
                  const projectGroups: { [key: string]: any[] } = {};
                  
                  employees.filter(emp => 
                    !currentUser || 
                    currentUser.role === UserRole.ADMIN || 
                    (currentUser.companies?.includes(emp.company) && emp.projects?.some(p => currentUser.projects?.includes(p)))
                  ).forEach(emp => {
                    const empLogs = todayLogs.filter(l => l.employeeId === emp.id).sort((a, b) => a.timestamp - b.timestamp);
                    if (empLogs.length > 0) {
                      const projs = emp.projects?.length > 0 ? emp.projects : ['Sem Obra'];
                      projs.forEach(projName => {
                        if (!projectGroups[projName]) projectGroups[projName] = [];
                        projectGroups[projName].push({
                          employee: emp,
                          logs: empLogs
                        });
                      });
                    }
                  });

                  const sortedProjects = Object.keys(projectGroups).sort();

                  if (sortedProjects.length === 0) {
                    return (
                      <div className="py-20 text-center">
                        <i className="fas fa-calendar-times text-4xl text-slate-200 mb-4"></i>
                        <p className="text-slate-400">Nenhum registro de ponto hoje.</p>
                      </div>
                    );
                  }

                  return sortedProjects?.map(projName => (
                    <div key={projName} className="mb-8 last:mb-0">
                      <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 mb-4">
                        <h4 className="font-bold text-indigo-600 text-sm uppercase tracking-wider">Obra: {projName}</h4>
                      </div>
                      <div className="overflow-hidden border border-slate-100 rounded-xl">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold">
                            <tr>
                              <th className="px-6 py-3">Colaborador</th>
                              <th className="px-6 py-3">Entradas / Saídas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {projectGroups[projName]?.sort((a, b) => a.employee.name.localeCompare(b.employee.name)).map(item => (
                              <tr key={item.employee.id} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-slate-800">{item.employee.name}</div>
                                  <div className="text-[10px] text-slate-400">{item.employee.role}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-wrap gap-2">
                                    {item.logs?.map((log: any) => (
                                      <div key={log.id} className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
                                        log.type === LogType.IN ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        <i className={`fas fa-arrow-${log.type === LogType.IN ? 'right' : 'left'}`}></i>
                                        {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Period Report View */}
          {view === 'period_report' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-6">Relatório por Período</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                    <input 
                      type="date" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                    <input 
                      type="date" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empresas</label>
                    <div className="relative group">
                      <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer truncate">
                        {selectedCompanies.length === 0 ? 'Todas' : `${selectedCompanies.length} selecionadas`}
                      </div>
                      <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 hidden group-hover:block p-2 max-h-48 overflow-y-auto">
                        {companies?.map(c => (
                          <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-xs">
                            <input 
                              type="checkbox" 
                              checked={selectedCompanies.includes(c.name)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCompanies([...selectedCompanies, c.name]);
                                else setSelectedCompanies(selectedCompanies.filter(id => id !== c.name));
                              }}
                            />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obras</label>
                    <div className="relative group">
                      <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer truncate">
                        {selectedProjects.length === 0 ? 'Todas' : `${selectedProjects.length} selecionadas`}
                      </div>
                      <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 hidden group-hover:block p-2 max-h-48 overflow-y-auto">
                        {projects?.map(p => (
                          <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-xs">
                            <input 
                              type="checkbox" 
                              checked={selectedProjects.includes(p.name)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedProjects([...selectedProjects, p.name]);
                                else setSelectedProjects(selectedProjects.filter(id => id !== p.name));
                              }}
                            />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Period Report Logic */}
                {(() => {
                  const start = new Date(reportStartDate);
                  start.setHours(0,0,0,0);
                  const end = new Date(reportEndDate);
                  end.setHours(23,59,59,999);

                  const filteredLogs = logs.filter(l => {
                    const logDate = new Date(l.timestamp);
                    return logDate >= start && logDate <= end;
                  });

                  const filteredEmployees = employees.filter(emp => {
                    const companyMatch = selectedCompanies.length === 0 || selectedCompanies.includes(emp.company);
                    const projectMatch = selectedProjects.length === 0 || emp.projects?.some(p => selectedProjects.includes(p));
                    const accessMatch = !currentUser || currentUser.role === UserRole.ADMIN || (currentUser.companies?.includes(emp.company) && emp.projects?.some(p => currentUser.projects?.includes(p)));
                    return companyMatch && projectMatch && accessMatch;
                  });

                  // Group by project
                  const projectGroups: { [key: string]: any[] } = {};

                  filteredEmployees.forEach(emp => {
                    const empLogs = filteredLogs.filter(l => l.employeeId === emp.id).sort((a, b) => a.timestamp - b.timestamp);
                    
                    if (empLogs.length > 0) {
                      // Calculate hours per day
                      const days: { [key: string]: number } = {};
                      
                      // Group logs by day
                      const logsByDay: { [key: string]: TimeLog[] } = {};
                      empLogs.forEach(log => {
                        const dayStr = new Date(log.timestamp).toDateString();
                        if (!logsByDay[dayStr]) logsByDay[dayStr] = [];
                        logsByDay[dayStr].push(log);
                      });

                      // Calculate hours for each day
                      Object.keys(logsByDay).forEach(dayStr => {
                        const dayLogs = logsByDay[dayStr];
                        let totalMs = 0;
                        let lastIn: number | null = null;

                        dayLogs.forEach(log => {
                          if (log.type === LogType.IN) {
                            lastIn = log.timestamp;
                          } else if (log.type === LogType.OUT && lastIn !== null) {
                            totalMs += (log.timestamp - lastIn);
                            lastIn = null;
                          }
                        });

                        if (totalMs > 0) {
                          days[dayStr] = totalMs / (1000 * 60 * 60); // Convert to hours
                        }
                      });

                      if (Object.keys(days).length > 0) {
                        const projs = emp.projects?.length > 0 ? emp.projects : ['Sem Obra'];
                        projs.forEach(projName => {
                          if (!projectGroups[projName]) projectGroups[projName] = [];
                          projectGroups[projName].push({
                            employee: emp,
                            days
                          });
                        });
                      }
                    }
                  });

                  const sortedProjects = Object.keys(projectGroups).sort();

                  if (sortedProjects.length === 0) {
                    return (
                      <div className="py-20 text-center">
                        <i className="fas fa-search text-4xl text-slate-200 mb-4"></i>
                        <p className="text-slate-400">Nenhum registro encontrado para os filtros selecionados.</p>
                      </div>
                    );
                  }

                  return sortedProjects?.map(projName => (
                    <div key={projName} className="mb-8 last:mb-0">
                      <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 mb-4">
                        <h4 className="font-bold text-indigo-600 text-sm uppercase tracking-wider">Obra: {projName}</h4>
                      </div>
                      <div className="overflow-x-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold">
                            <tr>
                              <th className="px-6 py-3 min-w-[200px]">Colaborador</th>
                              {/* Generate columns for each day in range */}
                              {(() => {
                                const cols = [];
                                let curr = new Date(start);
                                while (curr <= end) {
                                  cols.push(new Date(curr));
                                  curr.setDate(curr.getDate() + 1);
                                }
                                return cols?.map(d => (
                                  <th key={d.toDateString()} className="px-4 py-3 text-center">
                                    {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </th>
                                ));
                              })()}
                              <th className="px-6 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {projectGroups[projName]?.sort((a, b) => a.employee.name.localeCompare(b.employee.name)).map(item => {
                              let totalHours = 0;
                              const dayCols = [];
                              let curr = new Date(start);
                              while (curr <= end) {
                                const hours = item.days[curr.toDateString()] || 0;
                                totalHours += hours;
                                dayCols.push(hours);
                                curr.setDate(curr.getDate() + 1);
                              }

                              return (
                                <tr key={item.employee.id} className="hover:bg-slate-50/50 transition">
                                  <td className="px-6 py-4">
                                    <div className="font-medium text-slate-800 text-sm">{item.employee.name}</div>
                                    <div className="text-[9px] text-slate-400">{item.employee.company}</div>
                                  </td>
                                  {dayCols?.map((h, idx) => (
                                    <td key={idx} className={`px-4 py-4 text-center text-xs ${h > 0 ? 'font-bold text-slate-700' : 'text-slate-300'}`}>
                                      {h > 0 ? h.toFixed(1) : '-'}
                                    </td>
                                  ))}
                                  <td className="px-6 py-4 text-right font-bold text-indigo-600 text-sm">
                                    {totalHours.toFixed(1)}h
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Labor Tracking View */}
          {view === 'labor_tracking' && currentUser && (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <i className="fas fa-clipboard-list text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Apontamento de Mão-de-Obra</h2>
                    <p className="text-slate-500 text-sm italic">Vincule os colaboradores às etapas específicas da obra.</p>
                  </div>
                </div>

                <LaborTrackingView 
                  employees={employees}
                  suppliers={suppliers}
                  projects={userProjects}
                  logs={logs}
                  trackings={trackings}
                  serviceExecutions={serviceExecutions}
                  onSave={handleSaveTracking}
                  onSaveMany={handleSaveTrackings}
                  onDeleteMany={handleDeleteTrackings}
                  onUpdateProjectTeams={handleUpdateProjectTeams}
                  onSaveExecution={handleSaveServiceExecution}
                  onFeedback={handleFeedback}
                  onConfirm={(title, message, onConfirm) => {
                    setConfirmModal({
                      isOpen: true,
                      title,
                      message,
                      onConfirm
                    });
                  }}
                />
              </div>
            </div>
          )}

          {/* Measurements View */}
          {view === 'measurements' && currentUser && (
            <div className="max-w-full mx-auto space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <i className="fas fa-file-invoice-dollar text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Medição de Contratos</h2>
                    <p className="text-slate-500 text-sm italic">Gerencie contratos e realize medições periódicas com acumulados.</p>
                  </div>
                </div>

                <ContractMeasurementsView 
                  contracts={contracts}
                  measurements={contractMeasurements}
                  companies={userCompanies}
                  projects={userProjects}
                  suppliers={suppliers}
                  employees={employees}
                  laborTracking={trackings}
                  onSaveContract={handleSaveContract}
                  onSaveMeasurement={handleSaveContractMeasurement}
                  onDeleteMeasurement={handleDeleteContractMeasurement}
                  onDeleteContract={handleDeleteContract}
                  onFeedback={handleFeedback}
                  onConfirm={(title, message, onConfirm) => {
                    setConfirmModal({
                      isOpen: true,
                      title,
                      message,
                      onConfirm
                    });
                  }}
                />
              </div>
            </div>
          )}

          {/* Planning View */}
          {view === 'planning' && currentUser && (
            <div className="max-w-full mx-auto space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <i className="fas fa-tasks text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Planejamento de Obras</h2>
                    <p className="text-slate-500 text-sm italic">Gerencie a execução de serviços por unidade e visualize a EAP.</p>
                  </div>
                </div>

                <PlanningView 
                  projects={userProjects} 
                  serviceExecutions={serviceExecutions}
                  onSaveExecution={handleSaveServiceExecution}
                  trackings={trackings}
                  employees={employees}
                  suppliers={suppliers}
                  fvsList={fvsList}
                  onFeedback={handleFeedback}
                />
              </div>
            </div>
          )}

          {/* Quality View */}
          {view === 'quality' && currentUser && (
            <div className="max-w-full mx-auto space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <i className="fas fa-check-double text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Qualidade</h2>
                    <p className="text-slate-500 text-sm italic">Gerencie as Fichas de Verificação de Serviço e Instruções de Trabalho.</p>
                  </div>
                </div>

                <QualityModule 
                  onFeedback={handleFeedback}
                  onConfirm={(title, message, onConfirm) => {
                    setConfirmModal({
                      isOpen: true,
                      title,
                      message,
                      onConfirm
                    });
                  }}
                />
              </div>
            </div>
          )}

          {/* Weather History View */}
          {view === 'weather' && (
            <WeatherView 
              projects={projects}
              weatherLogs={weatherLogs}
            />
          )}

          {/* Suppliers View */}
          {view === 'suppliers' && currentUser && (
            <div className="max-w-full mx-auto space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <i className="fas fa-truck text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Fornecedores</h2>
                    <p className="text-slate-500 text-sm italic">Cadastre e gerencie os fornecedores do sistema.</p>
                  </div>
                </div>

                <SuppliersView 
                  companies={userCompanies}
                  projects={userProjects}
                  onFeedback={handleFeedback}
                />
              </div>
            </div>
          )}

          {/* Employee Administration View */}
          {view === 'employees' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800">Administração de Colaboradores</h2>
                <p className="text-slate-500">Gestão completa do quadro de funcionários e documentação.</p>
              </div>
              
              <EmployeeAdminView 
                employees={employees}
                companies={userCompanies}
                projects={userProjects}
                jobFunctions={jobFunctions}
                onSaveEmployee={handleSaveEmployee}
                onSaveEmployees={handleSaveEmployees}
                onDeleteEmployee={handleDeleteEmployee}
                onSaveJobFunction={(jf) => storageService.saveJobFunction(jf)}
                onFeedback={handleFeedback}
              />
            </div>
          )}

        </div>
      </main>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default App;
