import { LogoCloud } from '@/components/ui/logo-cloud-4';
import { cn } from '@/lib/utils';

export default function DemoOne() {
  return (
    <section className='relative w-full py-14 md:py-16'>
      <div className='relative mx-auto w-full max-w-5xl px-4'>
        <h2 className='mb-6 text-center'>
          <span className='text-muted-foreground block text-2xl font-medium'>
            Connected with daily gig ecosystems
          </span>
          <span className='text-primary block text-2xl font-black tracking-tight md:text-3xl'>
            Uber, Careem, inDrive and more
          </span>
        </h2>
      </div>

      <LogoCloud logos={logos} className='mt-2' />
    </section>
  );
}

const logos = [
   {
    src: '/fiverr-2.svg',
    alt: 'Fiverr',
  },
  {
    src: '/indrive-logo.svg',
    alt: 'inDrive Logo',
    imgClassName: 'h-12 w-34',
  },
  {
    src: '/upwork.svg',
    alt: 'upwork Logo',
  },
  {
    src: '/foodpanda-logo.svg',
    alt: 'Foodpanda Logo',
  },
  {
    src: '/uber-2.svg',
    alt: 'Uber Logo',
  },
  {
    src: '/amazon-simple.svg',
    alt: 'DHL Logo',
  },
  {
    src: '/careem.svg',
    alt: 'Careem Logo',
  },
  {
    src: '/daily-freelancing.svg',
    alt: 'daily freelancing',
  },
];
