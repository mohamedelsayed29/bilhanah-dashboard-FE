import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 127.0.0.1:5174 is the origin the API allows for credentialed CORS and uses in email links.
export default defineConfig(({ command, mode }) => {
  // A production bundle without an API URL would call 127.0.0.1 from owners' browsers.
  if (command === 'build' && mode === 'production' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL) {
    throw new Error('Set VITE_API_URL (e.g. https://api.bilhanah.com) to build for production.');
  }
  return {
    plugins: [react()],
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
    preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  };
});
