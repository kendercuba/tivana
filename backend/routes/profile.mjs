import express from 'express';
import { pool } from '../db.mjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// 🛡️ Middleware para autenticar al usuario
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token not provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
}

router.use(verifyToken);

// ============================
// 📦 DIRECCIONES
// ============================

// Obtener direcciones del usuario
router.get('/addresses', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching addresses' });
  }
});

// Crear nueva dirección
router.post('/addresses', async (req, res) => {
  const { full_name, address_line, city, state, postal_code, country } = req.body;

  try {
    await pool.query(
      `INSERT INTO addresses (user_id, full_name, address_line, city, state, postal_code, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user.id, full_name, address_line, city, state, postal_code, country]
    );
    res.json({ message: 'Dirección guardada' });
  } catch (err) {
    res.status(500).json({ message: 'Error al guardar dirección' });
  }
});

// ============================
// 💳 MÉTODOS DE PAGO
// ============================

// Obtener métodos de pago
router.get('/payment-methods', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_methods WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payment methods' });
  }
});

// Crear nuevo método de pago
router.post('/payment-methods', async (req, res) => {
  const { cardholder_name, card_last4, expiry_month, expiry_year, brand } = req.body;

  try {
    await pool.query(
      `INSERT INTO payment_methods (user_id, cardholder_name, card_last4, expiry_month, expiry_year, brand)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, cardholder_name, card_last4, expiry_month, expiry_year, brand]
    );
    res.json({ message: 'Método de pago guardado' });
  } catch (err) {
    res.status(500).json({ message: 'Error al guardar método de pago' });
  }
});

export default router;
