// src/components/home/CategoryIcons.jsx
import { useNavigate } from "react-router-dom";

const categories = [
  { name: "Mujer", image: "/img/categories/woman.jpg" },
  { name: "Mascotas", image: "/img/categories/curve.jpg" },
  { name: "Niños", image: "/img/categories/kids.jpg" },
  { name: "Hombre", image: "/img/categories/men.jpg" },
  { name: "Bebes", image: "/img/categories/dresses.jpg" },
  { name: "Escolar y Oficina", image: "/img/categories/tops.jpg" },
  { name: "vehiculos y Herramientas", image: "/img/categories/beach.jpg" },
  { name: "Hogar y Cocina", image: "/img/categories/home.jpg" },
  { name: "Belleza y Salud", image: "/img/categories/beauty.jpg" },
  { name: "Ropa Interior y De Dormir", image: "/img/categories/underwear.jpg" },
  { name: "Deportes y Aire Libre", image: "/img/categories/sport.jpg" },
  { name: "Zapatos y Bolsos", image: "/img/categories/shoes.jpg" },
  { name: "Accesorios y Joyería", image: "/img/categories/accessories.jpg" },
  { name: "Electrónica", image: "/img/categories/electronics.jpg" },
];

export default function CategoryIcons() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-screen-xl mx-auto py-10 px-4">
      <h2 className="text-lg font-semibold mb-6">Explora por categoría</h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-6 justify-items-center">
        {categories.map((cat, i) => (
          <button
            key={i}
            className="flex flex-col items-center text-sm hover:scale-105 transition"
            onClick={() => navigate(`/products?category=${cat.name}`)}
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-100 border shadow">
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="mt-2 text-gray-700 text-xs text-center">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
