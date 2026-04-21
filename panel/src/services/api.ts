import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
});

// Inyectar token en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cleancare_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirigir a login si el token expira
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cleancare_token');
      localStorage.removeItem('cleancare_usuario');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export interface Usuario {
  id: string;
  usuario_id?: string;
  email: string;
  nombre: string;
  apartamento?: string;
  rol: string;
  edificio_id: string;
  unidad?: string;
  rol_apto?: 'titular' | 'miembro';
  estado_aprobacion?: 'pendiente' | 'aprobado' | 'rechazado';
}

export async function getMe(): Promise<{ usuario: Usuario; requiere_aprobacion: boolean }> {
  const { data } = await api.get('/api/auth', { params: { action: 'me' } });
  if (data?.usuario) {
    localStorage.setItem('cleancare_usuario', JSON.stringify(data.usuario));
  }
  return data;
}

export async function comprarFichas(pin: string, cantidad: number): Promise<{ nuevo_saldo: number }> {
  const { data } = await api.post('/api/billetera/comprar', { pin, cantidad });
  return data;
}

export async function cambiarPinCompra(pin_actual: string, pin_nuevo: string): Promise<void> {
  await api.patch('/api/billetera/pin', { pin_actual, pin_nuevo });
}

export interface Uso {
  _id: string;
  maquina_id: string;
  edificio_id: string;
  tipo?: string;
  duracion_min: number;
  residente_id: string;
  estado?: 'activo' | 'completado' | 'cancelado' | 'averia';
  completado?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
  fecha: string;
}

export interface ResumenItem {
  _id: string;
  total_usos: number;
  minutos_totales: number;
}

export interface Maquina {
  _id: string;
  maquina_id: string;
  edificio_id: string;
  tipo: string;
  nombre: string;
  activa: boolean;
  dispositivo_id?: string | null;
  relay_pin?: number | null;
}

export async function login(email: string, password: string): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=login', { email, password });
  return data;
}

export async function registro(campos: {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
  apartamento?: string;
  edificio_id: string;
  unidad?: string;
}): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=registro', campos);
  return data;
}

export async function obtenerResumen(edificioId: string, mes: number, anio: number): Promise<ResumenItem[]> {
  const { data } = await api.get('/api/resumen', {
    params: { edificioId, mes, anio },
  });
  return data.resumen;
}

export async function listarUsos(filter: { edificioId?: string; mes?: number; anio?: number; limite?: number } = {}): Promise<Uso[]> {
  const { data } = await api.get('/api/usos', { params: filter });
  return data.usos;
}

export async function listarMisUsos(): Promise<Uso[]> {
  const { data } = await api.get('/api/usos', { params: { mis: 'true' } });
  return data.usos;
}

export async function loginUsuario(email: string, password: string): Promise<{ token: string; usuario: Usuario }> {
  const { data } = await api.post('/api/auth?action=login', { email, password });
  return data;
}

export async function listarMaquinas(edificioId: string): Promise<Maquina[]> {
  const { data } = await api.get('/api/maquinas', {
    params: { edificioId },
  });
  return data.maquinas;
}

export async function crearMaquina(maquina: { nombre: string; tipo: string; edificio_id: string }): Promise<Maquina> {
  const { data } = await api.post('/api/maquinas', maquina);
  return data.maquina;
}

export async function eliminarMaquina(maquinaId: string): Promise<void> {
  await api.delete('/api/maquinas', { params: { maquinaId } });
}

// --- Billetera / Créditos ---

export interface Transaccion {
  _id: string;
  transaccion_id: string;
  usuario_id: string;
  edificio_id: string;
  tipo: 'asignacion_mensual' | 'ajuste_admin' | 'uso_maquina' | 'devolucion';
  cantidad: number;
  descripcion: string;
  referencia_id?: string;
  creado_por?: string;
  fecha: string;
}

export interface ConfigEdificio {
  edificio_id: string;
  creditos_mensuales: number;
  costo_lavado: number;
  costo_secado: number;
  duracion_lavado: number;
  duracion_secado: number;
  max_compra_fichas: number;
  precio_ficha_residente: number;
  comision_cleancare: number;
  litros_por_lavado: number;
  litros_por_secado: number;
  kwh_por_lavado: number;
  kwh_por_secado: number;
  facturacion_dia: number;
  facturacion_hora: string;
  email_admin_edificio: string;
  whatsapp_admin_edificio: string;
  canal_preferido: 'email' | 'whatsapp' | 'ninguno';
  activo: boolean;
}

export interface ResumenCreditoItem {
  usuario_id: string;
  nombre: string;
  apartamento: string;
  creditos_usados: number;
  creditos_asignados: number;
  devoluciones: number;
  saldo_actual: number;
}

export async function obtenerBilletera(): Promise<{ saldo: number; transacciones: Transaccion[] }> {
  const { data } = await api.get('/api/billetera');
  return data;
}

