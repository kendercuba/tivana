// src/pages/Register.jsx
import { useState } from 'react';

function Register() {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '' });
  const [mensaje, setMensaje] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setMensaje('✅ Registro exitoso. Ahora puedes iniciar sesión.');
        setForm({ nombre: '', apellido: '', email: '', password: '' });
      } else {
        setMensaje(`❌ ${data.message}`);
      }
    } catch (error) {
      setMensaje('❌ Error en el servidor');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Crear cuenta</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input name="nombre" placeholder="Nombre" className="w-full border px-3 py-2" onChange={handleChange} value={form.nombre} required />
        <input name="apellido" placeholder="Apellido" className="w-full border px-3 py-2" onChange={handleChange} value={form.apellido} required />
        <input name="email" type="email" placeholder="Correo" className="w-full border px-3 py-2" onChange={handleChange} value={form.email} required />
        <input name="password" type="password" placeholder="Contraseña" className="w-full border px-3 py-2" onChange={handleChange} value={form.password} required />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 w-full">Registrarse</button>
      </form>
      {mensaje && <p className="mt-4 text-center">{mensaje}</p>}
    </div>
  );
}

export default Register;
