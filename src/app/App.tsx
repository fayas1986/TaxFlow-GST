/**
 * TaxFlow Enterprise Root Application Component
 * 
 * Houses top-level providers, routing, and activity security tracking.
 */

import React from 'react';
import { AppProviders } from './providers';
import { AppRouter } from './router';
import InactivityTracker from '../../components/InactivityTracker';

export const App: React.FC = () => {
  return (
    <AppProviders>
      <InactivityTracker />
      <AppRouter />
    </AppProviders>
  );
};

export default App;
