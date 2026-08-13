
import React, { useState, useMemo } from 'react';
import { Project, ConstructionUnit, Block, Floor, Unit, ServiceExecution, LaborTracking, FVS, Employee, Supplier } from '../types';
import { generateId } from '../src/lib/utils';
import { Camera } from './Camera';
import { compressImage } from '../utils/imageCompressor';

interface PlanningViewProps {
  projects: Project[];
  serviceExecutions: ServiceExecution[];
  onSaveExecution: (execution: ServiceExecution) => void;
  trackings: LaborTracking[];
  employees: Employee[];
  suppliers: Supplier[];
  fvsList: FVS[];
  onFeedback?: (type: 'success' | 'error', msg: string) => void;
}

type PlanningTab = 'diagram' | 'planned' | 'ongoing' | 'completed';

export const PlanningView: React.FC<PlanningViewProps> = ({ projects, serviceExecutions, onSaveExecution, trackings, employees, suppliers, fvsList, onFeedback }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<PlanningTab>('diagram');
  const [selectedUnitForModal, setSelectedUnitForModal] = useState<{ unit: Unit; path: string } | null>(null);
  const [selectedExecutionForFvs, setSelectedExecutionForFvs] = useState<ServiceExecution | null>(null);
  const [selectedExecutionForDetails, setSelectedExecutionForDetails] = useState<ServiceExecution | null>(null);
  const [cameraTarget, setCameraTarget] = useState<{ itemId: string; subItemId: string } | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [editingRealId, setEditingRealId] = useState<string | null>(null);
  const [editStartDateReal, setEditStartDateReal] = useState<string>('');
  const [editEndDateReal, setEditEndDateReal] = useState<string>('');

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const projectExecutions = useMemo(() => 
    serviceExecutions.filter(s => s.projectId === selectedProjectId),
    [serviceExecutions, selectedProjectId]
  );

  const calculateDuration = (start?: string, end?: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays + 1);
  };

  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return '-';
    const isoPart = dateStr.split('T')[0];
    const parts = isoPart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getRealStartDate = (servicePath: string, componentPath: string) => {
    const relevantTrackings = trackings.filter(t => 
      t.projectId === selectedProjectId &&
      t.costStructureSelections?.includes(servicePath) &&
      t.selections?.some(unitPath => unitPath.startsWith(componentPath))
    );
    if (relevantTrackings.length === 0) return undefined;
    const dates = relevantTrackings.map(t => new Date(t.date).getTime());
    return new Date(Math.min(...dates)).toISOString().split('T')[0];
  };

  const getComponentName = (project: Project, path: string) => {
    const parts = path.split('|');
    const cu = project.constructionUnits.find(u => u.id === parts[0]);
    if (!cu) return path;
    if (parts.length === 1) return cu.name;
    
    const block = cu.blocks.find(b => b.id === parts[1]);
    if (!block) return cu.name;
    if (parts.length === 2) return `${cu.name} > ${block.name}`;
    
    const floor = block.floors.find(f => f.id === parts[2]);
    if (!floor) return `${cu.name} > ${block.name}`;
    if (parts.length === 3) return `${cu.name} > ${block.name} > ${floor.name}`;
    
    const unit = floor.units.find(u => u.id === parts[3]);
    if (!unit) return `${cu.name} > ${block.name} > ${floor.name}`;
    return `${cu.name} > ${block.name} > ${floor.name} > ${unit.name}`;
  };

  const getAllServices = (project: Project) => {
    const services: { path: string; name: string; stage: string; linkedLevel?: string; isControlled: boolean; fvsId?: string }[] = [];
    project.costStructure?.forEach(cc => {
      cc.stages.forEach(s => {
        s.subStages.forEach(ss => {
          ss.services.forEach(sv => {
            const servicePath = `${cc.id}|${s.id}|${ss.id}|${sv.id}`;
            const fvsId = project.fvsMapping?.[servicePath];
            const fvs = fvsList.find(f => f.id === fvsId);
            
            services.push({
              path: servicePath,
              name: sv.name,
              stage: `${cc.name} > ${s.name} > ${ss.name}`,
              linkedLevel: sv.linkedLevel,
              isControlled: !!fvs,
              fvsId: fvs?.id
            });
          });
        });
      });
    });
    return services;
  };

  const getHierarchyData = (project: Project) => {
    const units: { cu: ConstructionUnit; b: Block; f: Floor; u: Unit; path: string }[] = [];
    project.constructionUnits.forEach(cu => {
      cu.blocks.forEach(b => {
        b.floors.forEach(f => {
          f.units.forEach(u => {
            units.push({ cu, b, f, u, path: `${cu.id}|${b.id}|${f.id}|${u.id}` });
          });
        });
      });
    });
    return units;
  };

  const executionsWithRealDates = useMemo(() => {
    if (!selectedProject) return [];
    const services = getAllServices(selectedProject);
    
    // Pre-calculate tracking min dates to solve performance freeze
    const trackingMinDateMap: { [key: string]: number } = {};
    const projectTrackings = trackings.filter(t => t.projectId === selectedProjectId);

    projectTrackings.forEach(t => {
      const tTime = new Date(t.date).getTime();
      if (isNaN(tTime)) return;
      
      const servicePaths = t.costStructureSelections || [];
      const selections = t.selections || [];

      servicePaths.forEach(s => {
        selections.forEach(sel => {
          const parts = sel.split('|');
          const prefixes: string[] = [];
          for (let i = 1; i <= parts.length; i++) {
            prefixes.push(parts.slice(0, i).join('|'));
          }

          prefixes.forEach(prefix => {
            const key = `${s}#${prefix}`;
            if (!trackingMinDateMap[key] || tTime < trackingMinDateMap[key]) {
              trackingMinDateMap[key] = tTime;
            }
          });
        });
      });
    });

    const executions: ServiceExecution[] = [];

    services.forEach(service => {
      // Find which components this service is linked to
      let linkedIds: string[] = [];
      selectedProject.costStructure?.forEach(cc => {
        cc.stages.forEach(s => {
          s.subStages.forEach(ss => {
            ss.services.forEach(sv => {
              if (`${cc.id}|${s.id}|${ss.id}|${sv.id}` === service.path) {
                linkedIds = sv.linkedComponentIds || [];
              }
            });
          });
        });
      });

      // Map linkedIds to componentPaths
      const componentPaths: string[] = [];
      selectedProject.constructionUnits.forEach(cu => {
        if (service.linkedLevel === 'constructionUnit' && linkedIds.includes(cu.id)) {
          componentPaths.push(cu.id);
        }
        cu.blocks.forEach(b => {
          if (service.linkedLevel === 'block' && linkedIds.includes(b.id)) {
            componentPaths.push(`${cu.id}|${b.id}`);
          }
          b.floors.forEach(f => {
            if (service.linkedLevel === 'floor' && linkedIds.includes(f.id)) {
              componentPaths.push(`${cu.id}|${b.id}|${f.id}`);
            }
            f.units.forEach(u => {
              if ((service.linkedLevel === 'unit' || !service.linkedLevel) && linkedIds.includes(u.id)) {
                componentPaths.push(`${cu.id}|${b.id}|${f.id}|${u.id}`);
              }
            });
          });
        });
      });

      componentPaths.forEach(compPath => {
        const existing = projectExecutions.find(e => e.servicePath === service.path && e.componentPath === compPath);
        
        // Fast Map Lookup instead of nested loop in getRealStartDate
        const lookupKey = `${service.path}#${compPath}`;
        const minTime = trackingMinDateMap[lookupKey];
        const realStart = minTime ? new Date(minTime).toISOString().split('T')[0] : undefined;
        
        executions.push({
          id: existing?.id || generateId(),
          projectId: selectedProjectId,
          servicePath: service.path,
          componentPath: compPath,
          startDatePlanned: existing?.startDatePlanned,
          endDatePlanned: existing?.endDatePlanned,
          startDateReal: existing?.startDateReal || realStart,
          endDateReal: existing?.endDateReal,
          fvsResults: existing?.fvsResults,
          fvsPhotos: existing?.fvsPhotos
        });
      });
    });

    return executions;
  }, [selectedProject, projectExecutions, trackings, selectedProjectId]);

  const countNonConformities = (ex: ServiceExecution) => {
    if (!ex.fvsResults) return 0;
    let count = 0;
    Object.values(ex.fvsResults).forEach(itemResults => {
      Object.values(itemResults).forEach(status => {
        if (status === 'NC') count++;
      });
    });
    return count;
  };

  const getExecutors = (ex: ServiceExecution) => {
    const relevantTrackings = trackings.filter(t => 
      t.projectId === selectedProjectId &&
      t.costStructureSelections?.includes(ex.servicePath) &&
      t.selections?.some(unitPath => unitPath.startsWith(ex.componentPath))
    );

    const executorMap = new Map<string, { name: string; type: string }>();
    
    relevantTrackings.forEach(t => {
      if (!executorMap.has(t.employeeId)) {
        let name = 'Desconhecido';
        if (t.executorType === 'Colaborador') {
          name = (employees.find(e => e.id === t.employeeId)?.name || 'Colaborador não encontrado').toUpperCase();
        } else {
          name = (suppliers.find(s => s.id === t.employeeId)?.name || 'Fornecedor não encontrado').toUpperCase();
        }
        executorMap.set(t.employeeId, { name, type: t.executorType });
      }
    });

    return Array.from(executorMap.values());
  };

  const updateExecution = (execution: ServiceExecution, silent = false) => {
    onSaveExecution(execution);
    if (!silent) {
      onFeedback?.('success', 'Alteração salva com sucesso.');
    }
  };

  const renderDiagram = (project: Project) => (
    <div className="space-y-8">
      {project.constructionUnits.map(cu => (
        <div key={cu.id} className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-indigo-100 pb-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-sm">
              <i className="fas fa-layer-group"></i>
            </div>
            <div>
              <h4 className="font-bold text-slate-800">{cu.name}</h4>
              <p className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider">Unidade Construtiva</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cu.blocks.map(block => (
              <div key={block.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <i className="fas fa-th-large text-indigo-400 text-xs"></i>
                  <span className="font-bold text-slate-700 text-sm">{block.name}</span>
                </div>
                
                <div className="space-y-2">
                  {block.floors.map(floor => (
                    <div key={floor.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <i className="fas fa-align-justify text-slate-400 text-[10px]"></i>
                          <span className="text-xs font-bold text-slate-600">{floor.name}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {floor.units.map(unit => (
                          <button 
                            key={unit.id} 
                            onClick={() => setSelectedUnitForModal({ unit, path: `${cu.id}|${block.id}|${floor.id}|${unit.id}` })}
                            className="bg-white border border-slate-200 px-2 py-1 rounded text-[10px] text-slate-500 font-medium shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all hover:scale-105"
                          >
                            {unit.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderServiceList = (executions: ServiceExecution[], showPlanned: boolean, showReal: boolean) => {
    if (!selectedProject) return null;
    const services = getAllServices(selectedProject);

    return (
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Serviço / Local</th>
              {showPlanned && (
                <>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Início Prev.</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Fim Prev.</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Dur. Prev.</th>
                </>
              )}
              {showReal && (
                <>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Início Real</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Fim Real</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase">Dur. Real</th>
                </>
              )}
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {executions.map(ex => {
              const service = services.find(s => s.path === ex.servicePath);
              if (!service) return null;

              return (
                <tr key={ex.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-800">{service.name}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">
                      {getComponentName(selectedProject, ex.componentPath)}
                    </div>
                  </td>
                  {showPlanned && (
                    <>
                      <td className="px-4 py-4">
                        <input 
                          type="date" 
                          value={ex.startDatePlanned || ''} 
                          onChange={(e) => updateExecution({ ...ex, startDatePlanned: e.target.value })}
                          className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input 
                          type="date" 
                          value={ex.endDatePlanned || ''} 
                          onChange={(e) => updateExecution({ ...ex, endDatePlanned: e.target.value })}
                          className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-600">
                        {calculateDuration(ex.startDatePlanned, ex.endDatePlanned)} dias
                      </td>
                    </>
                  )}
                  {showReal && (
                    <>
                      <td className="px-4 py-4">
                        {editingRealId === ex.id ? (
                          <input 
                            type="date" 
                            value={editStartDateReal} 
                            onChange={(e) => setEditStartDateReal(e.target.value)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          />
                        ) : (
                          <span className="text-xs text-slate-600">{formatDateBR(ex.startDateReal)}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editingRealId === ex.id ? (
                          <input 
                            type="date" 
                            value={editEndDateReal} 
                            onChange={(e) => setEditEndDateReal(e.target.value)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          />
                        ) : (
                          <span className="text-xs text-slate-600">{formatDateBR(ex.endDateReal)}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-600">
                        {editingRealId === ex.id ? (
                          <span>{calculateDuration(editStartDateReal, editEndDateReal)} dias</span>
                        ) : (
                          <span>{calculateDuration(ex.startDateReal, ex.endDateReal)} dias</span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      {editingRealId === ex.id ? (
                        <>
                          <button
                            id={`save-real-btn-${ex.id}`}
                            onClick={() => {
                              updateExecution({
                                ...ex,
                                startDateReal: editStartDateReal || undefined,
                                endDateReal: editEndDateReal || undefined
                              });
                              setEditingRealId(null);
                            }}
                            title="Salvar Alterações"
                            className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-colors"
                          >
                            <i className="fas fa-check"></i>
                          </button>
                          <button
                            id={`cancel-real-btn-${ex.id}`}
                            onClick={() => setEditingRealId(null)}
                            title="Cancelar"
                            className="w-8 h-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center hover:bg-rose-100 transition-colors"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </>
                      ) : (
                        <>
                          {activeTab === 'completed' && (
                            <>
                              {service.isControlled && (
                                <button 
                                  onClick={() => setSelectedExecutionForFvs(ex)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
                                    countNonConformities(ex) > 0 
                                      ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                                      : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                  }`}
                                >
                                  <i className="fas fa-exclamation-triangle mr-1"></i>
                                  {countNonConformities(ex)} NCs
                                </button>
                              )}
                              <button 
                                id={`edit-real-btn-${ex.id}`}
                                onClick={() => {
                                  setEditingRealId(ex.id);
                                  setEditStartDateReal(ex.startDateReal || '');
                                  setEditEndDateReal(ex.endDateReal || '');
                                }}
                                title="Editar Datas Reais"
                                className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center hover:bg-indigo-100 transition-colors"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button 
                                onClick={() => setSelectedExecutionForDetails(ex)}
                                title="Visualizar Detalhes"
                                className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors"
                              >
                                <i className="fas fa-info-circle"></i>
                              </button>
                            </>
                          )}
                          {activeTab === 'ongoing' && (
                            <>
                              {service.isControlled && (
                                <button 
                                  onClick={() => setSelectedExecutionForFvs(ex)}
                                  title="Acessar FVS"
                                  className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center hover:bg-indigo-100 transition-colors"
                                >
                                  <i className="fas fa-clipboard-check"></i>
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  updateExecution({ ...ex, endDateReal: new Date().toISOString().split('T')[0] });
                                  onFeedback?.('success', 'Serviço concluído com sucesso.');
                                }}
                                className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                              >
                                Concluir
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {executions.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-400 italic">
                  Nenhum serviço encontrado nesta categoria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Planejamento de Obras</h2>
          <p className="text-slate-500 text-sm">Gerencie a execução e cronograma dos serviços</p>
        </div>
        
        <div className="w-full md:w-72">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Selecionar Obra</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
          >
            <option value="">Selecione uma obra...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedProject && (
        <div className="flex border-b border-slate-200 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-6 py-3 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === 'diagram' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Diagrama (EAP)
            {activeTab === 'diagram' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
          </button>
          <button
            onClick={() => setActiveTab('planned')}
            className={`px-6 py-3 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === 'planned' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Previsto
            {activeTab === 'planned' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
          </button>
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`px-6 py-3 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === 'ongoing' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Em Andamento
            {activeTab === 'ongoing' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-3 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === 'completed' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Realizado
            {activeTab === 'completed' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full"></div>}
          </button>
        </div>
      )}

      {selectedProject ? (
        <div className="space-y-6">
          {activeTab === 'diagram' && renderDiagram(selectedProject)}
          {activeTab === 'planned' && renderServiceList(executionsWithRealDates.filter(e => !e.startDateReal), true, false)}
          {activeTab === 'ongoing' && renderServiceList(executionsWithRealDates.filter(e => e.startDateReal && !e.endDateReal), true, true)}
          {activeTab === 'completed' && renderServiceList(executionsWithRealDates.filter(e => e.endDateReal), true, true)}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-200 rounded-full flex items-center justify-center text-3xl mx-auto">
            <i className="fas fa-hard-hat"></i>
          </div>
          <div className="max-w-xs mx-auto">
            <h3 className="font-bold text-slate-800">Nenhuma obra selecionada</h3>
            <p className="text-sm text-slate-500">Selecione uma obra acima para gerenciar seu planejamento.</p>
          </div>
        </div>
      )}

      {/* Unit Services Modal */}
      {selectedUnitForModal && selectedProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-door-open"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedUnitForModal.unit.name}</h3>
                  <p className="text-xs text-indigo-100 uppercase font-bold tracking-wider">Serviços da Unidade</p>
                </div>
              </div>
              <button onClick={() => setSelectedUnitForModal(null)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                {executionsWithRealDates
                  .filter(e => selectedUnitForModal.path.startsWith(e.componentPath))
                  .map(ex => {
                    const services = getAllServices(selectedProject);
                    const service = services.find(s => s.path === ex.servicePath);
                    if (!service) return null;

                    return (
                      <div key={ex.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between group hover:border-indigo-200 transition-all">
                        <div>
                          <div className="text-sm font-bold text-slate-800">{service.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{service.stage}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ex.endDateReal ? (
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[9px] font-bold uppercase">Concluído</span>
                          ) : ex.startDateReal ? (
                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[9px] font-bold uppercase">Em Andamento</span>
                          ) : (
                            <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-[9px] font-bold uppercase">Pendente</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {executionsWithRealDates.filter(e => selectedUnitForModal.path.startsWith(e.componentPath)).length === 0 && (
                  <div className="text-center py-12 text-slate-400 italic">
                    Nenhum serviço vinculado a esta unidade.
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setSelectedUnitForModal(null)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* FVS Checklist Modal */}
      {selectedExecutionForFvs && selectedProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-clipboard-check"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Ficha de Verificação de Serviço (FVS)</h3>
                  <p className="text-xs text-indigo-100 uppercase font-bold tracking-wider">
                    {getAllServices(selectedProject).find(s => s.path === selectedExecutionForFvs.servicePath)?.name} - {getComponentName(selectedProject, selectedExecutionForFvs.componentPath)}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedExecutionForFvs(null)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
              {(() => {
                const service = getAllServices(selectedProject).find(s => s.path === selectedExecutionForFvs.servicePath);
                const fvs = fvsList.find(f => f.id === service?.fvsId);
                
                if (!fvs) return <p className="text-center py-10 text-slate-400">FVS não encontrada para este serviço.</p>;

                return (
                  <div className="space-y-8">
                    {fvs.items.map(item => (
                      <div key={item.id} className="space-y-4">
                        <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 flex items-center gap-2">
                          <span className="font-bold text-slate-700">{item.code} - {item.name}</span>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Item de Inspeção</th>
                                <th className="py-2 text-[10px] font-bold text-slate-400 uppercase">Tolerância</th>
                                <th className="py-2 text-[10px] font-bold text-slate-400 uppercase text-center w-48">Avaliação</th>
                                <th className="py-2 text-[10px] font-bold text-slate-400 uppercase text-center w-36">Evidência (Foto)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {item.subItems.map(sub => (
                                <tr key={sub.id}>
                                  <td className="py-3 pr-4">
                                    <div className="text-xs font-medium text-slate-700">{sub.inspectionItem}</div>
                                    <div className="text-[10px] text-slate-400">{sub.inspectionMethod} • {sub.sampling}</div>
                                  </td>
                                  <td className="py-3 pr-4 text-xs text-slate-500">{sub.tolerance}</td>
                                  <td className="py-3">
                                    <div className="flex items-center justify-center gap-2">
                                      {(['C', 'NC', 'NA'] as const).map(status => (
                                        <button
                                          key={status}
                                          onClick={() => {
                                            if (!selectedExecutionForFvs) return;
                                            const currentResults = selectedExecutionForFvs.fvsResults || {};
                                            const itemResults = currentResults[item.id] || {};
                                            const updated: ServiceExecution = {
                                              ...selectedExecutionForFvs,
                                              fvsResults: {
                                                ...currentResults,
                                                [item.id]: {
                                                  ...itemResults,
                                                  [sub.id]: status as 'NC' | 'C' | 'NA' | 'CR'
                                                }
                                              }
                                            };
                                            setSelectedExecutionForFvs(updated);
                                            updateExecution(updated, true);
                                          }}
                                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            selectedExecutionForFvs.fvsResults?.[item.id]?.[sub.id] === status
                                              ? status === 'C' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' :
                                                status === 'NC' ? 'bg-rose-500 text-white shadow-md shadow-rose-100' :
                                                'bg-slate-500 text-white shadow-md shadow-slate-100'
                                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                          }`}
                                        >
                                          {status === 'C' ? 'C' : status === 'NC' ? 'NC' : 'NA'}
                                        </button>
                                      ))}
                                      
                                      {(selectedExecutionForFvs.fvsResults?.[item.id]?.[sub.id] === 'NC' || selectedExecutionForFvs.fvsResults?.[item.id]?.[sub.id] === 'CR') && (
                                        <button
                                          onClick={() => {
                                            if (!selectedExecutionForFvs) return;
                                            const currentResults = selectedExecutionForFvs.fvsResults || {};
                                            const itemResults = currentResults[item.id] || {};
                                            const updated: ServiceExecution = {
                                              ...selectedExecutionForFvs,
                                              fvsResults: {
                                                ...currentResults,
                                                [item.id]: {
                                                  ...itemResults,
                                                  [sub.id]: 'CR' as const
                                                }
                                              }
                                            };
                                            setSelectedExecutionForFvs(updated);
                                            updateExecution(updated, true);
                                          }}
                                          title="Conforme após reinspeção"
                                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            selectedExecutionForFvs.fvsResults?.[item.id]?.[sub.id] === 'CR'
                                              ? 'bg-indigo-500 text-white shadow-md shadow-indigo-100'
                                              : 'bg-indigo-50 text-indigo-400 hover:bg-indigo-100'
                                          }`}
                                        >
                                          C/R
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-2">
                                    {(() => {
                                      const photoUrl = selectedExecutionForFvs.fvsPhotos?.[item.id]?.[sub.id];
                                      return (
                                        <div className="flex items-center justify-center gap-2">
                                          {photoUrl ? (
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => setViewingImage(photoUrl)}
                                                className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-300 shadow-sm hover:ring-2 hover:ring-indigo-500 transition-all flex-shrink-0"
                                                title="Visualizar foto"
                                              >
                                                <img src={photoUrl} alt="Evidência" className="w-full h-full object-cover" />
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentPhotos = selectedExecutionForFvs.fvsPhotos || {};
                                                  const itemPhotos = { ...(currentPhotos[item.id] || {}) };
                                                  delete itemPhotos[sub.id];
                                                  const updated: ServiceExecution = {
                                                    ...selectedExecutionForFvs,
                                                    fvsPhotos: {
                                                      ...currentPhotos,
                                                      [item.id]: itemPhotos
                                                    }
                                                  };
                                                  setSelectedExecutionForFvs(updated);
                                                  updateExecution(updated, true);
                                                }}
                                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                                title="Remover foto"
                                              >
                                                <i className="fas fa-trash-alt text-xs"></i>
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => setCameraTarget({ itemId: item.id, subItemId: sub.id })}
                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                                title="Tirar foto com dispositivo"
                                              >
                                                <i className="fas fa-camera text-xs"></i>
                                                <span className="hidden sm:inline">Câmera</span>
                                              </button>

                                              <label className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors" title="Fazer upload de foto">
                                                <i className="fas fa-upload text-xs"></i>
                                                <span className="hidden sm:inline">Upload</span>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file && selectedExecutionForFvs) {
                                                      try {
                                                        const compressed = await compressImage(file, 800, 800, 0.75);
                                                        const currentPhotos = selectedExecutionForFvs.fvsPhotos || {};
                                                        const itemPhotos = currentPhotos[item.id] || {};
                                                        const updated: ServiceExecution = {
                                                          ...selectedExecutionForFvs,
                                                          fvsPhotos: {
                                                            ...currentPhotos,
                                                            [item.id]: {
                                                              ...itemPhotos,
                                                              [sub.id]: compressed
                                                            }
                                                          }
                                                        };
                                                        setSelectedExecutionForFvs(updated);
                                                        updateExecution(updated, true);
                                                        onFeedback?.('success', 'Foto anexada como evidência!');
                                                      } catch (err) {
                                                        console.error('Erro ao anexar foto:', err);
                                                        onFeedback?.('error', 'Falha ao processar imagem.');
                                                      }
                                                    }
                                                  }}
                                                />
                                              </label>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  C: Conforme
                </div>
                <div className="flex items-center gap-1.5 text-rose-600">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                  NC: Não Conforme
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                  NA: Não Aplicável
                </div>
              </div>
              <button 
                onClick={() => {
                  if (selectedExecutionForFvs) {
                    onSaveExecution(selectedExecutionForFvs);
                  }
                  onFeedback?.('success', 'FVS salva com sucesso.');
                  setSelectedExecutionForFvs(null);
                }}
                className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                Salvar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Execution Details Modal */}
      {selectedExecutionForDetails && selectedProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-info-circle"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Detalhes da Execução</h3>
                  <p className="text-xs text-slate-300 uppercase font-bold tracking-wider">
                    {getAllServices(selectedProject).find(s => s.path === selectedExecutionForDetails.servicePath)?.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedExecutionForDetails(null)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Local</span>
                  <p className="text-sm font-bold text-slate-700">{getComponentName(selectedProject, selectedExecutionForDetails.componentPath)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <div>
                    {selectedExecutionForDetails.endDateReal ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[9px] font-bold uppercase">Concluído</span>
                    ) : selectedExecutionForDetails.startDateReal ? (
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[9px] font-bold uppercase">Em Andamento</span>
                    ) : (
                      <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-[9px] font-bold uppercase">Pendente</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Cronograma Previsto</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Início:</span>
                      <span className="font-bold text-slate-700">{formatDateBR(selectedExecutionForDetails.startDatePlanned)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Fim:</span>
                      <span className="font-bold text-slate-700">{formatDateBR(selectedExecutionForDetails.endDatePlanned)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Duração:</span>
                      <span className="font-bold text-slate-700">{calculateDuration(selectedExecutionForDetails.startDatePlanned, selectedExecutionForDetails.endDatePlanned)} dias</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-l border-slate-100 pl-8">
                  <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Cronograma Real</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Início:</span>
                      <span className="font-bold text-slate-700">{formatDateBR(selectedExecutionForDetails.startDateReal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Fim:</span>
                      <span className="font-bold text-slate-700">{formatDateBR(selectedExecutionForDetails.endDateReal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Duração:</span>
                      <span className="font-bold text-slate-700">{calculateDuration(selectedExecutionForDetails.startDateReal, selectedExecutionForDetails.endDateReal)} dias</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipe de Execução</h4>
                <div className="flex flex-wrap gap-2">
                  {getExecutors(selectedExecutionForDetails).length > 0 ? (
                    getExecutors(selectedExecutionForDetails).map((executor, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <div className={`w-2 h-2 rounded-full ${executor.type === 'Colaborador' ? 'bg-indigo-400' : 'bg-amber-400'}`}></div>
                        <span className="text-xs font-bold text-slate-700">{executor.name}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-medium">({executor.type})</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nenhum executor registrado para este local/serviço.</p>
                  )}
                </div>
              </div>

              {selectedProject.fvsMapping?.[selectedExecutionForDetails.servicePath] && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumo da Qualidade (FVS)</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 text-center">
                      <div className="text-lg font-bold text-emerald-600">
                        {(() => {
                          let c = 0;
                          if (selectedExecutionForDetails.fvsResults) {
                            Object.values(selectedExecutionForDetails.fvsResults).forEach(ir => 
                              Object.values(ir).forEach(s => { 
                                if (s === 'C' || s === 'CR') c++; 
                              })
                            );
                          }
                          return c;
                        })()}
                      </div>
                      <div className="text-[9px] font-bold text-emerald-500 uppercase">Conformes</div>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100 text-center">
                      <div className="text-lg font-bold text-rose-600">{countNonConformities(selectedExecutionForDetails)}</div>
                      <div className="text-[9px] font-bold text-rose-500 uppercase">Não Conf.</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <div className="text-lg font-bold text-slate-600">
                        {(() => {
                          let na = 0;
                          if (selectedExecutionForDetails.fvsResults) {
                            Object.values(selectedExecutionForDetails.fvsResults).forEach(ir => Object.values(ir).forEach(s => { if (s === 'NA') na++; }));
                          }
                          return na;
                        })()}
                      </div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase">N/A</div>
                    </div>
                  </div>

                  {(() => {
                    const fvsId = selectedProject.fvsMapping?.[selectedExecutionForDetails.servicePath];
                    const fvs = fvsList.find(f => f.id === fvsId);
                    if (!fvs) return null;

                    return (
                      <div className="space-y-3 pt-2">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Itens Inspecionados e Evidências</h5>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                          {fvs.items.map(item => (
                            <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                              <div className="font-bold text-slate-700">{item.code} - {item.name}</div>
                              <div className="space-y-1.5 pl-2 border-l-2 border-slate-300">
                                {item.subItems.map(sub => {
                                  const status = selectedExecutionForDetails.fvsResults?.[item.id]?.[sub.id];
                                  const photo = selectedExecutionForDetails.fvsPhotos?.[item.id]?.[sub.id];
                                  return (
                                    <div key={sub.id} className="flex items-center justify-between gap-2 py-1">
                                      <span className="text-slate-600 flex-1">{sub.inspectionItem}</span>
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          status === 'C' ? 'bg-emerald-100 text-emerald-700' :
                                          status === 'NC' ? 'bg-rose-100 text-rose-700' :
                                          status === 'CR' ? 'bg-indigo-100 text-indigo-700' :
                                          status === 'NA' ? 'bg-slate-200 text-slate-600' :
                                          'bg-slate-100 text-slate-400'
                                        }`}>
                                          {status || 'Pendente'}
                                        </span>
                                        {photo && (
                                          <button
                                            type="button"
                                            onClick={() => setViewingImage(photo)}
                                            className="w-7 h-7 rounded border border-slate-300 overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all flex-shrink-0"
                                            title="Ver Evidência"
                                          >
                                            <img src={photo} alt="Evidência" className="w-full h-full object-cover" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setSelectedExecutionForDetails(null)}
                className="px-8 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal for FVS Item Photo Evidence */}
      {cameraTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 text-white space-y-4 border border-slate-700 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <i className="fas fa-camera text-indigo-400"></i>
                Capturar Foto da Evidência
              </h3>
              <button
                type="button"
                onClick={() => setCameraTarget(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <Camera
              onCapture={async (base64) => {
                if (selectedExecutionForFvs && cameraTarget) {
                  try {
                    const compressed = await compressImage(base64, 800, 800, 0.75);
                    const { itemId, subItemId } = cameraTarget;
                    const currentPhotos = selectedExecutionForFvs.fvsPhotos || {};
                    const itemPhotos = currentPhotos[itemId] || {};
                    const updated: ServiceExecution = {
                      ...selectedExecutionForFvs,
                      fvsPhotos: {
                        ...currentPhotos,
                        [itemId]: {
                          ...itemPhotos,
                          [subItemId]: compressed
                        }
                      }
                    };
                    setSelectedExecutionForFvs(updated);
                    updateExecution(updated, true);
                    setCameraTarget(null);
                    onFeedback?.('success', 'Foto capturada e salva com sucesso!');
                  } catch (err) {
                    console.error('Erro ao salvar foto da câmera:', err);
                    onFeedback?.('error', 'Erro ao salvar a foto.');
                  }
                }
              }}
            />

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setCameraTarget(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Image Modal */}
      {viewingImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full p-4 text-white space-y-4 border border-slate-700 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 px-2">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <i className="fas fa-image text-indigo-400"></i>
                Visualização da Evidência
              </h3>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="max-h-[70vh] overflow-hidden rounded-xl bg-black flex items-center justify-center">
              <img src={viewingImage} alt="Evidência FVS" className="max-h-[70vh] w-auto object-contain" />
            </div>

            <div className="flex justify-between items-center px-2 pt-2">
              <a
                href={viewingImage}
                download="evidencia-fvs.jpg"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
              >
                <i className="fas fa-download"></i>
                Baixar Imagem
              </a>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
