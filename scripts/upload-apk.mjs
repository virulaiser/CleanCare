import { put } from '@vercel/blob';
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) { console.error('Falta BLOB_READ_WRITE_TOKEN'); process.exit(1); }

const apkPath = process.argv[2];
const remoteName = process.argv[3];
if (!apkPath || !remoteName) {
  console.error('Uso: node scripts/upload-apk.mjs <local-apk> <remote-name>');
  process.exit(1);
}

const data = fs.readFileSync(path.resolve(apkPath));
console.log(`Subiendo ${apkPath} (${(data.length / 1024 / 1024).toFixed(1)} MB) como ${remoteName}...`);

const { url } = await put(remoteName, data, {
  access: 'public',
  token: TOKEN,
  contentType: 'application/vnd.android.package-archive',
  addRandomSuffix: true,
});

console.log('URL:', url);
