import React, { useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getUsuarioGuardado, logout, obtenerBilletera, Usuario } from '../services/api.service';
import { colors } from '../constants/colors';
import SignatureBadge from '../components/SignatureBadge';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [saldo, setSaldo] = useState<number>(0);
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getUsuarioGuardado().then(setUsuario);
      obtenerBilletera().then(d => setSaldo(d.saldo)).catch(() => {});
      // TODO: cargar foto de perfil guardada (SecureStore o backend)
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sí, salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const handleChangePhoto = () => {
    // TODO: implementar con expo-image-picker
    Alert.alert('Foto de perfil', 'Próximamente vas a poder cambiar tu foto de perfil.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Avatar con foto o inicial */}
      <TouchableOpacity style={styles.avatarWrapper} onPress={handleChangePhoto} activeOpacity={0.7}>
        {fotoUri ? (
          <Image source={{ uri: fotoUri }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {usuario?.nombre ? usuario.nombre.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
        <View style={styles.cameraBadge}>
          <Text style={styles.cameraIcon}>📷</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.name}>{usuario?.nombre || 'Cargando...'}</Text>
      <Text style={styles.email}>{usuario?.email || ''}</Text>

      {/* Info cards */}
      <View style={styles.infoCard}>
        <InfoRow label="Apartamento" value={usuario?.apartamento || '—'} />
        <InfoRow label="Teléfono" value={usuario?.telefono || '—'} />
        <InfoRow label="Edificio" value={usuario?.edificio_id || '—'} />
        <InfoRow label="Fichas disponibles" value={`${saldo}`} highlight={saldo <= 0} />
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Wallet')}>
        <Text style={styles.actionIcon}>💰</Text>
        <Text style={styles.actionText}>Mi Billetera</Text>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('History')}>
        <Text style={styles.actionIcon}>📋</Text>
        <Text style={styles.actionText}>Historial de usos</Text>
        <Text style={styles.actionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={styles.version}>CleanCare v1.0.0</Text>
      <SignatureBadge />
    </ScrollView>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: colors.error }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.bgPage,
    padding: 24,
    alignItems: 'center',
  },
  avatarWrapper: {
    marginTop: 16,
    marginBottom: 12,
    position: 'relative',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bgCard,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.white,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.bgPage,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  cameraIcon: {
    fontSize: 14,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actionBtn: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  actionIcon: { fontSize: 20, marginRight: 12 },
  actionText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  actionArrow: { fontSize: 22, color: colors.textSecondary },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  version: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
