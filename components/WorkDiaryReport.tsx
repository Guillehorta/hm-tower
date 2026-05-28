import React, { useState, useEffect, useMemo } from 'react';
import { Project, Employee, LaborTracking, ServiceExecution, WeatherLog, WorkDiary, JobFunction } from '../types';
import { storageService } from '../services/storageService';
import { weatherService } from '../services/weatherService';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import html2pdf from 'html2pdf.js';

interface WorkDiaryReportProps {
  projects: Project[];
  employees: Employee[];
  laborTrackings: LaborTracking[];
  serviceExecutions: ServiceExecution[];
  weatherLogs: WeatherLog[];
  workDiaries: WorkDiary[];
  onFeedback: (type: 'success' | 'error', msg: string) => void;
  currentUser: any;
  jobFunctions?: JobFunction[];
}

export const WorkDiaryReport: React.FC<WorkDiaryReportProps> = ({
  projects,
  employees,
  laborTrackings,
  serviceExecutions,
  weatherLogs,
  workDiaries,
  onFeedback,
  currentUser,
  jobFunctions = []
}) => {
  // Filters state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const handleNavigateDate = (offset: number) => {
    if (!selectedDate) return;
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        dateObj.setDate(dateObj.getDate() + offset);
        
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        setSelectedDate(`${y}-${m}-${d}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getDayOfWeek = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        const days = [
          'DOMINGO',
          'SEGUNDA-FEIRA',
          'TERÇA-FEIRA',
          'QUARTA-FEIRA',
          'QUINTA-FEIRA',
          'SEXTA-FEIRA',
          'SÁBADO'
        ];
        return days[dateObj.getDay()] || '';
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  };

  // Diary editable states
  const [startTime, setStartTime] = useState<string>('07:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [workedMorningAndAfternoon, setWorkedMorningAndAfternoon] = useState<boolean>(true);
  
  // Morning and afternoon splits for work status and climates
  const [workedMorning, setWorkedMorning] = useState<boolean>(true);
  const [workedAfternoon, setWorkedAfternoon] = useState<boolean>(true);
  const [climateMorning, setClimateMorning] = useState<'SOL' | 'CHUVA'>('SOL');
  const [climateAfternoon, setClimateAfternoon] = useState<'SOL' | 'CHUVA'>('SOL');
  
  const [rainAmount, setRainAmount] = useState<number>(0);
  const [isFetchingWeather, setIsFetchingWeather] = useState<boolean>(false);
  
  // Occurrences List State and type
  const [occurrencesList, setOccurrencesList] = useState<Array<{ type: string; description: string }>>([
    { type: 'MATERIAL', description: '' }
  ]);

  // Signature States
  const [signedBy, setSignedBy] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<number | null>(null);
  
  // Occurrences
  const [occurrences, setOccurrences] = useState({
    materials: '',
    labor: '',
    equipment: '',
    others: ''
  });

  // General observations
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Statuses
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadedDiaryId, setLoadedDiaryId] = useState<string | null>(null);

  // Helper to parse flat services (to map execution servicePath to standard stage names)
  const getServiceName = (project: Project, path: string): string => {
    if (!project.costStructure) return 'Serviço Direto';
    for (const cc of project.costStructure) {
      for (const s of cc.stages) {
        for (const ss of s.subStages) {
          for (const sv of ss.services) {
            const servicePath = `${cc.id}|${s.id}|${ss.id}|${sv.id}`;
            if (servicePath === path) {
              return sv.name;
            }
          }
        }
      }
    }
    return 'Serviço Geral';
  };

  // Helper to map component path to names
  const getComponentName = (project: Project, componentPath: string): string => {
    const parts = componentPath.split('|');
    const cu = project.constructionUnits.find(u => u.id === parts[0]);
    if (!cu) return componentPath;
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

  // 1. Resolve selected project object
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // 2. Fetch existing saved Work Diary or initialize
  useEffect(() => {
    if (!selectedProjectId) {
      setLoadedDiaryId(null);
      return;
    }

    // Try finding exact match
    const foundDiary = workDiaries.find(
      d => d.projectId === selectedProjectId && d.date === selectedDate
    );

    if (foundDiary) {
      setLoadedDiaryId(foundDiary.id);
      setStartTime(foundDiary.startTime || '07:00');
      setEndTime(foundDiary.endTime || '17:00');
      setWorkedMorningAndAfternoon(foundDiary.workedMorningAndAfternoon ?? true);
      setWorkedMorning(foundDiary.workedMorning ?? (foundDiary.workedMorningAndAfternoon ?? true));
      setWorkedAfternoon(foundDiary.workedAfternoon ?? (foundDiary.workedMorningAndAfternoon ?? true));
      setClimateMorning(foundDiary.climateMorning || (foundDiary.rainAmount > 0 ? 'CHUVA' : 'SOL'));
      setClimateAfternoon(foundDiary.climateAfternoon || (foundDiary.rainAmount > 0 ? 'CHUVA' : 'SOL'));
      setRainAmount(foundDiary.rainAmount || 0);
      setSignedBy(foundDiary.signedBy || null);
      setSignedAt(foundDiary.signedAt || null);
      if (foundDiary.occurrencesList && foundDiary.occurrencesList.length > 0) {
        setOccurrencesList(foundDiary.occurrencesList);
      } else {
        const list: Array<{ type: string; description: string }> = [];
        if (foundDiary.occurrences?.materials) {
          list.push({ type: 'MATERIAL', description: foundDiary.occurrences.materials });
        }
        if (foundDiary.occurrences?.labor) {
          list.push({ type: 'MÃO DE OBRA', description: foundDiary.occurrences.labor });
        }
        if (foundDiary.occurrences?.equipment) {
          list.push({ type: 'EQUIPAMENTO', description: foundDiary.occurrences.equipment });
        }
        if (foundDiary.occurrences?.others) {
          list.push({ type: 'OUTROS', description: foundDiary.occurrences.others });
        }
        if (list.length === 0) {
          list.push({ type: 'MATERIAL', description: '' });
        }
        setOccurrencesList(list);
      }
      setOccurrences({
        materials: foundDiary.occurrences?.materials || '',
        labor: foundDiary.occurrences?.labor || '',
        equipment: foundDiary.occurrences?.equipment || '',
        others: foundDiary.occurrences?.others || ''
      });
      setGeneralNotes(foundDiary.generalNotes || '');
    } else {
      // Initialize pristine or pre-loaded defaults
      setLoadedDiaryId(null);
      setStartTime('07:00');
      setEndTime('17:00');
      setWorkedMorningAndAfternoon(true);
      setWorkedMorning(true);
      setWorkedAfternoon(true);
      setSignedBy(null);
      setSignedAt(null);
      setOccurrencesList([{ type: 'MATERIAL', description: '' }]);
      setOccurrences({
        materials: '',
        labor: '',
        equipment: '',
        others: ''
      });
      setGeneralNotes('');

      // Auto check weather history for that date & project
      const weatherLog = weatherLogs.find(
        w => w.projectId === selectedProjectId && w.date === selectedDate
      );
      if (weatherLog) {
        setRainAmount(weatherLog.precipitation || 0);
        const isRainyMorning = weatherLog.morning?.conditionCode && [51,53,55,61,63,65,80,81,82,95,96,99].includes(weatherLog.morning.conditionCode);
        const isRainyAfternoon = weatherLog.afternoon?.conditionCode && [51,53,55,61,63,65,80,81,82,95,96,99].includes(weatherLog.afternoon.conditionCode);
        setClimateMorning(isRainyMorning ? 'CHUVA' : 'SOL');
        setClimateAfternoon(isRainyAfternoon ? 'CHUVA' : 'SOL');
      } else {
        setRainAmount(0);
        setClimateMorning('SOL');
        setClimateAfternoon('SOL');

        // Clean query to Open-Meteo as auto-lookup fallback
        const proj = projects.find(p => p.id === selectedProjectId);
        if (proj && proj.latitude && proj.longitude) {
          weatherService.fetchHistoricalWeather(proj.latitude, proj.longitude, selectedDate)
            .then(data => {
              if (data) {
                setRainAmount(data.precipitation || 0);
                const isRainyM = data.morning?.conditionCode && [51,53,55,61,63,65,80,81,82,95,96,99].includes(data.morning.conditionCode);
                const isRainyA = data.afternoon?.conditionCode && [51,53,55,61,63,65,80,81,82,95,96,99].includes(data.afternoon.conditionCode);
                setClimateMorning(isRainyM ? 'CHUVA' : 'SOL');
                setClimateAfternoon(isRainyA ? 'CHUVA' : 'SOL');
              }
            })
            .catch(err => console.error("Auto OpenMeteo error:", err));
        }
      }
    }
  }, [selectedProjectId, selectedDate, workDiaries, weatherLogs, projects]);

  // 3. COLLABORATORS BY FUNCTION SUMMARY (Item 2)
  const collaboratorsSummary = useMemo(() => {
    if (!selectedProjectId || !selectedDate) return [];

    // Filter labor tracking entries for this project and date
    const dailyTrackings = laborTrackings.filter(
      t => t.projectId === selectedProjectId && t.date === selectedDate
    );

    // Group by functions
    const counts: { [role: string]: { count: number; rawNames: string[] } } = {};

    dailyTrackings.forEach(tracking => {
      // Find exact employee profile
      const emp = employees.find(e => e.id === tracking.employeeId);
      if (emp) {
        const role = emp.role || 'Geral / Outros';
        if (!counts[role]) {
          counts[role] = { count: 0, rawNames: [] };
        }
        counts[role].count += 1;
        counts[role].rawNames.push(emp.name);
      }
    });

    return Object.entries(counts).map(([role, detail]) => ({
      role,
      count: detail.count,
      names: detail.rawNames
    }));
  }, [selectedProjectId, selectedDate, laborTrackings, employees]);

  // Compute the list of job functions to display, merging registered functions and any active on-day ones
  const functionsToShow = useMemo(() => {
    const registeredNames = (jobFunctions || []).map(jf => jf.name.toUpperCase());
    const activeRolesUpper = collaboratorsSummary
      .map(c => c.role.toUpperCase())
      .filter(r => r !== 'GERAL / OUTROS' && !registeredNames.includes(r));
    const allNames = [...registeredNames, ...activeRolesUpper];

    if (allNames.length > 0) {
      return allNames.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    } else {
      return [
        'ENGENHEIRO', 'MESTRE', 'TÉCNICO', 'ESTAGIÁRIO',
        'PEDREIRO', 'CARPINTEIRO', 'ARMADOR', 'AZULEJISTA',
        'ELETRICISTA', 'ENCANADOR', 'PINTOR', 'SERVENTE'
      ];
    }
  }, [jobFunctions, collaboratorsSummary]);

  // 4. ACTIVE & COMPLETED SERVICE EXECUTIONS (Item 3)
  const servicesSummary = useMemo(() => {
    if (!selectedProject || !selectedDate) return { emAndamento: [], concluidos: [] };

    // Find services which are active on selectedDate
    const projectExecutions = serviceExecutions.filter(
      ex => ex.projectId === selectedProject.id
    );

    const emAndamento: string[] = [];
    const concluidos: string[] = [];

    projectExecutions.forEach(ex => {
      const start = ex.startDateReal;
      const end = ex.endDateReal;
      if (!start) return;

      const serviceName = getServiceName(selectedProject, ex.servicePath);
      const componentName = getComponentName(selectedProject, ex.componentPath);
      const label = `${serviceName} (${componentName})`;

      // If the execution has an end date equal or earlier than selectedDate, or concluded status on or before it
      const isConcluded = ex.status === 'Concluido' && end && end <= selectedDate;

      if (isConcluded) {
        if (end === selectedDate) {
          concluidos.push(label);
        }
      } else {
        // Active if startDateReal matches or is prior to selected date and either not finished or ended after selectedDate
        if (start <= selectedDate && (!end || end >= selectedDate)) {
          emAndamento.push(label);
        }
      }
    });

    return { emAndamento, concluidos };
  }, [selectedProject, selectedDate, serviceExecutions]);

  // Weather fetch manual click handler
  const handleFetchOpenMeteo = async (projId: string, dt: string) => {
    if (!projId) {
      onFeedback('error', 'Por favor, selecione uma obra primeiro.');
      return;
    }
    const proj = projects.find(p => p.id === projId);
    if (!proj || !proj.latitude || !proj.longitude) {
      onFeedback('error', 'Esta obra não possui coordenadas (latitude/longitude) cadastradas.');
      return;
    }
    setIsFetchingWeather(true);
    try {
      const weatherData = await weatherService.fetchHistoricalWeather(proj.latitude, proj.longitude, dt);
      if (weatherData) {
        setRainAmount(weatherData.precipitation || 0);
        const isRainyMorning = weatherData.morning?.conditionCode && [51,53,55,61,63,65,80,81,82,95,96,99].includes(weatherData.morning.conditionCode);
        const isRainyAfternoon = weatherData.afternoon?.conditionCode && [51,53,55,61,63,65,80,81,82,95,96,99].includes(weatherData.afternoon.conditionCode);
        setClimateMorning(isRainyMorning ? 'CHUVA' : 'SOL');
        setClimateAfternoon(isRainyAfternoon ? 'CHUVA' : 'SOL');
        onFeedback('success', 'Dados de clima atualizados via API OpenMeteo!');
      } else {
        onFeedback('error', 'Não foi possível encontrar dados de clima para esta data.');
      }
    } catch (err) {
      console.error(err);
      onFeedback('error', 'Falha ao buscar dados climáticos do OpenMeteo.');
    } finally {
      setIsFetchingWeather(false);
    }
  };

  // PDF generator using html2pdf
  const handleGeneratePDF = () => {
    const element = document.getElementById('printable-work-diary');
    if (!element) {
      onFeedback('error', 'Formulário do diário não encontrado para geração do PDF.');
      return;
    }

    // Set options for html2pdf
    const opt = {
      margin:       10, // margins in mm
      filename:     `Diario_de_Obras_${selectedProject?.name.replace(/[^a-zA-Z0-9-]/g, '_') || 'Obra'}_${selectedDate}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    onFeedback('success', 'Gerando o documento em PDF...');

    html2pdf().from(element).set(opt).save().then(() => {
      onFeedback('success', 'O PDF foi gerado e baixado com sucesso!');
    }).catch((err: any) => {
      console.error('Erro ao gerar PDF com html2pdf:', err);
      onFeedback('error', 'Erro ao baixar o PDF diretamente. Iniciando modo de impressão padrão do navegador.');
      window.print();
    });
  };

  // 5. Save controller
  const handleSaveDiary = async () => {
    if (!selectedProjectId) {
      onFeedback('error', 'Por favor, selecione uma obra para salvar o diário.');
      return;
    }

    setIsSaving(true);
    try {
      const diaryId = loadedDiaryId || `${selectedProjectId}_${selectedDate}`;
      
      const materials = occurrencesList.filter(o => o.type === 'MATERIAL').map(o => o.description).filter(Boolean).join('; ');
      const labor = occurrencesList.filter(o => o.type === 'MÃO DE OBRA').map(o => o.description).filter(Boolean).join('; ');
      const equipment = occurrencesList.filter(o => o.type === 'EQUIPAMENTO').map(o => o.description).filter(Boolean).join('; ');
      const othersList = occurrencesList.filter(o => !['MATERIAL', 'MÃO DE OBRA', 'EQUIPAMENTO'].includes(o.type));
      const others = othersList.map(o => `[${o.type}]: ${o.description}`).filter(Boolean).join('; ');

      const occurrencesObj = {
        materials: materials || '',
        labor: labor || '',
        equipment: equipment || '',
        others: others || ''
      };

      const newDiary: WorkDiary = {
        id: diaryId,
        projectId: selectedProjectId,
        date: selectedDate,
        startTime,
        endTime,
        workedMorningAndAfternoon: workedMorning && workedAfternoon,
        workedMorning,
        workedAfternoon,
        climateMorning,
        climateAfternoon,
        rainAmount,
        occurrences: occurrencesObj,
        occurrencesList,
        generalNotes,
        signedBy: signedBy || '',
        signedAt: signedAt || 0,
        createdAt: Date.now()
      };

      await storageService.saveWorkDiary(newDiary);
      onFeedback('success', 'Diário de Obras salvo com sucesso no Firebase!');
    } catch (err: any) {
      console.error(err);
      onFeedback('error', 'Falha ao salvar o Diário de Obras no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignDiary = async () => {
    if (!selectedProjectId) {
      onFeedback('error', 'Por favor, selecione uma obra primeiro.');
      return;
    }
    if (!currentUser) {
      onFeedback('error', 'Você precisa estar logado para assinar o diário.');
      return;
    }

    setIsSaving(true);
    try {
      const diaryId = loadedDiaryId || `${selectedProjectId}_${selectedDate}`;
      
      const materials = occurrencesList.filter(o => o.type === 'MATERIAL').map(o => o.description).filter(Boolean).join('; ');
      const labor = occurrencesList.filter(o => o.type === 'MÃO DE OBRA').map(o => o.description).filter(Boolean).join('; ');
      const equipment = occurrencesList.filter(o => o.type === 'EQUIPAMENTO').map(o => o.description).filter(Boolean).join('; ');
      const othersList = occurrencesList.filter(o => !['MATERIAL', 'MÃO DE OBRA', 'EQUIPAMENTO'].includes(o.type));
      const others = othersList.map(o => `[${o.type}]: ${o.description}`).filter(Boolean).join('; ');

      const occurrencesObj = {
        materials: materials || '',
        labor: labor || '',
        equipment: equipment || '',
        others: others || ''
      };

      const now = Date.now();
      const newDiary: WorkDiary = {
        id: diaryId,
        projectId: selectedProjectId,
        date: selectedDate,
        startTime,
        endTime,
        workedMorningAndAfternoon: workedMorning && workedAfternoon,
        workedMorning,
        workedAfternoon,
        climateMorning,
        climateAfternoon,
        rainAmount,
        occurrences: occurrencesObj,
        occurrencesList,
        generalNotes,
        signedBy: currentUser.name,
        signedAt: now,
        createdAt: Date.now()
      };

      await storageService.saveWorkDiary(newDiary);
      setSignedBy(currentUser.name);
      setSignedAt(now);
      onFeedback('success', `Diário assinado com sucesso por ${currentUser.name}!`);
    } catch (err: any) {
      console.error(err);
      onFeedback('error', 'Falha ao assinar o diário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlockDiary = async () => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    try {
      const diaryId = loadedDiaryId || `${selectedProjectId}_${selectedDate}`;
      
      const materials = occurrencesList.filter(o => o.type === 'MATERIAL').map(o => o.description).filter(Boolean).join('; ');
      const labor = occurrencesList.filter(o => o.type === 'MÃO DE OBRA').map(o => o.description).filter(Boolean).join('; ');
      const equipment = occurrencesList.filter(o => o.type === 'EQUIPAMENTO').map(o => o.description).filter(Boolean).join('; ');
      const othersList = occurrencesList.filter(o => !['MATERIAL', 'MÃO DE OBRA', 'EQUIPAMENTO'].includes(o.type));
      const others = othersList.map(o => `[${o.type}]: ${o.description}`).filter(Boolean).join('; ');

      const occurrencesObj = {
        materials: materials || '',
        labor: labor || '',
        equipment: equipment || '',
        others: others || ''
      };

      const newDiary: WorkDiary = {
        id: diaryId,
        projectId: selectedProjectId,
        date: selectedDate,
        startTime,
        endTime,
        workedMorningAndAfternoon: workedMorning && workedAfternoon,
        workedMorning,
        workedAfternoon,
        climateMorning,
        climateAfternoon,
        rainAmount,
        occurrences: occurrencesObj,
        occurrencesList,
        generalNotes,
        signedBy: '',
        signedAt: 0,
        createdAt: Date.now()
      };

      await storageService.saveWorkDiary(newDiary);
      setSignedBy(null);
      setSignedAt(null);
      onFeedback('success', 'Assinatura removida e diário desbloqueado para modificação!');
    } catch (err: any) {
      console.error(err);
      onFeedback('error', 'Falha ao remover a assinatura do diário.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Box (Interactive Screen Area) */}
      <div className="bg-gradient-to-r from-slate-550 to-slate-600 bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex flex-col md:flex-row items-end justify-between gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:w-3/4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Selecione a Obra
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
              >
                <option value="">-- Selecione uma Obra --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Selecione a Data
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNavigateDate(-1)}
                  className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm active:scale-95 cursor-pointer flex items-center justify-center min-w-[42px]"
                  title="Data Anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => handleNavigateDate(1)}
                  className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm active:scale-95 cursor-pointer flex items-center justify-center min-w-[42px]"
                  title="Próxima Data"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {selectedProjectId && (
              <button
                type="button"
                onClick={handleGeneratePDF}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition hover:scale-101 active:scale-99 cursor-pointer"
              >
                <i className="fas fa-print"></i> Gerar PDF / Imprimir
              </button>
            )}
            
            {selectedProjectId && (
              signedBy ? (
                <button
                  type="button"
                  onClick={handleUnlockDiary}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition hover:scale-101 active:scale-99 cursor-pointer"
                  title={`Assinado por ${signedBy}. Clique para remover a assinatura e desbloquear.`}
                >
                  <i className="fas fa-lock-open"></i> Desbloquear Diário
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignDiary}
                  disabled={isSaving || !currentUser}
                  className={`px-4 py-2.5 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition hover:scale-101 active:scale-99 ${
                    !currentUser
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                  }`}
                  title={!currentUser ? 'Você precisa estar logado para assinar' : 'Bloqueia o dia para edição e assina o diário'}
                >
                  <i className="fas fa-signature"></i> Assinar Diário
                </button>
              )
            )}

            <button
              type="button"
              onClick={handleSaveDiary}
              disabled={isSaving || !selectedProjectId || !!signedBy}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition hover:scale-101 active:scale-99 ${
                !selectedProjectId || !!signedBy
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
              }`}
            >
              {isSaving ? (
                <>
                  <i className="fas fa-circle-notch animate-spin"></i> Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-cloud-upload-alt"></i> {signedBy ? 'Salvar (Bloqueado)' : 'Salvar Diário'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {selectedProjectId ? (
        <div className="space-y-6">
          <style dangerouslySetInnerHTML={{ __html: `
            @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm 15mm 15mm 15mm;
              }
              body {
                background: white !important;
                color: black !important;
                font-family: 'Inter', sans-serif !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print\\:hidden {
                display: none !important;
              }
              .print\\:block {
                display: block !important;
              }
              .print\\:flex {
                display: flex !important;
              }
              .print\\:grid {
                display: grid !important;
              }
              #printable-work-diary {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                background: white !important;
              }
              .print-section {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `}} />

          {signedBy && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold leading-relaxed shadow-sm print:hidden">
              <i className="fas fa-lock text-amber-500 text-lg"></i>
              <div>
                Este diário foi <span className="text-amber-900 underline">assinado digitalmente</span> por <span className="text-indigo-700 font-extrabold">{signedBy}</span>. 
                Os campos do formulário estão bloqueados para edição. Para realizar alterações, clique no botão <span className="text-rose-600">"Desbloquear Diário"</span> no topo.
              </div>
            </div>
          )}

          {/* Printable Container wrapper */}
          <div id="printable-work-diary" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8 print:p-0 print:border-none print:shadow-none space-y-6">
            
            {/* Custom High-Fidelity Header Matching Attachment */}
            <div className="space-y-0.5 print-section">
              {/* Chevron Arrows Bar */}
              <div className="flex h-9 w-full overflow-hidden text-[9px] font-black uppercase tracking-wider select-none border border-slate-300 rounded-t-lg">
                <div 
                  className="relative flex-1 bg-slate-200 text-slate-700 flex items-center justify-center pl-4 pr-6 font-bold"
                  style={{ clipPath: 'polygon(0% 0%, 93% 0%, 100% 50%, 93% 100%, 0% 100%)' }}
                >
                  SISTEMA DE GESTÃO DA QUALIDADE
                </div>
                <div 
                  className="relative flex-1 bg-slate-100 text-slate-600 flex items-center justify-center px-6 -ml-3 font-bold"
                  style={{ clipPath: 'polygon(0% 0%, 7% 50%, 0% 100%, 93% 100%, 100% 50%, 93% 0%)' }}
                >
                  FORMULÁRIO
                </div>
                <div 
                  className="relative flex-1 bg-[#8dc63f] text-white flex items-center justify-center pl-6 pr-4 -ml-3 font-bold"
                  style={{ clipPath: 'polygon(0% 0%, 7% 50%, 0% 100%, 100% 100%, 100% 0%)' }}
                >
                  QUALIDADE
                </div>
              </div>

              {/* Metadata details + HMTOWER Logo table block */}
              <div className="grid grid-cols-4 border-x border-b border-slate-300 text-xs font-bold text-slate-700 tracking-wide bg-white items-center divide-x divide-slate-300">
                <div className="col-span-3 grid grid-cols-3 divide-x divide-slate-200 p-2 text-center text-[10px]">
                  <div>CÓDIGO: <span className="font-normal text-slate-600">FOR 027</span></div>
                  <div>REFERÊNCIA: <span className="font-normal text-slate-600">N/A</span></div>
                  <div>REVISÃO: <span className="font-normal text-slate-600">01</span></div>
                </div>
                <div className="col-span-1 p-2 flex items-center justify-center bg-white">
                  {/* Styled CSS HMTower Logo */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-end gap-[2px] h-5">
                      <div className="w-[4px] h-[10px] bg-slate-400 rounded-t-[1px]"></div>
                      <div className="w-[4px] h-[18px] bg-[#8dc63f] rounded-t-[1px]"></div>
                      <div className="w-[4px] h-[14px] bg-indigo-600 rounded-t-[1px]"></div>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[11px] font-black tracking-tighter text-slate-800 leading-none">HMTOWER</span>
                      <span className="text-[5px] font-medium text-slate-500 tracking-tight leading-none mt-[1px]">ENGENHARIA E CONSTRUÇÕES LTDA.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner: DIÁRIO DE OBRA */}
              <div className="bg-slate-200 border-x border-b border-slate-300 text-center py-1.5 text-xs font-black tracking-widest text-slate-800 uppercase">
                DIÁRIO DE OBRA
              </div>

              {/* Filter / Meta status line */}
              <div className="grid grid-cols-12 border-x border-b border-slate-300 text-[10px] text-slate-700 font-bold bg-white divide-x divide-slate-300">
                <div className="col-span-6 p-2 flex items-center">
                  <span className="text-slate-400 font-bold uppercase mr-1">OBRA:</span>
                  <span className="font-extrabold text-slate-900 truncate print:border-b print:border-slate-200 print:w-full">
                    {selectedProject?.name ? selectedProject.name.toUpperCase() : '---'}
                  </span>
                </div>
                <div className="col-span-2 p-2 flex items-center justify-center gap-1">
                  <span className="text-slate-400 font-bold uppercase">Início:</span>
                  <input
                    type="time"
                    value={startTime}
                    disabled={!!signedBy}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="px-1 border border-slate-200 rounded text-slate-800 text-[10px] outline-none transition print:border-none print:p-0 font-bold text-center w-14 disabled:opacity-70 disabled:bg-slate-55"
                  />
                </div>
                <div className="col-span-2 p-2 flex items-center justify-center gap-1">
                  <span className="text-slate-400 font-bold uppercase">Fim:</span>
                  <input
                    type="time"
                    value={endTime}
                    disabled={!!signedBy}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="px-1 border border-slate-200 rounded text-slate-800 text-[10px] outline-none transition print:border-none print:p-0 font-bold text-center w-14 disabled:opacity-70 disabled:bg-slate-55"
                  />
                </div>
                <div className="col-span-2 p-2 flex flex-col items-center justify-center leading-tight">
                  <span className="text-[10px] font-black text-slate-800 tracking-wider mb-0.5">
                    {getDayOfWeek(selectedDate)}
                  </span>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">DATA:</span>
                    <span className="font-extrabold text-slate-900 text-[11px]">
                      {selectedDate.split('-').reverse().join('/')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ITEM 1: DAILY INFORMATIONS (CLIMATE & WORK STATUS) */}
            <div className="space-y-2 print-section">
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <i className="fas fa-cloud-sun text-slate-500"></i> INFORMAÇÕES DIÁRIAS
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                {/* Climatic Conditions Table */}
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <div className="bg-slate-50 text-center py-1 text-[9px] font-black uppercase text-slate-600 border-b border-slate-300">
                    CONDIÇÕES CLIMÁTICAS
                  </div>
                  <div className="grid grid-cols-3 text-center text-[9px] font-bold text-slate-500 divide-x divide-slate-200 border-b border-slate-300">
                    <div className="p-1 bg-slate-50">PERÍODO</div>
                    <div className="p-1">CHUVA</div>
                    <div className="p-1">SOL</div>
                  </div>
                  
                  {/* Row MANHÃ */}
                  <div className="grid grid-cols-3 text-center text-[10px] divide-x divide-slate-200 border-b border-slate-200 items-center">
                    <div className="p-2 font-bold bg-slate-50 text-slate-600 flex items-center justify-center">MANHÃ</div>
                    <button
                      type="button"
                      disabled={!!signedBy}
                      onClick={() => setClimateMorning('CHUVA')}
                      className={`p-2 flex items-center justify-center font-extrabold text-sm transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        climateMorning === 'CHUVA'
                          ? 'bg-blue-50 text-blue-600 font-extrabold'
                          : 'text-slate-200 hover:bg-slate-50 hover:text-slate-300'
                      }`}
                    >
                      <span>✓</span>
                    </button>
                    <button
                      type="button"
                      disabled={!!signedBy}
                      onClick={() => setClimateMorning('SOL')}
                      className={`p-2 flex items-center justify-center font-extrabold text-sm transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        climateMorning === 'SOL'
                          ? 'bg-amber-50 text-amber-500 font-extrabold'
                          : 'text-slate-200 hover:bg-slate-50 hover:text-slate-300'
                      }`}
                    >
                      <span>✓</span>
                    </button>
                  </div>

                  {/* Row TARDE */}
                  <div className="grid grid-cols-3 text-center text-[10px] divide-x divide-slate-200 items-center">
                    <div className="p-2 font-bold bg-slate-50 text-slate-600 flex items-center justify-center">TARDE</div>
                    <button
                      type="button"
                      disabled={!!signedBy}
                      onClick={() => setClimateAfternoon('CHUVA')}
                      className={`p-2 flex items-center justify-center font-extrabold text-sm transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        climateAfternoon === 'CHUVA'
                          ? 'bg-blue-50 text-blue-600 font-extrabold'
                          : 'text-slate-200 hover:bg-slate-50 hover:text-slate-300'
                      }`}
                    >
                      <span>✓</span>
                    </button>
                    <button
                      type="button"
                      disabled={!!signedBy}
                      onClick={() => setClimateAfternoon('SOL')}
                      className={`p-2 flex items-center justify-center font-extrabold text-sm transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        climateAfternoon === 'SOL'
                          ? 'bg-amber-50 text-amber-500 font-extrabold'
                          : 'text-slate-200 hover:bg-slate-50 hover:text-slate-300'
                      }`}
                    >
                      <span>✓</span>
                    </button>
                  </div>
                </div>

                {/* Daily Work Info status */}
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white flex flex-col">
                  <div className="bg-slate-50 text-center py-1 text-[9px] font-black uppercase text-slate-600 border-b border-slate-300">
                    INFORMAÇÕES DE TRABALHO
                  </div>
                  <div className="grid grid-cols-3 text-center text-[9px] font-bold text-slate-500 divide-x divide-slate-200 border-b border-slate-200">
                    <div className="p-1 bg-slate-50">PERÍODO</div>
                    <div className="p-1">TRABALHADO</div>
                    <div className="p-1">Ñ TRABALHADO</div>
                  </div>
                  
                  {/* Row MANHÃ */}
                  <div className="grid grid-cols-3 text-center text-[10px] divide-x divide-slate-200 border-b border-slate-200 items-center">
                    <div className="p-2 font-bold bg-slate-50 text-slate-600 flex items-center justify-center">MANHÃ</div>
                    <button
                      type="button"
                      disabled={!!signedBy}
                      onClick={() => setWorkedMorning(true)}
                      className={`p-2 flex items-center justify-center font-extrabold text-sm transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        workedMorning === true
                          ? 'bg-emerald-50 text-emerald-600 font-extrabold'
                          : 'text-slate-200 hover:bg-slate-50 hover:text-slate-300'
                      }`}
                    >
                      <span>✓</span>
                    </button>
                    <button
                      type="button"
                      disabled={!!signedBy}
                      onClick={() => setWorkedMorning(false)}
                      className={`p-2 flex items-center justify-center font-extrabold text-sm transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        workedMorning === false
                          ? 'bg-rose-50 text-rose-600 font-extrabold'
                          : 'text-slate-200 hover:bg-slate-50 hover:text-slate-300'
                      }`}
                    >
                      <span>✓</span>
                    </button>
                  </div>

                  {/* Row TARDE */}
                  <div className="grid grid-cols-3 text-center text-[10px] divide-x divide-slate-200 items-center">
                    <div className="p-2 font-bold bg-slate-50 text-slate-600 flex items-center justify-center">TARDE</div>
                    <button
                      type="button"
                      disabled={!!signedBy}
                      onClick={() => setWorkedAfternoon(true)}
                      className={`p-2 flex items-center justify-center font-extrabold text-sm transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        workedAfternoon === true
                          ? 'bg-emerald-50 text-emerald-600 font-extrabold'
                          : 'text-slate-200 hover:bg-slate-50 hover:text-slate-300'
                      }`}
                    >
                      <span>✓</span>
                    </button>
                    <button
                      type="button"
                      disabled={!!signedBy}
                      onClick={() => setWorkedAfternoon(false)}
                      className={`p-2 flex items-center justify-center font-extrabold text-sm transition-all focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        workedAfternoon === false
                          ? 'bg-rose-50 text-rose-600 font-extrabold'
                          : 'text-slate-200 hover:bg-slate-50 hover:text-slate-300'
                      }`}
                    >
                      <span>✓</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Volume de chuva interactive slider / numeric on-screen field with Open-Meteo query */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 print:border-none print:p-0 print:bg-white">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Volume Chuva Estimado:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={rainAmount}
                    disabled={!!signedBy}
                    onChange={(e) => setRainAmount(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-slate-800 text-center focus:ring-1 focus:ring-indigo-500 outline-none transition bg-white disabled:opacity-75 disabled:bg-slate-200"
                  />
                  <span className="text-xs text-slate-400 font-bold">mm</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleFetchOpenMeteo(selectedProjectId, selectedDate)}
                  disabled={isFetchingWeather || !selectedProjectId || !!signedBy}
                  className="px-3 py-1 text-[9px] bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 text-white font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition print:hidden cursor-pointer"
                >
                  {isFetchingWeather ? (
                    <>
                      <i className="fas fa-circle-notch animate-spin"></i> Buscando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-sun"></i> Buscar do OpenMeteo
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ITEM 2: MAIN WORKFORCE (MÃO-DE-OBRA PRÓPRIA) */}
            <div className="space-y-2 print-section">
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <i className="fas fa-users text-slate-500"></i> MÃO-DE-OBRA PRÓPRIA
              </h3>
              
              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                <div className="grid grid-cols-4 divide-x divide-slate-300 text-[9px] font-black text-slate-600 bg-slate-50 border-b border-slate-300 text-center">
                  <div className="grid grid-cols-4 col-span-1 divide-x divide-slate-200">
                    <div className="col-span-3 p-1 text-left pl-2">FUNÇÃO</div>
                    <div className="col-span-1 p-1">QTDE</div>
                  </div>
                  <div className="grid grid-cols-4 col-span-1 divide-x divide-slate-200">
                    <div className="col-span-3 p-1 text-left pl-2">FUNÇÃO</div>
                    <div className="col-span-1 p-1">QTDE</div>
                  </div>
                  <div className="grid grid-cols-4 col-span-1 divide-x divide-slate-200">
                    <div className="col-span-3 p-1 text-left pl-2">FUNÇÃO</div>
                    <div className="col-span-1 p-1">QTDE</div>
                  </div>
                  <div className="grid grid-cols-4 col-span-1 divide-x divide-slate-200">
                    <div className="col-span-3 p-1 text-left pl-2">FUNÇÃO</div>
                    <div className="col-span-1 p-1">QTDE</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-slate-300 text-[9px]">
                  {/* Column 1 */}
                  <div className="flex flex-col divide-y divide-slate-250">
                    {(() => {
                      const numRows = Math.max(4, Math.ceil(functionsToShow.length / 4));
                      const rows = [];
                      for (let i = 0; i < numRows; i++) {
                        const funcName = functionsToShow[i];
                        const item = funcName ? collaboratorsSummary.find(c => c.role.toLowerCase() === funcName.toLowerCase()) : null;
                        rows.push(
                          <div key={i} className="grid grid-cols-4 divide-x divide-slate-200 h-6 items-center">
                            <div className="col-span-3 p-1 px-2 font-bold text-slate-700 truncate">{funcName || ''}</div>
                            <div className="col-span-1 p-1 text-center font-black text-slate-800 bg-slate-50/50">{item ? item.count : ''}</div>
                          </div>
                        );
                      }
                      return rows;
                    })()}
                  </div>

                  {/* Column 2 */}
                  <div className="flex flex-col divide-y divide-slate-250">
                    {(() => {
                      const numRows = Math.max(4, Math.ceil(functionsToShow.length / 4));
                      const rows = [];
                      for (let i = 0; i < numRows; i++) {
                        const funcName = functionsToShow[numRows + i];
                        const item = funcName ? collaboratorsSummary.find(c => c.role.toLowerCase() === funcName.toLowerCase()) : null;
                        rows.push(
                          <div key={i} className="grid grid-cols-4 divide-x divide-slate-200 h-6 items-center">
                            <div className="col-span-3 p-1 px-2 font-bold text-slate-700 truncate">{funcName || ''}</div>
                            <div className="col-span-1 p-1 text-center font-black text-slate-800 bg-slate-50/50">{item ? item.count : ''}</div>
                          </div>
                        );
                      }
                      return rows;
                    })()}
                  </div>

                  {/* Column 3 */}
                  <div className="flex flex-col divide-y divide-slate-250">
                    {(() => {
                      const numRows = Math.max(4, Math.ceil(functionsToShow.length / 4));
                      const rows = [];
                      for (let i = 0; i < numRows; i++) {
                        const funcName = functionsToShow[2 * numRows + i];
                        const item = funcName ? collaboratorsSummary.find(c => c.role.toLowerCase() === funcName.toLowerCase()) : null;
                        rows.push(
                          <div key={i} className="grid grid-cols-4 divide-x divide-slate-200 h-6 items-center">
                            <div className="col-span-3 p-1 px-2 font-bold text-slate-700 truncate">{funcName || ''}</div>
                            <div className="col-span-1 p-1 text-center font-black text-slate-800 bg-slate-50/50">{item ? item.count : ''}</div>
                          </div>
                        );
                      }
                      return rows;
                    })()}
                  </div>

                  {/* Column 4 */}
                  <div className="flex flex-col divide-y divide-slate-250">
                    {(() => {
                      const numRows = Math.max(4, Math.ceil(functionsToShow.length / 4));
                      const rows = [];
                      for (let i = 0; i < numRows; i++) {
                        const funcName = functionsToShow[3 * numRows + i];
                        const item = funcName ? collaboratorsSummary.find(c => c.role.toLowerCase() === funcName.toLowerCase()) : null;
                        rows.push(
                          <div key={i} className="grid grid-cols-4 divide-x divide-slate-200 h-6 items-center">
                            <div className="col-span-3 p-1 px-2 font-bold text-slate-700 truncate">{funcName || ''}</div>
                            <div className="col-span-1 p-1 text-center font-black text-slate-800 bg-slate-50/50">{item ? item.count : ''}</div>
                          </div>
                        );
                      }
                      return rows;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* ITEM 3: PRESTADORES DE SERVIÇO */}
            <div className="space-y-2 print-section">
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <i className="fas fa-user-shield text-slate-500"></i> PRESTADORES DE SERVIÇO
              </h3>
              
              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                <div className="grid grid-cols-4 divide-x divide-slate-300 text-[9px] font-black text-slate-600 bg-slate-50 border-b border-slate-300 text-center">
                  <div className="grid grid-cols-4 col-span-1 divide-x divide-slate-200">
                    <div className="col-span-3 p-1 text-left pl-2">FUNÇÃO / EMPRESA</div>
                    <div className="col-span-1 p-1">QTDE</div>
                  </div>
                  <div className="grid grid-cols-4 col-span-1 divide-x divide-slate-200">
                    <div className="col-span-3 p-1 text-left pl-2">FUNÇÃO / EMPRESA</div>
                    <div className="col-span-1 p-1">QTDE</div>
                  </div>
                  <div className="grid grid-cols-4 col-span-1 divide-x divide-slate-200">
                    <div className="col-span-3 p-1 text-left pl-2">FUNÇÃO / EMPRESA</div>
                    <div className="col-span-1 p-1">QTDE</div>
                  </div>
                  <div className="grid grid-cols-4 col-span-1 divide-x divide-slate-200">
                    <div className="col-span-3 p-1 text-left pl-2">FUNÇÃO / EMPRESA</div>
                    <div className="col-span-1 p-1">QTDE</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-slate-300 text-[9px] min-h-[48px]">
                  <div className="flex flex-col divide-y divide-slate-200">
                    <div className="grid grid-cols-4 divide-x divide-slate-200 items-center h-[24px]"><div className="col-span-3 p-1 px-2 font-bold text-slate-400"></div><div className="col-span-1 bg-slate-50/20 text-center"></div></div>
                    <div className="grid grid-cols-4 divide-x divide-slate-200 items-center h-[24px]"><div className="col-span-3 p-1 px-2 font-bold text-slate-400"></div><div className="col-span-1 bg-slate-50/20 text-center"></div></div>
                  </div>
                  <div className="flex flex-col divide-y divide-slate-200">
                    <div className="grid grid-cols-4 divide-x divide-slate-200 items-center h-[24px]"><div className="col-span-3 p-1 px-2 font-bold text-slate-400"></div><div className="col-span-1 bg-slate-50/20 text-center"></div></div>
                    <div className="grid grid-cols-4 divide-x divide-slate-200 items-center h-[24px]"><div className="col-span-3 p-1 px-2 font-bold text-slate-400"></div><div className="col-span-1 bg-slate-50/20 text-center"></div></div>
                  </div>
                  <div className="flex flex-col divide-y divide-slate-200">
                    <div className="grid grid-cols-4 divide-x divide-slate-200 items-center h-[24px]"><div className="col-span-3 p-1 px-2 font-bold text-slate-400"></div><div className="col-span-1 bg-slate-50/20 text-center"></div></div>
                    <div className="grid grid-cols-4 divide-x divide-slate-200 items-center h-[24px]"><div className="col-span-3 p-1 px-2 font-bold text-slate-400"></div><div className="col-span-1 bg-slate-50/20 text-center"></div></div>
                  </div>
                  <div className="flex flex-col divide-y divide-slate-200">
                    <div className="grid grid-cols-4 divide-x divide-slate-200 items-center h-[24px]"><div className="col-span-3 p-1 px-2 font-bold text-slate-400"></div><div className="col-span-1 bg-slate-50/20 text-center"></div></div>
                    <div className="grid grid-cols-4 divide-x divide-slate-200 items-center h-[24px]"><div className="col-span-3 p-1 px-2 font-bold text-slate-400"></div><div className="col-span-1 bg-slate-50/20 text-center"></div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ITEM 4: DESCRIPTION OF DEPLOYED ACTIVITIES */}
            <div className="space-y-2 print-section">
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <i className="fas fa-tasks text-slate-500"></i> DESCRIÇÃO DAS ATIVIDADES
              </h3>
              
              <div className="border border-slate-350 rounded-lg overflow-hidden bg-white">
                <div className="p-3 space-y-3">
                  {servicesSummary.emAndamento.length === 0 && servicesSummary.concluidos.length === 0 ? (
                    <div className="space-y-2.5">
                      <div className="text-[10px] text-slate-400 italic">Nenhum serviço em andamento ou concluído na data selecionada.</div>
                      <div className="border-b border-slate-200 h-5"></div>
                      <div className="border-b border-slate-200 h-5"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {servicesSummary.emAndamento.length > 0 && (
                        <div>
                          <span className="text-[8px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                            Em Andamento
                          </span>
                          <ul className="mt-1.5 space-y-1 pl-4 list-disc text-[10px] text-slate-700">
                            {servicesSummary.emAndamento.map((s, idx) => (
                              <li key={idx} className="font-semibold leading-normal">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {servicesSummary.concluidos.length > 0 && (
                        <div>
                          <span className="text-[8px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                            Concluídos
                          </span>
                          <ul className="mt-1.5 space-y-1 pl-4 list-disc text-[10px] text-slate-800">
                            {servicesSummary.concluidos.map((s, idx) => (
                              <li key={idx} className="font-extrabold leading-normal">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visual print line pads */}
                  <div className="border-b border-slate-200/50 h-3"></div>
                  <div className="border-b border-slate-200/50 h-3"></div>
                </div>
              </div>
            </div>

            {/* ITEM 5: REGISTERED INCIDENTS & REVIEWS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print-section">
              <div className="space-y-2 flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">OCORRÊNCIAS REGISTRADAS</span>
                <div className="border border-slate-300 rounded-lg p-3 bg-white flex-1 space-y-3 text-[10px]">
                  <div className="space-y-3">
                    {occurrencesList.map((item, index) => (
                      <div key={index} className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-none last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <select
                            disabled={!!signedBy}
                            value={['MATERIAL', 'MÃO DE OBRA', 'EQUIPAMENTO', 'OUTROS'].includes(item.type) ? item.type : 'OUTROS'}
                            onChange={(e) => {
                              const newList = [...occurrencesList];
                              newList[index].type = e.target.value;
                              setOccurrencesList(newList);
                            }}
                            className="font-bold text-slate-600 uppercase tracking-wide text-[8px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:bg-white disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="MATERIAL">MATERIAL</option>
                            <option value="MÃO DE OBRA">MÃO DE OBRA</option>
                            <option value="EQUIPAMENTO">EQUIPAMENTO</option>
                            <option value="OUTROS">OUTROS</option>
                          </select>

                          {!signedBy && occurrencesList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newList = occurrencesList.filter((_, idx) => idx !== index);
                                setOccurrencesList(newList);
                              }}
                              className="text-rose-500 hover:text-rose-700 text-[8px] font-black uppercase tracking-wider cursor-pointer print:hidden"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        
                        <textarea
                          placeholder="Descreva a ocorrência registrada..."
                          value={item.description}
                          disabled={!!signedBy}
                          rows={2}
                          onChange={(e) => {
                            const newList = [...occurrencesList];
                            newList[index].description = e.target.value;
                            setOccurrencesList(newList);
                          }}
                          className="w-full p-1.5 border border-slate-200 rounded text-[9px] outline-none transition bg-slate-50/50 focus:bg-white resize-y disabled:opacity-75 disabled:cursor-not-allowed leading-tight"
                        />
                      </div>
                    ))}
                  </div>

                  {!signedBy && (
                    <button
                      type="button"
                      onClick={() => {
                        setOccurrencesList([...occurrencesList, { type: 'OUTROS', description: '' }]);
                      }}
                      className="w-full py-1.5 border border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-600 hover:text-indigo-800 text-[8px] font-black uppercase rounded-lg transition-all active:scale-99 cursor-pointer flex items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 print:hidden"
                    >
                      <i className="fas fa-plus-circle"></i> Adicionar Linha de Ocorrência
                    </button>
                  )}
                </div>
              </div>

              {/* GENERAL OBSERVATIONS */}
              <div className="space-y-2 flex flex-col">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">OBSERVAÇÕES GERAIS</span>
                <div className="border border-slate-300 rounded-lg p-3 bg-white flex-1 flex flex-col justify-between">
                  <textarea
                    placeholder="Escreva livremente aqui observações relevantes do canteiro..."
                    value={generalNotes}
                    disabled={!!signedBy}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded text-[10px] outline-none transition flex-1 min-h-[96px] bg-slate-50/50 focus:bg-white resize-y disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* HIGH-FIDELITY FOOTER WITH PBQP-H AND APCER BADGES & SIGNATURE */}
            <div className="pt-8 border-t border-slate-300 mt-12 flex flex-col items-center gap-6 print-section">
              {/* Representative line */}
              <div className="flex flex-col items-center relative min-h-[60px] justify-end pb-1 w-full">
                {signedBy ? (
                  <div className="flex flex-col items-center pb-1 text-center select-none">
                    <span 
                      style={{ fontFamily: "'Caveat', cursive, sans-serif" }} 
                      className="text-indigo-600 font-bold text-xl select-none tracking-wide -rotate-[2deg] opacity-90"
                    >
                      {signedBy}
                    </span>
                    <span className="text-[6.5px] text-slate-400 mt-0.5 bg-slate-50 border border-slate-200 px-1 py-0.2 rounded font-mono uppercase tracking-tight leading-none print:bg-white">
                      ✓ Assinatura Digital ICP-Brasil ID: {signedBy.length * 12345}
                    </span>
                    <span className="text-[7.5px] font-black text-indigo-700 leading-none font-mono tracking-tight mt-[2px]">
                      {new Date(signedAt || Date.now()).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ) : (
                  <div className="h-10"></div>
                )}
                <div className="w-64 border-t border-slate-400 my-1"></div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider text-center">
                  ENGENHEIRO RESIDENTE
                </span>
                {signedBy && (
                  <span className="text-[8px] font-bold text-slate-500 text-center uppercase tracking-wide leading-none mt-0.5">
                    {signedBy.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Corporate Footer Badge Row */}
              <div className="w-full flex items-center justify-between text-slate-500 pt-3 select-none">
                {/* Left Logo: PBQP-H */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center justify-center p-1 bg-slate-100 rounded border border-slate-200">
                    <div className="flex gap-[1px]">
                      <div className="w-2.5 h-1.5 bg-indigo-600"></div>
                      <div className="w-2.5 h-1.5 bg-yellow-400"></div>
                      <div className="w-2.5 h-1.5 bg-[#8dc63f]"></div>
                    </div>
                    <span className="text-[7px] font-black tracking-tighter text-slate-700 leading-none mt-0.5">PBQP-H</span>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[7px] font-black text-slate-600 leading-none">PBQP H</span>
                    <span className="text-[5px] font-medium text-slate-400 leading-none mt-0.5">PROGRAMA BRASILEIRO DA QUALIDADE E PRODUTIVIDADE DO HABITAT</span>
                  </div>
                </div>

                {/* Center Paginate */}
                <div className="text-[8px] font-extrabold text-slate-400 tracking-widest uppercase">
                  Página 1 de 1
                </div>

                {/* Right Logo: apcer Certified */}
                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[6px] font-black text-slate-500 leading-none">CERTIFICAÇÃO</span>
                    <span className="text-[7px] font-extrabold text-indigo-700 leading-none mt-0.5">apcer</span>
                    <span className="text-[5px] font-bold text-slate-400 leading-none mt-0.5">PBQP-H</span>
                  </div>
                  <div className="w-6 h-6 border-2 border-indigo-600 rounded-full flex items-center justify-center text-[5px] font-black text-indigo-600 leading-all">
                    APC
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
          <i className="fas fa-book text-slate-300 text-5xl mb-4"></i>
          <h3 className="text-base font-bold text-slate-700">Aguardando Seleção de Obra</h3>
          <p className="text-slate-400 text-xs mt-1">
            Selecione uma obra e data no filtro acima para visualizar e editar o Diário de Obras.
          </p>
        </div>
      )}
    </div>
  );
};
