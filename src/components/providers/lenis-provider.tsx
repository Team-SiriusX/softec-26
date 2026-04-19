'use client';

import { type ReactNode } from 'react';

type LenisProviderProps = {
  children: ReactNode;
};

export default function LenisProvider({ children }: LenisProviderProps) {
  // Smooth-scroll integration is intentionally disabled to avoid hard dependency
  // resolution issues in environments where lenis assets are unavailable.
  return <>{children}</>;
}
