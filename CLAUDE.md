# CLAUDE.md — CleanCare

## ¿Qué es este proyecto?

CleanCare es un sistema de gestión de lavarropas y secadoras por domótica para edificios residenciales. Los residentes escanean un QR en la máquina, la activan desde el celular por X minutos, y la administración del edificio recibe un reporte mensual de usos para facturación.

---

## Arquitectura del sistema

```
[QR en máquina] → [App React Native] ←→ [ESP32 por WiFi local]
                        ↓
                 [Backend API — Vercel]
                        ↓
                  [MongoDB Atlas]
                        ↓
                 [Panel web — React]
```

### Reglas de comunicación — CRÍTICO
- El **ESP32** solo se comunica con la **app móvil** (WiFi local, HTTP directo por IP)
- El **backend** solo se comunica con la **app móvil** y el **panel web** (nunca con el ESP32)
- La **app móvil** es el único punto que habla con ambos (ESP32 + backend)
- Flujo: escanear QR → conectar ESP32 → activar relay → confirmar estado → POST al backend

---

## Stack tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| App móvil | React Native (Expo) | SDK 55 (expo 55.0.12, RN 0.83.4) |
| Backend API | Node.js + Express + Mongoose | Express 5.2.1 / Mongoose 9.4.1 |
| Base de datos | MongoDB Atlas | Cluster en sa-east-1 |
| Panel web | React + Vite + TypeScript | React 19 / Vite 6 |
| Auth | JWT + bcryptjs | jsonwebtoken 9.0.3 |
| Deploy backend/panel | Vercel (serverless) | — |
| Hardware | ESP32 + relay | Arduino |

---

## URLs desplegadas

| Servicio | URL |
|---|---|
| Backend API | https://backend-one-tau-21.vercel.app |
| Panel web | https://panel-three-blush.vercel.app |
| Landing page | https://panel-three-blush.vercel.app/ |
| Panel login | https://panel-three-blush.vercel.app/login |
| Panel dashboard | https://panel-three-blush.vercel.app/dashboard |
| Panel máquinas | https://panel-three-blush.vercel.app/maquinas |
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
├── .env                            # Variables de entorno (NO commitear)
├── .env.example
├── .gitignore
│
├── app/                            # React Native (Expo SDK 55)
│   ├── App.tsx                     # Entry point
│   ├── app.json                    # Config Expo (scheme cleancare://)
│   ├── tsconfig.json
│   ├── assets/
│   │   └── icon.png
│   └── src/
│       ├── constants/
│       │   └── colors.ts           # Paleta CleanCare compartida
│       ├── navigation/
│       │   └── AppNavigator.tsx     # Stack: Login → Registro → Scan → Machine → History
│       ├── screens/
│       │   ├── LoginScreen.tsx      # Login con JWT + auto-redirect
│       │   ├── RegistroScreen.tsx   # Registro de nuevos usuarios
│       │   ├── ScanScreen.tsx       # Cámara QR + parseo cleancare://
│       │   ├── MachineScreen.tsx    # Estado ESP32, selector duración, activar
│       │   └── HistoryScreen.tsx    # Lista de usos con pull-to-refresh
│       └── services/
│           ├── api.service.ts       # Axios + JWT interceptor + AsyncStorage
│           └── esp32.service.ts     # HTTP directo al ESP32 (timeout 5s)
│
├── backend/                        # Node.js + Express → Vercel serverless
│   ├── api/
│   │   ├── index.js                # Router Express (dev local + Vercel export)
│   │   ├── auth.js                 # POST /api/auth?action=login|registro
│   │   ├── uso.js                  # POST /api/uso (residente_id del JWT)
│   │   ├── usos.js                 # GET /api/usos
│   │   ├── resumen.js              # GET /api/resumen (solo admin)
│   │   └── maquinas.js             # GET/POST/DELETE /api/maquinas
│   ├── models/
│   │   ├── Uso.js                  # Schema: maquina_id, edificio_id, duracion_min, etc.
│   │   ├── Maquina.js              # Schema: maquina_id (auto-gen), nombre, tipo, ip, activa
│   │   └── Usuario.js              # Schema: email, password (bcrypt), rol, edificio_id
│   ├── lib/
│   │   ├── mongodb.js              # Conexión singleton Mongoose
│   │   └── auth.js                 # generarToken, verificarToken, soloAdmin
│   ├── vercel.json
│   └── package.json
│
├── panel/                          # React + Vite + TypeScript → Vercel
│   ├── index.html
│   ├── vite.config.ts              # Proxy /api → localhost:3000 en dev
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx                # Router: / → /login → /dashboard → /maquinas
│       ├── styles/global.css
│       ├── constants/colors.ts
│       ├── services/api.ts         # Axios + JWT interceptor + auto-redirect 401
│       └── pages/
│           ├── Home.tsx            # Landing page (hero, servicios, contacto)
│           ├── Login.tsx           # Login real con JWT
│           ├── Dashboard.tsx       # KPIs + resumen facturación + últimos usos
│           └── Maquinas.tsx        # CRUD máquinas + generación QR + impresión
│
└── firmware/                       # ESP32 Arduino
    └── cleancare_esp32/
        └── cleancare_esp32.ino     # POST /activar, GET /estado
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
  "email": "admin@cleancare.uy",
  "password": "$2a$10$...",
  "nombre": "Admin CleanCare",
  "rol": "admin",
  "edificio_id": "edificio-central",
  "unidad": null,
  "activo": true,
  "creado": "2026-04-08T..."
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
  "residente_id": "apto-302",
  "fecha": "2026-04-08T15:52:56.202Z"
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
| `POST` | `/api/uso` | Registrar uso (residente_id del JWT) |
| `GET` | `/api/usos` | Listar todos los usos |
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
- **Payload**: `{ id, email, rol, edificio_id, unidad }`
- **Middleware**: `verificarToken` (todas las rutas protegidas), `soloAdmin` (admin-only)
- **Password**: bcrypt con 10 rounds
- **App**: token en AsyncStorage
- **Panel**: token en localStorage, interceptor axios auto-redirect en 401

