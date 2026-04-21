const express = require('express');
const cors = require('cors');
const { verificarToken, soloAdmin, soloAdminOEdificio } = require('../lib/auth');

const authHandler = require('./auth');
const usoHandler = require('./uso');
const usosHandler = require('./usos');
const resumenHandler = require('./resumen');
const maquinasHandler = require('./maquinas');
const billeteraHandler = require('./billetera');
const configEdificioHandler = require('./config-edificio');
const resumenCreditosHandler = require('./resumen-creditos');
const resumenApartamentoHandler = require('./resumen-apartamento');
const cronAsignacionHandler = require('./cron-asignacion');
const usuariosHandler = require('./usuarios');
const edificiosHandler = require('./edificios');
const tipsHandler = require('./tips');
const dispositivosHandler = require('./dispositivos');
const apartamentoHandler = require('./apartamento');
const unidadesHandler = require('./unidades');
const facturacionHandler = require('./facturacion');
const cronFacturacionHandler = require('./cron-facturacion');
const cambioInquilinoHandler = require('./cambio-inquilino');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Rutas públicas
app.get('/api', (req, res) => {
  res.json({ ok: true, service: 'CleanCare API', version: '1.0.0' });
});
app.post('/api/auth', authHandler);
app.get('/api/auth', authHandler);
app.get('/api/edificios', edificiosHandler);
app.get('/api/unidades', unidadesHandler);
app.get('/api/tips', tipsHandler);

// Rutas protegidas (requieren token)
app.post('/api/uso', verificarToken, usoHandler);
app.patch('/api/uso', verificarToken, usoHandler);
app.get('/api/usos', verificarToken, usosHandler);
app.get('/api/maquinas', verificarToken, maquinasHandler);

// Rutas billetera (protegidas)
app.get('/api/billetera', verificarToken, billeteraHandler);
app.post('/api/billetera/comprar', verificarToken, billeteraHandler);
app.patch('/api/billetera/pin', verificarToken, billeteraHandler);
// Acciones de admin sobre saldos (super-admin o admin_edificio dentro de su propio edificio)
app.post('/api/billetera/creditos', verificarToken, soloAdminOEdificio, billeteraHandler);
app.post('/api/billetera/creditos-masivo', verificarToken, soloAdminOEdificio, billeteraHandler);

// Admin gestiona residentes del edificio (admin_edificio queda filtrado a su edificio)
app.get('/api/usuarios', verificarToken, soloAdminOEdificio, usuariosHandler);
app.post('/api/usuarios', verificarToken, soloAdminOEdificio, usuariosHandler);
app.patch('/api/usuarios', verificarToken, soloAdminOEdificio, usuariosHandler);
app.delete('/api/usuarios', verificarToken, soloAdminOEdificio, usuariosHandler);

// Reportes del edificio (admin_edificio solo ve los suyos, ya filtrado por middleware)
app.get('/api/resumen', verificarToken, soloAdminOEdificio, resumenHandler);
app.get('/api/resumen-creditos', verificarToken, soloAdminOEdificio, resumenCreditosHandler);
app.get('/api/resumen-apartamento', verificarToken, soloAdminOEdificio, resumenApartamentoHandler);

// Config del edificio
app.get('/api/config-edificio', verificarToken, configEdificioHandler);
app.put('/api/config-edificio', verificarToken, soloAdminOEdificio, configEdificioHandler);

// Máquinas del edificio
app.post('/api/maquinas', verificarToken, soloAdminOEdificio, maquinasHandler);
app.delete('/api/maquinas', verificarToken, soloAdminOEdificio, maquinasHandler);

// Recursos globales — solo super-admin
app.post('/api/edificios', verificarToken, soloAdmin, edificiosHandler);
app.delete('/api/edificios', verificarToken, soloAdmin, edificiosHandler);
app.post('/api/unidades', verificarToken, soloAdminOEdificio, unidadesHandler);
app.patch('/api/unidades', verificarToken, soloAdminOEdificio, unidadesHandler);
app.delete('/api/unidades', verificarToken, soloAdminOEdificio, unidadesHandler);
app.post('/api/tips', verificarToken, soloAdmin, tipsHandler);
app.delete('/api/tips', verificarToken, soloAdmin, tipsHandler);

// Dispositivos (máquinas BLE) — admin_edificio puede ver los suyos
app.get('/api/dispositivos', verificarToken, soloAdminOEdificio, dispositivosHandler);
app.post('/api/dispositivos', verificarToken, soloAdminOEdificio, dispositivosHandler);
app.patch('/api/dispositivos', verificarToken, soloAdminOEdificio, dispositivosHandler);
app.delete('/api/dispositivos', verificarToken, soloAdminOEdificio, dispositivosHandler);

// Rutas apartamento (titular/miembros)
app.get('/api/apartamento/miembros', verificarToken, apartamentoHandler);
app.post('/api/apartamento/aprobar', verificarToken, apartamentoHandler);
app.post('/api/apartamento/rechazar', verificarToken, apartamentoHandler);
app.post('/api/apartamento/transferir-titularidad', verificarToken, apartamentoHandler);

// Cambio de inquilino (admin / admin_edificio)
app.post('/api/apartamento/cerrar-inquilino', verificarToken, cambioInquilinoHandler);
app.post('/api/apartamento/confirmar-titular', verificarToken, cambioInquilinoHandler);
app.get('/api/apartamento/ocupaciones', verificarToken, cambioInquilinoHandler);

// Facturación (admin / admin_edificio)
app.get('/api/facturacion', verificarToken, facturacionHandler);
app.get('/api/facturacion/aptos/mios', verificarToken, facturacionHandler);
app.post('/api/facturacion/generar', verificarToken, facturacionHandler);

// Cron (protegido por CRON_SECRET, no por JWT)
app.get('/api/cron/asignacion-mensual', cronAsignacionHandler);
app.get('/api/cron/facturacion-mensual', cronFacturacionHandler);

// Vercel: exportar el app como serverless function
module.exports = app;

// Dev local: levantar servidor solo si se ejecuta directo
if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✓ API corriendo en http://localhost:${PORT}`);
    console.log(`  POST http://localhost:${PORT}/api/uso`);
    console.log(`  GET  http://localhost:${PORT}/api/usos`);
    console.log(`  GET  http://localhost:${PORT}/api/resumen?edificioId=X&mes=4&anio=2026`);
    console.log(`  GET  http://localhost:${PORT}/api/maquinas?edificioId=X`);
  });
}
