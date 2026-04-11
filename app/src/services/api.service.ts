import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Inyectar token en cada request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('cleancare_token');
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
  estado?: 'activo' | 'completado' | 'cancelado' | 'averia';
  completado?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
  fecha?: string;
}

export interface Maquina {
  _id?: string;
  maquina_id: string;
  edificio_id: string;
  tipo: string;
  nombre: string;
  activa: boolean;
}

export async function loginUsuario(email: string, password: string): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=login', { email, password });
  await SecureStore.setItemAsync('cleancare_token', data.token);
  await SecureStore.setItemAsync('cleancare_usuario', JSON.stringify(data.usuario));
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
  await SecureStore.setItemAsync('cleancare_token', data.token);
  await SecureStore.setItemAsync('cleancare_usuario', JSON.stringify(data.usuario));
  return data;
}

export async function getUsuarioGuardado(): Promise<Usuario | null> {
  const raw = await SecureStore.getItemAsync('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('cleancare_token');
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync('cleancare_token');
  await SecureStore.deleteItemAsync('cleancare_usuario');
}

export async function iniciarUso(uso: {
  maquina_id: string;
  edificio_id: string;
  duracion_min: number;
  tipo?: 'lavarropas' | 'secadora';
}): Promise<Uso> {
  const { data } = await api.post('/api/uso', uso);
  return data.uso;
}

export async function actualizarUso(id: string, estado: 'completado' | 'cancelado' | 'averia'): Promise<Uso> {
  const { data } = await api.patch(`/api/uso?id=${id}`, { estado });
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

// --- Billetera ---

export interface Transaccion {
  _id: string;
  transaccion_id: string;
  usuario_id: string;
  tipo: 'asignacion_mensual' | 'ajuste_admin' | 'uso_maquina' | 'devolucion';
  cantidad: number;
  descripcion: string;
  fecha: string;
}

export async function obtenerBilletera(): Promise<{ saldo: number; transacciones: Transaccion[] }> {
  const { data } = await api.get('/api/billetera');
  return data;
}

// --- Tips ---

export async function obtenerTipRandom(tipo: string): Promise<string | null> {
  try {
    const { data } = await api.get('/api/tips', { params: { random: 'true', tipo } });
    return data.tip?.texto || null;
  } catch { return null; }
}

// --- Config Edificio ---

export interface ConfigEdificio {
  edificio_id: string;
  creditos_mensuales: number;
  costo_lavado: number;
  costo_secado: number;
  duracion_lavado: number;
  duracion_secado: number;
}

export async function obtenerConfigEdificio(edificioId: string): Promise<ConfigEdificio | null> {
  try {
    const { data } = await api.get('/api/config-edificio', { params: { edificioId } });
    return data.config || data;
  } catch { return null; }
}

// --- Edificios ---

export interface Edificio {
  edificio_id: string;
  nombre: string;
  direccion?: string;
  admin_nombre?: string;
  admin_telefono?: string;
}

export async function listarEdificios(): Promise<Edificio[]> {
  const { data } = await api.get('/api/edificios');
  return data.edificios;
}
