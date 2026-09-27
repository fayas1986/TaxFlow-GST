/**
 * TaxFlow Root Providers Configuration
 * 
 * Configures TanStack Query, Redux Store (transitionary), 
 * React Router, Language, and Global Context.
 */

import React from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { store } from '../../store/store';
import { LanguageProvider } from '../../utils/i18n';
import { WorkspaceSyncProvider } from '../../components/WorkspaceSyncContext';
import { TenantContextProvider } from '../core/tenancy/TenantContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000,
      retry: (failureCount, error: any) => {
        // Don't retry on HTTP 423 Locked or 401/403 Unauthorized
        if (error?.status === 423 || error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LanguageProvider>
            <TenantContextProvider>
              <WorkspaceSyncProvider>
                {children}
              </WorkspaceSyncProvider>
            </TenantContextProvider>
          </LanguageProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
};

