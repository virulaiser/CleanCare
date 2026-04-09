# CLAUDE.md — CleanCare

## ¿Qué es este proyecto?

CleanCare es un sistema de gestión de lavarropas y secadoras por domótica para edificios residenciales. Los residentes escanean un QR en la máquina, la activan desde el celular por X minutos, y la administración del edificio recibe un reporte mensual de usos para facturación.

---

## Arquitectura del sistema

```
[QR en máquina] → [App React Native] ←→ [ESP32 por BLE]
                        ↓
                 [Backend API — Vercel]
                        ↓
                  [MongoDB Atlas]
                        ↓
                 [Panel web — React]
```

### Reglas de comunicación — CRÍTICO
- El **ESP32** se comunica con la **app móvil** via **BLE** (Bluetooth Low Energy)
- El **backend** solo se comunica con la **app móvil** y el **panel web** (nunca con el ESP32)
- La **app móvil** es el único punto que habla con ambos (ESP32 + backend)
- Flujo: escanear QR → conectar ESP32 BLE → activar relay → confirmar estado → POST al backend

---

## Stack tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| App móvil | React Native (Expo) | SDK 54 (expo 54.0.33, RN 0.81.5) |
| Backend API | Node.js + Express + Mongoose | Express 5.2.1 / Mongoose 9.4.1 |
| Base de datos | MongoDB Atlas | Cluster en sa-east-1 |
| Panel web | React + Vite + TypeScript | React 19 / Vite 6 |
| Auth | JWT + bcryptjs | jsonwebtoken 9.0.3 |
| Deploy backend/panel | Vercel (serverless) | — |
| Hardware | ESP32 (BLE) + relay | PlatformIO / Arduino |
| BLE | react-native-ble-plx | Expo config plugin |
| Notificaciones | expo-notifications | Background alerts |
| Audio | expo-av | Sonido de finalización |

---

## URLs desplegadas

| Servicio | URL |
|---|---|
| Backend API | https://backend-one-tau-21.vercel.app |
| Panel web | https://panel-three-blush.vercel.app |
| Landing page | https://panel-three-blush.vercel.app/ |
| Login usuario | https://panel-three-blush.vercel.app/usuarios |
| Registro usuario | https://panel-three-blush.vercel.app/registro |
| Mi cuenta | https://panel-three-blush.vercel.app/mi-cuenta |
| Admin login | https://panel-three-blush.vercel.app/login |
| Admin dashboard | https://panel-three-blush.vercel.app/dashboard |
| Admin máquinas | https://panel-three-blush.vercel.app/maquinas |
| Repositorio | https://github.com/virulaiser/CleanCare |

### Credenciales admin
- **Email**: admin@cleancare.uy
- **Password**: admin123
- **Rol**: admin
- **Edificio**: edificio-central

---

## Estructura de carpetas

