import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Same-origin API: the browser only ever calls /v1 on its own origin so the
// __Host-fancy_session cookie and CSRF header work. In dev, Vite proxies /v1 to
// the local API (FANCY_API_ORIGIN, default http://127.0.0.1:3000); production
// serves the built assets behind the same origin as the API.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FANCY_');
  const apiOrigin = env.FANCY_API_ORIGIN ?? 'http://127.0.0.1:3000';
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      proxy: { '/v1': { target: apiOrigin, changeOrigin: false } },
    },
    build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
  };
});
