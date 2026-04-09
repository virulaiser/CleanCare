import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Vibration, Alert, AppState } from 'react-native';
import { Audio } from 'expo-av';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { registrarUso } from '../services/api.service';
import { colors } from '../constants/colors';

async function playNotificationSound() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/notification.wav')
    );
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch {
    // Si no hay archivo de sonido, solo vibrar
  }
}

// Duración del ciclo en segundos (modificar esta variable para cambiar el tiempo)
const CYCLE_DURATION_SECONDS = 60;

type Props = NativeStackScreenProps<RootStackParamList, 'Cycle'>;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

    return () => {
      spin.stop();
      breathing.stop();
    };
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
      {/* Machine body */}
      <View style={[styles.machineBody, { borderColor: machineColor }]}>
        {/* Machine top panel */}
        <View style={[styles.machinePanel, { backgroundColor: machineColor }]}>
          <View style={styles.panelDot} />
          <View style={styles.panelDot} />
          <View style={[styles.panelDotActive, { backgroundColor: colors.success }]} />
        </View>
        {/* Drum window */}
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
        {/* Feet */}
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

  const isWasher = tipo === 'lavarropas';
  const accentColor = isWasher ? colors.primary : '#F59E0B';

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
        registrarUso({
          maquina_id,
          edificio_id,
          duracion_min: Math.ceil(CYCLE_DURATION_SECONDS / 60),
          tipo,
          completado: true,
        }).catch(() => {});
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [maquina_id, edificio_id, tipo]);

  const progress = 1 - secondsRemaining / CYCLE_DURATION_SECONDS;

  const handleCancel = () => {
    Alert.alert('Cancelar ciclo', '¿Estás seguro?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => {
          registrarUso({
            maquina_id,
            edificio_id,
            duracion_min: Math.ceil((CYCLE_DURATION_SECONDS - secondsRemaining) / 60) || 1,
            tipo,
            completado: false,
          }).catch(() => {});
          navigation.navigate('Scan');
        },
      },
    ]);
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
        {/* Badge */}
        <View style={[styles.badge, { backgroundColor: isWasher ? colors.bgBlueLight : '#FEF3C7' }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>
            {isWasher ? '🫧 Lavando...' : '🌀 Secando...'}
          </Text>
        </View>

        {/* Machine ID */}
        <Text style={styles.machineId}>{maquina_id}</Text>

        {/* Animation */}
        <MachineAnimation tipo={tipo} active={true} />

        {/* Timer */}
        <Text style={[styles.timer, { color: accentColor }]}>{formatTime(secondsRemaining)}</Text>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
        </View>
        <Text style={styles.progressLabel}>
          {Math.round(progress * 100)}% completado
        </Text>

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  runningContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  badge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  machineId: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: 32,
  },

  // Machine animation
  machineOuter: {
    marginBottom: 32,
  },
  machineBody: {
    width: 180,
    height: 220,
    borderRadius: 16,
    borderWidth: 3,
    backgroundColor: colors.white,
    alignItems: 'center',
    overflow: 'hidden',
  },
  machinePanel: {
    width: '100%',
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    gap: 6,
  },
  panelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  panelDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  drumWindow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  drumInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drumSpinner: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drumBlade: {
    position: 'absolute',
    width: 4,
    height: 30,
    borderRadius: 2,
    alignSelf: 'center',
  },
  drumBladeH: {
    position: 'absolute',
    width: 30,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  machineFeet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 120,
    position: 'absolute',
    bottom: -2,
  },
  foot: {
    width: 20,
    height: 6,
    borderRadius: 3,
  },

  // Timer
  timer: {
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  progressTrack: {
    width: '80%',
    height: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Complete state
  completeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkIcon: {
    fontSize: 48,
    color: colors.white,
    fontWeight: '700',
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
