import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { registrarUsuario } from '../services/api.service';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Registro'>;

export default function RegistroScreen({ navigation }: Props) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [edificio, setEdificio] = useState('');
  const [unidad, setUnidad] = useState('');
  const [loading, setLoading] = useState(false);

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
      <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor={colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="ID del edificio (ej: edificio-central)" placeholderTextColor={colors.textSecondary} value={edificio} onChangeText={setEdificio} />
      <TextInput style={styles.input} placeholder="Unidad (ej: apto-302) — opcional" placeholderTextColor={colors.textSecondary} value={unidad} onChangeText={setUnidad} />

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
});
