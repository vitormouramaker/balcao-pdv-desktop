import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Previne que o Vite limpe a tela do terminal, permitindo que você
  // veja os logs do Tauri.
  clearScreen: false,

  // Configuração do Servidor de Desenvolvimento
  server: {
    // Define a porta explicitamente. Use a mesma porta que o Vite já escolheu.
    port: 1420,
    // Força o Vite a encerrar se a porta já estiver em uso, em vez de
    // tentar uma porta diferente.
    strictPort: true,
  },

  // Configuração específica para o Tauri
  envPrefix: ['VITE_', 'TAURI_'],
})