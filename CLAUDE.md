# CLAUDE.md — CleanCare

## ¿Qué es este proyecto?

CleanCare es un sistema de gestión de lavarropas y secadoras por domótica para edificios residenciales. Los residentes escanean un QR en la máquina, la activan desde el celular por X minutos, y la administración del edificio recibe un reporte mensual de usos para facturación.

---

## Arquitectura del sistema

```
[QR en máquina] → [App React Native] ←BLE→ [ESP32 por BLE]
                        ↓                         |
                 [Backend API — Vercel]      [Relay → Lavadora]
                        ↓
                  [MongoDB Atlas]
                        ↓
                 [Panel web — React]
```

### Reglas de comunicación — CRÍTICO
- El **ESP32** se comunica con la **app móvil** via **BLE** (Bluetooth Low Energy)
- El **backend** solo se comunica con la **app móvil** y el **panel web** (nunca con el ESP32)
- La **app móvil** es el único punto que habla con ambos (ESP32 + backend)
- Flujo: escanear QR → conectar ESP32 BLE → sincronizar hora → activar relay → confirmar estado → POST al backend

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
| Almacenamiento seguro | expo-secure-store | Keychain (iOS) / EncryptedSharedPreferences (Android) |
| BLE | react-native-ble-plx | Expo config plugin |
| Notificaciones | expo-notifications | Background alerts |
| Audio | expo-av | Sonido de finalización |

---

## URLs desplegadas

| Servicio | URL |
|---|---|
| Backend API | https://backend-one-tau-21.vercel.app |
| Panel web | https://panel-three-blush.vercel.app |
| Landing page | https://panel-three-blush.Avercel.app/ |
| Login usuario | https://panel-three-blush.vercel.app/usuarios |
| Registro usuario | https://panel-three-blush.vercel.app/registro |
| Mi cuenta | https://panel-three-blush.vercel.app/mi-cuenta |
| Admin login | https://panel-three-blush.vercel.app/login |
| Admin dashboard | https://panel-three-blush.vercel.app/dashboard |
| Admin máquinas | https://panel-three-blush.vercel.app/maquinas |
| Admin créditos | https://panel-three-blush.vercel.app/creditos |
| Admin usuarios | https://panel-three-blush.vercel.app/admin-usuarios |
| Admin tips | https://panel-three-blush.vercel.app/tips |
| Repositorio | https://github.com/virulaiser/CleanCare |

### Credenciales

**Super-admin (CleanCare, ve todo)**
- Email: `admin@cleancare.com`
- Password: `admin123`
- Rol: `admin`

**Admin por edificio (ve solo su edificio)**
- `admin.norte@cleancare.com` / `admin123` → EDI-NORTE
- `admin.centro@cleancare.com` / `admin123` → EDI-CENTRO
- `admin.alegria@cleancare.com` / `admin123` → EDI-ALEGRIA
- Rol: `admin_edificio`

**Residentes de seed**: password `123456`, PIN de compra default `1111`.

---

## Estructura de carpetas

