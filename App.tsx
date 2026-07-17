
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
import { WorkDiaryReport } from './components/WorkDiaryReport';
import { weatherService } from './services/weatherService';
import { secullumService } from './services/secullumService';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { auth, db, firebaseConfig } from './src/firebase';
import axios from 'axios';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail
} from 'firebase/auth';
import { Employee, TimeLog, LogType, Location, Company, Project, JobFunction, User, UserRole, ConstructionUnit, LaborTracking, DailyMeasurement, CostCenter, Contract, ContractMeasurement, Supplier, ServiceExecution, FVS, WeatherLog, SecullumEmployee, WorkDiary } from './types';

type ViewType = 'dashboard' | 'register' | 'admin' | 'companies' | 'projects' | 'functions' | 'daily_report' | 'period_report' | 'users' | 'login' | 'measurements' | 'suppliers' | 'employees' | 'planning' | 'quality' | 'labor_tracking' | 'weather' | 'work_diary';

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
  const [userViewMode, setUserViewMode] = useState<'list' | 'form'>('list');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('Todos');
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
  const [workDiaries, setWorkDiaries] = useState<WorkDiary[]>([]);
  const [secullumEmployees, setSecullumEmployees] = useState<SecullumEmployee[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [diagnosticEmail, setDiagnosticEmail] = useState('');
  const [isCheckingDiagnostic, setIsCheckingDiagnostic] = useState(false);
  const [isPurgingDiagnostic, setIsPurgingDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{ exists?: boolean; uid?: string; email?: string; providerId?: string; isApiDisabled?: boolean; link?: string; message?: string } | null>(null);
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
  const [newProjectManagerId, setNewProjectManagerId] = useState<string>('');
  const [newProjectConstructionUnits, setNewProjectConstructionUnits] = useState<ConstructionUnit[]>([]);
  const [newProjectCostStructure, setNewProjectCostStructure] = useState<CostCenter[]>([]);
  const [newProjectFvsMapping, setNewProjectFvsMapping] = useState<{ [servicePath: string]: string }>({});
  const [projectFormTab, setProjectFormTab] = useState<'eap' | 'cost' | 'quality'>('eap');
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isUserCompanySelectorOpen, setIsUserCompanySelectorOpen] = useState(false);
  const [isUserProjectSelectorOpen, setIsUserProjectSelectorOpen] = useState(false);
  const [isReportCompanySelectorOpen, setIsReportCompanySelectorOpen] = useState(false);
  const [isReportProjectSelectorOpen, setIsReportProjectSelectorOpen] = useState(false);

  // Form states for new job function
  const [editingJobFunctionId, setEditingJobFunctionId] = useState<string | null>(null);
  const [newJobFunctionName, setNewJobFunctionName] = useState('');

  // Report filters
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Find user in Firestore
        let user = await storageService.getUser(firebaseUser.uid);
        
        if (!user && firebaseUser.email) {
          // Check by email if not found by UID (handles pre-registered users)
          user = await storageService.getUserByEmail(firebaseUser.email);
          if (user) {
            // Found by email, update ID to be firebase UID and save
            const updatedUser = { ...user, id: firebaseUser.uid };
            // Delete old record if ID changed (to avoid duplicates)
            if (user.id !== firebaseUser.uid) {
              await storageService.deleteUser(user.id);
            }
            await storageService.saveUser(updatedUser);
            user = updatedUser;
          }
        }

        // Restrict access ONLY if they exist in the users collection/table in Firestore (except the bootstrap admin)
        if (!user) {
          if (firebaseUser.email === 'guillehorta81@gmail.com') {
            user = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Administrador',
              cpf: '000.000.000-00',
              phone: '',
              email: firebaseUser.email || '',
              role: UserRole.ADMIN,
              companies: [],
              projects: [],
              createdAt: Date.now()
            };
            await storageService.saveUser(user);
          } else {
            console.warn(`Acesso negado para o e-mail: ${firebaseUser.email}. Usuário não cadastrado na coleção 'users'.`);
            await signOut(auth);
            setCurrentUser(null);
            storageService.setCurrentUser(null);
            setView('login');
            setFeedback({ type: 'error', msg: "Acesso negado. Seu usuário não está cadastrado no sistema." });
            return;
          }
        }

        setCurrentUser(user);
        storageService.setCurrentUser(user);
        if (view === 'login' || view === 'register') setView('dashboard');
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
    // Administrador and Gestor can see all users (but Gestor has restrictions on creation)
    const isManagerOrAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;
    // Usuário role is more restricted in some modules but has CRUD in others

    const unsubFvs = storageService.subscribeFVS(setFvsList);
    const unsubProjects = storageService.subscribeProjects(setProjects);
    const unsubEmployees = storageService.subscribeEmployees(setEmployees);
    const unsubCompanies = storageService.subscribeCompanies(setCompanies);
    const unsubJobFunctions = storageService.subscribeJobFunctions(setJobFunctions);
    const unsubWeather = storageService.subscribeWeatherLogs((logs) => {
      const uniqueLogsMap: { [key: string]: WeatherLog } = {};
      const sorted = [...logs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      sorted.forEach(log => {
        const key = `${log.projectId}_${log.date}`;
        uniqueLogsMap[key] = log;
      });
      setWeatherLogs(Object.values(uniqueLogsMap));
    });
    const unsubTrackings = storageService.subscribeLaborTrackings(setTrackings);
    const unsubSuppliers = storageService.subscribeSuppliers(setSuppliers);
    const unsubContracts = storageService.subscribeContracts(setContracts);
    const unsubContractM = storageService.subscribeContractMeasurements(setContractMeasurements);
    const unsubExecutions = storageService.subscribeExecutions(setServiceExecutions);
    const unsubLogs = storageService.subscribeLogs(setLogs);
    const unsubSecullum = secullumService.subscribeSecullumEmployees(setSecullumEmployees);
    const unsubWorkDiaries = storageService.subscribeWorkDiaries(setWorkDiaries);

    // All authenticated users subscribe to user list to resolve managers
    const unsubUsers = storageService.subscribeUsers(setUsers);

    return () => {
      unsubFvs();
      unsubProjects();
      unsubEmployees();
      unsubCompanies();
      unsubJobFunctions();
      unsubWeather();
      unsubTrackings();
      unsubSuppliers();
      unsubContracts();
      unsubContractM();
      unsubExecutions();
      unsubLogs();
      unsubSecullum();
      unsubWorkDiaries();
      unsubUsers();
    };
  }, [currentUser]);

  // Automated consolidation & deduplication of existing local employees with the same CPF
  useEffect(() => {
    if (!employees || employees.length === 0) return;

    // Find duplicates by CPF
    const cpfGroups: { [cpf: string]: Employee[] } = {};
    employees.forEach(emp => {
      if (!emp.cpf) return;
      const cleanCpf = emp.cpf.replace(/\D/g, '');
      if (!cleanCpf) return;
      
      if (!cpfGroups[cleanCpf]) {
        cpfGroups[cleanCpf] = [];
      }
      cpfGroups[cleanCpf].push(emp);
    });

    const duplicates = Object.values(cpfGroups).filter(group => group.length > 1);
    if (duplicates.length === 0) return;

    console.log(`[Deduplication] Found ${duplicates.length} CPFs with duplicate employee entries.`);

    const runDeduplication = async () => {
      for (const group of duplicates) {
        // Find the primary record based on heuristics:
        // 1. Has photoBase64 (essential for facial recognition)
        // 2. Active status vs Inactive
        // 3. Oldest creation (smallest createdAt)
        // 4. Most fields populated
        group.sort((a, b) => {
          if (a.photoBase64 && !b.photoBase64) return -1;
          if (!a.photoBase64 && b.photoBase64) return 1;

          if (a.status === 'Ativo' && b.status === 'Inativo') return -1;
          if (a.status === 'Inativo' && b.status === 'Ativo') return 1;

          const createdA = a.createdAt || 0;
          const createdB = b.createdAt || 0;
          if (createdA !== createdB) return createdA - createdB;

          const countFields = (obj: any) => Object.values(obj).filter(v => v !== null && v !== undefined && v !== '').length;
          return countFields(b) - countFields(a);
        });

        const primary = { ...group[0] };
        const secondaries = group.slice(1);

        let changed = false;

        // 1. Merge projects
        const allProjects = new Set([...(primary.projects || [])]);
        secondaries.forEach(sec => {
          if (sec.projects) {
            sec.projects.forEach(p => allProjects.add(p));
          }
        });
        if (allProjects.size !== (primary.projects || []).length) {
          primary.projects = Array.from(allProjects);
          changed = true;
        }

        // 2. Merge nested structures and empty/missing fields
        secondaries.forEach(sec => {
          Object.keys(sec).forEach(key => {
            const k = key as keyof Employee;
            
            if (k === 'documents') {
              if (sec.documents) {
                primary.documents = primary.documents || {};
                Object.keys(sec.documents).forEach(docKey => {
                  if (!primary.documents![docKey] && sec.documents![docKey]) {
                    primary.documents![docKey] = sec.documents![docKey];
                    changed = true;
                  }
                });
              }
            } else if (k === 'benefits') {
              if (sec.benefits) {
                primary.benefits = primary.benefits || {};
                if (!primary.benefits.va && sec.benefits.va) { primary.benefits.va = sec.benefits.va; changed = true; }
                if (!primary.benefits.vm && sec.benefits.vm) { primary.benefits.vm = sec.benefits.vm; changed = true; }
              }
            } else if (k === 'uniforms') {
              if (sec.uniforms) {
                primary.uniforms = primary.uniforms || {};
                if (!primary.uniforms.shoeSize && sec.uniforms.shoeSize) { primary.uniforms.shoeSize = sec.uniforms.shoeSize; changed = true; }
                if (!primary.uniforms.pantsSize && sec.uniforms.pantsSize) { primary.uniforms.pantsSize = sec.uniforms.pantsSize; changed = true; }
                if (!primary.uniforms.shirtSize && sec.uniforms.shirtSize) { primary.uniforms.shirtSize = sec.uniforms.shirtSize; changed = true; }
              }
            } else {
              if ((primary[k] === undefined || primary[k] === null || primary[k] === '') && sec[k] !== undefined && sec[k] !== null && sec[k] !== '') {
                // @ts-ignore
                primary[k] = sec[k];
                changed = true;
              }
            }
          });
        });

        // Save the consolidated primary record
        await storageService.saveEmployee(primary);

        // Delete other duplicate records from Firestore
        for (const sec of secondaries) {
          await storageService.deleteEmployee(sec.id);
        }
      }
    };

    runDeduplication().catch(err => {
      console.error("[Deduplication] Error cleaning up duplicates:", err);
    });
  }, [employees]);

  // Automated cleanup of invalid ServiceExecutions (apontamentos)
  useEffect(() => {
    if (!projects || projects.length === 0 || !serviceExecutions || serviceExecutions.length === 0) return;

    const invalidIds: string[] = [];

    serviceExecutions.forEach(ex => {
      const proj = projects.find(p => p.id === ex.projectId);
      if (!proj) return;

      const parts = ex.servicePath ? ex.servicePath.split('|') : [];
      if (parts.length < 4) {
        invalidIds.push(ex.id);
        return;
      }
      const [ccId, sId, ssId, svId] = parts;

      const cc = proj.costStructure?.find(c => c.id === ccId);
      const stage = cc?.stages?.find(s => s.id === sId);
      const subStage = stage?.subStages?.find(ss => ss.id === ssId);
      const service = subStage?.services?.find(sv => sv.id === svId);

      if (!service) {
        invalidIds.push(ex.id);
        return;
      }

      if (!service.linkedLevel) {
        invalidIds.push(ex.id);
        return;
      }

      const componentParts = ex.componentPath ? ex.componentPath.split('|') : [];
      if (componentParts.length === 0) {
        invalidIds.push(ex.id);
        return;
      }
      const compId = componentParts[componentParts.length - 1];

      if (!service.linkedComponentIds || !service.linkedComponentIds.includes(compId)) {
        invalidIds.push(ex.id);
      }
    });

    if (invalidIds.length > 0) {
      console.log(`[Clean Up] Automated task found ${invalidIds.length} invalid/obsolete service executions. Deleting...`);
      setServiceExecutions(prev => prev.filter(e => !invalidIds.includes(e.id)));
      storageService.deleteServiceExecutions(invalidIds);
    }
  }, [projects, serviceExecutions]);

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

  // Reset dropdowns on view/mode changes
  useEffect(() => {
    setIsUserCompanySelectorOpen(false);
    setIsUserProjectSelectorOpen(false);
  }, [userViewMode]);

  useEffect(() => {
    setIsReportCompanySelectorOpen(false);
    setIsReportProjectSelectorOpen(false);
  }, [view]);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
      setFeedback({ type: 'error', msg: "Erro ao fazer login com Google." });
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setFeedback({ type: 'error', msg: "Por favor, preencha o campo de e-mail acima para obter a redefinição de sua senha." });
      return;
    }
    try {
      setIsProcessing(true);
      await sendPasswordResetEmail(auth, loginEmail.trim());
      setFeedback({ type: 'success', msg: `E-mail de redefinição enviado para ${loginEmail}! Siga as instruções para configurar sua senha.` });
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      let errMsg = "Erro ao enviar e-mail de redefinição de senha.";
      if (error.code === 'auth/user-not-found') {
        errMsg = "Nenhum usuário correspondente encontrado com este e-mail.";
      } else if (error.code === 'auth/invalid-email') {
        errMsg = "Formato de e-mail inválido.";
      }
      setFeedback({ type: 'error', msg: errMsg });
    } finally {
      setIsProcessing(false);
      clearFeedback();
    }
  };

  const handleCheckDiagnosticUser = async () => {
    if (!diagnosticEmail) {
      setFeedback({ type: 'error', msg: "Preencha o e-mail para diagnosticar." });
      return;
    }
    setIsCheckingDiagnostic(true);
    try {
      const res = await axios.get(`/api/auth/check-user?email=${encodeURIComponent(diagnosticEmail.trim())}`);
      setDiagnosticResult(res.data);
      if (res.data.exists) {
        setFeedback({ type: 'success', msg: "E-mail encontrado no Firebase Auth! Veja os detalhes abaixo." });
      } else {
        setFeedback({ type: 'success', msg: "Nenhum usuário correspondente encontrado no Firebase Auth. E-mail livre!" });
      }
    } catch (checkErr: any) {
      console.error("Error diagnosing user email:", checkErr);
      const data = checkErr.response?.data;
      
      // Look for any hint of Identity Toolkit being disabled in standard or raw error details
      const rawText = [
        data ? JSON.stringify(data) : '',
        checkErr.message || '',
        String(checkErr)
      ].join(' ').toLowerCase();

      const isIdentityToolkitDisabled = 
        data?.code === 'IDENTITY_TOOLKIT_DISABLED' ||
        rawText.includes('identitytoolkit') ||
        rawText.includes('identity toolkit') ||
        rawText.includes('service_disabled') ||
        rawText.includes('service-disabled') ||
        rawText.includes('permission_denied') ||
        rawText.includes('permission-denied') ||
        rawText.includes('accessnotconfigured') ||
        rawText.includes('googleapis.com/overview?project=');

      if (isIdentityToolkitDisabled) {
        let projectId = '171527547079';
        const projectMatch = rawText.match(/project[\s=]+([a-zA-Z0-9-_]+)/) || rawText.match(/projects\/([a-zA-Z0-9-_]+)/);
        if (projectMatch && projectMatch[1]) {
          projectId = projectMatch[1];
        }
        
        setDiagnosticResult({
          isApiDisabled: true,
          link: `https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${projectId}`,
          message: data?.message || "A API de Autenticação Avançada do Firebase (Identity Toolkit) não está ativa no seu projeto do Google Cloud. Ela é necessária para buscar ou remover e-mails pela API de administração."
        });
        setFeedback({ type: 'error', msg: "A API do Google Cloud necessária está desativada no seu projeto. Siga as instruções abaixo." });
      } else {
        const errDetail = data?.message || data?.details || checkErr.message;
        setFeedback({ type: 'error', msg: `Erro ao consultar API de diagnóstico: ${errDetail}` });
      }
    } finally {
      setIsCheckingDiagnostic(false);
      clearFeedback();
    }
  };

  const handlePurgeDiagnosticUser = async () => {
    if (!diagnosticEmail) {
      setFeedback({ type: 'error', msg: "Preencha o e-mail para liberação forçada." });
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Liberar E-mail da Autenticação',
      message: `Tem certeza que deseja forçar a remoção do e-mail ${diagnosticEmail} da Autenticação do Firebase? Esta ação liberará completamente o e-mail para novo cadastro.`,
      onConfirm: async () => {
        setIsPurgingDiagnostic(true);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.post('/api/auth/delete-user', { email: diagnosticEmail.trim() });
          setDiagnosticResult({ exists: false });
          setFeedback({ type: 'success', msg: "Sucesso! O e-mail foi liberado com êxito da Autenticação do Firebase." });
        } catch (purgeErr: any) {
          console.error("Error purging user email:", purgeErr);
          const data = purgeErr.response?.data;
          
          const rawText = [
            data ? JSON.stringify(data) : '',
            purgeErr.message || '',
            String(purgeErr)
          ].join(' ').toLowerCase();

          const isIdentityToolkitDisabled = 
            data?.code === 'IDENTITY_TOOLKIT_DISABLED' ||
            rawText.includes('identitytoolkit') ||
            rawText.includes('identity toolkit') ||
            rawText.includes('service_disabled') ||
            rawText.includes('service-disabled') ||
            rawText.includes('permission_denied') ||
            rawText.includes('permission-denied') ||
            rawText.includes('accessnotconfigured') ||
            rawText.includes('googleapis.com/overview?project=');

          if (isIdentityToolkitDisabled) {
            let projectId = '171527547079';
            const projectMatch = rawText.match(/project[\s=]+([a-zA-Z0-9-_]+)/) || rawText.match(/projects\/([a-zA-Z0-9-_]+)/);
            if (projectMatch && projectMatch[1]) {
              projectId = projectMatch[1];
            }

            setDiagnosticResult({
              isApiDisabled: true,
              link: `https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${projectId}`,
              message: data?.message || "A API de Autenticação Avançada do Firebase (Identity Toolkit) não está ativa no seu projeto do Google Cloud."
            });
            setFeedback({ type: 'error', msg: "A API necessária do Google Cloud está desativada no seu projeto. Siga as instruções abaixo." });
          } else {
            const errDetail = data?.message || data?.details || purgeErr.message;
            setFeedback({ type: 'error', msg: `Falha na exclusão forçada: ${errDetail}` });
          }
        } finally {
          setIsPurgingDiagnostic(false);
          clearFeedback();
        }
      }
    });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setFeedback({ type: 'error', msg: "Informe e-mail e senha." });
      return;
    }

    setIsProcessing(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setFeedback({ type: 'success', msg: "Login realizado com sucesso!" });
      setLoginEmail('');
      setLoginPassword('');
    } catch (error: any) {
      console.error("Erro no login:", error);
      let msg = "Erro ao realizar login.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
        msg = "E-mail ou senha incorretos. Se você originalmente criou sua conta com o botão do Google, clique no botão 'Esqueceu sua senha?' acima para definir uma senha padrão de acesso por e-mail e senha.";
      } else if (error.code === 'auth/invalid-email') {
        msg = "E-mail inválido.";
      } else if (error.code === 'auth/operation-not-allowed') {
        msg = "O login por e-mail/senha não está ativado no Firebase Console.";
      }
      setFeedback({ type: 'error', msg });
    } finally {
      setIsProcessing(false);
      clearFeedback();
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
      managerId: newProjectManagerId || undefined,
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
    setNewProjectManagerId('');
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
    setNewProjectManagerId(proj.managerId || '');
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

  const handleDeleteServiceExecutions = (ids: string[]) => {
    setServiceExecutions(prev => prev.filter(e => !ids.includes(e.id)));
    storageService.deleteServiceExecutions(ids);
  };

  const handleSaveTracking = (tracking: LaborTracking) => {
    setTrackings(prev => {
      const idx = prev.findIndex(t => t.id === tracking.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = tracking;
        return next;
      }
      return [...prev, tracking];
    });
    storageService.saveLaborTracking(tracking);
  };

  const handleSaveTrackings = (newTrackings: LaborTracking[]) => {
    setTrackings(prev => {
      const next = [...prev];
      newTrackings.forEach(t => {
        const idx = next.findIndex(x => x.id === t.id);
        if (idx >= 0) {
          next[idx] = t;
        } else {
          next.push(t);
        }
      });
      return next;
    });
    storageService.saveLaborTrackings(newTrackings);
  };

  const handleDeleteTrackings = (ids: string[]) => {
    // 1. Find deleted trackings in the current state to know their service/component paths
    const deletedTrackings = trackings.filter(t => ids.includes(t.id));
    
    // 2. Perform the deletion of labor trackings
    storageService.deleteLaborTrackings(ids);
    setTrackings(prev => prev.filter(t => !ids.includes(t.id)));
    
    // 3. Clean up corresponding ServiceExecution documents if no trackings remain
    const processedKeys = new Set<string>();
    const executionsToDelete: string[] = [];
    const executionsToUpdate: ServiceExecution[] = [];
    
    deletedTrackings.forEach(t => {
      const pId = t.projectId;
      const sPaths = t.costStructureSelections || [];
      const selections = t.selections || [];
      
      if (!pId) return;
      
      sPaths.forEach(sPath => {
        selections.forEach(sel => {
          const parts = sel.split('|');
          const prefixes: string[] = [];
          for (let i = 1; i <= parts.length; i++) {
            prefixes.push(parts.slice(0, i).join('|'));
          }
          
          prefixes.forEach(prefix => {
            const comboKey = `${pId}|${sPath}|${prefix}`;
            if (processedKeys.has(comboKey)) return;
            processedKeys.add(comboKey);
            
            // Check if there are any remaining trackings for this combination
            const hasRemaining = trackings.some(rem => 
              !ids.includes(rem.id) &&
              rem.projectId === pId &&
              rem.costStructureSelections?.includes(sPath) &&
              rem.selections?.some(remSel => remSel === prefix || remSel.startsWith(prefix + '|'))
            );
            
            if (!hasRemaining) {
              // Find corresponding ServiceExecution
              const existingExec = serviceExecutions.find(ex => 
                ex.projectId === pId &&
                ex.servicePath === sPath &&
                ex.componentPath === prefix
              );
              
              if (existingExec) {
                const hasPlannedDates = !!(existingExec.startDatePlanned || existingExec.endDatePlanned);
                const hasFvs = !!(existingExec.fvsResults && Object.keys(existingExec.fvsResults).length > 0);
                
                if (hasPlannedDates || hasFvs) {
                  // Keep the execution but clear real start/end dates
                  const updatedExec = { ...existingExec };
                  delete updatedExec.startDateReal;
                  delete updatedExec.endDateReal;
                  executionsToUpdate.push(updatedExec);
                  storageService.saveServiceExecution(updatedExec);
                } else {
                  // Delete the execution completely
                  executionsToDelete.push(existingExec.id);
                  storageService.deleteServiceExecutions([existingExec.id]);
                }
              }
            }
          });
        });
      });
    });
    
    // Synchronously update serviceExecutions state
    if (executionsToDelete.length > 0 || executionsToUpdate.length > 0) {
      setServiceExecutions(prev => {
        let updated = prev;
        if (executionsToDelete.length > 0) {
          updated = updated.filter(ex => !executionsToDelete.includes(ex.id));
        }
        if (executionsToUpdate.length > 0) {
          updated = updated.map(ex => {
            const match = executionsToUpdate.find(up => up.id === ex.id);
            return match ? match : ex;
          });
        }
        return updated;
      });
    }
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

  const handleCreateUser = async () => {
    // Role specific checks
    if (currentUser?.role === UserRole.MANAGER) {
      if (newUserRole === UserRole.ADMIN || newUserRole === UserRole.MANAGER) {
        setFeedback({ type: 'error', msg: "Gestores podem criar apenas usuários com perfil 'Usuário'." });
        return;
      }
    }
    
    if (currentUser?.role === UserRole.USER) {
      setFeedback({ type: 'error', msg: "Usuários não têm permissão para gerenciar outros usuários." });
      return;
    }

    // Password is only mandatory when NEW user
    const isPasswordValid = editingUserId ? true : !!newUserPassword;
    
    if (!newUserName || !newUserEmail || !isPasswordValid || !newUserRole || !newUserCPF) {
      setFeedback({ type: 'error', msg: "Preencha os campos obrigatórios." });
      return;
    }

    let createdUid = editingUserId || generateId();

    try {
      // If NEW user, also create Firebase Auth account
      if (!editingUserId) {
        setIsProcessing(true);
        try {
          const secondaryApp = getApps().length > 1 
            ? getApp('Secondary') 
            : initializeApp(firebaseConfig, 'Secondary');
          const secondaryAuth = getAuth(secondaryApp);
          
          let userCredential;
          try {
            userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail.trim(), newUserPassword);
          } catch (authError: any) {
            if (authError.code === 'auth/email-already-in-use') {
              const cleanedEmail = newUserEmail.toLowerCase().trim();
              // Check if user actually exists in the Firestore database
              const existingLocalUser = await storageService.getUserByEmail(cleanedEmail);
              if (!existingLocalUser) {
                // Dangling/deleted user! We can purge them from Firebase Auth and retry!
                console.log(`Dangling user detected for ${cleanedEmail}. Attempting to purge from Firebase Auth and retry...`);
                try {
                  await axios.post('/api/auth/delete-user', { email: cleanedEmail });
                  // Retry creation
                  userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanedEmail, newUserPassword);
                } catch (retryError: any) {
                  console.error("Erro no retry após purgar conta:", retryError);
                  const data = retryError.response?.data;
                  
                  const rawText = [
                    data ? JSON.stringify(data) : '',
                    retryError.message || '',
                    String(retryError),
                    retryError.response?.status === 403 ? 'identitytoolkit disabled 403' : ''
                  ].join(' ').toLowerCase();

                  const isIdentityToolkitDisabled = 
                    data?.code === 'IDENTITY_TOOLKIT_DISABLED' ||
                    retryError.response?.status === 403 ||
                    rawText.includes('identitytoolkit') ||
                    rawText.includes('identity toolkit') ||
                    rawText.includes('service_disabled') ||
                    rawText.includes('service-disabled') ||
                    rawText.includes('permission_denied') ||
                    rawText.includes('permission-denied') ||
                    rawText.includes('accessnotconfigured') ||
                    rawText.includes('googleapis.com/overview?project=');

                  if (isIdentityToolkitDisabled) {
                    let projectId = '171527547079';
                    const projectMatch = rawText.match(/project[\s=]+([a-zA-Z0-9-_]+)/) || rawText.match(/projects\/([a-zA-Z0-9-_]+)/);
                    if (projectMatch && projectMatch[1]) {
                      projectId = projectMatch[1];
                    }
                    const link = `https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${projectId}`;
                    throw new Error(`Este e-mail (${cleanedEmail}) já possui uma conta órfã no Firebase Auth. Não conseguimos liberá-lo automaticamente porque a API de Autenticação Avançada (Identity Toolkit API) está desativada no seu console Google Cloud. Para resolver isso, você pode: (1) Ativar a API clicando no link: ${link} ou (2) Entrar diretamente no seu painel do Firebase Console -> Authentication -> Users, buscar por "${cleanedEmail}" e excluí-lo manualmente de lá.`);
                  }
                  
                  throw new Error(`Este e-mail está travado em uma conta órfã do Firebase Auth. Uma tentativa automática de liberação falhou: ${data?.message || retryError.message}. Por favor, utilize a "Ferramenta de Diagnóstico" abaixo para investigar.`);
                }
              } else {
                throw authError;
              }
            } else {
              throw authError;
            }
          }
          createdUid = userCredential.user.uid;
          await signOut(secondaryAuth); // Sign out from secondary app to cleanup
        } catch (authError: any) {
          console.error("Erro ao criar conta de autenticação:", authError);
          let msg = authError.message || "Erro ao criar conta de autenticação.";
          if (authError.code === 'auth/email-already-in-use') {
            msg = "Este e-mail já está em uso.";
          } else if (authError.code === 'auth/weak-password') {
            msg = "A senha é muito fraca (mínimo de 6 caracteres).";
          } else if (authError.code === 'auth/invalid-email') {
            msg = "Este formato de e-mail é inválido.";
          } else if (authError.code === 'auth/operation-not-allowed') {
            msg = "O login por e-mail/senha não está ativado no Firebase Console.";
          } else if (authError.code) {
            msg = `Erro na autenticação: ${authError.message} (${authError.code})`;
          }
          
          setFeedback({ type: 'error', msg });
          setIsProcessing(false);
          return;
        }
      }

      const newUser: User = {
        id: createdUid,
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

      await storageService.saveUser(newUser);
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
      
      setUserViewMode('list');
      setView('users');
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
    } finally {
      setIsProcessing(false);
      clearFeedback();
    }
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
        
        {/* Feedback Toast for Login */}
        {feedback && (
          <div className={`fixed top-8 right-8 z-50 animate-bounce px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 ${
            feedback.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
            <i className={`fas ${feedback.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            <span className="font-medium text-sm">{feedback.msg}</span>
          </div>
        )}

        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl p-10 rounded-[40px] border border-white/20 shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-2xl transform -rotate-6 mb-6 p-2">
              <img 
                src="/logo.svg" 
                alt="TowerUP Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight text-center">TowerUP Pro</h1>
            <p className="text-slate-400 text-xs mt-1 font-medium text-center">Gestão Inteligente de Obras</p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4 mb-8">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
              <div className="relative">
                <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input 
                  type="email" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-white text-sm transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Senha</label>
                <button 
                  type="button" 
                  onClick={handleForgotPassword} 
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition hover:underline"
                >
                  Esqueceu sua senha?
                </button>
              </div>
              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-white text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isProcessing ? <i className="fas fa-spinner fa-spin mr-2"></i> : null}
              Acessar Sistema
            </button>
          </form>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-4 text-slate-500 font-bold tracking-widest">ou</span>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </button>
            <p className="text-center text-slate-500 text-[10px] mt-6 font-medium">
              Acesso exclusivo para colaboradores autorizados.
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
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-slate-200">
            <img 
              src="/logo.svg" 
              alt="HM Tower Logo" 
              className="w-8 h-8 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          {!isSidebarCollapsed && <span className="text-xl font-bold tracking-tight truncate text-white">TowerUP</span>}
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
                  {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.USER) && (
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
                      <button 
                        onClick={() => setView('functions')}
                        className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'functions' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                      >
                        <i className="fas fa-briefcase w-4"></i> Funções
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setView('employees')}
                    className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'employees' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                  >
                    <i className="fas fa-users w-4"></i> Colaboradores
                  </button>
                  {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
                    <>
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
                <button 
                  onClick={() => setView('work_diary')}
                  className={`w-full text-left px-6 py-2.5 rounded-r-xl transition flex items-center gap-3 text-sm ${view === 'work_diary' ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800/30'}`}
                >
                  <i className="fas fa-book w-4"></i> Diário de Obras
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
                {(currentUser.role === UserRole.ADMIN || (editingCompanyId && currentUser.role === UserRole.MANAGER)) ? (
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
                ) : (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <p className="text-slate-500 text-sm text-center italic">
                      Apenas administradores podem cadastrar novas empresas.
                    </p>
                  </div>
                )}
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
                          <div className="flex gap-2">
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
                              <button 
                                onClick={() => handleEditCompany(comp)}
                                className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                              >
                                <i className="fas fa-edit text-xs"></i>
                              </button>
                            )}
                            {currentUser.role === UserRole.ADMIN && (
                              <button 
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: "Confirmar Exclusão",
                                    message: `Tem certeza que deseja excluir a empresa ${comp.name}? Esta ação não pode ser desfeita.`,
                                    onConfirm: () => {
                                      storageService.deleteCompany(comp.id);
                                      setCompanies(prev => prev.filter(c => c.id !== comp.id));
                                    }
                                  });
                                }}
                                className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                              >
                                <i className="fas fa-trash-alt text-xs"></i>
                              </button>
                            )}
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
                    {currentUser.role === UserRole.ADMIN && (
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
                    )}
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userProjects?.filter(p => p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())).length === 0 ? (
                    <div className="col-span-full py-12 text-center">
                      <i className="fas fa-hard-hat text-4xl text-slate-200 mb-4"></i>
                      <p className="text-slate-400">Nenhuma obra encontrada.</p>
                    </div>
                  ) : (
                    userProjects?.filter(p => p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()))
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
                            {(() => {
                              const gestor = users.find(u => u.id === proj.managerId);
                              if (gestor) {
                                return (
                                  <p className="text-[10px] text-indigo-600 font-semibold truncate mt-0.5">
                                    <i className="fas fa-user-cog mr-1"></i>
                                    Gestor: {gestor.name}
                                  </p>
                                );
                              }
                              return null;
                            })()}
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
                          <div className="flex gap-2">
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) && (
                              <button 
                                onClick={() => handleEditProject(proj)}
                                className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center shadow-sm transition-all opacity-0 group-hover:opacity-100"
                              >
                                <i className="fas fa-edit text-xs"></i>
                              </button>
                            )}
                            {currentUser.role === UserRole.ADMIN && (
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
                                className="w-8 h-8 rounded-full bg-white text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center shadow-sm transition-all opacity-0 group-hover:opacity-100"
                              >
                                <i className="fas fa-trash-alt text-xs"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Project Form (Add/Edit) */}
              {(isAddingProject && (currentUser.role === UserRole.ADMIN || (editingProjectId && currentUser.role === UserRole.MANAGER))) && (
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
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Gestor da Obra</label>
                      <select
                        value={newProjectManagerId}
                        onChange={(e) => setNewProjectManagerId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-sans"
                      >
                        <option value="">Selecione o gestor...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
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
                          serviceExecutions={serviceExecutions}
                          projectId={editingProjectId}
                          onDeleteServiceExecutions={handleDeleteServiceExecutions}
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
                                setConfirmModal({
                                  isOpen: true,
                                  title: "Confirmar Exclusão",
                                  message: `Tem certeza que deseja excluir a função ${jf.name}? Esta ação não pode ser desfeita.`,
                                  onConfirm: () => {
                                    storageService.deleteJobFunction(jf.id);
                                    setJobFunctions(prev => prev.filter(f => f.id !== jf.id));
                                  }
                                });
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
            <div className="max-w-6xl mx-auto space-y-6">
              {userViewMode === 'list' ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Administração de Usuários</h3>
                      <p className="text-sm text-slate-500">Gerencie os acessos e permissões dos usuários do sistema.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingUserId(null);
                        setNewUserName('');
                        setNewUserCPF('');
                        setNewUserPhone('');
                        setNewUserEmail('');
                        setNewUserPassword('');
                        setNewUserCompanies([]);
                        setNewUserProjects([]);
                        setNewUserRole(UserRole.USER);
                        setUserViewMode('form');
                      }} 
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200"
                    >
                      <i className="fas fa-plus"></i> Novo Usuário
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4">
                      <div className="flex-1 relative">
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                          type="text" 
                          placeholder="Buscar por nome ou e-mail..." 
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          className="w-full pl-11 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                      <div className="w-full md:w-48">
                        <select 
                          value={userRoleFilter} 
                          onChange={(e) => setUserRoleFilter(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                          <option value="Todos">Todos os Níveis</option>
                          {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                          <tr>
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Contato / CPF</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Acessos (Empr. / Obras)</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {users
                            .filter(u => {
                              const matchesSearch = u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                                                  u.email.toLowerCase().includes(userSearchTerm.toLowerCase());
                              const matchesRole = userRoleFilter === 'Todos' || u.role === userRoleFilter;
                              return matchesSearch && matchesRole;
                            })
                            .map(u => (
                              <tr key={u.id} className="hover:bg-indigo-50/10 transition">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                                      {u.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-800 text-sm">{u.name}</div>
                                      <div className="text-xs text-slate-500">{u.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-slate-700">{u.phone || '-'}</div>
                                  <div className="text-[10px] text-slate-400 font-mono tracking-tighter">{u.cpf || 'Sem CPF'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    u.role === UserRole.ADMIN ? 'bg-indigo-100 text-indigo-700' :
                                    u.role === UserRole.MANAGER ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td className="px-6 py-4 max-w-xs">
                                  <div className="text-[10px] text-slate-600 truncate mb-0.5">
                                    <i className="fas fa-building w-3 text-slate-400"></i> {u.companies?.join(', ') || 'Todas'}
                                  </div>
                                  <div className="text-[10px] text-slate-600 truncate">
                                    <i className="fas fa-tower-observation w-3 text-slate-400"></i> {u.projects?.join(', ') || 'Todas'}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex justify-center gap-2">
                                    <button 
                                      onClick={() => {
                                        handleEditUser(u);
                                        setUserViewMode('form');
                                      }} 
                                      className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition border border-slate-100"
                                      title="Editar"
                                    >
                                      <i className="fas fa-edit text-xs"></i>
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (u.id === currentUser?.id) {
                                          setFeedback({ type: 'error', msg: "Você não pode excluir seu próprio usuário." });
                                          clearFeedback();
                                          return;
                                        }
                                        setConfirmModal({
                                          isOpen: true,
                                          title: 'Excluir Usuário',
                                          message: `Tem certeza que deseja excluir o usuário ${u.name}? Esta ação não pode ser desfeita.`,
                                          onConfirm: async () => {
                                            await storageService.deleteUser(u.id);
                                            try {
                                              await axios.post('/api/auth/delete-user', { uid: u.id, email: u.email });
                                            } catch (authDelErr) {
                                              console.warn("Could not delete from Firebase Auth, might not exist or lacks admin permission:", authDelErr);
                                            }
                                            setFeedback({ type: 'success', msg: "Usuário excluído com sucesso!" });
                                            clearFeedback();
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                          }
                                        });
                                      }} 
                                      className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition border border-slate-100"
                                      title="Excluir"
                                    >
                                      <i className="fas fa-trash-alt text-xs"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          {users.filter(u => {
                            const matchesSearch = u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                                                u.email.toLowerCase().includes(userSearchTerm.toLowerCase());
                            const matchesRole = userRoleFilter === 'Todos' || u.role === userRoleFilter;
                            return matchesSearch && matchesRole;
                          }).length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                                <i className="fas fa-users-slash text-4xl mb-4 block opacity-20"></i>
                                Nenhum usuário encontrado para os filtros aplicados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Lock Diagnostic Panel for Admin */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <i className="fas fa-microscope text-lg"></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">Diagnóstico e Liberação de E-mails Órfãos</h4>
                        <p className="text-xs text-slate-500">
                          Se um e-mail foi excluído mas ainda acusa "já está em uso" na criação de novo usuário, utilize esta ferramenta para consultá-lo e removê-lo de forma forçada da Autenticação do Firebase.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <input 
                          type="email" 
                          placeholder="Digite o e-mail para diagnosticar (ex: guille@hmtower.com.br)" 
                          value={diagnosticEmail}
                          onChange={(e) => setDiagnosticEmail(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-800"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleCheckDiagnosticUser}
                          disabled={isCheckingDiagnostic}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl font-bold text-sm transition flex items-center gap-2 cursor-pointer"
                        >
                          {isCheckingDiagnostic ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                          Verificar Status
                        </button>
                        <button 
                          onClick={handlePurgeDiagnosticUser}
                          disabled={isPurgingDiagnostic}
                          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-sm transition flex items-center gap-2 border border-rose-100 cursor-pointer"
                        >
                          {isPurgingDiagnostic ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-trash-alt"></i>}
                          Liberar E-mail Forçado
                        </button>
                      </div>
                    </div>

                    {diagnosticResult && (
                      <div className={`p-4 rounded-xl border text-sm space-y-2 ${
                        diagnosticResult.isApiDisabled 
                          ? 'bg-rose-50 border-rose-200 text-rose-950 font-medium' 
                          : diagnosticResult.exists 
                            ? 'bg-amber-50/50 border-amber-200 text-amber-900' 
                            : 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                      }`}>
                        {diagnosticResult.isApiDisabled ? (
                          <div className="space-y-3">
                            <div className="font-bold flex items-center gap-2 text-rose-800">
                              <i className="fas fa-exclamation-triangle text-rose-500"></i>
                              API Identity Toolkit Desativada no Console do Google Cloud!
                            </div>
                            <p className="text-xs text-rose-700 leading-relaxed">
                              O Firebase Admin necessita que a Advanced Authentication API (também conhecida como <strong>Identity Toolkit API</strong>) esteja habilitada no painel de APIs de seu projeto Google Cloud para conseguir gerenciar e forçar a liberação de e-mails órfãos.
                            </p>
                            <div className="pt-1">
                              <a 
                                href={diagnosticResult.link} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-sm cursor-pointer"
                              >
                                <i className="fas fa-external-link-alt"></i>
                                Ativar Identity Toolkit API no Google Cloud
                              </a>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono italic">
                              Depois de reativar a API através do botão acima, aguarde de 1 a 2 minutos para que o Google propague e tente novamente!
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="font-bold flex items-center gap-2">
                              <i className={diagnosticResult.exists ? "fas fa-exclamation-triangle text-amber-500" : "fas fa-check-circle text-emerald-500"}></i>
                              {diagnosticResult.exists ? 'O e-mail está ATIVO na autenticação do Firebase!' : 'O e-mail está COMPLETAMENTE LIBERADO.'}
                            </div>
                            {diagnosticResult.exists && (
                              <div className="text-xs space-y-1 font-medium text-slate-600">
                                <div>• <strong>UID no Firebase Auth:</strong> <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{diagnosticResult.uid}</span></div>
                                <div>• <strong>Provedor Principal:</strong> {diagnosticResult.providerId === 'google.com' ? 'Acesso via Google Auth (Conta Google)' : 'Acesso via E-mail e Senha'}</div>
                                <div>• <strong>Cadastrado na tabela local do banco ("users")?</strong> {
                                  users.some(u => u.email.toLowerCase() === (diagnosticResult.email || diagnosticEmail).trim().toLowerCase()) 
                                    ? <span className="text-emerald-600 font-bold">Sim (Acesso normal)</span> 
                                    : <span className="text-rose-600 font-bold">Não (Esta conta está órfã / travada! Precisa de exclusão forçada!)</span>
                                }</div>
                              </div>
                            )}
                            {!diagnosticResult.exists && (
                              <div className="text-xs text-slate-500">
                                Este e-mail está totalmente limpo na base do Firebase e pode receber um novo usuário sem qualquer aviso de conflito.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl relative overflow-visible">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-indigo-300 rounded-t-[2rem]"></div>
                    
                    <div className="flex justify-between items-center mb-10">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800">{editingUserId ? 'Editar Usuário' : 'Novo Cadastro de Usuário'}</h3>
                        <p className="text-slate-500 text-sm">Preencha as informações para definir o acesso ao sistema.</p>
                      </div>
                      <button 
                        onClick={() => setUserViewMode('list')} 
                        className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center transition border border-slate-100"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nome Completo *</label>
                          <input 
                            type="text" 
                            value={newUserName} 
                            onChange={(e) => setNewUserName(e.target.value)} 
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700"
                            placeholder="Ex: João da Silva"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">CPF *</label>
                          <input 
                            type="text" 
                            value={newUserCPF} 
                            onChange={(e) => setNewUserCPF(e.target.value)} 
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700 font-mono"
                            placeholder="000.000.000-00"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">E-mail *</label>
                          <input 
                            type="email" 
                            value={newUserEmail} 
                            onChange={(e) => setNewUserEmail(e.target.value)} 
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700"
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Telefone</label>
                          <input 
                            type="text" 
                            value={newUserPhone} 
                            onChange={(e) => setNewUserPhone(e.target.value)} 
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Tipo de Usuário / Nível de Acesso *</label>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.values(UserRole).map(role => (
                            <button
                              key={role}
                              onClick={() => setNewUserRole(role)}
                              className={`py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                newUserRole === role 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                                  : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-200'
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>

                      {!editingUserId && (
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Senha Provisória *</label>
                          <input 
                            type="password" 
                            value={newUserPassword} 
                            onChange={(e) => setNewUserPassword(e.target.value)} 
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700"
                            placeholder="Min. 6 caracteres"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Permitir para Empresas</label>
                          <div className="relative">
                            <div 
                              onClick={() => setIsUserCompanySelectorOpen(!isUserCompanySelectorOpen)}
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm flex items-center justify-between cursor-pointer"
                            >
                              <span className={newUserCompanies.length === 0 ? 'text-slate-400' : 'text-slate-700'}>
                                {newUserCompanies.length === 0 ? 'Todas as Empresas' : `${newUserCompanies.length} Selecionadas`}
                              </span>
                              <i className={`fas fa-chevron-${isUserCompanySelectorOpen ? 'up' : 'down'} text-[10px] text-slate-400 transition-transform`}></i>
                            </div>
                            {isUserCompanySelectorOpen && (
                              <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl z-[60] p-3 mt-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-not-allowed text-xs text-slate-400 mb-1 border-b border-slate-50">
                                  <span>Controle de Acesso por Empresa</span>
                                </label>
                                {companies.map(c => (
                                  <label key={c.id} className="flex items-start gap-3 p-2 hover:bg-indigo-50 rounded-xl cursor-pointer text-xs text-slate-700 transition leading-tight whitespace-normal break-words">
                                    <input 
                                      type="checkbox" 
                                      checked={newUserCompanies.includes(c.name)}
                                      onChange={(e) => {
                                        if (e.target.checked) setNewUserCompanies([...newUserCompanies, c.name]);
                                        else setNewUserCompanies(newUserCompanies.filter(n => n !== c.name));
                                      }}
                                      className="accent-indigo-600 w-4 h-4 mt-0.5 flex-shrink-0"
                                    />
                                    <span>{c.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Permitir para Obras</label>
                          <div className="relative">
                            <div 
                              onClick={() => setIsUserProjectSelectorOpen(!isUserProjectSelectorOpen)}
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm flex items-center justify-between cursor-pointer"
                            >
                              <span className={newUserProjects.length === 0 ? 'text-slate-400' : 'text-slate-700'}>
                                {newUserProjects.length === 0 ? 'Todas as Obras' : `${newUserProjects.length} Selecionadas`}
                              </span>
                              <i className={`fas fa-chevron-${isUserProjectSelectorOpen ? 'up' : 'down'} text-[10px] text-slate-400 transition-transform`}></i>
                            </div>
                            {isUserProjectSelectorOpen && (
                              <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl z-[60] p-3 mt-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-not-allowed text-xs text-slate-400 mb-1 border-b border-slate-50">
                                  <span>Controle de Acesso por Obra</span>
                                </label>
                                {userProjects.map(p => (
                                  <label key={p.id} className="flex items-start gap-3 p-2 hover:bg-indigo-50 rounded-xl cursor-pointer text-xs text-slate-700 transition leading-tight whitespace-normal break-words">
                                    <input 
                                      type="checkbox" 
                                      checked={newUserProjects.includes(p.name)}
                                      onChange={(e) => {
                                        if (e.target.checked) setNewUserProjects([...newUserProjects, p.name]);
                                        else setNewUserProjects(newUserProjects.filter(n => n !== p.name));
                                      }}
                                      className="accent-indigo-600 w-4 h-4 mt-0.5 flex-shrink-0"
                                    />
                                    <span>{p.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex gap-4">
                        <button 
                          onClick={() => setUserViewMode('list')}
                          className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleCreateUser} 
                          className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-xl shadow-indigo-100"
                        >
                          {editingUserId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                    <div className="relative">
                      <div 
                        onClick={() => setIsReportCompanySelectorOpen(!isReportCompanySelectorOpen)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer truncate flex items-center justify-between"
                      >
                        {selectedCompanies.length === 0 ? 'Todas' : `${selectedCompanies.length} selecionadas`}
                        <i className={`fas fa-chevron-${isReportCompanySelectorOpen ? 'up' : 'down'} text-[10px] text-slate-400`}></i>
                      </div>
                      {isReportCompanySelectorOpen && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
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
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obras</label>
                    <div className="relative">
                      <div 
                        onClick={() => setIsReportProjectSelectorOpen(!isReportProjectSelectorOpen)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer truncate flex items-center justify-between"
                      >
                        {selectedProjects.length === 0 ? 'Todas' : `${selectedProjects.length} selecionadas`}
                        <i className={`fas fa-chevron-${isReportProjectSelectorOpen ? 'up' : 'down'} text-[10px] text-slate-400`}></i>
                      </div>
                      {isReportProjectSelectorOpen && (
                        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
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
                      )}
                    </div>
                  </div>
                </div>

                {/* Period Report Logic */}
                {(() => {
                  const [startY, startM, startD] = reportStartDate.split('-').map(Number);
                  const start = new Date(startY, startM - 1, startD, 0, 0, 0, 0);
                  
                  const [endY, endM, endD] = reportEndDate.split('-').map(Number);
                  const end = new Date(endY, endM - 1, endD, 23, 59, 59, 999);

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
                  users={users}
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

          {/* Diário de Obras */}
          {view === 'work_diary' && currentUser && (
            <div className="max-w-full mx-auto space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <i className="fas fa-book text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Diário de Obras</h2>
                    <p className="text-slate-500 text-sm italic">Emita relatórios diários de obras com resumo de clima, colaboradores por função, progresso físico e ocorrências.</p>
                  </div>
                </div>

                <WorkDiaryReport
                  projects={userProjects}
                  employees={employees}
                  laborTrackings={trackings}
                  serviceExecutions={serviceExecutions}
                  weatherLogs={weatherLogs}
                  workDiaries={workDiaries}
                  onFeedback={handleFeedback}
                  currentUser={currentUser}
                  jobFunctions={jobFunctions}
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
                secullumEmployees={secullumEmployees}
                companies={companies}
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
