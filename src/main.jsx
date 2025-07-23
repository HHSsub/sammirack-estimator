import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'  // ✅ 바꿔줘야 함
import App from './App.jsx'
import './index.css'

console.log("✅ main.jsx 시작됨"); // 이거 추가해

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)