```
cleancare/
├── CLAUDE.md
├── TODO.md
├── .env                            # Variables de entorno (NO commitear)
├── .env.example
├── .gitignore
│
├── app/                            # React Native (Expo SDK 54)
│   ├── App.tsx                     # Entry point
│   ├── app.json                    # Config Expo (scheme cleancare://, BLE plugin)
│   ├── tsconfig.json
│   ├── assets/
│   │   ├── icon.png
│   │   └── notification.wav        # Sonido de finalización de ciclo
│   └── src/
│       ├── constants/
│       │   └── colors.ts           # Paleta CleanCare compartida
│       ├── navigation/
│       │   └── AppNavigator.tsx     # Stack: Onboarding → Login → Scan → Cycle → History → BleTest
│       ├── screens/
│       │   ├── OnboardingScreen.tsx # Intro del sistema (se muestra 1 vez)
│       │   ├── LoginScreen.tsx      # Login con JWT + auto-redirect
│       │   ├── RegistroScreen.tsx   # Registro (nombre, email, password, tel, apto, edificio)
│       │   ├── ScanScreen.tsx       # Cámara QR + modal lavar/secar
│       │   ├── CycleScreen.tsx      # Animación máquina + timer + notif background + reportar avería
│       │   ├── MachineScreen.tsx    # Estado ESP32 WiFi (legacy, para cuando haya ESP32 WiFi)
│       │   ├── HistoryScreen.tsx    # Historial personal con badges estado
│       │   └── BleTestScreen.tsx    # Test conexión BLE con ESP32
│       └── services/
│           ├── api.service.ts       # Axios + JWT + iniciarUso/actualizarUso/listarUsos
│           └── esp32.service.ts     # HTTP directo al ESP32 WiFi (legacy)
│
├── backend/                        # Node.js + Express → Vercel serverless
│   ├── api/
│   │   ├── index.js                # Router Express (dev local + Vercel export)
│   │   ├── auth.js                 # POST /api/auth?action=login|registro
│   │   ├── uso.js                  # POST /api/uso (inicio) + PATCH (fin/avería)
│   │   ├── usos.js                 # GET /api/usos (filtro ?mis=true)
│   │   ├── resumen.js              # GET /api/resumen (solo admin)
│   │   └── maquinas.js             # GET/POST/DELETE /api/maquinas
│   ├── models/
│   │   ├── Uso.js                  # Schema: estado, fecha_inicio, fecha_fin, completado
│   │   ├── Maquina.js              # Schema: maquina_id (auto-gen), nombre, tipo, ip, activa
│   │   └── Usuario.js              # Schema: usuario_id (auto-gen), email, tel, apto, edificio
│   ├── lib/
│   │   ├── mongodb.js              # Conexión singleton Mongoose
│   │   └── auth.js                 # generarToken, verificarToken, soloAdmin
│   ├── vercel.json
│   └── package.json
│
├── panel/                          # React + Vite + TypeScript → Vercel
│   ├── index.html
│   ├── vercel.json                 # SPA rewrite para rutas client-side
│   ├── vite.config.ts              # Proxy /api → localhost:3000 en dev
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx                # Router: / → /usuarios → /registro → /mi-cuenta → /login → /dashboard → /maquinas
│       ├── styles/global.css       # Reset + responsive media queries + hamburger menu
│       ├── constants/colors.ts
│       ├── services/api.ts         # Axios + JWT + login/registro/listarMisUsos
│       └── pages/
│           ├── Home.tsx            # Landing page responsive (hero, servicios, contacto, hamburger mobile)
│           ├── Usuarios.tsx        # Login de usuario residente
│           ├── Registro.tsx        # Registro público con todos los campos
│           ├── MiCuenta.tsx        # Resumen mensual de uso del residente
│           ├── Login.tsx           # Login admin con JWT
│           ├── Dashboard.tsx       # KPIs + resumen facturación + exportar CSV
│           └── Maquinas.tsx        # CRUD máquinas + generación QR + impresión
│
└── firmware/                       # ESP32
    ├── cleancare_esp32/            # Firmware WiFi HTTP (legacy)
    │   └── cleancare_esp32.ino
    └── ble_test/                   # Firmware BLE (actual)
        ├── platformio.ini          # Config PlatformIO
        ├── ble_test.ino            # Fuente Arduino IDE
        └── src/
            └── main.cpp            # Fuente PlatformIO
```

---

## Base de datos — MongoDB Atlas

### Conexión
```
Host:       cluster0.uspcw.mongodb.net
Usuario:    nacho1
DB:         cleancare
Region:     AWS / São Paulo (sa-east-1)
```

### IMPORTANTE — Windows / Node.js
Siempre usar connection string estándar (NO SRV):
```env
MONGODB_URI=mongodb://nacho1:<password>@cluster0-shard-00-00.uspcw.mongodb.net:27017,cluster0-shard-00-01.uspcw.mongodb.net:27017,cluster0-shard-00-02.uspcw.mongodb.net:27017/cleancare?ssl=true&replicaSet=atlas-cnarts-shard-0&authSource=admin
```

