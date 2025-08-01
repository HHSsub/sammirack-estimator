import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { ProductProvider } from './contexts/ProductContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ProductProvider>
        <App />
      </ProductProvider>
    </HashRouter>
  </React.StrictMode>
);
