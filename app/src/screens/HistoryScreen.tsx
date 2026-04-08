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
      const data = await listarUsos();
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

  const renderItem = ({ item }: { item: Uso }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.machineId}>{item.maquina_id}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.duracion_min} min</Text>
        </View>
      </View>
      <Text style={styles.detail}>Edificio: {item.edificio_id}</Text>
      {item.residente_id && (
        <Text style={styles.detail}>Residente: {item.residente_id}</Text>
      )}
      {item.fecha && (
        <Text style={styles.fecha}>{formatFecha(item.fecha)}</Text>
      )}
    </View>
  );

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
  badge: {
    backgroundColor: colors.bgBlueLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  detail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  fecha: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
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
