import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App.tsx';
import { createWebApi } from './api/webApi.ts';
import './styles/tokens.css';
import './styles/app.css';
import './styles/features.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App api={createWebApi()} />
    </BrowserRouter>
  </StrictMode>,
);
