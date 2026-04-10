import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, FlatList } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { obtenerBilletera, listarMaquinas, getUsuarioGuardado, Maquina } from '../services/api.service';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;

// QR format: cleancare://maquina?id=LAV-7DED11&edificio=edificio-central
// (ip es opcional, legacy WiFi)
function parseQR(data: string): { maquina_id: string; edificio_id: string } | null {
  try {
    const url = new URL(data);
    if (url.protocol !== 'cleancare:') return null;
    const maquina_id = url.searchParams.get('id');
    const edificio_id = url.searchParams.get('edificio');
    if (!maquina_id || !edificio_id) return null;
    return { maquina_id, edificio_id };
  } catch {
    return null;
  }
}

export default function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [parsedQR, setParsedQR] = useState<{ maquina_id: string; edificio_id: string } | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [maquinas, setMaquinas] = useState<(Maquina & { ocupada?: boolean })[]>([]);
  const [showMaquinas, setShowMaquinas] = useState(false);

  useFocusEffect(
    useCallback(() => {
      obtenerBilletera().then(data => setSaldo(data.saldo)).catch(() => {});
      getUsuarioGuardado().then(u => {
        if (u?.edificio_id) listarMaquinas(u.edificio_id).then(m => setMaquinas(m as any)).catch(() => {});
      });
    }, [])
  );

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

    setParsedQR(parsed);
  };

  const getTipoFromQR = (): 'lavarropas' | 'secadora' => {
    if (parsedQR?.maquina_id.startsWith('SEC')) return 'secadora';
    return 'lavarropas';
  };

  const handleConfirmCycle = () => {
    if (!parsedQR) return;

    // Verificar saldo antes de iniciar
    if (saldo !== null && saldo <= 0) {
      Alert.alert(
        'Sin fichas',
        'No tenés fichas suficientes para iniciar un ciclo. Contactá al administrador del edificio.',
        [{ text: 'OK' }]
      );
      return;
    }

    const tipo = getTipoFromQR();
    setParsedQR(null);
    setScanned(false);
    navigation.navigate('Cycle', {
      maquina_id: parsedQR.maquina_id,
      edificio_id: parsedQR.edificio_id,
      tipo,
    });
  };

  const handleCancelModal = () => {
    setParsedQR(null);
    setScanned(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        {/* Badge de saldo */}
        {saldo !== null && (
          <TouchableOpacity style={styles.saldoBadge} onPress={() => navigation.navigate('Wallet')}>
            <Text style={[styles.saldoText, saldo <= 0 && { color: '#EF4444' }]}>
              {saldo} {saldo === 1 ? 'ficha' : 'fichas'}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.scanFrame} />
        <Text style={styles.hint}>Apuntá la cámara al QR de la máquina</Text>
      </View>
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.walletButton}
          onPress={() => navigation.navigate('Wallet')}
        >
          <Text style={styles.walletButtonText}>Billetera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.historyButtonText}>Historial</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.maquinasButton}
          onPress={() => setShowMaquinas(true)}
        >
          <Text style={styles.maquinasButtonText}>Máquinas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bleButton}
          onPress={() => navigation.navigate('BleTest')}
        >
          <Text style={styles.bleButtonText}>Test BLE</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de confirmación */}
      <Modal visible={!!parsedQR} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Text style={styles.modalIcon}>
                {getTipoFromQR() === 'lavarropas' ? '🫧' : '🌀'}
              </Text>
            </View>
            <Text style={styles.modalTitle}>
              {getTipoFromQR() === 'lavarropas' ? '¿Querés lavar?' : '¿Querés secar?'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Máquina: {parsedQR?.maquina_id}
            </Text>
            <View style={styles.modalBadge}>
              <Text style={[styles.modalBadgeText, {
                color: getTipoFromQR() === 'lavarropas' ? colors.primary : '#D97706',
              }]}>
                {getTipoFromQR() === 'lavarropas' ? 'Lavarropas' : 'Secadora'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, {
                backgroundColor: getTipoFromQR() === 'lavarropas' ? colors.primary : '#F59E0B',
              }]}
              onPress={handleConfirmCycle}
            >
              <Text style={styles.modalConfirmText}>
                {getTipoFromQR() === 'lavarropas' ? 'Iniciar lavado' : 'Iniciar secado'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={handleCancelModal}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal disponibilidad máquinas */}
      <Modal visible={showMaquinas} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Máquinas</Text>
            <FlatList
              data={maquinas}
              keyExtractor={(item) => item.maquina_id}
              renderItem={({ item }) => (
                <View style={[styles.maqRow, { backgroundColor: item.ocupada ? '#FEF2F2' : '#F0FDF4' }]}>
                  <View style={[styles.maqDot, { backgroundColor: item.ocupada ? '#EF4444' : '#22C55E' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{item.nombre}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {item.tipo === 'secadora' ? 'Secadora' : 'Lavarropas'}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: item.ocupada ? '#DC2626' : '#16A34A',
                  }}>
                    {item.ocupada ? 'Ocupada' : 'Disponible'}
                  </Text>
                </View>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textSecondary, padding: 20 }}>No hay máquinas</Text>}
            />
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowMaquinas(false)}>
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  historyButton: {
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
  bleButton: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  bleButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  saldoBadge: {
    position: 'absolute',
    top: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
  },
  saldoText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  walletButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  walletButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  maquinasButton: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  maquinasButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  maqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  maqDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 32,
    width: '85%',
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 36,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  modalBadge: {
    backgroundColor: colors.bgBlueLight,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 24,
  },
  modalBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalConfirmText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  modalCancelBtn: {
    paddingVertical: 10,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
