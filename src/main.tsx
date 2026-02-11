import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

const updateReload = registerSW({
  onNeedRefresh() {
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __swUpdateReady?: boolean; __swApplyUpdate?: (reload: boolean) => Promise<void> };
      w.__swUpdateReady = true;
      w.__swApplyUpdate = updateReload;
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
