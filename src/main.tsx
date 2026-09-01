import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {ProcessProvider} from './context/ProcessContext';
import {EvidenceProvider} from './context/EvidenceContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProcessProvider>
      <EvidenceProvider>
        <App />
      </EvidenceProvider>
    </ProcessProvider>
  </StrictMode>,
);
