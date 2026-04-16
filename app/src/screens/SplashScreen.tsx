import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Text, StyleSheet, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getBleManager } from '../services/bleManager';
import { ESP32_BLE_NAME } from '../constants/ble';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
    }
    const loc = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return loc === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function scanForESP32(timeoutMs = 4000): Promise<boolean> {
  const manager = getBleManager();
  try {
    const state = await manager.state();
    if (state !== 'PoweredOn') return false;
  } catch { return false; }

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (found: boolean) => {
      if (resolved) return;
      resolved = true;
      try { manager.stopDeviceScan(); } catch {}
      resolve(found);
    };
    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) { finish(false); return; }
      const name = device?.name || device?.localName;
      if (name === ESP32_BLE_NAME) finish(true);
    });
    setTimeout(() => finish(false), timeoutMs);
  });
}

export default function SplashScreen({ navigation }: Props) {
  const [status, setStatus] = useState<'loading' | 'searching' | 'found' | 'not-found'>('loading');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      const [token, onboardingDone] = await Promise.all([
        SecureStore.getItemAsync('cleancare_token').catch(() => null),
        SecureStore.getItemAsync('cleancare_onboarded').catch(() => null),
      ]);

      // Pedir permisos y buscar ESP32 en paralelo con la pausa de presentación
      const granted = await requestBlePermissions();
      if (!mounted.current) return;

      if (granted) {
        setStatus('searching');
        const found = await scanForESP32(3500);
        if (!mounted.current) return;
        setStatus(found ? 'found' : 'not-found');
      } else {
        setStatus('not-found');
      }

      // Asegurar al menos 2s de splash visible
      await new Promise((r) => setTimeout(r, 800));
      if (!mounted.current) return;

      // Navegar al siguiente paso según estado
      if (onboardingDone !== 'true') {
        navigation.replace('Onboarding');
      } else if (!token) {
        navigation.replace('Login');
      } else {
        navigation.replace('Scan');
      }
    })();

    return () => { mounted.current = false; };
  }, [navigation]);

  const getMensaje = () => {
    switch (status) {
      case 'loading': return 'Iniciando...';
      case 'searching': return 'Buscando CleanCare-ESP32...';
      case 'found': return '✓ Conectado al ESP32';
      case 'not-found': return '⚠ Acercate a una máquina CleanCare y activá el Bluetooth';
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>CleanCare</Text>
      <ActivityIndicator size="small" color={colors.white} style={{ marginTop: 24 }} />
      <Text style={styles.status}>{getMensaje()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  logo: { width: 140, height: 140, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: colors.white, letterSpacing: 1 },
  status: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 12, textAlign: 'center' },
});
