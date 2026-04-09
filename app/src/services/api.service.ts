import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Inyectar token en cada request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('cleancare_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Usuario {
  id: string;
  usuario_id?: string;
  email: string;
  nombre: string;
  telefono?: string;
  apartamento?: string;
  rol: string;
  edificio_id: string;
  unidad?: string;
}

export interface Uso {
  _id?: string;
  maquina_id: string;
  edificio_id: string;
  tipo?: string;
  duracion_min: number;
  residente_id: string;
  completado?: boolean;
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

export async function loginUsuario(email: string, password: string): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=login', { email, password });
  await AsyncStorage.setItem('cleancare_token', data.token);
  await AsyncStorage.setItem('cleancare_usuario', JSON.stringify(data.usuario));
  return data;
}

export async function registrarUsuario(campos: {
  email: string;
  password: string;
  nombre: string;
  edificio_id: string;
  unidad?: string;
  telefono?: string;
  apartamento?: string;
}): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=registro', campos);
  await AsyncStorage.setItem('cleancare_token', data.token);
  await AsyncStorage.setItem('cleancare_usuario', JSON.stringify(data.usuario));
  return data;
}

export async function getUsuarioGuardado(): Promise<Usuario | null> {
  const raw = await AsyncStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('cleancare_token');
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove(['cleancare_token', 'cleancare_usuario']);
}

export async function registrarUso(uso: {
  maquina_id: string;
  edificio_id: string;
  duracion_min: number;
  tipo?: 'lavarropas' | 'secadora';
  completado?: boolean;
}): Promise<Uso> {
  const { data } = await api.post('/api/uso', uso);
  return data.uso;
}

export async function listarUsos(soloMios: boolean = false): Promise<Uso[]> {
  const { data } = await api.get('/api/usos', {
    params: soloMios ? { mis: 'true' } : {},
  });
  return data.usos;
}

export async function listarMaquinas(edificioId: string): Promise<Maquina[]> {
  const { data } = await api.get('/api/maquinas', {
    params: { edificioId },
  });
  return data.maquinas;
}
