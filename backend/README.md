# Tivana Backend

Este es el proyecto backend de **Tivana**, desarrollado en **Node.js + Express + PostgreSQL**.

## Características
- API RESTful
- Gestión de usuarios, productos y pedidos
- Carrito con soporte para usuarios e invitados
- Integración con Elasticsearch

## Instalación

```bash
npm install
node index.mjs
```

## Variables de entorno

Configura un archivo `.env` con:

```env
PORT=3002
JWT_SECRET=tu_clave_secreta
DATABASE_URL=postgresql://usuario:clave@localhost:5432/tivana
```

---

Desarrollado por Kender Cuba
