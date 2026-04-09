# TODO — CleanCare

Última actualización: 2026-04-09

## En progreso
- [ ] **Integración BLE real** — conectar firmware BLE con el flujo principal de la app (reemplazar ciclo simulado)
- [ ] **Development build** — generar APK con `npx expo run:android` para probar BLE

## Pendiente (producción)
- [ ] **Recuperar contraseña** — flujo de reset password (email o código)
- [ ] **Múltiples edificios** — permitir al admin gestionar varios edificios
- [ ] **Dominio custom** — cleancare.uy apuntando al panel
- [ ] **Tests** — al menos para endpoints del backend
- [ ] **CI/CD** — GitHub Actions para auto-deploy en push
- [ ] **Estado en tiempo real en panel** — ver qué máquinas están en uso ahora
- [ ] **Botón "Bajar App"** — vincular con Play Store o APK cuando esté listo

## Completado (2026-04-09)
- [x] **App Expo SDK 54** — alineado con Expo Go disponible en Play Store
- [x] **Vercel SPA rewrites** — vercel.json en panel para rutas client-side
- [x] **Validaciones** — email, password min 6, IP format en backend+panel+app
- [x] **Exportar reportes** — CSV desde Dashboard
- [x] **Onboarding screen** — intro del sistema (se muestra 1 vez)
- [x] **Ciclo sin ESP32** — modal lavar/secar + animación + timer + vibración
- [x] **Modelo Usuario mejorado** — usuario_id auto, teléfono, apartamento
- [x] **Modelo Uso mejorado** — estado (activo/completado/cancelado/averia), fecha_inicio, fecha_fin
- [x] **Registro mejorado** — campos teléfono y apartamento
- [x] **Historial filtrado** — solo usos del usuario logueado (?mis=true)
- [x] **Notificaciones background** — expo-notifications funciona con pantalla apagada
- [x] **Sonido de finalización** — WAV chime al completar ciclo
- [x] **Reportar avería** — botón en CycleScreen, marca uso como averia
- [x] **Landing responsive** — hamburger menu mobile, grids adaptivos
- [x] **Portal usuario web** — /usuarios (login), /registro, /mi-cuenta (resumen mensual)
- [x] **Cerrar sesión → /** — admin y usuario redirigen a landing
- [x] **Botón "Bajar App"** — placeholder en hero de landing
- [x] **Firmware BLE** — ESP32 BLE server con LED control y notificaciones
- [x] **BLE Test screen** — escaneo, conexión, control LED, log de tiempos
- [x] **PlatformIO config** — platformio.ini para firmware BLE
