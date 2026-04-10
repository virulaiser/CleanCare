# TODO — CleanCare

Última actualización: 2026-04-10

## En progreso
- [ ] **Integración BLE real** — conectar firmware BLE con el flujo principal de la app (reemplazar ciclo simulado)
- [ ] **Development build** — generar APK con `npx expo run:android` para probar BLE

## Pendiente (producción)
- [ ] **Recuperar contraseña** — flujo de reset password (email o código)
- [ ] **Dominio custom** — cleancare.uy apuntando al panel
- [ ] **Tests** — al menos para endpoints del backend
- [ ] **CI/CD** — GitHub Actions para auto-deploy en push
- [ ] **Botón "Bajar App"** — vincular con Play Store o APK cuando esté listo

## Completado (2026-04-10)
- [x] **Sistema de Tips** — modelo Tip, CRUD admin en /tips, popup random en CycleScreen (1 por ciclo, 5s delay), 10 tips de ejemplo
- [x] **Disponibilidad máquinas** — endpoint retorna ocupada/disponible, tarjetas en MiCuenta, modal en app ScanScreen
- [x] **Exportar Excel** — reemplazado CSV por .xlsx con librería xlsx en Dashboard y Créditos
- [x] **Apartamento obligatorio** — validación en backend, panel y app
- [x] **Seed expandido** — 10 máquinas, 10 usuarios, 60 usos en 90 días, 10 tips
- [x] **Buscador/filtro en Créditos** — por nombre, email, apto, saldo + dropdown edificio
- [x] **Selector edificio en Máquinas** — dropdown en formulario crear + selector en lista activas
- [x] **Registro redirige** — panel vuelve a /usuarios tras registrar exitosamente
- [x] **UI cleanup** — sin "Inicio" en navbar, nombres de máquina en vez de IDs en Dashboard, sin columna Código en Máquinas
- [x] **QR sin ID** — modal QR e impresión solo muestran nombre+tipo+QR
- [x] **Admin edificio** — campos admin_nombre y admin_telefono en modelo Edificio y formulario
- [x] **Máquina ID largo (ObjectId)** — maquina_id usa ObjectId hex (24 chars) para QR
- [x] **Auto-nombre máquinas** — nombre generado: edificio_TIPO_N
- [x] **Modales auto-cierre** — se cierran después de acción exitosa
- [x] **Tipo "Ambos"** — crea lavarropas + secadora de una vez
- [x] **Duración lavado/secado** — campos en ConfigEdificio, inputs en panel Créditos
- [x] **Estado de cuenta modal** — ver transacciones por usuario desde Créditos
- [x] **UUID máquinas + eliminar IP** — ip_local eliminado, máquinas por maquina_id auto-generado
- [x] **Colección Edificios** — modelo con nombre, dirección, admin; dropdown en registro
- [x] **Cifrado en celular** — expo-secure-store (Keychain/EncryptedSharedPreferences)
- [x] **Sistema de billetera/créditos** — Transaccion + ConfigEdificio, endpoints, cron mensual, panel Créditos, WalletScreen en app
- [x] **Deploy completo** — backend + panel en Vercel con todos los cambios

## Completado (2026-04-09)
- [x] **App Expo SDK 54** — alineado con Expo Go disponible en Play Store
- [x] **Vercel SPA rewrites** — vercel.json en panel para rutas client-side
- [x] **Validaciones** — email, password min 6 en backend+panel+app
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
