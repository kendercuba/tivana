import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// ===============================
// Routers
// ===============================
import productsRouter from "./routes/products.mjs";
import usersRouter from "./routes/users.mjs";
import cartRouter from "./routes/cart.mjs";
import adminRoutes from "./routes/admin.mjs";
import categoriesRoutes from "./routes/categories.mjs";
import subcategoriesRoutes from "./routes/subcategories.mjs";
import subsubcategoriesRoutes from "./routes/subsubcategories.mjs";
import orderRoutes from "./routes/orders.mjs";
import savedRoutes from "./routes/saved.mjs";
import financeRoutes from "./routes/finance/index.mjs";

// 🔥 NUEVO ROUTER MODULAR DE IMPORT
import importRouter from "./routes/import/index.mjs";

const app = express();

// ===============================
// Trust proxy (producción)
// ===============================
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const PORT = process.env.PORT || 3002;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// CORS
// ===============================
const whitelist = [
  "http://localhost:5173",
  "https://tivana.me",
  "https://www.tivana.me",
  "https://api.tivana.me",
  // Dominio alternativo (producción)
  "https://tivana.mo",
  "http://tivana.mo",
  "https://www.tivana.mo",
];

/** Orígenes extra: en el servidor define CORS_ORIGINS=https://midominio.com,https://otro.com */
const extraOrigins =
  process.env.CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
const allowedOrigins = new Set([...whitelist, ...extraOrigins]);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    console.log("❌ Origin bloqueado por CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

// ===============================
// Middlewares
// ===============================
app.use(cookieParser());
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// ===============================
// 🔥 ORDEN CORRECTO DE RUTAS API
// ===============================

// 🔴 IMPORT SIEMPRE PRIMERO (rutas específicas)
app.use("/api/import", importRouter);

// Rutas admin y dominio
app.use("/api/admin/categories", categoriesRoutes);
app.use("/api/admin/subcategories", subcategoriesRoutes);
app.use("/api/admin/subsubcategories", subsubcategoriesRoutes);

app.use("/api/admin", adminRoutes);

// Rutas negocio
app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", orderRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/finance", financeRoutes);

// 🔴 usersRouter SIEMPRE AL FINAL (es genérico /api/*)
app.use("/api", usersRouter);



// ===============================
// Ruta de prueba
// ===============================
app.get("/prueba", (req, res) => {
  res.send("✅ Express responde desde /prueba");
});

// ===============================
// Frontend estático
// ===============================
app.use(express.static(path.join(__dirname, "dist")));

// Fallback SPA
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ===============================
// Iniciar servidor
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor backend corriendo en http://0.0.0.0:${PORT}`);
});
