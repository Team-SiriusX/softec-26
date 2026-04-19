'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type RoleSignOutButtonProps = {
  className?: string;
};

export function RoleSignOutButton({ className }: RoleSignOutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
      router.push('/auth/sign-in');
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={cn('rounded-full bg-background/90 shadow-sm backdrop-blur-sm', className)}
      aria-label='Sign out'
    >
      <LogOut className='size-4' aria-hidden='true' />
      <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
    </Button>
  );
}