const express = require('express');
const cors = require('cors');
const { verificarToken, soloAdmin } = require('../lib/auth');

const authHandler = require('./auth');
const usoHandler = require('./uso');
const usosHandler = require('./usos');
const resumenHandler = require('./resumen');
const maquinasHandler = require('./maquinas');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas públicas
app.get('/api', (req, res) => {
  res.json({ ok: true, service: 'CleanCare API', version: '1.0.0' });
});
app.post('/api/auth', authHandler);

// Rutas protegidas (requieren token)
app.post('/api/uso', verificarToken, usoHandler);
app.patch('/api/uso', verificarToken, usoHandler);
app.get('/api/usos', verificarToken, usosHandler);
app.get('/api/maquinas', verificarToken, maquinasHandler);

// Rutas solo admin
app.get('/api/resumen', verificarToken, soloAdmin, resumenHandler);
app.post('/api/maquinas', verificarToken, soloAdmin, maquinasHandler);
app.delete('/api/maquinas', verificarToken, soloAdmin, maquinasHandler);

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
