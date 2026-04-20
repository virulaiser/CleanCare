import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../constants/colors';

export default function Home() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDev, setShowDev] = useState(false);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* NAVBAR */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <img src="/logo.png" alt="CleanCare" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
          <div className="nav-links" style={styles.navLinks}>
            <a href="#nosotros" style={styles.navLink}>Nosotros</a>
            <a href="#servicios" style={styles.navLink}>Servicios</a>
            <a href="#como-funciona" style={styles.navLink}>Cómo funciona</a>
            <a href="#contacto" style={styles.navLink}>Contacto</a>
          </div>
          <div className="nav-actions" style={styles.navActions}>
            <button onClick={() => navigate('/usuarios')} style={styles.navBtnSolid}>Usuarios</button>
            <button onClick={() => navigate('/login')} style={styles.navBtnOutline}>Administración</button>
          </div>
          <button className="nav-hamburger" onClick={() => setMenuOpen(true)}>☰</button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-close" onClick={() => setMenuOpen(false)}>✕</button>
          <a href="#nosotros" onClick={() => setMenuOpen(false)}>Nosotros</a>
          <a href="#servicios" onClick={() => setMenuOpen(false)}>Servicios</a>
          <a href="#como-funciona" onClick={() => setMenuOpen(false)}>Cómo funciona</a>
          <a href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a>
          <div className="mobile-divider" />
          <button className="mobile-btn-primary" onClick={() => { navigate('/usuarios'); setMenuOpen(false); }}>Usuarios</button>
          <button className="mobile-btn-outline" onClick={() => { navigate('/login'); setMenuOpen(false); }}>Administración</button>
        </div>
      )}

      {/* HERO */}
      <section id="inicio" className="hero-section" style={styles.hero}>
        <div className="hero-content" style={styles.heroContent}>
          <span style={styles.heroBadge}>Lavandería inteligente</span>
          <h1 className="hero-title" style={styles.heroTitle}>Lavandería inteligente<br />para tu edificio</h1>
          <p className="hero-text" style={styles.heroText}>
            Instalación y mantenimiento de equipos de lavandería autoservicio con control digital.
            Sin inversión del consorcio. Tecnología, mantenimiento continuo y gestión digital.
          </p>
          <div className="hero-buttons" style={styles.heroButtons}>
            <a href="https://wa.me/59897789834" target="_blank" rel="noopener noreferrer" style={styles.btnPrimary}>
              Solicitar visita gratuita
            </a>
            <a href="#como-funciona" style={styles.btnSecondary}>Ver cómo funciona</a>
            <a
              href="https://uptqmihghclt3xkt.public.blob.vercel-storage.com/cleancare-v1.1.1-w8MzUiQ4spNPDrQ1cXnZlTWS4OipAs.apk"
              download="cleancare-v1.1.1.apk"
              style={styles.btnDownload}
            >
              📲 Bajar App (Android)
            </a>
          </div>
          <div className="hero-stats" style={styles.heroStats}>
            <div style={styles.stat}><span style={styles.statNum}>50+</span><span style={styles.statLabel}>Edificios</span></div>
            <div style={styles.statDivider} />
            <div style={styles.stat}><span style={styles.statNum}>200+</span><span style={styles.statLabel}>Máquinas</span></div>
            <div style={styles.statDivider} />
            <div style={styles.stat}><span style={styles.statNum}>10k+</span><span style={styles.statLabel}>Usos mensuales</span></div>
          </div>
        </div>
        <div className="hero-visual" style={styles.heroVisual}>
          <div style={styles.heroCard}>
            <div style={styles.heroCardIcon}>&#x1F9FA;</div>
            <div style={styles.heroCardTitle}>Lavarropas 3B</div>
            <div style={styles.heroCardStatus}>Disponible</div>
            <div style={styles.heroCardBtn}>Activar — 45 min</div>
          </div>
        </div>
      </section>

      {/* NOSOTROS */}
      <section id="nosotros" className="section-padding" style={styles.sectionGray}>
        <div style={styles.container}>
          <h2 className="section-title" style={styles.sectionTitle}>¿Por qué CleanCare?</h2>
          <p className="section-subtitle" style={styles.sectionSubtitle}>Tecnología, mantenimiento continuo y gestión digital sin inversión del consorcio</p>
          <div className="grid-3" style={styles.grid3}>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>&#x1F4CA;</div>
              <h3 style={styles.featureTitle}>Gestión completa</h3>
              <p style={styles.featureText}>Reportes detallados de uso, liquidación de costos y gestión operativa para la administración del edificio.</p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>&#x1F4F1;</div>
              <h3 style={styles.featureTitle}>Control desde el celular</h3>
              <p style={styles.featureText}>Los residentes activan las máquinas con un toque en la app, por Bluetooth. Rápido, seguro y sin monedas.</p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>&#x1F527;</div>
              <h3 style={styles.featureTitle}>Mantenimiento incluido</h3>
              <p style={styles.featureText}>Nos encargamos de la instalación, mantenimiento preventivo y soporte técnico continuo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section id="servicios" className="section-padding" style={styles.sectionWhite}>
        <div style={styles.container}>
          <h2 className="section-title" style={styles.sectionTitle}>Nuestros servicios</h2>
          <p className="section-subtitle" style={styles.sectionSubtitle}>Todo lo que tu edificio necesita para una lavandería moderna</p>
          <div className="grid-2" style={styles.grid2}>
            <div style={styles.serviceCard}>
              <div style={styles.serviceHeader}>
                <span style={styles.serviceIcon}>&#x1F3E2;</span>
                <h3 style={styles.serviceTitle}>Para administraciones</h3>
              </div>
              <ul style={styles.serviceList}>
                <li>Panel web con resumen de facturación mensual</li>
                <li>Desglose por máquina y por residente</li>
                <li>Reportes exportables para el consorcio</li>
                <li>Sin inversión inicial — nosotros ponemos los equipos</li>
              </ul>
            </div>
            <div style={styles.serviceCard}>
              <div style={styles.serviceHeader}>
                <span style={styles.serviceIcon}>&#x1F9D1;</span>
                <h3 style={styles.serviceTitle}>Para residentes</h3>
              </div>
              <ul style={styles.serviceList}>
                <li>Activación por Bluetooth desde la app</li>
                <li>Duración de ciclo configurada por la administración</li>
                <li>Estado en tiempo real de la máquina</li>
                <li>Historial de usos en la app</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="section-padding" style={styles.sectionBlue}>
        <div style={styles.container}>
          <h2 className="section-title" style={{ ...styles.sectionTitle, color: colors.white }}>¿Cómo funciona?</h2>
          <p className="section-subtitle" style={{ ...styles.sectionSubtitle, color: 'rgba(255,255,255,0.8)' }}>En 3 simples pasos</p>
          <div className="grid-3" style={styles.grid3}>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>1</div>
              <h3 style={styles.stepTitle}>Abrí la app</h3>
              <p style={styles.stepText}>Acercate a la lavandería. La app se conecta por Bluetooth a la máquina automáticamente.</p>
            </div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>2</div>
              <h3 style={styles.stepTitle}>Elegí lavar o secar</h3>
              <p style={styles.stepText}>Tocá el botón "Lavarropas" o "Secadora" y seleccioná la máquina libre que quieras usar.</p>
            </div>
            <div style={styles.stepCard}>
              <div style={styles.stepNumber}>3</div>
              <h3 style={styles.stepTitle}>Listo, a lavar</h3>
              <p style={styles.stepText}>La máquina se activa sola con la duración que fija la administración. Seguí el tiempo restante en tu celular.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding" style={styles.sectionWhite}>
        <div style={{ ...styles.container, textAlign: 'center' as const, padding: '80px 24px' }}>
          <h2 className="section-title" style={styles.sectionTitle}>¿Listo para modernizar tu lavandería?</h2>
          <p className="section-subtitle" style={styles.sectionSubtitle}>Contactanos y te visitamos sin costo para evaluar tu edificio</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <a href="https://wa.me/59897789834" target="_blank" rel="noopener noreferrer" style={{ ...styles.btnPrimary, fontSize: 18, padding: '16px 40px' }}>
              Solicitar visita gratuita
            </a>
            <button onClick={() => navigate('/usuarios')} style={{ ...styles.btnSecondary, fontSize: 18, padding: '16px 40px', cursor: 'pointer' }}>
              Registrarse como usuario
            </button>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="section-padding" style={styles.sectionGray}>
        <div style={styles.container}>
          <h2 className="section-title" style={styles.sectionTitle}>Contacto</h2>
          <div className="grid-3" style={styles.grid3}>
            <div style={styles.contactCard}>
              <div style={styles.contactIcon}>&#x1F4E7;</div>
              <h4 style={styles.contactLabel}>Email</h4>
              <a href="mailto:info@cleancare.uy" style={styles.contactValue}>info@cleancare.uy</a>
            </div>
            <div style={styles.contactCard}>
              <div style={styles.contactIcon}>&#x1F4DE;</div>
              <h4 style={styles.contactLabel}>Teléfono</h4>
              <a href="tel:+59897789834" style={styles.contactValue}>097 789 834</a>
            </div>
            <div style={styles.contactCard}>
              <div style={styles.contactIcon}>&#x1F4CD;</div>
              <h4 style={styles.contactLabel}>Ubicación</h4>
              <span style={styles.contactValue}>Montevideo, Uruguay</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <div className="footer-inner" style={styles.footerInner}>
          <div>
            <span style={styles.footerLogo}>CleanCare</span>
            <p style={styles.footerText}>Lavandería inteligente para edificios residenciales. Tecnología, mantenimiento y gestión digital.</p>
          </div>
          <div className="footer-links" style={styles.footerLinks}>
            <a href="#inicio" style={styles.footerLink}>Inicio</a>
            <a href="#servicios" style={styles.footerLink}>Servicios</a>
            <a href="#contacto" style={styles.footerLink}>Contacto</a>
            <span onClick={() => navigate('/usuarios')} style={{ ...styles.footerLink, cursor: 'pointer' }}>Usuarios</span>
            <span onClick={() => navigate('/login')} style={{ ...styles.footerLink, cursor: 'pointer' }}>Administración</span>
          </div>
        </div>
        <div style={styles.footerBottom}>
          <span>© 2026 CleanCare. Todos los derechos reservados.</span>
          <span
            onClick={() => setShowDev(true)}
            style={{ marginLeft: 12, cursor: 'pointer', opacity: 0.5, fontFamily: 'monospace', fontSize: 12 }}
          >{'</>'}</span>
        </div>
      </footer>

      {/* Modal dev signature */}
      {showDev && (
        <div onClick={() => setShowDev(false)} style={styles.devOverlay}>
          <div onClick={e => e.stopPropagation()} style={styles.devCard}>
            <span style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: colors.primary }}>{'</>'}</span>
            <p style={{ fontSize: 14, color: colors.textSecondary, margin: '12px 0 4px' }}>Desarrollado por</p>
            <a href="mailto:jsiutto@gmail.com" style={{ fontSize: 18, fontWeight: 700, color: colors.primary, textDecoration: 'none' }}>
              jsiutto@gmail.com
            </a>
            <button onClick={() => setShowDev(false)} style={styles.devClose}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // NAV
  nav: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${colors.border}`,
  },
  navInner: {
    maxWidth: 1200, margin: '0 auto', padding: '14px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  logo: { fontSize: 24, fontWeight: 700, color: colors.primary },
  navLinks: { display: 'flex', gap: 28 },
  navLink: { fontSize: 14, fontWeight: 500, color: colors.textPrimary, textDecoration: 'none' },
  navActions: { display: 'flex', gap: 12, alignItems: 'center' },
  navBtnOutline: {
    padding: '8px 20px', borderRadius: 999, border: `1px solid ${colors.border}`,
    backgroundColor: 'transparent', color: colors.textPrimary, fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  navBtnSolid: {
    padding: '8px 20px', borderRadius: 999, backgroundColor: colors.primary,
    color: colors.white, fontSize: 14, fontWeight: 600, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },

  // HERO
  hero: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '120px 24px 80px', maxWidth: 1200, margin: '0 auto', gap: 60,
    flexWrap: 'wrap' as const,
  },
  heroContent: { flex: '1 1 480px', maxWidth: 600 },
  heroBadge: {
    display: 'inline-block', backgroundColor: colors.bgBlueLight, color: colors.primary,
    padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, marginBottom: 20,
  },
  heroTitle: {
    fontSize: 52, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.1, marginBottom: 20,
  },
  heroText: { fontSize: 18, color: colors.textSecondary, lineHeight: 1.6, marginBottom: 32 },
  heroButtons: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 48 },
  btnPrimary: {
    display: 'inline-block', padding: '14px 32px', borderRadius: 999,
    backgroundColor: colors.primary, color: colors.white, fontSize: 16, fontWeight: 600,
    textDecoration: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSecondary: {
    display: 'inline-block', padding: '14px 32px', borderRadius: 999,
    border: `2px solid ${colors.border}`, color: colors.textPrimary, fontSize: 16, fontWeight: 600,
    textDecoration: 'none', backgroundColor: 'transparent', fontFamily: 'inherit',
  },
  btnDownload: {
    display: 'inline-block', padding: '14px 32px', borderRadius: 999,
    backgroundColor: colors.textPrimary, color: colors.white, fontSize: 16, fontWeight: 600,
    textDecoration: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  },
  heroStats: { display: 'flex', alignItems: 'center', gap: 32 },
  stat: { display: 'flex', flexDirection: 'column' as const },
  statNum: { fontSize: 28, fontWeight: 700, color: colors.textPrimary },
  statLabel: { fontSize: 13, color: colors.textSecondary },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  heroVisual: { flex: '1 1 320px', display: 'flex', justifyContent: 'center' },
  heroCard: {
    backgroundColor: colors.white, borderRadius: 20, padding: 32, width: 280,
    border: `1px solid ${colors.border}`, boxShadow: '0 20px 60px rgba(59,130,246,0.12)',
    textAlign: 'center' as const,
  },
  heroCardIcon: { fontSize: 48, marginBottom: 16 },
  heroCardTitle: { fontSize: 18, fontWeight: 700, color: colors.textPrimary, marginBottom: 8 },
  heroCardStatus: {
    display: 'inline-block', backgroundColor: '#DCFCE7', color: '#16A34A',
    padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, marginBottom: 20,
  },
  heroCardBtn: {
    display: 'block', padding: '12px 0', borderRadius: 999, backgroundColor: colors.primary,
    color: colors.white, fontSize: 14, fontWeight: 600,
  },

  // SECTIONS
  container: { maxWidth: 1200, margin: '0 auto', padding: '0 24px' },
  sectionWhite: { padding: '80px 0', backgroundColor: colors.white },
  sectionGray: { padding: '80px 0', backgroundColor: colors.bgPage },
  sectionBlue: { padding: '80px 0', backgroundColor: colors.primary },
  sectionTitle: { fontSize: 36, fontWeight: 700, color: colors.textPrimary, textAlign: 'center' as const, marginBottom: 12 },
  sectionSubtitle: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' as const, marginBottom: 48, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' },

  // GRIDS
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 },

  // FEATURE CARDS
  featureCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: 32,
    border: `1px solid ${colors.border}`, textAlign: 'center' as const,
  },
  featureIcon: { fontSize: 40, marginBottom: 16 },
  featureTitle: { fontSize: 18, fontWeight: 700, color: colors.textPrimary, marginBottom: 8 },
  featureText: { fontSize: 14, color: colors.textSecondary, lineHeight: 1.6 },

  // SERVICE CARDS
  serviceCard: {
    backgroundColor: colors.bgPage, borderRadius: 16, padding: 32,
    border: `1px solid ${colors.border}`,
  },
  serviceHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  serviceIcon: { fontSize: 32 },
  serviceTitle: { fontSize: 20, fontWeight: 700, color: colors.textPrimary },
  serviceList: { paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 12, color: colors.textSecondary, fontSize: 15, lineHeight: 1.5 },

  // STEP CARDS
  stepCard: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 32,
    textAlign: 'center' as const, border: '1px solid rgba(255,255,255,0.2)',
  },
  stepNumber: {
    display: 'inline-flex', width: 48, height: 48, borderRadius: '50%',
    backgroundColor: colors.white, color: colors.primary, fontSize: 20, fontWeight: 700,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  stepTitle: { fontSize: 18, fontWeight: 700, color: colors.white, marginBottom: 8 },
  stepText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 },

  // CONTACT
  contactCard: { textAlign: 'center' as const, padding: 24 },
  contactIcon: { fontSize: 32, marginBottom: 12 },
  contactLabel: { fontSize: 14, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 },
  contactValue: { fontSize: 16, color: colors.primary, textDecoration: 'none', fontWeight: 500 },

  // FOOTER
  footer: { backgroundColor: colors.textPrimary, padding: '48px 24px 0' },
  footerInner: {
    maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexWrap: 'wrap' as const, gap: 32,
  },
  footerLogo: { fontSize: 22, fontWeight: 700, color: colors.white, display: 'block', marginBottom: 12 },
  footerText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', maxWidth: 360, lineHeight: 1.6 },
  footerLinks: { display: 'flex', gap: 24, flexWrap: 'wrap' as const },
  footerLink: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' },
  footerBottom: {
    maxWidth: 1200, margin: '0 auto', padding: '20px 0',
    fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' as const,
  },
  devOverlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 9999,
  },
  devCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 32,
    textAlign: 'center' as const, minWidth: 280,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
  },
  devClose: {
    marginTop: 20, padding: '8px 24px', border: 'none',
    background: 'none', color: colors.textSecondary, fontSize: 14, cursor: 'pointer',
  },
};
