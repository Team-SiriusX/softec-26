import React from 'react';
import { Toaster } from '../ui/sonner';
import LenisProvider from './lenis-provider';
import { QueryProvider } from './query-provider';

export default function Providers({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <QueryProvider>
      <LenisProvider>{children}</LenisProvider>
      <Toaster richColors />
    </QueryProvider>
  );
}
