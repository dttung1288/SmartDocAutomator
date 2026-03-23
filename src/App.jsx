import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './features/Dashboard';
import { TemplateManager } from './features/TemplateManager';
import { Generator } from './features/Generator';
import { EmailGenerator } from './features/EmailGenerator';
import { PlaceholderManager } from './features/PlaceholderManager';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="placeholders" element={<PlaceholderManager />} />
          <Route path="templates" element={<TemplateManager />} />
          <Route path="generator" element={<Generator />} />
          <Route path="email" element={<EmailGenerator />} />
          <Route path="settings" element={<div className="p-8">Settings - Coming Soon</div>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
