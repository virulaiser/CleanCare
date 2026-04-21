import React from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../constants/colors';

import { esSuperAdmin } from '../utils/auth';

export interface SubTabItem {
  label: string;
  path: string;
  adminOnly?: boolean;
}

export function buildMaquinasTabs(): SubTabItem[] {
  const base: SubTabItem[] = [
    { label: 'Máquinas', path: '/maquinas' },
    { label: 'Dispositivos', path: '/dispositivos' },
    { label: 'Tips', path: '/tips', adminOnly: true },
  ];
  return esSuperAdmin() ? base : base.filter((t) => !t.adminOnly);
}

export const DASHBOARD_TABS: SubTabItem[] = [
  { label: 'Resumen', path: '/dashboard' },
  { label: 'Liquidación', path: '/liquidacion' },
  { label: 'Facturación', path: '/facturacion' },
];

interface Props {
  items: SubTabItem[];
  active: string;
}

export default function SubTabs({ items, active }: Props) {
  const navigate = useNavigate();
  return (
    <div style={styles.wrapper}>
      {items.map((it) => {
        const isActive = active === it.path;
        return (
          <button
            key={it.path}
            onClick={() => { if (!isActive) navigate(it.path); }}
            style={isActive ? styles.tabActive : styles.tab}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
    borderBottom: `1px solid ${colors.border}`,
    flexWrap: 'wrap',
  },
  tab: {
    padding: '10px 20px',
    border: 'none',
    borderBottom: '3px solid transparent',
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: -1,
  },
  tabActive: {
    padding: '10px 20px',
    border: 'none',
    borderBottom: `3px solid ${colors.primary}`,
    backgroundColor: 'transparent',
    color: colors.primary,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: -1,
  },
};
