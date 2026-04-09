import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Vibration, Alert, AppState } from 'react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { iniciarUso, actualizarUso } from '../services/api.service';
import { colors } from '../constants/colors';

// Duración del ciclo en segundos (modificar esta variable para cambiar el tiempo)
const CYCLE_DURATION_SECONDS = 60;

// Configurar notificaciones para que se muestren en foreground también
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Props = NativeStackScreenProps<RootStackParamList, 'Cycle'>;

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
  const { maquina_id, edificio_id, tipo } = route.params;
  const [secondsRemaining, setSecondsRemaining] = useState(CYCLE_DURATION_SECONDS);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef(Date.now());
  const usoIdRef = useRef<string | null>(null);

  const isWasher = tipo === 'lavarropas';
  const accentColor = isWasher ? colors.primary : '#F59E0B';

  // Registrar uso al inicio + programar notificación
  useEffect(() => {
    (async () => {
      // Registrar uso en backend
      try {
        const uso = await iniciarUso({
          maquina_id,
          edificio_id,
          duracion_min: Math.ceil(CYCLE_DURATION_SECONDS / 60),
          tipo,
        });
        usoIdRef.current = uso._id || null;
      } catch {}

      // Programar notificación (funciona con pantalla apagada)
      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleEndNotification(tipo, CYCLE_DURATION_SECONDS);
      }
    })();

    return () => { cancelAllNotifications(); };
  }, [maquina_id, edificio_id, tipo]);

  // Timer con Date.now para precisión incluso si la app estuvo en background
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, CYCLE_DURATION_SECONDS - elapsed);
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setIsComplete(true);
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);
        playNotificationSound();

        // Actualizar uso como completado
        if (usoIdRef.current) {
          actualizarUso(usoIdRef.current, 'completado').catch(() => {});
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Cuando la app vuelve de background, recalcular timer
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = Math.max(0, CYCLE_DURATION_SECONDS - elapsed);
        setSecondsRemaining(remaining);
        if (remaining <= 0 && !isComplete) {
          setIsComplete(true);
          Vibration.vibrate([0, 500, 200, 500, 200, 500]);
          playNotificationSound();
          if (usoIdRef.current) {
            actualizarUso(usoIdRef.current, 'completado').catch(() => {});
          }
        }
      }
    });
    return () => sub.remove();
  }, [isComplete]);

  const progress = 1 - secondsRemaining / CYCLE_DURATION_SECONDS;

  const handleCancel = () => {
    Alert.alert('Cancelar ciclo', '¿Estás seguro?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          await cancelAllNotifications();
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
      'Reportar avería',
      '¿La máquina no funciona o tiene un problema?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, reportar',
          style: 'destructive',
          onPress: async () => {
            await cancelAllNotifications();
            if (usoIdRef.current) {
              actualizarUso(usoIdRef.current, 'averia').catch(() => {});
            }
            Alert.alert('Reporte enviado', 'El administrador fue notificado del problema. Gracias por avisar.');
            navigation.navigate('Scan');
          },
        },
      ]
    );
  };

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
            Tu {isWasher ? 'ropa está lavada' : 'ropa está seca'} y lista para retirar
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor }]}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.primaryButtonText}>Volver al escáner</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.runningContent}>
        <View style={[styles.badge, { backgroundColor: isWasher ? colors.bgBlueLight : '#FEF3C7' }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>
            {isWasher ? '🫧 Lavando...' : '🌀 Secando...'}
          </Text>
        </View>

        <Text style={styles.machineId}>{maquina_id}</Text>

        <MachineAnimation tipo={tipo} active={true} />

        <Text style={[styles.timer, { color: accentColor }]}>{formatTime(secondsRemaining)}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
        </View>
        <Text style={styles.progressLabel}>
          {Math.round(progress * 100)}% completado
        </Text>

        {/* Botones */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity style={styles.reportButton} onPress={handleReportarAveria}>
            <Text style={styles.reportButtonText}>⚠ Reportar avería</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },
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
});
