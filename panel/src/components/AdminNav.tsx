import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Usuario } from '../services/api';
import { colors } from '../constants/colors';

type Item = { label: string; path: string; adminOnly?: boolean };

const ITEMS: Item[] = [
  { label: 'Dashboard',    path: '/dashboard' },
  { label: 'Créditos',     path: '/creditos' },
  { label: 'Usuarios',     path: '/admin-usuarios' },
  { label: 'Máquinas',     path: '/maquinas' },
  { label: 'Dispositivos', path: '/dispositivos' },
  { label: 'Liquidación',  path: '/liquidacion' },
  { label: 'Tips',         path: '/tips', adminOnly: true }, // solo super-admin
];

function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  return raw ? JSON.parse(raw) : null;
}

interface Props {
  active: string; // path del item activo, ej '/dashboard'
}

export default function AdminNav({ active }: Props) {
  const navigate = useNavigate();
  const usuario = getUsuario();
  const esSuper = usuario?.rol === 'admin';

  const items = ITEMS.filter((it) => !it.adminOnly || esSuper);

  const handleLogout = () => {
    localStorage.removeItem('cleancare_token');
    localStorage.removeItem('cleancare_usuario');
    navigate('/');
  };

  return (
    <header style={styles.header}>
      <img src="/logo.png" alt="CleanCare" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map((it) => {
          const isActive = active === it.path;
          return (
            <button
              key={it.path}
              onClick={() => navigate(it.path)}
              style={isActive ? styles.navBtnActive : styles.navBtn}
            >
              {it.label}
            </button>
          );
        })}
        {usuario && (
          <span style={styles.rolTag}>
            {esSuper ? '👑 Super-admin' : `🏢 ${usuario.edificio_id}`}
          </span>
        )}
        <button onClick={handleLogout} style={styles.navBtn}>Cerrar sesión</button>
      </nav>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', backgroundColor: colors.white,
    borderBottom: `1px solid ${colors.border}`,
    flexWrap: 'wrap', gap: 12,
  },
  navBtn: {
    padding: '8px 20px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: colors.white, color: colors.textPrimary, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  navBtnActive: {
    padding: '8px 20px', borderRadius: 999, border: 'none',
    backgroundColor: colors.primary, color: colors.white, fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
  },
  rolTag: {
    padding: '6px 12px', borderRadius: 999,
    backgroundColor: colors.bgBlueLight, color: colors.primary,
    fontSize: 12, fontWeight: 600, alignSelf: 'center',
  },
};
