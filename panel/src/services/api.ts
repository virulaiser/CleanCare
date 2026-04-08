import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
});

export interface Uso {
  _id: string;
  maquina_id: string;
  edificio_id: string;
  tipo?: string;
  duracion_min: number;
  residente_id: string;
  fecha: string;
}

export interface ResumenItem {
  _id: string;
  total_usos: number;
  minutos_totales: number;
}

export async function obtenerResumen(edificioId: string, mes: number, anio: number): Promise<ResumenItem[]> {
  const { data } = await api.get('/api/resumen', {
    params: { edificioId, mes, anio },
  });
  return data.resumen;
}

export async function listarUsos(): Promise<Uso[]> {
  const { data } = await api.get('/api/usos');
  return data.usos;
}
