import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

// En ESM (ECMAScript Modules), __dirname no está definido por defecto.
// Estas líneas lo emulan para que path.resolve funcione correctamente.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno basadas en el 'mode' (development, production, etc.)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      // Expone la variable al frontend
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        // Establece '@' como alias para la raíz o la carpeta 'src'
        '@': path.resolve(__dirname, './src'), 
      },
    },
    server: {
      // Mantiene la lógica para deshabilitar HMR si la variable existe
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
