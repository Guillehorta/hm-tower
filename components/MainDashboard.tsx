import React, { useState, useMemo } from 'react';
import { Project, Employee, TimeLog, LogType, WeatherLog, ServiceExecution, UserRole, FVS } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell
} from 'recharts';
import { 
  Users, UserX, CloudRain, HardHat, 
  Calendar, CheckCircle2, AlertCircle, 
  ChevronLeft, ChevronRight, Filter,
  Clock, MapPin
} from 'lucide-react';

interface MainDashboardProps {
  projects: Project[];
  employees: Employee[];
  logs: TimeLog[];
  weatherLogs: WeatherLog[];
  serviceExecutions: ServiceExecution[];
  fvs: FVS[];
  currentUser: any;
}

type DashboardViewType = 'daily' | 'weekly' | 'monthly';

export const MainDashboard: React.FC<MainDashboardProps> = ({ 
  projects, 
  employees, 
  logs, 
  weatherLogs, 
  serviceExecutions,
  fvs,
  currentUser
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [dashboardView, setDashboardView] = useState<DashboardViewType>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const navigatePeriod = (direction: number) => {
    const newDate = new Date(selectedDate);
    if (dashboardView === 'daily') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (dashboardView === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (dashboardView === 'monthly') {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setSelectedDate(newDate);
  };

  const periodInterval = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    
    if (dashboardView === 'daily') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dashboardView === 'weekly') {
      // Monday to Sunday
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    
    return { start, end };
  }, [selectedDate, dashboardView]);

  // Filter projects based on user permissions
  const filteredProjects = useMemo(() => {
    if (currentUser.role === UserRole.ADMIN) return projects;
    return projects.filter(p => currentUser.projects?.includes(p.name) || currentUser.projects?.includes(p.id));
  }, [projects, currentUser]);

  const currentProject = useMemo(() => {
    if (selectedProjectId === 'all') return null;
    return projects.find(p => p.id === selectedProjectId);
  }, [selectedProjectId, projects]);

  // Period Stats Logic
  const periodStats = useMemo(() => {
    const { start, end } = periodInterval;
    const startTimestamp = start.getTime();
    const endTimestamp = end.getTime();
    
    // Filter logs/executions for period
    const periodLogs = logs.filter(log => log.timestamp >= startTimestamp && log.timestamp <= endTimestamp);
    
    // Filter executions that have results in this period (or started/ended)
    const filteredExecutions = serviceExecutions.filter(exec => {
       const isCorrectProject = selectedProjectId === 'all' || exec.projectId === selectedProjectId;
       // For dashboard purposes, we show executions active in this project
       // In a real scenario we'd check if strictly in the date range if they have timestamps
       return isCorrectProject;
    });

    const activeServices = filteredExecutions.filter(exec => exec.status === 'Iniciado');

    // Quality Stats
    let totalServicesEvaluated = 0;
    let nonConformitiesCount = 0;
    const ncServices: any[] = [];

    filteredExecutions.forEach(exec => {
      let hasNC = false;
      let evaluatedThisService = false;
      
      if (exec.fvsResults) {
        Object.values(exec.fvsResults).forEach(subItemMap => {
          Object.values(subItemMap).forEach(status => {
             evaluatedThisService = true;
             if (status === 'NC') {
               nonConformitiesCount++;
               hasNC = true;
             }
          });
        });
      }

      if (evaluatedThisService) {
        totalServicesEvaluated++;
      }

      if (hasNC) {
        ncServices.push(exec);
      }
    });

    // Assigned employees
    const assignedEmployees = employees.filter(emp => {
      if (emp.status !== 'Ativo') return false;
      if (selectedProjectId === 'all') return true;
      return emp.projects?.some(p => p === currentProject?.name || p === currentProject?.id);
    });

    // For Daily/Weekly/Monthly: Absences Logic
    const activeEmployeesCount = assignedEmployees.length;

    // We check unique employees present during the total period
    const presentEmployeesIds = new Set(
      periodLogs
        .filter(l => l.type === LogType.IN)
        .map(l => l.employeeId)
    );

    const absencesCount = activeEmployeesCount - assignedEmployees.filter(e => presentEmployeesIds.has(e.id)).length;
    const absentEmployees = assignedEmployees.filter(e => !presentEmployeesIds.has(e.id));

    // Total Presences count
    const totalPresences = periodLogs.filter(l => l.type === LogType.IN).length;

    // Label formatting
    let periodLabel = '';
    if (dashboardView === 'daily') {
      periodLabel = start.toLocaleDateString('pt-BR');
      if (start.toDateString() === new Date().toDateString()) periodLabel = 'Hoje';
    } else if (dashboardView === 'weekly') {
      periodLabel = `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
    } else {
      periodLabel = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }

    return {
      activeEmployeesCount,
      absencesCount,
      absentEmployees,
      totalPresences,
      activeServices,
      totalServicesEvaluated,
      nonConformitiesCount,
      ncServices,
      periodLabel,
      startTimestamp,
      endTimestamp
    };
  }, [dashboardView, periodInterval, selectedProjectId, currentProject, employees, logs, serviceExecutions]);

  // Weather Data for Chart (Variable Period)
  const chartData = useMemo(() => {
    const { start, end } = periodInterval;
    const data = [];
    const current = new Date(start);

    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const dayLogs = weatherLogs.filter(l => {
            const isCorrectProject = selectedProjectId === 'all' || l.projectId === selectedProjectId;
            return isCorrectProject && l.date === dateStr;
        });

        const precip = dayLogs.length > 0 
            ? dayLogs.reduce((acc, curr) => acc + (curr.precipitation || 0), 0) / (selectedProjectId === 'all' ? dayLogs.length : 1)
            : 0;

        data.push({
            name: dashboardView === 'monthly' ? current.getDate() : current.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
            precip: Number(precip.toFixed(1)),
            date: dateStr
        });
        current.setDate(current.getDate() + 1);
    }
    return data;
  }, [selectedProjectId, weatherLogs, periodInterval, dashboardView]);

  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-500">
      {/* Header & Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            Dashboard Executivo
            <span className="text-xs font-bold px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full uppercase tracking-widest">Live</span>
          </h2>
          <p className="text-slate-500 font-medium">Gestão integrada de obras, clima e qualidade.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button 
              onClick={() => navigatePeriod(-1)}
              className="p-2 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {dashboardView === 'daily' ? (
              <div className="flex items-center gap-2 px-2">
                <input 
                  type="date" 
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
                  className="text-[10px] font-black text-slate-700 uppercase bg-transparent border-none outline-none cursor-pointer"
                />
              </div>
            ) : (
              <div className="px-2 text-[10px] font-black text-slate-700 uppercase tracking-tight min-w-[100px] text-center">
                {periodStats.periodLabel}
              </div>
            )}

            <button 
              onClick={() => navigatePeriod(1)}
              className="p-2 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            {(['daily', 'weekly', 'monthly'] as DashboardViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setDashboardView(v)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${
                  dashboardView === v 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                {v === 'daily' ? 'Diário' : v === 'weekly' ? 'Semanal' : 'Mensal'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer min-w-[150px]"
            >
              <option value="all">Todas as Obras</option>
              {filteredProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 1: CONDIÇÕES CLIMÁTICAS */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <CloudRain className="w-6 h-6" />
           </div>
           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Condições Climáticas</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           {/* Chart Section */}
           <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                 <div>
                   <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Precipitação Acumulada</h4>
                   <p className="text-2xl font-black text-slate-800 tracking-tight mt-1">{chartData.reduce((acc, curr) => acc + curr.precip, 0).toFixed(1)}mm</p>
                 </div>
                 <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Chuva</span>
                 </div>
              </div>
              <div className="h-[250px] w-full relative min-h-[250px]" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={0}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPrecip" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} unit="mm" />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="precip" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPrecip)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Current Info Card */}
           <div className="bg-indigo-900 p-8 rounded-3xl shadow-xl text-white flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Resumo Climático</h4>
                <div className="text-5xl filter drop-shadow-lg mb-6">🌧️</div>
                <div className="space-y-4">
                  <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                     <div className="text-[10px] font-bold text-indigo-200 uppercase mb-1">Média do Período</div>
                     <div className="text-xl font-black">{(chartData.reduce((acc, curr) => acc + curr.precip, 0) / chartData.length).toFixed(1)} mm/dia</div>
                  </div>
                  <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                     <div className="text-[10px] font-bold text-indigo-200 uppercase mb-1">Dias com Chuva</div>
                     <div className="text-xl font-black">{chartData.filter(d => d.precip > 0).length} dias</div>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-indigo-800">
                 <p className="text-[10px] text-indigo-300 font-medium leading-relaxed italic">
                    Dados baseados no histórico {selectedProjectId === 'all' ? 'geral das obras' : 'da obra selecionada'}.
                 </p>
              </div>
           </div>
        </div>
      </section>

      {/* SECTION 2: COLABORADORES */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <Users className="w-6 h-6" />
           </div>
           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Colaboradores</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <StatCard icon={<Users />} label="Efetivo Total" value={periodStats.activeEmployeesCount} subtitle="Funcionários Ativos" color="indigo" />
           <StatCard icon={<CheckCircle2 />} label={`Presentes (${dashboardView === 'daily' ? 'Hoje' : 'Período'})`} value={periodStats.activeEmployeesCount - periodStats.absencesCount} subtitle={`${((1 - (periodStats.absencesCount / (periodStats.activeEmployeesCount || 1))) * 100).toFixed(0)}% de presença`} color="emerald" />
           <StatCard icon={<UserX />} label={`Absenteísmo (${dashboardView === 'daily' ? 'Hoje' : 'Período'})`} value={periodStats.absencesCount} subtitle="Faltas não justificadas" color="rose" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6">Lista de Faltas ({periodStats.periodLabel})</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                 {periodStats.absentEmployees.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 italic">Nenhuma falta registrada no período!</div>
                 ) : (
                    periodStats.absentEmployees.map(emp => (
                       <div key={emp.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 grayscale">
                             {emp.photoBase64 && emp.photoBase64.length > 0 ? (
                                <img src={emp.photoBase64} className="w-full h-full object-cover" alt="" />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                   <i className="fas fa-user text-slate-400 text-xs"></i>
                                </div>
                             )}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-700">{emp.name}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase">{emp.role} • {emp.company}</div>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
           
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6">Últimos Fluxos ({periodStats.periodLabel})</h4>
              <div className="space-y-4">
                 {logs.filter(l => l.timestamp >= periodStats.startTimestamp && l.timestamp <= periodStats.endTimestamp).slice(0, 5).map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                       <div className="flex items-center gap-3">
                           {log.capturedPhoto && log.capturedPhoto.length > 0 ? (
                              <img src={log.capturedPhoto} className="w-8 h-8 rounded-full object-cover border border-slate-200" alt="" />
                           ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                                 <i className="fas fa-user text-[10px] text-slate-400"></i>
                              </div>
                           )}
                          <div>
                             <div className="text-xs font-black text-slate-800">{log.employeeName}</div>
                             <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{log.type} às {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                       </div>
                       <div className={`w-2 h-2 rounded-full ${log.verified ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </section>

      {/* SECTION 3: SERVIÇOS */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <HardHat className="w-6 h-6" />
           </div>
           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Serviços</h3>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
           <div className="flex items-center justify-between mb-8">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Atividades em Execução ({periodStats.activeServices.length})</h4>
              <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Ver Mapa da Obra</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {periodStats.activeServices.length === 0 ? (
                 <div className="col-span-full py-12 text-center text-xs text-slate-400 italic">Nenhum serviço em execução neste momento.</div>
              ) : (
                 periodStats.activeServices.map(exec => (
                    <div key={exec.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between group hover:border-amber-200 transition-all">
                       <div>
                          <div className="text-xs font-black text-slate-800 mb-1">{exec.servicePath.split('|').pop()}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1">
                             <MapPin className="w-3 h-3" /> {projects.find(p => p.id === exec.projectId)?.name}
                          </div>
                       </div>
                       <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg uppercase">Em Andamento</span>
                          <span className="text-[10px] text-slate-400 font-bold">{exec.startDateReal}</span>
                       </div>
                    </div>
                 ))
              )}
           </div>
        </div>
      </section>

      {/* SECTION 4: QUALIDADE */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <CheckCircle2 className="w-6 h-6" />
           </div>
           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Qualidade (FVS)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-8">
                 <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Desempenho Geral</h4>
                 <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><AlertCircle className="w-5 h-5" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-6 bg-slate-50 rounded-3xl text-center">
                    <div className="text-3xl font-black text-slate-800">{periodStats.totalServicesEvaluated}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Serviços Avaliados</div>
                 </div>
                 <div className="p-6 bg-rose-50 rounded-3xl text-center border border-rose-100">
                    <div className="text-3xl font-black text-rose-600">{periodStats.nonConformitiesCount}</div>
                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-1">Não Conformidades</div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-6">Serviços com Não Conformidade</h4>
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                 {periodStats.ncServices.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 italic">Nenhum serviço com NC detectada.</div>
                 ) : (
                    periodStats.ncServices.map(exec => (
                       <div key={exec.id} className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
                          <div>
                             <div className="text-xs font-black text-rose-800">{exec.servicePath.split('|').pop()}</div>
                             <div className="text-[9px] text-rose-400 font-bold uppercase">{projects.find(p => p.id === exec.projectId)?.name}</div>
                          </div>
                          <div className="text-right">
                             <div className="text-[10px] font-black text-white bg-rose-500 px-2 py-1 rounded-lg uppercase">Ação Requerida</div>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      </section>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, label: string, value: string | number, subtitle: string, color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' }> = ({ icon, label, value, subtitle, color }) => {
  const colorMap = {
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-start hover:shadow-md transition-shadow group">
      <div className={`p-3 rounded-2xl mb-4 transition-transform group-hover:scale-110 duration-300 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-3xl font-black text-slate-800 tracking-tighter mb-1">{value}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase">{subtitle}</div>
    </div>
  );
};
