import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// В режиме разработки API живёт на отдельном Node-сервере (server/server.mjs).
const API_PORT = Number(process.env.AETHER_PORT || 8790);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: { '/api': `http://127.0.0.1:${API_PORT}` },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
