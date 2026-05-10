// routes/orders.mjs
import express from 'express';
import { pool } from '../db.mjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware para verificar token
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token not provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
}

// POST /api/orders/create
router.post('/create', verifyToken, async (req, res) => {
  const { items, total_amount } = req.body;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      "INSERT INTO orders (user_id, total_amount) VALUES ($1, $2) RETURNING id",
      [userId, total_amount]
    );

    const orderId = result.rows[0].id;

    for (const item of items) {
      const product = await client.query("SELECT price FROM products WHERE id = $1", [item.product_id]);

      await client.query(
        "INSERT INTO order_items (order_id, product_id, quantity, size, price) VALUES ($1, $2, $3, $4, $5)",
        [orderId, item.product_id, item.quantity, item.size, product.rows[0].price]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, orderId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al crear orden:", err);
    res.status(500).json({ success: false, message: "Error al procesar orden" });
  } finally {
    client.release();
  }
});

export default router;
