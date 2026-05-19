import React, { useState } from 'react';
import { CostCenter, CostStage, CostSubStage, CostService, ConstructionUnit } from '../types';
import { generateId } from '../src/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface CostStructureEditorProps {
  costStructure: CostCenter[];
  onChange: (costStructure: CostCenter[]) => void;
  constructionUnits?: ConstructionUnit[];
}

export const CostStructureEditor: React.FC<CostStructureEditorProps> = ({ costStructure, onChange, constructionUnits = [] }) => {
  const [showSelectorFor, setShowSelectorFor] = useState<string | null>(null);

  const getOptionsForLevel = (level: string) => {
    const options: { id: string; name: string; parentName?: string }[] = [];
    
    constructionUnits.forEach(cu => {
      if (level === 'constructionUnit') {
        options.push({ id: cu.id, name: cu.name });
      }
      
      cu.blocks?.forEach(b => {
        if (level === 'block') {
          options.push({ id: b.id, name: b.name, parentName: cu.name });
        }
        
        b.floors?.forEach(f => {
          if (level === 'floor') {
            options.push({ id: f.id, name: f.name, parentName: `${cu.name} > ${b.name}` });
          }
          
          f.units?.forEach(u => {
            if (level === 'unit') {
              options.push({ id: u.id, name: u.name, parentName: `${cu.name} > ${b.name} > ${f.name}` });
            }
          });
        });
      });
    });
    
    return options;
  };
  const addCostCenter = () => {
    const newCC: CostCenter = {
      id: generateId(),
      name: '',
      stages: []
    };
    onChange([...costStructure, newCC]);
  };

  const updateCostCenter = (id: string, name: string) => {
    onChange(costStructure.map(cc => cc.id === id ? { ...cc, name } : cc));
  };

  const removeCostCenter = (id: string) => {
    onChange(costStructure.filter(cc => cc.id !== id));
  };

  const addStage = (ccId: string) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        const newStage: CostStage = { id: generateId(), name: '', subStages: [] };
        return { ...cc, stages: [...cc.stages, newStage] };
      }
      return cc;
    }));
  };

  const updateStage = (ccId: string, stageId: string, name: string) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        return {
          ...cc,
          stages: cc.stages.map(s => s.id === stageId ? { ...s, name } : s)
        };
      }
      return cc;
    }));
  };

  const removeStage = (ccId: string, stageId: string) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        return { ...cc, stages: cc.stages.filter(s => s.id !== stageId) };
      }
      return cc;
    }));
  };

  const addSubStage = (ccId: string, stageId: string) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        return {
          ...cc,
          stages: cc.stages.map(s => {
            if (s.id === stageId) {
              const newSubStage: CostSubStage = { id: generateId(), name: '', services: [] };
              return { ...s, subStages: [...s.subStages, newSubStage] };
            }
            return s;
          })
        };
      }
      return cc;
    }));
  };

  const updateSubStage = (ccId: string, stageId: string, ssId: string, name: string) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        return {
          ...cc,
          stages: cc.stages.map(s => {
            if (s.id === stageId) {
              return {
                ...s,
                subStages: s.subStages.map(ss => ss.id === ssId ? { ...ss, name } : ss)
              };
            }
            return s;
          })
        };
      }
      return cc;
    }));
  };

  const removeSubStage = (ccId: string, stageId: string, ssId: string) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        return {
          ...cc,
          stages: cc.stages.map(s => {
            if (s.id === stageId) {
              return { ...s, subStages: s.subStages.filter(ss => ss.id !== ssId) };
            }
            return s;
          })
        };
      }
      return cc;
    }));
  };

  const addService = (ccId: string, stageId: string, ssId: string) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        return {
          ...cc,
          stages: cc.stages.map(s => {
            if (s.id === stageId) {
              return {
                ...s,
                subStages: s.subStages.map(ss => {
                  if (ss.id === ssId) {
                    const newService: CostService = { id: generateId(), name: '' };
                    return { ...ss, services: [...(ss.services || []), newService] };
                  }
                  return ss;
                })
              };
            }
            return s;
          })
        };
      }
      return cc;
    }));
  };

  const updateService = (ccId: string, stageId: string, ssId: string, svId: string, updates: Partial<CostService>) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        return {
          ...cc,
          stages: cc.stages.map(s => {
            if (s.id === stageId) {
              return {
                ...s,
                subStages: s.subStages.map(ss => {
                  if (ss.id === ssId) {
                    return {
                      ...ss,
                      services: ss.services?.map(sv => sv.id === svId ? { ...sv, ...updates } : sv)
                    };
                  }
                  return ss;
                })
              };
            }
            return s;
          })
        };
      }
      return cc;
    }));
  };

  const removeService = (ccId: string, stageId: string, ssId: string, svId: string) => {
    onChange(costStructure.map(cc => {
      if (cc.id === ccId) {
        return {
          ...cc,
          stages: cc.stages.map(s => {
            if (s.id === stageId) {
              return {
                ...s,
                subStages: s.subStages.map(ss => {
                  if (ss.id === ssId) {
                    return {
                      ...ss,
                      services: ss.services?.filter(sv => sv.id !== svId)
                    };
                  }
                  return ss;
                })
              };
            }
            return s;
          })
        };
      }
      return cc;
    }));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'COST_CENTER') {
      const newCCs = Array.from(costStructure);
      const [removed] = newCCs.splice(source.index, 1);
      newCCs.splice(destination.index, 0, removed);
      onChange(newCCs);
    } else if (type === 'STAGE') {
      const ccId = source.droppableId.split('-')[1];
      onChange(costStructure.map(cc => {
        if (cc.id === ccId) {
          const newStages = Array.from(cc.stages);
          const [removed] = newStages.splice(source.index, 1);
          newStages.splice(destination.index, 0, removed);
          return { ...cc, stages: newStages };
        }
        return cc;
      }));
    } else if (type === 'SUBSTAGE') {
      const stageId = source.droppableId.split('-')[1];
      onChange(costStructure.map(cc => ({
        ...cc,
        stages: cc.stages.map(s => {
          if (s.id === stageId) {
            const newSubStages = Array.from(s.subStages);
            const [removed] = newSubStages.splice(source.index, 1);
            newSubStages.splice(destination.index, 0, removed);
            return { ...s, subStages: newSubStages };
          }
          return s;
        })
      })));
    } else if (type === 'SERVICE') {
      const ssId = source.droppableId.split('-')[1];
      onChange(costStructure.map(cc => ({
        ...cc,
        stages: cc.stages.map(s => ({
          ...s,
          subStages: s.subStages.map(ss => {
            if (ss.id === ssId) {
              const newServices = Array.from(ss.services || []);
              const [removed] = newServices.splice(source.index, 1);
              newServices.splice(destination.index, 0, removed);
              return { ...ss, services: newServices };
            }
            return ss;
          })
        }))
      })));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Estrutura de Custo</h4>
        <button 
          onClick={addCostCenter}
          className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition"
        >
          <i className="fas fa-plus mr-1"></i> Centro de Custo
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="cc-list" type="COST_CENTER">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {costStructure?.map((cc, index) => (
                <Draggable key={cc.id} draggableId={cc.id} index={index}>
                  {(provided) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 shadow-sm"
                    >
                      <div className="flex gap-2 items-center">
                        <div {...provided.dragHandleProps} className="cursor-grab text-slate-400 hover:text-slate-600 p-1">
                          <i className="fas fa-grip-vertical"></i>
                        </div>
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-500 border border-slate-200 shadow-sm">
                          <i className="fas fa-wallet text-xs"></i>
                        </div>
                        <input 
                          type="text" 
                          value={cc.name}
                          onChange={(e) => updateCostCenter(cc.id, e.target.value)}
                          placeholder="Centro de Custo (Ex: Mão de Obra)"
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                        <button onClick={() => addStage(cc.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Adicionar Etapa">
                          <i className="fas fa-plus-circle"></i>
                        </button>
                        <button onClick={() => removeCostCenter(cc.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>

                      <Droppable droppableId={`stages-${cc.id}`} type="STAGE">
                        {(provided) => (
                          <div 
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="pl-8 space-y-3 border-l-2 border-slate-200 ml-4"
                          >
                            {cc.stages?.map((stage, sIndex) => (
                              <Draggable key={stage.id} draggableId={stage.id} index={sIndex}>
                                {(provided) => (
                                  <div 
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className="space-y-3"
                                  >
                                    <div className="flex gap-2 items-center">
                                      <div {...provided.dragHandleProps} className="cursor-grab text-slate-300 hover:text-slate-500 p-1">
                                        <i className="fas fa-grip-vertical text-[10px]"></i>
                                      </div>
                                      <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-slate-400 border border-slate-100">
                                        <i className="fas fa-tasks text-[10px]"></i>
                                      </div>
                                      <input 
                                        type="text" 
                                        value={stage.name}
                                        onChange={(e) => updateStage(cc.id, stage.id, e.target.value)}
                                        placeholder="Etapa de Custo (Ex: Pedreiro)"
                                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <button onClick={() => addSubStage(cc.id, stage.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Adicionar Subetapa">
                                        <i className="fas fa-plus-circle"></i>
                                      </button>
                                      <button onClick={() => removeStage(cc.id, stage.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                        <i className="fas fa-times"></i>
                                      </button>
                                    </div>

                                    <Droppable droppableId={`substages-${stage.id}`} type="SUBSTAGE">
                                      {(provided) => (
                                        <div 
                                          {...provided.droppableProps}
                                          ref={provided.innerRef}
                                          className="pl-6 space-y-2 border-l-2 border-slate-100 ml-3"
                                        >
                                          {stage.subStages?.map((ss, ssIndex) => (
                                            <Draggable key={ss.id} draggableId={ss.id} index={ssIndex}>
                                              {(provided) => (
                                                <div 
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  className="space-y-2"
                                                >
                                                  <div className="flex gap-2 items-center">
                                                    <div {...provided.dragHandleProps} className="cursor-grab text-slate-200 hover:text-slate-400 p-1">
                                                      <i className="fas fa-grip-vertical text-[8px]"></i>
                                                    </div>
                                                    <div className="w-5 h-5 bg-white rounded flex items-center justify-center text-slate-300 border border-slate-100">
                                                      <i className="fas fa-circle text-[6px]"></i>
                                                    </div>
                                                    <input 
                                                      type="text" 
                                                      value={ss.name}
                                                      onChange={(e) => updateSubStage(cc.id, stage.id, ss.id, e.target.value)}
                                                      placeholder="Subetapa de Custo (Ex: Oficial)"
                                                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    <button onClick={() => addService(cc.id, stage.id, ss.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Adicionar Serviço">
                                                      <i className="fas fa-plus-circle"></i>
                                                    </button>
                                                    <button onClick={() => removeSubStage(cc.id, stage.id, ss.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                      <i className="fas fa-times"></i>
                                                    </button>
                                                  </div>

                                                  <Droppable droppableId={`services-${ss.id}`} type="SERVICE">
                                                    {(provided) => (
                                                      <div 
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        className="pl-6 space-y-1 border-l-2 border-slate-50 ml-2"
                                                      >
                                                        {ss.services?.map((sv, svIndex) => (
                                                          <Draggable key={sv.id} draggableId={sv.id} index={svIndex}>
                                                            {(provided) => (
                                                              <div 
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className="flex flex-col gap-1"
                                                              >
                                                                <div className="flex gap-2 items-center">
                                                                  <div {...provided.dragHandleProps} className="cursor-grab text-slate-100 hover:text-slate-300 p-1">
                                                                    <i className="fas fa-grip-vertical text-[6px]"></i>
                                                                  </div>
                                                                  <div className="w-4 h-4 bg-white rounded flex items-center justify-center text-slate-200 border border-slate-100">
                                                                    <i className="fas fa-tools text-[8px]"></i>
                                                                  </div>
                                                                  <input 
                                                                    type="text" 
                                                                    value={sv.name}
                                                                    onChange={(e) => updateService(cc.id, stage.id, ss.id, sv.id, { name: e.target.value })}
                                                                    placeholder="Serviço (Ex: Alvenaria)"
                                                                    className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-indigo-500"
                                                                  />
                                                                  <select
                                                                    value={sv.linkedLevel || ''}
                                                                    onChange={(e) => {
                                      const level = e.target.value as any || undefined;
                                      const allIds = level ? getOptionsForLevel(level).map(opt => opt.id) : [];
                                      updateService(cc.id, stage.id, ss.id, sv.id, { 
                                        linkedLevel: level, 
                                        linkedComponentIds: allIds 
                                      });
                                    }}
                                                                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] outline-none focus:ring-2 focus:ring-indigo-500 text-slate-500 font-medium"
                                                                  >
                                                                    <option value="">Vincular Nível...</option>
                                                                    <option value="constructionUnit">Unidade Construtiva</option>
                                                                    <option value="block">Bloco/Módulo</option>
                                                                    <option value="floor">Pavimento</option>
                                                                    <option value="unit">Unidade/Apartamento</option>
                                                                  </select>
                                                                  {sv.linkedLevel && (
                                                                    <button 
                                                                      onClick={() => setShowSelectorFor(showSelectorFor === sv.id ? null : sv.id)}
                                                                      className={`px-2 py-1 rounded-lg text-[9px] font-bold transition ${sv.linkedComponentIds?.length ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
                                                                    >
                                                                      <i className="fas fa-list-check mr-1"></i>
                                                                      {sv.linkedComponentIds?.length || 0} Itens
                                                                    </button>
                                                                  )}
                                                                  <button onClick={() => removeService(cc.id, stage.id, ss.id, sv.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                                    <i className="fas fa-times"></i>
                                                                  </button>
                                                                </div>

                                                                {showSelectorFor === sv.id && sv.linkedLevel && (
                                                                  <div className="ml-8 p-3 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2 animate-in fade-in slide-in-from-top-1">
                                                                    <div className="flex justify-between items-center">
                                                                      <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] font-bold text-slate-500 uppercase">Selecionar Componentes</span>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                          <div className="flex gap-1">
                                                                            <button 
                                                                              onClick={() => {
                                                                                const allIds = getOptionsForLevel(sv.linkedLevel!).map(opt => opt.id);
                                                                                updateService(cc.id, stage.id, ss.id, sv.id, { linkedComponentIds: allIds });
                                                                              }}
                                                                              className="text-[8px] text-indigo-600 hover:underline font-bold"
                                                                            >
                                                                              Todos
                                                                            </button>
                                                                            <span className="text-[8px] text-slate-300">|</span>
                                                                            <button 
                                                                              onClick={() => {
                                                                                updateService(cc.id, stage.id, ss.id, sv.id, { linkedComponentIds: [] });
                                                                              }}
                                                                              className="text-[8px] text-rose-500 hover:underline font-bold"
                                                                            >
                                                                              Nenhum
                                                                            </button>
                                                                          </div>
                                                                          <div className="h-3 w-px bg-slate-200 mx-1"></div>
                                                                          <div className="flex gap-1.5 flex-wrap">
                                                                            {(() => {
                                                                              const options = getOptionsForLevel(sv.linkedLevel!);
                                                                              const uniqueNames = Array.from(new Set(options.map(o => o.name))).sort();
                                                                              return uniqueNames.map(name => {
                                                                                const idsWithName = options.filter(o => o.name === name).map(o => o.id);
                                                                                const isSelected = idsWithName.length > 0 && idsWithName.every(id => sv.linkedComponentIds?.includes(id));
                                                                                return (
                                                                                  <button
                                                                                    key={name}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                      const current = sv.linkedComponentIds || [];
                                                                                      let next;
                                                                                      if (isSelected) {
                                                                                        next = current.filter(id => !idsWithName.includes(id));
                                                                                      } else {
                                                                                        next = Array.from(new Set([...current, ...idsWithName]));
                                                                                      }
                                                                                      updateService(cc.id, stage.id, ss.id, sv.id, { linkedComponentIds: next });
                                                                                    }}
                                                                                    className={`text-[8px] px-1.5 py-0.5 rounded transition ${
                                                                                      isSelected ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium'
                                                                                    }`}
                                                                                  >
                                                                                    {name}
                                                                                  </button>
                                                                                );
                                                                              });
                                                                            })()}
                                                                          </div>
                                                                        </div>
                                                                      </div>
                                                                      <button onClick={() => setShowSelectorFor(null)} className="text-slate-400 hover:text-slate-600">
                                                                        <i className="fas fa-times text-[10px]"></i>
                                                                      </button>
                                                                    </div>
                                                                    <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1 pr-2 custom-scrollbar">
                                                                      {getOptionsForLevel(sv.linkedLevel).map(opt => (
                                                                        <label key={opt.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer transition group">
                                                                          <input 
                                                                            type="checkbox"
                                                                            checked={sv.linkedComponentIds?.includes(opt.id)}
                                                                            onChange={(e) => {
                                                                              const current = sv.linkedComponentIds || [];
                                                                              const next = e.target.checked 
                                                                                ? [...current, opt.id]
                                                                                : current.filter(id => id !== opt.id);
                                                                              updateService(cc.id, stage.id, ss.id, sv.id, { linkedComponentIds: next });
                                                                            }}
                                                                            className="w-3 h-3 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                                          />
                                                                          <div className="flex flex-col min-w-0">
                                                                            <span className="text-[10px] text-slate-700 font-medium truncate group-hover:text-indigo-600 transition">{opt.name}</span>
                                                                            {opt.parentName && <span className="text-[8px] text-slate-400 truncate">{opt.parentName}</span>}
                                                                          </div>
                                                                        </label>
                                                                      ))}
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            )}
                                                          </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                      </div>
                                                    )}
                                                  </Droppable>
                                                </div>
                                              )}
                                            </Draggable>
                                          ))}
                                          {provided.placeholder}
                                        </div>
                                      )}
                                    </Droppable>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
