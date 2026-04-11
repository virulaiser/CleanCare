import React, { useState } from 'react';
import { colors } from '../constants/colors';

export default function DevSignature() {
  const [show, setShow] = useState(false);

  return (
    <>
      <span
        onClick={() => setShow(true)}
        style={{
          display: 'inline-block', cursor: 'pointer', opacity: 0.4,
          fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
          color: colors.textSecondary, marginTop: 16, userSelect: 'none',
        }}
      >{'</>'}</span>

      {show && (
        <div onClick={() => setShow(false)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={cardStyle}>
            <span style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: colors.primary }}>{'</>'}</span>
            <p style={{ fontSize: 14, color: colors.textSecondary, margin: '12px 0 4px' }}>Desarrollado por</p>
            <a href="mailto:jsiutto@gmail.com" style={{ fontSize: 18, fontWeight: 700, color: colors.primary, textDecoration: 'none' }}>
              jsiutto@gmail.com
            </a>
            <button onClick={() => setShow(false)} style={closeStyle}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
  justifyContent: 'center', alignItems: 'center', zIndex: 9999,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff', borderRadius: 20, padding: 32,
  textAlign: 'center', minWidth: 280,
  display: 'flex', flexDirection: 'column', alignItems: 'center',
};

const closeStyle: React.CSSProperties = {
  marginTop: 20, padding: '8px 24px', border: 'none',
  background: 'none', color: '#94A3B8', fontSize: 14, cursor: 'pointer',
};
