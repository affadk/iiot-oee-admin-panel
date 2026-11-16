/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { NetworkAccessProvider } from './context/NetworkAccessContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppRouter } from './app/Router';
import { ApiError } from './types/auth';
import { isRetryableHttpStatus } from './services/api/schemas';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, err) => {
        if (err instanceof ApiError) {
          return isRetryableHttpStatus(err.httpStatus) && failureCount < 2;
        }
        return false;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NetworkAccessProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </NetworkAccessProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
