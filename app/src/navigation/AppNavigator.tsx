import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegistroScreen from '../screens/RegistroScreen';
import SelectScreen from '../screens/SelectScreen';
import CycleScreen from '../screens/CycleScreen';
import HistoryScreen from '../screens/HistoryScreen';
import BleTestScreen from '../screens/BleTestScreen';
import WalletScreen from '../screens/WalletScreen';
import PurchaseScreen from '../screens/PurchaseScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WaitingApprovalScreen from '../screens/WaitingApprovalScreen';
import ApartamentoScreen from '../screens/ApartamentoScreen';
import { colors } from '../constants/colors';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Registro: undefined;
  Select: undefined;
  Cycle: {
    maquina_id: string;
    edificio_id: string;
    tipo: 'lavarropas' | 'secadora';
    duracion_min: number;
    nombre_maquina: string;
    preArmed?: boolean;
  };
  History: undefined;
  Wallet: undefined;
  Purchase: undefined;
  Profile: undefined;
  WaitingApproval: undefined;
  Apartamento: undefined;
  BleTest: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bgPage },
        }}
      >
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />
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
          name="Select"
          component={SelectScreen}
          options={{ title: 'Elegir máquina', headerShown: false }}
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
        <Stack.Screen
          name="Wallet"
          component={WalletScreen}
          options={{ title: 'Mi Billetera' }}
        />
        <Stack.Screen
          name="Purchase"
          component={PurchaseScreen}
          options={{ title: 'Comprar fichas' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Mi Perfil' }}
        />
        <Stack.Screen
          name="WaitingApproval"
          component={WaitingApprovalScreen}
          options={{ title: 'Aprobación pendiente', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Apartamento"
          component={ApartamentoScreen}
          options={{ title: 'Miembros del apto' }}
        />
        <Stack.Screen
          name="BleTest"
          component={BleTestScreen}
          options={{ title: 'Test BLE' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
