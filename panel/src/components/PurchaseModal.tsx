import React, { useEffect, useState } from 'react';
import { comprarFichas, cambiarPinCompra, obtenerConfigEdificio } from '../services/api';
import { colors } from '../constants/colors';

type Step = 'pin' | 'buy' | 'change';

interface Props {
  edificioId: string;
  onClose: () => void;
  onSuccess: (nuevoSaldo: number) => void;
}

export default function PurchaseModal({ edificioId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [maxCompra, setMaxCompra] = useState<number | null>(null);
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinNuevo2, setPinNuevo2] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    obtenerConfigEdificio(edificioId)
      .then((c) => setMaxCompra(c.max_compra_fichas ?? 10))
      .catch(() => setMaxCompra(10));
  }, [edificioId]);

  function validarFormatoPin(p: string) { return /^\d{4}$/.test(p); }

  function handleContinuar() {
    setPinErr('');
    if (!validarFormatoPin(pin)) { setPinErr('El PIN debe tener 4 dígitos'); return; }
    setStep('buy');
  }

  async function handleComprar() {
    if (!Number.isInteger(cantidad) || cantidad < 1) { alert('Cantidad inválida'); return; }
    if (maxCompra != null && cantidad > maxCompra) { alert(`El máximo por compra es ${maxCompra} fichas`); return; }
    setLoading(true);
    try {
      const res = await comprarFichas(pin, cantidad);
      onSuccess(res.nuevo_saldo);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'No se pudo completar la compra';
      if (err?.response?.status === 401) { setPin(''); setStep('pin'); setPinErr('PIN incorrecto'); }
      else alert(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleCambiarPin() {
    if (!validarFormatoPin(pinNuevo) || !validarFormatoPin(pinNuevo2)) { alert('Los PIN nuevos deben tener 4 dígitos'); return; }
    if (pinNuevo !== pinNuevo2) { alert('Los dos PIN nuevos no coinciden'); return; }
    setLoading(true);
    try {
      await cambiarPinCompra(pin, pinNuevo);
      alert('PIN actualizado');
      setPin(pinNuevo);
      setPinNuevo(''); setPinNuevo2('');
      setStep('buy');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'No se pudo cambiar el PIN';
      if (err?.response?.status === 401) { setPin(''); setStep('pin'); setPinErr('PIN actual incorrecto'); }
      else alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>

        {step === 'pin' && (
          <>
            <h3 style={s.title}>🔒 Ingresá tu PIN</h3>
            <p style={s.sub}>
              Necesitás tu PIN de 4 dígitos para comprar fichas. Si es la primera vez, usá <b>1111</b>.
            </p>
            <input
              type="password" inputMode="numeric" maxLength={4} autoFocus
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinErr(''); }}
              style={s.pinInput} placeholder="••••"
            />
            {pinErr && <p style={s.error}>{pinErr}</p>}
            <div style={s.actions}>
              <button onClick={onClose} style={s.btnGhost}>Cancelar</button>
              <button onClick={handleContinuar} disabled={pin.length !== 4} style={{ ...s.btnPrimary, opacity: pin.length !== 4 ? 0.5 : 1 }}>
                Continuar
              </button>
            </div>
          </>
        )}

        {step === 'buy' && (
          <>
            <h3 style={s.title}>🪙 Comprar fichas</h3>
            <p style={s.sub}>
              Elegí cuántas fichas sumar{maxCompra != null ? ` (máximo ${maxCompra} por compra)` : ''}.
            </p>
            <div style={s.counter}>
              <button onClick={() => setCantidad(Math.max(1, cantidad - 1))} style={s.counterBtn}>−</button>
              <input
                type="number" min={1} max={maxCompra ?? 99}
                value={cantidad}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isNaN(n)) setCantidad(1);
                  else setCantidad(Math.max(1, maxCompra != null ? Math.min(maxCompra, n) : n));
                }}
                style={s.counterInput}
              />
              <button onClick={() => setCantidad(maxCompra != null ? Math.min(maxCompra, cantidad + 1) : cantidad + 1)} style={s.counterBtn}>+</button>
            </div>
            <div style={s.actions}>
              <button onClick={() => setStep('change')} style={s.btnGhost}>Cambiar PIN</button>
              <div style={{ flex: 1 }} />
              <button onClick={onClose} style={s.btnGhost}>Cancelar</button>
              <button onClick={handleComprar} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Comprando...' : `Comprar ${cantidad} ficha${cantidad === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}

        {step === 'change' && (
          <>
            <h3 style={s.title}>🔑 Cambiar PIN</h3>
            <p style={s.sub}>Elegí un nuevo PIN de 4 dígitos.</p>
            <label style={s.label}>Nuevo PIN</label>
            <input
              type="password" inputMode="numeric" maxLength={4}
              value={pinNuevo}
              onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={s.pinInput} placeholder="••••"
            />
            <label style={s.label}>Repetir PIN</label>
            <input
              type="password" inputMode="numeric" maxLength={4}
              value={pinNuevo2}
              onChange={(e) => setPinNuevo2(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={s.pinInput} placeholder="••••"
            />
            <div style={s.actions}>
              <button onClick={() => { setPinNuevo(''); setPinNuevo2(''); setStep('buy'); }} style={s.btnGhost}>Volver</button>
              <div style={{ flex: 1 }} />
              <button onClick={handleCambiarPin} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    backgroundColor: colors.white, borderRadius: 16, padding: 32,
    maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  title: { fontSize: 20, fontWeight: 700, color: colors.textPrimary, marginBottom: 8 },
  sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 20, lineHeight: 1.5 },
  label: { display: 'block', fontSize: 13, color: colors.textSecondary, marginTop: 8, marginBottom: 4 },
  pinInput: {
    width: '100%', boxSizing: 'border-box',
    padding: '14px 12px', fontSize: 28, letterSpacing: 12, textAlign: 'center',
    borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.bgPage,
    color: colors.textPrimary, fontFamily: 'inherit', marginBottom: 8,
  },
  counter: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 },
  counterBtn: {
    width: 50, height: 50, borderRadius: 25, border: 'none',
    backgroundColor: colors.bgBlueLight, color: colors.primary,
    fontSize: 24, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  counterInput: {
    fontSize: 36, fontWeight: 800, color: colors.textPrimary,
    width: 80, textAlign: 'center', border: 'none', outline: 'none', fontFamily: 'inherit',
    backgroundColor: 'transparent',
  },
  error: { color: colors.error, fontSize: 13, marginBottom: 8 },
  actions: { display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' },
  btnPrimary: {
    padding: '10px 20px', borderRadius: 999, border: 'none',
    backgroundColor: colors.primary, color: colors.white,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  btnGhost: {
    padding: '10px 16px', borderRadius: 999,
    border: `1px solid ${colors.border}`, backgroundColor: colors.white,
    color: colors.textPrimary, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  },
};
