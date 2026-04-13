import { getApi, queueLength } from './api.service';

let lastCheck = 0;
let lastResult = true;
const CACHE_MS = 5000;

export async function isOnline(): Promise<boolean> {
  const now = Date.now();
  if (now - lastCheck < CACHE_MS) return lastResult;
  try {
    await getApi().get('/api', { timeout: 4000 });
    lastResult = true;
  } catch {
    lastResult = false;
  }
  lastCheck = now;
  return lastResult;
}

export async function pendingCount(): Promise<number> {
  return queueLength();
}

export default { isOnline, pendingCount };
