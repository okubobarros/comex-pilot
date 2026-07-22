import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {DateProvider} from './context/DateContext';
import {ProcessProvider} from './context/ProcessContext';
import {EvidenceProvider} from './context/EvidenceContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DateProvider>
      <ProcessProvider>
        <EvidenceProvider>
          <App />
        </EvidenceProvider>
      </ProcessProvider>
    </DateProvider>
  </StrictMode>,
);
