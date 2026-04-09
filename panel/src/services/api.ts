import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
});

// Inyectar token en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cleancare_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirigir a login si el token expira
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cleancare_token');
      localStorage.removeItem('cleancare_usuario');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  edificio_id: string;
  unidad?: string;
}

export interface Uso {
  _id: string;
  maquina_id: string;
  edificio_id: string;
  tipo?: string;
  duracion_min: number;
  residente_id: string;
  estado?: 'activo' | 'completado' | 'cancelado' | 'averia';
  completado?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
  fecha: string;
}

export interface ResumenItem {
  _id: string;
  total_usos: number;
  minutos_totales: number;
}

export interface Maquina {
  _id: string;
  maquina_id: string;
  edificio_id: string;
  tipo: string;
  ip_local: string;
  nombre: string;
  activa: boolean;
}

export async function login(email: string, password: string): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=login', { email, password });
  return data;
}

export async function registro(campos: {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
  apartamento?: string;
  edificio_id: string;
  unidad?: string;
}): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=registro', campos);
  return data;
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

export async function listarMisUsos(): Promise<Uso[]> {
  const { data } = await api.get('/api/usos', { params: { mis: 'true' } });
  return data.usos;
}

export async function loginUsuario(email: string, password: string): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=login', { email, password });
  return data;
}

export async function listarMaquinas(edificioId: string): Promise<Maquina[]> {
  const { data } = await api.get('/api/maquinas', {
    params: { edificioId },
  });
  return data.maquinas;
}

export async function crearMaquina(maquina: { nombre: string; tipo: string; ip_local: string; edificio_id: string }): Promise<Maquina> {
  const { data } = await api.post('/api/maquinas', maquina);
  return data.maquina;
}

export async function eliminarMaquina(maquinaId: string): Promise<void> {
  await api.delete('/api/maquinas', { params: { maquinaId } });
}
