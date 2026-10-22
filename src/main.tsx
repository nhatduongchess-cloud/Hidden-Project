import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/source-sans-3/wght.css';
import '@fontsource-variable/manrope/wght.css';
import './styles/index.css';
import { App } from './App';
import { StoreProvider } from './lib/store-context';
import { createStore } from './domain/store';

const store = createStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
