import React, { useState, useMemo } from 'react';
import { Employee, Company, Project, JobFunction } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { CBO_LIST } from './cboData';
import { maskPhone, maskCEP, maskCPF, maskCNPJ, maskRG, maskPix, generateId } from '../src/lib/utils';

interface EmployeeAdminProps {
  employees: Employee[];
  companies: Company[];
  projects: Project[];
  jobFunctions: JobFunction[];
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onSaveJobFunction?: (jf: JobFunction) => void;
  onFeedback?: (type: 'success' | 'error', msg: string) => void;
}

type TabType = 'personal' | 'documents' | 'uniforms';

export const EmployeeAdminView: React.FC<EmployeeAdminProps> = ({
  employees,
  companies,
  projects,
  jobFunctions,
  onSaveEmployee,
  onDeleteEmployee,
  onSaveJobFunction,
  onFeedback
}) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showAPIImportConfirm, setShowAPIImportConfirm] = useState(false);
  const [pendingLines, setPendingLines] = useState<string[]>([]);
  const [pendingAPIData, setPendingAPIData] = useState<any[]>([]);
  const [isLoadingAPI, setIsLoadingAPI] = useState(false);

  // Filters
  const [filterCompany, setFilterCompany] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterName, setFilterName] = useState('');

  const filteredEmployees = useMemo(() => {
    return employees
      .filter(emp => {
        const matchCompany = !filterCompany || emp.company === filterCompany;
        const matchProject = !filterProject || emp.projects?.includes(filterProject);
        const matchName = !filterName || emp.name.toLowerCase().includes(filterName.toLowerCase());
        return matchCompany && matchProject && matchName;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, filterCompany, filterProject, filterName]);

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

  const processImport = (updateExisting: boolean) => {
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < pendingLines.length; i++) {
      if (!pendingLines[i].trim()) continue;
      
      const values = pendingLines[i].split(';').map(v => v.trim());
      if (values.length < 13) {
        skippedCount++;
        continue;
      }

      const companyNameFromCSV = values[0];
      const cnpj = values[1];
      const project = values[2];
      const pis = values[5];
      const name = values[6];
      const ctps = values[7];
      const rawDate = values[9];
      const observation = values[11];
      const cpf = maskCPF(values[12] || '');
      const role = values[13] || '(Não informado)';

      if (!cpf || !name) {
        skippedCount++;
        continue;
      }

      const existingEmployee = employees.find(emp => emp.cpf === cpf);
      
      if (existingEmployee) {
        if (!updateExisting) {
          skippedCount++;
          continue;
        }
        // Update logic
        const updatedEmployee: Employee = {
          ...existingEmployee,
          name: name.toUpperCase(),
          role: role,
          jobFunction: role,
          company: companies.find(c => c.cnpj === cnpj || c.name === companyNameFromCSV)?.name || companyNameFromCSV,
          projects: [project],
          admissionDate: rawDate.includes('/') ? `${rawDate.split('/')[2]}-${rawDate.split('/')[1]}-${rawDate.split('/')[0]}` : existingEmployee.admissionDate,
          regime: observation.toUpperCase().includes('DIARISTA') ? 'Diarista' : 'CLT',
          documents: {
            ...existingEmployee.documents,
            pis: { number: pis },
            ctps: { number: ctps }
          }
        };
        onSaveEmployee(updatedEmployee);
        updatedCount++;
        continue;
      }

      // Convert date from DD/MM/YYYY to YYYY-MM-DD
      let admissionDate = new Date().toISOString().split('T')[0];
      if (rawDate && rawDate.includes('/')) {
        const dateParts = rawDate.split('/');
        if (dateParts.length === 3) {
          admissionDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
      }

      // Try to find company name by CNPJ or Name
      const companyObj = companies.find(c => c.cnpj === cnpj || c.name === companyNameFromCSV);
      const companyName = companyObj ? companyObj.name : companyNameFromCSV;

      const newEmployee: Employee = {
        id: generateId(),
        name: name.toUpperCase(),
        role: role,
        jobFunction: role,
        department: '',
        company: companyName,
        projects: [project],
        admissionDate: admissionDate,
        cpf: cpf,
        birthDate: '',
        regime: observation.toUpperCase().includes('DIARISTA') ? 'Diarista' : 'CLT',
        status: 'Ativo',
        photoBase64: '',
        createdAt: Date.now(),
        entryTime: '08:00',
        exitTime: '18:00',
        weeklyHours: 44,
        benefits: {
          va: { active: false, value: 0 },
          vm: { active: false, value: 0 }
        },
        documents: {
          pis: { number: pis },
          ctps: { number: ctps }
        },
        uniforms: {
          shoeSize: '',
          pantsSize: 'M',
          shirtSize: 'M'
        }
      };

      onSaveEmployee(newEmployee);
      importedCount++;
    }

    const msg = updateExisting 
      ? `${importedCount} novos e ${updatedCount} atualizados. ${skippedCount} ignorados.`
      : `${importedCount} novos importados. ${skippedCount} ignorados (já cadastrados ou inválidos).`;
    
    onFeedback?.('success', msg);
    setShowImportConfirm(false);
    setPendingLines([]);
  };

  const processAPIImport = (updateExisting: boolean) => {
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let newFunctionsCount = 0;

    // First, identify and register new job functions
    const uniqueFunctions = Array.from(new Set(pendingAPIData.map(emp => 
      emp.FuncaoDescricao || emp.FuncaoNome || emp.CargoDescricao || emp.Cargo
    ).filter(Boolean)));
    
    uniqueFunctions.forEach(funcName => {
      const exists = jobFunctions.find(jf => jf.name.trim().toLowerCase() === funcName.trim().toLowerCase());
      if (!exists && onSaveJobFunction) {
        onSaveJobFunction({
          id: generateId(),
          name: funcName.trim(),
          createdAt: Date.now()
        });
        newFunctionsCount++;
      }
    });

    for (const remoteEmp of pendingAPIData) {
      const name = remoteEmp.Nome;
      const cpf = maskCPF(remoteEmp.Cpf || '');
      const pis = remoteEmp.NumeroPis || '';
      const email = remoteEmp.Email || '';
      const phone = remoteEmp.Celular || remoteEmp.Telefone || '';
      
      // Try multiple fields for role/job function (including nested)
      let role = remoteEmp.FuncaoDescricao || remoteEmp.FuncaoNome || remoteEmp.CargoDescricao || remoteEmp.Cargo || 
                 (remoteEmp.Funcao ? (remoteEmp.Funcao.Descricao || remoteEmp.Funcao.Nome) : null) || '(Não informado)';
      
      // Ensure we match the casing of an existing job function if it exists
      const existingJF = jobFunctions.find(jf => jf.name.trim().toLowerCase() === role.trim().toLowerCase());
      if (existingJF) {
        role = existingJF.name;
      } else {
        role = role.trim();
      }

      const company = remoteEmp.EmpresaNome || '';
      const department = remoteEmp.DepartamentoDescricao || remoteEmp.DepartamentoNome || 
                        (remoteEmp.Departamento ? (remoteEmp.Departamento.Descricao || remoteEmp.Departamento.Nome) : null) || '';
      
      // Parse Date (usually ISO or YYYY-MM-DD from API)
      let admissionDate = new Date().toISOString().split('T')[0];
      if (remoteEmp.Admissao) {
        admissionDate = remoteEmp.Admissao.split('T')[0];
      }

      if (!cpf || !name) {
        skippedCount++;
        continue;
      }

      const existingEmployee = employees.find(emp => emp.cpf === cpf);
      
      if (existingEmployee) {
        if (!updateExisting) {
          skippedCount++;
          continue;
        }
        // Update logic
        const updatedEmployee: Employee = {
          ...existingEmployee,
          name: name.toUpperCase(),
          role,
          jobFunction: role,
          department,
          company: companies.find(c => c.name === company)?.name || company,
          projects: department ? [department] : existingEmployee.projects,
          admissionDate,
          email,
          phone,
          address: remoteEmp.Endereco || existingEmployee.address,
          neighborhood: remoteEmp.Bairro || existingEmployee.neighborhood,
          city: remoteEmp.Cidade || existingEmployee.city,
          state: remoteEmp.Uf || existingEmployee.state,
          zipCode: remoteEmp.Cep || existingEmployee.zipCode,
          documents: {
            ...existingEmployee.documents,
            pis: { number: pis }
          }
        };
        onSaveEmployee(updatedEmployee);
        updatedCount++;
        continue;
      }

      const newEmployee: Employee = {
        id: generateId(),
        name: name.toUpperCase(),
        role,
        jobFunction: role,
        department,
        company: companies.find(c => c.name === company)?.name || company,
        projects: department ? [department] : (projects[0]?.name ? [projects[0].name] : []), // Use department from Secullum as project name
        admissionDate,
        cpf,
        birthDate: remoteEmp.Nascimento ? remoteEmp.Nascimento.split('T')[0] : '',
        regime: 'CLT',
        status: 'Ativo',
        photoBase64: '',
        createdAt: Date.now(),
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

      onSaveEmployee(newEmployee);
      importedCount++;
    }

    const msg = updateExisting 
      ? `${importedCount} novos e ${updatedCount} atualizados via API Secullum.${newFunctionsCount > 0 ? ` ${newFunctionsCount} novas funções cadastradas.` : ''}`
      : `${importedCount} novos importados via API Secullum. Já existentes foram ignorados.${newFunctionsCount > 0 ? ` ${newFunctionsCount} novas funções cadastradas.` : ''}`;
    
    onFeedback?.('success', msg);
    setShowAPIImportConfirm(false);
    setPendingAPIData([]);
  };

  const handleImportAPI = async () => {
    setIsLoadingAPI(true);
    try {
      const response = await fetch('/api/secullum/import');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao conectar com a API Secullum.');
      }
      
      // Handle cases where data might be nested (e.g., { Funcionarios: [...] })
      const employeesArray = Array.isArray(data) ? data : (data.Funcionarios || data.data || []);
      setPendingAPIData(employeesArray);
      setShowAPIImportConfirm(true);
    } catch (error: any) {
      onFeedback?.('error', error.message);
    } finally {
      setIsLoadingAPI(false);
    }
  };

  const handleImportTXT = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        setPendingLines(lines);
        setShowImportConfirm(true);
      };
      reader.readAsText(file);
      e.target.value = '';
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
                onClick={handleImportAPI}
                disabled={isLoadingAPI}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
              >
                {isLoadingAPI ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-network-wired"></i>
                )}
                Importar via API
              </button>
              <label className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2 cursor-pointer">
                <i className="fas fa-file-import"></i> Importar TXT
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleImportTXT}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleNewEmployee}
                className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
              >
                <i className="fas fa-plus"></i> Novo Cadastro
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          {emp.photoBase64 ? (
                            <img src={emp.photoBase64} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user text-slate-400"></i>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{emp.name.toUpperCase()}</div>
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

      {showImportConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <i className="fas fa-file-import text-xl"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Importar Colaboradores</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Deseja atualizar as informações dos colaboradores que já estão cadastrados no sistema?
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex flex-col gap-2">
              <button
                onClick={() => processImport(true)}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
              >
                Sim, atualizar existentes
              </button>
              <button
                onClick={() => processImport(false)}
                className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition"
              >
                Não, apenas novos cadastros
              </button>
              <button
                onClick={() => {
                  setShowImportConfirm(false);
                  setPendingLines([]);
                }}
                className="w-full py-2 text-slate-400 text-xs font-bold hover:text-slate-600 transition"
              >
                Cancelar Importação
              </button>
            </div>
          </div>
        </div>
      )}

      {showAPIImportConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <i className="fas fa-network-wired text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Visualizar Importação Secullum</h3>
                    <p className="text-slate-500 text-sm">Validamos {pendingAPIData.length} registros prontos para sincronização.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowAPIImportConfirm(false);
                    setPendingAPIData([]);
                  }}
                  className="text-slate-400 hover:text-rose-500 transition"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden mb-6">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-600">Nome</th>
                        <th className="px-4 py-3 font-bold text-slate-600">CPF</th>
                        <th className="px-4 py-3 font-bold text-slate-600">Cargo</th>
                        <th className="px-4 py-3 font-bold text-slate-600">Obra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {pendingAPIData.slice(0, 50).map((emp, idx) => (
                        <tr key={idx} className="hover:bg-white/50">
                          <td className="px-4 py-2 font-medium text-slate-800">{emp.Nome}</td>
                          <td className="px-4 py-2 text-slate-500">{maskCPF(emp.Cpf || '')}</td>
                          <td className="px-4 py-2 text-slate-500">{emp.FuncaoDescricao || emp.FuncaoNome || emp.CargoDescricao || emp.Cargo || '---'}</td>
                          <td className="px-4 py-2 text-slate-500">{emp.DepartamentoDescricao || emp.DepartamentoNome || '---'}</td>
                        </tr>
                      ))}
                      {pendingAPIData.length > 50 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-center text-slate-400 font-medium bg-slate-100/50">
                            E mais {pendingAPIData.length - 50} colaboradores...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-slate-600 text-sm leading-relaxed mb-6 bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
                <i className="fas fa-exclamation-triangle text-amber-500 mt-1"></i>
                <span>
                  <strong>Atenção:</strong> Escolha se deseja atualizar os dados dos colaboradores que já existem (baseado no CPF) ou se deseja cadastrar apenas os novos.
                </span>
              </p>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => processAPIImport(true)}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <i className="fas fa-sync"></i>
                Atualizar e Importar
              </button>
              <button
                onClick={() => processAPIImport(false)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition flex items-center justify-center gap-2"
              >
                <i className="fas fa-plus-circle"></i>
                Apenas Novos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
