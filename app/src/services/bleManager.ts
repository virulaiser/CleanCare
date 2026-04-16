import { BleManager, Device, Characteristic } from 'react-native-ble-plx';

let sharedManager: BleManager | null = null;
let connectedDevice: Device | null = null;

export function getBleManager(): BleManager {
  if (!sharedManager) sharedManager = new BleManager();
  return sharedManager;
}

export function getConnectedDevice(): Device | null {
  return connectedDevice;
}

export function setConnectedDevice(device: Device | null) {
  connectedDevice = device;
}

export async function releaseBle() {
  try {
    if (connectedDevice) {
      await connectedDevice.cancelConnection().catch(() => {});
      connectedDevice = null;
    }
    if (sharedManager) {
      sharedManager.stopDeviceScan();
      sharedManager.destroy();
      sharedManager = null;
    }
  } catch {}
}

// Decodifica base64 → "ON:45" / "OFF:0" / "ON:45:LAV-XXX" (multi-máquina)
// Devuelve { state, secs, maquina_id? } — maquina_id solo existe en firmware v4+
export function parseBleStatus(char: Characteristic | null | undefined): { state: string; secs: number; maquina_id?: string } | null {
  if (!char?.value) return null;
  try {
    const [state, secsRaw, maquinaId] = atob(char.value).split(':');
    return {
      state,
      secs: parseInt(secsRaw || '0', 10),
      maquina_id: maquinaId || undefined,
    };
  } catch { return null; }
}
