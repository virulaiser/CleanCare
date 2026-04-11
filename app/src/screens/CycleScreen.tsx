import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Vibration, Alert, AppState, Modal } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { BleManager, Device } from 'react-native-ble-plx';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { iniciarUso, actualizarUso, obtenerTipRandom } from '../services/api.service';
import { colors } from '../constants/colors';

// BLE UUIDs (deben coincidir con el firmware ESP32)
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const CONTROL_UUID = '12345678-1234-1234-1234-123456789abd';
const STATUS_UUID  = '12345678-1234-1234-1234-123456789abe';

// Duracion por defecto (se sobreescribe con route params)
const DEFAULT_DURATION_MIN = 45;

// Configurar notificaciones para que se muestren en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Props = NativeStackScreenProps<RootStackParamList, 'Cycle'>;
type BleState = 'scanning' | 'connecting' | 'connected' | 'error' | 'disconnected';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleEndNotification(tipo: 'lavarropas' | 'secadora', seconds: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: tipo === 'lavarropas' ? '¡Lavado listo!' : '¡Secado listo!',
      body: tipo === 'lavarropas'
        ? 'Tu ropa está lavada y lista para retirar'
        : 'Tu ropa está seca y lista para retirar',
      sound: true,
    },
    trigger: { seconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

async function playNotificationSound() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/notification.wav')
    );
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch {}
}

function MachineAnimation({ tipo, active }: { tipo: 'lavarropas' | 'secadora'; active: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const spin = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: tipo === 'lavarropas' ? 2000 : 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    spin.start();
    breathing.start();
    return () => { spin.stop(); breathing.stop(); };
  }, [active, tipo, rotation, pulse]);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isWasher = tipo === 'lavarropas';
  const machineColor = isWasher ? colors.primary : '#F59E0B';
  const machineBgLight = isWasher ? colors.bgBlueLight : '#FEF3C7';

  return (
    <Animated.View style={[styles.machineOuter, { transform: [{ scale: pulse }] }]}>
      <View style={[styles.machineBody, { borderColor: machineColor }]}>
        <View style={[styles.machinePanel, { backgroundColor: machineColor }]}>
          <View style={styles.panelDot} />
          <View style={styles.panelDot} />
          <View style={[styles.panelDotActive, { backgroundColor: colors.success }]} />
        </View>
        <View style={[styles.drumWindow, { borderColor: machineColor }]}>
          <View style={[styles.drumInner, { backgroundColor: machineBgLight }]}>
            <Animated.View style={[styles.drumSpinner, { transform: [{ rotate: rotateInterpolate }] }]}>
              <View style={[styles.drumBlade, { backgroundColor: machineColor, top: 8 }]} />
              <View style={[styles.drumBlade, { backgroundColor: machineColor, bottom: 8 }]} />
              <View style={[styles.drumBladeH, { backgroundColor: machineColor, left: 8 }]} />
              <View style={[styles.drumBladeH, { backgroundColor: machineColor, right: 8 }]} />
            </Animated.View>
          </View>
        </View>
        <View style={styles.machineFeet}>
          <View style={[styles.foot, { backgroundColor: machineColor }]} />
          <View style={[styles.foot, { backgroundColor: machineColor }]} />
        </View>
      </View>
    </Animated.View>
  );
}

