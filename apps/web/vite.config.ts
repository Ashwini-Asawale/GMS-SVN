import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/users': { target: 'http://localhost:3001', changeOrigin: true },
      '/groups': { target: 'http://localhost:3001', changeOrigin: true },
      '/repositories': { target: 'http://localhost:3001', changeOrigin: true },
      '/dashboard': { target: 'http://localhost:3001', changeOrigin: true },
      '/settings': { target: 'http://localhost:3001', changeOrigin: true },
      '/health': { target: 'http://localhost:3001', changeOrigin: true },
      '/agent': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
