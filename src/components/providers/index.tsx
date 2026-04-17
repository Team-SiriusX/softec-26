import React from 'react';
import { Toaster } from '../ui/sonner';
import { QueryProvider } from './query-provider';

export default function Providers({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <QueryProvider>
      <Toaster richColors />
      {children}
    </QueryProvider>
  );
}