---

## Generación de máquinas y QR

Al crear una máquina desde el panel admin:
1. Se genera un código alfanumérico único: `LAV-XXXXXX` o `SEC-XXXXXX` (crypto.randomBytes)
2. Se guarda en MongoDB con nombre, tipo, IP local, edificio
3. Se genera un QR con el formato: `cleancare://maquina?id={maquina_id}&ip={ip}&edificio={edificio_id}`
4. El QR se puede ver en modal y se puede imprimir desde el panel
5. La app escanea el QR, parsea el protocolo `cleancare://` y navega a MachineScreen

---

## ESP32 — API local (WiFi)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/activar` | Enciende relay por N minutos (`{ "minutos": 45 }`) |
| `GET` | `/estado` | Estado actual (`{ "estado": "funcionando", "minutos_restantes": 32 }`) |

### QR contiene
```
cleancare://maquina?id=LAV-7DED11&ip=192.168.1.45&edificio=edificio-central
```

---

## Variables de entorno

### Backend (.env raíz)
```env
MONGODB_URI=mongodb://nacho1:<password>@...
JWT_SECRET=<secret>
PORT=3000
```

### App (app/.env)
```env
EXPO_PUBLIC_API_URL=https://backend-one-tau-21.vercel.app
```

### Panel (Vercel env vars)
```
VITE_API_URL=https://backend-one-tau-21.vercel.app
```

---

## Diseño y estilo — paleta CleanCare

```js
const colors = {
  primary:        '#3B82F6',
  primaryDark:    '#2563EB',
  accent:         '#0EA5E9',
  bgPage:         '#F8FAFC',
  bgCard:         '#F1F5F9',
  bgBlueLight:    '#DBEAFE',
  textPrimary:    '#1E293B',
  textSecondary:  '#94A3B8',
  white:          '#FFFFFF',
  border:         '#E5E7EB',
  error:          '#EF4444',
  success:        '#22C55E',
}
```

