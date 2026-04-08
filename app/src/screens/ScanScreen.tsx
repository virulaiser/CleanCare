import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

// QR format: cleancare://maquina?id=esp32-lav-3B&ip=192.168.1.45&edificio=edificio-central
function parseQR(data: string): { maquina_id: string; ip: string; edificio_id: string } | null {
  try {
    const url = new URL(data);
    if (url.protocol !== 'cleancare:') return null;
    const maquina_id = url.searchParams.get('id');
    const ip = url.searchParams.get('ip');
    const edificio_id = url.searchParams.get('edificio');
    if (!maquina_id || !ip || !edificio_id) return null;
    return { maquina_id, ip, edificio_id };
  } catch {
    return null;
  }
}

export default function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={styles.container}><Text>Cargando...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>Necesitamos acceso a la cámara para escanear el QR</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Permitir cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const parsed = parseQR(data);
    if (!parsed) {
      Alert.alert('QR inválido', 'Este código no pertenece a una máquina CleanCare.', [
        { text: 'Reintentar', onPress: () => setScanned(false) },
      ]);
      return;
    }

    navigation.navigate('Machine', parsed);
    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.hint}>Apuntá la cámara al QR de la máquina</Text>
      </View>
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.historyButtonText}>Ver historial</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.textPrimary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.bgPage,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  hint: {
    color: colors.white,
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  historyButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  historyButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
