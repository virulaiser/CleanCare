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
- El **backend** solo se comunica con la **app móvil** (nunca con el ESP32)
- La **app móvil** es el único punto que habla con ambos
- Flujo: escanear QR → conectar ESP32 → activar relay → confirmar estado → POST al backend

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| App móvil | React Native (Expo) |
| Backend API | Node.js + Express |
| Base de datos | MongoDB Atlas |
| Panel web | React |
| Deploy backend/panel | Vercel |
| Repositorio | GitHub |
| Hardware | ESP32 + relay |

---

## Estructura de carpetas

```
cleancare/
├── CLAUDE.md
├── .env
├── .env.example
├── .gitignore
│
├── app/                        # React Native (Expo)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── ScanScreen.tsx       # Escaneo QR
│   │   │   ├── MachineScreen.tsx    # Control de máquina
│   │   │   └── HistoryScreen.tsx    # Historial de usos
│   │   ├── services/
│   │   │   ├── esp32.service.ts     # HTTP directo al ESP32
│   │   │   └── api.service.ts       # Llamadas al backend
│   │   ├── components/
│   │   └── navigation/
│   └── package.json
│
├── backend/                    # Node.js + Express → Vercel
│   ├── api/
│   │   ├── uso.js              # POST /api/uso
│   │   ├── resumen.js          # GET /api/resumen/:edificioId/:mes/:anio
│   │   └── maquinas.js         # GET /api/maquinas/:edificioId
│   ├── models/
│   │   └── Uso.js              # Mongoose model
│   ├── lib/
│   │   └── mongodb.js          # Conexión MongoDB singleton
│   ├── vercel.json
│   └── package.json
│
├── panel/                      # React → Vercel
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # Resumen mensual
│   │   │   └── Login.tsx
│   │   └── components/
│   └── package.json
│
└── firmware/                   # ESP32 Arduino
    └── cleancare_esp32/
        └── cleancare_esp32.ino
```

---

## Base de datos — MongoDB Atlas

### Conexión verificada ✓
```
Host:       cluster0.uspcw.mongodb.net
Usuario:    nacho1
DB:         cleancare
ReplicaSet: atlas-cnarts-shard-0
Region:     AWS / Sao Paulo (sa-east-1)
```

### IMPORTANTE — Windows / Node.js
En Windows, Node.js no resuelve correctamente el DNS SRV de MongoDB.
**Siempre usar la connection string estándar (NO la SRV):**

```env
MONGODB_URI=mongodb://nacho1:<password>@cluster0-shard-00-00.uspcw.mongodb.net:27017,cluster0-shard-00-01.uspcw.mongodb.net:27017,cluster0-shard-00-02.uspcw.mongodb.net:27017/cleancare?ssl=true&replicaSet=atlas-cnarts-shard-0&authSource=admin
```

### Colección: `usos`
```json
{
  "_id": "ObjectId",
  "maquina_id": "esp32-lav-3B",
  "edificio_id": "edificio-central",
  "tipo": "lavarropas",
  "fecha": "2026-04-08T14:32:00Z",
  "duracion_min": 45,
  "residente_id": "apto-302"
}
```

### Colección: `maquinas`
```json
{
  "_id": "ObjectId",
  "maquina_id": "esp32-lav-3B",
  "edificio_id": "edificio-central",
  "tipo": "lavarropas",
  "ip_local": "192.168.1.45",
  "nombre": "Lavarropas 3B",
  "activa": true
}
```

### Query de facturación mensual
```js
db.usos.aggregate([
  { $match: { edificio_id: "edificio-central", fecha: { $gte: inicio, $lt: fin } } },
  { $group: { _id: "$maquina_id", total_usos: { $sum: 1 }, minutos_totales: { $sum: "$duracion_min" } } }
])
```

---

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/uso` | Registrar un uso de máquina |
| `GET` | `/api/usos` | Listar todos los usos |
| `GET` | `/api/resumen/:edificioId/:mes/:anio` | Resumen mensual para facturación |
| `GET` | `/api/maquinas/:edificioId` | Listar máquinas del edificio |

### POST /api/uso — body esperado
```json
{
  "maquina_id": "esp32-lav-3B",
  "edificio_id": "edificio-central",
  "duracion_min": 45,
  "residente_id": "apto-302"
}
```

---

## ESP32 — API local (WiFi)

El ESP32 levanta un servidor HTTP en la red local del edificio.

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/activar` | Enciende el relay por N minutos |
| `GET` | `/estado` | Retorna estado actual |

### POST /activar — body
```json
{ "minutos": 45 }
```

