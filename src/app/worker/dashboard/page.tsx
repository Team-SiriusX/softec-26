import { Button } from '@/components/ui/button';
import { currentUser } from '@/lib/current-user';
import { FileText, PenSquare } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardShell } from './_components/dashboard-shell';

export const metadata = {
  title: 'Dashboard — FairGig',
  description: 'Your earnings summary, anomalies, and comparisons at a glance.',
};

export default async function WorkerDashboardPage() {
  const user = await currentUser();

  if (!user) redirect('/auth/sign-in');

  const profile = user;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            Welcome back, {profile.fullName.split(' ')[0]}
          </h1>
          <p className='text-muted-foreground text-sm'>
            Here&apos;s your earnings overview
          </p>
        </div>
        <div className='flex gap-2'>
          <Button size='sm'>
            <Link href='/worker/log-shift'>
              <PenSquare className='mr-2 size-4' aria-hidden='true' />
              Log a Shift
            </Link>
          </Button>
          <Button size='sm' variant='outline'>
            <Link href='/worker/certificate'>
              <FileText className='mr-2 size-4' aria-hidden='true' />
              Get Certificate
            </Link>
          </Button>
        </div>
      </div>

      {/* Client-rendered dashboard shell (needs hooks) */}
      <DashboardShell
        category={profile.category ?? undefined}
        zone={(profile as { cityZone?: string }).cityZone}
      />
    </div>
  );
}
