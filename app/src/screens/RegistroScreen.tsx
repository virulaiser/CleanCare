import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal, FlatList } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { registrarUsuario, listarEdificios, Edificio } from '../services/api.service';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Registro'>;

export default function RegistroScreen({ navigation }: Props) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [apartamento, setApartamento] = useState('');
  const [edificio, setEdificio] = useState('');
  const [edificioNombre, setEdificioNombre] = useState('');
  const [unidad, setUnidad] = useState('');
  const [loading, setLoading] = useState(false);
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [showEdificios, setShowEdificios] = useState(false);

  useEffect(() => {
    listarEdificios().then(setEdificios).catch(() => {});
  }, []);

  const handleRegistro = async () => {
    if (!nombre || !email || !password || !edificio) {
      Alert.alert('Error', 'Completá todos los campos obligatorios');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Formato de email inválido');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await registrarUsuario({
        nombre,
        email: email.trim().toLowerCase(),
        password,
        edificio_id: edificio,
        unidad: unidad || undefined,
        telefono: telefono || undefined,
        apartamento: apartamento || undefined,
      });
      navigation.replace('Scan');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>

      <TextInput style={styles.input} placeholder="Nombre completo" placeholderTextColor={colors.textSecondary} value={nombre} onChangeText={setNombre} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textSecondary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Contraseña (mínimo 6 caracteres)" placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Teléfono (ej: 099123456)" placeholderTextColor={colors.textSecondary} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Apartamento (ej: 3B)" placeholderTextColor={colors.textSecondary} value={apartamento} onChangeText={setApartamento} />
      <TouchableOpacity style={styles.input} onPress={() => setShowEdificios(true)}>
        <Text style={{ fontSize: 16, color: edificio ? colors.textPrimary : colors.textSecondary }}>
          {edificioNombre || 'Seleccioná tu edificio'}
        </Text>
      </TouchableOpacity>
      <TextInput style={styles.input} placeholder="Unidad (ej: apto-302) — opcional" placeholderTextColor={colors.textSecondary} value={unidad} onChangeText={setUnidad} />

      <Modal visible={showEdificios} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Elegí tu edificio</Text>
            <FlatList
              data={edificios}
              keyExtractor={(item) => item.edificio_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setEdificio(item.edificio_id);
                    setEdificioNombre(item.nombre);
                    setShowEdificios(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.nombre}</Text>
                  {item.direccion ? <Text style={styles.modalItemSub}>{item.direccion}</Text> : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 20 }}>No hay edificios registrados</Text>}
            />
            <TouchableOpacity onPress={() => setShowEdificios(false)} style={styles.modalClose}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleRegistro} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Registrarme</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.linkText}>Ya tenés cuenta? Ingresá</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.bgPage,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  linkText: {
    color: colors.accent,
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalItemSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalClose: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
