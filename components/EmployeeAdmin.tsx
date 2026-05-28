import React, { useState, useMemo } from 'react';
import { Employee, Company, Project, JobFunction, SecullumEmployee } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { CBO_LIST } from './cboData';
import { maskPhone, maskCEP, maskCPF, maskCNPJ, maskRG, maskPix, generateId } from '../src/lib/utils';
import { secullumService } from '../services/secullumService';

interface EmployeeAdminProps {
  employees: Employee[];
  secullumEmployees?: SecullumEmployee[];
  companies: Company[];
  projects: Project[];
  jobFunctions: JobFunction[];
  onSaveEmployee: (employee: Employee) => void;
  onSaveEmployees: (employees: Employee[]) => void;
  onDeleteEmployee: (id: string) => void;
  onSaveJobFunction?: (jf: JobFunction) => void;
  onFeedback?: (type: 'success' | 'error', msg: string) => void;
}

type TabType = 'personal' | 'documents' | 'uniforms';

export const EmployeeAdminView: React.FC<EmployeeAdminProps> = ({
  employees,
  secullumEmployees = [],
  companies,
  projects,
  jobFunctions,
  onSaveEmployee,
  onSaveEmployees,
  onDeleteEmployee,
  onSaveJobFunction,
  onFeedback
}) => {
  const [view, setView] = useState<'list' | 'form' | 'secullum'>('list');
  const [activeTab, setActiveTab] = useState<TabType>('personal');

  // Groups and merges Secullum profile items by CPF, choosing dominant fields
  const mergedSecullumEmployees = useMemo(() => {
    if (!secullumEmployees || secullumEmployees.length === 0) return [];
    
    const groups: { [cpf: string]: SecullumEmployee[] } = {};
    for (const sEmp of secullumEmployees) {
      const rawCpf = sEmp.data.Cpf || '';
      const name = sEmp.data.Nome;
      if (!rawCpf || !name) continue;
      
      const cpf = maskCPF(rawCpf);
      if (!groups[cpf]) {
        groups[cpf] = [];
      }
      groups[cpf].push(sEmp);
    }

    const mergedList: SecullumEmployee[] = [];

    for (const cpf of Object.keys(groups)) {
      const group = groups[cpf];
      if (group.length === 1) {
        mergedList.push(group[0]);
        continue;
      }

      // Sort so that the MOST updated/active one is first (index 0)
      group.sort((a, b) => {
        // 1. Sort by Status (Active first)
        const demA = a.data.DataDemissao || a.data.Demissao || a.data.Data_Demissao || a.data.DataDemissaoFormatada;
        const demB = b.data.DataDemissao || b.data.Demissao || b.data.Data_Demissao || b.data.DataDemissaoFormatada;
        const hasDemA = demA && demA !== "null" && demA !== "undefined" && demA !== "" && !demA.toString().startsWith("0001") && !demA.toString().startsWith("1900");
        const hasDemB = demB && demB !== "null" && demB !== "undefined" && demB !== "" && !demB.toString().startsWith("0001") && !demB.toString().startsWith("1900");
        
        if (!hasDemA && hasDemB) return -1;
        if (hasDemA && !hasDemB) return 1;

        // 2. Sort by explicit update date field if available
        const getUpdateDate = (data: any) => {
          const val = data.DataAlteracao || data.Data_Alteracao || data.UltimaAlteracao || data.DataUltimaAlteracao || data.DataHoraAlteracao;
          if (val) {
            const d = new Date(val);
            return isNaN(d.getTime()) ? 0 : d.getTime();
          }
          return 0;
        };
        const updateA = getUpdateDate(a.data);
        const updateB = getUpdateDate(b.data);
        if (updateA !== updateB) {
          return updateB - updateA;
        }

        // 3. Sort by Admission Date (newer first)
        const admAVal = a.data.Admissao ? new Date(a.data.Admissao).getTime() : 0;
        const admBVal = b.data.Admissao ? new Date(b.data.Admissao).getTime() : 0;
        const admA = isNaN(admAVal) ? 0 : admAVal;
        const admB = isNaN(admBVal) ? 0 : admBVal;
        if (admA !== admB) {
          return admB - admA;
        }

        // 4. Sort by numeric id
        const idA = Number(a.id || a.data.id || a.data.Id) || 0;
        const idB = Number(b.id || b.data.id || b.data.Id) || 0;
        return idB - idA;
      });

      // Merge remaining attributes to fill missing gaps
      const primary = { ...group[0] };
      const mergedData = { ...primary.data };

      // Aggregate all work location projects
      const allProjects = new Set<string>();
      const getProjId = (remoteEmp: any) => {
        const obraId = Number(remoteEmp.ObraId);
        let targetName = '';
        if (obraId === 2) targetName = 'Residencial Haway';
        else if (obraId === 3) targetName = 'Residencial Belle Vie';
        else if (obraId === 4) targetName = 'Duplex Guestier';
        if (targetName) {
          const found = projects.find(p => p.name.toUpperCase().includes(targetName.toUpperCase()));
          return found ? found.id : null;
        }
        return null;
      };

      const primaryProjId = getProjId(mergedData);
      if (primaryProjId) allProjects.add(primaryProjId);

      for (let i = 1; i < group.length; i++) {
        const other = group[i].data;
        const otherProjId = getProjId(other);
        if (otherProjId) allProjects.add(otherProjId);

        Object.keys(other).forEach(key => {
          if (!mergedData[key] && other[key] !== null && other[key] !== undefined && other[key] !== '') {
            mergedData[key] = other[key];
          }
        });
      }

      mergedData.mergedProjects = Array.from(allProjects);
      primary.data = mergedData;
      mergedList.push(primary);
    }

    return mergedList;
  }, [secullumEmployees, projects]);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isLoadingAPI, setIsLoadingAPI] = useState(false);

  // Filters
  const [filterCompany, setFilterCompany] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Ativo' | 'Inativo' | ''>('Ativo');

  const filteredEmployees = useMemo(() => {
    return employees
      .filter(emp => {
        const matchCompany = !filterCompany || emp.company === filterCompany;
        const matchProject = !filterProject || emp.projects?.includes(filterProject);
        const matchName = !filterName || emp.name.toLowerCase().includes(filterName.toLowerCase());
        const matchStatus = !filterStatus || emp.status === filterStatus;
        return matchCompany && matchProject && matchName && matchStatus;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [employees, filterCompany, filterProject, filterName, filterStatus]);

  const handleRemoveDuplicates = () => {
    const uniqueCpfs = new Set<string>();
    const toDeleteIds: string[] = [];
    
    // Sort by createdAt descending to keep the most recent one if duplicates exist
    const sortedEmployees = [...employees].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    sortedEmployees.forEach(emp => {
      const cleanCpf = emp.cpf.replace(/\D/g, '');
      if (!cleanCpf) return; // Skip if no CPF
      
      if (uniqueCpfs.has(cleanCpf)) {
        toDeleteIds.push(emp.id);
      } else {
        uniqueCpfs.add(cleanCpf);
      }
    });

    if (toDeleteIds.length === 0) {
      onFeedback?.('success', 'Nenhuma duplicata de CPF encontrada.');
      return;
    }

    if (window.confirm(`Foram encontradas ${toDeleteIds.length} duplicatas. Deseja removê-las mantendo apenas o registro mais recente de cada CPF?`)) {
      toDeleteIds.forEach(id => onDeleteEmployee(id));
      onFeedback?.('success', `${toDeleteIds.length} duplicatas removidas com sucesso.`);
    }
  };

  const handleNewEmployee = () => {
    setEditingEmployee({
      id: generateId(),
      name: '',
      role: '',
      jobFunction: '',
      department: '',
      company: '',
      projects: [],
      admissionDate: new Date().toISOString().split('T')[0],
      cpf: '',
      birthDate: '',
      regime: 'CLT',
      status: 'Ativo',
      photoBase64: '',
      createdAt: Date.now(),
      entryTime: '',
      exitTime: '',
      weeklyHours: 44,
      benefits: {
        va: { active: false, value: 0 },
        vm: { active: false, value: 0 }
      },
      documents: {},
      uniforms: {
        shoeSize: '',
        pantsSize: 'M',
        shirtSize: 'M'
      }
    });
    setActiveTab('personal');
    setView('form');
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee({ ...emp });
    setActiveTab('personal');
    setView('form');
  };

  const handleSave = () => {
    if (!editingEmployee?.name || !editingEmployee?.company || !editingEmployee?.projects || editingEmployee.projects.length === 0) {
      onFeedback?.('error', 'Preencha os campos obrigatórios (Nome, Empresa e ao menos uma Obra).');
      return;
    }

    // CPF Duplication check
    if (editingEmployee.cpf) {
      const isDuplicate = employees.some(e => e.cpf === editingEmployee.cpf && e.id !== editingEmployee.id);
      if (isDuplicate) {
        onFeedback?.('error', 'Já existe um colaborador cadastrado com este CPF.');
        return;
      }
    }

    const finalEmployee = {
      ...editingEmployee,
      name: editingEmployee.name.toUpperCase()
    } as Employee;
    onSaveEmployee(finalEmployee);
    setView('list');
    setEditingEmployee(null);
    onFeedback?.('success', 'Colaborador salvo com sucesso!');
  };

  const handleFileChange = (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        onFeedback?.('error', 'Apenas arquivos PDF são permitidos.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingEmployee(prev => ({
          ...prev,
          documents: {
            ...prev?.documents,
            [docKey]: {
              ...prev?.documents?.[docKey],
              fileBase64: reader.result as string,
              fileName: file.name
            }
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const updateDocNumber = (docKey: string, num: string) => {
    setEditingEmployee(prev => ({
      ...prev,
      documents: {
        ...prev?.documents,
        [docKey]: {
          ...prev?.documents?.[docKey],
          number: num
        }
      }
    }));
  };

  const documentTypes = [
    { key: 'residence', label: 'Comprovante de Residência' },
    { key: 'cpf', label: 'CPF' },
    { key: 'rg', label: 'RG' },
    { key: 'pis', label: 'PIS' },
    { key: 'voter_id', label: 'Título de Eleitor' },
    { key: 'ctps', label: 'Carteira de Trabalho' },
    { key: 'cnh', label: 'Carteira de Motorista' },
    { key: 'marriage', label: 'Certidão de Casamento' },
    { key: 'spouse_cpf', label: 'CPF Cônjuge' },
    { key: 'children_birth', label: 'Certidão Nascimento Filhos (<14 anos)' },
    { key: 'military', label: 'Dispensa Serviço Militar' },
    { key: 'children_school', label: 'Matrícula Filhos (6-14 anos)' },
    { key: 'education_record', label: 'Registro de Escolaridade' },
    { key: 'aso_admissional', label: 'ASO - Admissional' },
    { key: 'aso_periodico', label: 'ASO - Periódico' },
    { key: 'aso_demissional', label: 'ASO - Demissional' },
  ];

  // Helper to map remoteEmployee to our domain format
  const getMappedSecullumEmployee = (remoteEmp: any): Omit<Employee, 'id' | 'createdAt' | 'photoBase64'> => {
    const name = (remoteEmp.Nome || '').toUpperCase();
    const cpf = maskCPF(remoteEmp.Cpf || '');
    const pis = remoteEmp.NumeroPis || '';
    const email = remoteEmp.Email || '';
    const phone = remoteEmp.Celular || remoteEmp.Telefone || '';
    
    let role = remoteEmp.FuncaoDescricao || remoteEmp.FuncaoNome || remoteEmp.CargoDescricao || remoteEmp.Cargo || 
               (remoteEmp.Funcao ? (remoteEmp.Funcao.Descricao || remoteEmp.Funcao.Nome) : null) || '(Não informado)';
               
    const existingJF = jobFunctions.find(jf => jf.name.trim().toLowerCase() === role.trim().toLowerCase());
    if (existingJF) {
      role = existingJF.name;
    } else {
      role = role.trim();
    }

    const department = remoteEmp.DepartamentoDescricao || remoteEmp.DepartamentoNome || 
                      (remoteEmp.Departamento ? (remoteEmp.Departamento.Descricao || remoteEmp.Departamento.Nome) : null) || '';

    let company = '';
    let regime: 'CLT' | 'Diarista' | 'Empreiteiro' = 'CLT';
    const empresaId = Number(remoteEmp.EmpresaId);

    let autoProjects: string[] = [];
    const obraId = Number(remoteEmp.ObraId);
    
    let targetProjectName = '';
    if (obraId === 2) targetProjectName = 'Residencial Haway';
    else if (obraId === 3) targetProjectName = 'Residencial Belle Vie';
    else if (obraId === 4) targetProjectName = 'Duplex Guestier';

    if (targetProjectName) {
      const foundProj = projects.find(p => p.name.toUpperCase().includes(targetProjectName.toUpperCase()));
      if (foundProj) {
        autoProjects = [foundProj.id];
      }
    }

    if (Array.isArray(remoteEmp.mergedProjects)) {
      remoteEmp.mergedProjects.forEach((pId: string) => {
        if (!autoProjects.includes(pId)) {
          autoProjects.push(pId);
        }
      });
    }

    const hmTower = companies.find(c => c.name.includes('HM TOWER'))?.name || 'HM TOWER ENGENHARIA E CONSTRUÇÕES LTDA';
    const rks = companies.find(c => c.name.includes('RKS'))?.name || 'RKS EMPREITEIRA DE MÃO-DE-OBRA';
    const diaristas = companies.find(c => c.name.includes('DIARISTAS'))?.name || 'DIARISTAS';
    const producao = companies.find(c => c.name.includes('PRODUÇÃO') || c.name.includes('PRODUCAO'))?.name || 'PRODUÇÃO';

    if (empresaId === 1) {
      company = hmTower;
      regime = 'CLT';
    } else if (empresaId === 2) {
      company = rks;
      regime = 'CLT';
    } else if (empresaId === 3) {
      company = diaristas;
      regime = 'Diarista';
    } else if (empresaId === 4) {
      company = producao;
      regime = 'Empreiteiro';
    } else {
      const remoteName = remoteEmp.EmpresaNome || '';
      company = companies.find(c => c.name.toUpperCase() === remoteName.toUpperCase())?.name || remoteName;
    }

    const rawDemissionDate = remoteEmp.DataDemissao || remoteEmp.Demissao || remoteEmp.Data_Demissao || remoteEmp.DataDemissaoFormatada;
    const hasDemissionDate = rawDemissionDate && 
                             rawDemissionDate !== "null" && 
                             rawDemissionDate !== "undefined" && 
                             rawDemissionDate !== "" && 
                             !rawDemissionDate.toString().startsWith("0001-01-01") &&
                             !rawDemissionDate.toString().startsWith("1900-01-01");
    const status = hasDemissionDate ? 'Inativo' : 'Ativo';

    let admissionDate = new Date().toISOString().split('T')[0];
    if (remoteEmp.Admissao) {
      admissionDate = remoteEmp.Admissao.split('T')[0];
    }

    return {
      name,
      role,
      jobFunction: role,
      department,
      company,
      projects: autoProjects,
      admissionDate,
      cpf,
      birthDate: remoteEmp.Nascimento ? remoteEmp.Nascimento.split('T')[0] : '',
      regime,
      status,
      email,
      phone,
      address: remoteEmp.Endereco || '',
      neighborhood: remoteEmp.Bairro || '',
      city: remoteEmp.Cidade || '',
      state: remoteEmp.Uf || '',
      zipCode: remoteEmp.Cep || '',
      entryTime: '08:00',
      exitTime: '18:00',
      weeklyHours: 44,
      benefits: {
        va: { active: false, value: 0 },
        vm: { active: false, value: 0 }
      },
      documents: {
        pis: { number: pis }
      },
      uniforms: {
        shoeSize: '',
        pantsSize: 'M',
        shirtSize: 'M'
      }
    };
  };

  // Status for each employee compared to Database list
  const getSecullumEmployeeSyncStatus = (sEmp: SecullumEmployee) => {
    const cpf = maskCPF(sEmp.data.Cpf || '');
    const existing = employees.find(e => e.cpf === cpf);
    if (!existing) {
      return 'não cadastrado';
    }

    const mapped = getMappedSecullumEmployee(sEmp.data);
    
    // Compare basic fields
    const nameMatches = existing.name.toUpperCase() === mapped.name.toUpperCase();
    const roleMatches = (existing.role || '').trim().toUpperCase() === (mapped.role || '').trim().toUpperCase();
    const companyMatches = (existing.company || '').trim().toUpperCase() === (mapped.company || '').trim().toUpperCase();
    const statusMatches = existing.status === mapped.status;
    const admissionMatches = (existing.admissionDate || '') === (mapped.admissionDate || '');
    
    let projectsMatch = true;
    if (mapped.projects && mapped.projects.length > 0) {
      projectsMatch = mapped.projects.every(p => existing.projects?.includes(p));
    }

    if (nameMatches && roleMatches && companyMatches && statusMatches && admissionMatches && projectsMatch) {
      return 'Atualizado';
    } else {
      return 'desatualizado';
    }
  };

  // Synchronizes a single employee
  const handleSyncSingleEmployee = (sEmp: SecullumEmployee) => {
    const cpf = maskCPF(sEmp.data.Cpf || '');
    if (!cpf || !sEmp.data.Nome) {
      onFeedback?.('error', 'Funcionário sem CPF ou Nome válido para sincronização.');
      return;
    }

    // Save job function dynamically if needed
    const funcName = sEmp.data.FuncaoDescricao || sEmp.data.FuncaoNome || sEmp.data.CargoDescricao || sEmp.data.Cargo || '(Não informado)';
    const existsJF = jobFunctions.find(jf => jf.name.trim().toLowerCase() === funcName.trim().toLowerCase());
    if (!existsJF && onSaveJobFunction) {
      onSaveJobFunction({
        id: generateId(),
        name: funcName.trim(),
        createdAt: Date.now()
      });
    }

    const mapped = getMappedSecullumEmployee(sEmp.data);
    const existingEmployee = employees.find(emp => emp.cpf === cpf);
    const employeesToSave: Employee[] = [];

    if (existingEmployee) {
      const updatedEmployee: Employee = {
        ...existingEmployee,
        ...mapped,
        id: existingEmployee.id,
        photoBase64: existingEmployee.photoBase64,
        createdAt: existingEmployee.createdAt,
        projects: Array.from(new Set([...(existingEmployee.projects || []), ...(mapped.projects || [])]))
      };
      employeesToSave.push(updatedEmployee);
    } else {
      const newEmployee: Employee = {
        ...mapped,
        id: generateId(),
        photoBase64: '',
        createdAt: Date.now()
      } as Employee;
      employeesToSave.push(newEmployee);
    }

    onSaveEmployees(employeesToSave);
    onFeedback?.('success', `Colaborador ${sEmp.data.Nome.toUpperCase()} sincronizado com sucesso!`);
  };

  // Synchronizes all database items
  const handleSyncAllEmployees = () => {
    if (mergedSecullumEmployees.length === 0) {
      onFeedback?.('error', 'Nenhum funcionário na base Secullum para sincronizar.');
      return;
    }

    let updatedCount = 0;
    let importedCount = 0;
    let skippedCount = 0;
    const employeesToSave: Employee[] = [];

    // Register any new unique job functions dynamically
    const uniqueFunctions = Array.from(new Set(mergedSecullumEmployees.map(s => 
      s.data.FuncaoDescricao || s.data.FuncaoNome || s.data.CargoDescricao || s.data.Cargo
    ).filter(Boolean)));
    
    uniqueFunctions.forEach(funcName => {
      const exists = jobFunctions.find(jf => jf.name.trim().toLowerCase() === funcName.trim().toLowerCase());
      if (!exists && onSaveJobFunction) {
        onSaveJobFunction({
          id: generateId(),
          name: funcName.trim(),
          createdAt: Date.now()
        });
      }
    });

    for (const sEmp of mergedSecullumEmployees) {
      const cpf = maskCPF(sEmp.data.Cpf || '');
      const name = sEmp.data.Nome;
      if (!cpf || !name) {
        skippedCount++;
        continue;
      }

      const mapped = getMappedSecullumEmployee(sEmp.data);
      const existingEmployee = employees.find(emp => emp.cpf === cpf);

      if (existingEmployee) {
        const updatedEmployee: Employee = {
          ...existingEmployee,
          ...mapped,
          id: existingEmployee.id,
          photoBase64: existingEmployee.photoBase64,
          createdAt: existingEmployee.createdAt,
          projects: Array.from(new Set([...(existingEmployee.projects || []), ...(mapped.projects || [])]))
        };
        employeesToSave.push(updatedEmployee);
        updatedCount++;
      } else {
        const newEmployee: Employee = {
          ...mapped,
          id: generateId(),
          photoBase64: '',
          createdAt: Date.now()
        } as Employee;
        employeesToSave.push(newEmployee);
        importedCount++;
      }
    }

    if (employeesToSave.length > 0) {
      onSaveEmployees(employeesToSave);
    }

    onFeedback?.('success', `${importedCount} novos cadastros e ${updatedCount} atualizações realizadas com sucesso!`);
  };

  const handleImportAPI = async () => {
    setIsLoadingAPI(true);
    try {
      const response = await fetch('/api/secullum/import');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao conectar com a API Secullum.');
      }
      
      const employeesArray = Array.isArray(data) ? data : (data.Funcionarios || data.data || []);
      
      // Upsert into Firestore
      await secullumService.upsertEmployees(employeesArray);
      
      onFeedback?.('success', `${employeesArray.length} funcionários carregados com sucesso da API Secullum.`);
    } catch (error: any) {
      onFeedback?.('error', error.message);
    } finally {
      setIsLoadingAPI(false);
    }
  };

  return (
    <div className="space-y-6">
      {view === 'list' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">Administração de Colaboradores</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setView('secullum')}
                className="px-6 py-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-100 transition shadow-sm flex items-center gap-2"
              >
                <i className="fas fa-database"></i>
                Base Secullum
              </button>
              <button
                onClick={handleNewEmployee}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
              >
                <i className="fas fa-plus"></i> Novo Cadastro
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todos</option>
                <option value="Ativo">Ativos</option>
                <option value="Inativo">Inativos</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empresa</label>
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todas as Empresas</option>
                {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obra</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todas as Obras</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Buscar por nome..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Colaborador</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Empresa / Obra</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Cargo</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                          {emp.photoBase64 && emp.photoBase64.length > 0 ? (
                            <img src={emp.photoBase64} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user text-slate-400"></i>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-800">{emp.name.toUpperCase()}</div>
                            {emp.status === 'Inativo' && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[8px] font-bold uppercase tracking-tight">Inativo</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{emp.cpf}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">{emp.company}</div>
                      <div className="text-[10px] text-slate-500 uppercase">{emp.projects?.join(', ')}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{emp.role}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditEmployee(emp)}
                          className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition-all"
                          title="Editar"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(emp.id)}
                          className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all"
                          title="Excluir"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Nenhum colaborador encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'secullum' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Base de Importação Secullum</h2>
              <p className="text-sm text-slate-500">Dados importados da API Secullum para sincronização com os colaboradores cadastrados.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setView('list')}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition shadow-sm"
              >
                Voltar
              </button>
              <button
                onClick={handleImportAPI}
                disabled={isLoadingAPI}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
              >
                {isLoadingAPI ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-download"></i>}
                Trazer Dados da Base
              </button>
              <button
                onClick={handleSyncAllEmployees}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
              >
                <i className="fas fa-sync"></i>
                Sincronizar Todos
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">ID</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">Nome</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">CPF</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">Cargo / Função</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">Empresa Id</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">Status API</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">Sincronização</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mergedSecullumEmployees.sort((a,b) => (a.data.Nome || '').localeCompare(b.data.Nome || '')).map(sEmp => {
                    const syncStatus = getSecullumEmployeeSyncStatus(sEmp);
                    return (
                      <tr key={sEmp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 font-mono">#{sEmp.id}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{sEmp.data.Nome?.toUpperCase()}</td>
                        <td className="px-6 py-4 text-slate-600">{maskCPF(sEmp.data.Cpf || '')}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {sEmp.data.FuncaoDescricao || sEmp.data.FuncaoNome || sEmp.data.CargoDescricao || sEmp.data.Cargo || '---'}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">Empresa #{sEmp.data.EmpresaId}</td>
                        <td className="px-6 py-4">
                          {(() => {
                            const demDate = sEmp.data.DataDemissao || sEmp.data.Demissao || sEmp.data.Data_Demissao || sEmp.data.DataDemissaoFormatada;
                            const hasDemDate = demDate && 
                                              demDate !== "null" && 
                                              demDate !== "undefined" && 
                                              demDate !== "" && 
                                              !demDate.toString().startsWith("0001-01-01") &&
                                              !demDate.toString().startsWith("1900-01-01");
                            
                            return hasDemDate ? (
                              <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg font-bold">Inativo</span>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-bold">Ativo</span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {syncStatus === 'Atualizado' && (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-bold inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Atualizado
                            </span>
                          )}
                          {syncStatus === 'desatualizado' && (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full font-bold inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Desatualizado
                            </span>
                          )}
                          {syncStatus === 'não cadastrado' && (
                            <span className="px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-150 rounded-full font-bold inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Não Cadastrado
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleSyncSingleEmployee(sEmp)}
                            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ml-auto text-xs ${
                              syncStatus === 'Atualizado' 
                                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                                : syncStatus === 'desatualizado'
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100'
                            }`}
                          >
                            <i className="fas fa-sync text-[10px]"></i>
                            Sincronizar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {mergedSecullumEmployees.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic font-medium">
                        Nenhum dado retornado do Secullum ainda. Clique em "Trazer Dados da Base" para carregar as informações.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Cadastro de Colaborador</h2>
              <p className="text-sm text-slate-500">Preencha todas as informações necessárias.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setView('list')}
                className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
              >
                Salvar Colaborador
              </button>
            </div>
          </div>

          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('personal')}
              className={`px-8 py-4 text-sm font-bold transition-all relative ${activeTab === 'personal' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Informações Pessoais
              {activeTab === 'personal' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-8 py-4 text-sm font-bold transition-all relative ${activeTab === 'documents' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Documentos
              {activeTab === 'documents' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
            </button>
            <button
              onClick={() => setActiveTab('uniforms')}
              className={`px-8 py-4 text-sm font-bold transition-all relative ${activeTab === 'uniforms' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Uniformes / EPI
              {activeTab === 'uniforms' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'personal' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empresa *</label>
                  <select
                    value={editingEmployee?.company || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obra / Projeto *</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl custom-scrollbar">
                    {projects.map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={editingEmployee?.projects?.includes(p.name)}
                          onChange={(e) => {
                            const current = editingEmployee?.projects || [];
                            if (e.target.checked) {
                              setEditingEmployee(prev => ({ ...prev, projects: [...current, p.name] }));
                            } else {
                              setEditingEmployee(prev => ({ ...prev, projects: current.filter(name => name !== p.name) }));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">{p.name}</span>
                      </label>
                    ))}
                    {projects.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic">Nenhuma obra cadastrada.</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    value={editingEmployee?.name || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF *</label>
                  <input
                    type="text"
                    value={editingEmployee?.cpf || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, cpf: maskCPF(e.target.value) }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status *</label>
                  <select
                    value={editingEmployee?.status || 'Ativo'}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Regime *</label>
                  <select
                    value={editingEmployee?.regime || 'CLT'}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, regime: e.target.value as any }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CLT">CLT</option>
                    <option value="Diarista">Diarista</option>
                    <option value="Empreiteiro">Empreiteiro</option>
                  </select>
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Chave PIX</label>
                    <select
                      value={editingEmployee?.pixType || 'CPF'}
                      onChange={(e) => setEditingEmployee(prev => ({ 
                        ...prev, 
                        pixType: e.target.value as any,
                        pixKey: maskPix(prev?.pixKey || '', e.target.value as any)
                      }))}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="Telefone">Telefone</option>
                      <option value="Email">E-mail</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chave PIX</label>
                    <input
                      type="text"
                      value={editingEmployee?.pixKey || ''}
                      onChange={(e) => setEditingEmployee(prev => ({ 
                        ...prev, 
                        pixKey: maskPix(e.target.value, prev?.pixType || 'CPF') 
                      }))}
                      placeholder={
                        editingEmployee?.pixType === 'CPF' ? '000.000.000-00' :
                        editingEmployee?.pixType === 'CNPJ' ? '00.000.000/0000-00' :
                        editingEmployee?.pixType === 'Telefone' ? '(00) 00000-0000' :
                        'email@exemplo.com'
                      }
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label>
                  <input
                    type="text"
                    value={editingEmployee?.phone || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, phone: maskPhone(e.target.value) }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                  <input
                    type="email"
                    value={editingEmployee?.email || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CEP</label>
                  <input
                    type="text"
                    value={editingEmployee?.zipCode || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, zipCode: maskCEP(e.target.value) }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço</label>
                  <input
                    type="text"
                    value={editingEmployee?.address || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bairro</label>
                  <input
                    type="text"
                    value={editingEmployee?.neighborhood || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, neighborhood: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cidade</label>
                  <input
                    type="text"
                    value={editingEmployee?.city || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">UF</label>
                  <select
                    value={editingEmployee?.state || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SE', 'SP', 'TO'].sort().map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo</label>
                  <select
                    value={editingEmployee?.role || ''}
                    onChange={(e) => {
                      setEditingEmployee(prev => ({ ...prev, role: e.target.value, jobFunction: e.target.value }));
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {jobFunctions.map(jf => <option key={jf.id} value={jf.name}>{jf.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CBO</label>
                  <select
                    value={editingEmployee?.cbo || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, cbo: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    {CBO_LIST.map(cbo => (
                      <option key={cbo.code} value={cbo.code}>
                        {cbo.code} - {cbo.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salário</label>
                  <input
                    type="number"
                    value={editingEmployee?.salary || 0}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, salary: parseFloat(e.target.value) }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Entrada</label>
                  <input
                    type="time"
                    value={editingEmployee?.entryTime || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, entryTime: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário de Saída</label>
                  <input
                    type="time"
                    value={editingEmployee?.exitTime || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, exitTime: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horas Semanais</label>
                  <input
                    type="number"
                    value={editingEmployee?.weeklyHours || 0}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, weeklyHours: parseInt(e.target.value) }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Escolaridade</label>
                  <select
                    value={editingEmployee?.education || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, education: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione...</option>
                    <option value="Fundamental incompleto">Fundamental incompleto</option>
                    <option value="Fundamental completo">Fundamental completo</option>
                    <option value="Médio incompleto">Médio incompleto</option>
                    <option value="Médio Completo">Médio Completo</option>
                    <option value="Graduação Incompleto">Graduação Incompleto</option>
                    <option value="Graduação Completo">Graduação Completo</option>
                    <option value="Pós-Graduação">Pós-Graduação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data da Admissão</label>
                  <input
                    type="date"
                    value={editingEmployee?.admissionDate || ''}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, admissionDate: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contribuição Sindical?</label>
                  <select
                    value={editingEmployee?.unionContribution ? 'Sim' : 'Não'}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, unionContribution: e.target.value === 'Sim' }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bate Ponto?</label>
                  <select
                    value={editingEmployee?.clockIn ? 'Sim' : 'Não'}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, clockIn: e.target.value === 'Sim' }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recebe Adiantamento?</label>
                  <select
                    value={editingEmployee?.advancePayment ? 'Sim' : 'Não'}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, advancePayment: e.target.value === 'Sim' }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Necessita VT?</label>
                  <select
                    value={editingEmployee?.needsVT ? 'Sim' : 'Não'}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, needsVT: e.target.value === 'Sim' }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Termo de VT Preenchido?</label>
                  <select
                    value={editingEmployee?.vtTermFilled ? 'Sim' : 'Não'}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, vtTermFilled: e.target.value === 'Sim' }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prazo Experiência</label>
                  <select
                    value={editingEmployee?.experiencePeriod || '30+60'}
                    onChange={(e) => setEditingEmployee(prev => ({ ...prev, experiencePeriod: e.target.value as any }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="30+60">30+60</option>
                    <option value="45+45">45+45</option>
                  </select>
                </div>
                <div className="md:col-span-3 border-t border-slate-100 pt-6">
                  <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Benefícios</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex-1">
                        <div className="font-bold text-slate-700">Vale Alimentação (VA)</div>
                        <div className="text-xs text-slate-500">Ativar benefício e definir valor mensal</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={editingEmployee?.benefits?.va?.active || false}
                          onChange={(e) => setEditingEmployee(prev => ({
                            ...prev,
                            benefits: {
                              ...prev?.benefits,
                              va: { ...prev?.benefits?.va!, active: e.target.checked }
                            }
                          }))}
                          className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <input
                          type="number"
                          value={editingEmployee?.benefits?.va?.value || 0}
                          onChange={(e) => setEditingEmployee(prev => ({
                            ...prev,
                            benefits: {
                              ...prev?.benefits,
                              va: { ...prev?.benefits?.va!, value: parseFloat(e.target.value) }
                            }
                          }))}
                          placeholder="Valor R$"
                          className="w-24 px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex-1">
                        <div className="font-bold text-slate-700">Vale Mobilidade (VM)</div>
                        <div className="text-xs text-slate-500">Ativar benefício e definir valor mensal</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={editingEmployee?.benefits?.vm?.active || false}
                          onChange={(e) => setEditingEmployee(prev => ({
                            ...prev,
                            benefits: {
                              ...prev?.benefits,
                              vm: { ...prev?.benefits?.vm!, active: e.target.checked }
                            }
                          }))}
                          className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <input
                          type="number"
                          value={editingEmployee?.benefits?.vm?.value || 0}
                          onChange={(e) => setEditingEmployee(prev => ({
                            ...prev,
                            benefits: {
                              ...prev?.benefits,
                              vm: { ...prev?.benefits?.vm!, value: parseFloat(e.target.value) }
                            }
                          }))}
                          placeholder="Valor R$"
                          className="w-24 px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {documentTypes.map(doc => (
                    <div key={doc.key} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-full md:w-64">
                        <div className="font-bold text-slate-700 text-sm">{doc.label}</div>
                      </div>
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          placeholder="Número do Documento"
                          value={editingEmployee?.documents?.[doc.key]?.number || ''}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (doc.key === 'cpf' || doc.key === 'spouse_cpf') val = maskCPF(val);
                            if (doc.key === 'rg') val = maskRG(val);
                            updateDocNumber(doc.key, val);
                          }}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="w-full md:w-auto flex items-center gap-3">
                        <label className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center gap-2">
                          <i className="fas fa-upload"></i>
                          {editingEmployee?.documents?.[doc.key]?.fileName ? 'Alterar PDF' : 'Upload PDF'}
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleFileChange(doc.key, e)}
                            className="hidden"
                          />
                        </label>
                        {editingEmployee?.documents?.[doc.key]?.fileBase64 && (
                          <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <i className="fas fa-check-circle"></i>
                            Enviado
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'uniforms' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">N° Calçado</label>
                  <input
                    type="text"
                    value={editingEmployee?.uniforms?.shoeSize || ''}
                    onChange={(e) => setEditingEmployee(prev => ({
                      ...prev,
                      uniforms: { ...prev?.uniforms!, shoeSize: e.target.value }
                    }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">N° Calça</label>
                  <select
                    value={editingEmployee?.uniforms?.pantsSize || 'M'}
                    onChange={(e) => setEditingEmployee(prev => ({
                      ...prev,
                      uniforms: { ...prev?.uniforms!, pantsSize: e.target.value as any }
                    }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="P">P</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="GG">GG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">N° Camisa</label>
                  <select
                    value={editingEmployee?.uniforms?.shirtSize || 'M'}
                    onChange={(e) => setEditingEmployee(prev => ({
                      ...prev,
                      uniforms: { ...prev?.uniforms!, shirtSize: e.target.value as any }
                    }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="P">P</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="GG">GG</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este colaborador? Esta ação não pode ser desfeita."
        onConfirm={() => {
          if (showDeleteConfirm) {
            onDeleteEmployee(showDeleteConfirm);
            onFeedback?.('success', 'Colaborador excluído com sucesso!');
          }
        }}
        onCancel={() => setShowDeleteConfirm(null)}
      />

    </div>
  );
};
