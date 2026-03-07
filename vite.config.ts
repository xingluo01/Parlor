import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'

// Plugin to start the REST API server
function startApiServer() {
  return {
    name: 'start-api-server',
    configureServer() {
      const server = spawn('node', ['server.cjs'], {
        stdio: 'inherit',
        shell: true
      })
      
      server.on('error', (err) => {
        console.error('Failed to start API server:', err)
      })
      
      process.on('exit', () => {
        server.kill()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), startApiServer()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
