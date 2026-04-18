'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowUp,
  FileCheck2,
  Heart,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const STYLES = `
.cinematic-footer-wrapper {
  --pill-bg-1: color-mix(in oklch, var(--background) 90%, var(--primary) 10%);
  --pill-bg-2: color-mix(in oklch, var(--background) 95%, var(--secondary) 5%);
  --pill-border: color-mix(in oklch, var(--foreground) 12%, transparent);
  --pill-shadow: color-mix(in oklch, var(--primary) 22%, transparent);
  --pill-highlight: color-mix(in oklch, var(--background) 30%, var(--foreground) 70%);

  --pill-bg-1-hover: color-mix(in oklch, var(--background) 82%, var(--primary) 18%);
  --pill-bg-2-hover: color-mix(in oklch, var(--background) 90%, var(--secondary) 10%);
  --pill-border-hover: color-mix(in oklch, var(--primary) 35%, transparent);
  --pill-shadow-hover: color-mix(in oklch, var(--primary) 35%, transparent);
}

@keyframes footer-breathe {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  100% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
}

@keyframes footer-scroll-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes footer-heartbeat {
  0%, 100% { transform: scale(1); }
  15%, 45% { transform: scale(1.15); }
  30% { transform: scale(1); }
}

.animate-footer-breathe {
  animation: footer-breathe 8s ease-in-out infinite alternate;
}

.animate-footer-scroll-marquee {
  animation: footer-scroll-marquee 34s linear infinite;
}

.animate-footer-heartbeat {
  animation: footer-heartbeat 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

.footer-bg-grid {
  background-size: 56px 56px;
  background-image:
    linear-gradient(to right, color-mix(in oklch, var(--foreground) 5%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 5%, transparent) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
}

.footer-aurora {
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in oklch, var(--primary) 30%, transparent) 0%,
    color-mix(in oklch, var(--secondary) 22%, transparent) 40%,
    transparent 72%
  );
}

.footer-glass-pill {
  background: linear-gradient(145deg, var(--pill-bg-1) 0%, var(--pill-bg-2) 100%);
  border: 1px solid var(--pill-border);
  box-shadow:
    0 10px 30px -16px var(--pill-shadow),
    inset 0 1px 1px var(--pill-highlight);
  backdrop-filter: blur(14px);
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.footer-glass-pill:hover {
  background: linear-gradient(145deg, var(--pill-bg-1-hover) 0%, var(--pill-bg-2-hover) 100%);
  border-color: var(--pill-border-hover);
  box-shadow: 0 20px 36px -16px var(--pill-shadow-hover);
}

.footer-giant-bg-text {
  font-size: 20vw;
  line-height: 0.78;
  font-weight: 900;
  letter-spacing: -0.06em;
  color: transparent;
  -webkit-text-stroke: 1px color-mix(in oklch, var(--primary) 20%, transparent);
  background: linear-gradient(180deg, color-mix(in oklch, var(--primary) 30%, transparent) 0%, transparent 65%);
  -webkit-background-clip: text;
  background-clip: text;
}

.footer-text-glow {
  background: linear-gradient(180deg, var(--foreground) 0%, color-mix(in oklch, var(--foreground) 65%, transparent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0px 0px 18px color-mix(in oklch, var(--primary) 20%, transparent));
}
`;

type MagneticButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> &
    React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      as?: React.ElementType;
    };