```
cleancare/
├── CLAUDE.md
├── TODO.md
├── COMO_FUNCIONA.txt               # Documentación del sistema completo
├── SEGURIDAD.txt                   # Medidas de seguridad y ciberseguridad
├── .env                            # Variables de entorno (NO commitear)
├── .env.example
├── .gitignore
│
├── app/                            # React Native (Expo SDK 54)
│   ├── App.tsx                     # Entry point + LogBox config
│   ├── app.json                    # Config Expo (scheme, BLE, adaptive icon)
│   ├── tsconfig.json
│   ├── assets/
│   │   ├── icon.png                # Ícono app (lavarropas con burbujas)
│   │   ├── adaptive-icon.png       # Ícono adaptivo Android
│   │   └── notification.wav        # Sonido de finalización de ciclo
│   └── src/
│       ├── components/
│       │   └── SignatureBadge.tsx   # Firma dev (</>) con modal email
│       ├── constants/
│       │   └── colors.ts           # Paleta CleanCare compartida
│       ├── navigation/
│       │   └── AppNavigator.tsx     # Stack: Onboarding → Login → Scan → Cycle → History → Profile → BleTest
│       ├── screens/
│       │   ├── OnboardingScreen.tsx # Intro del sistema (se muestra 1 vez)
│       │   ├── LoginScreen.tsx      # Login con JWT + auto-redirect + toggle password + logo
│       │   ├── RegistroScreen.tsx   # Registro con toggle password + selector edificio
│       │   ├── ScanScreen.tsx       # Cámara QR + BLE auto-connect + bottom nav + máquinas disponibles
│       │   ├── CycleScreen.tsx      # Animación + timer real + BLE diagnostics + modo sin ESP32
│       │   ├── WalletScreen.tsx     # Billetera: saldo + historial transacciones
│       │   ├── HistoryScreen.tsx    # Historial personal con nombres de máquinas
│       │   ├── ProfileScreen.tsx    # Perfil: avatar, info, logout, links, firma dev
│       │   └── BleTestScreen.tsx    # Debug BLE (accesible desde Perfil)
│       └── services/
│           └── api.service.ts       # Axios + JWT + SecureStore + config edificio
│
├── backend/                        # Node.js + Express → Vercel serverless
│   ├── api/
│   │   ├── index.js                # Router Express (JSON limit 5mb, dev local + Vercel)
│   │   ├── auth.js                 # POST /api/auth?action=login|registro
│   │   ├── uso.js                  # POST /api/uso + PATCH (fin/avería)
│   │   ├── usos.js                 # GET /api/usos (filtro ?mis=true)
│   │   ├── resumen.js              # GET /api/resumen (solo admin)
│   │   ├── maquinas.js             # GET/POST/DELETE /api/maquinas
│   │   ├── billetera.js            # GET /api/billetera + POST creditos/creditos-masivo
│   │   ├── config-edificio.js      # GET/PUT /api/config-edificio
│   │   ├── resumen-creditos.js     # GET /api/resumen-creditos
│   │   ├── usuarios.js             # GET/POST/PATCH/DELETE /api/usuarios (CRUD admin, foto, stats)
│   │   ├── edificios.js            # GET/POST/DELETE /api/edificios
│   │   ├── tips.js                 # GET/POST/DELETE /api/tips
│   │   └── cron-asignacion.js      # GET /api/cron/asignacion-mensual
│   ├── models/
│   │   ├── Uso.js                  # Schema: estado, fecha_inicio, fecha_fin, completado
│   │   ├── Maquina.js              # Schema: maquina_id (auto-gen), nombre, tipo, activa
│   │   ├── Usuario.js              # Schema: usuario_id, email, tel, apto, edificio, foto
│   │   ├── Transaccion.js          # Schema: transaccion_id, usuario_id, tipo, cantidad, fecha
│   │   ├── ConfigEdificio.js       # Schema: creditos_mensuales, costos, duraciones
│   │   ├── Edificio.js             # Schema: edificio_id (auto), nombre, direccion, activo
│   │   └── Tip.js                  # Schema: texto, tipo, activo
│   ├── lib/
│   │   ├── mongodb.js              # Conexión singleton Mongoose
│   │   └── auth.js                 # generarToken, verificarToken, soloAdmin
│   ├── seed.js                     # Seed con 10 máquinas, 10 usuarios, 60 usos, 10 tips
│   ├── vercel.json
│   └── package.json
│
├── panel/                          # React + Vite + TypeScript → Vercel
│   ├── index.html
│   ├── vercel.json                 # SPA rewrite para rutas client-side
│   ├── vite.config.ts              # Proxy /api → localhost:3000 en dev
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx                # Router con todas las rutas
│       ├── styles/global.css       # Reset + responsive + hamburger
│       ├── constants/colors.ts
│       ├── components/
│       │   └── DevSignature.tsx    # Firma dev reutilizable (</>) con modal
│       ├── services/api.ts         # Axios + JWT + CRUD usuarios con foto
│       └── pages/
│           ├── Home.tsx            # Landing responsive + firma dev en footer
│           ├── Usuarios.tsx        # Login residente
│           ├── Registro.tsx        # Registro público
│           ├── MiCuenta.tsx        # Resumen mensual residente
│           ├── Login.tsx           # Login admin
│           ├── Dashboard.tsx       # KPIs + facturación + Excel
│           ├── Maquinas.tsx        # CRUD máquinas + QR + impresión
│           ├── Creditos.tsx        # Config créditos + usuarios + resumen
│           ├── AdminUsuarios.tsx   # CRUD usuarios: filtros, avatares, foto, stats
│           └── Tips.tsx            # CRUD consejos para app
│
└── firmware/                       # ESP32
    └── ble_test/                   # Firmware BLE v3.0
        ├── LOGICA_BLE.txt          # Documentación del protocolo BLE
        ├── platformio.ini          # Config PlatformIO
        ├── ble_test.ino            # Fuente Arduino IDE
        └── src/
            └── main.cpp            # Firmware v3: BLE + NVS logs + auto-reset 24h
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
  "rol": "admin | admin_edificio | residente",
  "edificio_id": "EDI-NORTE",
  "unidad": "apto-302",
  "foto": "data:image/jpeg;base64,...",
  "pin_compra": "$2a$10$...",        // hasheado, default implícito 1111
  "rol_apto": "titular | miembro",
  "estado_aprobacion": "pendiente | aprobado | rechazado",
  "aprobado_por": "USR-XXXX",
  "aprobado_en": "2026-04-21T...",
  "activo": true,
  "fecha_baja": null,                 // set al cambiar inquilino
  "motivo_baja": null,                // 'cambio_inquilino' | 'solicitud_propia' | 'rechazado'
  "creado": "2026-04-09T..."
}
```