export default function CycleScreen({ navigation, route }: Props) {
  const { maquina_id, edificio_id, tipo, duracion_min, nombre_maquina } = route.params;
  const cycleDurationSeconds = (duracion_min || DEFAULT_DURATION_MIN) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(cycleDurationSeconds);
  const [isComplete, setIsComplete] = useState(false);
  const [bleState, setBleState] = useState<BleState>('scanning');
  const [bleLog, setBleLog] = useState('Buscando ESP32...');
  const [tipTexto, setTipTexto] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [cycleStarted, setCycleStarted] = useState(false);

  const startTimeRef = useRef(Date.now());
  const usoIdRef = useRef<string | null>(null);
  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const cycleStartedRef = useRef(false);
  const completedRef = useRef(false);

  const isWasher = tipo === 'lavarropas';
  const accentColor = isWasher ? colors.primary : '#F59E0B';

  // --- Tip: fetch random tip and show after 5s ---
  useEffect(() => {
    obtenerTipRandom(tipo).then(t => {
      if (t) {
        setTipTexto(t);
        const timer = setTimeout(() => setShowTip(true), 5000);
        return () => clearTimeout(timer);
      }
    });
  }, [tipo]);

  // --- BLE: buscar, conectar, enviar ON ---
  useEffect(() => {
    const manager = new BleManager();
    managerRef.current = manager;

    let scanTimeout: ReturnType<typeof setTimeout>;
    let devicesFound: string[] = [];

    async function connectBle() {
      setBleState('scanning');
      setBleLog('Verificando Bluetooth...');

      // Paso 1: verificar estado del Bluetooth
      const btState = await manager.state();
      if (btState !== 'PoweredOn') {
        setBleState('error');
        const msgs: Record<string, string> = {
          PoweredOff: '🔴 Bluetooth apagado\n\nActivá el Bluetooth en Ajustes del teléfono.',
          Unauthorized: '🔒 Permisos BLE denegados\n\nAndá a Ajustes → Apps → CleanCare → Permisos y habilitá Bluetooth y Ubicación.',
          Unsupported: '❌ Este dispositivo no soporta BLE.',
          Resetting: '🔄 Bluetooth reiniciándose, esperá unos segundos e intentá de nuevo.',
        };
        setBleLog(msgs[btState] || `Estado Bluetooth: ${btState}`);
        return;
      }

      setBleLog('📡 Buscando CleanCare-ESP32...');

      manager.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
        if (error) {
          setBleState('error');
          if (error.message?.includes('permission')) {
            setBleLog('🔒 Permisos insuficientes\n\nNecesitás permisos de Bluetooth y Ubicación. Revisá Ajustes → Apps → CleanCare → Permisos.');
          } else if (error.message?.includes('disabled') || error.message?.includes('off')) {
            setBleLog('🔴 Bluetooth apagado\n\nActivá el Bluetooth desde Ajustes.');
          } else {
            setBleLog(`⚠️ Error de escaneo\n\n${error.message}\n\nProbá reiniciar el Bluetooth.`);
          }
          return;
        }

        if (device?.name && !devicesFound.includes(device.name)) {
          devicesFound.push(device.name);
          setBleLog(`📡 Buscando CleanCare-ESP32...\nDispositivos cerca: ${devicesFound.join(', ')}`);
        }

        if (device && device.name === 'CleanCare-ESP32') {
          manager.stopDeviceScan();
          clearTimeout(scanTimeout);

          try {
            // Paso 2: conectar
            setBleState('connecting');
            setBleLog('🔗 Conectando al ESP32...');

            const connected = await device.connect({ timeout: 10000 });
            setBleLog('🔍 Descubriendo servicios...');

            await connected.discoverAllServicesAndCharacteristics();
            deviceRef.current = connected;
            setBleState('connected');
            setBleLog('✅ Conectado al ESP32');

            // Paso 3: suscribirse a notificaciones
            connected.monitorCharacteristicForService(
              SERVICE_UUID,
              STATUS_UUID,
              (err, char) => {
                if (err) return;
                if (char?.value) {
                  const decoded = atob(char.value);
                  const parts = decoded.split(':');
                  const state = parts[0];
                  const secs = parseInt(parts[1] || '0', 10);

                  if (state === 'ON' && secs > 0) {
                    setSecondsRemaining(secs);
                  } else if (state === 'OFF' && cycleStartedRef.current && !completedRef.current) {
                    completedRef.current = true;
                    handleCycleComplete();
                  }
                }
              }
            );

            connected.onDisconnected(() => {
              setBleState('disconnected');
              deviceRef.current = null;
            });

            // Paso 4: sincronizar fecha/hora con ESP32
            const now = new Date();
            const timeCmd = `TIME:${now.toISOString().slice(0, 19)}`;
            await connected.writeCharacteristicWithResponseForService(
              SERVICE_UUID, CONTROL_UUID, btoa(timeCmd)
            );

            // Paso 5: enviar comando ON con usuario
            setBleLog('⚡ Activando máquina...');
            const usuario = await import('../services/api.service').then(m => m.getUsuarioGuardado());
            const userId = usuario?.usuario_id || 'desconocido';
            const cmd = `ON:${cycleDurationSeconds}:${userId}:${tipo}`;
            const encoded = btoa(cmd);
            await connected.writeCharacteristicWithResponseForService(
              SERVICE_UUID,
              CONTROL_UUID,
              encoded
            );
            cycleStartedRef.current = true;
            setCycleStarted(true);
            const mins = Math.ceil(cycleDurationSeconds / 60);
            setBleLog(`✅ Máquina activada — ${mins} min`);

            // Paso 5: registrar uso en backend
            startTimeRef.current = Date.now();
            try {
              const uso = await iniciarUso({
                maquina_id,
                edificio_id,
                duracion_min: mins,
                tipo,
              });
              usoIdRef.current = uso._id || null;
            } catch {}

            const granted = await requestNotificationPermissions();
            if (granted) {
              await scheduleEndNotification(tipo, cycleDurationSeconds);
            }

          } catch (err: any) {
            setBleState('error');
            if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
              setBleLog('⏱️ Timeout de conexión\n\nEl ESP32 fue encontrado pero no responde. Probá:\n• Reiniciar el ESP32\n• Acercarte más a la máquina');
            } else if (err.message?.includes('133') || err.message?.includes('GATT')) {
              setBleLog('🔌 Error de conexión GATT\n\nEl ESP32 rechazó la conexión. Probá:\n• Reiniciar el ESP32\n• Apagar y prender Bluetooth\n• Esperar 10 segundos');
            } else if (err.message?.includes('service') || err.message?.includes('characteristic')) {
              setBleLog('⚙️ Error de servicios BLE\n\nEl ESP32 conectó pero no tiene los servicios esperados. Verificá que el firmware esté actualizado.');
            } else {
              setBleLog(`⚠️ Error de conexión\n\n${err.message}`);
            }
          }
        }
      });

      // Timeout de escaneo
      scanTimeout = setTimeout(() => {
        manager.stopDeviceScan();
        setBleState('error');
        const found = devicesFound.length > 0
          ? `\n\nDispositivos encontrados: ${devicesFound.join(', ')}\n(ninguno es CleanCare-ESP32)`
          : '\n\nNo se encontró ningún dispositivo BLE cerca.';
        setBleLog(
          `📡 No se encontró CleanCare-ESP32\n\nVerificá que:` +
          `\n• El ESP32 esté encendido (LED azul)` +
          `\n• Estés cerca de la máquina (< 5m)` +
          `\n• Bluetooth esté activado` +
          `\n• Nadie más esté conectado al ESP32` +
          found
        );
      }, 15000);
    }

    connectBle();

    return () => {
      clearTimeout(scanTimeout);
      manager.stopDeviceScan();
      manager.destroy();
    };
  }, []);

  // --- Timer descendente ---
  useEffect(() => {
    if (!cycleStarted) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, cycleDurationSeconds - elapsed);
      setSecondsRemaining(remaining);

      if (remaining <= 0 && !completedRef.current) {
        clearInterval(interval);
        completedRef.current = true;
        handleCycleComplete();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cycleStarted]);

  // Cuando la app vuelve de background, recalcular
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && cycleStartedRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = Math.max(0, cycleDurationSeconds - elapsed);
        setSecondsRemaining(remaining);
        if (remaining <= 0 && !completedRef.current) {
          completedRef.current = true;
          handleCycleComplete();
        }
      }
    });
    return () => sub.remove();
  }, []);

  async function handleCycleComplete() {
    setIsComplete(true);
    setSecondsRemaining(0);
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    playNotificationSound();

    if (usoIdRef.current) {
      actualizarUso(usoIdRef.current, 'completado').catch(() => {});
    }
  }

  async function sendBleOff() {
    const device = deviceRef.current;
    if (device) {
      try {
        const encoded = btoa('OFF');
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          CONTROL_UUID,
          encoded
        );
      } catch {}
      try {
        await device.cancelConnection();
      } catch {}
    }
  }

  const handleCancel = () => {
    Alert.alert('Cancelar ciclo', '¿Estas seguro?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Si, cancelar',
        style: 'destructive',
        onPress: async () => {
          await cancelAllNotifications();
          await sendBleOff();
          if (usoIdRef.current) {
            actualizarUso(usoIdRef.current, 'cancelado').catch(() => {});
          }
          navigation.navigate('Scan');
        },
      },
    ]);
  };

  const handleReportarAveria = () => {
    Alert.alert(
      'Reportar averia',
      '¿La maquina no funciona o tiene un problema?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, reportar',
          style: 'destructive',
          onPress: async () => {
            await cancelAllNotifications();
            await sendBleOff();
            if (usoIdRef.current) {
              actualizarUso(usoIdRef.current, 'averia').catch(() => {});
            }
            Alert.alert('Reporte enviado', 'El administrador fue notificado del problema.');
            navigation.navigate('Scan');
          },
        },
      ]
    );
  };

  const handleRetryBle = () => {
    // Destruir manager viejo y reintentar
    managerRef.current?.destroy();
    setBleState('scanning');
    setBleLog('Reintentando...');

    const manager = new BleManager();
    managerRef.current = manager;

    manager.startDeviceScan([SERVICE_UUID], null, async (error, device) => {
      if (error) {
        setBleState('error');
        setBleLog(`Error: ${error.message}`);
        return;
      }
      if (device && device.name === 'CleanCare-ESP32') {
        manager.stopDeviceScan();
        // Reconectar (mismo flujo simplificado)
        try {
          setBleState('connecting');
          setBleLog('Conectando...');
          const connected = await device.connect({ timeout: 10000 });
          await connected.discoverAllServicesAndCharacteristics();
          deviceRef.current = connected;
          setBleState('connected');
          setBleLog('Reconectado al ESP32');

          connected.monitorCharacteristicForService(
            SERVICE_UUID, STATUS_UUID,
            (err, char) => {
              if (err) return;
              if (char?.value) {
                const decoded = atob(char.value);
                const parts = decoded.split(':');
                if (parts[0] === 'ON') setSecondsRemaining(parseInt(parts[1] || '0', 10));
                else if (parts[0] === 'OFF' && cycleStartedRef.current && !completedRef.current) {
                  completedRef.current = true;
                  handleCycleComplete();
                }
              }
            }
          );

          connected.onDisconnected(() => {
            setBleState('disconnected');
            deviceRef.current = null;
          });

          // Si el ciclo ya habia empezado, enviar ON con el tiempo restante
          if (cycleStartedRef.current) {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const remaining = Math.max(1, cycleDurationSeconds - elapsed);
            const encoded = btoa(`ON:${remaining}`);
            await connected.writeCharacteristicWithResponseForService(SERVICE_UUID, CONTROL_UUID, encoded);
            setBleLog(`Reenviado ON:${remaining}s`);
          }
        } catch (err: any) {
          setBleState('error');
          setBleLog(`Error: ${err.message}`);
        }
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setBleState((prev) => {
        if (prev === 'scanning') {
          setBleLog('No se encontro ESP32');
          return 'error';
        }
        return prev;
      });
    }, 15000);
  };

  const progress = 1 - secondsRemaining / cycleDurationSeconds;

  // --- Estado: Buscando/conectando ESP32 ---
  if (bleState === 'scanning' || bleState === 'connecting') {
    return (
      <View style={styles.container}>
        <View style={styles.bleConnecting}>
          <Animated.View style={styles.bleIconCircle}>
            <Text style={styles.bleIcon}>{bleState === 'scanning' ? '📡' : '🔗'}</Text>
          </Animated.View>
          <Text style={styles.bleTitle}>
            {bleState === 'scanning' ? 'Buscando máquina...' : 'Conectando...'}
          </Text>
          <Text style={styles.bleLogText}>{bleLog}</Text>
          <Text style={styles.bleMachineId}>{nombre_maquina}</Text>
          <TouchableOpacity style={styles.bleCancelBtn} onPress={() => navigation.navigate('Scan')}>
            <Text style={styles.bleCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Iniciar ciclo sin BLE (modo simulado) ---
  const handleStartWithoutBle = async () => {
    managerRef.current?.stopDeviceScan();
    managerRef.current?.destroy();
    setBleState('disconnected');
    cycleStartedRef.current = true;
    startTimeRef.current = Date.now();

    // Registrar uso en backend
    try {
      const uso = await iniciarUso({
        maquina_id,
        edificio_id,
        duracion_min: duracion_min || DEFAULT_DURATION_MIN,
        tipo,
      });
      usoIdRef.current = uso._id || null;
    } catch {}

    // Programar notificacion
    const granted = await requestNotificationPermissions();
    if (granted) {
      await scheduleEndNotification(tipo, cycleDurationSeconds);
    }
  };

  // --- Estado: Error BLE ---
  if (bleState === 'error' && !cycleStartedRef.current) {
    return (
      <View style={styles.container}>
        <View style={styles.bleConnecting}>
          <View style={[styles.bleIconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Text style={styles.bleIcon}>⚠️</Text>
          </View>
          <Text style={styles.bleTitle}>No se pudo conectar</Text>
          <Text style={styles.bleLogText}>{bleLog}</Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accentColor }]} onPress={handleRetryBle}>
            <Text style={styles.primaryButtonText}>Reintentar conexión</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.success, marginTop: 12 }]}
            onPress={handleStartWithoutBle}
          >
            <Text style={styles.primaryButtonText}>Continuar sin ESP32</Text>
          </TouchableOpacity>
          <Text style={styles.simInfo}>
            El ciclo correrá con timer local y se registrará en el sistema, pero no activará la máquina físicamente.
          </Text>
          <TouchableOpacity style={styles.bleCancelBtn} onPress={() => navigation.navigate('Scan')}>
            <Text style={styles.bleCancelText}>Volver al escáner</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Estado: Ciclo completado ---
  if (isComplete) {
    return (
      <View style={styles.container}>
        <View style={styles.completeContent}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.completeTitle}>
            {isWasher ? '¡Lavado listo!' : '¡Secado listo!'}
          </Text>
          <Text style={styles.completeSubtitle}>
            Tu {isWasher ? 'ropa esta lavada' : 'ropa esta seca'} y lista para retirar
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor }]}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.primaryButtonText}>Volver al escaner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={[styles.secondaryButtonText, { color: accentColor }]}>Ver historial</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Estado: Ciclo en progreso ---
  return (
    <View style={styles.container}>
      <View style={styles.runningContent}>
        {/* BLE status indicator */}
        <View style={[styles.bleStatusBar, {
          backgroundColor: bleState === 'connected' ? '#DCFCE7' : '#FEF3C7',
        }]}>
          <View style={[styles.bleStatusDot, {
            backgroundColor: bleState === 'connected' ? '#16A34A' : '#D97706',
          }]} />
          <Text style={[styles.bleStatusText, {
            color: bleState === 'connected' ? '#16A34A' : '#D97706',
          }]}>
            {bleState === 'connected' ? 'ESP32 conectado' : 'BLE desconectado (timer local)'}
          </Text>
          {bleState !== 'connected' && (
            <TouchableOpacity onPress={handleRetryBle}>
              <Text style={styles.bleRetryLink}>Reconectar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.badge, { backgroundColor: isWasher ? colors.bgBlueLight : '#FEF3C7' }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>
            {isWasher ? '🫧 Lavando...' : '🌀 Secando...'}
          </Text>
        </View>

        <Text style={styles.machineId}>{nombre_maquina}</Text>

        <MachineAnimation tipo={tipo} active={true} />

        <Text style={[styles.timer, { color: accentColor }]}>{formatTime(secondsRemaining)}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
        </View>
        <Text style={styles.progressLabel}>
          {Math.round(progress * 100)}% completado
        </Text>

        <View style={styles.bottomButtons}>
          <TouchableOpacity style={styles.reportButton} onPress={handleReportarAveria}>
            <Text style={styles.reportButtonText}>⚠ Reportar averia</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tip popup */}
      <Modal visible={showTip && !!tipTexto} transparent animationType="fade">
        <View style={styles.tipOverlay}>
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipTitle}>Consejo</Text>
            <Text style={styles.tipText}>{tipTexto}</Text>
            <TouchableOpacity style={styles.tipBtn} onPress={() => setShowTip(false)}>
              <Text style={styles.tipBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },

  // BLE connecting/error states
  bleConnecting: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  bleIconCircle: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: colors.bgBlueLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  bleIcon: { fontSize: 44 },
  bleTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  bleSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  bleLogText: { fontSize: 14, color: colors.textSecondary, textAlign: 'left', marginBottom: 12, lineHeight: 22, paddingHorizontal: 8, alignSelf: 'stretch' },
  bleMachineId: { fontSize: 13, color: colors.textSecondary, fontFamily: 'monospace', marginBottom: 32 },
  bleCancelBtn: { paddingVertical: 12, marginTop: 12 },
  bleCancelText: { color: colors.textSecondary, fontSize: 14 },
  simInfo: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 18, paddingHorizontal: 16 },

  // BLE status bar during cycle
  bleStatusBar: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, gap: 8, marginBottom: 16,
  },
  bleStatusDot: { width: 8, height: 8, borderRadius: 4 },
  bleStatusText: { fontSize: 12, fontWeight: '600', flex: 1 },
  bleRetryLink: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Running state
  runningContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  badge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999, marginBottom: 8 },
  badgeText: { fontSize: 16, fontWeight: '700' },
  machineId: { fontSize: 14, color: colors.textSecondary, fontFamily: 'monospace', marginBottom: 32 },

  // Machine animation
  machineOuter: { marginBottom: 32 },
  machineBody: {
    width: 180, height: 220, borderRadius: 16, borderWidth: 3,
    backgroundColor: colors.white, alignItems: 'center', overflow: 'hidden',
  },
  machinePanel: {
    width: '100%', height: 40, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12, gap: 6,
  },
  panelDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  panelDotActive: { width: 10, height: 10, borderRadius: 5 },
  drumWindow: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 4,
    justifyContent: 'center', alignItems: 'center', marginTop: 12,
  },
  drumInner: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  drumSpinner: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  drumBlade: { position: 'absolute', width: 4, height: 30, borderRadius: 2, alignSelf: 'center' },
  drumBladeH: { position: 'absolute', width: 30, height: 4, borderRadius: 2, alignSelf: 'center' },
  machineFeet: {
    flexDirection: 'row', justifyContent: 'space-between', width: 120,
    position: 'absolute', bottom: -2,
  },
  foot: { width: 20, height: 6, borderRadius: 3 },

  // Timer
  timer: { fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: 16 },
  progressTrack: { width: '80%', height: 8, backgroundColor: colors.bgCard, borderRadius: 999, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 999 },
  progressLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },

  // Bottom buttons
  bottomButtons: { alignItems: 'center', gap: 12 },
  reportButton: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
  },
  reportButtonText: { fontSize: 14, fontWeight: '600', color: colors.error },
  cancelButton: { paddingHorizontal: 24, paddingVertical: 10 },
  cancelText: { fontSize: 14, color: colors.textSecondary },

  // Complete state
  completeContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  checkCircle: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: colors.success,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  checkIcon: { fontSize: 48, color: colors.white, fontWeight: '700' },
  completeTitle: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  completeSubtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 40 },
  primaryButton: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 999, marginBottom: 16 },
  primaryButtonText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },

  // Tip popup
  tipOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  tipCard: {
    backgroundColor: '#FFFBEB', borderRadius: 20, padding: 32,
    width: '85%', alignItems: 'center',
    borderWidth: 2, borderColor: '#FDE68A',
  },
  tipIcon: { fontSize: 40, marginBottom: 8 },
  tipTitle: { fontSize: 20, fontWeight: '700', color: '#92400E', marginBottom: 12 },
  tipText: { fontSize: 16, color: '#78350F', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  tipBtn: {
    backgroundColor: '#F59E0B', paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: 999,
  },
  tipBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
