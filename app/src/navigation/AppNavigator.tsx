import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ScanScreen from '../screens/ScanScreen';
import MachineScreen from '../screens/MachineScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { colors } from '../constants/colors';

export type RootStackParamList = {
  Scan: undefined;
  Machine: {
    maquina_id: string;
    ip: string;
    edificio_id: string;
  };
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Scan"
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bgPage },
        }}
      >
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ title: 'Escanear QR' }}
        />
        <Stack.Screen
          name="Machine"
          component={MachineScreen}
          options={{ title: 'Control de Máquina' }}
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
