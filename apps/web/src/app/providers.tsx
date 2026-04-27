'use client';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#161B28',
            color:      '#E8EDF5',
            border:     '1px solid #1E2535',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize:   '13px',
          },
          success: { iconTheme: { primary: '#22C55E', secondary: '#060810' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#060810' } },
        }}
      />
    </SessionProvider>
  );
}