#### `edificios`
```json
{
  "edificio_id": "EDI-NORTE",
  "nombre": "Torre Norte",
  "direccion": "Av. Rivera 1234",
  "admin_nombre": "Carlos Gómez",
  "admin_telefono": "099111222",
  "pisos": 5,
  "aptos_por_piso": 4,
  "nomenclatura": "numerica | letras",
  "extras": [{ "codigo": "portero", "tipo": "portero" }],
  "activo": true,
  "creado": "2026-04-10T..."
}
```

#### `unidades` (apartamentos generados por edificio)
```json
{
  "edificio_id": "EDI-NORTE",
  "codigo": "101",       // '101' para numerica, '1A' para letras, 'portero' para extra
  "piso": 1,
  "numero_apto": 1,
  "es_extra": false,
  "tipo_extra": null,
  "activa": true
}
```

#### `ocupaciones` (período de cada inquilino en un apto)
```json
{
  "ocupacion_id": "OCU-A1B2C3D4",
  "edificio_id": "EDI-NORTE",
  "apartamento": "101",
  "desde": "2026-01-15T...",
  "hasta": null,                                // null = vigente
  "titular_usuario_id": "USR-DD3FAD",
  "miembros_usuario_ids": ["USR-XXXXXX"],
  "cerrada_por": null,
  "motivo_cierre": null,                        // 'rotacion' al cambiar inquilino
  "saldo_al_cierre": null,
  "pdf_cierre_url": "",
  "pdf_apertura_url": "",
  "notas": ""
}
```

#### `facturas` (PDFs mensuales por edificio)
```json
{
  "factura_id": "FAC-01EE9697",
  "edificio_id": "EDI-NORTE",
  "mes": 3,
  "anio": 2026,
  "tipo": "ingreso | consumo_resumen | resumen_apto",
  "apartamento": null,                          // solo set en resumen_apto
  "pdf_url": "https://.../ingreso.pdf",
  "totales": { "fichas_vendidas": 10, "lavados": 6, "kwh_totales": 29.7 },
  "generada": "2026-04-21T...",
  "enviada": false,
  "canal_envio": null                           // 'email' | 'whatsapp' cuando se envíe
}
```

