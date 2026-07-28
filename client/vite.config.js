import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const apiPort = rootEnv.PORT || '3001';
  const devProxy = rootEnv.DEV_API_PROXY || `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': devProxy,
        '/webhook': devProxy,
        '/uploads': devProxy,
      },
    },
  };
});
