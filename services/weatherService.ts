import axios from 'axios';
import { Project, WeatherLog } from '../types';
import { generateId } from '../src/lib/utils';
import { storageService } from './storageService';

const WEATHER_MAPPING: { [key: number]: string } = {
  0: 'Céu Limpo',
  1: 'Principalmente Limpo',
  2: 'Parcialmente Nublado',
  3: 'Encoberto',
  45: 'Nevoeiro',
  48: 'Nevoeiro Escarchado',
  51: 'Drizzle: Light',
  53: 'Drizzle: Moderate',
  55: 'Drizzle: Dense',
  61: 'Chuva: Leve',
  63: 'Chuva: Moderada',
  65: 'Chuva: Forte',
  71: 'Neve: Leve',
  73: 'Neve: Moderada',
  75: 'Neve: Forte',
  80: 'Rain Showers: Slight',
  81: 'Rain Showers: Moderate',
  82: 'Rain Showers: Violent',
  95: 'Trovoada: Leve ou moderada',
  96: 'Trovoada com granizo leve',
  99: 'Trovoada com granizo forte',
};

export const weatherService = {
  getCondition: (code: number): string => {
    return WEATHER_MAPPING[code] || 'Desconhecido';
  },

  fetchForecast: async (lat: number, lon: number) => {
    try {
      const response = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&current_weather=true&timezone=auto`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      return null;
    }
  },

  fetchHistoricalWeather: async (lat: number, lon: number, date: string) => {
    try {
      const response = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=temperature_2m,weathercode&daily=precipitation_sum&timezone=auto`
      );
      
      const hourly = response.data.hourly;
      const daily = response.data.daily;
      if (!hourly) return null;

      const morningIdx = 9;
      const afternoonIdx = 15;
      const nightIdx = 21;

      return {
        morning: {
          temp: hourly.temperature_2m[morningIdx],
          condition: weatherService.getCondition(hourly.weathercode[morningIdx]),
          conditionCode: hourly.weathercode[morningIdx]
        },
        afternoon: {
          temp: hourly.temperature_2m[afternoonIdx],
          condition: weatherService.getCondition(hourly.weathercode[afternoonIdx]),
          conditionCode: hourly.weathercode[afternoonIdx]
        },
        night: {
          temp: hourly.temperature_2m[nightIdx],
          condition: weatherService.getCondition(hourly.weathercode[nightIdx]),
          conditionCode: hourly.weathercode[nightIdx]
        },
        precipitation: daily?.precipitation_sum?.[0] || 0
      };
    } catch (error) {
      console.error('Error fetching historical weather:', error);
      return null;
    }
  },

  syncYesterdayWeather: async (projects: Project[], existingLogs: WeatherLog[]) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    for (const project of projects) {
      if (!project.latitude || !project.longitude) continue;

      // Check if already logged
      const alreadyLogged = existingLogs.some(l => l.projectId === project.id && l.date === dateStr);
      if (alreadyLogged) continue;

      const weatherData = await weatherService.fetchHistoricalWeather(project.latitude, project.longitude, dateStr);
      if (weatherData) {
        const newLog: WeatherLog = {
          id: `${project.id}_${dateStr}`,
          projectId: project.id,
          date: dateStr,
          ...weatherData,
          createdAt: Date.now()
        };
        await storageService.saveWeatherLog(newLog);
      }
    }
  }
};