#### `maquinas`
```json
{
  "maquina_id": "LAV-000001",
  "edificio_id": "EDI-NORTE",
  "tipo": "lavarropas",
  "nombre": "Lavarropas Piso 1",
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

#### `transacciones`
```json
{
  "transaccion_id": "TXN-A1B2C3",
  "usuario_id": "USR-DD3FAD",
  "edificio_id": "edificio-central",
  "tipo": "uso_maquina",
  "cantidad": -1,
  "descripcion": "Uso LAV-7DED11 (lavarropas)",
  "referencia_id": "665abc...",
  "creado_por": "sistema",
  "fecha": "2026-04-10T12:00:00.000Z"
}
```

#### `config_edificios`
```json
{
  "edificio_id": "EDI-NORTE",
  "creditos_mensuales": 10,            // ahora es POR APTO, acredita al titular
  "costo_lavado": 1,
  "costo_secado": 1,
  "duracion_lavado": 45,
  "duracion_secado": 30,
  "max_compra_fichas": 10,             // tope por compra individual
  "precio_ficha_residente": 120,       // lo que cobra el admin al residente
  "comision_cleancare": 33,            // lo que CleanCare cobra por ficha vendida
  "litros_por_lavado": 60,
  "litros_por_secado": 0,
  "kwh_por_lavado": 1.2,
  "kwh_por_secado": 2.5,
  "facturacion_dia": 31,               // 31 = último día del mes
  "facturacion_hora": "23:59",
  "email_admin_edificio": "admin.norte@cleancare.com",
  "whatsapp_admin_edificio": "+598 99 111 222",
  "canal_preferido": "email | whatsapp | ninguno",
  "activo": true,
  "actualizado": "2026-04-21T..."
}
```

---

## API Endpoints

### Públicos
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api` | Health check (version 1.2.2) |
| `POST` | `/api/auth?action=login` | Login → JWT + saldo del apto + estado del usuario |
| `POST` | `/api/auth?action=registro` | Registro → queda `pendiente` (requiere aprobación admin) |
| `GET` | `/api/edificios` | Listar edificios activos (para dropdowns) |
| `GET` | `/api/unidades?edificioId=X` | Unidades activas del edificio (dropdown apto en registro) |

### Protegidos (requieren Bearer token)
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/auth?action=me` | Estado actual del usuario (rol_apto, estado_aprobacion) |
| `POST` | `/api/uso` | Iniciar ciclo (bloquea pendientes, verifica saldo del APTO) |
| `PATCH` | `/api/uso?id=X` | Actualizar ciclo (devuelve crédito en cancelación/avería) |
| `GET` | `/api/usos?edificioId&mes&anio&mis=true` | Usos filtrados (admin_edificio queda fijado a su edificio) |
| `GET` | `/api/maquinas?edificioId=X` | Listar máquinas activas |
| `GET` | `/api/billetera` | Saldo + movimientos del APTO del usuario (compartido con miembros) |
| `POST` | `/api/billetera/comprar` | Solo TITULAR aprobado. Body `{pin, cantidad}`. Valida tope. |
| `PATCH` | `/api/billetera/pin` | Solo titular. Cambia PIN. Body `{pin_actual, pin_nuevo}`. |
| `GET` | `/api/apartamento/miembros` | Solo titular: miembros + pendientes del apto |
| `POST` | `/api/apartamento/aprobar` | Titular aprueba a un miembro pendiente |
| `POST` | `/api/apartamento/rechazar` | Titular rechaza (desactiva la cuenta del pendiente) |
| `POST` | `/api/apartamento/transferir-titularidad` | Titular cede titularidad a otro miembro |
| `GET` | `/api/facturacion/aptos/mios` | Residente: PDFs mensuales del apto |

### Admin (super-admin o admin_edificio — el 2do queda filtrado a su edificio)
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/resumen?edificioId&mes&anio` | Resumen facturación mensual |
| `GET` | `/api/resumen-creditos?edificioId&mes&anio` | Resumen consumo créditos mensual |
| `GET` | `/api/resumen-apartamento?edificioId&mes&anio` | Consumo agregado por apto |
| `POST` | `/api/maquinas` | Crear máquina |
| `DELETE` | `/api/maquinas?maquinaId=X` | Soft-delete máquina |
| `GET` | `/api/billetera?usuarioId=X` | Saldo del apto de un usuario específico |
| `POST` | `/api/billetera/creditos` | Agregar créditos a un usuario |
| `POST` | `/api/billetera/creditos-masivo` | Agregar créditos a todos los titulares del edificio |
| `GET` | `/api/config-edificio?edificioId=X` | Config del edificio (tarifas, consumo, facturación) |
| `PUT` | `/api/config-edificio` | Actualizar config del edificio |
| `GET` | `/api/usuarios?edificioId=X&rol=Y` | Listar usuarios (admin_edificio nunca ve super-admins) |
| `POST` | `/api/usuarios` | Crear usuario (admin_edificio solo residente; super puede crear admin_edificio/admin) |
| `PATCH` | `/api/usuarios?usuarioId=X` | Editar usuario (rol, rol_apto, estado_aprobacion, etc.) |
| `DELETE` | `/api/usuarios?usuarioId=X` | Soft-delete usuario |
| `POST` | `/api/unidades` | Crear unidad manual |
| `PATCH` | `/api/unidades?id=X` | Activar/desactivar unidad |
| `DELETE` | `/api/unidades?id=X` | Borrar unidad |
| `GET` | `/api/dispositivos` | ESP32 / Pico registrados |
| `GET` | `/api/facturacion?edificioId&mes&anio&tipo` | Listar facturas generadas |
| `POST` | `/api/facturacion/generar` | Forzar generación manual del mes (idempotente) |
| `POST` | `/api/apartamento/cerrar-inquilino` | Cerrar ocupación: saldo→0, PDF cierre, usuarios inactivos |
| `POST` | `/api/apartamento/confirmar-titular` | Aprobar pendiente y abrir ocupación nueva como titular |
| `GET` | `/api/apartamento/ocupaciones?edificioId&apartamento` | Historial de ocupaciones |

