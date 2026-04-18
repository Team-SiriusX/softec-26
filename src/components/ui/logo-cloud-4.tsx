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
        'relative w-full overflow-hidden border-y border-black/5 bg-gradient-to-r from-background via-transparent to-background py-6 backdrop-blur-xl dark:border-white/15',
        className
      )}
      {...props}
    >
      <div className='pointer-events-none absolute inset-x-0 -top-px border-t border-black/5 dark:border-white/20' />

      <InfiniteSlider gap={24} reverse speed={60} speedOnHover={20}>
        {logos.map((logo) => (
          <div
            key={`logo-${logo.alt}`}
            className='pointer-events-none flex h-16 w-40 items-center justify-center rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-4'
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

      <div className='pointer-events-none absolute inset-x-0 -bottom-px border-b border-black/5 dark:border-white/20' />
    </div>
  );
}
