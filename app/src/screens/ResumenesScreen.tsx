import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listarMisResumenes, FacturaApto } from '../services/api.service';
import { colors } from '../constants/colors';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function ResumenesScreen() {
  const [facturas, setFacturas] = useState<FacturaApto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarMisResumenes();
      setFacturas(data);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  async function abrir(url: string) {
    try { await Linking.openURL(url); }
    catch { Alert.alert('Error', 'No se pudo abrir el PDF'); }
  }

  const render = ({ item }: { item: FacturaApto }) => (
    <TouchableOpacity style={styles.row} onPress={() => abrir(item.pdf_url)} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>📄 {MESES[item.mes - 1]} {item.anio}</Text>
        <Text style={styles.sub}>
          Apto {item.apartamento}
          {item.totales?.movimientos != null ? ` · ${item.totales.movimientos} mov.` : ''}
          {item.totales?.saldo_final != null ? ` · saldo ${item.totales.saldo_final}` : ''}
        </Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={facturas}
        keyExtractor={(item) => item._id}
        renderItem={render}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetch} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.header}>Resúmenes mensuales</Text>
            <Text style={styles.subHeader}>
              PDF con la actividad del apto de cada mes: fichas compradas, lavados, quién los hizo y saldo final.
            </Text>
          </View>
        }
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗂️</Text>
            <Text style={styles.emptyTitle}>Sin resúmenes</Text>
            <Text style={styles.emptyText}>Los resúmenes aparecen el día de facturación de cada mes.</Text>
          </View>
        ) : null}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },
  header: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  subHeader: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  row: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  arrow: { fontSize: 22, color: colors.textSecondary, marginLeft: 8 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
