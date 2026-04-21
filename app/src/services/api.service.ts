import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { enqueue, registerPendingUso, flushQueue, queueLength } from './offlineQueue';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export { flushQueue, queueLength };
export function getApi() { return api; }

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
  rol_apto?: 'titular' | 'miembro';
  estado_aprobacion?: 'pendiente' | 'aprobado' | 'rechazado';
}

export interface MiembroApto {
  usuario_id: string;
  nombre: string;
  email: string;
  telefono?: string;
  apartamento: string;
  edificio_id: string;
  rol_apto: 'titular' | 'miembro';
  estado_aprobacion: 'pendiente' | 'aprobado' | 'rechazado';
  aprobado_en?: string | null;
  creado?: string;
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

export async function loginUsuario(email: string, password: string): Promise<{ token: string; usuario: Usuario; requiere_aprobacion?: boolean }> {
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
}): Promise<{ token: string; usuario: Usuario; requiere_aprobacion?: boolean; titular_nombre?: string | null }> {
  const { data } = await api.post('/api/auth?action=registro', campos);
  await SecureStore.setItemAsync('cleancare_token', data.token);
  await SecureStore.setItemAsync('cleancare_usuario', JSON.stringify(data.usuario));
  return data;
}

export async function solicitarResetPassword(email: string): Promise<{ message: string }> {
  const { data } = await api.post('/api/auth?action=reset-solicitar', { email });
  return data;
}

export async function getMe(): Promise<{ usuario: Usuario; requiere_aprobacion: boolean }> {
  const { data } = await api.get('/api/auth', { params: { action: 'me' } });
  // Refrescar cache local
  if (data?.usuario) {
    await SecureStore.setItemAsync('cleancare_usuario', JSON.stringify(data.usuario));
  }
  return data;
}

// --- Apartamento (titular/miembros) ---
export async function listarMiembrosApto(): Promise<MiembroApto[]> {
  const { data } = await api.get('/api/apartamento/miembros');
  return data.miembros;
}

export async function aprobarMiembro(usuario_id: string): Promise<void> {
  await api.post('/api/apartamento/aprobar', { usuario_id });
}

export async function rechazarMiembro(usuario_id: string): Promise<void> {
  await api.post('/api/apartamento/rechazar', { usuario_id });
}

export async function transferirTitularidad(nuevo_titular_id: string): Promise<void> {
  await api.post('/api/apartamento/transferir-titularidad', { nuevo_titular_id });
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
  await clearCicloActivo();
}

// --- Ciclos activos (persistencia en SecureStore, mapa por maquina_id) ---
export interface CicloActivo {
  maquina_id: string;
  edificio_id: string;
  tipo: 'lavarropas' | 'secadora';
  duracion_min: number;
  nombre_maquina: string;
  startTime: number;         // Date.now() al iniciar
  duracionSeconds: number;   // duracion total del ciclo
}

type CiclosMap = Record<string, CicloActivo>;

async function leerMapa(): Promise<CiclosMap> {
  try {
    const raw = await SecureStore.getItemAsync('cleancare_ciclos_activos');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Compat: si el storage viejo era un objeto single, migrar
    if (parsed && parsed.maquina_id && parsed.startTime) {
      return { [parsed.maquina_id]: parsed as CicloActivo };
    }
    return parsed as CiclosMap;
  } catch { return {}; }
}

async function escribirMapa(mapa: CiclosMap): Promise<void> {
  try { await SecureStore.setItemAsync('cleancare_ciclos_activos', JSON.stringify(mapa)); } catch {}
}

function vencido(c: CicloActivo): boolean {
  const finishedAt = c.startTime + c.duracionSeconds * 1000;
  return Date.now() > finishedAt + 120000; // margen 2min
}

export async function guardarCicloActivo(c: CicloActivo): Promise<void> {
  const mapa = await leerMapa();
  mapa[c.maquina_id] = c;
  await escribirMapa(mapa);
}

export async function obtenerCiclosActivos(): Promise<CicloActivo[]> {
  const mapa = await leerMapa();
  const vivos: CicloActivo[] = [];
  let cambio = false;
  for (const id of Object.keys(mapa)) {
    if (vencido(mapa[id])) { delete mapa[id]; cambio = true; }
    else vivos.push(mapa[id]);
  }
  if (cambio) await escribirMapa(mapa);
  return vivos;
}

export async function obtenerCicloActivoPorMaquina(maquina_id: string): Promise<CicloActivo | null> {
  const mapa = await leerMapa();
  const c = mapa[maquina_id];
  if (!c) return null;
  if (vencido(c)) { delete mapa[maquina_id]; await escribirMapa(mapa); return null; }
  return c;
}

// Compat con código viejo — devuelve el primer ciclo vivo si hay.
export async function obtenerCicloActivo(): Promise<CicloActivo | null> {
  const ciclos = await obtenerCiclosActivos();
  return ciclos[0] || null;
}

