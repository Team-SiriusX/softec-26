'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Inbox,
  ShieldAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useGetScreenshots } from '../queue/_api/get-pending-screenshots';

const EMPTY_STATS = {
  PENDING: 0,
  CONFIRMED: 0,
  FLAGGED: 0,
  UNVERIFIABLE: 0,
};

const queueLinks = [
  {
    title: 'Pending + Flagged Queue',
    description: 'Default queue with new uploads and AI-flagged logs requiring action.',
    href: '/verifier/queue?filter=needs-review',
  },
  {
    title: 'Approved Queue',
    description: 'Audit previously confirmed screenshot reviews.',
    href: '/verifier/queue?filter=approved',
  },
  {
    title: 'Unverified Queue',
    description: 'Inspect logs marked as unverifiable for follow-up.',
    href: '/verifier/queue?filter=unverified',
  },
];

export default function VerifierDashboardPage() {
  const { data, isLoading } = useGetScreenshots({ page: 1, pageSize: 1 });
  const stats = data?.stats ?? EMPTY_STATS;

  const needsReviewCount = stats.PENDING + stats.FLAGGED;

  const cards = [
    {
      title: 'Needs Review',
      value: needsReviewCount,
      icon: Inbox,
    },
    {
      title: 'Pending',
      value: stats.PENDING,
      icon: Inbox,
    },
    {
      title: 'Flagged',
      value: stats.FLAGGED,
      icon: AlertTriangle,
    },
    {
      title: 'Approved',
      value: stats.CONFIRMED,
      icon: CheckCircle2,
    },
    {
      title: 'Unverified',
      value: stats.UNVERIFIABLE,
      icon: ShieldAlert,
    },
  ];

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_10%_6%,rgba(14,165,233,0.12),transparent_44%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
        <Card className='border-border/60 bg-card/90'>
          <CardHeader className='gap-3'>
            <Badge variant='outline' className='w-fit'>
              Verifier Operations
            </Badge>
            <CardTitle className='text-3xl tracking-tight'>Verification Dashboard</CardTitle>
            <CardDescription className='max-w-3xl'>
              Monitor queue health and jump directly into the queue slice you need.
              Pending and flagged logs are prioritized by default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href='/verifier/queue?filter=needs-review'
              className={cn(buttonVariants({ variant: 'default' }), 'w-fit')}
            >
              Open Priority Queue
              <ArrowRight className='size-4' />
            </Link>
          </CardContent>
        </Card>

        <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
          {cards.map((item) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.title}
                className='border-border/60 bg-card/90 transition-shadow hover:shadow-md'
              >
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center justify-between text-sm font-medium text-muted-foreground'>
                    {item.title}
                    <Icon className='size-4 text-muted-foreground' aria-hidden='true' />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className='h-8 w-20' />
                  ) : (
                    <p className='text-3xl font-bold tabular-nums'>{item.value}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className='grid gap-4 lg:grid-cols-3'>
          {queueLinks.map((item) => (
            <Card
              key={item.title}
              className='border-border/60 bg-card/90 transition-shadow hover:shadow-md'
            >
              <CardHeader>
                <CardTitle className='text-lg'>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={item.href}
                  className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}
                >
                  Open
                  <ArrowRight className='size-4' />
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
c