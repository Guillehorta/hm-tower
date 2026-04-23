import React, { useState, useMemo, useRef } from 'react';
import { Employee, Project, TimeLog, DailyMeasurement, Company, LogType, MeasurementEntry } from '../types';
import { generateId } from '../src/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface DailyMeasurementProps {
  employees: Employee[];
  projects: Project[];
  companies: Company[];
  logs: TimeLog[];
  measurements: DailyMeasurement[];
  onSave: (measurement: DailyMeasurement) => void;
  onFeedback?: (type: 'success' | 'error', msg: string) => void;
  onConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

type Step = 'filters' | 'selection' | 'values' | 'summary';

export const DailyMeasurementView: React.FC<DailyMeasurementProps> = ({ 
  employees, 
  projects, 
  companies, 
  logs, 
  measurements,
  onSave,
  onFeedback,
  onConfirm
}) => {
  const [step, setStep] = useState<Step>('filters');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [currentEntries, setCurrentEntries] = useState<MeasurementEntry[]>([]);
  const [observations, setObservations] = useState<string>('');
  const [currentMeasurementId, setCurrentMeasurementId] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const filteredEmployeesForSelection = useMemo(() => {
    return employees.filter(emp => {
      const matchCompany = !selectedCompany || emp.company === selectedCompany;
      const matchProject = !selectedProject || emp.projects?.includes(selectedProject);
      return matchCompany && matchProject && emp.status === 'Ativo';
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [employees, selectedCompany, selectedProject]);

  const getDaysWorked = (employeeId: string, startStr: string, endStr: string) => {
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime() + (24 * 60 * 60 * 1000) - 1;

    const periodLogs = logs.filter(log => 
      log.employeeId === employeeId && 
      log.timestamp >= start && 
      log.timestamp <= end
    );

    const days = new Set();
    periodLogs.forEach(log => {
      days.add(new Date(log.timestamp).toISOString().split('T')[0]);
    });

    return days.size;
  };

  const handleStepClick = (targetStep: Step) => {
    const stepOrder: Step[] = ['filters', 'selection', 'values', 'summary'];
    const targetIdx = stepOrder.indexOf(targetStep);
    const currentIdx = stepOrder.indexOf(step);

    // Allow going back anytime
    if (targetIdx < currentIdx) {
      setStep(targetStep);
      return;
    }

    // Validation for going forward
    if (targetStep === 'selection' && (!selectedCompany || !selectedProject)) {
      onFeedback?.('error', "Selecione a empresa e a obra primeiro.");
      return;
    }
    if (targetStep === 'values' && selectedEmployeeIds.length === 0) {
      onFeedback?.('error', "Selecione pelo menos um colaborador primeiro.");
      return;
    }
    if (targetStep === 'summary' && currentEntries.length === 0) {
      onFeedback?.('error', "Complete a entrada de valores primeiro.");
      return;
    }

    setStep(targetStep);
  };

  const handleCreateMeasurement = () => {
    if (!selectedCompany || !selectedProject) {
      onFeedback?.('error', "Selecione a empresa e a obra.");
      return;
    }
    setStep('selection');
  };

  const handleConfirmSelection = () => {
    if (selectedEmployeeIds.length === 0) {
      onFeedback?.('error', "Selecione pelo menos um colaborador.");
      return;
    }

    const entries: MeasurementEntry[] = selectedEmployeeIds.map(id => {
      // Check if entry already exists (for editing)
      const existing = currentEntries.find(e => e.employeeId === id);
      if (existing) return existing;

      const emp = employees.find(e => e.id === id);
      return {
        employeeId: id,
        dailyRate: emp?.dailyRate || 0,
        daysWorked: getDaysWorked(id, startDate, endDate),
        extraValue: 0,
        discountValue: 0
      };
    });

    setCurrentEntries(entries);
    setStep('values');
  };

  const handleUpdateEntry = (employeeId: string, field: keyof MeasurementEntry, value: number) => {
    setCurrentEntries(prev => prev.map(entry => 
      entry.employeeId === employeeId ? { ...entry, [field]: value } : entry
    ));
  };

  const handleSaveAll = () => {
    const newMeasurement: DailyMeasurement = {
      id: currentMeasurementId || generateId(),
      companyName: selectedCompany,
      projectName: selectedProject,
      startDate,
      endDate,
      dueDate,
      entries: currentEntries,
      observations,
      status: 'completed',
      createdAt: currentMeasurementId ? (measurements.find(m => m.id === currentMeasurementId)?.createdAt || Date.now()) : Date.now()
    };

    onSave(newMeasurement);
    setCurrentMeasurementId(newMeasurement.id);
    setStep('summary');
  };

  const generatePDF = async () => {
    if (!printRef.current) return;

    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      useCORS: true,
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Medicao_${selectedProject}_${startDate}.pdf`);
  };

  const reset = () => {
    setStep('filters');
    setSelectedEmployeeIds([]);
    setCurrentEntries([]);
    setObservations('');
    setDueDate('');
    setCurrentMeasurementId(null);
  };

  return (
    <div className="space-y-8">
      {/* Steps Indicator */}
      <div className="flex items-center justify-between max-w-2xl mx-auto mb-8">
        {[
          { id: 'filters', label: 'Filtros', icon: 'fa-filter' },
          { id: 'selection', label: 'Seleção', icon: 'fa-user-check' },
          { id: 'values', label: 'Valores', icon: 'fa-dollar-sign' },
          { id: 'summary', label: 'Resumo', icon: 'fa-file-alt' }
        ].map((s, idx) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => handleStepClick(s.id as Step)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                step === s.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50' : 
                idx < ['filters', 'selection', 'values', 'summary'].indexOf(step) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                <i className={`fas ${s.icon} text-sm`}></i>
              </button>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${step === s.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
            {idx < 3 && <div className={`flex-1 h-0.5 mx-2 ${idx < ['filters', 'selection', 'values', 'summary'].indexOf(step) ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>}
          </React.Fragment>
        ))}
      </div>

      {step === 'filters' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 italic">Empresa</label>
              <select 
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              >
                <option value="">Selecione a Empresa</option>
                {companies?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 italic">Obra</label>
              <select 
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              >
                <option value="">Selecione a Obra</option>
                {projects?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 italic">Data Início</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 italic">Data Fim</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 italic">Data Vencimento</label>
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>
          </div>
          <button 
            onClick={handleCreateMeasurement}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 flex items-center justify-center gap-3"
          >
            <i className="fas fa-plus-circle"></i> Criar Nova Medição
          </button>

          {measurements?.length > 0 && (
            <div className="pt-8 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-700 mb-4 italic uppercase tracking-wider">Histórico de Medições</h4>
              <div className="space-y-3">
                {measurements?.sort((a, b) => b.createdAt - a.createdAt).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors group">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{m.projectName}</div>
                      <div className="text-[10px] text-slate-500 uppercase">{m.companyName} | {new Date(m.startDate).toLocaleDateString()} - {new Date(m.endDate).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedCompany(m.companyName);
                          setSelectedProject(m.projectName);
                          setStartDate(m.startDate);
                          setEndDate(m.endDate);
                          setDueDate(m.dueDate || '');
                          setCurrentEntries(m.entries);
                          setSelectedEmployeeIds(m.entries.map(e => e.employeeId));
                          setObservations(m.observations || '');
                          setCurrentMeasurementId(m.id);
                          setStep('values'); // Go directly to values for editing
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                        title="Editar Medição"
                      >
                        <i className="fas fa-edit"></i> Editar
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedCompany(m.companyName);
                          setSelectedProject(m.projectName);
                          setStartDate(m.startDate);
                          setEndDate(m.endDate);
                          setDueDate(m.dueDate || '');
                          setCurrentEntries(m.entries);
                          setSelectedEmployeeIds(m.entries.map(e => e.employeeId));
                          setObservations(m.observations || '');
                          setCurrentMeasurementId(m.id);
                          setStep('summary');
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Visualizar Resumo"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'selection' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800 italic">Selecionar Colaboradores</h3>
            <div className="text-xs text-slate-500 font-medium">
              {selectedEmployeeIds.length} selecionados
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2">
            {filteredEmployeesForSelection?.map(emp => (
              <label 
                key={emp.id} 
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedEmployeeIds.includes(emp.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <input 
                  type="checkbox"
                  checked={selectedEmployeeIds.includes(emp.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                    else setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id));
                  }}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 text-sm">{emp.name.toUpperCase()}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{emp.jobFunction}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setStep('filters')} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">Voltar</button>
            <button onClick={handleConfirmSelection} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">Próximo</button>
          </div>
        </div>
      )}

      {step === 'values' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6 max-w-6xl mx-auto">
          <h3 className="text-xl font-bold text-slate-800 italic mb-4">Entrada de Valores</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Colaborador</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Dias</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Diária (R$)</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Extras (R$)</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Desc. (R$)</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentEntries?.map(entry => {
                  const emp = employees.find(e => e.id === entry.employeeId);
                  const total = (entry.daysWorked * entry.dailyRate) + entry.extraValue - entry.discountValue;
                  return (
                    <tr key={entry.employeeId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 text-sm">{emp?.name?.toUpperCase()}</div>
                        <div className="text-[10px] text-slate-400">{emp?.jobFunction}</div>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          value={entry.daysWorked}
                          onChange={(e) => handleUpdateEntry(entry.employeeId, 'daysWorked', parseFloat(e.target.value) || 0)}
                          className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          value={entry.dailyRate}
                          onChange={(e) => handleUpdateEntry(entry.employeeId, 'dailyRate', parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          value={entry.extraValue}
                          onChange={(e) => handleUpdateEntry(entry.employeeId, 'extraValue', parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          value={entry.discountValue}
                          onChange={(e) => handleUpdateEntry(entry.employeeId, 'discountValue', parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
                          R$ {total.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 italic">Observações</label>
            <textarea 
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
              placeholder="Adicione observações relevantes..."
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setStep('selection')} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">Voltar</button>
            <button onClick={handleSaveAll} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-100">Salvar e Finalizar</button>
          </div>
        </div>
      )}

      {step === 'summary' && (
        <div className="space-y-8 max-w-7xl mx-auto">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                <i className="fas fa-check-circle text-2xl"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Medição Concluída</h3>
                <p className="text-slate-500 text-sm">A medição foi salva com sucesso.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={reset} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition">Nova Medição</button>
              <button onClick={generatePDF} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2">
                <i className="fas fa-file-pdf"></i> Gerar PDF Paisagem
              </button>
            </div>
          </div>

          {/* PDF Model Preview - Landscape */}
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 overflow-x-auto">
            <div ref={printRef} className="bg-white w-[297mm] min-h-[210mm] p-[10mm] mx-auto text-black font-sans" style={{ fontSize: '9px' }}>
              {/* Header */}
              <div className="border border-black flex h-16">
                <div className="w-1/4 border-r border-black flex items-center justify-center p-2">
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white text-[8px] font-bold">HM</div>
                    <span className="font-bold text-[10px]">HMTOWER</span>
                  </div>
                </div>
                <div className="w-1/2 border-r border-black flex flex-col items-center justify-center font-bold text-[11px]">
                  HM TOWER ENGENHARIA E CONSTRUÇÕES
                </div>
                <div className="w-1/4 flex flex-col items-center justify-center font-bold text-[12px]">
                  MEDIÇÃO MENSAL
                </div>
              </div>

              {/* Metadata */}
              <div className="border-x border-b border-black flex h-10">
                <div className="w-1/4 border-r border-black p-1">
                  <div className="font-bold text-[7px] uppercase">DATA INICIO:</div>
                  <div className="text-[9px]">{new Date(startDate).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className="w-1/4 border-r border-black p-1">
                  <div className="font-bold text-[7px] uppercase">DATA FINAL:</div>
                  <div className="text-[9px]">{new Date(endDate).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className="w-1/4 border-r border-black p-1">
                  <div className="font-bold text-[7px] uppercase">OBRA:</div>
                  <div className="text-[9px] truncate">{selectedProject}</div>
                </div>
                <div className="w-1/4 p-1 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <span className="font-bold text-[7px] uppercase">FLS:</span>
                    <span>1 de 1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-[7px] uppercase">MEDIÇÃO:</span>
                    <span>1</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <table className="w-full border-collapse border-x border-black">
                <thead>
                  <tr className="bg-slate-100 border-b border-black text-[7px] font-bold">
                    <th className="border-r border-black px-1 py-1 w-8 text-center">COD</th>
                    <th className="border-r border-black px-2 py-1 text-left">DESCRIÇÃO (COLABORADOR - CPF - PIX)</th>
                    <th className="border-r border-black px-1 py-1 w-8 text-center">UN.</th>
                    <th className="border-r border-black px-1 py-1 w-16 text-center">FUNÇÃO</th>
                    <th className="border-r border-black px-1 py-1 w-12 text-center">ACUM. ANT.</th>
                    <th className="border-r border-black px-1 py-1 w-12 text-center">NO MÊS</th>
                    <th className="border-r border-black px-1 py-1 w-12 text-center">ACUM. ATUAL</th>
                    <th className="border-r border-black px-1 py-1 w-12 text-center">EXTRAS</th>
                    <th className="border-r border-black px-1 py-1 w-16 text-center">UNITÁRIO</th>
                    <th className="border-r border-black px-1 py-1 w-16 text-center">AC. MÊS ANT.</th>
                    <th className="border-r border-black px-1 py-1 w-16 text-center">NO MÊS</th>
                    <th className="px-1 py-1 w-16 text-center">ACUM. ATUAL</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEntries?.map((entry, idx) => {
                    const emp = employees.find(e => e.id === entry.employeeId);
                    const noMes = (entry.daysWorked * entry.dailyRate) + entry.extraValue - entry.discountValue;
                    const description = `${emp?.name?.toUpperCase()} - ${emp?.cpf} - ${emp?.pixKey || 'N/A'}`;
                    return (
                      <tr key={entry.employeeId} className="border-b border-black h-6">
                        <td className="border-r border-black text-center">{idx + 1}</td>
                        <td className="border-r border-black px-2 font-medium truncate max-w-[200px]">{description}</td>
                        <td className="border-r border-black text-center">dia</td>
                        <td className="border-r border-black text-center text-[7px] truncate">{emp?.jobFunction}</td>
                        <td className="border-r border-black text-center">-</td>
                        <td className="border-r border-black text-center font-bold">{entry.daysWorked}</td>
                        <td className="border-r border-black text-center">{entry.daysWorked}</td>
                        <td className="border-r border-black text-center">R$ {entry.extraValue.toFixed(0)}</td>
                        <td className="border-r border-black text-center">R$ {entry.dailyRate.toFixed(0)}</td>
                        <td className="border-r border-black text-center">-</td>
                        <td className="border-r border-black text-center font-bold">R$ {noMes.toFixed(2)}</td>
                        <td className="text-center font-bold">R$ {noMes.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 15 - currentEntries.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-black h-6">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              <div className="border-x border-b border-black flex h-20">
                <div className="w-2/3 border-r border-black p-2 flex flex-col">
                  <div className="font-bold text-[8px] uppercase mb-1">Observações:</div>
                  <div className="text-[9px] flex-1 italic">{observations || 'Nenhuma observação.'}</div>
                </div>
                <div className="w-1/3 flex flex-col">
                  <div className="flex-1 flex border-b border-black">
                    <div className="w-1/2 border-r border-black flex items-center justify-center font-bold text-[8px] uppercase">Total da Medição</div>
                    <div className="w-1/2 flex items-center justify-center font-bold text-[10px]">
                      R$ {currentEntries.reduce((acc, curr) => acc + (curr.daysWorked * curr.dailyRate) + curr.extraValue - curr.discountValue, 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col p-1 text-[7px]">
                    <div className="flex justify-between">
                      <span>Vencimento:</span>
                      <span className="font-bold">{dueDate ? new Date(dueDate).toLocaleDateString('pt-BR') : '___/___/______'}</span>
                    </div>
                    <div className="mt-1 font-bold uppercase">Informações de Pagamento:</div>
                    <div className="text-[6px] opacity-70">Pagamento via PIX conforme chaves listadas na descrição.</div>
                  </div>
                </div>
              </div>

              <div className="border-x border-b border-black flex h-12">
                <div className="w-1/2 border-r border-black p-2 flex flex-col justify-between">
                  <div className="font-bold text-[8px] uppercase">EQUIPE GERAL</div>
                  <div className="text-[7px]">FOLHA: 0-1-1</div>
                </div>
                <div className="w-1/2 p-2 flex flex-col justify-between">
                  <div className="font-bold text-[8px] uppercase">OBRA: {selectedProject}</div>
                  <div className="flex justify-between items-end">
                    <div className="w-32 border-t border-black text-center text-[7px] mt-4">ASSINATURA</div>
                    <div className="text-[6px] text-slate-400">Gerado em: {new Date().toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