// Si recibe maquina_id borra sólo ese. Sin argumento borra todos (compat).
export async function clearCicloActivo(maquina_id?: string): Promise<void> {
  if (!maquina_id) {
    try { await SecureStore.deleteItemAsync('cleancare_ciclos_activos'); } catch {}
    return;
  }
  const mapa = await leerMapa();
  delete mapa[maquina_id];
  await escribirMapa(mapa);
}

export async function iniciarUso(uso: {
  maquina_id: string;
  edificio_id: string;
  duracion_min: number;
  tipo?: 'lavarropas' | 'secadora';
}): Promise<Uso & { _localId?: string; _queued?: boolean }> {
  const payload = { ...uso, fecha_inicio: new Date().toISOString() };
  try {
    const { data } = await api.post('/api/uso', payload);
    return data.uso;
  } catch (err: any) {
    const isNetwork = !err?.response || err?.code === 'ECONNABORTED';
    if (!isNetwork) throw err;
    // Offline → encolar y devolver placeholder
    const localId = await registerPendingUso({
      maquina_id: payload.maquina_id,
      edificio_id: payload.edificio_id,
      duracion_min: payload.duracion_min,
      tipo: payload.tipo,
      fecha_inicio: payload.fecha_inicio,
    });
    await enqueue({ method: 'POST', url: '/api/uso', data: payload });
    return {
      maquina_id: payload.maquina_id,
      edificio_id: payload.edificio_id,
      duracion_min: payload.duracion_min,
      residente_id: '',
      _id: localId,
      _localId: localId,
      _queued: true,
    } as any;
  }
}

export async function actualizarUso(id: string, estado: 'completado' | 'cancelado' | 'averia'): Promise<Uso> {
  const isLocal = id.startsWith('local-');
  if (!isLocal) {
    try {
      const { data } = await api.patch(`/api/uso?id=${id}`, { estado });
      return data.uso;
    } catch (err: any) {
      const isNetwork = !err?.response || err?.code === 'ECONNABORTED';
      if (!isNetwork) throw err;
      await enqueue({ method: 'PATCH', url: `/api/uso?id=${id}`, data: { estado } });
      return { _id: id, estado } as any;
    }
  }
  // Es local: encolar PATCH ligado al POST pendiente
  await enqueue({
    method: 'PATCH',
    url: `/api/uso?id=${id}`,
    data: { estado },
    pendingUsoLocalId: id,
  });
  return { _id: id, estado } as any;
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
  tipo: 'asignacion_mensual' | 'ajuste_admin' | 'uso_maquina' | 'devolucion' | 'compra';
  cantidad: number;
  descripcion: string;
  fecha: string;
}

export async function obtenerBilletera(): Promise<{ saldo: number; transacciones: Transaccion[] }> {
  const { data } = await api.get('/api/billetera');
  return data;
}

export async function comprarFichas(pin: string, cantidad: number): Promise<{ nuevo_saldo: number }> {
  const { data } = await api.post('/api/billetera/comprar', { pin, cantidad });
  return data;
}

export async function cambiarPinCompra(pin_actual: string, pin_nuevo: string): Promise<void> {
  await api.patch('/api/billetera/pin', { pin_actual, pin_nuevo });
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
  max_compra_fichas?: number;
}

const CONFIG_CACHE_KEY = (edificioId: string) => `cleancare_config_${edificioId}`;

export async function obtenerConfigEdificio(edificioId: string): Promise<ConfigEdificio | null> {
  try {
    const { data } = await api.get('/api/config-edificio', { params: { edificioId } });
    const config = data.config || data;
    if (config) {
      try {
        await SecureStore.setItemAsync(CONFIG_CACHE_KEY(edificioId), JSON.stringify(config));
      } catch {}
    }
    return config;
  } catch {
    // Fallback a cache local si no hay red
    try {
      const raw = await SecureStore.getItemAsync(CONFIG_CACHE_KEY(edificioId));
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
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

export interface Unidad {
  _id: string;
  edificio_id: string;
  codigo: string;
  piso: number | null;
  numero_apto: number | null;
  es_extra: boolean;
  tipo_extra: 'portero' | 'otro' | null;
  activa: boolean;
}

export async function listarUnidades(edificioId: string): Promise<Unidad[]> {
  const { data } = await api.get('/api/unidades', { params: { edificioId, activa: 'true' } });
  return data.unidades;
}

// --- Facturación ---
export interface FacturaApto {
  _id: string;
  factura_id: string;
  edificio_id: string;
  apartamento: string;
  mes: number;
  anio: number;
  tipo: 'resumen_apto';
  pdf_url: string;
  totales: { saldo_final?: number; movimientos?: number };
  generada: string;
}

export async function listarMisResumenes(): Promise<FacturaApto[]> {
  const { data } = await api.get('/api/facturacion/aptos/mios');
  return data.facturas;
}
