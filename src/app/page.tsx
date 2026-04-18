import { currentUser } from '@/lib/current-user';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { HeroSection } from '@/components/ui/glass-video-hero';
import DemoOne from '@/components/ui/demo';
import BarChartDemo from '@/components/ui/bar-chart-demo';

export default async function Home() {
  const user = await currentUser();

  console.log({ user });

  return (
    <main className='from-background to-accent/20 min-h-screen bg-linear-to-b'>
      <HeroSection />
      <DemoOne />
      <BarChartDemo />

      <section className='mx-auto w-full max-w-2xl space-y-8 p-6 pb-14 text-center'>
        <div className='space-y-4'>
          <h2 className='text-primary text-3xl font-black tracking-tight lg:text-4xl'>
            FairGig Portal Access
          </h2>
          <p className='text-muted-foreground text-lg'>
            Empowering gig workers with verified earnings and collective
            transparency.
          </p>
        </div>

        <div className='flex flex-col items-center justify-center gap-4 sm:flex-row'>
          {user ? (
            <Button
              size='lg'
              className='group h-12 rounded-full px-8 font-semibold'
            >
              <Link href={`/${user.role?.toLowerCase()}/dashboard`}>
                <LayoutDashboard className='mr-2 size-5' />
                Go to Dashboard
                <ArrowRight className='ml-2 size-4 transition-transform group-hover:translate-x-1' />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                size='lg'
                className='h-12 rounded-full px-8 font-semibold'
              >
                <Link href='/auth/sign-up'>Get Started</Link>
              </Button>
              <Button
                variant='outline'
                size='lg'
                className='h-12 rounded-full px-8 font-semibold'
              >
                <Link href='/auth/sign-in'>Sign In</Link>
              </Button>
            </>
          )}
        </div>

        {user && (
          <p className='text-muted-foreground text-sm'>
            Logged in as{' '}
            <span className='text-foreground font-medium'>
              {user.fullName || user.email}
            </span>{' '}
            ({user.role})
          </p>
        )}
      </section>
    </main>
  );
}
