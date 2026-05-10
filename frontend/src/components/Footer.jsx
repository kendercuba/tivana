// src/components/Footer.jsx
import React from "react";

export default function Footer() {
  return (
    <footer className="bg-gray-100 text-sm text-gray-600 border-t mt-10">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Tienda</h3>
          <ul>
            <li><a href="#" className="hover:underline">Ofertas</a></li>
            <li><a href="#" className="hover:underline">Novedades</a></li>
            <li><a href="#" className="hover:underline">Populares</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Categorías</h3>
          <ul>
            <li><a href="#" className="hover:underline">Ropa</a></li>
            <li><a href="#" className="hover:underline">Electrónica</a></li>
            <li><a href="#" className="hover:underline">Belleza</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Soporte</h3>
          <ul>
            <li><a href="#" className="hover:underline">Ayuda</a></li>
            <li><a href="#" className="hover:underline">Centro de atención</a></li>
            <li><a href="#" className="hover:underline">Política de devoluciones</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Empresa</h3>
          <ul>
            <li><a href="#" className="hover:underline">Sobre nosotros</a></li>
            <li><a href="#" className="hover:underline">Trabaja con nosotros</a></li>
            <li><a href="#" className="hover:underline">Afiliados</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Legal</h3>
          <ul>
            <li><a href="#" className="hover:underline">Términos</a></li>
            <li><a href="#" className="hover:underline">Privacidad</a></li>
            <li><a href="#" className="hover:underline">Cookies</a></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Síguenos</h3>
          <ul>
            <li><a href="#" className="hover:underline">Facebook</a></li>
            <li><a href="#" className="hover:underline">Instagram</a></li>
            <li><a href="#" className="hover:underline">WhatsApp</a></li>
          </ul>
        </div>
      </div>

      <div className="text-center py-4 text-xs text-gray-500 border-t mt-4">
        © {new Date().getFullYear()} Tivana. Todos los derechos reservados.
      </div>
    </footer>
  );
}