### Solo super-admin
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/edificios` | Crear edificio + generar unidades automáticamente |
| `DELETE` | `/api/edificios?edificioId=X` | Soft-delete edificio |
| `POST` | `/api/tips` | Crear tip |
| `DELETE` | `/api/tips?id=X` | Eliminar tip |

### Cron (Vercel)
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/cron/asignacion-mensual` | Asigna créditos mensuales por apto (1ro del mes, 3am UTC) |
| `GET` | `/api/cron/facturacion-mensual` | Genera PDFs mensuales el día configurado (diario 23:59 UTC) |

---

## Autenticación — JWT

- **Algoritmo**: HS256
- **Expiración**: 7 días
- **Payload**: `{ id, usuario_id, email, rol, edificio_id, unidad, apartamento }`
- **Middleware**: `verificarToken` (todas las rutas protegidas), `soloAdmin` (admin-only)
- **Password**: bcrypt con 10 rounds, mínimo 6 caracteres
- **Validación email**: regex en backend, app y panel
- **App**: token en expo-secure-store (Keychain / EncryptedSharedPreferences)
- **Panel**: token en localStorage, interceptor axios auto-redirect en 401

---

## ESP32 — BLE Firmware v3.0

### Firmware BLE (`firmware/ble_test/`)
- **Nombre BLE**: `CleanCare-ESP32`
- **Service UUID**: `12345678-1234-1234-1234-123456789abc`
- **Control Char** (Write): `12345678-1234-1234-1234-123456789abd`
- **Status Char** (Read+Notify): `12345678-1234-1234-1234-123456789abe`

### Comandos BLE
| Comando | Descripción |
|---|---|
| `ON:60` | Encender relay por 60 segundos |
| `ON:2700:USR-XX:lavarropas` | Encender con registro (usuario + tipo) |
| `OFF` | Apagar relay inmediatamente |
| `STATUS` | Pedir estado actual |
| `TIME:2026-04-11T15:30:00` | Sincronizar fecha/hora desde la app |
| `LOGS:cleancare2026` | Extraer registros de uso (requiere clave) |
| `CLEAR_LOGS:cleancare2026` | Borrar registros (requiere clave) |
| `INFO` | Info del ESP32 (conexiones, logs, uptime, fecha) |

### Respuestas (Notify)
| Respuesta | Significado |
|---|---|
| `ON:45` | Relay encendido, 45 segundos restantes |
| `OFF:0` | Relay apagado |
| `LOGS:N` | Header: N registros disponibles |
| `LOG:i:fecha\|usuario\|duracion\|tipo` | Registro individual |
| `LOGS_END` | Fin de envío de logs |
| `INFO:conexiones:logs:uptime:fecha` | Info del ESP32 |

