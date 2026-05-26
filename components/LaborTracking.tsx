import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee, Project, TimeLog, LaborTracking, ConstructionUnit, Block, Floor, Unit, LogType, ServiceExecution, Supplier } from '../types';
import { generateId } from '../src/lib/utils';
import { storageService } from '../services/storageService';

interface LaborTrackingProps {
  employees: Employee[];
  suppliers: Supplier[];
  projects: Project[];
  logs: TimeLog[];
  onSave: (tracking: LaborTracking) => void;
  onSaveMany: (trackings: LaborTracking[]) => void;
  onDeleteMany: (ids: string[]) => void;
  onUpdateProjectTeams: (projectId: string, teams: string[]) => void;
  trackings: LaborTracking[];
  serviceExecutions: ServiceExecution[];
  onSaveExecution: (execution: ServiceExecution) => void;
  onFeedback?: (type: 'success' | 'error', msg: string) => void;
  onConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

export const LaborTrackingView: React.FC<LaborTrackingProps> = ({ 
  employees, 
  suppliers,
  projects, 
  logs, 
  onSave, 
  onSaveMany,
  onDeleteMany,
  onUpdateProjectTeams, 
  trackings,
  serviceExecutions,
  onSaveExecution,
  onFeedback,
  onConfirm
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // New selection state
  const [executorType, setExecutorType] = useState<'Colaborador' | 'Prestador de Serviço'>('Colaborador');
  const [currentServicePaths, setCurrentServicePaths] = useState<string[]>([]);
  const [selectedComponentPaths, setSelectedComponentPaths] = useState<string[]>([]);
  const [selectedExecutorIds, setSelectedExecutorIds] = useState<string[]>([]);
  const [executorSearch, setExecutorSearch] = useState<string>('');
  
  const [isServiceSelectorOpen, setIsServiceSelectorOpen] = useState(false);
  const [isComponentSelectorOpen, setIsComponentSelectorOpen] = useState(false);
  const [isExecutorSelectorOpen, setIsExecutorSelectorOpen] = useState(false);

  const serviceDropdownRef = useRef<HTMLDivElement>(null);
  const componentDropdownRef = useRef<HTMLDivElement>(null);
  const executorDropdownRef = useRef<HTMLDivElement>(null);

  const changeDate = (days: number) => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  useEffect(() => {
    // Auto-fill logic: if current day has no trackings, but previous day had trackings for services that are still in progress
    if (selectedProjectId && selectedDate) {
      const currentDayTrackings = trackings.filter(t => t.projectId === selectedProjectId && t.date === selectedDate);
      
      if (currentDayTrackings.length === 0) {
        // Look for the most recent day with trackings for this project
        const previousTrackings = trackings
          .filter(t => t.projectId === selectedProjectId && t.date < selectedDate)
          .sort((a, b) => b.date.localeCompare(a.date));
        
        if (previousTrackings.length > 0) {
          const lastDate = previousTrackings[0].date;
          const lastDayTrackings = previousTrackings.filter(t => t.date === lastDate);
          
          const newTrackings: LaborTracking[] = [];
          
          lastDayTrackings.forEach(prev => {
            // Check if the service/component pair is still in progress
            const servicePath = prev.costStructureSelections?.[0];
            const componentPath = prev.selections?.[0];
            
            if (servicePath && componentPath) {
              const execution = serviceExecutions.find(ex => 
                ex.projectId === selectedProjectId && 
                ex.servicePath === servicePath && 
                ex.componentPath === componentPath &&
                ex.startDateReal && !ex.endDateReal
              );
              
              if (execution) {
                newTrackings.push({
                  ...prev,
                  id: generateId(),
                  date: selectedDate,
                  createdAt: Date.now()
                });
              }
            }
          });

          if (newTrackings.length > 0) {
            onSaveMany(newTrackings);
          }
        }
      }
    }
  }, [selectedDate, selectedProjectId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
        setIsServiceSelectorOpen(false);
      }
      if (componentDropdownRef.current && !componentDropdownRef.current.contains(event.target as Node)) {
        setIsComponentSelectorOpen(false);
      }
      if (executorDropdownRef.current && !executorDropdownRef.current.contains(event.target as Node)) {
        setIsExecutorSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const project = projects.find(p => p.id === selectedProjectId);
  
  const currentDayTrackings = trackings.filter(t => t.projectId === selectedProjectId && t.date === selectedDate);

  // Group trackings by Service + Component + ExecutorType
  const groupedEntries = useMemo(() => {
    const groups: { [key: string]: { servicePath: string, componentPath: string, executorType: 'Colaborador' | 'Prestador de Serviço', executorIds: string[] } } = {};
    
    currentDayTrackings.forEach(t => {
      const sPath = t.costStructureSelections?.[0] || '';
      const cPath = t.selections?.[0] || '';
      const eType = t.executorType || 'Colaborador';
      const key = `${sPath}|${cPath}|${eType}`;
      
      if (!groups[key]) {
        groups[key] = { servicePath: sPath, componentPath: cPath, executorType: eType, executorIds: [] };
      }
      groups[key].executorIds.push(t.employeeId);
    });
    
    return Object.values(groups);
  }, [currentDayTrackings]);

  const handleAddEntry = async () => {
    if (currentServicePaths.length === 0 || selectedComponentPaths.length === 0 || selectedExecutorIds.length === 0) {
      onFeedback?.('error', `Selecione ao menos um serviço, um componente e um ${executorType.toLowerCase()}.`);
      return;
    }

    // Check for duplicates
    const duplicates = currentServicePaths.some(sPath => 
      selectedComponentPaths.some(compPath => 
        groupedEntries.some(e => e.servicePath === sPath && e.componentPath === compPath && e.executorType === executorType)
      )
    );

    if (duplicates) {
      onFeedback?.('error', "Alguns dos itens selecionados já possuem apontamento para estes serviços hoje.");
      return;
    }

    try {
      const newTrackings: LaborTracking[] = [];
      
      currentServicePaths.forEach(sPath => {
        selectedComponentPaths.forEach(compPath => {
          selectedExecutorIds.forEach(execId => {
            newTrackings.push({
              id: generateId(),
              employeeId: execId,
              executorType: executorType,
              projectId: selectedProjectId,
              date: selectedDate,
              presence: 'Presente',
              selections: [compPath],
              costStructureSelections: [sPath],
              createdAt: Date.now()
            });
          });
        });
      });

      onSaveMany(newTrackings);

      // Update Service Execution Real Start Dates
      currentServicePaths.forEach(sPath => {
        selectedComponentPaths.forEach(compPath => {
          const existingExec = serviceExecutions.find(ex => 
            ex.projectId === selectedProjectId && 
            ex.servicePath === sPath && 
            ex.componentPath === compPath
          );

          if (!existingExec) {
            onSaveExecution({
              id: generateId(),
              projectId: selectedProjectId,
              servicePath: sPath,
              componentPath: compPath,
              startDateReal: selectedDate
            });
          } else if (!existingExec.startDateReal) {
            onSaveExecution({ ...existingExec, startDateReal: selectedDate });
          }
        });
      });

      onFeedback?.('success', `${newTrackings.length} apontamento(s) realizado(s) com sucesso.`);

      // Reset selection
      setCurrentServicePaths([]);
      setSelectedComponentPaths([]);
      setSelectedExecutorIds([]);
      setExecutorSearch('');
    } catch (error) {
      onFeedback?.('error', "Erro ao salvar apontamento. Tente novamente.");
    }
  };

  const handleDeleteEntry = (servicePath: string, componentPath: string, eType: 'Colaborador' | 'Prestador de Serviço') => {
    const idsToDelete = currentDayTrackings
      .filter(t => t.costStructureSelections?.[0] === servicePath && t.selections?.[0] === componentPath && (t.executorType || 'Colaborador') === eType)
      .map(t => t.id);
    
    onDeleteMany(idsToDelete);
  };

  const getServiceName = (path: string) => {
    if (!project || !project.costStructure) return '';
    const parts = path.split('|');
    const cc = project.costStructure.find(c => c.id === parts[0]);
    const stage = cc?.stages.find(s => s.id === parts[1]);
    const ss = stage?.subStages.find(s => s.id === parts[2]);
    const sv = parts[3] ? ss?.services.find(s => s.id === parts[3]) : null;
    return sv ? sv.name : ss?.name || '';
  };

  const getComponentName = (path: string) => {
    if (!project) return '';
    const parts = path.split('|');
    const cu = project.constructionUnits.find(u => u.id === parts[0]);
    const block = cu?.blocks.find(b => b.id === parts[1]);
    const floor = block?.floors.find(f => f.id === parts[2]);
    const unit = floor?.units.find(u => u.id === parts[3]);
    
    if (unit) return unit.name;
    if (floor) return floor.name;
    if (block) return block.name;
    return cu?.name || '';
  };

  const getComponentFullPath = (path: string) => {
    if (!project) return '';
    const parts = path.split('|');
    const cu = project.constructionUnits.find(u => u.id === parts[0]);
    const block = cu?.blocks.find(b => b.id === parts[1]);
    const floor = block?.floors.find(f => f.id === parts[2]);
    const unit = floor?.units.find(u => u.id === parts[3]);
    
    let res = cu?.name || '';
    if (block) res += ` > ${block.name}`;
    if (floor) res += ` > ${floor.name}`;
    if (unit) res += ` > ${unit.name}`;
    return res;
  };

  const getExecutionStatus = (compPath: string) => {
    if (!selectedProjectId || currentServicePaths.length === 0) return null;
    // For status check, we check if ALL selected services are completed or in progress for this component
    // If multiple services selected, we show the most "advanced" status or the one from the first service
    const mainServicePath = currentServicePaths[0];
    const ex = serviceExecutions.find(e => 
      e.projectId === selectedProjectId && 
      e.servicePath === mainServicePath && 
      e.componentPath === compPath
    );
    if (ex?.endDateReal) return 'Concluído';
    if (ex?.startDateReal) return 'Em andamento';
    return null;
  };

  const renderServiceSelector = () => {
    if (!project || !project.costStructure) return null;

    const getAllServicePathsInCC = (cc: any) => {
      const paths: string[] = [];
      cc.stages?.forEach((st: any) => {
        st.subStages?.forEach((ss: any) => {
          paths.push(`${cc.id}|${st.id}|${ss.id}`); // SubStage path
          ss.services?.forEach((sv: any) => {
            paths.push(`${cc.id}|${st.id}|${ss.id}|${sv.id}`);
          });
        });
      });
      return paths;
    };

    const getAllServicePathsInStage = (cc: any, st: any) => {
      const paths: string[] = [];
      st.subStages?.forEach((ss: any) => {
        paths.push(`${cc.id}|${st.id}|${ss.id}`);
        ss.services?.forEach((sv: any) => {
          paths.push(`${cc.id}|${st.id}|${ss.id}|${sv.id}`);
        });
      });
      return paths;
    };

    const toggleMultiSelection = (paths: string[]) => {
      const allSelected = paths.every(p => currentServicePaths.includes(p));
      if (allSelected) {
        setCurrentServicePaths(prev => prev.filter(p => !paths.includes(p)));
      } else {
        const newPaths = [...currentServicePaths];
        paths.forEach(p => {
          if (!newPaths.includes(p)) newPaths.push(p);
        });
        setCurrentServicePaths(newPaths);
      }
    };

    return (
      <div ref={serviceDropdownRef} className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl p-4 max-h-96 overflow-y-auto left-0 top-full">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estrutura de Custo</span>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const all: string[] = [];
                project.costStructure?.forEach(cc => all.push(...getAllServicePathsInCC(cc)));
                setCurrentServicePaths(all);
              }}
              className="text-[9px] font-bold text-indigo-600 hover:underline"
            >
              Todos
            </button>
            <button 
              onClick={() => setCurrentServicePaths([])}
              className="text-[9px] font-bold text-rose-500 hover:underline"
            >
              Nenhum
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {project.costStructure.map(cc => (
            <div key={cc.id} className="space-y-1">
              <div className="flex items-center justify-between group">
                <div className="font-bold text-[10px] text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                  <i className="fas fa-wallet text-[8px]"></i>
                  {cc.name}
                </div>
                <button 
                  onClick={() => toggleMultiSelection(getAllServicePathsInCC(cc))}
                  className="text-[9px] font-bold text-slate-300 group-hover:text-indigo-600 transition-colors"
                >
                  {getAllServicePathsInCC(cc).every(p => currentServicePaths.includes(p)) ? 'Deselecionar' : 'Selecionar Tudo'}
                </button>
              </div>
              <div className="pl-2 space-y-2 border-l border-slate-100">
                {cc.stages?.map(stage => (
                  <div key={stage.id} className="space-y-1">
                    <div className="flex items-center justify-between group/st">
                      <div className="text-[10px] font-semibold text-slate-500 italic">{stage.name}</div>
                      <button 
                        onClick={() => toggleMultiSelection(getAllServicePathsInStage(cc, stage))}
                        className="text-[8px] font-bold text-slate-300 group-hover/st:text-slate-500"
                      >
                        {getAllServicePathsInStage(cc, stage).every(p => currentServicePaths.includes(p)) ? 'D' : 'S'}
                      </button>
                    </div>
                    <div className="pl-2 space-y-1 border-l border-slate-100">
                      {stage.subStages?.map(ss => {
                        const ssPath = `${cc.id}|${stage.id}|${ss.id}`;
                        const isSSSelected = currentServicePaths.includes(ssPath);
                        return (
                          <div key={ss.id} className="space-y-1">
                            <button 
                              onClick={() => {
                                if (isSSSelected) setCurrentServicePaths(prev => prev.filter(p => p !== ssPath));
                                else setCurrentServicePaths([...currentServicePaths, ssPath]);
                              }}
                              className={`text-left w-full px-2 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-2 ${
                                isSSSelected ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded flex items-center justify-center border ${isSSSelected ? 'bg-white border-white text-indigo-500' : 'bg-white border-slate-200'}`}>
                                {isSSSelected && <i className="fas fa-check text-[8px]"></i>}
                              </div>
                              {ss.name}
                            </button>
                            <div className="pl-2 grid grid-cols-1 gap-1">
                              {ss.services?.map(sv => {
                                const path = `${cc.id}|${stage.id}|${ss.id}|${sv.id}`;
                                const isSelected = currentServicePaths.includes(path);
                                return (
                                  <button
                                    key={sv.id}
                                    onClick={() => {
                                      if (isSelected) setCurrentServicePaths(prev => prev.filter(p => p !== path));
                                      else setCurrentServicePaths([...currentServicePaths, path]);
                                    }}
                                    className={`text-left px-2 py-1 rounded text-[10px] flex items-center gap-2 transition-colors ${
                                      isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <div className={`w-3 h-3 rounded flex items-center justify-center border ${isSelected ? 'bg-white border-white text-indigo-600' : 'bg-white border-slate-200'}`}>
                                      {isSelected && <i className="fas fa-check text-[8px]"></i>}
                                    </div>
                                    {sv.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderComponentSelector = () => {
    if (!project || currentServicePaths.length === 0) return null;

    // Find linked components for the selected service (using the first selected service as context)
    const parts = currentServicePaths[0].split('|');
    const cc = project.costStructure?.find(c => c.id === parts[0]);
    const stage = cc?.stages.find(s => s.id === parts[1]);
    const ss = stage?.subStages.find(s => s.id === parts[2]);
    const sv = parts[3] ? ss?.services.find(s => s.id === parts[3]) : null;
    const linkedIds = sv?.linkedComponentIds || [];

    const isLinked = (id: string, type: 'cu' | 'b' | 'f' | 'u', item: any) => {
      if (linkedIds.length === 0) return true;
      if (linkedIds.includes(id)) return true;
      
      // Check descendants
      if (type === 'cu') {
        return item.blocks?.some((b: any) => 
          linkedIds.includes(b.id) || 
          b.floors?.some((f: any) => 
            linkedIds.includes(f.id) || 
            f.units?.some((u: any) => linkedIds.includes(u.id))
          )
        );
      }
      if (type === 'b') {
        return item.floors?.some((f: any) => 
          linkedIds.includes(f.id) || 
          f.units?.some((u: any) => linkedIds.includes(u.id))
        );
      }
      if (type === 'f') {
        return item.units?.some((u: any) => linkedIds.includes(u.id));
      }

      // Check ancestors
      for (const cu of project.constructionUnits) {
        if (linkedIds.includes(cu.id)) {
          if (cu.id === id) return true;
          if (cu.blocks?.some(b => b.id === id || b.floors?.some(f => f.id === id || f.units?.some(u => u.id === id)))) return true;
        }
        for (const b of cu.blocks || []) {
          if (linkedIds.includes(b.id)) {
            if (b.id === id) return true;
            if (b.floors?.some(f => f.id === id || f.units?.some(u => u.id === id))) return true;
          }
          for (const f of b.floors || []) {
            if (linkedIds.includes(f.id)) {
              if (f.id === id) return true;
              if (f.units?.some(u => u.id === id)) return true;
            }
          }
        }
      }

      return false;
    };

    return (
      <div ref={componentDropdownRef} className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl p-4 max-h-96 overflow-y-auto left-0 top-full">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Selecione os Componentes</span>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const allPaths: string[] = [];
                project.constructionUnits.forEach(cu => {
                  if (getExecutionStatus(cu.id)) return;
                  if (isLinked(cu.id, 'cu', cu) && (linkedIds.length === 0 || linkedIds.includes(cu.id))) {
                    allPaths.push(cu.id);
                  }
                  cu.blocks?.forEach(b => {
                    if (getExecutionStatus(`${cu.id}|${b.id}`)) return;
                    if (isLinked(b.id, 'b', b) && (linkedIds.length === 0 || linkedIds.includes(b.id))) {
                      allPaths.push(`${cu.id}|${b.id}`);
                    }
                    b.floors?.forEach(f => {
                      if (getExecutionStatus(`${cu.id}|${b.id}|${f.id}`)) return;
                      if (isLinked(f.id, 'f', f) && (linkedIds.length === 0 || linkedIds.includes(f.id))) {
                        allPaths.push(`${cu.id}|${b.id}|${f.id}`);
                      }
                      f.units?.forEach(u => {
                        if (getExecutionStatus(`${cu.id}|${b.id}|${f.id}|${u.id}`)) return;
                        if (isLinked(u.id, 'u', u)) {
                          allPaths.push(`${cu.id}|${b.id}|${f.id}|${u.id}`);
                        }
                      });
                    });
                  });
                });
                setSelectedComponentPaths(allPaths);
              }}
              className="text-[9px] font-bold text-indigo-600 hover:underline"
            >
              Todos
            </button>
            <button 
              onClick={() => setSelectedComponentPaths([])}
              className="text-[9px] font-bold text-rose-500 hover:underline"
            >
              Nenhum
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {project.constructionUnits?.filter(cu => isLinked(cu.id, 'cu', cu)).map(cu => {
            const cuPath = cu.id;
            const isSelectable = linkedIds.length === 0 || linkedIds.includes(cu.id);
            const status = getExecutionStatus(cuPath);
            const isBlocked = !!status;
            const isSelected = selectedComponentPaths.includes(cuPath);

            return (
              <div key={cu.id} className="space-y-1">
                {isSelectable ? (
                  <button
                    onClick={() => { 
                      if (!isBlocked) { 
                        if (isSelected) setSelectedComponentPaths(selectedComponentPaths.filter(p => p !== cuPath));
                        else setSelectedComponentPaths([...selectedComponentPaths, cuPath]);
                      } 
                    }}
                    disabled={isBlocked}
                    className={`text-left w-full px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors flex justify-between items-center ${
                      isSelected ? 'bg-indigo-500 text-white' : 
                      isBlocked ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-indigo-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded flex items-center justify-center border ${isSelected ? 'bg-white border-white' : 'bg-white border-indigo-200'}`}>
                        {isSelected && <i className="fas fa-check text-indigo-500 text-[8px]"></i>}
                      </div>
                      <span>{cu.name}</span>
                    </div>
                    {status && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${status === 'Concluído' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{status}</span>}
                  </button>
                ) : (
                  <div className="font-bold text-[10px] text-indigo-600 uppercase px-2">{cu.name}</div>
                )}
                
                <div className="pl-2 space-y-1 border-l border-slate-100">
                  {cu.blocks?.filter(b => isLinked(b.id, 'b', b)).map(block => {
                    const bPath = `${cu.id}|${block.id}`;
                    const isBSelectable = linkedIds.length === 0 || linkedIds.includes(block.id);
                    const bStatus = getExecutionStatus(bPath);
                    const isBBlocked = !!bStatus;
                    const isBSelected = selectedComponentPaths.includes(bPath);

                    return (
                      <div key={block.id} className="space-y-1">
                        {isBSelectable ? (
                          <button
                            onClick={() => { 
                              if (!isBBlocked) { 
                                if (isBSelected) setSelectedComponentPaths(selectedComponentPaths.filter(p => p !== bPath));
                                else setSelectedComponentPaths([...selectedComponentPaths, bPath]);
                              } 
                            }}
                            disabled={isBBlocked}
                            className={`text-left w-full px-2 py-1 rounded text-[10px] font-semibold italic transition-colors flex justify-between items-center ${
                              isBSelected ? 'bg-indigo-500 text-white' : 
                              isBBlocked ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded flex items-center justify-center border ${isBSelected ? 'bg-white border-white' : 'bg-white border-slate-200'}`}>
                                {isBSelected && <i className="fas fa-check text-indigo-500 text-[8px]"></i>}
                              </div>
                              <span>{block.name}</span>
                            </div>
                            {bStatus && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${bStatus === 'Concluído' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{bStatus}</span>}
                          </button>
                        ) : (
                          <div className="text-[10px] font-semibold text-slate-500 italic px-2">{block.name}</div>
                        )}

                        <div className="pl-2 space-y-1 border-l border-slate-100">
                          {block.floors?.filter(f => isLinked(f.id, 'f', f)).map(floor => {
                            const fPath = `${cu.id}|${block.id}|${floor.id}`;
                            const isFSelectable = linkedIds.length === 0 || linkedIds.includes(floor.id);
                            const fStatus = getExecutionStatus(fPath);
                            const isFBlocked = !!fStatus;
                            const isFSelected = selectedComponentPaths.includes(fPath);

                            return (
                              <div key={floor.id} className="space-y-1">
                                {isFSelectable ? (
                                  <button
                                    onClick={() => { 
                                      if (!isFBlocked) { 
                                        if (isFSelected) setSelectedComponentPaths(selectedComponentPaths.filter(p => p !== fPath));
                                        else setSelectedComponentPaths([...selectedComponentPaths, fPath]);
                                      } 
                                    }}
                                    disabled={isFBlocked}
                                    className={`text-left w-full px-2 py-1 rounded text-[10px] font-medium transition-colors flex justify-between items-center ${
                                      isFSelected ? 'bg-indigo-500 text-white' : 
                                      isFBlocked ? 'text-slate-200 cursor-not-allowed bg-slate-50' : 'text-slate-400 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded flex items-center justify-center border ${isFSelected ? 'bg-white border-white' : 'bg-white border-slate-200'}`}>
                                        {isFSelected && <i className="fas fa-check text-indigo-500 text-[8px]"></i>}
                                      </div>
                                      <span>{floor.name}</span>
                                    </div>
                                    {fStatus && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${fStatus === 'Concluído' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{fStatus}</span>}
                                  </button>
                                ) : (
                                  <div className="text-[10px] font-medium text-slate-400 px-2">{floor.name}</div>
                                )}

                                <div className="pl-2 grid grid-cols-1 gap-1">
                                  {floor.units?.filter(u => isLinked(u.id, 'u', u)).map(unit => {
                                    const path = `${cu.id}|${block.id}|${floor.id}|${unit.id}`;
                                    const uStatus = getExecutionStatus(path);
                                    const isUBlocked = !!uStatus;
                                    const isUSelected = selectedComponentPaths.includes(path);

                                    return (
                                      <button
                                        key={unit.id}
                                        onClick={() => { 
                                          if (!isUBlocked) { 
                                            if (isUSelected) setSelectedComponentPaths(selectedComponentPaths.filter(p => p !== path));
                                            else setSelectedComponentPaths([...selectedComponentPaths, path]);
                                          } 
                                        }}
                                        disabled={isUBlocked}
                                        className={`text-left px-2 py-1 rounded text-[10px] transition-colors flex justify-between items-center ${
                                          isUSelected ? 'bg-indigo-500 text-white' : 
                                          isUBlocked ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-3 h-3 rounded flex items-center justify-center border ${isUSelected ? 'bg-white border-white' : 'bg-white border-slate-200'}`}>
                                            {isUSelected && <i className="fas fa-check text-indigo-500 text-[8px]"></i>}
                                          </div>
                                          <span>{unit.name}</span>
                                        </div>
                                        {uStatus && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${uStatus === 'Concluído' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>{uStatus}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {selectedComponentPaths.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-[10px] font-bold text-indigo-600">{selectedComponentPaths.length} componente(s) selecionado(s)</span>
            <button 
              onClick={() => setIsComponentSelectorOpen(false)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase"
            >
              Confirmar
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderExecutorSelector = () => {
    if (!project) return null;

    const filteredOptions = (executorType === 'Colaborador' 
      ? employees
          .filter(e => e.status === 'Ativo')
          .sort((a, b) => {
            // Sort employees from the current project first
            const aMatch = a.projects?.includes(project.name) ? 0 : 1;
            const bMatch = b.projects?.includes(project.name) ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            return a.name.localeCompare(b.name);
          })
          .map(e => ({ id: e.id, name: e.name.toUpperCase(), info: e.jobFunction, projects: e.projects }))
      : suppliers
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(s => ({ id: s.id, name: s.name.toUpperCase(), info: s.type, projects: [] }))
    ).filter(opt => 
      opt.name.toLowerCase().includes(executorSearch.toLowerCase()) || 
      opt.info.toLowerCase().includes(executorSearch.toLowerCase())
    );

    return (
      <div ref={executorDropdownRef} className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl p-4 max-h-96 flex flex-col gap-3 left-0 top-full">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input 
            type="text"
            autoFocus
            placeholder={`Buscar ${executorType.toLowerCase()}...`}
            value={executorSearch}
            onChange={(e) => setExecutorSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {filteredOptions.map(opt => {
            const isSelected = selectedExecutorIds.includes(opt.id);
            const isCurrentProject = executorType === 'Colaborador' && opt.projects?.includes(project.name);
            
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedExecutorIds(selectedExecutorIds.filter(id => id !== opt.id));
                  } else {
                    setSelectedExecutorIds([...selectedExecutorIds, opt.id]);
                  }
                }}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs transition-all border ${
                  isSelected ? 'bg-indigo-50 border-indigo-100 text-indigo-700 font-bold' : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                }`}>
                  {isSelected && <i className="fas fa-check text-[8px] text-white"></i>}
                </div>
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{opt.name}</span>
                    {isCurrentProject && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[8px] font-bold uppercase shrink-0">Obra</span>
                    )}
                  </div>
                  <div className="text-[10px] opacity-70 truncate">{opt.info}</div>
                </div>
              </button>
            );
          })}
          {filteredOptions.length === 0 && (
            <div className="text-center py-4 text-slate-400 italic text-xs">
              Nenhum {executorType.toLowerCase()} encontrado.
            </div>
          )}
        </div>

        {selectedExecutorIds.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center bg-white sticky bottom-0">
            <span className="text-[10px] font-bold text-indigo-600">{selectedExecutorIds.length} selecionado(s)</span>
            <button 
              onClick={() => setIsExecutorSelectorOpen(false)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-600 mb-1">Obra</label>
            <select 
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setCurrentServicePaths([]);
                setSelectedComponentPaths([]);
                setSelectedExecutorIds([]);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="">Selecione uma obra</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Executor</label>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => { setExecutorType('Colaborador'); setSelectedExecutorIds([]); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${executorType === 'Colaborador' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Colaborador
              </button>
              <button
                onClick={() => { setExecutorType('Prestador de Serviço'); setSelectedExecutorIds([]); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${executorType === 'Prestador de Serviço' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Prestador de Serviço
              </button>
            </div>
          </div>
          <div className="w-64 flex flex-col items-center">
            <label className="block text-sm font-medium text-slate-600 mb-0.5">Data</label>
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
            </span>
            <div className="flex items-center gap-2 w-full">
              <button 
                onClick={() => changeDate(-1)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button 
                onClick={() => changeDate(1)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>

        {selectedProjectId && (
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Service Selection */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Serviço</label>
                <div 
                  onClick={() => setIsServiceSelectorOpen(!isServiceSelectorOpen)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer hover:border-indigo-300 transition-all flex justify-between items-center"
                >
                  <span className={currentServicePaths.length > 0 ? 'text-slate-700' : 'text-slate-400 italic'}>
                    {currentServicePaths.length === 0 ? 'Selecione serviço(s)' : 
                     currentServicePaths.length === 1 ? getServiceName(currentServicePaths[0]) : 
                     `${currentServicePaths.length} selecionados`}
                  </span>
                  <i className={`fas fa-chevron-down text-xs text-slate-400 transition-transform ${isServiceSelectorOpen ? 'rotate-180' : ''}`}></i>
                </div>
                {isServiceSelectorOpen && renderServiceSelector()}
              </div>

              {/* Component Selection */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Componente EAP</label>
                <div 
                  onClick={() => {
                    if (currentServicePaths.length === 0) {
                      onFeedback?.('error', "Selecione ao menos um serviço primeiro.");
                      return;
                    }
                    setIsComponentSelectorOpen(!isComponentSelectorOpen);
                  }}
                  className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer hover:border-indigo-300 transition-all flex justify-between items-center ${currentServicePaths.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={selectedComponentPaths.length > 0 ? 'text-slate-700' : 'text-slate-400 italic'}>
                    {selectedComponentPaths.length > 0 
                      ? (selectedComponentPaths.length === 1 ? getComponentName(selectedComponentPaths[0]) : `${selectedComponentPaths.length} selecionados`)
                      : 'Selecione componente(s)'}
                  </span>
                  <i className={`fas fa-chevron-down text-xs text-slate-400 transition-transform ${isComponentSelectorOpen ? 'rotate-180' : ''}`}></i>
                </div>
                {isComponentSelectorOpen && renderComponentSelector()}
              </div>

              {/* Executor Selection */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{executorType}es</label>
                <div 
                  onClick={() => setIsExecutorSelectorOpen(!isExecutorSelectorOpen)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer hover:border-indigo-300 transition-all flex justify-between items-center"
                >
                  <span className={selectedExecutorIds.length > 0 ? 'text-slate-700' : 'text-slate-400 italic'}>
                    {selectedExecutorIds.length > 0 ? `${selectedExecutorIds.length} selecionado(s)` : `Selecione ${executorType.toLowerCase()}es`}
                  </span>
                  <i className={`fas fa-chevron-down text-xs text-slate-400 transition-transform ${isExecutorSelectorOpen ? 'rotate-180' : ''}`}></i>
                </div>
                {isExecutorSelectorOpen && renderExecutorSelector()}
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={handleAddEntry}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
              >
                <i className="fas fa-plus"></i>
                Adicionar Apontamento
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedProjectId ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-sm">Apontamentos do Dia</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{groupedEntries.length} Serviços</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Serviço</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Componente</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Executores</th>
                  <th className="w-20 px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedEntries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-700">{getServiceName(entry.servicePath)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] text-slate-500" title={getComponentFullPath(entry.componentPath)}>
                        {getComponentName(entry.componentPath)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${entry.executorType === 'Colaborador' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                        {entry.executorType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {entry.executorIds.map(execId => {
                          const name = entry.executorType === 'Colaborador' 
                            ? employees.find(e => e.id === execId)?.name 
                            : suppliers.find(s => s.id === execId)?.name;
                          return (
                            <span key={execId} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-medium border border-slate-200">
                              {name?.toUpperCase()}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => {
                          if (onConfirm) {
                            onConfirm(
                              "Confirmar Exclusão",
                              "Deseja excluir este apontamento?",
                              () => handleDeleteEntry(entry.servicePath, entry.componentPath, entry.executorType)
                            );
                          }
                        }}
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {groupedEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                      Nenhum apontamento realizado para este dia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
            <i className="fas fa-hard-hat text-2xl"></i>
          </div>
          <p className="text-slate-500 font-medium italic">Selecione uma obra para visualizar o apontamento de mão-de-obra.</p>
        </div>
      )}
    </div>
  );
};