### Reglas de estilo — UX Design
- **Botones**: `border-radius: 999px` (pill), fondo azul sólido, texto blanco
- **Tipografía**: Inter (Google Fonts) o sistema sans-serif
- **Cards**: fondo blanco, borde `#E5E7EB` 1px, border-radius 12px, sombra sutil
- **Estilo general**: limpio, minimalista, blanco con acentos azules
- **Íconos**: estilo outline, tamaño 24px
- **Badges**: pill con fondo suave (azul para lavarropas, amarillo para secadoras)
- **Navegación panel**: header fijo con logo + botones pill
- **Landing page**: hero full-height, secciones alternas blanco/gris, CTA azul, footer oscuro
- **Formularios**: inputs con borde gris, border-radius 8px, labels pequeñas arriba
- **Modales**: overlay semi-transparente, card centrada con border-radius 16px
- **Tablas**: headers gris secundario, filas separadas por borde sutil
- **Estados**: verde para disponible/éxito, azul para activo, rojo para error, amarillo para secadoras
- **Responsive**: grids con `auto-fit, minmax()`, flexWrap para formularios
- **Animaciones**: transiciones suaves, sin animaciones excesivas
- **Accesibilidad**: contraste suficiente, placeholders descriptivos, labels visibles
- **Consistencia**: misma paleta y componentes en app, panel y landing

---

## Flujo completo paso a paso

1. Residente abre la app → LoginScreen (o auto-login si hay token)
2. Escanea el QR de la máquina → ScanScreen
3. App parsea `cleancare://maquina?id=LAV-7DED11&ip=192.168.1.45&edificio=edificio-central`
4. App hace `GET http://{ip}/estado` → verifica que la máquina esté libre
5. Usuario selecciona duración (30 / 45 / 60 min) y confirma
6. App hace `POST http://{ip}/activar` con `{ minutos: 45 }`
7. ESP32 activa el relay y responde `{ estado: "funcionando" }`
8. App hace `POST /api/uso` con JWT → backend registra uso con residente_id del token
9. App muestra estado y pollea `GET /estado` cada 30s
10. Al finalizar, ESP32 apaga el relay

### Flujo admin
1. Admin ingresa al panel → Login con JWT
2. Dashboard: ve KPIs y resumen de facturación por mes
3. Máquinas: crea máquinas, genera QR, imprime etiquetas
4. Los QR impresos se pegan en las máquinas físicas

---

## Comandos útiles

```bash
# Backend — desarrollo local
cd backend && node api/index.js

# Panel — desarrollo local
cd panel && npm run dev

# App — desarrollo (Expo Go)
cd app && npx expo start --lan

# Deploy a Vercel
cd backend && npx vercel --prod
cd panel && npx vercel --prod

# Tests rápidos
curl https://backend-one-tau-21.vercel.app/api
curl -X POST https://backend-one-tau-21.vercel.app/api/auth?action=login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cleancare.uy","password":"admin123"}'
```

---

## Convenciones de código

- Lenguaje: **TypeScript** en app y panel, **JavaScript** en backend
- Nombrado: camelCase para variables/funciones, PascalCase para componentes
- Commits: `feat:`, `fix:`, `chore:`, `docs:` (Conventional Commits)
- No commitear `.env` — usar `.env.example` con valores vacíos
- Siempre manejar errores de red (el ESP32 puede estar offline)
- Timeout de 5s para requests al ESP32 — mostrar error amigable si no responde
- Estilos inline con objetos `styles` tipados en React (panel y app)
- Axios interceptors para JWT en app (AsyncStorage) y panel (localStorage)

---

## Consideraciones importantes

- **Sin internet no funciona el registro de uso**, pero la activación del ESP32 sí (WiFi local)
- El ESP32 y el celular deben estar en la **misma red WiFi** del edificio
- La IP del ESP32 puede cambiar — considerar IP fija por MAC en el router
- En Windows/Node.js usar siempre connection string estándar (no SRV) para MongoDB
- MongoDB Atlas capa gratuita (512MB) — suficiente para empezar
- Vercel funciones serverless timeout 10s — suficiente para estos endpoints
- Soft-delete en máquinas preserva historial de usos
- Los códigos de máquina son únicos (LAV/SEC + 6 hex chars)

---

## Vercel — Proyectos desplegados

| Proyecto | Directorio | Alias |
|---|---|---|
| backend | `/backend` | backend-one-tau-21.vercel.app |
| panel | `/panel` | panel-three-blush.vercel.app |

### Env vars en Vercel
- **backend**: `MONGODB_URI`, `JWT_SECRET`
- **panel**: `VITE_API_URL`
