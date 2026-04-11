# TODO — CleanCare

Última actualización: 2026-04-11

## En progreso
- [ ] **Permisos BLE Android** — la app pide permisos pero hay que verificar en distintos dispositivos
- [ ] **Reconexión BLE** — funciona pero a veces tarda, mejorar estabilidad

## Pendiente (producción)
- [ ] **Foto de perfil en app** — implementar con expo-image-picker (estructura lista)
- [ ] **Recuperar contraseña** — flujo de reset password (email o código)
- [ ] **Dominio custom** — cleancare.uy apuntando al panel
- [ ] **Tests** — al menos para endpoints del backend
- [ ] **CI/CD** — GitHub Actions para auto-deploy en push
- [ ] **Multi-ESP32** — un ESP32 por máquina, la app los diferencia por QR
- [ ] **OTA firmware** — actualizar ESP32 sin cable USB
- [ ] **Adaptar a Raspberry Pi Pico** — documentación lista en LOGICA_BLE.txt

## Completado (2026-04-11)
- [x] **ProfileScreen** — avatar, info usuario, logout, links, firma dev
- [x] **Login mejorado** — logo, toggle password, returnKeyType
- [x] **Registro mejorado** — toggle password, asteriscos obligatorios, selector edificio
- [x] **ScanScreen renovado** — BLE auto-connect, bottom nav, barra estado BLE
- [x] **CycleScreen mejorado** — duración real desde config, BLE diagnostics, modo sin ESP32
- [x] **Detección ciclo activo** — lee estado ESP32 al conectar, bloquea nuevos ciclos si ON
- [x] **Timer descendente** — fix bug cycleStarted state, funciona con BLE y sin BLE
- [x] **IDs ocultos** — la UI muestra nombres de máquinas, IDs son internos
- [x] **Ícono app** — lavarropas con burbujas generado con Pillow
- [x] **Firma dev** — componente </> → modal jsiutto@gmail.com (app + panel)
- [x] **Admin usuarios** — CRUD completo: crear, editar, eliminar, filtros, avatares, stats
- [x] **Foto de perfil (panel)** — upload con compresión 200x200 JPEG, base64 en MongoDB
- [x] **Firmware v3** — logs NVS, auto-reset 24h, sincronización hora, registro con usuario
- [x] **Permisos BLE runtime** — BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION
- [x] **Reconexión BLE** — cleanup manager, delay 500ms, re-scan
- [x] **Documentación** — LOGICA_BLE.txt, COMO_FUNCIONA.txt, SEGURIDAD.txt
- [x] **Código muerto eliminado** — MachineScreen, esp32.service, firmware WiFi legacy
- [x] **Empty states** — HistoryScreen y WalletScreen con ícono+título+descripción

## Completado (2026-04-10)
- [x] **Sistema de Tips** — modelo Tip, CRUD admin en /tips, popup random en CycleScreen
- [x] **Disponibilidad máquinas** — endpoint retorna ocupada/disponible, tarjetas en MiCuenta
- [x] **Exportar Excel** — reemplazado CSV por .xlsx con librería xlsx
- [x] **Apartamento obligatorio** — validación en backend, panel y app
- [x] **Seed expandido** — 10 máquinas, 10 usuarios, 60 usos en 90 días, 10 tips

## Completado (2026-04-09)
- [x] **App Expo SDK 54** — alineado con Expo Go disponible en Play Store
- [x] **Vercel SPA rewrites** — vercel.json en panel para rutas client-side
- [x] **Firmware BLE** — ESP32 BLE server con LED control y notificaciones
- [x] **BLE Test screen** — escaneo, conexión, control LED, log de tiempos
- [x] **Sistema de billetera/créditos** — completo con cron mensual
- [x] **Deploy completo** — backend + panel en Vercel
