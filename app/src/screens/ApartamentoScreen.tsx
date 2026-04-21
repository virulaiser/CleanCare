import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  listarMiembrosApto, aprobarMiembro, rechazarMiembro, MiembroApto, getUsuarioGuardado,
} from '../services/api.service';
import { colors } from '../constants/colors';

export default function ApartamentoScreen() {
  const [miembros, setMiembros] = useState<MiembroApto[]>([]);
  const [loading, setLoading] = useState(true);
  const [miUsuarioId, setMiUsuarioId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, me] = await Promise.all([listarMiembrosApto(), getUsuarioGuardado()]);
      setMiembros(lista);
      setMiUsuarioId(me?.usuario_id || null);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo cargar la lista');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  async function handleAprobar(m: MiembroApto) {
    setProcessing(m.usuario_id);
    try {
      await aprobarMiembro(m.usuario_id);
      await fetch();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo aprobar');
    } finally {
      setProcessing(null);
    }
  }

  async function handleRechazar(m: MiembroApto) {
    Alert.alert(
      'Rechazar solicitud',
      `¿Seguro que querés rechazar a ${m.nombre}? No va a poder lavar en este apto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar', style: 'destructive',
          onPress: async () => {
            setProcessing(m.usuario_id);
            try {
              await rechazarMiembro(m.usuario_id);
              await fetch();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'No se pudo rechazar');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  }

  const pendientes = miembros.filter((m) => m.estado_aprobacion === 'pendiente');
  const aprobados = miembros.filter((m) => m.estado_aprobacion === 'aprobado');

  const renderItem = ({ item }: { item: MiembroApto }) => {
    const esMiPropio = item.usuario_id === miUsuarioId;
    const busy = processing === item.usuario_id;
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.nombre}>{item.nombre}</Text>
            {item.rol_apto === 'titular' && (
              <View style={styles.badgeTitular}><Text style={styles.badgeTitularText}>Titular</Text></View>
            )}
            {esMiPropio && <Text style={styles.yoTag}>(vos)</Text>}
          </View>
          <Text style={styles.email}>{item.email}</Text>
          {item.estado_aprobacion === 'pendiente' && (
            <Text style={styles.pendLabel}>⏳ Esperando aprobación</Text>
          )}
        </View>

        {item.estado_aprobacion === 'pendiente' && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={[styles.btnOk, busy && { opacity: 0.5 }]}
              disabled={busy}
              onPress={() => handleAprobar(item)}
            >
              {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.btnOkText}>Aprobar</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnNo, busy && { opacity: 0.5 }]}
              disabled={busy}
              onPress={() => handleRechazar(item)}
            >
              <Text style={styles.btnNoText}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={[...pendientes, ...aprobados]}
        keyExtractor={(item) => item.usuario_id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetch} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.title}>Miembros del apto</Text>
            <Text style={styles.subtitle}>
              Aprobá solo a personas que realmente conocés y que viven con vos. Las fichas se descuentan del mismo pozo.
            </Text>
            {pendientes.length > 0 && (
              <Text style={styles.section}>{pendientes.length} solicitud{pendientes.length !== 1 ? 'es' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>Sin miembros</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  section: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 8 },
  row: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  nombre: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pendLabel: { fontSize: 12, color: '#D97706', marginTop: 6, fontWeight: '600' },
  badgeTitular: { backgroundColor: colors.bgBlueLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeTitularText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  yoTag: { fontSize: 12, color: colors.textSecondary, marginLeft: 4 },
  btnOk: {
    backgroundColor: colors.success, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, alignItems: 'center', justifyContent: 'center', minWidth: 72,
  },
  btnOkText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  btnNo: {
    backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: colors.error,
  },
  btnNoText: { color: colors.error, fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 16, color: colors.textSecondary, fontWeight: '600' },
});
