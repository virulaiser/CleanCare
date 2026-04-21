import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { loginUsuario, getToken, obtenerCicloActivo, solicitarResetPassword } from '../services/api.service';
import { colors } from '../constants/colors';
import SignatureBadge from '../components/SignatureBadge';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      // Si hay ciclo activo válido, ir directo a Cycle
      const ciclo = await obtenerCicloActivo();
      if (ciclo) {
        navigation.replace('Cycle', {
          maquina_id: ciclo.maquina_id,
          edificio_id: ciclo.edificio_id,
          tipo: ciclo.tipo,
          duracion_min: ciclo.duracion_min,
          nombre_maquina: ciclo.nombre_maquina,
        });
      } else {
        navigation.replace('Select');
      }
    })();
  }, [navigation]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Completá email y contraseña');
      return;
    }
    setLoading(true);
    try {
      const res = await loginUsuario(email.trim().toLowerCase(), password);
      if (res.requiere_aprobacion || res.usuario?.estado_aprobacion === 'pendiente') {
        navigation.replace('WaitingApproval');
      } else {
        navigation.replace('Select');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoIcon}>🧺</Text>
      </View>
      <Text style={styles.title}>CleanCare</Text>
      <Text style={styles.subtitle}>Ingresá con tu cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Contraseña"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />
        <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
          <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Ingresar</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { setResetMsg(''); setResetEmail(email); setResetOpen(true); }}>
        <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Registro')}>
        <Text style={styles.linkText}>No tenés cuenta? Registrate</Text>
      </TouchableOpacity>

      <SignatureBadge />

      <Modal visible={resetOpen} transparent animationType="fade" onRequestClose={() => setResetOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Recuperar contraseña</Text>
            {resetMsg ? (
              <>
                <Text style={styles.modalSub}>📧 {resetMsg}</Text>
                <TouchableOpacity style={styles.button} onPress={() => setResetOpen(false)}>
                  <Text style={styles.buttonText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalSub}>
                  Ingresá tu email. Te vamos a mandar un link para elegir una nueva contraseña.
                </Text>
                <TextInput
                  style={styles.input} autoFocus
                  placeholder="tu@email.com" placeholderTextColor={colors.textSecondary}
                  value={resetEmail} onChangeText={setResetEmail}
                  keyboardType="email-address" autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.button, resetBusy && { opacity: 0.6 }]}
                  disabled={resetBusy}
                  onPress={async () => {
                    if (!resetEmail.trim()) { Alert.alert('Error', 'Ingresá tu email'); return; }
                    setResetBusy(true);
                    try {
                      const r = await solicitarResetPassword(resetEmail.trim().toLowerCase());
                      setResetMsg(r.message || 'Si el email está registrado, vas a recibir un correo.');
                    } catch {
                      setResetMsg('No se pudo conectar. Intentá de nuevo.');
                    } finally {
                      setResetBusy(false);
                    }
                  }}
                >
                  {resetBusy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Enviar instrucciones</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setResetOpen(false)} style={{ marginTop: 12 }}>
                  <Text style={styles.linkText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.bgPage,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgPage,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeIcon: {
    fontSize: 18,
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
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '700', color: colors.textPrimary,
    marginBottom: 8, textAlign: 'center',
  },
  modalSub: {
    fontSize: 13, color: colors.textSecondary,
    textAlign: 'center', marginBottom: 20, lineHeight: 18,
  },
});
