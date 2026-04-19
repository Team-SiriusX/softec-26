'use client';

import { cn } from '@/lib/utils';
import {
  BadgeCheck,
  BarChart2,
  CircleAlert,
  FileSpreadsheet,
  MessageSquare,
  Radio,
  ShieldAlert,
  FileText,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  PenSquare,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const navItems = [
  {
    href: '/worker/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    section: 'overview',
  },
  {
    href: '/worker/community-feed',
    label: 'Community Feed',
    icon: MessageSquare,
    section: 'overview',
  },
  {
    href: '/worker/grievances',
    label: 'Grievances',
    icon: CircleAlert,
    section: 'overview',
  },
  {
    href: '/worker/log-shift',
    label: 'Log a Shift',
    icon: PenSquare,
    section: 'work',
  },
  {
    href: '/worker/my-shift-logs',
    label: 'My Shift Logs',
    icon: ListOrdered,
    section: 'work',
  },
  {
    href: '/worker/earnings',
    label: 'My Earnings',
    icon: BarChart2,
    section: 'work',
  },
  {
    href: '/worker/anomaly-detection',
    label: 'Anomaly Detection',
    icon: ShieldAlert,
    section: 'trust',
  },
  {
    href: '/worker/certificate',
    label: 'Certificate',
    icon: FileText,
    section: 'trust',
  },
  {
    href: '/worker/profile',
    label: 'Profile',
    icon: User,
    section: 'trust',
  },
] as const;

const sectionMeta = {
  overview: { label: 'Overview', icon: Radio },
  work: { label: 'Work Ledger', icon: FileSpreadsheet },
  trust: { label: 'Trust & Identity', icon: BadgeCheck },
} as const;

const mobilePrimaryNav = navItems.filter((item) =>
  ['/worker/dashboard', '/worker/log-shift', '/worker/grievances', '/worker/earnings', '/worker/profile'].includes(
    item.href,
  ),
);

type WorkerNavUser = {
  email: string;
  fullName?: string | null;
  name?: string | null;
};

export default function WorkerNav({ user }: { user: WorkerNavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const groupedItems = useMemo(() => {
    return {
      overview: navItems.filter((item) => item.section === 'overview'),
      work: navItems.filter((item) => item.section === 'work'),
      trust: navItems.filter((item) => item.section === 'trust'),
    };
  }, []);

  const displayName = user.fullName || user.name || 'Worker';

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    await authClient.signOut();
    router.push('/auth/sign-in');
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className='sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border/70 bg-gradient-to-b from-sidebar to-sidebar/95 md:flex md:flex-col'>
        <div className='space-y-4 border-b border-border/70 px-5 py-5'>
          <div className='rounded-2xl border border-border/60 bg-sidebar-accent/30 p-4 backdrop-blur'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <p className='text-base font-semibold tracking-tight text-sidebar-foreground'>
                  FairGig Worker
                </p>
                <p className='mt-0.5 text-xs text-sidebar-foreground/70'>
                  Professional workspace
                </p>
              </div>
              <span className='rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400'>
                Active
              </span>
            </div>

            <div className='mt-4 space-y-1'>
              <p className='truncate text-sm font-medium text-sidebar-foreground'>
                {displayName}
              </p>
              <p className='truncate text-xs text-sidebar-foreground/65'>{user.email}</p>
            </div>
          </div>
        </div>

        <nav className='flex-1 space-y-6 overflow-y-auto px-4 py-5'>
          {(Object.keys(groupedItems) as Array<keyof typeof groupedItems>).map((section) => {
            const sectionConfig = sectionMeta[section];
            const SectionIcon = sectionConfig.icon;

            return (
              <section key={section} className='space-y-2'>
                <div className='flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/60'>
                  <SectionIcon className='size-3.5' />
                  {sectionConfig.label}
                </div>

                <div className='space-y-1'>
                  {groupedItems[section].map(({ href, label, icon: Icon }) => {
                    const active = isActive(href);

                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          'group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          active
                            ? 'bg-sidebar-primary/95 text-sidebar-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span
                          className={cn(
                            'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full transition-opacity',
                            active ? 'bg-primary opacity-100' : 'opacity-0',
                          )}
                          aria-hidden='true'
                        />
                        <Icon className='size-4 shrink-0' aria-hidden='true' />
                        <span className='truncate'>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className='space-y-3 border-t border-border/70 px-4 py-4'>
          <p className='rounded-lg border border-border/60 bg-sidebar-accent/20 px-3 py-2 text-[11px] leading-relaxed text-sidebar-foreground/70'>
            Keep your shift records updated daily for stronger anomaly protection and certificate eligibility.
          </p>

          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className='flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60'
          >
            <LogOut className='size-4 shrink-0' aria-hidden='true' />
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className='fixed left-0 right-0 top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur md:hidden'>
        <div className='flex items-center justify-between px-4 py-3'>
          <div>
            <p className='text-base font-semibold tracking-tight text-primary'>FairGig</p>
            <p className='text-[11px] text-muted-foreground'>Worker workspace</p>
          </div>
        <div className='flex items-center gap-3'>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className='shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60'
            aria-label='Sign out'
          >
            <LogOut className='size-5' aria-hidden='true' />
          </button>
        </div>
        </div>

        <nav className='scrollbar-none flex items-center gap-1 overflow-x-auto border-t border-border/70 px-3 py-2'>
          {mobilePrimaryNav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex min-h-[40px] shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className='size-3.5' aria-hidden='true' />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Mobile spacers */}
      <div className='h-[94px] md:hidden' />
    </>
  );
}
