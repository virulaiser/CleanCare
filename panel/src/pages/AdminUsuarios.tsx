import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarUsuariosEdificio, listarEdificios, crearUsuarioAdmin,
  editarUsuarioAdmin, eliminarUsuarioAdmin, Edificio, Usuario,
} from '../services/api';
import { colors } from '../constants/colors';

interface UsuarioRow {
  usuario_id: string;
  nombre: string;
  email: string;
  apartamento?: string;
  telefono?: string;
  edificio_id: string;
  unidad?: string;
  saldo: number;
}

function getUsuario(): { edificio_id: string } | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEdificio, setFiltroEdificio] = useState('');

  // Modal crear
  const [showCrear, setShowCrear] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formApto, setFormApto] = useState('');
  const [formEdificio, setFormEdificio] = useState('');
  const [formUnidad, setFormUnidad] = useState('');
  const [creando, setCreando] = useState(false);

  // Modal editar
  const [editUser, setEditUser] = useState<UsuarioRow | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editApto, setEditApto] = useState('');
  const [editEdificio, setEditEdificio] = useState('');
  const [editUnidad, setEditUnidad] = useState('');
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cleancare_token')) navigate('/login');
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [usrs, edfs] = await Promise.all([
        listarUsuariosEdificio(),
        listarEdificios(),
      ]);
      setUsuarios(usrs as UsuarioRow[]);
      setEdificios(edfs);
      if (edfs.length > 0 && !formEdificio) {
        setFormEdificio(edfs[0].edificio_id);
      }
    } catch {}
    setLoading(false);
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  // Crear usuario
  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre || !formEmail || !formPassword || !formEdificio) {
      alert('Completá nombre, email, contraseña y edificio');
      return;
    }
    setCreando(true);
    try {
      await crearUsuarioAdmin({
        nombre: formNombre,
        email: formEmail,
        password: formPassword,
        telefono: formTelefono || undefined,
        apartamento: formApto || undefined,
        edificio_id: formEdificio,
        unidad: formUnidad || undefined,
      });
      setShowCrear(false);
      setFormNombre(''); setFormEmail(''); setFormPassword('');
      setFormTelefono(''); setFormApto(''); setFormUnidad('');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al crear usuario');
    }
    setCreando(false);
  };

  // Abrir modal editar
  const openEdit = (u: UsuarioRow) => {
    setEditUser(u);
    setEditNombre(u.nombre);
    setEditEmail(u.email);
    setEditPassword('');
    setEditTelefono(u.telefono || '');
    setEditApto(u.apartamento || '');
    setEditEdificio(u.edificio_id);
    setEditUnidad(u.unidad || '');
  };

  // Guardar edición
  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditando(true);
    try {
      await editarUsuarioAdmin(editUser.usuario_id, {
        nombre: editNombre || undefined,
        email: editEmail || undefined,
        password: editPassword || undefined,
        telefono: editTelefono,
        apartamento: editApto,
        edificio_id: editEdificio || undefined,
        unidad: editUnidad,
      });
      setEditUser(null);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al editar');
    }
    setEditando(false);
  };

  // Eliminar usuario
  const handleEliminar = async (u: UsuarioRow) => {
    if (!confirm(`¿Desactivar a ${u.nombre} (${u.email})?`)) return;
    try {
      await eliminarUsuarioAdmin(u.usuario_id);
      await fetchData();
    } catch {
      alert('Error al eliminar usuario');
    }
  };

  // Filtrar
  const filtrados = usuarios.filter((u) => {
    const q = busqueda.toLowerCase();
    const matchBusq = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      || (u.apartamento || '').toLowerCase().includes(q);
    const matchEdif = !filtroEdificio || u.edificio_id === filtroEdificio;
    return matchBusq && matchEdif;
  });

  const edificioNombre = (id: string) => edificios.find(e => e.edificio_id === id)?.nombre || id;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>CleanCare</h1>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/maquinas')} style={styles.navBtn}>Máquinas</button>
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/admin-usuarios')} style={{ ...styles.navBtn, backgroundColor: colors.primary, color: colors.white, border: 'none', fontWeight: 600 }}>Usuarios</button>
          <button onClick={() => navigate('/tips')} style={styles.navBtn}>Tips</button>
          <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h2 style={styles.pageTitle}>Gestión de Usuarios</h2>
            <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0 }}>
              Crear, editar y desactivar usuarios residentes
            </p>
          </div>
          <button onClick={() => setShowCrear(true)} style={styles.btnPrimary}>
            + Nuevo usuario
          </button>
        </div>

        {/* Filtros */}
        <div style={styles.card}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              style={{ ...styles.input, flex: '1 1 200px' }}
              placeholder="Buscar por nombre, email o apto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {edificios.length > 1 && (
              <select style={styles.input} value={filtroEdificio} onChange={(e) => setFiltroEdificio(e.target.value)}>
                <option value="">Todos los edificios</option>
                {edificios.map(e => (
                  <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Usuarios activos ({filtrados.length})</h3>
          {loading ? (
            <p style={styles.muted}>Cargando...</p>
          ) : filtrados.length === 0 ? (
            <p style={styles.muted}>No se encontraron usuarios.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nombre</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Apto</th>
                    <th style={styles.th}>Teléfono</th>
                    <th style={styles.th}>Edificio</th>
                    <th style={styles.th}>Fichas</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.usuario_id}>
                      <td style={styles.td}><strong>{u.nombre}</strong></td>
                      <td style={styles.td}>{u.email}</td>
                      <td style={styles.td}>{u.apartamento || '—'}</td>
                      <td style={styles.td}>{u.telefono || '—'}</td>
                      <td style={styles.td}>{edificioNombre(u.edificio_id)}</td>
                      <td style={{ ...styles.td, fontWeight: 600, color: u.saldo <= 0 ? colors.error : colors.success }}>
                        {u.saldo}
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(u)} style={styles.btnEdit}>Editar</button>
                          <button onClick={() => handleEliminar(u)} style={styles.btnDelete}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Crear */}
      {showCrear && (
        <div style={styles.overlay} onClick={() => setShowCrear(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Nuevo usuario</h3>
            <form onSubmit={handleCrear} style={styles.form}>
              <div style={styles.formRow}>
                <label style={styles.label}>Nombre *</label>
                <input style={styles.input} value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Nombre completo" />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Email *</label>
                <input style={styles.input} value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@ejemplo.com" type="email" />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Contraseña *</label>
                <input style={styles.input} value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...styles.formRow, flex: 1 }}>
                  <label style={styles.label}>Apartamento</label>
                  <input style={styles.input} value={formApto} onChange={(e) => setFormApto(e.target.value)} placeholder="Ej: 3B" />
                </div>
                <div style={{ ...styles.formRow, flex: 1 }}>
                  <label style={styles.label}>Teléfono</label>
                  <input style={styles.input} value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} placeholder="099123456" />
                </div>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Edificio *</label>
                <select style={styles.input} value={formEdificio} onChange={(e) => setFormEdificio(e.target.value)}>
                  {edificios.map(e => (
                    <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Unidad (opcional)</label>
                <input style={styles.input} value={formUnidad} onChange={(e) => setFormUnidad(e.target.value)} placeholder="Ej: apto-302" />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowCrear(false)} style={styles.btnCancel}>Cancelar</button>
                <button type="submit" disabled={creando} style={{ ...styles.btnPrimary, opacity: creando ? 0.5 : 1 }}>
                  {creando ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editUser && (
        <div style={styles.overlay} onClick={() => setEditUser(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Editar usuario</h3>
            <p style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>
              ID: {editUser.usuario_id}
            </p>
            <form onSubmit={handleEditar} style={styles.form}>
              <div style={styles.formRow}>
                <label style={styles.label}>Nombre</label>
                <input style={styles.input} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Email</label>
                <input style={styles.input} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Nueva contraseña (dejar vacío para no cambiar)</label>
                <input style={styles.input} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••" type="password" />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...styles.formRow, flex: 1 }}>
                  <label style={styles.label}>Apartamento</label>
                  <input style={styles.input} value={editApto} onChange={(e) => setEditApto(e.target.value)} />
                </div>
                <div style={{ ...styles.formRow, flex: 1 }}>
                  <label style={styles.label}>Teléfono</label>
                  <input style={styles.input} value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} />
                </div>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Edificio</label>
                <select style={styles.input} value={editEdificio} onChange={(e) => setEditEdificio(e.target.value)}>
                  {edificios.map(e => (
                    <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Unidad</label>
                <input style={styles.input} value={editUnidad} onChange={(e) => setEditUnidad(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setEditUser(null)} style={styles.btnCancel}>Cancelar</button>
                <button type="submit" disabled={editando} style={{ ...styles.btnPrimary, opacity: editando ? 0.5 : 1 }}>
                  {editando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: colors.bgPage },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', backgroundColor: colors.white, borderBottom: `1px solid ${colors.border}`,
    flexWrap: 'wrap', gap: 12,
  },
  logo: { fontSize: 22, fontWeight: 700, color: colors.primary },
  navBtn: {
    padding: '8px 16px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: 0 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 24,
    border: `1px solid ${colors.border}`, marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 16 },
  input: {
    padding: '10px 14px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white, width: '100%',
    boxSizing: 'border-box' as const,
  },
  label: { fontSize: 13, fontWeight: 500, color: colors.textSecondary, marginBottom: 4 },
  btnPrimary: {
    padding: '10px 24px', borderRadius: 999, backgroundColor: colors.primary,
    color: colors.white, fontSize: 14, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnEdit: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: '#DBEAFE',
    color: colors.primary, fontSize: 12, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnDelete: {
    padding: '6px 14px', borderRadius: 8, backgroundColor: '#FEF2F2',
    color: colors.error, fontSize: 12, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnCancel: {
    padding: '10px 20px', borderRadius: 999, backgroundColor: colors.bgPage,
    color: colors.textSecondary, fontSize: 14, fontWeight: 500, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: {
    textAlign: 'left' as const, padding: '10px 12px', fontSize: 12, fontWeight: 600,
    color: colors.textSecondary, borderBottom: `2px solid ${colors.border}`,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  td: {
    padding: '12px', borderBottom: `1px solid ${colors.border}`,
    color: colors.textPrimary,
  },
  muted: { color: colors.textSecondary, fontSize: 14 },
  // Modal
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 9999,
  },
  modal: {
    backgroundColor: colors.white, borderRadius: 16, padding: 32,
    width: '90%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' as const,
  },
  modalTitle: { fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  formRow: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
};
