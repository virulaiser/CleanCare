const express = require('express');
const cors = require('cors');
const { verificarToken, soloAdmin } = require('../lib/auth');

const authHandler = require('./auth');
const usoHandler = require('./uso');
const usosHandler = require('./usos');
const resumenHandler = require('./resumen');
const maquinasHandler = require('./maquinas');
const billeteraHandler = require('./billetera');
const configEdificioHandler = require('./config-edificio');
const resumenCreditosHandler = require('./resumen-creditos');
const cronAsignacionHandler = require('./cron-asignacion');
const usuariosHandler = require('./usuarios');
const edificiosHandler = require('./edificios');
const tipsHandler = require('./tips');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas públicas
app.get('/api', (req, res) => {
  res.json({ ok: true, service: 'CleanCare API', version: '1.0.0' });
});
app.post('/api/auth', authHandler);
app.get('/api/edificios', edificiosHandler);
app.get('/api/tips', tipsHandler);

// Rutas protegidas (requieren token)
app.post('/api/uso', verificarToken, usoHandler);
app.patch('/api/uso', verificarToken, usoHandler);
app.get('/api/usos', verificarToken, usosHandler);
app.get('/api/maquinas', verificarToken, maquinasHandler);

// Rutas billetera (protegidas)
app.get('/api/billetera', verificarToken, billeteraHandler);
app.post('/api/billetera/creditos', verificarToken, soloAdmin, billeteraHandler);
app.post('/api/billetera/creditos-masivo', verificarToken, soloAdmin, billeteraHandler);

// Rutas solo admin
app.get('/api/usuarios', verificarToken, soloAdmin, usuariosHandler);
app.post('/api/usuarios', verificarToken, soloAdmin, usuariosHandler);
app.patch('/api/usuarios', verificarToken, soloAdmin, usuariosHandler);
app.delete('/api/usuarios', verificarToken, soloAdmin, usuariosHandler);
app.get('/api/resumen', verificarToken, soloAdmin, resumenHandler);
app.get('/api/resumen-creditos', verificarToken, soloAdmin, resumenCreditosHandler);
app.get('/api/config-edificio', verificarToken, soloAdmin, configEdificioHandler);
app.put('/api/config-edificio', verificarToken, soloAdmin, configEdificioHandler);
app.post('/api/maquinas', verificarToken, soloAdmin, maquinasHandler);
app.delete('/api/maquinas', verificarToken, soloAdmin, maquinasHandler);
app.post('/api/edificios', verificarToken, soloAdmin, edificiosHandler);
app.delete('/api/edificios', verificarToken, soloAdmin, edificiosHandler);
app.post('/api/tips', verificarToken, soloAdmin, tipsHandler);
app.delete('/api/tips', verificarToken, soloAdmin, tipsHandler);

// Cron (protegido por CRON_SECRET, no por JWT)
app.get('/api/cron/asignacion-mensual', cronAsignacionHandler);

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
