// src/pages/Login.jsx
import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../context/UserContext';

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(UserContext);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });

      const data = await res.json();
      console.log("🔐 Login response:", data);

      if (res.ok && data.user) {
        login(data.user);
        setMensaje(`✅ Bienvenido ${data.user.nombre}`);

        // 🛒 MERGE del carrito
        const rawCart = localStorage.getItem('guest_cart');
        let guestCart = [];

        try {
          const parsed = JSON.parse(rawCart);
          if (Array.isArray(parsed)) guestCart = parsed;
        } catch (e) {
          console.warn('⚠️ guest_cart no es un JSON válido:', e);
        }

        if (guestCart.length > 0) {
          try {
            await fetch(`${import.meta.env.VITE_API_URL}/cart/merge`, {
              method: 'POST',
              body: JSON.stringify({ items: guestCart }),
              credentials: 'include',
            });
            localStorage.removeItem('guest_cart');
            console.log('🛒 Carrito fusionado exitosamente');
          } catch (mergeError) {
            console.error('❌ Error al fusionar carrito:', mergeError);
          }
        }

        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        setMensaje(`❌ ${data.message}`);
      }
    } catch (error) {
      setMensaje('❌ Error en el servidor');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Iniciar sesión</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="email"
          type="email"
          placeholder="Correo"
          className="w-full border px-3 py-2"
          onChange={handleChange}
          value={form.email}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          className="w-full border px-3 py-2"
          onChange={handleChange}
          value={form.password}
          required
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 w-full"
        >
          Ingresar
        </button>
      </form>
      {mensaje && <p className="mt-4 text-center">{mensaje}</p>}
    </div>
  );
}

export default Login;
