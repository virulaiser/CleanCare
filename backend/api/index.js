const express = require('express');
const cors = require('cors');

const usoHandler = require('./uso');
const usosHandler = require('./usos');
const resumenHandler = require('./resumen');
const maquinasHandler = require('./maquinas');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas
app.post('/api/uso', usoHandler);
app.get('/api/usos', usosHandler);
app.get('/api/resumen', resumenHandler);
app.get('/api/maquinas', maquinasHandler);

// Health check
app.get('/api', (req, res) => {
  res.json({ ok: true, service: 'CleanCare API', version: '1.0.0' });
});

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
