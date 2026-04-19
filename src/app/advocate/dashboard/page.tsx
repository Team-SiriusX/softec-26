import Link from 'next/link';
import { ArrowRight, BarChart3, ShieldAlert, Siren, Speech, UserCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { IncomeHeatmap } from './_components/income-heatmap';
import { PlatformCommissionChart } from './_components/platform-commission-chart';
import { SupportTicketQueue } from './_components/support-ticket-queue';
import { VulnerabilityFlagTable } from './_components/vulnerability-flag-table';
import { cn } from '@/lib/utils';

const actions = [
  {
    title: 'Open Analytics Deck',
    description: 'Launch all 7 advocate charts plus intelligence signals.',
    href: '/advocate/analytics',
    icon: BarChart3,
  },
  {
    title: 'Review Support Tickets',
    description: 'Inspect submitted tickets, evidence quality, and status.',
    href: '/advocate/support',
    icon: Speech,
  },
  {
    title: 'Moderate Community',
    description: 'Run AI queue triage and complete human verification reviews.',
    href: '/advocate/community-moderation',
    icon: ShieldAlert,
  },
  {
    title: 'Track Early Warnings',
    description: 'Monitor ongoing platform-zone alerts and drop severity.',
    href: '/advocate/analytics#early-warning',
    icon: Siren,
  },
  {
    title: 'Vulnerability Detail',
    description: 'Review worker-level risk flags with anonymized identifiers.',
    href: '/advocate/vulnerability-flags',
    icon: ShieldAlert,
  },
  {
    title: 'Exploitative Platform Ranking',
    description: 'See weighted injustice rankings for current period.',
    href: '/advocate/analytics#exploitation-score',
    icon: ShieldAlert,
  },
  {
    title: 'Commission Tracker',
    description: 'Inspect platform commission distributions over time by zone.',
    href: '/advocate/commission-tracker',
    icon: BarChart3,
  },
  {
    title: 'Account Approval Panel',
    description: 'Approve or reject pending verifier and advocate sign-ups.',
    href: '/advocate/approvals',
    icon: UserCheck,
  },
];

export default function AdvocateDashboardPage() {
  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_92%_2%,rgba(245,158,11,0.12),transparent_44%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
        <Card className='border-border/60 bg-card/90'>
          <CardHeader className='gap-3'>
            <Badge variant='outline' className='w-fit'>
              Advocate Command Center
            </Badge>
            <CardTitle className='text-3xl tracking-tight'>
              Dashboard Overview
            </CardTitle>
            <CardDescription className='max-w-3xl'>
              The full analytics stack now lives on a dedicated route so this
              dashboard can stay focused on tactical workflow. Use the links
              below for deep chart analysis and evidence generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href='/advocate/analytics'
              className={cn(buttonVariants({ variant: 'default' }), 'w-fit')}
            >
              Go To Advocate Analytics
              <ArrowRight className='size-4' />
            </Link>
          </CardContent>
        </Card>

        <section className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {actions.map((action) => {
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

        <section>
          <SupportTicketQueue />
        </section>

        <section className='grid gap-6 xl:grid-cols-2'>
          <PlatformCommissionChart />
          <IncomeHeatmap />
        </section>

        <section>
          <VulnerabilityFlagTable />
        </section>
      </div>
    </main>
  );
}
