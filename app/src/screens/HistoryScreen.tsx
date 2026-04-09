import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { listarUsos, Uso } from '../services/api.service';
import { colors } from '../constants/colors';

function formatFecha(fecha: string): string {
  const d = new Date(fecha);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryScreen() {
  const [usos, setUsos] = useState<Uso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsos = useCallback(async () => {
    try {
      setError(null);
      const data = await listarUsos(true);
      setUsos(data);
    } catch {
      setError('No se pudieron cargar los usos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsos();
  }, [fetchUsos]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsos();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Uso }) => {
    const isWasher = item.tipo !== 'secadora';
    const estado = item.estado || (item.completado ? 'completado' : 'cancelado');
    const estadoConfig: Record<string, { bg: string; color: string; label: string }> = {
      completado: { bg: '#DCFCE7', color: '#16A34A', label: 'Completado' },
      cancelado:  { bg: '#FEF2F2', color: '#EF4444', label: 'Cancelado' },
      averia:     { bg: '#FEF3C7', color: '#D97706', label: 'Avería' },
      activo:     { bg: '#DBEAFE', color: '#3B82F6', label: 'En curso' },
    };
    const st = estadoConfig[estado] || estadoConfig.cancelado;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: isWasher ? '#DBEAFE' : '#FEF3C7' }]}>
            <Text style={[styles.typeBadgeText, { color: isWasher ? '#3B82F6' : '#D97706' }]}>
              {isWasher ? '🫧 Lavado' : '🌀 Secado'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusBadgeText, { color: st.color }]}>
              {st.label}
            </Text>
          </View>
        </View>
        <Text style={styles.machineId}>{item.maquina_id}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.detail}>{item.duracion_min} min</Text>
          {item.fecha_inicio && <Text style={styles.fecha}>{formatFecha(item.fecha_inicio)}</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={usos}
        keyExtractor={(item) => item._id || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No hay usos registrados</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  machineId: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  detail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  fecha: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
