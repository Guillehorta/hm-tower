import React from 'react';
import { ConstructionUnit, Block, Floor, Unit } from '../types';
import { generateId } from '../src/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ProjectHierarchyEditorProps {
  units: ConstructionUnit[];
  onChange: (units: ConstructionUnit[]) => void;
}

export const ProjectHierarchyEditor: React.FC<ProjectHierarchyEditorProps> = ({ units, onChange }) => {
  const addConstructionUnit = () => {
    const newUnit: ConstructionUnit = {
      id: generateId(),
      name: '',
      blocks: []
    };
    onChange([...units, newUnit]);
  };

  const updateConstructionUnit = (id: string, name: string) => {
    onChange(units.map(u => u.id === id ? { ...u, name } : u));
  };

  const removeConstructionUnit = (id: string) => {
    onChange(units.filter(u => u.id !== id));
  };

  const duplicateConstructionUnit = (unit: ConstructionUnit) => {
    const cloneUnit = (u: Unit): Unit => ({
      ...u,
      id: generateId()
    });

    const cloneFloor = (f: Floor): Floor => ({
      ...f,
      id: generateId(),
      units: f.units.map(cloneUnit)
    });

    const cloneBlock = (b: Block): Block => ({
      ...b,
      id: generateId(),
      floors: b.floors.map(cloneFloor)
    });

    const clonedUnit: ConstructionUnit = {
      ...unit,
      id: generateId(),
      name: `${unit.name} (Cópia)`,
      blocks: unit.blocks.map(cloneBlock)
    };

    onChange([...units, clonedUnit]);
  };

  const addBlock = (unitId: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        const newBlock: Block = { id: generateId(), name: '', floors: [] };
        return { ...u, blocks: [...u.blocks, newBlock] };
      }
      return u;
    }));
  };

  const updateBlock = (unitId: string, blockId: string, name: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          blocks: u.blocks.map(b => b.id === blockId ? { ...b, name } : b)
        };
      }
      return u;
    }));
  };

  const removeBlock = (unitId: string, blockId: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        return { ...u, blocks: u.blocks.filter(b => b.id !== blockId) };
      }
      return u;
    }));
  };

  const duplicateBlock = (unitId: string, block: Block) => {
    const cloneUnit = (u: Unit): Unit => ({
      ...u,
      id: generateId()
    });

    const cloneFloor = (f: Floor): Floor => ({
      ...f,
      id: generateId(),
      units: f.units.map(cloneUnit)
    });

    const cloneBlock = (b: Block): Block => ({
      ...b,
      id: generateId(),
      name: `${b.name} (Cópia)`,
      floors: b.floors.map(cloneFloor)
    });

    onChange(units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          blocks: [...u.blocks, cloneBlock(block)]
        };
      }
      return u;
    }));
  };

  const addFloor = (unitId: string, blockId: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          blocks: u.blocks.map(b => {
            if (b.id === blockId) {
              const newFloor: Floor = { id: generateId(), name: '', units: [] };
              return { ...b, floors: [...b.floors, newFloor] };
            }
            return b;
          })
        };
      }
      return u;
    }));
  };

  const updateFloor = (unitId: string, blockId: string, floorId: string, name: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          blocks: u.blocks.map(b => {
            if (b.id === blockId) {
              return {
                ...b,
                floors: b.floors.map(f => f.id === floorId ? { ...f, name } : f)
              };
            }
            return b;
          })
        };
      }
      return u;
    }));
  };

  const removeFloor = (unitId: string, blockId: string, floorId: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          blocks: u.blocks.map(b => {
            if (b.id === blockId) {
              return { ...b, floors: b.floors.filter(f => f.id !== floorId) };
            }
            return b;
          })
        };
      }
      return u;
    }));
  };

  const addUnit = (unitId: string, blockId: string, floorId: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          blocks: u.blocks.map(b => {
            if (b.id === blockId) {
              return {
                ...b,
                floors: b.floors.map(f => {
                  if (f.id === floorId) {
                    const newUnit: Unit = { id: generateId(), name: '' };
                    return { ...f, units: [...f.units, newUnit] };
                  }
                  return f;
                })
              };
            }
            return b;
          })
        };
      }
      return u;
    }));
  };

  const updateUnit = (unitId: string, blockId: string, floorId: string, unitSubId: string, name: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          blocks: u.blocks.map(b => {
            if (b.id === blockId) {
              return {
                ...b,
                floors: b.floors.map(f => {
                  if (f.id === floorId) {
                    return {
                      ...f,
                      units: f.units.map(un => un.id === unitSubId ? { ...un, name } : un)
                    };
                  }
                  return f;
                })
              };
            }
            return b;
          })
        };
      }
      return u;
    }));
  };

  const removeUnit = (unitId: string, blockId: string, floorId: string, unitSubId: string) => {
    onChange(units.map(u => {
      if (u.id === unitId) {
        return {
          ...u,
          blocks: u.blocks.map(b => {
            if (b.id === blockId) {
              return {
                ...b,
                floors: b.floors.map(f => {
                  if (f.id === floorId) {
                    return { ...f, units: f.units.filter(un => un.id !== unitSubId) };
                  }
                  return f;
                })
              };
            }
            return b;
          })
        };
      }
      return u;
    }));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'CONSTRUCTION_UNIT') {
      const newUnits = Array.from(units);
      const [removed] = newUnits.splice(source.index, 1);
      newUnits.splice(destination.index, 0, removed);
      onChange(newUnits);
    } else if (type === 'BLOCK') {
      const unitId = source.droppableId.split('-')[1];
      onChange(units.map(u => {
        if (u.id === unitId) {
          const newBlocks = Array.from(u.blocks);
          const [removed] = newBlocks.splice(source.index, 1);
          newBlocks.splice(destination.index, 0, removed);
          return { ...u, blocks: newBlocks };
        }
        return u;
      }));
    } else if (type === 'FLOOR') {
      const blockId = source.droppableId.split('-')[1];
      onChange(units.map(u => ({
        ...u,
        blocks: u.blocks.map(b => {
          if (b.id === blockId) {
            const newFloors = Array.from(b.floors);
            const [removed] = newFloors.splice(source.index, 1);
            newFloors.splice(destination.index, 0, removed);
            return { ...b, floors: newFloors };
          }
          return b;
        })
      })));
    } else if (type === 'UNIT') {
      const floorId = source.droppableId.split('-')[1];
      onChange(units.map(u => ({
        ...u,
        blocks: u.blocks.map(b => ({
          ...b,
          floors: b.floors.map(f => {
            if (f.id === floorId) {
              const newUnits = Array.from(f.units);
              const [removed] = newUnits.splice(source.index, 1);
              newUnits.splice(destination.index, 0, removed);
              return { ...f, units: newUnits };
            }
            return f;
          })
        }))
      })));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Estrutura Analítica do Projeto</h4>
        <button 
          onClick={addConstructionUnit}
          className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition"
        >
          <i className="fas fa-plus mr-1"></i> Unidade Construtiva
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="units-list" type="CONSTRUCTION_UNIT">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {units?.map((cu, index) => (
                <Draggable key={cu.id} draggableId={cu.id} index={index}>
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
                          <i className="fas fa-building text-xs"></i>
                        </div>
                        <input 
                          type="text" 
                          value={cu.name}
                          onChange={(e) => updateConstructionUnit(cu.id, e.target.value)}
                          placeholder="Unidade Construtiva (Ex: Bloco A)"
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                        <button onClick={() => addBlock(cu.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Adicionar Bloco/Módulo">
                          <i className="fas fa-plus-circle"></i>
                        </button>
                        <button onClick={() => duplicateConstructionUnit(cu)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Duplicar Unidade Construtiva">
                          <i className="fas fa-copy"></i>
                        </button>
                        <button onClick={() => removeConstructionUnit(cu.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>

                      <Droppable droppableId={`blocks-${cu.id}`} type="BLOCK">
                        {(provided) => (
                          <div 
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="pl-8 space-y-3 border-l-2 border-slate-200 ml-4"
                          >
                            {cu.blocks?.map((block, bIndex) => (
                              <Draggable key={block.id} draggableId={block.id} index={bIndex}>
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
                                        <i className="fas fa-cubes text-[10px]"></i>
                                      </div>
                                      <input 
                                        type="text" 
                                        value={block.name}
                                        onChange={(e) => updateBlock(cu.id, block.id, e.target.value)}
                                        placeholder="Bloco/Módulo (Ex: Bloco 1)"
                                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                      />
                                      <button onClick={() => addFloor(cu.id, block.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Adicionar Pavimento">
                                        <i className="fas fa-plus-circle"></i>
                                      </button>
                                      <button onClick={() => duplicateBlock(cu.id, block)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Duplicar Bloco/Módulo">
                                        <i className="fas fa-copy"></i>
                                      </button>
                                      <button onClick={() => removeBlock(cu.id, block.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                        <i className="fas fa-times"></i>
                                      </button>
                                    </div>

                                    <Droppable droppableId={`floors-${block.id}`} type="FLOOR">
                                      {(provided) => (
                                        <div 
                                          {...provided.droppableProps}
                                          ref={provided.innerRef}
                                          className="pl-6 space-y-2 border-l-2 border-slate-100 ml-3"
                                        >
                                          {block.floors?.map((floor, fIndex) => (
                                            <Draggable key={floor.id} draggableId={floor.id} index={fIndex}>
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
                                                      <i className="fas fa-layer-group text-[8px]"></i>
                                                    </div>
                                                    <input 
                                                      type="text" 
                                                      value={floor.name}
                                                      onChange={(e) => updateFloor(cu.id, block.id, floor.id, e.target.value)}
                                                      placeholder="Pavimento (Ex: 1º Andar)"
                                                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    <button onClick={() => addUnit(cu.id, block.id, floor.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Adicionar Unidade">
                                                      <i className="fas fa-plus-circle"></i>
                                                    </button>
                                                    <button onClick={() => removeFloor(cu.id, block.id, floor.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                      <i className="fas fa-times"></i>
                                                    </button>
                                                  </div>

                                                  <Droppable droppableId={`units-${floor.id}`} type="UNIT">
                                                    {(provided) => (
                                                      <div 
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        className="pl-6 space-y-2 border-l-2 border-indigo-50 ml-2.5"
                                                      >
                                                        {floor.units?.map((unit, uIndex) => (
                                                          <Draggable key={unit.id} draggableId={unit.id} index={uIndex}>
                                                            {(provided) => (
                                                              <div 
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className="flex gap-2 items-center"
                                                              >
                                                                <div {...provided.dragHandleProps} className="cursor-grab text-slate-100 hover:text-slate-300 p-1">
                                                                  <i className="fas fa-grip-vertical text-[6px]"></i>
                                                                </div>
                                                                <div className="w-4 h-4 bg-white rounded flex items-center justify-center text-indigo-300 border border-slate-100">
                                                                  <i className="fas fa-door-open text-[6px]"></i>
                                                                </div>
                                                                <input 
                                                                  type="text" 
                                                                  value={unit.name}
                                                                  onChange={(e) => updateUnit(cu.id, block.id, floor.id, unit.id, e.target.value)}
                                                                  placeholder="Unidade (Ex: Apto 101)"
                                                                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] outline-none focus:ring-2 focus:ring-indigo-500"
                                                                />
                                                                <button onClick={() => removeUnit(cu.id, block.id, floor.id, unit.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                                  <i className="fas fa-times"></i>
                                                                </button>
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
