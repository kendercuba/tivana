import { useParams } from 'react-router-dom';
import { useEffect, useState, useContext } from 'react';
import { UserContext } from '../context/UserContext'; // ✅ Para usar refreshCart

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState('');
  const [message, setMessage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1); // ✅ Cantidad seleccionada
  const { user, refreshCart } = useContext(UserContext); // ✅ Contexto del usuario

  // 🔁 Cargar el producto al montar
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/products/${id}`)
      .then(async res => {
        if (!res.ok) throw new Error('❌ Producto no encontrado o error del servidor');
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          setProduct(json);
          setMainImage(json.image);
        } catch (e) {
          throw new Error('❌ La respuesta del backend no es un JSON válido');
        }
      })
      .catch(err => {
        console.error('❌ Error al cargar producto:', err.message);
        setProduct(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // 🧠 Agregar al carrito
  const agregarAlCarrito = async () => {
    // ⚠️ Validación más estricta de talla seleccionada
    if (!selectedSize) {
      setMessage('⚠️ Por favor selecciona una talla');
      return;
    }

    const item = {
      id: product.id, // ✅ usar 'id' directamente, no 'product_id'
      quantity,
      size: selectedSize
    };

    // ✅ Bloque para enviar los productos con el checkbox marcado al carrito
    const newKey = `${product.id}-${selectedSize}`;
    const selected = JSON.parse(localStorage.getItem('selected_items') || '[]');
    if (!selected.includes(newKey)) {
      localStorage.setItem('selected_items', JSON.stringify([...selected, newKey]));
    }

   // 🧑‍💻 Modo Invitado (no hay sesión activa)
if (!user) {
  const cart = JSON.parse(localStorage.getItem('guest_cart') || '[]');
  const existing = cart.find(p => p.id === item.id && p.size === item.size);

  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image || (Array.isArray(product.images) ? product.images[0] : ''),
      quantity: item.quantity,
      size: selectedSize,
      selected: true, // ✅ MARCAR COMO SELECCIONADO AL AGREGAR
    });
  }

  localStorage.setItem('guest_cart', JSON.stringify(cart));

  // ✅ AGREGAR A SELECCIONADOS TAMBIÉN
  const selectedKeys = JSON.parse(localStorage.getItem('selected_items') || '[]');
  const key = `${product.id}-${selectedSize}`;
  if (!selectedKeys.includes(key)) {
    selectedKeys.push(key);
    localStorage.setItem('selected_items', JSON.stringify(selectedKeys));
  }

  await refreshCart();
  setMessage('✅ Producto agregado al carrito como invitado');
  return;
}


   // 👤 Usuario logueado (usamos cookie con credentials: 'include')
try {
  // 🔍 Resuelve el ID real del producto
  
  const realId = product.id; // ✅ Ya tienes el ID interno real
  console.log("🧪 Agregando producto con ID:", realId);
  const res = await fetch(`${import.meta.env.VITE_API_URL}/cart/add`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: realId, // ✅ este es el ID de PostgreSQL
      quantity,           // ✅ tu variable existente
      size: selectedSize, // ✅ tu variable existente
    }),
  });

  const result = await res.json();

  if (res.ok && result.message) {
  await refreshCart?.(); // si refreshCart está disponible

  // ✅ Marcar el producto como seleccionado para el usuario logueado
  const selectedKey = `selected_items_${user.id}`;
  const selectedKeys = JSON.parse(localStorage.getItem(selectedKey) || '[]');
  const newKey = `${product.id}-${selectedSize}`;
  if (!selectedKeys.includes(newKey)) {
    selectedKeys.push(newKey);
    localStorage.setItem(selectedKey, JSON.stringify(selectedKeys));
  }

  setMessage('✅ Producto agregado al carrito');
}
 else {
    setMessage(`❌ ${result.message || 'No se pudo agregar al carrito'}`);
  }
} catch (err) {
  console.error('❌ Error al conectar con el servidor:', err);
  setMessage('❌ Error al conectar con el servidor');
}

  }
  if (loading) return <div className="p-4">Cargando producto...</div>;
  if (!product) return <div className="p-4 text-red-600">Producto no encontrado</div>;

  // 📦 Parsear imágenes y tallas
  const images = Array.isArray(product.images) ? product.images : JSON.parse(product.images || '[]');
  const sizes = Array.isArray(product.sizes) ? product.sizes : JSON.parse(product.sizes || '[]');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="grid md:grid-cols-2 gap-6">

        {/* 🖼️ Galería de imágenes */}
        <div className="space-y-2">
          <img src={mainImage || product.images?.[0]} alt={product.title} className="w-full rounded" />
          {images.length > 0 && (
            <div className="flex gap-2 mt-2">
              {images.slice(0, 5).map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`vista-${i}`}
                  onClick={() => setMainImage(img)}
                  className="w-20 h-20 object-cover rounded cursor-pointer border hover:border-blue-600"
                />
              ))}
            </div>
          )}
        </div>

        {/* 📋 Detalles del producto */}
        <div>
          <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
          <p className="text-xl text-blue-600 font-semibold mb-4">${product.price?.toFixed(2)}</p>
          <p className="text-sm text-gray-700 whitespace-pre-line mb-4">{product.description}</p>

          {/* 🎯 Selector de talla */}
          {sizes.length > 0 && (
            <div className="mb-4">
              <h2 className="font-semibold mb-1">Selecciona una talla:</h2>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-48"
              >
                <option value="">Selecciona una talla...</option>
                {sizes.map((size, i) => {
                  const val = typeof size === 'string' ? size : size.value;
                  return (
                    <option key={i} value={val}>
                      {val}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* 🔢 Selector de cantidad */}
          <div className="mb-4">
            <label className="font-semibold block mb-1">Cantidad:</label>
            <input
              type="number"
              value={quantity}
              min={1}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value)))}
              className="border rounded px-3 py-2 text-sm w-24"
            />
          </div>

          {/* 🛒 Botón agregar al carrito */}
          <button
            onClick={agregarAlCarrito}
            className="inline-block mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Agregar al carrito
          </button>

          {/* 📢 Mensaje de estado */}
          {message && <p className="mt-2 text-sm text-center text-gray-700">{message}</p>}
        </div>
      </div>
    </div>
  );
}