### GET /estado — response
```json
{ "estado": "funcionando", "minutos_restantes": 32 }
```

### El QR contiene
```
cleancare://maquina?id=esp32-lav-3B&ip=192.168.1.45&edificio=edificio-central
```

---

## Variables de entorno

```env
# .env — NO commitear, usar .env.example con valores vacíos
MONGODB_URI=mongodb://nacho1:<password>@cluster0-shard-00-00.uspcw.mongodb.net:27017,cluster0-shard-00-01.uspcw.mongodb.net:27017,cluster0-shard-00-02.uspcw.mongodb.net:27017/cleancare?ssl=true&replicaSet=atlas-cnarts-shard-0&authSource=admin
JWT_SECRET=
PORT=3000

# app/.env
EXPO_PUBLIC_API_URL=https://api.cleancare.uy
```

---

## Diseño y estilo — paleta CleanCare

Extraída de www.cleancare.uy — usar en toda la UI (app y panel web).

```js
const colors = {
  primary:        '#3B82F6',   // Azul principal — botones, links, énfasis
  primaryDark:    '#2563EB',   // Azul hover / pressed
  accent:         '#0EA5E9',   // Celeste — acento, CTA secundario
  bgPage:         '#F8FAFC',   // Fondo de página
  bgCard:         '#F1F5F9',   // Fondo de cards
  bgBlueLight:    '#DBEAFE',   // Azul muy claro — badges, highlights
  textPrimary:    '#1E293B',   // Texto principal
  textSecondary:  '#94A3B8',   // Texto secundario / placeholders
  white:          '#FFFFFF',
  border:         '#E5E7EB',
}
```

### Reglas de estilo
- Botones: `border-radius: 999px` (pill), fondo azul sólido, texto blanco
- Tipografía: Inter o sistema sans-serif
- Cards: fondo blanco, borde `#E5E7EB` 1px, border-radius 12px
- Estilo general: limpio, minimalista, blanco con acentos azules
- Íconos: estilo outline, tamaño 24px

---

## Flujo completo paso a paso

1. Residente abre la app y escanea el QR de la máquina
2. App parsea el QR → obtiene `maquina_id`, `ip_local`, `edificio_id`
3. App hace `GET http://{ip_local}/estado` → verifica que la máquina esté libre
4. Usuario selecciona duración (30 / 45 / 60 min) y confirma
5. App hace `POST http://{ip_local}/activar` con `{ minutos: 45 }`
6. ESP32 activa el relay y responde `{ estado: "funcionando" }`
7. App hace `POST https://api.cleancare.uy/api/uso` registrando el uso
8. App muestra pantalla de cuenta regresiva con el estado en tiempo real
9. App sondea `GET /estado` cada 30s para actualizar el estado
10. Al finalizar, ESP32 apaga el relay y responde `{ estado: "apagado" }`

---

## MCP Servers activos

| MCP | Estado | Uso |
|---|---|---|
| github | ✓ Connected | Commits, PRs automáticos |
| context7 | ✓ Connected | Docs actualizadas de Expo, MongoDB, Express |
| sequential-thinking | ✓ Connected | Planificación antes de codear |
| vercel CLI | ✓ Instalado | `vercel --prod` para deploy |

---

## Comandos útiles

```bash
# Probar API + MongoDB localmente
node test-api.js

# Desarrollo
cd app && npx expo start
cd panel && npm run dev

# Deploy a Vercel
cd backend && vercel --prod
cd panel && vercel --prod

# Verificar MCP servers
claude mcp list
```

---

## Convenciones de código

- Lenguaje: **TypeScript** en app y panel, **JavaScript** en backend
- Nombrado: camelCase para variables/funciones, PascalCase para componentes
- Commits: `feat:`, `fix:`, `chore:`, `docs:` (Conventional Commits)
- No commitear `.env` — usar `.env.example` con valores vacíos
- Siempre manejar errores de red (el ESP32 puede estar offline)
- Timeout de 5s para requests al ESP32 — mostrar error amigable si no responde

---

## Consideraciones importantes

- **Sin internet no funciona el registro**, pero la activación del ESP32 sí (WiFi local)
- El ESP32 y el celular deben estar en la **misma red WiFi** del edificio
- La IP del ESP32 puede cambiar — considerar IP fija por MAC en el router
- En Windows/Node.js usar siempre connection string estándar (no SRV) para MongoDB
- MongoDB Atlas tiene capa gratuita (512MB) — suficiente para empezar
- Vercel funciones serverless tienen timeout de 10s — suficiente para estos endpoints
