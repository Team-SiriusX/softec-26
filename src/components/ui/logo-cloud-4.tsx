import { type ComponentProps } from 'react';

import { InfiniteSlider } from '@/components/ui/infinite-slider';
import { cn } from '@/lib/utils';

type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = ComponentProps<'div'> & {
  logos: Logo[];
};

export function LogoCloud({ logos, className, ...props }: LogoCloudProps) {
  return (
    <div
      className={cn(
        'relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-white/15 bg-gradient-to-r from-secondary/35 via-transparent to-secondary/35 py-6 backdrop-blur-xl',
        className
      )}
      {...props}
    >
      <div className='pointer-events-none absolute -top-px left-1/2 w-screen -translate-x-1/2 border-t border-white/20' />

      <InfiniteSlider gap={24} reverse speed={60} speedOnHover={20}>
        {logos.map((logo) => (
          <div
            key={`logo-${logo.alt}`}
            className='pointer-events-none flex h-16 w-40 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4'
          >
            <img
              alt={logo.alt}
              className='h-10 w-28 select-none object-contain'
              loading='lazy'
              src={logo.src}
              width={logo.width}
              height={logo.height}
            />
          </div>
        ))}
      </InfiniteSlider>

      <div className='pointer-events-none absolute -bottom-px left-1/2 w-screen -translate-x-1/2 border-b border-white/20' />
    </div>
  );
}
