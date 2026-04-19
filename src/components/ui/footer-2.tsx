import Image from 'next/image';

export function Footer2() {
  return (
    <footer className='border-t bg-card/60'>
      <div className='mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-6'>
        <div className='flex items-center gap-3'>
          <Image
            src='/logo2.png'
            alt='FairGig logo'
            width={36}
            height={36}
            className='rounded-md object-cover'
          />
          <span className='text-sm font-semibold tracking-tight text-foreground'>FairGig</span>
        </div>

        <a
          href='mailto:support@fairgig.app'
          className='text-muted-foreground text-sm font-medium transition-colors hover:text-foreground'
        >
          Support
        </a>
      </div>
    </footer>
  );
}
