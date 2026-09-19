import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './fonts.css';
import './theme.css';
// Mavzu (theme) tokenlari — theme.css'dan KEYIN ulanadi, chunki u
// daisyUI/Tailwind qiymatlarini mavzuga bog'laydi.
import './themes.css';
import { registerServiceWorker } from './lib/pwa.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker();
