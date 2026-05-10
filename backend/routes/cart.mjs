// backend/routes/cart.mjs
import express from 'express';
import { pool } from '../db.mjs';
import { verifyToken } from '../middlewares/auth.mjs';

const router = express.Router();


// ✅ Verifica si el producto existe por ID en la base de datos
async function verificarProductoExiste(product_id) {
  const result = await pool.query('SELECT 1 FROM products WHERE id = $1', [product_id]);
  return result.rowCount > 0;
}

// ✅ Agregar producto al carrito
router.post('/add', verifyToken, async (req, res) => {
  const { id, quantity, size } = req.body;
  const product_id = id;
  const user_id = parseInt(req.user.userId, 10);

  try {
    // ✅ Verificación antes de insertar
    if (!(await verificarProductoExiste(product_id))) {
      return res.status(404).json({ message: '❌ El producto no existe en la base de datos' });
    }

    const existing = await pool.query(
      'SELECT * FROM cart WHERE user_id = $1 AND product_id = $2 AND size = $3',
      [user_id, product_id, size]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE cart SET quantity = quantity + $1 WHERE user_id = $2 AND product_id = $3 AND size = $4',
        [quantity, user_id, product_id, size]
      );
    } else {
      await pool.query(
        'INSERT INTO cart (user_id, product_id, quantity, size) VALUES ($1, $2, $3, $4)',
        [user_id, product_id, quantity, size]
      );
    }

    res.status(200).json({ message: '✅ Producto agregado al carrito' });
  } catch (err) {
    console.error('❌ Error agregando al carrito:', err);
    res.status(500).json({ message: '❌ No se pudo agregar al carrito' });
  }
});


// ✅ Obtener carrito del usuario actual (ordenado por ID)
router.get('/', verifyToken, async (req, res) => {
  const user_id = parseInt(req.user.userId, 10);
  console.log('📦 user_id:', user_id, '| Tipo:', typeof user_id); // debug

  try {
    const result = await pool.query(
  `SELECT c.id AS cart_id, c.quantity, c.size, p.id AS id, p.title, p.price, p.images, p.sizes FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = $1 ORDER BY c.id ASC`,
  [user_id]
);

    console.log('🛒 Productos obtenidos del carrito:', result.rows); // 👈 Añade esta línea
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching cart:', err);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

// ✅ Actualizar cantidad
router.put('/update', verifyToken, async (req, res) => {
 const { id, action, size } = req.body;
 const product_id = id; // 👈 para mantener el resto del código sin cambios
 const user_id = parseInt(req.user.userId, 10);

  try {
    const existing = await pool.query(
      'SELECT quantity FROM cart WHERE user_id = $1 AND product_id = $2 AND size = $3',
      [user_id, product_id, size]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'Producto no está en el carrito' });
    }

    let newQty = existing.rows[0].quantity;
    if (action === 'increment') newQty += 1;
    if (action === 'decrement') newQty = Math.max(1, newQty - 1);

    await pool.query(
      'UPDATE cart SET quantity = $1 WHERE user_id = $2 AND product_id = $3 AND size = $4',
      [newQty, user_id, product_id, size]
    );

    res.json({ message: '✅ Cantidad actualizada' });
  } catch (err) {
    console.error('❌ Error actualizando cantidad:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ✅ Eliminar producto del carrito
router.delete('/delete/:product_id/:size', verifyToken, async (req, res) => {
  const { product_id, size } = req.params;
  const user_id = parseInt(req.user.userId, 10);

  try {
    await pool.query(
      'DELETE FROM cart WHERE user_id = $1 AND product_id = $2 AND size = $3',
      [user_id, product_id, size]
    );

    res.json({ message: '✅ Producto eliminado del carrito' });
  } catch (err) {
    console.error('❌ Error eliminando producto:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ✅ Fusionar carrito invitado con logueado
router.post('/merge', verifyToken, async (req, res) => {
  const { items } = req.body;
  const user_id = parseInt(req.user.userId, 10);

  if (!Array.isArray(items)) {
    return res.status(400).json({ message: '❌ Formato inválido' });
  }

  try {
    for (const item of items) {
      const { id: product_id, quantity, size } = item;

      const existing = await pool.query(
        'SELECT quantity FROM cart WHERE user_id = $1 AND product_id = $2 AND size = $3',
        [user_id, product_id, size]
      );

      if (existing.rowCount > 0) {
        const newQty = existing.rows[0].quantity + quantity;
        await pool.query(
          'UPDATE cart SET quantity = $1 WHERE user_id = $2 AND product_id = $3 AND size = $4',
          [newQty, user_id, product_id, size]
        );
      } else {
        await pool.query(
          'INSERT INTO cart (user_id, product_id, quantity, size) VALUES ($1, $2, $3, $4)',
          [user_id, product_id, quantity, size]
        );
      }
    }

    res.status(200).json({ message: '✅ Carrito fusionado exitosamente' });
  } catch (err) {
    console.error('❌ Error fusionando carrito:', err);
    res.status(500).json({ message: '❌ Error del servidor' });
  }
});


export default router;
