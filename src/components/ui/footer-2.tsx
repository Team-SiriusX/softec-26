"use client";

import {
  Globe,
  Link as LinkIcon,
  MessageCircle,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { AppStoreButton } from '@/components/ui/app-store-button';
import { buttonVariants } from '@/components/ui/button';
import { PlayStoreButton } from '@/components/ui/play-store-button';

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

const footerLinks: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Platform',
    links: [
      { href: '/', label: 'Home' },
      { href: '/community/board', label: 'Community Board' },
      { href: '/certificate/verify', label: 'Certificate Verify' },
      { href: '/sample', label: 'Product Preview' },
      { href: '/auth/sign-up', label: 'Create Account' },
      { href: '/auth/sign-in', label: 'Sign In' },
    ],
  },
  {
    title: 'Worker',
    links: [
      { href: '/worker/dashboard', label: 'Worker Dashboard' },
      { href: '/worker/earnings', label: 'Earnings' },
      { href: '/worker/certificate', label: 'Certificates' },
      { href: '/worker/settings', label: 'Settings' },
    ],
  },
  {
    title: 'Verifier & Advocate',
    links: [
      { href: '/verifier/queue', label: 'Verifier Queue' },
      { href: '/verifier/dashboard', label: 'Verifier Dashboard' },
      { href: '/advocate/dashboard', label: 'Advocate Dashboard' },
      { href: '/advocate/grievances', label: 'Grievances' },
      { href: '/advocate/vulnerability-flags', label: 'Vulnerability Flags' },
    ],
  },
  {
    title: 'Support & Legal',
    links: [
      { href: '/auth/forget-password', label: 'Forgot Password' },
      { href: '/auth/reset-password', label: 'Reset Password' },
      { href: '/auth/verify-email', label: 'Verify Email' },
      { href: '/pending-approval', label: 'Pending Approval' },
      { href: 'mailto:support@fairgig.app', label: 'Support Email', external: true },
    ],
  },
];

const socialLinks = [
  { icon: Globe, href: 'https://www.facebook.com', label: 'Facebook' },
  { icon: Users, href: 'https://www.instagram.com', label: 'Instagram' },
  { icon: LinkIcon, href: 'https://www.linkedin.com', label: 'LinkedIn' },
  { icon: MessageCircle, href: 'https://x.com/sshahaider', label: 'X' },
];

export function Footer2() {
  return (
    <footer className='border-t bg-card/60'>
      <div className='mx-auto max-w-6xl px-4 lg:px-6'>
        <div className='grid grid-cols-2 gap-8 py-8 md:grid-cols-4'>
          {footerLinks.map((item) => (
            <div key={item.title}>
              <h3 className='mb-4 text-xs font-semibold tracking-wide uppercase'>
                {item.title}
              </h3>
              <ul className='text-muted-foreground space-y-2 text-sm'>
                {item.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target='_blank'
                        rel='noreferrer'
                        className='hover:text-foreground'
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className='hover:text-foreground'>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className='h-px bg-border' />

        <div className='flex flex-wrap items-center justify-between gap-4 py-5'>
          <div className='flex items-center gap-2'>
            {socialLinks.map(({ icon: Icon, href, label }) => (
              <a
                href={href}
                target='_blank'
                rel='noreferrer'
                aria-label={label}
                className={buttonVariants({ variant: 'outline', size: 'icon' })}
                key={label}
              >
                <Icon className='text-muted-foreground size-5' />
              </a>
            ))}
          </div>

          <div className='flex gap-4'>
            <Link href='/auth/sign-up'>
              <AppStoreButton />
            </Link>
            <Link href='/auth/sign-up'>
              <PlayStoreButton />
            </Link>
          </div>
        </div>

        <div className='h-px bg-border' />

        <div className='text-muted-foreground py-4 text-center text-xs'>
          <p>
            © {new Date().getFullYear()}{' '}
            <a
              href='https://x.com/sshahaider'
              target='_blank'
              rel='noreferrer'
              className='hover:text-foreground hover:underline'
            >
              sshahaider
            </a>
            . All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
