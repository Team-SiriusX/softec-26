import { currentUser } from '@/lib/current-user';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { HeroSection } from '@/components/ui/glass-video-hero';
import DemoOne from '@/components/ui/demo';
import BarChartDemo from '@/components/ui/bar-chart-demo';
import FeaturedSectionStatsDemo from '@/components/ui/featured-section-stats-demo';
import { Footer2 } from '@/components/ui/footer-2';
import { cn } from '@/lib/utils';

export default async function Home() {
  const user = await currentUser();

  return (
    <main className='from-background to-accent/20 min-h-screen overflow-x-hidden bg-linear-to-b'>
      <HeroSection />
      <DemoOne />
      <BarChartDemo />
      <FeaturedSectionStatsDemo />

      <section className='mx-auto w-full max-w-2xl px-6 pb-14'>
        <div className='space-y-8 rounded-3xl border border-border/60 bg-background/70 p-6 text-center shadow-sm backdrop-blur sm:p-8'>
          <div className='space-y-4'>
            <h2 className='text-primary text-3xl font-black tracking-tight lg:text-4xl'>
              FairGig Portal Access
            </h2>
            <p className='mx-auto max-w-xl text-lg text-muted-foreground'>
              Empowering gig workers with verified earnings and collective
              transparency.
            </p>
          </div>

          <div className='flex flex-col items-center justify-center gap-3 sm:flex-row'>
            {user ? (
              <Link
                href={`/${user.role?.toLowerCase()}/dashboard`}
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'h-12 rounded-full px-8 text-base font-semibold',
                )}
              >
                <LayoutDashboard className='size-5' />
                Go to Dashboard
                <ArrowRight className='size-4 transition-transform group-hover/button:translate-x-1' />
              </Link>
            ) : (
              <>
                <Link
                  href='/auth/sign-up'
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'h-12 rounded-full px-8 text-base font-semibold',
                  )}
                >
                  Get Started
                </Link>
                <Link
                  href='/auth/sign-in'
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'h-12 rounded-full px-8 text-base font-semibold',
                  )}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {user && (
            <p className='text-sm text-muted-foreground'>
              Logged in as{' '}
              <span className='font-medium text-foreground'>
                {user.fullName || user.email}
              </span>{' '}
              <span className='rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground'>
                {user.role}
              </span>
            </p>
          )}
        </div>
      </section>

      <Footer2 />
    </main>
  );
}
