import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegistroScreen from '../screens/RegistroScreen';
import ScanScreen from '../screens/ScanScreen';
import MachineScreen from '../screens/MachineScreen';
import CycleScreen from '../screens/CycleScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { colors } from '../constants/colors';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Registro: undefined;
  Scan: undefined;
  Machine: {
    maquina_id: string;
    ip: string;
    edificio_id: string;
  };
  Cycle: {
    maquina_id: string;
    edificio_id: string;
    tipo: 'lavarropas' | 'secadora';
  };
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Onboarding"
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bgPage },
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Registro"
          component={RegistroScreen}
          options={{ title: 'Crear cuenta' }}
        />
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ title: 'Escanear QR', headerBackVisible: false }}
        />
        <Stack.Screen
          name="Machine"
          component={MachineScreen}
          options={{ title: 'Control de Máquina' }}
        />
        <Stack.Screen
          name="Cycle"
          component={CycleScreen}
          options={{ title: 'Ciclo en progreso', headerBackVisible: false }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: 'Historial de Usos' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