### Características v3.0
- **Auto-reset cada 24h** (solo si no hay ciclo activo)
- **Registro en NVS** (memoria no volátil): fecha, usuario, duración, tipo
- **Máximo 200 registros** con rotación automática
- **Heartbeat** cada 30s en serial monitor
- **LED parpadea 3 veces** al arrancar (confirmación visual)
- **Logs protegidos** con clave de acceso

### Subir firmware
```bash
cd firmware/ble_test
pio run --target upload
pio device monitor
```

---

## Flujo completo — App

### Flujo BLE (con ESP32)
1. Residente abre la app → OnboardingScreen (solo la primera vez)
2. LoginScreen (o auto-login si hay token guardado)
3. ScanScreen → auto-scan BLE busca CleanCare-ESP32
4. Barra BLE arriba muestra estado (verde=conectado, rojo=desconectado)
5. Si ESP32 ya está en uso → barra naranja "En uso — X min restantes"
6. Escanea QR → modal con nombre máquina + duración + estado BLE
7. Si ESP32 en uso → bloquea inicio, muestra alerta
8. Confirma → CycleScreen sincroniza hora → envía ON:2700:USR-XX:tipo
9. ESP32 activa relay + guarda log en NVS
10. Timer descendente + animación + notificación programada
11. Si BLE se desconecta → vibración + alerta "Reconectar"
12. Al terminar → vibración + sonido + PATCH /api/uso (completado)

### Flujo sin ESP32 (modo simulado)
1. Si no encuentra ESP32 en 15s → pantalla de error con diagnóstico
2. Opción "Continuar sin ESP32" → ciclo con timer local
3. Se registra en backend igual, pero no activa la máquina físicamente

### Flujo admin (panel web)
1. Admin ingresa al panel → /login con JWT
2. Dashboard: KPIs + resumen facturación + exportar Excel
3. Máquinas: crea máquinas, genera QR, imprime etiquetas
4. Créditos: config edificio, saldos, asignación masiva, resumen consumo
5. Usuarios: CRUD completo con foto, filtros, stats (fichas usadas/extras)
6. Tips: crear consejos que aparecen en la app durante ciclos

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

# App — development build (con BLE, requiere USB)
cd app && npx expo run:android

# Firmware — PlatformIO
cd firmware/ble_test && pio run --target upload
cd firmware/ble_test && pio device monitor

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
- Axios interceptors para JWT en app (SecureStore) y panel (localStorage)
- Panel responsive con media queries en global.css + hamburger menu mobile
- IDs de máquinas son internos — la UI siempre muestra nombres
- Firma de desarrollador: jsiutto@gmail.com (componente </> en app y panel)

---

## Consideraciones importantes

- **Sin internet no funciona el registro de uso**, pero BLE funciona offline
- **BLE requiere development build** (`npx expo run:android`), no funciona en Expo Go
- **Expo Go** funciona para todo excepto BLE (QR, login, ciclo simulado, historial)
- **Permisos BLE Android**: BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION (se piden en runtime)
- En Windows/Node.js usar siempre connection string estándar (no SRV) para MongoDB
- MongoDB Atlas capa gratuita (512MB) — suficiente para empezar
- Soft-delete en usuarios y máquinas preserva historial
- Los códigos de máquina son únicos (LAV/SEC + 6 hex chars)
- Los códigos de usuario son únicos (USR + 6 hex chars)
- Timer usa `Date.now()` para precisión incluso después de background
- Notificaciones programadas con `expo-notifications` funcionan con pantalla apagada
- Fotos de perfil se comprimen a 200x200 JPEG, guardadas como base64 en MongoDB
- ESP32 se auto-resetea cada 24h y guarda logs de uso en memoria no volátil

---

## Vercel — Proyectos desplegados

| Proyecto | Directorio | Alias |
|---|---|---|
| backend | `/backend` | backend-one-tau-21.vercel.app |
| panel | `/panel` | panel-three-blush.vercel.app |

### Env vars en Vercel
- **backend**: `MONGODB_URI`, `JWT_SECRET`
- **panel**: `VITE_API_URL`
