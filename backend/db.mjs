// backend/db.mjs

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 🛠 Cargar .env desde la carpeta backend explícitamente
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

import pg from 'pg';
const { types } = pg;

// ✅ Parsea automáticamente columnas tipo text[] (como images, sizes)
types.setTypeParser(1009, (val) => val.slice(1, -1).split(','));

console.log("🌍 Modo actual:", process.env.NODE_ENV);
console.log("📦 Host:", process.env.DB_HOST);
console.log("🔑 Password:", process.env.DB_PASSWORD); // SOLO para debug

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export { pool };
