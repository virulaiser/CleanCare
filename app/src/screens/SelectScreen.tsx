import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, FlatList, ActivityIndicator, Vibration, Platform, PermissionsAndroid } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { BleManager, Device } from 'react-native-ble-plx';
import { getBleManager, getConnectedDevice, setConnectedDevice, parseBleStatus } from '../services/bleManager';
import { RootStackParamList } from '../navigation/AppNavigator';
import { obtenerBilletera, listarMaquinas, getUsuarioGuardado, obtenerConfigEdificio, Maquina } from '../services/api.service';
import { colors } from '../constants/colors';
import { SERVICE_UUID, CONTROL_UUID, STATUS_UUID, ESP32_BLE_NAME } from '../constants/ble';

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const loc = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return loc === PermissionsAndroid.RESULTS.GRANTED;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Select'>;
type BleStatus = 'off' | 'scanning' | 'connected' | 'disconnected';
type TipoMaquina = 'lavarropas' | 'secadora';

export default function SelectScreen({ navigation }: Props) {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [maquinas, setMaquinas] = useState<(Maquina & { ocupada?: boolean })[]>([]);
  const [duracionLavado, setDuracionLavado] = useState(45);
  const [duracionSecado, setDuracionSecado] = useState(30);

  const [selectingTipo, setSelectingTipo] = useState<TipoMaquina | null>(null);
  const [loadingMaquinas, setLoadingMaquinas] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activatingLog, setActivatingLog] = useState('');

  const [bleStatus, setBleStatus] = useState<BleStatus>('off');
  const [bleDeviceName, setBleDeviceName] = useState('');
  const [esp32Running, setEsp32Running] = useState(false);
  const [esp32Remaining, setEsp32Remaining] = useState(0);
  const [bleLog, setBleLog] = useState('');

  const [eventLog, setEventLog] = useState<string[]>([]);
  const logEvent = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEventLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 30));
    console.log('[SelectScreen]', msg);
  }, []);

  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const wasConnectedRef = useRef(false);
  const unmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    unmountedRef.current = false;
    logEvent('🚀 Pantalla Select abierta');
    const manager = getBleManager();
    managerRef.current = manager;

    const existing = getConnectedDevice();
    if (existing) {
      deviceRef.current = existing;
      setBleStatus('connected');
      setBleDeviceName(existing.name || ESP32_BLE_NAME);
      wasConnectedRef.current = true;
      setBleLog('Conectado al ESP32');
      logEvent('✅ Reutilizando conexión BLE existente');
      attachStatusMonitor(existing);
    } else {
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
      try { manager.stopDeviceScan(); } catch {}
    };
  }, []);

  function attachStatusMonitor(dev: Device) {
    try {
      dev.monitorCharacteristicForService(SERVICE_UUID, STATUS_UUID, (err, char) => {
        if (err || !char?.value) return;
        const s = parseBleStatus(char);
        if (!s) return;
        if (s.state === 'ON') {
          setEsp32Running(s.secs > 0);
          setEsp32Remaining(s.secs);
        } else if (s.state === 'OFF') {
          setEsp32Running(false);
          setEsp32Remaining(0);
        }
      });
      logEvent('👁 Monitor de status BLE activo');
    } catch (err: any) {
      logEvent(`⚠ Monitor no se pudo crear: ${err?.message || err}`);
    }
  }

  async function scanForESP32(manager: BleManager) {
    setBleStatus('scanning');
    setBleLog('Pidiendo permisos...');
    logEvent('🔐 Pidiendo permisos BLE...');

    const granted = await requestBlePermissions();
    if (!granted) {
      setBleStatus('off');
      setBleLog('Permisos BLE denegados. Habilitá Bluetooth y Ubicación en Ajustes.');
      logEvent('❌ Permisos BLE denegados');
      return;
    }

    const btState = await manager.state();
    if (btState !== 'PoweredOn') {
      setBleStatus('off');
      setBleLog('Bluetooth apagado. Activalo en Ajustes.');
      logEvent(`❌ Bluetooth no encendido (${btState})`);
      return;
    }

    const foundNames: string[] = [];
    setBleLog('Escaneando...');
    logEvent('📡 Escaneando dispositivos BLE...');

    manager.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
      if (error) {
        setBleLog(`Error: ${error.message}`);
        setBleStatus('off');
        logEvent(`❌ Scan error: ${error.message}`);
        return;
      }
      if (device?.name && !foundNames.includes(device.name)) {
        foundNames.push(device.name);
        setBleLog(`Encontrados: ${foundNames.join(', ')}`);
      }
      const isCleanCare = (n?: string | null) => n === ESP32_BLE_NAME;
      if (device && (isCleanCare(device.name) || isCleanCare(device.localName))) {
        manager.stopDeviceScan();
        logEvent(`🎯 ESP32 encontrado (${device.id}), conectando...`);
        try {
          setBleStatus('scanning');
          const connected = await device.connect({ timeout: 10000 });
          await connected.discoverAllServicesAndCharacteristics();
          deviceRef.current = connected;
          setConnectedDevice(connected);
          setBleStatus('connected');
          setBleDeviceName(connected.name || connected.localName || ESP32_BLE_NAME);
          wasConnectedRef.current = true;
          logEvent('✅ Conectado al ESP32');

          try {
            const statusChar = await connected.readCharacteristicForService(SERVICE_UUID, STATUS_UUID);
            const s = parseBleStatus(statusChar);
            if (s && s.state === 'ON' && s.secs > 0) {
              setEsp32Running(true);
              setEsp32Remaining(s.secs);
              setBleLog(`Máquina en uso — ${Math.ceil(s.secs / 60)} min restantes`);
            }
          } catch {}

          attachStatusMonitor(connected);

          connected.onDisconnected(() => {
            deviceRef.current = null;
            setConnectedDevice(null);
            if (unmountedRef.current) return;
            setBleStatus('disconnected');
            logEvent('🔌 Desconectado');
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
          logEvent(`❌ Error al conectar: ${err?.message || err}`);
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
    try {
      if (deviceRef.current) {
        deviceRef.current.cancelConnection().catch(() => {});
        deviceRef.current = null;
        setConnectedDevice(null);
      }
      if (managerRef.current) managerRef.current.stopDeviceScan();
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
      setSelectingTipo(null);
      setActivating(false);
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

  async function handleTipoPress(tipo: TipoMaquina) {
    logEvent(`👆 Botón ${tipo} presionado`);
    if (bleStatus !== 'connected') {
      logEvent(`⛔ Cancelado: BLE no conectado (${bleStatus})`);
      Alert.alert('Sin conexión con ESP32', 'Esperá a que se conecte la máquina o tocá la barra de estado para reintentar.');
      return;
    }
    if (saldo !== null && saldo <= 0) {
      logEvent(`⛔ Cancelado: saldo ${saldo}`);
      Alert.alert('Sin fichas', 'No tenés fichas suficientes. Contactá al administrador.');
      return;
    }
    setLoadingMaquinas(true);
    setSelectingTipo(tipo);
    logEvent(`🔍 Cargando ${tipo}s disponibles...`);
    const u = await getUsuarioGuardado();
    if (u?.edificio_id) {
      try {
        const m = await listarMaquinas(u.edificio_id);
        setMaquinas(m as any);
        const cantTipo = (m as any[]).filter((x) => x.tipo === tipo).length;
        const libres = (m as any[]).filter((x) => x.tipo === tipo && !x.ocupada).length;
        logEvent(`📋 ${cantTipo} ${tipo}(s) en total, ${libres} libre(s)`);
      } catch (err: any) {
        logEvent(`❌ Error listar máquinas: ${err?.message || err}`);
      }
    }
    setLoadingMaquinas(false);
  }

  async function handleActivate(maq: Maquina & { ocupada?: boolean }) {
    logEvent(`🎯 Seleccionó ${maq.maquina_id} (${maq.nombre})`);
    const device = deviceRef.current;
    if (bleStatus !== 'connected' || !device) {
      logEvent(`⛔ Sin device BLE (status=${bleStatus}, device=${!!device})`);
      Alert.alert('Sin conexión', 'No hay conexión BLE con el ESP32.');
      return;
    }
    if (maq.ocupada) {
      logEvent(`⛔ Máquina ${maq.maquina_id} marcada ocupada`);
      Alert.alert('Máquina ocupada', `${maq.nombre} ya está en uso.`);
      return;
    }

    const tipo = maq.tipo as TipoMaquina;
    const duracion = tipo === 'lavarropas' ? duracionLavado : duracionSecado;
    const segs = duracion * 60;
    const usuario = await getUsuarioGuardado();
    const userId = usuario?.usuario_id || 'desconocido';

    setActivating(true);
    setActivatingLog('⚡ Preparando comando...');
    logEvent(`⚡ Preparando comando (user=${userId}, ${segs}s)`);

    // Monitor temporal dedicado a la confirmación
    let confirmed = false;
    const sub = device.monitorCharacteristicForService(SERVICE_UUID, STATUS_UUID, (err, char) => {
      if (err) {
        logEvent(`⚠ Monitor error: ${err.message || err}`);
        return;
      }
      if (!char?.value) return;
      const s = parseBleStatus(char);
      if (!s) return;
      logEvent(`📥 ESP32→app: ${s.state}:${s.secs}${s.maquina_id ? ':' + s.maquina_id : ''}`);
      if (s.state === 'ON' && s.secs > 0 && (!s.maquina_id || s.maquina_id === maq.maquina_id)) {
        confirmed = true;
        logEvent(`✅ Confirmación recibida para ${maq.maquina_id}`);
      }
    });

    const cmd = `ON:${segs}:${userId}:${tipo}:${maq.maquina_id}`;
    try {
      setActivatingLog(`📡 Enviando: ${cmd}`);
      logEvent(`📤 app→ESP32: ${cmd}`);
      await device.writeCharacteristicWithResponseForService(SERVICE_UUID, CONTROL_UUID, btoa(cmd));
      setActivatingLog('⏳ Esperando confirmación del ESP32...');
      logEvent(`✉ Write OK, esperando Notify (8s)`);
    } catch (err: any) {
      sub.remove();
      setActivating(false);
      logEvent(`❌ Write falló: ${err?.message || err}`);
      Alert.alert('Error al enviar', err?.message || 'No se pudo enviar el comando.');
      return;
    }

    // Esperar hasta 8s a que el ESP32 confirme "modo actuar" (relay encendido)
    const start = Date.now();
    while (Date.now() - start < 8000 && !confirmed) {
      await new Promise(r => setTimeout(r, 200));
    }
    sub.remove();

    if (!confirmed) {
      setActivating(false);
      logEvent(`⏱ Timeout 8s sin confirmación`);
      Alert.alert(
        'ESP32 no confirmó activación',
        'La máquina no respondió. Verificá que el ESP32 esté cerca y volvé a intentar.'
      );
      return;
    }

    Vibration.vibrate(100);
    setActivating(false);
    setSelectingTipo(null);
    logEvent(`🧺 Navegando al ciclo`);
    navigation.push('Cycle', {
      maquina_id: maq.maquina_id,
      edificio_id: maq.edificio_id,
      tipo,
      duracion_min: duracion,
      nombre_maquina: maq.nombre,
      preArmed: true,
    });
  }

  const bleBarConfig = {
    off: { bg: 'rgba(100,100,100,0.85)', dot: '#999', text: bleLog || 'BLE no disponible', icon: '📡' },
    scanning: { bg: 'rgba(59,130,246,0.9)', dot: '#93C5FD', text: bleLog || 'Buscando ESP32...', icon: '📡' },
    connected: { bg: esp32Running ? 'rgba(217,119,6,0.9)' : 'rgba(22,163,74,0.9)', dot: esp32Running ? '#FDE68A' : '#4ADE80', text: esp32Running ? `En uso — ${Math.ceil(esp32Remaining / 60)} min restantes` : `Conectado — ${bleDeviceName}`, icon: esp32Running ? '🔄' : '✅' },
    disconnected: { bg: 'rgba(239,68,68,0.9)', dot: '#FCA5A5', text: 'Desconectado', icon: '⚠️' },
  }[bleStatus];

  const maquinasFiltradas = selectingTipo
    ? maquinas.filter(m => m.tipo === selectingTipo)
    : [];

  return (
    <View style={styles.container}>
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

      <View style={styles.content}>
        <Text style={styles.title}>¿Qué vas a usar?</Text>
        <Text style={styles.subtitle}>Elegí el tipo de máquina</Text>

        <TouchableOpacity
          style={[styles.typeCard, styles.washerCard, bleStatus !== 'connected' && styles.typeCardDisabled]}
          onPress={() => handleTipoPress('lavarropas')}
          activeOpacity={0.85}
        >
          <Text style={styles.typeIcon}>🫧</Text>
          <Text style={styles.typeTitle}>Lavarropas</Text>
          <Text style={styles.typeSubtitle}>{duracionLavado} min</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeCard, styles.dryerCard, bleStatus !== 'connected' && styles.typeCardDisabled]}
          onPress={() => handleTipoPress('secadora')}
          activeOpacity={0.85}
        >
          <Text style={styles.typeIcon}>🌀</Text>
          <Text style={styles.typeTitle}>Secadora</Text>
          <Text style={styles.typeSubtitle}>{duracionSecado} min</Text>
        </TouchableOpacity>

        {bleStatus !== 'connected' && (
          <Text style={styles.warnText}>Conectá el ESP32 para activar una máquina</Text>
        )}

        {/* Panel de eventos — diagnóstico en tiempo real */}
        <View style={styles.logPanel}>
          <View style={styles.logHeader}>
            <Text style={styles.logTitle}>📜 Qué está haciendo la app</Text>
            <TouchableOpacity onPress={() => setEventLog([])}>
              <Text style={styles.logClear}>limpiar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.logBody}>
            {eventLog.length === 0 ? (
              <Text style={styles.logEmpty}>Sin eventos todavía…</Text>
            ) : (
              eventLog.slice(0, 6).map((line, i) => (
                <Text key={i} style={styles.logLine} numberOfLines={1} ellipsizeMode="tail">{line}</Text>
              ))
            )}
          </View>
        </View>
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Wallet')}>
          <Text style={styles.navIcon}>💰</Text>
          <Text style={styles.navLabel}>Billetera</Text>
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

      {/* Modal submenú máquinas */}
      <Modal visible={!!selectingTipo} transparent animationType="fade" onRequestClose={() => !activating && setSelectingTipo(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectingTipo === 'lavarropas' ? '🫧 Elegí lavarropas' : '🌀 Elegí secadora'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {selectingTipo === 'lavarropas' ? `${duracionLavado} min` : `${duracionSecado} min`}
            </Text>

            {activating ? (
              <View style={{ padding: 16, alignItems: 'stretch', alignSelf: 'stretch' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 12, fontSize: 14, color: colors.textPrimary, textAlign: 'center', fontWeight: '600' }}>
                  {activatingLog}
                </Text>
                <View style={styles.logBody}>
                  {eventLog.slice(0, 5).map((line, i) => (
                    <Text key={i} style={styles.logLine} numberOfLines={1} ellipsizeMode="tail">{line}</Text>
                  ))}
                </View>
              </View>
            ) : loadingMaquinas ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ padding: 20 }} />
            ) : (
              <FlatList
                data={maquinasFiltradas}
                keyExtractor={(item) => item.maquina_id}
                style={{ maxHeight: 320, alignSelf: 'stretch' }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.maqRow, { backgroundColor: item.ocupada ? '#FEF2F2' : '#F0FDF4', opacity: item.ocupada ? 0.6 : 1 }]}
                    onPress={() => handleActivate(item)}
                    disabled={item.ocupada}
                  >
                    <View style={[styles.maqDot, { backgroundColor: item.ocupada ? colors.error : colors.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{item.nombre}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        {item.ocupada ? 'Ocupada' : 'Disponible — tocá para activar'}
                      </Text>
                    </View>
                    {!item.ocupada && <Text style={{ fontSize: 20 }}>➜</Text>}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={{ textAlign: 'center', color: colors.textSecondary, padding: 20 }}>
                    No hay {selectingTipo === 'lavarropas' ? 'lavarropas' : 'secadoras'} registradas en tu edificio.
                  </Text>
                }
              />
            )}

            {!activating && (
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSelectingTipo(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },
  bleBar: {
    position: 'absolute', top: 12, left: 16, right: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
  },
  bleDot: { width: 10, height: 10, borderRadius: 5 },
  bleText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
  bleRetry: { fontSize: 12, fontWeight: '700', color: '#fff', textDecorationLine: 'underline' },
  saldoBadge: {
    position: 'absolute', top: 56, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
    zIndex: 5,
  },
  saldoIcon: { fontSize: 16 },
  saldoText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 32 },
  typeCard: {
    borderRadius: 24, padding: 28, marginBottom: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  typeCardDisabled: { opacity: 0.5 },
  washerCard: { backgroundColor: colors.bgBlueLight, borderWidth: 2, borderColor: colors.primary },
  dryerCard: { backgroundColor: '#FEF3C7', borderWidth: 2, borderColor: '#F59E0B' },
  typeIcon: { fontSize: 56, marginBottom: 8 },
  typeTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  typeSubtitle: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  warnText: { textAlign: 'center', color: colors.error, fontSize: 13, marginTop: 8, fontWeight: '600' },
  bottomBar: {
    flexDirection: 'row', backgroundColor: colors.white, paddingBottom: 20, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 22, marginBottom: 2 },
  navLabel: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  maqRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8, gap: 12 },
  maqDot: { width: 12, height: 12, borderRadius: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: colors.white, borderRadius: 20, padding: 24, width: '88%', alignItems: 'center', maxHeight: '75%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  modalSubtitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 16 },
  modalCancelBtn: { paddingVertical: 12, marginTop: 8 },
  modalCancelText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  logPanel: {
    marginTop: 20, backgroundColor: '#0F172A', borderRadius: 12, padding: 10,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logTitle: { color: '#93C5FD', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  logClear: { color: '#FCA5A5', fontSize: 10, fontWeight: '700', textDecorationLine: 'underline' },
  logBody: { minHeight: 60, marginTop: 4 },
  logEmpty: { color: '#64748B', fontSize: 11, fontStyle: 'italic' },
  logLine: { color: '#E2E8F0', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 14 },
});
