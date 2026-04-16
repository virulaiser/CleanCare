import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarUsuariosEdificio, listarEdificios, crearUsuarioAdmin,
  editarUsuarioAdmin, eliminarUsuarioAdmin, listarUsos,
  Edificio, Uso,
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
  foto?: string;
  saldo: number;
  fichas_usadas: number;
  fichas_extras: number;
}

// Comprimir imagen a max 200x200 y convertir a base64
function compressImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroEmail, setFiltroEmail] = useState('');
  const [filtroApto, setFiltroApto] = useState('');
  const [filtroEdificio, setFiltroEdificio] = useState('');
  const [filtroFichas, setFiltroFichas] = useState<'' | 'con' | 'sin'>('');
  const [ordenar, setOrdenar] = useState<'nombre' | 'fichas_usadas' | 'fichas_extras' | 'saldo'>('nombre');

  // Modal crear
  const [showCrear, setShowCrear] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formApto, setFormApto] = useState('');
  const [formEdificio, setFormEdificio] = useState('');
  const [formUnidad, setFormUnidad] = useState('');
  const [formFoto, setFormFoto] = useState('');
  const [creando, setCreando] = useState(false);

  // Modal balance / resumen por usuario
  const now = new Date();
  const [balanceUser, setBalanceUser] = useState<UsuarioRow | null>(null);
  const [balanceMes, setBalanceMes] = useState(now.getMonth() + 1);
  const [balanceAnio, setBalanceAnio] = useState(now.getFullYear());
  const [balanceUsos, setBalanceUsos] = useState<Uso[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Modal editar
  const [editUser, setEditUser] = useState<UsuarioRow | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editApto, setEditApto] = useState('');
  const [editEdificio, setEditEdificio] = useState('');
  const [editUnidad, setEditUnidad] = useState('');
  const [editFoto, setEditFoto] = useState('');
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
      if (edfs.length > 0 && !formEdificio) setFormEdificio(edfs[0].edificio_id);
    } catch {}
    setLoading(false);
  }

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  // Crear
  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre || !formEmail || !formPassword || !formEdificio) {
      alert('Completá nombre, email, contraseña y edificio');
      return;
    }
    setCreando(true);
    try {
      await crearUsuarioAdmin({
        nombre: formNombre, email: formEmail, password: formPassword,
        telefono: formTelefono || undefined, apartamento: formApto || undefined,
        edificio_id: formEdificio, unidad: formUnidad || undefined,
        foto: formFoto || undefined,
      });
      setShowCrear(false);
      setFormNombre(''); setFormEmail(''); setFormPassword('');
      setFormTelefono(''); setFormApto(''); setFormUnidad(''); setFormFoto('');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al crear usuario');
    }
    setCreando(false);
  };

  // Editar
  const openEdit = (u: UsuarioRow) => {
    setEditUser(u);
    setEditNombre(u.nombre); setEditEmail(u.email); setEditPassword('');
    setEditTelefono(u.telefono || ''); setEditApto(u.apartamento || '');
    setEditEdificio(u.edificio_id); setEditUnidad(u.unidad || '');
    setEditFoto(u.foto || '');
  };

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditando(true);
    try {
      await editarUsuarioAdmin(editUser.usuario_id, {
        nombre: editNombre || undefined, email: editEmail || undefined,
        password: editPassword || undefined, telefono: editTelefono,
        apartamento: editApto, edificio_id: editEdificio || undefined, unidad: editUnidad,
        foto: editFoto || undefined,
      });
      setEditUser(null);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al editar');
    }
    setEditando(false);
  };

  // Balance modal
  const openBalance = async (u: UsuarioRow) => {
    setBalanceUser(u);
    setBalanceMes(now.getMonth() + 1);
    setBalanceAnio(now.getFullYear());
    setBalanceLoading(true);
    try {
      const usosData = await listarUsos();
      const match = (r: string) =>
        r === u.apartamento || r === u.unidad || r === u.email || r === u.usuario_id;
      setBalanceUsos(usosData.filter((x) => match(x.residente_id)));
    } catch {
      setBalanceUsos([]);
    }
    setBalanceLoading(false);
  };

  const balanceData = React.useMemo(() => {
    if (!balanceUser) return null;
    const mesUsos = balanceUsos.filter((x) => {
      const f = new Date(x.fecha_inicio || x.fecha);
      return f.getMonth() + 1 === balanceMes && f.getFullYear() === balanceAnio;
    });
    const mesCompletados = mesUsos.filter((x) => x.estado === 'completado' || x.completado);
    const mesFallas = mesUsos.filter((x) => x.estado === 'averia');
    const totalCompletados = balanceUsos.filter((x) => x.estado === 'completado' || x.completado).length;
    const totalFallas = balanceUsos.filter((x) => x.estado === 'averia').length;
    return {
      mesUsos: mesCompletados.length,
      mesMin: mesCompletados.reduce((s, x) => s + (x.duracion_min || 0), 0),
      mesFallas: mesFallas.length,
      totalUsos: totalCompletados,
      totalFallas,
      mesLista: mesUsos.sort((a, b) => new Date(b.fecha_inicio || b.fecha).getTime() - new Date(a.fecha_inicio || a.fecha).getTime()),
    };
  }, [balanceUser, balanceUsos, balanceMes, balanceAnio]);

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function exportarUsuarioPDF() {
    if (!balanceUser || !balanceData) return;
    const u = balanceUser;
    const periodo = `${meses[balanceMes - 1]} ${balanceAnio}`;
    const filas = balanceData.mesLista.length === 0
      ? '<tr><td colspan="4" style="text-align:center;color:#94A3B8;padding:16px">Sin usos en este periodo</td></tr>'
      : balanceData.mesLista.map((x) => `
          <tr>
            <td>${new Date(x.fecha_inicio || x.fecha).toLocaleDateString('es-UY')}</td>
            <td>${x.tipo || 'lavarropas'}</td>
            <td>${x.duracion_min} min</td>
            <td>${x.estado === 'averia' ? '⚠️ Falla' : x.estado === 'completado' ? '✓ OK' : x.estado || '—'}</td>
          </tr>
        `).join('');

    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html><head><title>Resumen ${u.nombre} — ${periodo}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; color: #1E293B; padding: 32px; margin: 0; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #3B82F6; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 24px; font-weight: 700; color: #3B82F6; }
        .subtitle { color: #64748B; font-size: 13px; margin-top: 4px; }
        .meta { text-align: right; font-size: 13px; color: #64748B; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .info { color: #64748B; font-size: 13px; margin-bottom: 20px; }
        h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 24px 0 12px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .kpi { background: #F8FAFC; border: 1px solid #E5E7EB; padding: 12px; border-radius: 8px; text-align: center; }
        .kpi .label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi .val { font-size: 22px; font-weight: 700; margin-top: 4px; }
        .balance { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
        .bal-card { padding: 16px; border-radius: 10px; text-align: center; }
        .bal-saldo { background: #DCFCE7; }
        .bal-saldo .v { color: #16A34A; }
        .bal-usadas { background: #F1F5F9; }
        .bal-extras { background: #FEF3C7; }
        .bal-extras .v { color: #D97706; }
        .bal-card .l { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
        .bal-card .v { font-size: 28px; font-weight: 700; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
        th { text-align: left; padding: 8px 12px; background: #F1F5F9; color: #64748B; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #E5E7EB; }
        td { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; }
        tr:last-child td { border-bottom: none; }
        .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E5E7EB; padding-top: 12px; }
        @media print { body { padding: 16px; } }
      </style></head>
      <body>
        <div class="header">
          <div>
            <div class="logo">CleanCare</div>
            <div class="subtitle">Resumen por usuario</div>
          </div>
          <div class="meta">
            Generado: ${new Date().toLocaleString('es-UY')}<br/>
            Periodo: <strong>${periodo}</strong>
          </div>
        </div>

        <h1>${u.nombre}</h1>
        <div class="info">
          ${u.email} ${u.apartamento ? `• Apto ${u.apartamento}` : ''} • ID ${u.usuario_id}
        </div>

        <h2>Balance</h2>
        <div class="balance">
          <div class="bal-card bal-saldo"><div class="l">Saldo actual</div><div class="v">${u.saldo}</div></div>
          <div class="bal-card bal-usadas"><div class="l">Fichas usadas</div><div class="v">${u.fichas_usadas}</div></div>
          <div class="bal-card bal-extras"><div class="l">Fichas extras</div><div class="v">${u.fichas_extras}</div></div>
        </div>

        <h2>Resumen ${periodo}</h2>
        <div class="kpis">
          <div class="kpi"><div class="label">Usos</div><div class="val">${balanceData.mesUsos}</div></div>
          <div class="kpi"><div class="label">Minutos</div><div class="val">${balanceData.mesMin}</div></div>
          <div class="kpi"><div class="label">Fallas</div><div class="val">${balanceData.mesFallas}</div></div>
          <div class="kpi"><div class="label">Total histórico</div><div class="val">${balanceData.totalUsos}</div></div>
        </div>

        <h2>Detalle del periodo</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Duración</th><th>Estado</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>

        <div class="footer">CleanCare — sistema de gestión de lavarropas y secadoras • cleancare.uy</div>
        <script>setTimeout(function(){window.print();}, 400);</script>
      </body></html>
    `);
    w.document.close();
  }

  // Eliminar
  const handleEliminar = async (u: UsuarioRow) => {
    if (!confirm(`¿Desactivar a ${u.nombre} (${u.email})?`)) return;
    try {
      await eliminarUsuarioAdmin(u.usuario_id);
      await fetchData();
    } catch { alert('Error al eliminar usuario'); }
  };

  // Filtrar y ordenar
  const edificioNombre = (id: string) => edificios.find(e => e.edificio_id === id)?.nombre || id;

  const filtrados = usuarios.filter((u) => {
    if (filtroNombre && !u.nombre.toLowerCase().includes(filtroNombre.toLowerCase())) return false;
    if (filtroEmail && !u.email.toLowerCase().includes(filtroEmail.toLowerCase())) return false;
    if (filtroApto && !(u.apartamento || '').toLowerCase().includes(filtroApto.toLowerCase())) return false;
    if (filtroEdificio && u.edificio_id !== filtroEdificio) return false;
    if (filtroFichas === 'con' && u.saldo <= 0) return false;
    if (filtroFichas === 'sin' && u.saldo > 0) return false;
    return true;
  }).sort((a, b) => {
    if (ordenar === 'nombre') return a.nombre.localeCompare(b.nombre);
    if (ordenar === 'fichas_usadas') return b.fichas_usadas - a.fichas_usadas;
    if (ordenar === 'fichas_extras') return b.fichas_extras - a.fichas_extras;
    if (ordenar === 'saldo') return b.saldo - a.saldo;
    return 0;
  });

  // Avatar — muestra foto o inicial
  const Avatar = ({ nombre, foto, size = 36 }: { nombre: string; foto?: string; size?: number }) => {
    if (foto) {
      return <img src={foto} alt={nombre} style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', flexShrink: 0 }} />;
    }
    const initial = nombre ? nombre.charAt(0).toUpperCase() : '?';
    const hue = nombre ? (nombre.charCodeAt(0) * 37) % 360 : 200;
    return (
      <div style={{
        width: size, height: size, borderRadius: size / 2, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        backgroundColor: `hsl(${hue}, 60%, 90%)`, color: `hsl(${hue}, 60%, 35%)`,
        fontSize: size * 0.42, fontWeight: 700,
      }}>
        {initial}
      </div>
    );
  };

  // Componente upload foto
  const PhotoUpload = ({ foto, onFoto, nombre }: { foto: string; onFoto: (f: string) => void; nombre: string }) => {
    const fileRef = React.useRef<HTMLInputElement>(null);
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return; }
      try {
        const b64 = await compressImage(file);
        onFoto(b64);
      } catch { alert('Error al procesar la imagen'); }
    };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <div onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer', position: 'relative' }}>
          <Avatar nombre={nombre} foto={foto} size={64} />
          <div style={{
            position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11,
            backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid white', fontSize: 11, color: 'white',
          }}>+</div>
        </div>
        <div style={{ flex: 1 }}>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${colors.border}`, backgroundColor: colors.white, color: colors.textPrimary, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {foto ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {foto && <button type="button" onClick={() => onFoto('')}
            style={{ marginLeft: 8, padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: '#FEF2F2', color: colors.error, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Quitar
          </button>}
          <p style={{ fontSize: 11, color: colors.textSecondary, margin: '4px 0 0' }}>JPG o PNG, se redimensiona a 200x200</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <img src="/logo.png" alt="CleanCare" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>Dashboard</button>
          <button onClick={() => navigate('/maquinas')} style={styles.navBtn}>Máquinas</button>
          <button onClick={() => navigate('/creditos')} style={styles.navBtn}>Créditos</button>
          <button onClick={() => navigate('/admin-usuarios')} style={{ ...styles.navBtn, backgroundColor: colors.primary, color: colors.white, border: 'none', fontWeight: 600 }}>Usuarios</button>
          <button onClick={() => navigate('/dispositivos')} style={styles.navBtn}>Dispositivos</button>
          <button onClick={() => navigate('/liquidacion')} style={styles.navBtn}>Liquidación</button>
          <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
        </nav>
      </header>

      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h2 style={styles.pageTitle}>Gestión de Usuarios</h2>
            <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0 }}>
              {filtrados.length} usuario{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => setShowCrear(true)} style={styles.btnPrimary}>+ Nuevo usuario</button>
        </div>

        {/* Filtros */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Filtros</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={styles.filterCol}>
              <label style={styles.label}>Nombre</label>
              <input style={styles.input} placeholder="Buscar nombre..." value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} />
            </div>
            <div style={styles.filterCol}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} placeholder="Buscar email..." value={filtroEmail} onChange={(e) => setFiltroEmail(e.target.value)} />
            </div>
            <div style={styles.filterCol}>
              <label style={styles.label}>Apartamento</label>
              <input style={styles.input} placeholder="Ej: 3B" value={filtroApto} onChange={(e) => setFiltroApto(e.target.value)} />
            </div>
            {edificios.length > 1 && (
              <div style={styles.filterCol}>
                <label style={styles.label}>Edificio</label>
                <select style={styles.input} value={filtroEdificio} onChange={(e) => setFiltroEdificio(e.target.value)}>
                  <option value="">Todos</option>
                  {edificios.map(e => <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>)}
                </select>
              </div>
            )}
            <div style={styles.filterCol}>
              <label style={styles.label}>Fichas</label>
              <select style={styles.input} value={filtroFichas} onChange={(e) => setFiltroFichas(e.target.value as any)}>
                <option value="">Todos</option>
                <option value="con">Con fichas</option>
                <option value="sin">Sin fichas</option>
              </select>
            </div>
            <div style={styles.filterCol}>
              <label style={styles.label}>Ordenar por</label>
              <select style={styles.input} value={ordenar} onChange={(e) => setOrdenar(e.target.value as any)}>
                <option value="nombre">Nombre</option>
                <option value="saldo">Saldo</option>
                <option value="fichas_usadas">Fichas usadas</option>
                <option value="fichas_extras">Fichas extras</option>
              </select>
            </div>
          </div>
          {(filtroNombre || filtroEmail || filtroApto || filtroEdificio || filtroFichas) && (
            <button
              onClick={() => { setFiltroNombre(''); setFiltroEmail(''); setFiltroApto(''); setFiltroEdificio(''); setFiltroFichas(''); }}
              style={{ marginTop: 12, padding: '6px 16px', borderRadius: 999, border: 'none', backgroundColor: colors.bgCard, color: colors.textSecondary, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla */}
        <div style={styles.card}>
          {loading ? (
            <p style={styles.muted}>Cargando...</p>
          ) : filtrados.length === 0 ? (
            <p style={styles.muted}>No se encontraron usuarios.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Usuario</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Apto</th>
                    <th style={styles.th}>Edificio</th>
                    <th style={styles.th}>Balance</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.usuario_id} style={{ transition: 'background 0.15s' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.bgPage)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar nombre={u.nombre} foto={u.foto} />
                          <div>
                            <div style={{ fontWeight: 600, color: colors.textPrimary }}>{u.nombre}</div>
                            {u.telefono && <div style={{ fontSize: 12, color: colors.textSecondary }}>{u.telefono}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}><span style={{ fontSize: 13 }}>{u.email}</span></td>
                      <td style={styles.td}>{u.apartamento || '—'}</td>
                      <td style={styles.td}>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, backgroundColor: colors.bgBlueLight, color: colors.primary, fontWeight: 500 }}>
                          {edificioNombre(u.edificio_id)}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button onClick={() => openBalance(u)} style={styles.btnBalance}>
                          <span style={{ color: u.saldo <= 0 ? colors.error : colors.success, fontWeight: 700 }}>{u.saldo}</span>
                          <span style={{ color: colors.textSecondary, fontSize: 11 }}> • {u.fichas_usadas || 0} usadas</span>
                          {u.fichas_extras > 0 && <span style={{ color: '#D97706', fontSize: 11 }}> • +{u.fichas_extras}</span>}
                        </button>
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
              <PhotoUpload foto={formFoto} onFoto={setFormFoto} nombre={formNombre || 'N'} />
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
                  {edificios.map(e => <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>)}
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

      {/* Modal Balance */}
      {balanceUser && (
        <div style={styles.overlay} onClick={() => setBalanceUser(null)}>
          <div style={{ ...styles.modal, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar nombre={balanceUser.nombre} foto={balanceUser.foto} size={48} />
              <div style={{ flex: 1 }}>
                <h3 style={{ ...styles.modalTitle, marginBottom: 2 }}>{balanceUser.nombre}</h3>
                <span style={{ fontSize: 12, color: colors.textSecondary }}>
                  {balanceUser.email} {balanceUser.apartamento ? `• Apto ${balanceUser.apartamento}` : ''}
                </span>
              </div>
            </div>

            {/* Balance unificado */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={{ ...styles.statBox, backgroundColor: '#DCFCE7' }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: balanceUser.saldo <= 0 ? colors.error : colors.success }}>{balanceUser.saldo}</span>
                <span style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo</span>
              </div>
              <div style={styles.statBox}>
                <span style={{ fontSize: 28, fontWeight: 700, color: colors.textPrimary }}>{balanceUser.fichas_usadas}</span>
                <span style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Usadas</span>
              </div>
              <div style={{ ...styles.statBox, backgroundColor: '#FEF3C7' }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#D97706' }}>{balanceUser.fichas_extras}</span>
                <span style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Extras</span>
              </div>
            </div>

            {/* Selector periodo */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Mes</label>
                <select style={styles.input} value={balanceMes} onChange={(e) => setBalanceMes(parseInt(e.target.value))}>
                  {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Año</label>
                <input type="number" style={styles.input} value={balanceAnio} onChange={(e) => setBalanceAnio(parseInt(e.target.value) || now.getFullYear())} />
              </div>
            </div>

            {balanceLoading ? <p style={styles.muted}>Cargando...</p> : balanceData && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                  <div style={styles.statBox}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>{balanceData.mesUsos}</span>
                    <span style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>Usos</span>
                  </div>
                  <div style={styles.statBox}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>{balanceData.mesMin}</span>
                    <span style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>Minutos</span>
                  </div>
                  <div style={styles.statBox}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: colors.error }}>{balanceData.mesFallas}</span>
                    <span style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>Fallas</span>
                  </div>
                  <div style={styles.statBox}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: colors.primary }}>{balanceData.totalUsos}</span>
                    <span style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>Total</span>
                  </div>
                </div>

                {balanceData.mesLista.length > 0 && (
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: colors.bgPage }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 8, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>Fecha</th>
                          <th style={{ textAlign: 'left', padding: 8, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>Tipo</th>
                          <th style={{ textAlign: 'left', padding: 8, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>Duración</th>
                          <th style={{ textAlign: 'left', padding: 8, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceData.mesLista.map((x) => (
                          <tr key={x._id}>
                            <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>{new Date(x.fecha_inicio || x.fecha).toLocaleDateString('es-UY')}</td>
                            <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>{x.tipo || 'lavarropas'}</td>
                            <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>{x.duracion_min} min</td>
                            <td style={{ padding: 8, borderTop: `1px solid ${colors.border}` }}>
                              {x.estado === 'averia' ? <span style={{ color: colors.error }}>⚠️ Falla</span> : x.estado === 'completado' ? <span style={{ color: colors.success }}>✓ OK</span> : x.estado || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setBalanceUser(null)} style={styles.btnCancel}>Cerrar</button>
              <button type="button" onClick={exportarUsuarioPDF} style={styles.btnPrimary} disabled={balanceLoading}>📄 Exportar PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editUser && (
        <div style={styles.overlay} onClick={() => setEditUser(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Avatar nombre={editUser.nombre} />
              <div>
                <h3 style={{ ...styles.modalTitle, marginBottom: 0 }}>Editar usuario</h3>
                <span style={{ fontSize: 12, color: colors.textSecondary }}>{editUser.usuario_id}</span>
              </div>
            </div>
            <form onSubmit={handleEditar} style={styles.form}>
              <PhotoUpload foto={editFoto} onFoto={setEditFoto} nombre={editNombre || 'E'} />
              <div style={styles.formRow}>
                <label style={styles.label}>Nombre</label>
                <input style={styles.input} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Email</label>
                <input style={styles.input} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Nueva contraseña (vacío = no cambiar)</label>
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
                  {edificios.map(e => <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>)}
                </select>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Unidad</label>
                <input style={styles.input} value={editUnidad} onChange={(e) => setEditUnidad(e.target.value)} />
              </div>
              {/* Resumen fichas */}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <div style={styles.statBox}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: editUser.saldo <= 0 ? colors.error : colors.success }}>{editUser.saldo}</span>
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>Saldo</span>
                </div>
                <div style={styles.statBox}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>{editUser.fichas_usadas}</span>
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>Usadas</span>
                </div>
                <div style={styles.statBox}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#D97706' }}>{editUser.fichas_extras}</span>
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>Extras</span>
                </div>
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
  main: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: 0 },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 24,
    border: `1px solid ${colors.border}`, marginBottom: 24,
  },
  cardTitle: { fontSize: 14, fontWeight: 600, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  filterCol: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex: '1 1 140px', minWidth: 120 },
  input: {
    padding: '9px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
    fontSize: 14, fontFamily: 'inherit', backgroundColor: colors.white, width: '100%',
    boxSizing: 'border-box' as const,
  },
  label: { fontSize: 12, fontWeight: 500, color: colors.textSecondary },
  btnPrimary: {
    padding: '10px 24px', borderRadius: 999, backgroundColor: colors.primary,
    color: colors.white, fontSize: 14, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnEdit: {
    padding: '5px 12px', borderRadius: 6, backgroundColor: '#DBEAFE',
    color: colors.primary, fontSize: 12, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnDelete: {
    padding: '5px 12px', borderRadius: 6, backgroundColor: '#FEF2F2',
    color: colors.error, fontSize: 12, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnBalance: {
    padding: '6px 12px', borderRadius: 8, border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgPage, fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  btnCancel: {
    padding: '10px 20px', borderRadius: 999, backgroundColor: colors.bgPage,
    color: colors.textSecondary, fontSize: 14, fontWeight: 500, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: {
    textAlign: 'left' as const, padding: '10px 12px', fontSize: 11, fontWeight: 600,
    color: colors.textSecondary, borderBottom: `2px solid ${colors.border}`,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  td: { padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, color: colors.textPrimary },
  muted: { color: colors.textSecondary, fontSize: 14 },
  statBox: {
    flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    padding: 12, borderRadius: 8, backgroundColor: colors.bgPage,
  },
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
