import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export interface Uso {
  _id?: string;
  maquina_id: string;
  edificio_id: string;
  tipo?: string;
  duracion_min: number;
  residente_id: string;
  fecha?: string;
}

export interface Maquina {
  _id?: string;
  maquina_id: string;
  edificio_id: string;
  tipo: string;
  ip_local: string;
  nombre: string;
  activa: boolean;
}

export interface ResumenItem {
  _id: string;
  total_usos: number;
  minutos_totales: number;
}

export async function registrarUso(uso: Omit<Uso, '_id' | 'fecha'>): Promise<Uso> {
  const { data } = await api.post('/api/uso', uso);
  return data.uso;
}

export async function listarUsos(): Promise<Uso[]> {
  const { data } = await api.get('/api/usos');
  return data.usos;
}

export async function obtenerResumen(edificioId: string, mes: number, anio: number): Promise<ResumenItem[]> {
  const { data } = await api.get('/api/resumen', {
    params: { edificioId, mes, anio },
  });
  return data.resumen;
}

export async function listarMaquinas(edificioId: string): Promise<Maquina[]> {
  const { data } = await api.get('/api/maquinas', {
    params: { edificioId },
  });
  return data.maquinas;
}
