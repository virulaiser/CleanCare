import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Platform, PermissionsAndroid, Alert,
} from 'react-native';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { colors } from '../constants/colors';
import { SERVICE_UUID, CONTROL_UUID, STATUS_UUID } from '../constants/ble';

// Duracion de prueba en segundos
const TEST_DURATION = 60;

type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';
type LedState = 'off' | 'on' | 'unknown';

export default function BleTestScreen() {
  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);

  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  const [ledState, setLedState] = useState<LedState>('unknown');
  const [remaining, setRemaining] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [rssi, setRssi] = useState<number | null>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    managerRef.current = new BleManager();
    addLog('BLE Manager inicializado');

    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  async function requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      const allGranted = Object.values(results).every((r) => r === 'granted');
      if (!allGranted) {
        addLog('ERROR: Permisos BLE denegados');
        return false;
      }
    } else if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (granted !== 'granted') {
        addLog('ERROR: Permiso de ubicacion denegado');
        return false;
      }
    }
    addLog('Permisos concedidos');
    return true;
  }

  async function startScan() {
    const manager = managerRef.current;
    if (!manager) return;

    const ok = await requestPermissions();
    if (!ok) return;

    setConnState('scanning');
    addLog('Escaneando dispositivos BLE...');

    const scanStart = Date.now();

    manager.startDeviceScan([SERVICE_UUID], null, async (error, device) => {
      if (error) {
        addLog(`ERROR scan: ${error.message}`);
        setConnState('disconnected');
        return;
      }

      if (device && device.name === 'CleanCare-ESP32') {
        const scanTime = Date.now() - scanStart;
        addLog(`Encontrado: ${device.name} (${device.id}) en ${scanTime}ms`);
        setRssi(device.rssi);
        manager.stopDeviceScan();
        connectToDevice(device, scanStart);
      }
    });

    // Timeout 15 segundos
    setTimeout(() => {
      manager.stopDeviceScan();
      setConnState((prev) => {
        if (prev === 'scanning') {
          addLog('Scan timeout (15s). No se encontro CleanCare-ESP32');
          return 'disconnected';
        }
        return prev;
      });
    }, 15000);
  }

  async function connectToDevice(device: Device, scanStart: number) {
    setConnState('connecting');
    addLog('Conectando...');

    try {
      const connectStart = Date.now();
      const connected = await device.connect({ timeout: 10000 });
      const connectTime = Date.now() - connectStart;
      addLog(`Conectado en ${connectTime}ms`);

      const discoverStart = Date.now();
      await connected.discoverAllServicesAndCharacteristics();
      const discoverTime = Date.now() - discoverStart;
      addLog(`Servicios descubiertos en ${discoverTime}ms`);

      const totalTime = Date.now() - scanStart;
      addLog(`TIEMPO TOTAL conexion: ${totalTime}ms`);

      deviceRef.current = connected;
      setConnState('connected');

      // Suscribirse a notificaciones de estado
      connected.monitorCharacteristicForService(
        SERVICE_UUID,
        STATUS_UUID,
        (error, char) => {
          if (error) {
            addLog(`ERROR notify: ${error.message}`);
            return;
          }
          if (char?.value) {
            const decoded = atob(char.value);
            parseStatus(decoded);
          }
        }
      );

      addLog('Suscrito a notificaciones de estado');

      // Pedir estado inicial
      await sendCommand('STATUS');

      // Detectar desconexion
      connected.onDisconnected(() => {
        addLog('Dispositivo desconectado');
        setConnState('disconnected');
        setLedState('unknown');
        deviceRef.current = null;
      });

    } catch (err: any) {
      addLog(`ERROR conexion: ${err.message}`);
      setConnState('disconnected');
    }
  }

  function parseStatus(data: string) {
    // Formato: "ON:45" o "OFF:0"
    const parts = data.split(':');
    const state = parts[0];
    const secs = parseInt(parts[1] || '0', 10);

    if (state === 'ON') {
      setLedState('on');
      setRemaining(secs);
      addLog(`Estado: LED ON, ${secs}s restantes`);
    } else {
      setLedState('off');
      setRemaining(0);
      addLog('Estado: LED OFF');
    }
  }

  async function sendCommand(cmd: string) {
    const device = deviceRef.current;
    if (!device) {
      addLog('ERROR: No hay dispositivo conectado');
      return;
    }

    try {
      const encoded = btoa(cmd);
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CONTROL_UUID,
        encoded
      );
      addLog(`Comando enviado: ${cmd}`);
    } catch (err: any) {
      addLog(`ERROR envio: ${err.message}`);
    }
  }

  async function handleTurnOn() {
    addLog(`Enviando ON:${TEST_DURATION}...`);
    await sendCommand(`ON:${TEST_DURATION}`);
  }

  async function handleTurnOff() {
    addLog('Enviando OFF...');
    await sendCommand('OFF');
  }

  async function handleDisconnect() {
    const device = deviceRef.current;
    if (device) {
      await device.cancelConnection();
      deviceRef.current = null;
    }
    setConnState('disconnected');
    setLedState('unknown');
    addLog('Desconectado manualmente');
  }

  const isConnected = connState === 'connected';
  const isScanning = connState === 'scanning' || connState === 'connecting';

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={[styles.statusBar, {
        backgroundColor: isConnected ? '#DCFCE7' : isScanning ? '#FEF3C7' : '#FEF2F2',
      }]}>
        <View style={[styles.statusDot, {
          backgroundColor: isConnected ? '#16A34A' : isScanning ? '#D97706' : '#EF4444',
        }]} />
        <Text style={[styles.statusText, {
          color: isConnected ? '#16A34A' : isScanning ? '#D97706' : '#EF4444',
        }]}>
          {connState === 'disconnected' && 'Desconectado'}
          {connState === 'scanning' && 'Escaneando...'}
          {connState === 'connecting' && 'Conectando...'}
          {connState === 'connected' && `Conectado${rssi ? ` (${rssi} dBm)` : ''}`}
        </Text>
      </View>

      {/* LED visual */}
      <View style={styles.ledSection}>
        <View style={[styles.ledCircle, {
          backgroundColor: ledState === 'on' ? '#FDE047' : '#374151',
          shadowColor: ledState === 'on' ? '#FDE047' : 'transparent',
          shadowRadius: ledState === 'on' ? 20 : 0,
          shadowOpacity: ledState === 'on' ? 0.8 : 0,
          elevation: ledState === 'on' ? 10 : 0,
        }]}>
          <Text style={styles.ledIcon}>{ledState === 'on' ? '💡' : '⚫'}</Text>
        </View>
        <Text style={styles.ledLabel}>
          {ledState === 'on' ? 'ENCENDIDO' : ledState === 'off' ? 'APAGADO' : '—'}
        </Text>
        {ledState === 'on' && remaining > 0 && (
          <Text style={styles.remaining}>{remaining}s restantes</Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isConnected && !isScanning && (
          <TouchableOpacity style={styles.btnPrimary} onPress={startScan}>
            <Text style={styles.btnPrimaryText}>Buscar ESP32</Text>
          </TouchableOpacity>
        )}

        {isScanning && (
          <View style={styles.scanningRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.scanningText}>
              {connState === 'scanning' ? 'Buscando...' : 'Conectando...'}
            </Text>
          </View>
        )}

        {isConnected && (
          <>
            <TouchableOpacity
              style={[styles.btnOn, ledState === 'on' && styles.btnDisabled]}
              onPress={handleTurnOn}
              disabled={ledState === 'on'}
            >
              <Text style={styles.btnOnText}>
                {ledState === 'on' ? 'Encendido...' : `Encender LED (${TEST_DURATION}s)`}
              </Text>
            </TouchableOpacity>

            {ledState === 'on' && (
              <TouchableOpacity style={styles.btnOff} onPress={handleTurnOff}>
                <Text style={styles.btnOffText}>Apagar LED</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.btnDisconnect} onPress={handleDisconnect}>
              <Text style={styles.btnDisconnectText}>Desconectar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Log */}
      <View style={styles.logSection}>
        <Text style={styles.logTitle}>Log de conexion</Text>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, i) => (
            <Text key={i} style={[styles.logLine, log.includes('ERROR') && styles.logError]}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    paddingHorizontal: 20, gap: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '600' },

  ledSection: { alignItems: 'center', paddingVertical: 32 },
  ledCircle: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  ledIcon: { fontSize: 48 },
  ledLabel: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  remaining: { fontSize: 16, color: colors.primary, fontWeight: '600', marginTop: 4 },

  controls: { paddingHorizontal: 24, gap: 12 },
  btnPrimary: {
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 999,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  btnOn: {
    backgroundColor: '#16A34A', paddingVertical: 16, borderRadius: 999,
    alignItems: 'center',
  },
  btnOnText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  btnOff: {
    backgroundColor: colors.error, paddingVertical: 14, borderRadius: 999,
    alignItems: 'center',
  },
  btnOffText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  btnDisconnect: {
    paddingVertical: 12, borderRadius: 999, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  btnDisconnectText: { color: colors.textSecondary, fontSize: 14 },

  scanningRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 16 },
  scanningText: { fontSize: 16, color: colors.textSecondary },

  logSection: { flex: 1, margin: 16, marginTop: 24 },
  logTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  logScroll: {
    flex: 1, backgroundColor: '#1E293B', borderRadius: 12, padding: 12,
  },
  logLine: { fontSize: 12, fontFamily: 'monospace', color: '#94A3B8', marginBottom: 4 },
  logError: { color: '#EF4444' },
});
