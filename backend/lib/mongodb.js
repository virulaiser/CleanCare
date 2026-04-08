const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI no definida en .env');

  await mongoose.connect(uri, { dbName: 'cleancare' });
  isConnected = true;
  console.log('✓ MongoDB conectado OK');
}

module.exports = connectDB;
