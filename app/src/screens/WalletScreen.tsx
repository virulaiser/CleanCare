import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerBilletera, Transaccion } from '../services/api.service';
import { colors } from '../constants/colors';

const tipoLabels: Record<string, { label: string; color: string; bg: string }> = {
  asignacion_mensual: { label: 'Asignación', color: '#16A34A', bg: '#DCFCE7' },
  ajuste_admin:       { label: 'Ajuste', color: '#3B82F6', bg: '#DBEAFE' },
  uso_maquina:        { label: 'Uso', color: '#EF4444', bg: '#FEF2F2' },
  devolucion:         { label: 'Devolución', color: '#D97706', bg: '#FEF3C7' },
};

export default function WalletScreen() {
  const [saldo, setSaldo] = useState<number>(0);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerBilletera();
      setSaldo(data.saldo);
      setTransacciones(data.transacciones);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  function formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const renderItem = ({ item }: { item: Transaccion }) => {
    const info = tipoLabels[item.tipo] || tipoLabels.ajuste_admin;
    const signo = item.cantidad >= 0 ? '+' : '';
    return (
      <View style={styles.txRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={[styles.badge, { backgroundColor: info.bg }]}>
              <Text style={[styles.badgeText, { color: info.color }]}>{info.label}</Text>
            </View>
            <Text style={styles.txDate}>{formatFecha(item.fecha)}</Text>
          </View>
          <Text style={styles.txDesc} numberOfLines={1}>{item.descripcion}</Text>
        </View>
        <Text style={[styles.txAmount, { color: item.cantidad >= 0 ? '#16A34A' : '#EF4444' }]}>
          {signo}{item.cantidad}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Saldo */}
      <View style={styles.saldoCard}>
        <Text style={styles.saldoLabel}>Tu saldo</Text>
        <Text style={[styles.saldoValue, saldo <= 0 && { color: '#EF4444' }]}>
          {saldo}
        </Text>
        <Text style={styles.saldoUnit}>{saldo === 1 ? 'ficha' : 'fichas'}</Text>
      </View>

      {/* Transacciones */}
      <Text style={styles.sectionTitle}>Movimientos recientes</Text>
      <FlatList
        data={transacciones}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} colors={[colors.primary]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💰</Text>
              <Text style={styles.emptyTitle}>Sin movimientos</Text>
              <Text style={styles.emptyText}>Tus transacciones de fichas aparecerán acá</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPage,
    padding: 20,
  },
  saldoCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  saldoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  saldoValue: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.primary,
  },
  saldoUnit: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  txRow: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  txDesc: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  txAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
