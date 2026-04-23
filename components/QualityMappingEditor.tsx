import React from 'react';
import { CostCenter, FVS } from '../types';

interface QualityMappingEditorProps {
  costStructure: CostCenter[];
  fvsList: FVS[];
  mapping: { [servicePath: string]: string };
  onChange: (mapping: { [servicePath: string]: string }) => void;
}

export const QualityMappingEditor: React.FC<QualityMappingEditorProps> = ({ 
  costStructure, 
  fvsList, 
  mapping, 
  onChange 
}) => {
  const handleFvsChange = (servicePath: string, fvsId: string) => {
    const newMapping = { ...mapping };
    if (fvsId) {
      newMapping[servicePath] = fvsId;
    } else {
      delete newMapping[servicePath];
    }
    onChange(newMapping);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Vínculo de FVS por Serviço</h4>
        <p className="text-xs text-slate-500 italic">Selecione a FVS correspondente para cada serviço da obra.</p>
      </div>

      <div className="space-y-4">
        {costStructure.length === 0 ? (
          <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <i className="fas fa-info-circle text-slate-300 text-2xl mb-2"></i>
            <p className="text-slate-400 text-sm">Defina a Estrutura de Custo primeiro para vincular as FVS.</p>
          </div>
        ) : (
          costStructure.map((cc) => (
            <div key={cc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                <i className="fas fa-wallet text-indigo-500 text-xs"></i>
                <span className="font-bold text-slate-700 text-sm">{cc.name || 'Sem nome'}</span>
              </div>
              
              <div className="p-4 space-y-4">
                {cc.stages.map((stage) => (
                  <div key={stage.id} className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      <i className="fas fa-tasks text-[10px]"></i>
                      <span className="font-semibold text-xs uppercase tracking-tight">{stage.name || 'Sem nome'}</span>
                    </div>
                    
                    <div className="ml-4 space-y-3 border-l-2 border-slate-100 pl-4">
                      {stage.subStages.map((ss) => (
                        <div key={ss.id} className="space-y-2">
                          <div className="flex items-center gap-2 text-slate-500">
                            <i className="fas fa-circle text-[6px]"></i>
                            <span className="font-medium text-xs">{ss.name || 'Sem nome'}</span>
                          </div>
                          
                          <div className="ml-4 space-y-2">
                            {ss.services.map((sv) => {
                              const path = `${cc.id}|${stage.id}|${ss.id}|${sv.id}`;
                              return (
                                <div key={sv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/50 rounded-lg border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <i className="fas fa-tools text-slate-400 text-[10px]"></i>
                                    <span className="text-xs text-slate-700 font-medium truncate">{sv.name || 'Sem nome'}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 shrink-0">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">FVS:</label>
                                    <select
                                      value={mapping[path] || ''}
                                      onChange={(e) => handleFvsChange(path, e.target.value)}
                                      className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px] transition-all"
                                    >
                                      <option value="">Não vinculada</option>
                                      {fvsList.map(fvs => (
                                        <option key={fvs.id} value={fvs.id}>
                                          {fvs.code} - {fvs.name}
                                        </option>
                                      ))}
                                    </select>
                                    {mapping[path] && (
                                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-in zoom-in duration-300">
                                        <i className="fas fa-check text-[10px]"></i>
                                      </div>
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
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
