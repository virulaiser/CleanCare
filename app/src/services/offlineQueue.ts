import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

const QUEUE_KEY = 'cleancare_offline_queue_v1';
const PENDING_USOS_KEY = 'cleancare_pending_usos_v1';

export type QueuedRequest = {
  id: string;
  method: 'POST' | 'PATCH';
  url: string;
  data?: any;
  createdAt: number;
  attempts: number;
  // Para PATCH /api/uso?id=X cuando el id es local (uso creado offline),
  // referencia el id local del POST que lo creó.
  pendingUsoLocalId?: string;
};

// Para usos creados offline: guardamos los datos para inferir _id real al sincronizar
export type PendingUso = {
  localId: string;
  maquina_id: string;
  edificio_id: string;
  duracion_min: number;
  tipo?: string;
  fecha_inicio: string;
  // _id real asignado por el backend después de sincronizar
  remoteId?: string;
};

function genId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readQueue(): Promise<QueuedRequest[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(q: QueuedRequest[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

async function readPending(): Promise<PendingUso[]> {
  const raw = await AsyncStorage.getItem(PENDING_USOS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writePending(p: PendingUso[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_USOS_KEY, JSON.stringify(p));
}

export async function enqueue(req: Omit<QueuedRequest, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
  const q = await readQueue();
  const item: QueuedRequest = { ...req, id: genId(), createdAt: Date.now(), attempts: 0 };
  q.push(item);
  await writeQueue(q);
  return item.id;
}

export async function registerPendingUso(uso: Omit<PendingUso, 'localId'>): Promise<string> {
  const list = await readPending();
  const localId = genId();
  list.push({ ...uso, localId });
  await writePending(list);
  return localId;
}

export async function queueLength(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

export async function clearQueue(): Promise<void> {
  await writeQueue([]);
  await writePending([]);
}

let flushing = false;

export async function flushQueue(api: AxiosInstance): Promise<{ ok: number; fail: number }> {
  if (flushing) return { ok: 0, fail: 0 };
  flushing = true;
  let ok = 0, fail = 0;
  try {
    const q = await readQueue();
    if (q.length === 0) return { ok, fail };

    const remaining: QueuedRequest[] = [];
    const pending = await readPending();

    for (const req of q) {
      try {
        // Si es un PATCH ligado a un uso creado offline, resolver el id real
        let url = req.url;
        if (req.pendingUsoLocalId) {
          const p = pending.find(x => x.localId === req.pendingUsoLocalId);
          if (!p?.remoteId) {
            // Aún no se sincronizó el POST padre — re-encolar al final
            remaining.push(req);
            continue;
          }
          url = url.replace(/id=[^&]+/, `id=${p.remoteId}`);
        }

        const res = await api.request({
          method: req.method,
          url,
          data: req.data,
          timeout: 8000,
        });

        // Si era un POST /api/uso, registrar el remoteId para PATCH posteriores
        if (req.method === 'POST' && req.url.includes('/api/uso')) {
          const remoteId = res.data?.uso?._id;
          if (remoteId) {
            // Buscar el pending uso correspondiente por datos
            const match = pending.find(x =>
              !x.remoteId &&
              x.maquina_id === req.data?.maquina_id &&
              x.fecha_inicio === req.data?.fecha_inicio
            );
            if (match) {
              match.remoteId = remoteId;
              await writePending(pending);
            }
          }
        }
        ok++;
      } catch (err: any) {
        req.attempts++;
        // Descartar tras 10 intentos o si es 4xx (no se va a arreglar reintentando)
        const status = err?.response?.status;
        if (req.attempts < 10 && (!status || status >= 500 || status === 408 || status === 429)) {
          remaining.push(req);
        }
        fail++;
      }
    }

    await writeQueue(remaining);

    // Limpiar pending usos viejos ya sincronizados (>7 días)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const cleanedPending = pending.filter(p => !p.remoteId || new Date(p.fecha_inicio).getTime() > cutoff);
    if (cleanedPending.length !== pending.length) await writePending(cleanedPending);
  } finally {
    flushing = false;
  }
  return { ok, fail };
}

export async function isOnline(api: AxiosInstance): Promise<boolean> {
  try {
    await api.get('/api', { timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}
