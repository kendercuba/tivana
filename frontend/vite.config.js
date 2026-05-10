import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/', // 👈 Esto asegura que las rutas sean relativas al dominio raíz
  plugins: [react()],
  server: {
    proxy: proxyApi(),
  },
  // `vite preview` no hereda siempre el proxy del server; duplicamos por si pruebas build local.
  preview: {
    proxy: proxyApi(),
  },
});

function proxyApi() {
  return {
    '/api': {
      target: 'http://127.0.0.1:3002',
      changeOrigin: true,
    },
  };
}
