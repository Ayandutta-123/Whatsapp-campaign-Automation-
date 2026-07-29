import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const clientEnv = loadEnv(mode, __dirname, '');
  const apiPort = rootEnv.PORT || '3001';
  const devProxy = rootEnv.DEV_API_PROXY || `http://127.0.0.1:${apiPort}`;

  // Accepted from the shell (Docker build arg), client/.env, or the root .env so
  // on-prem deploys can point the UI at another API host without code changes.
  const apiBaseUrl = (
    [
      process.env.VITE_API_BASE_URL,
      clientEnv.VITE_API_BASE_URL,
      rootEnv.VITE_API_BASE_URL,
    ].find((value) => value?.trim()) || ''
  )
    .trim()
    .replace(/\/+$/, '');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
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
