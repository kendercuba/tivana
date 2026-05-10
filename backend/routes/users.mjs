// 🔁 Prueba de deploy automático
// routes/users.mjs
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.mjs';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
console.log('👤 users.mjs cargado correctamente');

// 🚀 Registro de usuario
router.post('/register', async (req, res) => {
  console.log('📩 POST /api/register recibido');

  const { nombre, apellido, email, password } = req.body;

  // ⬇️ Agrega este console.log aquí
  console.log("🧾 Recibido desde frontend:", { nombre, apellido, email });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
  'INSERT INTO users (first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, first_name AS nombre, last_name AS apellido, email',
  [nombre, apellido, email, hashedPassword]
);


    res.status(201).json({ message: 'Usuario registrado', user: result.rows[0] });
  } catch (err) {
    console.error('❌ Error al registrar:', err);
    res.status(500).json({ message: 'Error al registrar', error: err.message });
  }
});

// 🔐 Login de usuario
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Email no encontrado' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  console.log("🟢 Enviando cookie con token:", token);
   res
  .cookie('token', token, {
    httpOnly: true,
    sameSite: 'None',
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  })
  .json({
    user: {
      id: user.id,
      nombre: user.first_name,
      apellido: user.last_name,
      email: user.email,
    },
  });
  
  } catch (err) {
    console.error('❌ Error en el login:', err);
    res.status(500).json({ message: 'Error en el login', error: err.message });
  }
});


// Middleware para verificar token JWT
function verificarToken(req, res, next) {
  
  const token = req.cookies.token;

if (!token) {
  return res.status(401).json({ message: 'Token no enviado' });
}


  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId: ... }
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
}

// ✅ Ruta protegida /api/account
router.get('/account', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, first_name AS nombre, email FROM users WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({ user });
  } catch (err) {
    console.error('❌ Error en /account:', err);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

// 🔧 Actualizar nombre y apellido del usuario autenticado
router.patch('/account/update', verificarToken, async (req, res) => {
  const userId = req.user.userId;
  const { nombre, apellido } = req.body;

  if (!nombre || !apellido) {
    return res.status(400).json({ message: 'Nombre y apellido son requeridos' });
  }

  try {
    await pool.query(
      'UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3',
      [nombre, apellido, userId]
    );

    res.json({ message: 'Perfil actualizado correctamente' });
  } catch (err) {
    console.error('❌ Error actualizando perfil:', err);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
});

// 🚪 Cerrar sesión y borrar la cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
  httpOnly: true,
  secure: true,
  sameSite: 'None',
});

  res.json({ message: 'Sesión cerrada correctamente' });
});


export default router;
