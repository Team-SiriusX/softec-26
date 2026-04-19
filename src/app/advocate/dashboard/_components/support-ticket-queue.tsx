'use client';

import Link from 'next/link';
import { ArrowRight, CircleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetSupportTickets } from '@/hooks/use-support-tickets';
import {
  formatSupportTicketCategory,
  formatSupportTicketPriority,
  formatSupportTicketStatus,
  supportTicketPriorityTone,
  supportTicketStatusTone,
} from '@/lib/support-ticket';
import { cn } from '@/lib/utils';

const OPEN_TICKET_LIMIT = 6;

export function SupportTicketQueue() {
  const query = useGetSupportTickets({
    status: 'OPEN',
    limit: OPEN_TICKET_LIMIT,
  });

  const tickets = query.data?.tickets ?? [];

  return (
    <Card className='border-border/60 bg-card/90'>
      <CardHeader className='gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <CircleAlert className='size-4 text-primary' />
            Open Support Tickets
          </CardTitle>
          <Badge variant='outline'>
            {query.isLoading ? '...' : `${tickets.length} open`}
          </Badge>
        </div>
        <CardDescription>
          New worker-submitted tickets waiting for advocate review.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {query.isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-20 w-full rounded-2xl' />
            <Skeleton className='h-20 w-full rounded-2xl' />
            <Skeleton className='h-20 w-full rounded-2xl' />
          </div>
        ) : query.isError ? (
          <div className='rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load open support tickets.
          </div>
        ) : tickets.length === 0 ? (
          <div className='rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground'>
            No open support tickets right now.
          </div>
        ) : (
          <div className='space-y-2'>
            {tickets.map((ticket) => (
              <article key={ticket.id} className='rounded-2xl border border-border/60 p-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant={supportTicketStatusTone[ticket.status]}>
                      {formatSupportTicketStatus(ticket.status)}
                    </Badge>
                    <Badge variant={supportTicketPriorityTone[ticket.priority]}>
                      {formatSupportTicketPriority(ticket.priority)}
                    </Badge>
                    <Badge variant='outline'>
                      {formatSupportTicketCategory(ticket.category)}
                    </Badge>
                  </div>
                  <span className='text-xs text-muted-foreground'>
                    {new Date(ticket.createdAt).toLocaleDateString('en-PK')}
                  </span>
                </div>

                <p className='mt-2 truncate text-sm font-medium'>{ticket.subject}</p>
                <p className='line-clamp-2 text-xs text-muted-foreground'>{ticket.description}</p>
              </article>
            ))}
          </div>
        )}

        <Link
          href='/advocate/support'
          className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}
        >
          Open Ticket Review Queue
          <ArrowRight className='size-4' />
        </Link>
      </CardContent>
    </Card>
  );
}
