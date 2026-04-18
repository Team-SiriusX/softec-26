import Link from 'next/link';
import { ArrowRight, BarChart3, ClipboardPlus, FileCheck2, UserCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const quickActions = [
  {
    title: 'Open Analytics',
    description: 'View all 6 worker charts in the dedicated analytics page.',
    href: '/worker/analytics',
    icon: BarChart3,
  },
  {
    title: 'Log New Shift',
    description: 'Add shift entries and keep your data fresh for analytics.',
    href: '/worker/log-shift',
    icon: ClipboardPlus,
  },
  {
    title: 'View Certificate',
    description: 'Access and manage verified certificate output.',
    href: '/worker/certificate',
    icon: FileCheck2,
  },
  {
    title: 'Update Profile',
    description: 'Review personal and account settings.',
    href: '/worker/profile',
    icon: UserCircle2,
  },
];

export default function WorkerDashboardPage() {
  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_10%_0%,_rgba(2,132,199,0.1),_transparent_45%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
        <Card className='border-border/60 bg-card/90'>
          <CardHeader className='gap-3'>
            <Badge variant='outline' className='w-fit'>
              Worker Command Center
            </Badge>
            <CardTitle className='text-3xl tracking-tight'>
              Dashboard Overview
            </CardTitle>
            <CardDescription className='max-w-3xl'>
              Analytics is now separated into a focused experience so this
              dashboard can stay operational and fast. Use quick actions below
              to jump into workflow or deep analytics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href='/worker/analytics'
              className={cn(buttonVariants({ variant: 'default' }), 'w-fit')}
            >
              Go To Worker Analytics
              <ArrowRight className='size-4' />
            </Link>
          </CardContent>
        </Card>

        <section className='grid gap-4 md:grid-cols-2'>
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Card
                key={action.title}
                className='border-border/60 bg-card/90 transition-shadow hover:shadow-md'
              >
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-lg'>
                    <Icon className='size-4 text-primary' />
                    {action.title}
                  </CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={action.href}
                    className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}
                  >
                    Open
                    <ArrowRight className='size-4' />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}
