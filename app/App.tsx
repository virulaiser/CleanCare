import React from 'react';
import { LogBox } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

LogBox.ignoreLogs([
  'Require cycle',
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
]);

export default function App() {
  return <AppNavigator />;
}
