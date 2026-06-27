import { defineConfig } from 'vite';

// O app real fica em docs/ (mesma pasta publicada no GitHub Pages).
// Por isso apontamos a raiz do Vite para lá: 'npm run dev' serve docs/index.html.
export default defineConfig({
  root: 'docs',
  server: {
    port: 5500,
    open: true,      // abre o navegador automaticamente
    strictPort: false // se 5500 estiver ocupada, tenta a próxima
  }
});
