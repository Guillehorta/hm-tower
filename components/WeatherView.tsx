import React, { useState, useMemo } from 'react';
import { Project, WeatherLog } from '../types';
import { weatherService } from '../services/weatherService';

interface WeatherViewProps {
  projects: Project[];
  weatherLogs: WeatherLog[];
}

export const WeatherView: React.FC<WeatherViewProps> = ({ projects, weatherLogs }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState('2025-01-01');
  const [filterEndDate, setFilterEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const filteredLogs = useMemo(() => {
    return weatherLogs
      .filter(log => {
        const matchProject = selectedProjectId === 'all' || log.projectId === selectedProjectId;
        const matchDate = log.date >= filterStartDate && log.date <= filterEndDate;
        return matchProject && matchDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [weatherLogs, selectedProjectId, filterStartDate, filterEndDate]);

  const totalPrecipitation = useMemo(() => {
    return filteredLogs.reduce((acc, log) => acc + (log.precipitation || 0), 0);
  }, [filteredLogs]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <i className="fas fa-history"></i>
              </div>
              Histórico de Tempo
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Obra</span>
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">Todas as Obras</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Início</span>
                <input 
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Fim</span>
                <input 
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">Data</th>
                  <th className="px-6 py-4 text-left">Obra</th>
                  <th className="px-6 py-4 text-center">Manhã (9h)</th>
                  <th className="px-6 py-4 text-center">Tarde (15h)</th>
                  <th className="px-6 py-4 text-center">Noite (21h)</th>
                  <th className="px-6 py-4 text-center">Chuva (24h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                      Nenhum registro de clima encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const project = projects.find(p => p.id === log.projectId);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">
                          {new Date(log.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-semibold italic">
                          {project?.name || 'Obra não encontrada'}
                        </td>
                        <td className="px-6 py-4">
                          <WeatherCell data={log.morning} />
                        </td>
                        <td className="px-6 py-4">
                          <WeatherCell data={log.afternoon} />
                        </td>
                        <td className="px-6 py-4">
                          <WeatherCell data={log.night} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xl">
                              {(log.precipitation || 0) > 0 ? '🌧️' : '☀️'}
                            </span>
                            <span className={`text-xs font-bold ${(log.precipitation || 0) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                              {(log.precipitation || 0).toFixed(1)} mm
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Resumo do Período</h3>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                    <i className="fas fa-cloud-rain"></i>
                  </div>
                  <div className="text-xs font-bold text-blue-800 uppercase tracking-tight">Precipitação Total</div>
                </div>
                <div className="text-3xl font-black text-blue-900 leading-tight">
                  {totalPrecipitation.toFixed(1)} <span className="text-sm font-bold uppercase">mm</span>
                </div>
                <p className="text-[10px] text-blue-600 mt-2 font-medium">
                  Volume acumulado no período selecionado.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Frequência</div>
                <div className="text-xl font-bold text-slate-700">
                  {filteredLogs.filter(l => (l.precipitation || 0) > 0).length} dias <span className="text-xs text-slate-400">com chuva</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-900 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex items-baseline gap-2 mb-2">
              <i className="fas fa-info-circle text-indigo-300"></i>
              <h4 className="font-bold text-sm">Nota sobre os dados</h4>
            </div>
            <p className="text-xs text-indigo-200 leading-relaxed font-medium">
              As informações climáticas são extraídas automaticamente via API Open-Meteo com base nas coordenadas geográficas de cada obra.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const WeatherCell: React.FC<{ data: { temp: number; condition: string; conditionCode: number } }> = ({ data }) => {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl">{getIcon(data.conditionCode)}</span>
      <span className="text-xs font-bold text-slate-800">{data.temp}°C</span>
      <span className="text-[9px] text-slate-400 text-center leading-tight">{data.condition}</span>
    </div>
  );
};

function getIcon(code: number) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '⛈️';
  if (code <= 99) return '⚡';
  return '❓';
}
