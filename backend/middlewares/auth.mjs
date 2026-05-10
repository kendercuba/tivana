// backend/middlewares/auth.mjs
import jwt from 'jsonwebtoken';

export function verifyToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    console.warn('❌ Token no proporcionado (cookie)');
    return res.status(401).json({ message: '⚠️ Token no proporcionado (cookie)' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // 🧠 DEBUG: imprime lo que viene en el token
    console.log('🔐 Token decodificado:', payload);

    // ✅ Normaliza para asegurar que siempre sea "userId"
    req.user = {
      userId: payload.userId || payload.id || payload.uid, // fallback si es diferente
    };

    next();
  } catch (err) {
    console.error('❌ Error al verificar token:', err);
    return res.status(403).json({ message: '⚠️ Token inválido o expirado' });
  }
}