export async function obtenerBilleteraUsuario(usuarioId: string): Promise<{ saldo: number; transacciones: Transaccion[] }> {
  const { data } = await api.get('/api/billetera', { params: { usuarioId } });
  return data;
}

export async function agregarCreditos(usuario_id: string, cantidad: number, descripcion: string): Promise<{ transaccion: Transaccion; nuevo_saldo: number }> {
  const { data } = await api.post('/api/billetera/creditos', { usuario_id, cantidad, descripcion });
  return data;
}

export async function agregarCreditosMasivo(edificio_id: string, cantidad: number, descripcion: string): Promise<{ total_usuarios: number; cantidad_por_usuario: number }> {
  const { data } = await api.post('/api/billetera/creditos-masivo', { edificio_id, cantidad, descripcion });
  return data;
}

export async function obtenerConfigEdificio(edificioId: string): Promise<ConfigEdificio> {
  const { data } = await api.get('/api/config-edificio', { params: { edificioId } });
  return data.config;
}

export async function actualizarConfigEdificio(config: Partial<ConfigEdificio> & { edificio_id: string }): Promise<ConfigEdificio> {
  const { data } = await api.put('/api/config-edificio', config);
  return data.config;
}

export async function obtenerResumenCreditos(edificioId: string, mes: number, anio: number): Promise<{ resumen: ResumenCreditoItem[]; total_creditos_consumidos: number }> {
  const { data } = await api.get('/api/resumen-creditos', { params: { edificioId, mes, anio } });
  return data;
}

// --- Resumen por apartamento ---
// Un apartamento puede tener varios usuarios (pareja, familia). La facturación
// va al dueño del apto, así que se agrupa el consumo por (apartamento + edificio).
export interface ResumenApartamentoItem {
  apartamento: string;
  edificio_id: string;
  usuarios: Array<{ usuario_id: string; nombre: string; email: string; telefono?: string }>;
  cant_usuarios: number;
  lavados: number;
  secados: number;
  min_lavado: number;
  min_secado: number;
  usos_total: number;
  minutos_total: number;
  saldo_total: number;
}

export async function obtenerResumenApartamento(edificioId: string, mes: number, anio: number): Promise<{ resumen: ResumenApartamentoItem[]; total_aptos: number; total_usos: number }> {
  const { data } = await api.get('/api/resumen-apartamento', { params: { edificioId, mes, anio } });
  return data;
}

export async function listarUsuariosEdificio(edificioId?: string): Promise<{
  usuario_id: string; nombre: string; apartamento: string; email: string; edificio_id: string;
  saldo: number; fichas_usadas?: number; fichas_extras?: number;
  rol_apto?: 'titular' | 'miembro'; estado_aprobacion?: 'pendiente' | 'aprobado' | 'rechazado';
}[]> {
  const params = edificioId ? { edificioId } : {};
  const { data } = await api.get('/api/usuarios', { params });
  return data.usuarios;
}

// --- Admin Usuarios ---

export async function crearUsuarioAdmin(campos: {
  nombre: string; email: string; password: string;
  telefono?: string; apartamento?: string; edificio_id: string; unidad?: string; foto?: string;
  rol?: 'residente' | 'admin_edificio' | 'admin';
}): Promise<{ usuario_id: string; nombre: string; email: string }> {
  const { data } = await api.post('/api/usuarios', campos);
  return data.usuario;
}

export async function editarUsuarioAdmin(usuarioId: string, campos: {
  nombre?: string; email?: string; password?: string;
  telefono?: string; apartamento?: string; edificio_id?: string; unidad?: string; foto?: string;
  rol_apto?: 'titular' | 'miembro';
  estado_aprobacion?: 'pendiente' | 'aprobado' | 'rechazado';
}): Promise<{ usuario_id: string; nombre: string; email: string }> {
  const { data } = await api.patch('/api/usuarios', campos, { params: { usuarioId } });
  return data.usuario;
}

export async function eliminarUsuarioAdmin(usuarioId: string): Promise<void> {
  await api.delete('/api/usuarios', { params: { usuarioId } });
}

// --- Edificios ---

export interface Edificio {
  edificio_id: string;
  nombre: string;
  direccion?: string;
  admin_nombre?: string;
  admin_telefono?: string;
}

export async function listarEdificios(): Promise<Edificio[]> {
  const { data } = await api.get('/api/edificios');
  return data.edificios;
}

// --- Tips ---

export interface Tip {
  _id: string;
  texto: string;
  tipo: 'lavarropas' | 'secadora' | 'ambos';
  activo: boolean;
  creado: string;
}

export async function listarTips(): Promise<Tip[]> {
  const { data } = await api.get('/api/tips');
  return data.tips;
}

export async function crearTip(texto: string, tipo: string): Promise<Tip> {
  const { data } = await api.post('/api/tips', { texto, tipo });
  return data.tip;
}

export async function eliminarTip(id: string): Promise<void> {
  await api.delete('/api/tips', { params: { id } });
}

