import { currentUser } from '@/lib/current-user';
import { redirect } from 'next/navigation';
import WorkerNav from './_components/worker-nav';

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  if ((user as { role?: string }).role !== 'WORKER') {
    redirect('/');
  }

  return (
    <div className='flex min-h-screen bg-background'>
      <WorkerNav user={user as { name: string; email: string }} />
      <main className='flex-1 flex flex-col min-h-screen overflow-x-hidden'>
        <div className='flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full'>
          {children}
        </div>
      </main>
    </div>
  );
}
