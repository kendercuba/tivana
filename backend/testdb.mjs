import { pool } from './db.mjs';

try {
  const res = await pool.query('SELECT * FROM products LIMIT 5');
  console.log('✅ Conexión exitosa. Productos encontrados:');
  console.log(res.rows);
} catch (err) {
  console.error('❌ Error al conectar a la base de datos:', err);
} finally {
  pool.end(); // cerrar conexión
}
