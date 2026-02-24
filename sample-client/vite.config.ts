import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tokenProxyPlugin } from './src/server/token-proxy';

export default defineConfig({
  plugins: [react(), tokenProxyPlugin()],
  server: {
    port: 3001, // Different port from login-ui (3000)
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
