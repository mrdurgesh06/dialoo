import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import CustomerApp from './features/customer/CustomerApp.jsx';
import AdminApp from './features/admin/AdminApp.jsx';
import { App as CapApp } from '@capacitor/app';
import { isNative } from './shared/native.js';

const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';
// The service worker only caches static files (never /api) and is used for the customer app only.
if (isNative()) {
  document.documentElement.classList.add('native');
  // Android Back button: close sheet -> go back -> exit only from Home
  CapApp.addListener('backButton', () => {
    if (window.history.state && window.history.state.dialooSheet) { window.history.back(); return; }
    const here = window.location.hash.replace(/^#\/?/, '');
    if (here) window.history.back(); else CapApp.exitApp();
  });
}
if ('serviceWorker' in navigator && import.meta.env.PROD && !isAdmin && !isNative()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
createRoot(document.getElementById('root')).render(isAdmin ? <AdminApp /> : <CustomerApp />);
