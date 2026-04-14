import { BleManager, Device } from 'react-native-ble-plx';

let sharedManager: BleManager | null = null;
let connectedDevice: Device | null = null;

export function getBleManager(): BleManager {
  if (!sharedManager) {
    sharedManager = new BleManager();
  }
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
