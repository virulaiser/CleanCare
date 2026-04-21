import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  comprarFichas, cambiarPinCompra, obtenerConfigEdificio, getUsuarioGuardado, getMe,
} from '../services/api.service';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../constants/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Purchase'>;
type Step = 'pin' | 'buy' | 'change' | 'no-titular';

export default function PurchaseScreen() {
  const navigation = useNavigation<Nav>();
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [maxCompra, setMaxCompra] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState('1');
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinNuevo2, setPinNuevo2] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const u = await getUsuarioGuardado();
        if (!u?.edificio_id) return;
        // Gate: solo titular aprobado puede estar en esta pantalla
        const me = await getMe().catch(() => null);
        const rol = me?.usuario?.rol_apto || u.rol_apto;
        const estado = me?.usuario?.estado_aprobacion || u.estado_aprobacion;
        if (rol !== 'titular' || estado !== 'aprobado') {
          setStep('no-titular');
          return;
        }
        const cfg = await obtenerConfigEdificio(u.edificio_id);
        setMaxCompra(cfg?.max_compra_fichas ?? 10);
      } catch { setMaxCompra(10); }
    })();
  }, []);

  function validarPinFormato(p: string): boolean {
    return /^\d{4}$/.test(p);
  }

  async function handleValidarPin() {
    setPinErr('');
    if (!validarPinFormato(pin)) {
      setPinErr('El PIN debe tener 4 dígitos');
      return;
    }
    // No hay endpoint de "solo validar" — dejamos que la validación ocurra al confirmar la compra
    // o al confirmar el cambio de PIN. Pasamos al paso de compra.
    setStep('buy');
  }

  async function handleComprar() {
    const n = parseInt(cantidad, 10);
    if (!Number.isInteger(n) || n < 1) {
      Alert.alert('Cantidad inválida', 'Elegí un número mayor o igual a 1.');
      return;
    }
    if (maxCompra != null && n > maxCompra) {
      Alert.alert('Tope excedido', `El máximo por compra es ${maxCompra} fichas.`);
      return;
    }
    setLoading(true);
    try {
      const res = await comprarFichas(pin, n);
      Alert.alert(
        '¡Compra realizada!',
        `Se sumaron ${n} ficha${n === 1 ? '' : 's'}. Saldo actual: ${res.nuevo_saldo}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'No se pudo completar la compra';
      if (err?.response?.status === 401) {
        setStep('pin');
        setPin('');
        setPinErr('PIN incorrecto');
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCambiarPin() {
    if (!validarPinFormato(pinNuevo) || !validarPinFormato(pinNuevo2)) {
      Alert.alert('PIN inválido', 'Los PIN nuevos deben tener 4 dígitos.');
      return;
    }
    if (pinNuevo !== pinNuevo2) {
      Alert.alert('No coincide', 'Los dos PIN nuevos no son iguales.');
      return;
    }
    setLoading(true);
    try {
      await cambiarPinCompra(pin, pinNuevo);
      Alert.alert('PIN actualizado', 'Tu PIN de compra fue cambiado.', [
        { text: 'OK', onPress: () => { setPin(pinNuevo); setPinNuevo(''); setPinNuevo2(''); setStep('buy'); } },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'No se pudo cambiar el PIN';
      if (err?.response?.status === 401) {
        setStep('pin');
        setPin('');
        setPinErr('PIN actual incorrecto');
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function incrementar() {
    const n = parseInt(cantidad, 10) || 0;
    if (maxCompra != null && n >= maxCompra) return;
    setCantidad(String(n + 1));
  }

  function decrementar() {
    const n = parseInt(cantidad, 10) || 0;
    if (n <= 1) return;
    setCantidad(String(n - 1));
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {step === 'no-titular' && (
          <View style={styles.card}>
            <Text style={styles.icon}>🔒</Text>
            <Text style={styles.title}>Solo el titular puede comprar</Text>
            <Text style={styles.subtitle}>
              Las fichas las compra el titular del apto. Los miembros del apto pueden lavar con el mismo pozo de fichas.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryBtnText}>Volver</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'pin' && (
          <View style={styles.card}>
            <Text style={styles.icon}>🔒</Text>
            <Text style={styles.title}>Ingresá tu PIN</Text>
            <Text style={styles.subtitle}>
              Necesitás tu PIN de 4 dígitos para comprar fichas.
              Si es la primera vez, usá <Text style={{ fontWeight: '700' }}>1111</Text>.
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={(v) => { setPin(v.replace(/\D/g, '').slice(0, 4)); setPinErr(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              textAlign="center"
              autoFocus
            />
            {!!pinErr && <Text style={styles.errorText}>{pinErr}</Text>}
            <TouchableOpacity
              style={[styles.primaryBtn, pin.length !== 4 && styles.btnDisabled]}
              disabled={pin.length !== 4}
              onPress={handleValidarPin}
            >
              <Text style={styles.primaryBtnText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'buy' && (
          <View style={styles.card}>
            <Text style={styles.icon}>🪙</Text>
            <Text style={styles.title}>Comprar fichas</Text>
            <Text style={styles.subtitle}>
              Elegí cuántas fichas querés sumar.
              {maxCompra != null ? ` Máximo por compra: ${maxCompra}.` : ''}
            </Text>

            <View style={styles.counter}>
              <TouchableOpacity style={styles.counterBtn} onPress={decrementar}>
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.counterValue}
                value={cantidad}
                onChangeText={(v) => setCantidad(v.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                textAlign="center"
              />
              <TouchableOpacity style={styles.counterBtn} onPress={incrementar}>
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              disabled={loading}
              onPress={handleComprar}
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.primaryBtnText}>Confirmar compra</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={() => setStep('change')}>
              <Text style={styles.linkBtnText}>Cambiar PIN</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'change' && (
          <View style={styles.card}>
            <Text style={styles.icon}>🔑</Text>
            <Text style={styles.title}>Cambiar PIN</Text>
            <Text style={styles.subtitle}>Elegí un nuevo PIN de 4 dígitos.</Text>

            <Text style={styles.fieldLabel}>Nuevo PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={pinNuevo}
              onChangeText={(v) => setPinNuevo(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              textAlign="center"
            />

            <Text style={styles.fieldLabel}>Repetir PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={pinNuevo2}
              onChangeText={(v) => setPinNuevo2(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={colors.textSecondary}
              textAlign="center"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              disabled={loading}
              onPress={handleCambiarPin}
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.primaryBtnText}>Guardar nuevo PIN</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={() => { setPinNuevo(''); setPinNuevo2(''); setStep('buy'); }}>
              <Text style={styles.linkBtnText}>Volver</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  icon: { fontSize: 44, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  fieldLabel: { alignSelf: 'flex-start', fontSize: 13, color: colors.textSecondary, marginTop: 8, marginBottom: 4 },
  pinInput: {
    width: '80%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 28,
    letterSpacing: 12,
    color: colors.textPrimary,
    backgroundColor: colors.bgCard,
    marginBottom: 8,
  },
  errorText: { color: colors.error, fontSize: 13, marginBottom: 8 },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 8,
    marginBottom: 24,
  },
  counterBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.bgBlueLight,
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnText: { fontSize: 28, fontWeight: '700', color: colors.primary },
  counterValue: {
    fontSize: 44, fontWeight: '800', color: colors.textPrimary,
    minWidth: 90, padding: 0,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  linkBtn: { padding: 12, marginTop: 4 },
  linkBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
