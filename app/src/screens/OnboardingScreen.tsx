import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const steps = [
  {
    icon: '📱',
    title: 'Abrí la app cerca de la máquina',
    description: 'La app se conecta sola por Bluetooth al equipo de la lavandería. No hace falta escanear nada.',
  },
  {
    icon: '🚀',
    title: 'Elegí lavar o secar',
    description: 'Tocá Lavarropas o Secadora, seleccioná la máquina libre y listo. La duración la fija la administración.',
  },
  {
    icon: '📊',
    title: 'Controlá tus usos',
    description: 'Volvé a la app en cualquier momento para ver el tiempo restante, cancelar, o revisar tu historial.',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync('cleancare_onboarded').then((val) => {
      if (val === 'true') {
        navigation.replace('Login');
      } else {
        setLoading(false);
      }
    });
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleStart = async () => {
    await SecureStore.setItemAsync('cleancare_onboarded', 'true');
    navigation.replace('Login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>🧺</Text>
        </View>
        <Text style={styles.title}>CleanCare</Text>
        <Text style={styles.subtitle}>Lavandería inteligente para tu edificio</Text>
      </View>

      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepCard}>
            <View style={styles.stepIconContainer}>
              <Text style={styles.stepIcon}>{step.icon}</Text>
            </View>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDescription}>{step.description}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleStart}>
        <Text style={styles.buttonText}>Comenzar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.bgPage,
    padding: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bgBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  stepCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  stepIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepIcon: {
    fontSize: 28,
  },
  stepNumber: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgPage,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
});
