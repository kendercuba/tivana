# 🌐 Tivana Frontend

This is the professional frontend of the **Tivana** platform, built with:

- ⚡ Vite + React
- 🎨 Tailwind CSS (v3.3.5)
- ⚙️ PostCSS
- 🔎 ESLint + clean file structure
- 🌍 Environment variables for backend integration

---

## 📁 Project Structure

frontend/
├── node_modules/ # (Git ignored)
├── public/
│ ├── images/ # Static assets (carousel, etc.)
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
├── .env.example # Environment variable template
├── .gitignore # Git ignore list
├── eslint.config.js # ESLint configuration
├── index.html # Vite root HTML file
├── package.json # NPM dependencies and scripts
├── package-lock.json # Dependency lock file
├── postcss.config.mjs # PostCSS configuration
├── tailwind.config.mjs # Tailwind CSS configuration
├── vite.config.js # Vite configuration
└── README.en.md # English documentation


---

## 🚀 Available Scripts

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm install`     | Installs all dependencies                |
| `npm run dev`     | Runs the project in development mode     |
| `npm run build`   | Creates production-ready build           |
| `npm run preview` | Previews the production build locally    |

---

## 🌐 Environment Variables

Create a `.env` file based on `.env.example`:

```bash
VITE_API_URL=https://tivana-backend.onrender.com

> 🇺🇸 [View this README in English](./README.en.md)
