> 🇺🇸 [View this README in English](./README.en.md)

# 🌐 Tivana Frontend

Este es el frontend profesional de la plataforma **Tivana**, construido con:

- ⚡ Vite + React
- 🎨 Tailwind CSS
- ⚙️ PostCSS
- 🔎 ESLint + Clean Structure
- 🌍 Variables de entorno para entorno backend

---

## 📁 Estructura

frontend/
├── node_modules/       # (Ignorado por Git)
├── public/
│ ├── images/           # Archivos estáticos (carrusel, etc.)
│ └── vite.svg
│
├── src/
│ ├── assets/
│ │ └── react.svg
│ ├── components/
│ │ ├── admin/
│ │ │ ├── AdminCategories.jsx
│ │ │ ├── Dashboard.jsx
│ │ │ ├── Orders.jsx
│ │ │ ├── Products.jsx
│ │ │ ├── SearchLogs.jsx
│ │ │ └── Users.jsx
│ │ ├── Carousel.jsx
│ │ ├── FloatingCards.jsx
│ │ ├── Header.jsx
│ │ └── SearchBar.jsx
│ ├── context/
│ │ └── UserContext.jsx
│ ├── data/
│ │ └── productos_tivana.json
│ ├── pages/
│ │ ├── admin/
│ │ │ ├── AdminCategories.jsx
│ │ │ ├── Dashboard.jsx
│ │ │ ├── Orders.jsx
│ │ │ ├── Products.jsx
│ │ │ ├── SearchLogs.jsx
│ │ │ └── Users.jsx
│ │ ├── me/
│ │ │ ├── Cart.jsx
│ │ │ ├── MeLayout.jsx
│ │ │ ├── Orders.jsx
│ │ │ ├── Profile.jsx
│ │ │ └── Summary.jsx
│ │ ├── Checkout.jsx
│ │ ├── Contact.jsx
│ │ ├── Home.jsx
│ │ ├── Login.jsx
│ │ ├── ProductDetail.jsx
│ │ ├── Products.jsx
│ │ └── Register.jsx
│ ├── App.jsx
│ ├── App.css
│ ├── index.css
│ └── main.jsx
│
├── .env.example            # Plantilla de variables de entorno
├── .gitignore              # Archivos ignorados por Git
├── eslint.config.js        # Configuración de ESLint
├── index.html              # HTML raíz para Vite
├── package.json            # Dependencias y scripts
├── package-lock.json       # Lockfile de dependencias
├── postcss.config.mjs      # Configuración de PostCSS
├── tailwind.config.mjs     # Configuración de Tailwind CSS
├── vite.config.js          # Configuración de Vite
└── README.md               # Documentación del proyecto

---

## 🚀 Scripts

| Comando          | Descripción                           |
|------------------|---------------------------------------|
| `npm install`    | Instala todas las dependencias        |
| `npm run dev`    | Ejecuta el proyecto en modo desarrollo |
| `npm run build`  | Genera el build de producción         |
| `npm run preview`| Previsualiza el build localmente      |

---

## 🌐 Variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
VITE_API_URL=https://tivana-backend.onrender.com