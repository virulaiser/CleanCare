import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { obtenerEstado, activarMaquina, EstadoMaquina } from '../services/esp32.service';
import { registrarUso } from '../services/api.service';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Machine'>;

const DURACIONES = [30, 45, 60];
const POLL_INTERVAL = 30000; // 30s

export default function MachineScreen({ route, navigation }: Props) {
  const { maquina_id, ip, edificio_id } = route.params;

  const [estado, setEstado] = useState<EstadoMaquina | null>(null);
  const [loading, setLoading] = useState(true);
  const [activando, setActivando] = useState(false);
  const [duracionSeleccionada, setDuracionSeleccionada] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEstado = useCallback(async () => {
    try {
      setError(null);
      const data = await obtenerEstado(ip);
      setEstado(data);
    } catch {
      setError('No se pudo conectar con la máquina. Verificá que estés en la misma red WiFi.');
      setEstado(null);
    } finally {
      setLoading(false);
    }
  }, [ip]);

  useEffect(() => {
    fetchEstado();
    pollRef.current = setInterval(fetchEstado, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchEstado]);

  const handleActivar = async () => {
    setActivando(true);
    try {
      await activarMaquina(ip, duracionSeleccionada);

      // Registrar uso en el backend
      await registrarUso({
        maquina_id,
        edificio_id,
        duracion_min: duracionSeleccionada,
        residente_id: 'residente-temp', // TODO: auth real
      });

      await fetchEstado();
      Alert.alert('Máquina activada', `Funcionando por ${duracionSeleccionada} minutos.`);
    } catch {
      Alert.alert('Error', 'No se pudo activar la máquina. Intentá de nuevo.');
    } finally {
      setActivando(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Conectando con la máquina...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={fetchEstado}>
          <Text style={styles.buttonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const funcionando = estado?.estado === 'funcionando';

  return (
    <View style={styles.container}>
      {/* Info de máquina */}
      <View style={styles.card}>
        <Text style={styles.machineId}>{maquina_id}</Text>
        <Text style={styles.detail}>IP: {ip}</Text>
        <Text style={styles.detail}>Edificio: {edificio_id}</Text>
      </View>

      {/* Estado */}
      <View style={[styles.statusCard, funcionando ? styles.statusActive : styles.statusIdle]}>
        <Text style={styles.statusLabel}>Estado</Text>
        <Text style={styles.statusValue}>
          {funcionando ? 'Funcionando' : 'Disponible'}
        </Text>
        {funcionando && (
          <Text style={styles.statusMinutes}>
            {estado.minutos_restantes} min restantes
          </Text>
        )}
      </View>

      {/* Selector de duración */}
      {!funcionando && (
        <>
          <Text style={styles.sectionTitle}>Seleccioná la duración</Text>
          <View style={styles.durationRow}>
            {DURACIONES.map((min) => (
              <TouchableOpacity
                key={min}
                style={[
                  styles.durationChip,
                  duracionSeleccionada === min && styles.durationChipActive,
                ]}
                onPress={() => setDuracionSeleccionada(min)}
              >
                <Text
                  style={[
                    styles.durationText,
                    duracionSeleccionada === min && styles.durationTextActive,
                  ]}
                >
                  {min} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.activateButton, activando && styles.buttonDisabled]}
            onPress={handleActivar}
            disabled={activando}
          >
            {activando ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.activateButtonText}>Activar máquina</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.bgPage,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.bgPage,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  machineId: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  detail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statusCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  statusActive: {
    backgroundColor: colors.bgBlueLight,
  },
  statusIdle: {
    backgroundColor: '#DCFCE7',
  },
  statusLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusMinutes: {
    fontSize: 16,
    color: colors.primary,
    marginTop: 8,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  durationChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.bgBlueLight,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  durationTextActive: {
    color: colors.primary,
  },
  activateButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  activateButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