const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = 'button', ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement>(null);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const element = localRef.current;
      if (!element) return;

      const handleMouseMove = (e: MouseEvent) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        gsap.to(element, {
          x: x * 0.2,
          y: y * 0.2,
          rotationX: -y * 0.05,
          rotationY: x * 0.05,
          scale: 1.03,
          duration: 0.35,
          ease: 'power2.out',
        });
      };

      const handleMouseLeave = () => {
        gsap.to(element, {
          x: 0,
          y: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          duration: 0.9,
          ease: 'elastic.out(1, 0.35)',
        });
      };

      element.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        element.removeEventListener('mousemove', handleMouseMove);
        element.removeEventListener('mouseleave', handleMouseLeave);
      };
    }, []);

    return (
      <Component
        ref={(node: HTMLElement) => {
          (localRef as React.MutableRefObject<HTMLElement | null>).current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef)
            (forwardedRef as React.MutableRefObject<HTMLElement | null>).current =
              node;
        }}
        className={cn('cursor-pointer', className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

MagneticButton.displayName = 'MagneticButton';

const MarqueeItem = () => (
  <div className='flex items-center space-x-10 px-6'>
    <span>Verified Earnings</span>
    <span className='text-primary/70'>✦</span>
    <span>Deduction Clarity</span>
    <span className='text-secondary/70'>✦</span>
    <span>Dispute Evidence Trail</span>
    <span className='text-primary/70'>✦</span>
    <span>Advocate-Ready Records</span>
    <span className='text-secondary/70'>✦</span>
    <span>Worker Privacy First</span>
  </div>
);

export function CinematicFooter() {
  const wrapperRef = useRef<HTMLElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !wrapperRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: 80, opacity: 0.2, scale: 0.9 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: 'top 85%',
            end: 'bottom bottom',
            scrub: 1,
          },
        }
      );

      gsap.fromTo(
        [headingRef.current, contentRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: 'top 70%',
            end: 'bottom bottom',
            scrub: 0.8,
          },
        }
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <footer
        ref={wrapperRef}
        className='cinematic-footer-wrapper relative w-full overflow-hidden border-t border-border bg-background text-foreground'
      >
        <div className='footer-aurora animate-footer-breathe pointer-events-none absolute top-1/2 left-1/2 z-0 h-[55vh] w-[85vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[85px]' />
        <div className='footer-bg-grid pointer-events-none absolute inset-0 z-0' />

        <div
          ref={giantTextRef}
          className='footer-giant-bg-text pointer-events-none absolute -bottom-[3vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap'
        >
          FAIRGIG
        </div>

        <div className='absolute top-12 left-0 z-10 w-full rotate-[-1.5deg] scale-105 overflow-hidden border-y border-border/60 bg-background/70 py-3 backdrop-blur-sm'>
          <div className='animate-footer-scroll-marquee text-muted-foreground flex w-max text-[11px] font-extrabold tracking-[0.28em] uppercase md:text-xs'>
            <MarqueeItem />
            <MarqueeItem />
          </div>
        </div>

        <div className='relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 pb-24 pt-28'>
          <h2
            ref={headingRef}
            className='footer-text-glow mx-auto max-w-4xl text-center text-4xl font-black tracking-tight md:text-7xl'
          >
            Build Your Defensible Work Record
          </h2>

          <div ref={contentRef} className='mt-8 flex flex-col items-center gap-7'>
            <p className='text-muted-foreground max-w-2xl text-center text-base leading-relaxed md:text-lg'>
              FairGig turns weekly gig activity into verifiable timelines for
              workers, advocates, and legal review teams.
            </p>

            <div className='flex w-full flex-wrap justify-center gap-4'>
              <MagneticButton
                as={Link}
                href='/auth/sign-up'
                className='footer-glass-pill text-foreground inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold md:text-base'
              >
                <ShieldCheck className='size-5' />
                Create Evidence Profile
              </MagneticButton>

              <MagneticButton
                as={Link}
                href='/certificate/verify'
                className='footer-glass-pill text-foreground inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold md:text-base'
              >
                <FileCheck2 className='size-5' />
                Verify Certificate
              </MagneticButton>

              <MagneticButton
                as={Link}
                href='/community/board'
                className='footer-glass-pill text-foreground inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold md:text-base'
              >
                <Users className='size-5' />
                Join Community Board
              </MagneticButton>
            </div>

            <div className='mt-1 flex flex-wrap justify-center gap-3 md:gap-4'>
              <span className='footer-glass-pill text-muted-foreground rounded-full px-5 py-2 text-xs font-semibold md:text-sm'>
                Advocate Workflow Ready
              </span>
              <span className='footer-glass-pill text-muted-foreground rounded-full px-5 py-2 text-xs font-semibold md:text-sm'>
                Fraud-Resistant Records
              </span>
              <span className='footer-glass-pill text-muted-foreground rounded-full px-5 py-2 text-xs font-semibold md:text-sm'>
                12-Step Case Progress
              </span>
            </div>
          </div>
        </div>

        <div className='relative z-20 flex w-full flex-col items-center justify-between gap-5 border-t border-border/60 px-6 py-6 md:flex-row md:px-12'>
          <div className='text-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase'>
            © 2026 FairGig. Transparent work evidence platform.
          </div>

          <div className='footer-glass-pill flex cursor-default items-center gap-2 rounded-full px-5 py-2'>
            <Sparkles className='text-primary size-4' />
            <span className='text-muted-foreground text-[11px] font-bold uppercase tracking-[0.18em]'>
              Built with
            </span>
            <Heart className='animate-footer-heartbeat text-destructive size-4' />
            <span className='text-foreground text-sm font-black'>FairGig</span>
          </div>

          <MagneticButton
            as='button'
            onClick={scrollToTop}
            className='footer-glass-pill text-muted-foreground hover:text-foreground inline-flex size-11 items-center justify-center rounded-full'
            aria-label='Back to top'
          >
            <ArrowUp className='size-4' />
          </MagneticButton>
        </div>
      </footer>
    </>
  );
}
