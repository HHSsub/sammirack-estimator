import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // GitHub 저장소 이름과 반드시 일치해야 합니다.
  base: '/sammirack-estimator/', 
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})