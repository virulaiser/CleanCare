import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getMe, getUsuarioGuardado, logout, Usuario } from '../services/api.service';
import { colors } from '../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WaitingApproval'>;
const POLL_MS = 15000; // 15s

export default function WaitingApprovalScreen() {
  const navigation = useNavigation<Nav>();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    getUsuarioGuardado().then(setUsuario);
    const tick = async () => {
      setChecking(true);
      try {
        const res = await getMe();
        setUsuario(res.usuario);
        if (res.usuario.estado_aprobacion === 'aprobado') {
          clearInterval(intervalRef.current);
          navigation.reset({ index: 0, routes: [{ name: 'Select' }] });
        } else if (res.usuario.estado_aprobacion === 'rechazado') {
          clearInterval(intervalRef.current);
          Alert.alert(
            'Solicitud rechazada',
            'El titular del apto rechazó tu solicitud. Si creés que es un error, contactá al administrador.',
            [{ text: 'OK', onPress: async () => { await logout(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); } }]
          );
        }
      } catch { /* silent */ }
      setChecking(false);
    };
    tick();
    intervalRef.current = setInterval(tick, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [navigation]);

  const handleLogout = async () => {
    clearInterval(intervalRef.current);
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Esperando aprobación</Text>
        <Text style={styles.body}>
          Tu cuenta fue creada, pero necesita la aprobación del titular del apto{' '}
          <Text style={styles.strong}>{usuario?.apartamento || '—'}</Text> antes de poder lavar.
        </Text>
        <Text style={styles.body}>
          Pedile al titular que abra la app y apruebe tu solicitud desde la pantalla "Miembros del apto".
        </Text>

        <View style={styles.statusRow}>
          {checking
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <View style={styles.statusDot} />}
          <Text style={styles.statusText}>
            {checking ? 'Chequeando estado...' : 'Vamos a revisar cada 15 segundos.'}
          </Text>
        </View>

        <TouchableOpacity style={styles.linkBtn} onPress={handleLogout}>
          <Text style={styles.linkText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage, padding: 24, justifyContent: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  strong: { fontWeight: '700', color: colors.textPrimary },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 16, gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  statusText: { fontSize: 13, color: colors.textSecondary },
  linkBtn: { padding: 12, marginTop: 8 },
  linkText: { color: colors.error, fontSize: 14, fontWeight: '600' },
});