// --- Dispositivos (ESP32 / Pico) ---
export interface Dispositivo {
  _id: string;
  esp32_id: string;
  tipo_hw: 'esp32' | 'pico';
  ble_name: string;
  service_uuid: string;
  control_uuid: string;
  status_uuid: string;
  maquina_asignada: string | null;
  maquinas: string[];
  edificio_id: string | null;
  ubicacion: string;
  activo: boolean;
  creado: string;
}

export async function listarDispositivos(): Promise<Dispositivo[]> {
  const { data } = await api.get('/api/dispositivos');
  return data.dispositivos;
}

export async function crearDispositivo(campos: {
  tipo_hw?: string; ble_name?: string; ubicacion?: string;
  edificio_id?: string | null;
  maquinas?: Array<{ tipo: 'lavarropas' | 'secadora' }>;
}): Promise<{ dispositivo: Dispositivo; maquinas: Maquina[] }> {
  const { data } = await api.post('/api/dispositivos', campos);
  return { dispositivo: data.dispositivo, maquinas: data.maquinas || [] };
}

export async function actualizarDispositivo(id: string, campos: Partial<Dispositivo>): Promise<Dispositivo> {
  const { data } = await api.patch('/api/dispositivos', campos, { params: { id } });
  return data.dispositivo;
}

export async function eliminarDispositivo(id: string): Promise<void> {
  await api.delete('/api/dispositivos', { params: { id } });
}

export interface Factura {
  _id: string;
  factura_id: string;
  edificio_id: string;
  mes: number;
  anio: number;
  tipo: 'ingreso' | 'consumo_resumen' | 'resumen_apto';
  apartamento: string | null;
  pdf_url: string;
  totales: any;
  generada: string;
  enviada: boolean;
  canal_envio: 'email' | 'whatsapp' | null;
}

export async function listarFacturas(filter: { edificioId?: string; mes?: number; anio?: number; tipo?: string; apartamento?: string } = {}): Promise<Factura[]> {
  const { data } = await api.get('/api/facturacion', { params: filter });
  return data.facturas;
}

export async function generarFacturas(edificio_id: string, mes: number, anio: number): Promise<any> {
  const { data } = await api.post('/api/facturacion/generar', { edificio_id, mes, anio });
  return data;
}

// --- Ocupaciones / cambio de inquilino ---
export interface Ocupacion {
  _id: string;
  ocupacion_id: string;
  edificio_id: string;
  apartamento: string;
  desde: string;
  hasta: string | null;
  titular_usuario_id: string;
  miembros_usuario_ids: string[];
  cerrada_por: string | null;
  motivo_cierre: 'rotacion' | 'baja' | 'admin' | null;
  saldo_al_cierre: number | null;
  pdf_cierre_url: string;
  pdf_apertura_url: string;
  notas: string;
}

export async function cerrarInquilino(edificio_id: string, apartamento: string, notas?: string): Promise<{ saldo_previo: number; pdf_cierre_url: string; inquilinos_dados_baja: number }> {
  const { data } = await api.post('/api/apartamento/cerrar-inquilino', { edificio_id, apartamento, notas });
  return data;
}

export async function confirmarTitular(usuario_id: string): Promise<{ usuario: any; ocupacion: Ocupacion }> {
  const { data } = await api.post('/api/apartamento/confirmar-titular', { usuario_id });
  return data;
}

// --- Notificaciones ---
export interface Notificacion {
  _id: string;
  notificacion_id: string;
  tipo: string;
  destinatario_usuario_id: string | null;
  destinatario_email: string | null;
  canal: 'email' | 'whatsapp' | 'in_app';
  subject: string;
  estado: 'pendiente' | 'enviada' | 'error' | 'descartada';
  proveedor: string | null;
  proveedor_id: string | null;
  error: string | null;
  relacionado: { tipo?: string; ref_id?: string } | null;
  creada: string;
  enviada_en: string | null;
}

export async function listarNotificaciones(filter: { tipo?: string; estado?: string; email?: string; limite?: number } = {}): Promise<Notificacion[]> {
  const { data } = await api.get('/api/notificaciones', { params: filter });
  return data.notificaciones;
}

export async function enviarNotificacionTest(to: string, subject: string, html?: string): Promise<any> {
  const { data } = await api.post('/api/notificaciones/enviar', { to, subject, html });
  return data;
}

export async function listarOcupaciones(edificioId: string, apartamento?: string): Promise<Ocupacion[]> {
  const { data } = await api.get('/api/apartamento/ocupaciones', { params: { edificioId, apartamento } });
  return data.ocupaciones;
}

export async function crearEdificio(campos: {
  nombre: string; direccion?: string; admin_nombre?: string; admin_telefono?: string;
  pisos?: number; aptos_por_piso?: number;
  nomenclatura?: 'numerica' | 'letras';
  extras?: { codigo: string; tipo: 'portero' | 'otro' }[];
}): Promise<Edificio> {
  const { data } = await api.post('/api/edificios', campos);
  return data.edificio;
}