### Colecciones

#### `usuarios`
```json
{
  "usuario_id": "USR-DD3FAD",
  "email": "juan@email.com",
  "password": "$2a$10$...",
  "nombre": "Juan Pérez",
  "telefono": "099123456",
  "apartamento": "3B",
  "rol": "residente",
  "edificio_id": "edificio-central",
  "unidad": "apto-302",
  "activo": true,
  "creado": "2026-04-09T..."
}
```

#### `maquinas`
```json
{
  "maquina_id": "LAV-7DED11",
  "edificio_id": "edificio-central",
  "tipo": "lavarropas",
  "ip_local": "192.168.1.45",
  "nombre": "Lavarropas Piso 3",
  "activa": true
}
```

#### `usos`
```json
{
  "maquina_id": "LAV-7DED11",
  "edificio_id": "edificio-central",
  "tipo": "lavarropas",
  "duracion_min": 45,
  "residente_id": "3B",
  "estado": "completado",
  "completado": true,
  "fecha_inicio": "2026-04-09T15:00:00.000Z",
  "fecha_fin": "2026-04-09T15:45:00.000Z",
  "fecha": "2026-04-09T15:00:00.000Z"
}
```

---

## API Endpoints

### Públicos
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api` | Health check |
| `POST` | `/api/auth?action=login` | Login → retorna JWT |
| `POST` | `/api/auth?action=registro` | Registro → retorna JWT |

### Protegidos (requieren Bearer token)
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/uso` | Iniciar ciclo (estado: activo, fecha_inicio) |
| `PATCH` | `/api/uso?id=X` | Actualizar ciclo (completado/cancelado/averia, fecha_fin) |
| `GET` | `/api/usos` | Listar usos (todos, o ?mis=true para filtrar por usuario) |
| `GET` | `/api/maquinas?edificioId=X` | Listar máquinas activas |

### Solo admin
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/resumen?edificioId&mes&anio` | Resumen facturación mensual |
| `POST` | `/api/maquinas` | Crear máquina (genera código LAV/SEC-XXXXXX) |
| `DELETE` | `/api/maquinas?maquinaId=X` | Soft-delete máquina |

---

## Autenticación — JWT

- **Algoritmo**: HS256
- **Expiración**: 7 días
- **Payload**: `{ id, usuario_id, email, rol, edificio_id, unidad, apartamento }`
- **Middleware**: `verificarToken` (todas las rutas protegidas), `soloAdmin` (admin-only)
- **Password**: bcrypt con 10 rounds, mínimo 6 caracteres
- **Validación email**: regex en backend y app
- **App**: token en AsyncStorage
- **Panel**: token en localStorage, interceptor axios auto-redirect en 401

---

## ESP32 — BLE (Bluetooth Low Energy)

### Firmware BLE (`firmware/ble_test/`)
- **Nombre BLE**: `CleanCare-ESP32`
- **Service UUID**: `12345678-1234-1234-1234-123456789abc`
- **Control Char** (Write): `12345678-1234-1234-1234-123456789abd`
- **Status Char** (Notify): `12345678-1234-1234-1234-123456789abe`

### Comandos
| Comando | Descripción |
|---|---|
| `ON:60` | Encender LED por 60 segundos |
| `OFF` | Apagar LED inmediatamente |
| `STATUS` | Pedir estado actual |

### Respuestas (Notify)
| Respuesta | Significado |
|---|---|
| `ON:45` | LED encendido, 45 segundos restantes |
| `OFF:0` | LED apagado |

### Subir firmware
```bash
# Con PlatformIO (recomendado)
cd firmware/ble_test
pio run --target upload
pio device monitor

