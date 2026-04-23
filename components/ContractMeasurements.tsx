import React, { useState, useMemo, useRef } from 'react';
import { Contract, ContractMeasurement, Company, Project, ContractItem, MeasurementItem, Supplier, Employee, LaborTracking } from '../types';
import { generateId } from '../src/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { ConfirmModal } from './ConfirmModal';

interface ContractMeasurementsProps {
  contracts: Contract[];
  measurements: ContractMeasurement[];
  companies: Company[];
  projects: Project[];
  suppliers: Supplier[];
  employees: Employee[];
  laborTracking: LaborTracking[];
  onSaveContract: (contract: Contract) => void;
  onSaveMeasurement: (measurement: ContractMeasurement) => void;
  onDeleteMeasurement: (id: string) => void;
  onDeleteContract: (id: string) => void;
  onFeedback?: (type: 'success' | 'error', msg: string) => void;
  onConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

type ViewState = 'contracts' | 'contract-details' | 'new-contract' | 'new-measurement' | 'measurement-summary';

export const ContractMeasurementsView: React.FC<ContractMeasurementsProps> = ({
  contracts,
  measurements,
  companies,
  projects,
  suppliers,
  employees,
  laborTracking,
  onSaveContract,
  onSaveMeasurement,
  onDeleteMeasurement,
  onDeleteContract,
  onFeedback,
  onConfirm
}) => {
  const [view, setView] = useState<ViewState>('contracts');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [isPayrollMode, setIsPayrollMode] = useState(false);
  
  // Filters for contracts
  const [filterCompany, setFilterCompany] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  // New Contract State
  const [newContract, setNewContract] = useState<Partial<Contract>>({
    items: []
  });

  // New Measurement State
  const [newMeasurementItems, setNewMeasurementItems] = useState<MeasurementItem[]>([]);
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [searchStartDate, setSearchStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [searchEndDate, setSearchEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [measurementObs, setMeasurementObs] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const company = companies.find(comp => comp.id === c.companyId)?.name || '';
      const project = projects.find(p => p.id === c.projectId)?.name || '';
      
      const matchCompany = !filterCompany || company.toLowerCase().includes(filterCompany.toLowerCase());
      const matchProject = !filterProject || project.toLowerCase().includes(filterProject.toLowerCase());
      const matchSupplier = !filterSupplier || c.supplierName.toLowerCase().includes(filterSupplier.toLowerCase());
      
      return matchCompany && matchProject && matchSupplier;
    });
  }, [contracts, filterCompany, filterProject, filterSupplier, companies, projects]);

  const selectedContract = useMemo(() => 
    contracts.find(c => c.id === selectedContractId), 
    [contracts, selectedContractId]
  );

  const contractMeasurements = useMemo(() => 
    measurements.filter(m => m.contractId === selectedContractId)
      .sort((a, b) => b.measurementNumber - a.measurementNumber),
    [measurements, selectedContractId]
  );

  const selectedMeasurement = useMemo(() => 
    measurements.find(m => m.id === selectedMeasurementId),
    [measurements, selectedMeasurementId]
  );

  const getAccumulatedQuantity = (contractItemId: string, upToMeasurementNumber: number, servicePath?: string) => {
    const prevMeasurements = measurements.filter(m => 
      m.contractId === selectedContractId && m.measurementNumber < upToMeasurementNumber
    );
    
    return prevMeasurements.reduce((acc, m) => {
      const items = m.items.filter(i => 
        i.contractItemId === contractItemId && (!servicePath || i.servicePath === servicePath)
      );
      return acc + items.reduce((sum, i) => sum + (i.measuredQuantity || 0), 0);
    }, 0);
  };

  const stageSummary = useMemo(() => {
    if (!selectedMeasurement || !selectedContract) return [];
    
    const summary: { [key: string]: { name: string, current: number, total: number } } = {};
    let totalCurrentValue = 0;

    selectedContract.items.forEach(item => {
      const mItem = selectedMeasurement.items.find(mi => mi.contractItemId === item.id);
      const measuredValue = (mItem?.measuredQuantity || 0) * item.unitValue;
      const accumPrev = getAccumulatedQuantity(item.id, selectedMeasurement.measurementNumber);
      const totalValue = (accumPrev + (mItem?.measuredQuantity || 0)) * item.unitValue;
      
      totalCurrentValue += measuredValue;

      let stageName = 'Outros';
      if (item.servicePath) {
        const [ccId, stId] = item.servicePath.split('|');
        const project = projects.find(p => p.id === selectedContract.projectId);
        const cc = project?.costStructure?.find(c => c.id === ccId);
        const st = cc?.stages.find(s => s.id === stId);
        if (st) stageName = st.name;
      }

      if (!summary[stageName]) {
        summary[stageName] = { name: stageName, current: 0, total: 0 };
      }
      summary[stageName].current += measuredValue;
      summary[stageName].total += totalValue;
    });

    return Object.values(summary).map(s => ({
      ...s,
      percentage: totalCurrentValue > 0 ? (s.current / totalCurrentValue) * 100 : 0
    })).sort((a, b) => b.current - a.current);
  }, [selectedMeasurement, selectedContract, projects, measurements]);

  const handleStartNewContract = (mode: 'contract' | 'payroll' = 'contract') => {
    const prefix = mode === 'contract' ? 'CT-' : 'FP-';
    const lastContract = contracts
      .filter(c => c.number.startsWith(prefix))
      .sort((a, b) => b.number.localeCompare(a.number))[0];
    
    let nextNum = 1;
    if (lastContract) {
      const numPart = lastContract.number.split('-')[1];
      nextNum = parseInt(numPart) + 1;
    }
    
    const formattedNumber = `${prefix}${nextNum.toString().padStart(4, '0')}`;
    
    setNewContract({
      number: formattedNumber,
      supplierName: mode === 'payroll' ? 'Folha de Pagamento' : '',
      items: []
    });
    setIsPayrollMode(mode === 'payroll');
    setView('new-contract');
  };

  const handleEditContract = (c: Contract) => {
    setNewContract(c);
    setIsPayrollMode(c.number.startsWith('FP-'));
    setView('new-contract');
  };

  const handleCreateContract = () => {
    if (!newContract.number || !newContract.companyId || !newContract.projectId || !newContract.supplierName) {
      onFeedback?.('error', "Preencha os campos obrigatórios do contrato.");
      return;
    }
    const contract: Contract = {
      ...newContract as Contract,
      id: newContract.id || generateId(),
      items: newContract.items || [],
      createdAt: newContract.createdAt || Date.now()
    };
    onSaveContract(contract);
    setNewContract({ items: [] });
    setView('contracts');
  };

  const handleAddItemToContract = () => {
    const nextItemNumber = (newContract.items?.length || 0) + 1;
    const newItem: ContractItem = {
      id: generateId(),
      itemNumber: nextItemNumber.toString(),
      description: '',
      servicePath: '',
      unit: '',
      quantity: 0,
      unitValue: 0
    };
    setNewContract(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const handleUpdateContractItem = (id: string, field: keyof ContractItem, value: any) => {
    setNewContract(prev => ({
      ...prev,
      items: prev.items?.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const handleStartNewMeasurement = () => {
    if (!selectedContract) return;
    
    setSelectedMeasurementId(null);
    const nextNumber = (contractMeasurements.length > 0 ? Math.max(...contractMeasurements.map(m => m.measurementNumber)) : 0) + 1;
    
    const items: MeasurementItem[] = selectedContract.items.map(item => ({
      contractItemId: item.id,
      measuredQuantity: 0
    }));
    
    setNewMeasurementItems(items);
    setMeasurementDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setMeasurementObs('');
    setView('new-measurement');
  };

  const handleSaveMeasurement = () => {
    if (!selectedContractId) return;
    
    const isEditing = !!selectedMeasurementId && view === 'new-measurement';
    const nextNumber = (contractMeasurements.length > 0 ? Math.max(...contractMeasurements.map(m => m.measurementNumber)) : 0) + 1;
    
    const measurement: ContractMeasurement = {
      id: isEditing ? selectedMeasurementId! : generateId(),
      contractId: selectedContractId,
      measurementNumber: isEditing ? selectedMeasurement?.measurementNumber || 1 : nextNumber,
      date: measurementDate,
      startDate: searchStartDate,
      endDate: searchEndDate,
      dueDate: dueDate,
      items: newMeasurementItems,
      observations: measurementObs,
      status: 'completed',
      createdAt: isEditing ? selectedMeasurement?.createdAt || Date.now() : Date.now()
    };
    
    onSaveMeasurement(measurement);
    setSelectedMeasurementId(measurement.id);
    setView('measurement-summary');
  };

  const handleSearchLabor = () => {
    if (!selectedContract) return;

    const start = new Date(searchStartDate).getTime();
    const end = new Date(searchEndDate).getTime();

    // Filter trackings for this project and date range
    const filteredTrackings = laborTracking.filter(t => {
      const tDate = new Date(t.date).getTime();
      return t.projectId === selectedContract.projectId && tDate >= start && tDate <= end;
    });

    const items: MeasurementItem[] = [];

    selectedContract.items.forEach(contractItem => {
      // In payroll mode, description is the employee name
      const employee = employees.find(e => e.name === contractItem.description);
      if (!employee) return;

      const employeeTrackings = filteredTrackings.filter(t => t.employeeId === employee.id);
      
      // Group by service
      const serviceGroups: { [key: string]: { dates: Set<string>, components: Set<string> } } = {};

      employeeTrackings.forEach(t => {
        const services = t.costStructureSelections || [];
        services.forEach(s => {
          if (!serviceGroups[s]) {
            serviceGroups[s] = { dates: new Set(), components: new Set() };
          }
          serviceGroups[s].dates.add(t.date);
          t.selections.forEach(c => serviceGroups[s].components.add(c));
        });
      });

      Object.entries(serviceGroups).forEach(([servicePath, data]) => {
        const daysWorked = data.dates.size;
        const productivity = daysWorked > 0 ? data.components.size / daysWorked : 0;

        items.push({
          contractItemId: contractItem.id,
          measuredQuantity: daysWorked,
          servicePath,
          productivity
        });
      });
    });

    if (items.length === 0) {
      if (onFeedback) onFeedback('error', "Nenhum registro de trabalho encontrado para os colaboradores deste contrato no período selecionado.");
    } else {
      setNewMeasurementItems(items);
      if (onFeedback) onFeedback('success', `${items.length} linhas de medição geradas com base nos apontamentos.`);
    }
  };
  const handleEditMeasurement = (m: ContractMeasurement) => {
    const isLast = contractMeasurements.length > 0 && m.id === contractMeasurements[0].id;
    if (!isLast) {
      if (onFeedback) onFeedback('error', "Apenas a última medição pode ser alterada.");
      return;
    }
    setNewMeasurementItems(m.items);
    setMeasurementDate(m.date);
    setSearchStartDate(m.startDate || '');
    setSearchEndDate(m.endDate || '');
    setDueDate(m.dueDate || '');
    setMeasurementObs(m.observations || '');
    setSelectedMeasurementId(m.id);
    setView('new-measurement');
  };

  const generatePDF = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { 
      scale: 2,
      useCORS: true
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Medicao_${selectedContract?.number}_M${selectedMeasurement?.measurementNumber}.pdf`);
  };

  const generateXLSX = () => {
    if (!selectedContract || !selectedMeasurement) return;

    const data = selectedMeasurement.items.map(mItem => {
      const item = selectedContract.items.find(i => i.id === mItem.contractItemId);
      if (!item) return null;

      const measured = mItem.measuredQuantity || 0;
      const accumPrev = getAccumulatedQuantity(item.id, selectedMeasurement.measurementNumber, mItem.servicePath);
      const accumTotal = accumPrev + measured;
      
      const valUnit = item.unitValue;
      const valAccumPrev = accumPrev * valUnit;
      const valMedido = measured * valUnit;
      const valAccumTotal = accumTotal * valUnit;

      const serviceName = (() => {
        const path = mItem.servicePath || item.servicePath;
        if (!path) return '-';
        const [ccId, stId, ssId, svId] = path.split('|');
        const project = projects.find(p => p.id === selectedContract.projectId);
        const cc = project?.costStructure?.find(c => c.id === ccId);
        const st = cc?.stages.find(s => s.id === stId);
        const ss = st?.subStages.find(s => s.id === ssId);
        const sv = ss?.services.find(s => s.id === svId);
        return sv?.name || '-';
      })();

      return {
        'ITEM': item.itemNumber,
        'DESCRIÇÃO DO ITEM': item.description,
        'SERVIÇO': serviceName,
        'UN.': item.unit,
        'QT. CONT.': item.quantity,
        'QT. AC. ANT.': accumPrev,
        'QT. MEDIDO': measured,
        'PRODUTIVIDADE': mItem.productivity?.toFixed(2) || '0.00',
        'QT. AC. ATUAL': accumTotal,
        'V. UNIT.': valUnit,
        'V. AC. ANT.': valAccumPrev,
        'V. MEDIDO': valMedido,
        'V. AC. TOTAL': valAccumTotal
      };
    }).filter(Boolean) as any[];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Medição");

    // Add metadata info at the top (optional but good)
    const info = [
      ["CONTRATO:", selectedContract.number],
      ["FORNECEDOR:", selectedContract.supplierName],
      ["OBRA:", projects.find(p => p.id === selectedContract.projectId)?.name || ''],
      ["MEDIÇÃO N°:", `${selectedContract.number} - ${selectedMeasurement.measurementNumber.toString().padStart(3, '0')}`],
      ["DATA:", new Date(selectedMeasurement.date).toLocaleDateString('pt-BR')],
      [] // Empty row
    ];
    XLSX.utils.sheet_add_aoa(worksheet, info, { origin: "A1" });
    
    // Shift the table data down to make room for info
    const finalData: any[][] = [
      ["RELATÓRIO DE MEDIÇÃO"],
      ["CONTRATO:", selectedContract.number],
      ["FORNECEDOR:", selectedContract.supplierName],
      ["OBRA:", projects.find(p => p.id === selectedContract.projectId)?.name || ''],
      ["MEDIÇÃO N°:", `${selectedContract.number} - ${selectedMeasurement.measurementNumber.toString().padStart(3, '0')}`],
      ["DATA:", new Date(selectedMeasurement.date).toLocaleDateString('pt-BR')],
      ["PERÍODO:", selectedMeasurement.startDate && selectedMeasurement.endDate ? `${new Date(selectedMeasurement.startDate).toLocaleDateString('pt-BR')} - ${new Date(selectedMeasurement.endDate).toLocaleDateString('pt-BR')}` : 'N/A'],
      ["VENCIMENTO:", selectedMeasurement.dueDate ? new Date(selectedMeasurement.dueDate).toLocaleDateString('pt-BR') : 'N/A'],
      [],
      ["ITEM", "DESCRIÇÃO DO ITEM", "SERVIÇO", "UN.", "QT. CONT.", "QT. AC. ANT.", "QT. MEDIDO", "PRODUTIVIDADE", "QT. AC. ATUAL", "V. UNIT.", "V. AC. ANT.", "V. MEDIDO", "V. AC. TOTAL"]
    ];

    data.forEach(row => {
      finalData.push([
        row['ITEM'],
        row['DESCRIÇÃO DO ITEM'],
        row['SERVIÇO'],
        row['UN.'],
        row['QT. CONT.'],
        row['QT. AC. ANT.'],
        row['QT. MEDIDO'],
        row['PRODUTIVIDADE'],
        row['QT. AC. ATUAL'],
        row['V. UNIT.'],
        row['V. AC. ANT.'],
        row['V. MEDIDO'],
        row['V. AC. TOTAL']
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Medição");
    
    XLSX.writeFile(wb, `Medicao_${selectedContract.number}_M${selectedMeasurement.measurementNumber}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView('contracts')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${view === 'contracts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Contratos
          </button>
          {selectedContractId && (
            <button 
              onClick={() => setView('contract-details')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${view === 'contract-details' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Medições: {selectedContract?.number}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {view === 'contracts' && (
            <>
              <button 
                onClick={() => handleStartNewContract('payroll')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <i className="fas fa-plus"></i> Nova Folha de Pagamento
              </button>
              <button 
                onClick={() => handleStartNewContract('contract')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <i className="fas fa-plus"></i> Novo Contrato
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contracts List View */}
      {view === 'contracts' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empresa</label>
              <input 
                type="text" 
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                placeholder="Filtrar por empresa..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Obra</label>
              <input 
                type="text" 
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                placeholder="Filtrar por obra..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor</label>
              <input 
                type="text" 
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                placeholder="Filtrar por fornecedor..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">N° Contrato</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Empresa / Obra</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Fornecedor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Itens</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContracts.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => {
                    setSelectedContractId(c.id);
                    setView('contract-details');
                  }}>
                    <td className="px-6 py-4 font-bold text-slate-700">{c.number}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">{companies.find(comp => comp.id === c.companyId)?.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase">{projects.find(p => p.id === c.projectId)?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.supplierName.toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.items.length} itens</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContractId(c.id);
                            setView('contract-details');
                          }}
                          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-all"
                          title="Ver Medições"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditContract(c);
                          }}
                          className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition-all"
                          title="Editar Contrato"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const hasMeasurements = measurements.some(m => m.contractId === c.id);
                            if (hasMeasurements) {
                              if (onFeedback) onFeedback('error', "Um contrato só pode ser excluído se todas as medições forem removidas primeiro.");
                              return;
                            }
                            if (onConfirm) {
                              onConfirm(
                                "Confirmar Exclusão",
                                "Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.",
                                () => onDeleteContract(c.id)
                              );
                            }
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            !measurements.some(m => m.contractId === c.id)
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                              : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                          }`}
                          title={!measurements.some(m => m.contractId === c.id) ? "Excluir Contrato" : "Exclua todas as medições antes de excluir o contrato"}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredContracts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum contrato encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Contract View */}
      {view === 'new-contract' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-8 max-w-6xl mx-auto">
          <h3 className="text-xl font-bold text-slate-800 italic">{newContract.id ? 'Editar Contrato' : 'Cadastrar Novo Contrato'}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Número do Contrato</label>
              <input 
                type="text" 
                value={newContract.number || ''}
                onChange={(e) => setNewContract(prev => ({ ...prev, number: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Empresa</label>
              <select 
                value={newContract.companyId || ''}
                onChange={(e) => setNewContract(prev => ({ ...prev, companyId: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Obra</label>
              <select 
                value={newContract.projectId || ''}
                onChange={(e) => setNewContract(prev => ({ ...prev, projectId: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Fornecedor</label>
              {isPayrollMode ? (
                <input 
                  type="text" 
                  value="Folha de Pagamento"
                  readOnly
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 font-medium"
                />
              ) : (
                <select 
                  value={newContract.supplierName || ''}
                  onChange={(e) => setNewContract(prev => ({ ...prev, supplierName: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione</option>
                  {(() => {
                    const selectedProject = projects.find(p => p.id === newContract.projectId)?.name || '';
                    return suppliers
                      .filter(s => !selectedProject || !s.projects || s.projects.length === 0 || s.projects.includes(selectedProject))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(s => (
                        <option key={s.id} value={s.name}>{s.name.toUpperCase()}</option>
                      ));
                  })()}
                </select>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Itens do Contrato</h4>
              <button 
                onClick={handleAddItemToContract}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
              >
                + Adicionar Item
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                    <th className="px-3 py-2 w-16">N° Item</th>
                    <th className="px-3 py-2">Descrição</th>
                    {!isPayrollMode && <th className="px-3 py-2">Serviço (Estrutura de Custo)</th>}
                    <th className="px-3 py-2 w-20">Unid.</th>
                    <th className="px-3 py-2 w-24">Quant.</th>
                    <th className="px-3 py-2 w-32">V. Unitário</th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {newContract.items?.map((item, idx) => {
                    const selectedProject = projects.find(p => p.id === newContract.projectId);
                    const costStructure = selectedProject?.costStructure || [];

                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <input 
                            type="text" 
                            readOnly
                            value={item.itemNumber}
                            className="w-full px-2 py-1 bg-slate-100 border border-slate-100 rounded text-xs font-bold text-center"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {isPayrollMode ? (
                            <select 
                              value={item.description}
                              onChange={(e) => handleUpdateContractItem(item.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">Selecione o Colaborador</option>
                              {employees.sort((a, b) => a.name.localeCompare(b.name)).map(emp => (
                                <option key={emp.id} value={emp.name}>{emp.name.toUpperCase()}</option>
                              ))}
                            </select>
                          ) : (
                            <input 
                              type="text" 
                              value={item.description}
                              onChange={(e) => handleUpdateContractItem(item.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                              placeholder="Ex: Alvenaria de vedação"
                            />
                          )}
                        </td>
                        {!isPayrollMode && (
                          <td className="px-3 py-2">
                            <select 
                              value={item.servicePath}
                              onChange={(e) => handleUpdateContractItem(item.id, 'servicePath', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">Selecione o Serviço</option>
                              {costStructure.map(cc => 
                                cc.stages.map(st => 
                                  st.subStages.map(ss => 
                                    ss.services.map(sv => (
                                      <option key={`${cc.id}|${st.id}|${ss.id}|${sv.id}`} value={`${cc.id}|${st.id}|${ss.id}|${sv.id}`}>
                                        {cc.name} &gt; {st.name} &gt; {ss.name} &gt; {sv.name}
                                      </option>
                                    ))
                                  )
                                )
                              )}
                            </select>
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <input 
                            type="text" 
                            value={item.unit}
                            onChange={(e) => handleUpdateContractItem(item.id, 'unit', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                            placeholder="m2, un, etc"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="number" 
                            value={item.quantity}
                            onChange={(e) => handleUpdateContractItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            type="number" 
                            value={item.unitValue}
                            onChange={(e) => handleUpdateContractItem(item.id, 'unitValue', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button 
                            onClick={() => setNewContract(prev => ({ ...prev, items: prev.items?.filter(i => i.id !== item.id) }))}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button onClick={() => setView('contracts')} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">Cancelar</button>
            <button onClick={handleCreateContract} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">
              {newContract.id ? 'Salvar Alterações' : 'Salvar Contrato'}
            </button>
          </div>
        </div>
      )}

      {/* Contract Details / Measurements List */}
      {view === 'contract-details' && selectedContract && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Contrato: {selectedContract.number}</h3>
              <p className="text-sm text-slate-500">{selectedContract.supplierName} | {projects.find(p => p.id === selectedContract.projectId)?.name}</p>
            </div>
            <button 
              onClick={handleStartNewMeasurement}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
            >
              <i className="fas fa-plus"></i> Nova Medição
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">N° Medição</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contractMeasurements.map((m, index) => {
                  const isLastMeasurement = index === 0; // contractMeasurements is sorted desc by measurementNumber
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {selectedContract.number} - {m.measurementNumber.toString().padStart(3, '0')}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(m.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${m.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {m.status === 'completed' ? 'Finalizada' : 'Rascunho'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMeasurementId(m.id);
                              setView('measurement-summary');
                            }}
                            className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-all"
                            title="Visualizar"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isLastMeasurement) {
                                if (onFeedback) onFeedback('error', "Apenas a última medição pode ser alterada.");
                                return;
                              }
                              handleEditMeasurement(m);
                            }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              isLastMeasurement 
                                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                                : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                            }`}
                            title={isLastMeasurement ? "Editar" : "Apenas a última medição pode ser alterada"}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isLastMeasurement) {
                                if (onFeedback) onFeedback('error', "Apenas a última medição pode ser excluída.");
                                return;
                              }
                              if (onConfirm) {
                                onConfirm(
                                  "Confirmar Exclusão",
                                  "Tem certeza que deseja excluir esta medição? Esta ação não pode ser desfeita.",
                                  () => onDeleteMeasurement(m.id)
                                );
                              }
                            }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              isLastMeasurement 
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                                : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                            }`}
                            title={isLastMeasurement ? "Excluir" : "Apenas a última medição pode ser excluída"}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {contractMeasurements.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Nenhuma medição realizada para este contrato.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Measurement View */}
      {view === 'new-measurement' && selectedContract && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-8 max-w-full mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <h3 className="text-xl font-bold text-slate-800 italic">Nova Medição - {selectedContract.number}</h3>
            
            <div className="flex flex-wrap items-end gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data da Medição</label>
                <input 
                  type="date" 
                  value={measurementDate}
                  onChange={(e) => setMeasurementDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Vencimento</label>
                <input 
                  type="date" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Início Período</label>
                <input 
                  type="date" 
                  value={searchStartDate}
                  onChange={(e) => setSearchStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fim Período</label>
                <input 
                  type="date" 
                  value={searchEndDate}
                  onChange={(e) => setSearchEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button 
                onClick={handleSearchLabor}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-2"
              >
                <i className="fas fa-search"></i> Buscar Apontamentos
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase">
                  <th className="px-2 py-3 w-12">N° Item</th>
                  <th className="px-2 py-3">Colaborador / Descrição</th>
                  <th className="px-2 py-3">Serviço</th>
                  <th className="px-2 py-3 w-12">Unid.</th>
                  <th className="px-2 py-3 w-20 text-center">Quant. Contrato</th>
                  <th className="px-2 py-3 w-20 text-center">Quant. Acum. Ant.</th>
                  <th className="px-2 py-3 w-24 text-center bg-indigo-50 text-indigo-700">Quant. Medido</th>
                  <th className="px-2 py-3 w-20 text-center">Produtividade</th>
                  <th className="px-2 py-3 w-20 text-center">Quant. Acum. Atual</th>
                  <th className="px-2 py-3 w-24 text-center">V. Unitário</th>
                  <th className="px-2 py-3 w-24 text-center">V. Acum. Ant.</th>
                  <th className="px-2 py-3 w-24 text-center">V. Medido</th>
                  <th className="px-2 py-3 w-24 text-center">V. Acum. Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {newMeasurementItems.map((mItem, idx) => {
                  const item = selectedContract.items.find(i => i.id === mItem.contractItemId);
                  if (!item) return null;

                  const nextNumber = (contractMeasurements.length > 0 ? Math.max(...contractMeasurements.map(m => m.measurementNumber)) : 0) + 1;
                  const accumPrev = getAccumulatedQuantity(item.id, nextNumber, mItem.servicePath);
                  const measured = mItem.measuredQuantity || 0;
                  const accumTotal = accumPrev + measured;
                  
                  const valUnit = item.unitValue;
                  const valAccumPrev = accumPrev * valUnit;
                  const valMedido = measured * valUnit;
                  const valAccumTotal = accumTotal * valUnit;

                  const serviceName = (() => {
                    const path = mItem.servicePath || item.servicePath;
                    if (!path) return '-';
                    const [ccId, stId, ssId, svId] = path.split('|');
                    const project = projects.find(p => p.id === selectedContract.projectId);
                    const cc = project?.costStructure?.find(c => c.id === ccId);
                    const st = cc?.stages.find(s => s.id === stId);
                    const ss = st?.subStages.find(s => s.id === ssId);
                    const sv = ss?.services.find(s => s.id === svId);
                    return sv?.name || '-';
                  })();

                  return (
                    <tr key={`${mItem.contractItemId}-${idx}`} className="text-[11px]">
                      <td className="px-2 py-3 text-center font-medium">{item.itemNumber}</td>
                      <td className="px-2 py-3 font-medium text-slate-700">{item.description}</td>
                      <td className="px-2 py-3 text-slate-500 text-[9px]">{serviceName}</td>
                      <td className="px-2 py-3 text-center">{item.unit}</td>
                      <td className="px-2 py-3 text-center font-bold">{item.quantity}</td>
                      <td className="px-2 py-3 text-center text-slate-400">{accumPrev}</td>
                      <td className="px-2 py-3 bg-indigo-50/30">
                        <input 
                          type="number" 
                          value={measured}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setNewMeasurementItems(prev => prev.map((mi, i) => i === idx ? { ...mi, measuredQuantity: val } : mi));
                          }}
                          className="w-full px-2 py-1 bg-white border border-indigo-200 rounded text-center font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-amber-600">
                        {mItem.productivity?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-slate-700">{accumTotal}</td>
                      <td className="px-2 py-3 text-center">R$ {valUnit.toLocaleString()}</td>
                      <td className="px-2 py-3 text-center text-slate-400">R$ {valAccumPrev.toLocaleString()}</td>
                      <td className="px-2 py-3 text-center font-bold text-emerald-600">R$ {valMedido.toLocaleString()}</td>
                      <td className="px-2 py-3 text-center font-bold text-slate-800">R$ {valAccumTotal.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 italic">Observações</label>
            <textarea 
              value={measurementObs}
              onChange={(e) => setMeasurementObs(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
              placeholder="Adicione observações sobre esta medição..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button onClick={() => setView('contract-details')} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">Cancelar</button>
            <button onClick={handleSaveMeasurement} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-100">Finalizar Medição</button>
          </div>
        </div>
      )}

      {/* Measurement Summary / PDF View */}
      {view === 'measurement-summary' && selectedMeasurement && selectedContract && (
        <div className="space-y-8 max-w-7xl mx-auto">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                <i className="fas fa-check-circle text-2xl"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Medição Finalizada</h3>
                <p className="text-slate-500 text-sm">Contrato: {selectedContract.number} | Medição: {selectedMeasurement.measurementNumber}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setView('contract-details')} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition">Voltar</button>
              <button onClick={generateXLSX} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 flex items-center gap-2">
                <i className="fas fa-file-excel"></i> Gerar Excel
              </button>
              <button onClick={generatePDF} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2">
                <i className="fas fa-file-pdf"></i> Gerar PDF
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 overflow-x-auto">
            <div ref={printRef} className="bg-white w-[297mm] min-h-[210mm] p-[10mm] mx-auto text-black font-sans" style={{ fontSize: '8px' }}>
              {/* Header */}
              <div className="border border-black flex h-16">
                <div className="w-1/4 border-r border-black flex items-center justify-center p-2">
                  <div className="relative flex items-center justify-center">
                    <img 
                      src="https://images.weserv.nl/?url=https://hmtower.com.br/wp-content/uploads/2021/07/logo-hmtower.png" 
                      alt="HM TOWER" 
                      width="150"
                      height="50"
                      className="h-12 object-contain relative z-10"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="hidden absolute inset-0 flex-col items-center justify-center" style={{ display: 'none' }}>
                      <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white text-[8px] font-bold">HM</div>
                      <span className="font-bold text-[10px]">HMTOWER</span>
                    </div>
                  </div>
                </div>
                <div className="w-1/2 border-r border-black flex flex-col items-center justify-center font-bold text-[11px]">
                  HM TOWER ENGENHARIA E CONSTRUÇÕES
                </div>
                <div className="w-1/4 flex flex-col items-center justify-center font-bold text-[12px]">
                  MEDIÇÃO DE CONTRATO
                </div>
              </div>

              {/* Metadata */}
              <div className="border-x border-b border-black flex h-12">
                <div className="w-1/4 border-r border-black p-1">
                  <div className="font-bold text-[7px] uppercase">CONTRATO:</div>
                  <div className="text-[9px] font-bold">{selectedContract.number}</div>
                </div>
                <div className="w-1/4 border-r border-black p-1">
                  <div className="font-bold text-[7px] uppercase">FORNECEDOR:</div>
                  <div className="text-[9px] truncate">{selectedContract.supplierName}</div>
                </div>
                <div className="w-1/4 border-r border-black p-1">
                  <div className="font-bold text-[7px] uppercase">OBRA:</div>
                  <div className="text-[9px] truncate">{projects.find(p => p.id === selectedContract.projectId)?.name}</div>
                </div>
                <div className="w-1/4 p-1 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <span className="font-bold text-[7px] uppercase">MEDIÇÃO N°:</span>
                    <span className="font-bold">{selectedContract.number} - {selectedMeasurement.measurementNumber.toString().padStart(3, '0')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-[7px] uppercase">DATA:</span>
                    <span>{new Date(selectedMeasurement.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {selectedMeasurement.startDate && selectedMeasurement.endDate && (
                    <div className="flex justify-between">
                      <span className="font-bold text-[7px] uppercase">PERÍODO:</span>
                      <span className="text-[7px]">{new Date(selectedMeasurement.startDate).toLocaleDateString('pt-BR')} - {new Date(selectedMeasurement.endDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Table */}
              <table className="w-full border-collapse border-x border-black">
                <thead>
                  <tr className="bg-slate-100 border-b border-black text-[6px] font-bold uppercase">
                    <th className="border-r border-black px-1 py-1 w-[30px] text-center">ITEM</th>
                    <th className="border-r border-black px-1 py-1 w-[180px] text-left">DESCRIÇÃO DO ITEM</th>
                    <th className="border-r border-black px-1 py-1 w-[180px] text-center">SERVIÇO</th>
                    <th className="border-r border-black px-1 py-1 w-[25px] text-center">UN.</th>
                    <th className="border-r border-black px-1 py-1 w-[45px] text-center">QT. CONT.</th>
                    <th className="border-r border-black px-1 py-1 w-[45px] text-center">QT. AC. ANT.</th>
                    <th className="border-r border-black px-1 py-1 w-[45px] text-center">QT. MEDIDO</th>
                    <th className="border-r border-black px-1 py-1 w-[45px] text-center">PROD.</th>
                    <th className="border-r border-black px-1 py-1 w-[45px] text-center">QT. AC. ATUAL</th>
                    <th className="border-r border-black px-1 py-1 w-[65px] text-center">V. UNIT.</th>
                    <th className="border-r border-black px-1 py-1 w-[65px] text-center">V. AC. ANT.</th>
                    <th className="border-r border-black px-1 py-1 w-[65px] text-center">V. MEDIDO</th>
                    <th className="px-1 py-1 w-[65px] text-center">V. AC. TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMeasurement.items.map((mItem, idx) => {
                    const item = selectedContract.items.find(i => i.id === mItem.contractItemId);
                    if (!item) return null;

                    const measured = mItem.measuredQuantity || 0;
                    const accumPrev = getAccumulatedQuantity(item.id, selectedMeasurement.measurementNumber, mItem.servicePath);
                    const accumTotal = accumPrev + measured;
                    
                    const valUnit = item.unitValue;
                    const valAccumPrev = accumPrev * valUnit;
                    const valMedido = measured * valUnit;
                    const valAccumTotal = accumTotal * valUnit;

                    const serviceName = (() => {
                      const path = mItem.servicePath || item.servicePath;
                      if (!path) return '-';
                      const [ccId, stId, ssId, svId] = path.split('|');
                      const project = projects.find(p => p.id === selectedContract.projectId);
                      const cc = project?.costStructure?.find(c => c.id === ccId);
                      const st = cc?.stages.find(s => s.id === stId);
                      const ss = st?.subStages.find(s => s.id === ssId);
                      const sv = ss?.services.find(s => s.id === svId);
                      return sv?.name || '-';
                    })();

                    return (
                      <tr key={`${mItem.contractItemId}-${idx}`} className="border-b border-black">
                        <td className="border-r border-black text-center px-1 py-1 w-[30px]">{item.itemNumber}</td>
                        <td className="border-r border-black px-1 py-1 w-[180px] break-words whitespace-normal leading-tight">{item.description}</td>
                        <td className="border-r border-black text-center px-1 py-1 text-[6px] break-words whitespace-normal leading-tight w-[180px]">{serviceName}</td>
                        <td className="border-r border-black text-center py-1 w-[25px]">{item.unit}</td>
                        <td className="border-r border-black text-center py-1 font-bold w-[45px]">{item.quantity}</td>
                        <td className="border-r border-black text-center py-1 w-[45px]">{accumPrev}</td>
                        <td className="border-r border-black text-center py-1 font-bold w-[45px]">{measured}</td>
                        <td className="border-r border-black text-center py-1 w-[45px]">{mItem.productivity?.toFixed(2) || '0.00'}</td>
                        <td className="border-r border-black text-center py-1 font-bold w-[45px]">{accumTotal}</td>
                        <td className="border-r border-black text-center py-1 w-[65px]">R$ {valUnit.toLocaleString()}</td>
                        <td className="border-r border-black text-center py-1 w-[65px]">R$ {valAccumPrev.toLocaleString()}</td>
                        <td className="border-r border-black text-center py-1 font-bold w-[65px]">R$ {valMedido.toLocaleString()}</td>
                        <td className="text-center py-1 font-bold w-[65px]">R$ {valAccumTotal.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 15 - selectedMeasurement.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-black h-5">
                      <td className="border-r border-black w-[30px]"></td>
                      <td className="border-r border-black w-[180px]"></td>
                      <td className="border-r border-black w-[180px]"></td>
                      <td className="border-r border-black w-[25px]"></td>
                      <td className="border-r border-black w-[45px]"></td>
                      <td className="border-r border-black w-[45px]"></td>
                      <td className="border-r border-black w-[45px]"></td>
                      <td className="border-r border-black w-[45px]"></td>
                      <td className="border-r border-black w-[45px]"></td>
                      <td className="border-r border-black w-[65px]"></td>
                      <td className="border-r border-black w-[65px]"></td>
                      <td className="border-r border-black w-[65px]"></td>
                      <td className="w-[65px]"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Stage Summary */}
              <div className="mt-4 border border-black">
                <div className="bg-slate-100 border-b border-black px-2 py-1 font-bold text-[7px] uppercase">Resumo por Etapa</div>
                <table className="w-full text-[6px]">
                  <thead>
                    <tr className="border-b border-black font-bold uppercase">
                      <th className="border-r border-black px-2 py-1 text-left">Etapa</th>
                      <th className="border-r border-black px-2 py-1 text-center w-24">V. Medido (Atual)</th>
                      <th className="border-r border-black px-2 py-1 text-center w-24">% Medição</th>
                      <th className="px-2 py-1 text-center w-24">V. Acumulado Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageSummary.map((s, i) => (
                      <tr key={i} className="border-b border-black last:border-0">
                        <td className="border-r border-black px-2 py-1 font-bold">{s.name}</td>
                        <td className="border-r border-black px-2 py-1 text-center">R$ {s.current.toLocaleString()}</td>
                        <td className="border-r border-black px-2 py-1 text-center">{s.percentage.toFixed(2)}%</td>
                        <td className="px-2 py-1 text-center font-bold">R$ {s.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="border-x border-b border-black flex h-20">
                <div className="w-2/3 border-r border-black p-2 flex flex-col">
                  <div className="font-bold text-[7px] uppercase mb-1">Observações:</div>
                  <div className="text-[8px] flex-1 italic">{selectedMeasurement.observations || 'Nenhuma observação.'}</div>
                </div>
                <div className="w-1/3 flex flex-col">
                  <div className="flex-1 flex border-b border-black">
                    <div className="w-1/2 border-r border-black flex items-center justify-center font-bold text-[7px] uppercase">Total da Medição</div>
                    <div className="w-1/2 flex items-center justify-center font-bold text-[10px]">
                      R$ {selectedMeasurement.items.reduce((acc, mi) => {
                        const item = selectedContract.items.find(i => i.id === mi.contractItemId);
                        return acc + (mi.measuredQuantity * (item?.unitValue || 0));
                      }, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex-1 flex border-b border-black">
                    <div className="w-1/2 border-r border-black flex items-center justify-center font-bold text-[7px] uppercase">Total Acumulado</div>
                    <div className="w-1/2 flex items-center justify-center font-bold text-[10px]">
                      R$ {selectedContract.items.reduce((acc, item) => {
                        const accumTotal = getAccumulatedQuantity(item.id, selectedMeasurement.measurementNumber) + (selectedMeasurement.items.find(mi => mi.contractItemId === item.id)?.measuredQuantity || 0);
                        return acc + (accumTotal * item.unitValue);
                      }, 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col p-1 text-[7px]">
                    <div className="font-bold uppercase text-[6px] mb-0.5">Informações de Pagamento:</div>
                    <div className="flex justify-between leading-tight">
                      <span>Vencimento:</span>
                      <span className="font-bold">{selectedMeasurement.dueDate ? new Date(selectedMeasurement.dueDate).toLocaleDateString('pt-BR') : '___/___/______'}</span>
                    </div>
                    {(() => {
                      const supplier = suppliers.find(s => s.name === selectedContract.supplierName);
                      if (!supplier) return null;
                      return (
                        <div className="mt-0.5 text-[6px] leading-tight">
                          <div>PIX ({supplier.bankInfo.pixType || 'Chave'}): <span className="font-bold">{supplier.bankInfo.pix}</span></div>
                          <div>Banco: {supplier.bankInfo.bank} | Ag: {supplier.bankInfo.agency} | Cc: {supplier.bankInfo.account}</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="border-x border-b border-black flex h-14">
                <div className="w-1/2 border-r border-black p-2 flex flex-col justify-between">
                  <div className="font-bold text-[8px] uppercase">ASSINATURA FORNECEDOR</div>
                  <div className="flex flex-col items-center">
                    <div className="w-64 border-t border-black text-center text-[7px] mt-4 font-bold">
                      {selectedContract.supplierName}
                    </div>
                    {(() => {
                      const supplier = suppliers.find(s => s.name === selectedContract.supplierName);
                      if (supplier) {
                        return (
                          <div className="text-[6px] text-slate-600">
                            {supplier.type === 'PF' ? `CPF: ${supplier.document}` : `CNPJ: ${supplier.document}`}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="w-1/2 p-2 flex flex-col justify-between">
                  <div className="font-bold text-[8px] uppercase">ASSINATURA FISCALIZAÇÃO</div>
                  <div className="flex justify-between items-end">
                    <div className="w-48 border-t border-black text-center text-[7px] mt-4 font-bold">HM TOWER ENGENHARIA</div>
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
