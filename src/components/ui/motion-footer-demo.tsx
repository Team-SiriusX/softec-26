'use client';

import { ArrowDown } from 'lucide-react';

import { CinematicFooter } from '@/components/ui/motion-footer';

export default function MotionFooterDemo() {
  return (
    <div className='relative w-full overflow-x-hidden bg-background'>
      <main className='relative z-10 flex min-h-[72vh] w-full flex-col items-center justify-center border-y border-border/60 bg-gradient-to-b from-background via-background to-secondary/10 px-6 text-center'>
        <h3 className='text-muted-foreground mb-6 text-xl font-medium tracking-wide md:text-2xl'>
          Scroll to the final stage
        </h3>
        <p className='text-foreground max-w-2xl text-3xl leading-tight font-black tracking-tight md:text-5xl'>
          From daily gig logs to trusted evidence, ready for review.
        </p>
        <div className='bg-primary/40 mt-10 mb-1 h-20 w-px' />
        <ArrowDown className='text-primary size-5 animate-bounce' />
      </main>

      <CinematicFooter />
    </div>
  );
}
