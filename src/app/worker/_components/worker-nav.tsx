'use client';

import { cn } from '@/lib/utils';
import {
  BarChart2,
  FileText,
  LayoutDashboard,
  LogOut,
  PenSquare,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/worker/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/worker/log-shift', label: 'Log a Shift', icon: PenSquare },
  { href: '/worker/earnings', label: 'My Earnings', icon: BarChart2 },
  { href: '/worker/certificate', label: 'Certificate', icon: FileText },
  { href: '/worker/profile', label: 'Profile', icon: User },
] as const;

export default function WorkerNav({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/auth/sign-in');
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className='hidden lg:flex flex-col w-64 border-r border-border bg-sidebar min-h-screen sticky top-0'>
        {/* Brand */}
        <div className='px-6 py-5 border-b border-border'>
          <span className='text-lg font-bold tracking-tight text-sidebar-foreground'>
            FairGig
          </span>
          <p className='text-xs text-muted-foreground mt-0.5 truncate'>{user.email}</p>
        </div>

        {/* Nav */}
        <nav className='flex-1 p-4 space-y-1'>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className='size-4 shrink-0' aria-hidden='true' />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className='p-4 border-t border-border'>
          <button
            onClick={handleSignOut}
            className='flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[44px] cursor-pointer'
          >
            <LogOut className='size-4 shrink-0' aria-hidden='true' />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className='lg:hidden fixed bottom-1 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border px-4 py-2 flex items-center justify-around pb-safe-area-inset-bottom'>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-h-[44px] min-w-[64px]',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className='size-5' aria-hidden='true' />
              <span className='text-[10px] font-medium uppercase tracking-wider truncate max-w-full'>
                {label.split(' ')[0]}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile top bar */}
      <header className='lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border px-4 py-3 flex items-center justify-between'>
        <span className='text-base font-bold tracking-tight text-primary'>FairGig</span>
        <div className='flex items-center gap-3'>
          <button
            onClick={handleSignOut}
            className='p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0'
            aria-label='Sign out'
          >
            <LogOut className='size-5' aria-hidden='true' />
          </button>
        </div>
      </header>

      {/* Mobile spacers */}
      <div className='lg:hidden h-14' />
      <div className='lg:hidden h-20' />
    </>
  );
}
