'use client';

import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260210_031346_d87182fb-b0af-4273-84d1-c6fd17d6bf0f.mp4';
const HERO_POSTER_URL =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80';

const HeroSection = () => {
  const [fullBleed, setFullBleed] = useState(true);

  return (
    <section
      className={`relative w-full overflow-hidden transition-all duration-500 ease-in-out ${
        fullBleed ? 'min-h-screen' : 'py-32 lg:py-40'
      }`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        poster={HERO_POSTER_URL}
        className='absolute inset-0 z-0 h-full w-full object-cover'
      >
        <source src={VIDEO_URL} type='video/mp4' />
      </video>

      <div className='absolute inset-0 z-[1] bg-gradient-to-b from-black/35 via-black/40 to-black/55' />

      <header className='absolute top-5 left-1/2 z-30 w-[min(1200px,94%)] -translate-x-1/2'>
        <div className='flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl md:px-6'>
          <Link
            href='/'
            className='flex items-center gap-2.5 text-sm font-semibold tracking-wide text-white md:text-base'
          >
            <Image
              src='/logo2.png'
              alt='FairGig logo'
              width={42}
              height={42}
              className='size-8 rounded-md object-cover'
              priority
            />
            <span>FairGig</span>
          </Link>

          <nav className='hidden items-center gap-5 md:flex'>
            <Link
              href='/advocate/analytics'
              className='text-sm text-white/85 transition-colors hover:text-white'
            >
              Analytics
            </Link>
            <Link
              href='/verifier/queue'
              className='text-sm text-white/85 transition-colors hover:text-white'
            >
              Queue
            </Link>
            <Link
              href='/certificate/verify'
              className='text-sm text-white/85 transition-colors hover:text-white'
            >
              Verify
            </Link>
            <Link
              href='/community/board'
              className='text-sm text-white/85 transition-colors hover:text-white'
            >
              Community Board
            </Link>
          </nav>

          <div className='flex items-center gap-2'>
            <Link
              href='/auth/sign-in'
              className='rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 md:text-sm'
            >
              Sign In
            </Link>
            <Link
              href='/auth/sign-up'
              className='rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white/90 md:text-sm'
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <div
        className={`relative z-10 flex flex-col items-center justify-center px-6 pt-32 pb-12 text-center md:pt-36 ${
          fullBleed ? 'min-h-screen' : 'min-h-[72vh]'
        }`}
      >
        <div className='inline-flex h-[38px] items-center gap-2.5 rounded-[10px] border border-[rgba(164,132,215,0.5)] bg-[rgba(85,80,110,0.4)] px-3.5 shadow-[0_0_20px_rgba(123,57,252,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl'>
          <span className='bg-primary font-cabin text-primary-foreground rounded-[6px] px-2.5 py-1 text-xs font-medium shadow-[0_0_8px_rgba(123,57,252,0.4)]'>
            New
          </span>
          <span className='font-cabin text-sm font-medium tracking-wide text-white'>
            FairGig Evidence Intelligence
          </span>
        </div>

        <h1 className='font-instrument mt-7 max-w-4xl text-[clamp(2.3rem,6.6vw,5rem)] leading-[1.02] tracking-[-0.02em] text-white'>
          Evidence you can defend.
        </h1>

        <p className='font-inter mt-5 max-w-[680px] text-[clamp(0.98rem,1.9vw,1.2rem)] leading-relaxed font-normal text-white/85'>
          FairGig transforms earnings, deductions, and grievances into
          verifiable records for workers and advocates.
        </p>

        <div className='mt-7 flex flex-col items-center gap-3.5 sm:flex-row'>
          <Link
            href='/auth/sign-up'
            className='bg-primary font-cabin text-primary-foreground shadow-primary/25 rounded-[10px] px-8 py-3.5 text-base font-medium shadow-lg transition-all hover:brightness-110'
          >
            Create Account
          </Link>
          <Link
            href='/certificate/verify'
            className='bg-secondary font-cabin text-secondary-foreground rounded-[10px] px-8 py-3.5 text-base font-medium transition-all hover:brightness-125'
          >
            Verify Certificate
          </Link>
        </div>
      </div>
    </section>
  );
};

export { HeroSection };
