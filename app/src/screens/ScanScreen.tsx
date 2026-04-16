import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, FlatList, ActivityIndicator, Vibration, Platform, PermissionsAndroid } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { BleManager, Device } from 'react-native-ble-plx';
import { getBleManager, getConnectedDevice, setConnectedDevice } from '../services/bleManager';
import { RootStackParamList } from '../navigation/AppNavigator';
import { obtenerBilletera, listarMaquinas, getUsuarioGuardado, obtenerConfigEdificio, Maquina } from '../services/api.service';
import { colors } from '../constants/colors';

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Android 12+ (API 31+)
  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  }

  // Android < 12
  const loc = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return loc === PermissionsAndroid.RESULTS.GRANTED;
}

import { SERVICE_UUID, STATUS_UUID, ESP32_BLE_NAME } from '../constants/ble';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;
type BleStatus = 'off' | 'scanning' | 'connected' | 'disconnected';

function parseQR(data: string): { maquina_id: string; edificio_id: string } | null {
  try {
    const url = new URL(data);
    if (url.protocol !== 'cleancare:') return null;
    const maquina_id = url.searchParams.get('id');
    const edificio_id = url.searchParams.get('edificio');
    if (!maquina_id || !edificio_id) return null;
    return { maquina_id, edificio_id };
  } catch {
    return null;
  }
}

