import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 127.0.0.1:5174 is the origin the API allows for credentialed CORS and uses in email links.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
