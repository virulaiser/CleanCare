import React, { useEffect, useRef } from 'react';
import { LogBox, AppState } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { flushQueue, getApi } from './src/services/api.service';

LogBox.ignoreLogs([
  'Require cycle',
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
]);

export default function App() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Intentar drenar la cola al iniciar
    flushQueue(getApi()).catch(() => {});

    // Y cada 60s (cubre reconexiones de red sin foreground)
    intervalRef.current = setInterval(() => {
      flushQueue(getApi()).catch(() => {});
    }, 60000);

    // Cuando la app vuelve a foreground, drenar
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushQueue(getApi()).catch(() => {});
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  return <AppNavigator />;
}