export default function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [parsedQR, setParsedQR] = useState<{ maquina_id: string; edificio_id: string } | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [maquinas, setMaquinas] = useState<(Maquina & { ocupada?: boolean })[]>([]);
  const [showMaquinas, setShowMaquinas] = useState(false);
  const [duracionLavado, setDuracionLavado] = useState(45);
  const [duracionSecado, setDuracionSecado] = useState(30);
  const [loadingMaquinas, setLoadingMaquinas] = useState(false);

  // BLE state
  const [bleStatus, setBleStatus] = useState<BleStatus>('off');
  const [bleDeviceName, setBleDeviceName] = useState('');
  const [esp32Running, setEsp32Running] = useState(false);
  const [esp32Remaining, setEsp32Remaining] = useState(0);
  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const wasConnectedRef = useRef(false);
  const unmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bleLog, setBleLog] = useState('');

  // BLE: auto-scan on mount — manager compartido entre pantallas
  useEffect(() => {
    unmountedRef.current = false;
    const manager = getBleManager();
    managerRef.current = manager;

    // Si ya hay un device conectado (volviendo de Cycle), reutilizarlo
    const existing = getConnectedDevice();
    if (existing) {
      deviceRef.current = existing;
      setBleStatus('connected');
      setBleDeviceName(existing.name || ESP32_BLE_NAME);
      wasConnectedRef.current = true;
      setBleLog('Conectado al ESP32');
    } else {
      // Esperar a que BLE esté listo y escanear
      const sub = manager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          sub.remove();
          scanForESP32(manager);
        }
      }, true);

      return () => {
        unmountedRef.current = true;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        sub.remove();
        try { manager.stopDeviceScan(); } catch {}
      };
    }

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      // El manager + device persisten entre pantallas — no se destruyen acá.
      try { manager.stopDeviceScan(); } catch {}
    };
  }, []);

  async function scanForESP32(manager: BleManager) {
    setBleStatus('scanning');
    setBleLog('Pidiendo permisos...');

    // Pedir permisos BLE en Android
    const granted = await requestBlePermissions();
    if (!granted) {
      setBleStatus('off');
      setBleLog('Permisos BLE denegados. Habilitá Bluetooth y Ubicación en Ajustes.');
      return;
    }

    // Verificar estado Bluetooth
    const btState = await manager.state();
    if (btState !== 'PoweredOn') {
      setBleStatus('off');
      setBleLog('Bluetooth apagado. Activalo en Ajustes.');
      return;
    }

    const foundNames: string[] = [];
    setBleLog('Escaneando...');

    // Escanear SIN filtro de UUID (más compatible con Android)
    manager.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
      if (error) {
        setBleLog(`Error: ${error.message}`);
        setBleStatus('off');
        return;
      }
      // Log de dispositivos encontrados
      if (device?.name && !foundNames.includes(device.name)) {
        foundNames.push(device.name);
        setBleLog(`Encontrados: ${foundNames.join(', ')}`);
      }
      const isCleanCare = (n?: string | null) => n === ESP32_BLE_NAME;
      if (device && (isCleanCare(device.name) || isCleanCare(device.localName))) {
        manager.stopDeviceScan();
        try {
          setBleStatus('scanning');
          const connected = await device.connect({ timeout: 10000 });
          await connected.discoverAllServicesAndCharacteristics();
          deviceRef.current = connected;
          setConnectedDevice(connected);
          setBleStatus('connected');
          setBleDeviceName(connected.name || connected.localName || ESP32_BLE_NAME);
          wasConnectedRef.current = true;

          // Leer estado del ESP32 para saber si ya hay ciclo activo
          try {
            const statusChar = await connected.readCharacteristicForService(SERVICE_UUID, STATUS_UUID);
            if (statusChar?.value) {
              const decoded = atob(statusChar.value);
              if (decoded.startsWith('ON:')) {
                const secs = parseInt(decoded.split(':')[1] || '0', 10);
                if (secs > 0) {
                  setEsp32Running(true);
                  setEsp32Remaining(secs);
                  setBleLog(`Máquina en uso — ${Math.ceil(secs / 60)} min restantes`);
                }
              } else {
                setEsp32Running(false);
              }
            }
          } catch {}

          // Monitorear cambios de estado en tiempo real
          connected.monitorCharacteristicForService(SERVICE_UUID, STATUS_UUID, (err, char) => {
            if (err || !char?.value) return;
            const decoded = atob(char.value);
            if (decoded.startsWith('ON:')) {
              const secs = parseInt(decoded.split(':')[1] || '0', 10);
              setEsp32Running(secs > 0);
              setEsp32Remaining(secs);
            } else if (decoded.startsWith('OFF:')) {
              setEsp32Running(false);
              setEsp32Remaining(0);
            }
          });

          connected.onDisconnected(() => {
            deviceRef.current = null;
            setConnectedDevice(null);
            if (unmountedRef.current) return;  // screen ya desmontó, no reconectar
            setBleStatus('disconnected');
            if (wasConnectedRef.current) {
              Vibration.vibrate(200);
              setBleLog('Se perdió la conexión, reintentando en 1s...');
              reconnectTimeoutRef.current = setTimeout(() => {
                if (!unmountedRef.current) handleReconnect();
              }, 1000);
            }
          });
        } catch (err: any) {
          console.log('BLE connect error:', err.message);
          setBleStatus('off');
        }
      }
    });

    scanTimeoutRef.current = setTimeout(() => {
      if (unmountedRef.current) return;
      if (managerRef.current) {
        managerRef.current.stopDeviceScan();
        setBleStatus(prev => prev === 'scanning' ? 'off' : prev);
      }
    }, 15000);
  }

  function handleReconnect() {
    // Limpiar device y detener scan (no destruir manager — es compartido)
    try {
      if (deviceRef.current) {
        deviceRef.current.cancelConnection().catch(() => {});
        deviceRef.current = null;
        setConnectedDevice(null);
      }
      if (managerRef.current) {
        managerRef.current.stopDeviceScan();
      }
    } catch {}

    setBleStatus('scanning');
    setBleLog('Reconectando...');

    setTimeout(() => {
      const manager = getBleManager();
      managerRef.current = manager;
      const sub = manager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          sub.remove();
          scanForESP32(manager);
        }
      }, true);
    }, 500);
  }

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      obtenerBilletera().then(data => setSaldo(data.saldo)).catch(() => {});
      getUsuarioGuardado().then(u => {
        if (!u?.edificio_id) return;
        Promise.all([
          listarMaquinas(u.edificio_id).catch(() => [] as any[]),
          obtenerConfigEdificio(u.edificio_id).catch(() => null),
        ]).then(([m, config]) => {
          setMaquinas(m as any);
          if (config) {
            setDuracionLavado(config.duracion_lavado || 45);
            setDuracionSecado(config.duracion_secado || 30);
          }
        });
      });
    }, [])
  );

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color={colors.white} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.message}>Necesitamos acceso a la cámara para escanear el QR</Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Permitir cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    const parsed = parseQR(data);
    if (!parsed) {
      Alert.alert('QR inválido', 'Este código no pertenece a una máquina CleanCare.', [
        { text: 'Reintentar', onPress: () => setScanned(false) },
      ]);
      return;
    }
    setParsedQR(parsed);
  };

  const getTipoFromQR = (): 'lavarropas' | 'secadora' => {
    if (parsedQR?.maquina_id.startsWith('SEC')) return 'secadora';
    return 'lavarropas';
  };

  const getNombreMaquina = (id: string): string => {
    const found = maquinas.find(m => m.maquina_id === id);
    return found?.nombre || (id.startsWith('SEC') ? 'Secadora' : 'Lavarropas');
  };

  const handleConfirmCycle = () => {
    if (!parsedQR) return;
    // Si la máquina escaneada ya tiene un ciclo activo (por este user o por otro),
    // backend reporta ocupada=true en listarMaquinas.
    const maq = maquinas.find((m) => m.maquina_id === parsedQR.maquina_id);
    if (maq?.ocupada) {
      Alert.alert(
        'Máquina ocupada',
        `${maq.nombre || 'Esta máquina'} ya está en uso. Esperá a que termine o elegí otra.`,
        [{ text: 'OK', onPress: () => { setParsedQR(null); setScanned(false); } }]
      );
      return;
    }
    if (saldo !== null && saldo <= 0) {
      Alert.alert('Sin fichas', 'No tenés fichas suficientes. Contactá al administrador.', [{ text: 'OK' }]);
      return;
    }
    const tipo = getTipoFromQR();
    const duracion = tipo === 'lavarropas' ? duracionLavado : duracionSecado;
    const nombre = getNombreMaquina(parsedQR.maquina_id);
    setParsedQR(null);
    setScanned(false);
    // push en vez de navigate: así cada ciclo es instancia independiente en el stack
    // (permite multi-máquina: lavando y secando a la vez)
    navigation.push('Cycle', {
      maquina_id: parsedQR.maquina_id,
      edificio_id: parsedQR.edificio_id,
      tipo,
      duracion_min: duracion,
      nombre_maquina: nombre,
    });
  };

  const handleCancelModal = () => {
    setParsedQR(null);
    setScanned(false);
  };

  const handleShowMaquinas = () => {
    setLoadingMaquinas(true);
    setShowMaquinas(true);
    getUsuarioGuardado().then(u => {
      if (u?.edificio_id) {
        listarMaquinas(u.edificio_id).then(m => {
          setMaquinas(m as any);
          setLoadingMaquinas(false);
        }).catch(() => setLoadingMaquinas(false));
      } else { setLoadingMaquinas(false); }
    });
  };

  // BLE status bar color/text
  const bleBarConfig = {
    off: { bg: 'rgba(100,100,100,0.85)', dot: '#999', text: bleLog || 'BLE no disponible', icon: '📡' },
    scanning: { bg: 'rgba(59,130,246,0.9)', dot: '#93C5FD', text: bleLog || 'Buscando ESP32...', icon: '📡' },
    connected: { bg: esp32Running ? 'rgba(217,119,6,0.9)' : 'rgba(22,163,74,0.9)', dot: esp32Running ? '#FDE68A' : '#4ADE80', text: esp32Running ? `En uso — ${Math.ceil(esp32Remaining / 60)} min restantes` : `Conectado — ${bleDeviceName}`, icon: esp32Running ? '🔄' : '✅' },
    disconnected: { bg: 'rgba(239,68,68,0.9)', dot: '#FCA5A5', text: 'Desconectado', icon: '⚠️' },
  }[bleStatus];

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        {/* BLE status bar */}
        <TouchableOpacity
          style={[styles.bleBar, { backgroundColor: bleBarConfig.bg }]}
          onPress={bleStatus !== 'connected' ? handleReconnect : undefined}
          activeOpacity={bleStatus !== 'connected' ? 0.7 : 1}
        >
          <View style={[styles.bleDot, { backgroundColor: bleBarConfig.dot }]} />
          <Text style={styles.bleText}>{bleBarConfig.text}</Text>
          {bleStatus === 'scanning' && <ActivityIndicator size="small" color="#fff" />}
          {(bleStatus === 'off' || bleStatus === 'disconnected') && (
            <Text style={styles.bleRetry}>Reconectar</Text>
          )}
        </TouchableOpacity>

        {/* Badge de saldo */}
        {saldo !== null && (
          <TouchableOpacity style={styles.saldoBadge} onPress={() => navigation.navigate('Wallet')}>
            <Text style={styles.saldoIcon}>💰 </Text>
            <Text style={[styles.saldoText, saldo <= 0 && { color: colors.error }]}>
              {saldo} {saldo === 1 ? 'ficha' : 'fichas'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.hint}>Apuntá la cámara al QR de la máquina</Text>
      </View>

      {/* Bottom navigation bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Wallet')}>
          <Text style={styles.navIcon}>💰</Text>
          <Text style={styles.navLabel}>Billetera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={handleShowMaquinas}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Máquinas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('History')}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabel}>Historial</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Perfil</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de confirmación */}
      <Modal visible={!!parsedQR} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Text style={styles.modalIcon}>
                {getTipoFromQR() === 'lavarropas' ? '🫧' : '🌀'}
              </Text>
            </View>
            <Text style={styles.modalTitle}>
              {getTipoFromQR() === 'lavarropas' ? '¿Querés lavar?' : '¿Querés secar?'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {parsedQR ? getNombreMaquina(parsedQR.maquina_id) : ''}
            </Text>
            {/* BLE status in confirm modal */}
            <View style={[styles.modalBleBadge, {
              backgroundColor: bleStatus === 'connected' ? '#DCFCE7' : '#FEF3C7',
            }]}>
              <View style={[styles.bleDotSmall, {
                backgroundColor: bleStatus === 'connected' ? colors.success : '#D97706',
              }]} />
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: bleStatus === 'connected' ? colors.success : '#D97706',
              }}>
                {bleStatus === 'connected' ? 'ESP32 conectado' : 'Sin conexión BLE'}
              </Text>
            </View>
            <View style={styles.modalBadge}>
              <Text style={[styles.modalBadgeText, {
                color: getTipoFromQR() === 'lavarropas' ? colors.primary : '#D97706',
              }]}>
                {getTipoFromQR() === 'lavarropas'
                  ? `Lavarropas — ${duracionLavado} min`
                  : `Secadora — ${duracionSecado} min`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, {
                backgroundColor: getTipoFromQR() === 'lavarropas' ? colors.primary : '#F59E0B',
              }]}
              onPress={handleConfirmCycle}
            >
              <Text style={styles.modalConfirmText}>
                {getTipoFromQR() === 'lavarropas' ? 'Iniciar lavado' : 'Iniciar secado'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={handleCancelModal}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal disponibilidad máquinas */}
      <Modal visible={showMaquinas} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Máquinas del edificio</Text>
            {/* BLE status inside machines modal */}
            <View style={[styles.modalBleBadge, {
              backgroundColor: bleStatus === 'connected' ? '#DCFCE7' : '#FEF2F2',
              marginBottom: 16,
            }]}>
              <View style={[styles.bleDotSmall, {
                backgroundColor: bleStatus === 'connected' ? colors.success : colors.error,
              }]} />
              <Text style={{
                fontSize: 12, fontWeight: '600', flex: 1,
                color: bleStatus === 'connected' ? colors.success : colors.error,
              }}>
                {bleStatus === 'connected' ? `ESP32 conectado` : 'ESP32 no conectado'}
              </Text>
              {bleStatus !== 'connected' && (
                <TouchableOpacity onPress={() => { setShowMaquinas(false); handleReconnect(); }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Conectar</Text>
                </TouchableOpacity>
              )}
            </View>
            {loadingMaquinas ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ padding: 20 }} />
            ) : (
              <FlatList
                data={maquinas}
                keyExtractor={(item) => item.maquina_id}
                renderItem={({ item }) => (
                  <View style={[styles.maqRow, { backgroundColor: item.ocupada ? '#FEF2F2' : '#F0FDF4' }]}>
                    <View style={[styles.maqDot, { backgroundColor: item.ocupada ? colors.error : colors.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{item.nombre}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        {item.tipo === 'secadora' ? '🌀 Secadora' : '🫧 Lavarropas'}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 12, fontWeight: '700',
                      color: item.ocupada ? colors.error : colors.success,
                    }}>
                      {item.ocupada ? 'Ocupada' : 'Disponible'}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary, padding: 20 }}>No hay máquinas registradas</Text>}
              />
            )}
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowMaquinas(false)}>
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.textPrimary },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.bgPage },
  permIcon: { fontSize: 48, marginBottom: 16 },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  // BLE bar
  bleBar: {
    position: 'absolute', top: 12, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
  },
  bleDot: { width: 10, height: 10, borderRadius: 5 },
  bleText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
  bleRetry: { fontSize: 12, fontWeight: '700', color: '#fff', textDecorationLine: 'underline' },
  // Scan frame
  scanFrame: { width: 250, height: 250, backgroundColor: 'transparent' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: colors.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  hint: {
    color: colors.white, fontSize: 16, marginTop: 24, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  message: { fontSize: 16, color: colors.textPrimary, textAlign: 'center', marginBottom: 20 },
  permButton: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999 },
  permButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  // Bottom nav
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.95)', paddingBottom: 20, paddingTop: 10,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 22, marginBottom: 2 },
  navLabel: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  // Saldo badge
  saldoBadge: {
    position: 'absolute', top: 56, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  saldoIcon: { fontSize: 16 },
  saldoText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  // Machine rows
  maqRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8, gap: 12 },
  maqDot: { width: 12, height: 12, borderRadius: 6 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 32, width: '85%', alignItems: 'center', maxHeight: '70%' },
  modalIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgBlueLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalIcon: { fontSize: 36 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  modalBleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginBottom: 12,
  },
  bleDotSmall: { width: 8, height: 8, borderRadius: 4 },
  modalBadge: { backgroundColor: colors.bgBlueLight, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, marginBottom: 24 },
  modalBadgeText: { fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 999, width: '100%', alignItems: 'center', marginBottom: 12 },
  modalConfirmText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  modalCancelBtn: { paddingVertical: 10 },
  modalCancelText: { color: colors.textSecondary, fontSize: 14 },
});