# Con Arduino IDE
# Abrir firmware/ble_test/ble_test.ino
# Board: ESP32 Dev Module
# Upload + Serial Monitor 115200
```

---

## Flujo completo — App (sin ESP32 físico)

1. Residente abre la app → OnboardingScreen (solo la primera vez)
2. LoginScreen (o auto-login si hay token guardado)
3. ScanScreen → escanea QR de la máquina
4. Modal: "¿Querés lavar?" / "¿Querés secar?" (detecta tipo del QR)
5. CycleScreen → POST /api/uso (estado: activo, fecha_inicio)
6. Animación de máquina + timer descendente + notificación programada
7. Si sale de la app → notificación suena con pantalla apagada
8. Al terminar → vibración + sonido + PATCH /api/uso (estado: completado, fecha_fin)
9. Si reporta avería → PATCH /api/uso (estado: averia)

### Flujo BLE (con ESP32)
1. ScanScreen → botón "Test BLE"
2. BleTestScreen → escanea BLE → encuentra "CleanCare-ESP32"
3. Conecta + descubre servicios (log muestra tiempos)
4. Botón "Encender LED" → envía `ON:60` via BLE
5. ESP32 prende LED + notifica estado cada 2s
6. Al terminar → ESP32 apaga LED + notifica `OFF:0`

### Flujo admin
1. Admin ingresa al panel → /login con JWT
2. Dashboard: KPIs + resumen facturación + exportar CSV
3. Máquinas: crea máquinas, genera QR, imprime etiquetas

### Flujo usuario web
1. Landing (/) → botón "Usuarios"
2. /usuarios → login de residente
3. /mi-cuenta → resumen mensual con KPIs y tabla de historial

---

## Comandos útiles

```bash
# Backend — desarrollo local
cd backend && node api/index.js

# Panel — desarrollo local
cd panel && npm run dev

# App — desarrollo (Expo Go, sin BLE)
cd app && npx expo start --lan

# App — development build (con BLE)
cd app && npx expo run:android

# Firmware — PlatformIO
cd firmware/ble_test && pio run --target upload

# Deploy a Vercel
cd backend && npx vercel --prod
cd panel && npx vercel --prod
```

---

## Convenciones de código

- Lenguaje: **TypeScript** en app y panel, **JavaScript** en backend, **C++** en firmware
- Nombrado: camelCase para variables/funciones, PascalCase para componentes
- Commits: `feat:`, `fix:`, `chore:`, `docs:` (Conventional Commits)
- No commitear `.env` — usar `.env.example` con valores vacíos
- Siempre manejar errores de red (el ESP32 puede estar offline)
- Estilos inline con objetos `styles` tipados en React (panel y app)
- Axios interceptors para JWT en app (AsyncStorage) y panel (localStorage)
- Panel responsive con media queries en global.css + hamburger menu mobile

---

## Consideraciones importantes

- **Sin internet no funciona el registro de uso**, pero BLE funciona offline
- **BLE requiere development build** (`npx expo run:android`), no funciona en Expo Go
- **Expo Go** funciona para todo excepto BLE (QR, login, ciclo simulado, historial)
- En Windows/Node.js usar siempre connection string estándar (no SRV) para MongoDB
- MongoDB Atlas capa gratuita (512MB) — suficiente para empezar
- Soft-delete en máquinas preserva historial de usos
- Los códigos de máquina son únicos (LAV/SEC + 6 hex chars)
- Los códigos de usuario son únicos (USR + 6 hex chars)
- Timer usa `Date.now()` para precisión incluso después de background
- Notificaciones programadas con `expo-notifications` funcionan con pantalla apagada

---

## Vercel — Proyectos desplegados

| Proyecto | Directorio | Alias |
|---|---|---|
| backend | `/backend` | backend-one-tau-21.vercel.app |
| panel | `/panel` | panel-three-blush.vercel.app |

### Env vars en Vercel
- **backend**: `MONGODB_URI`, `JWT_SECRET`
- **panel**: `VITE_API_URL`
