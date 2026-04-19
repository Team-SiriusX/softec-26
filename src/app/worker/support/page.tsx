'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSupportTicket, useGetSupportTickets } from '@/hooks/use-support-tickets';
import {
	formatSupportTicketCategory,
	formatSupportTicketPriority,
	formatSupportTicketStatus,
	supportTicketCategoryOptions,
	supportTicketPriorityOptions,
	supportTicketPriorityTone,
	supportTicketStatusTone,
} from '@/lib/support-ticket';

export default function WorkerSupportPage() {
	const [subject, setSubject] = useState('');
	const [category, setCategory] = useState<'ACCOUNT_ACCESS' | 'PAYMENT' | 'TECHNICAL' | 'SAFETY' | 'OTHER'>('PAYMENT');
	const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
	const [description, setDescription] = useState('');

	const ticketsQuery = useGetSupportTickets({ limit: 25 });
	const createTicket = useCreateSupportTicket();

	const tickets = useMemo(() => ticketsQuery.data?.tickets ?? [], [ticketsQuery.data?.tickets]);

	const canSubmit = subject.trim().length >= 5 && description.trim().length >= 15;

	const summary = useMemo(() => {
		const counts = {
			total: tickets.length,
			open: 0,
			inReview: 0,
			inProgress: 0,
			resolved: 0,
			closed: 0,
		};

		for (const ticket of tickets) {
			if (ticket.status === 'OPEN') counts.open += 1;
			if (ticket.status === 'IN_REVIEW') counts.inReview += 1;
			if (ticket.status === 'IN_PROGRESS') counts.inProgress += 1;
			if (ticket.status === 'RESOLVED') counts.resolved += 1;
			if (ticket.status === 'CLOSED') counts.closed += 1;
		}

		return counts;
	}, [tickets]);

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!canSubmit) {
			return;
		}

		createTicket.mutate(
			{
				subject: subject.trim(),
				description: description.trim(),
				category,
				priority,
			},
			{
				onSuccess: () => {
					setSubject('');
					setDescription('');
					setPriority('MEDIUM');
					setCategory('PAYMENT');
				},
			},
		);
	};

	return (
		<div className='space-y-6'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<h1 className='text-2xl font-bold tracking-tight'>Support Ticket Center</h1>
					<p className='mt-1 text-sm text-muted-foreground'>
						Create and track support tickets for account, payment, technical, or safety issues.
					</p>
				</div>
				<Link href='/worker/community-feed' className={buttonVariants({ variant: 'outline' })}>
					Open Community Feed
				</Link>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>Submit New Ticket</CardTitle>
					<CardDescription>
						Share enough details so advocates can investigate and resolve quickly.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form className='grid gap-4 md:grid-cols-2' onSubmit={handleSubmit}>
						<div className='space-y-2 md:col-span-2'>
							<Label htmlFor='support-subject'>Subject</Label>
							<Input
								id='support-subject'
								value={subject}
								onChange={(event) => setSubject(event.target.value)}
								placeholder='Example: Weekly payout missing from app wallet'
								minLength={5}
								maxLength={160}
							/>
						</div>

						<div className='space-y-2'>
							<Label htmlFor='support-category'>Category</Label>
							<Select value={category} onValueChange={(value) => setCategory(value as typeof category)}>
								<SelectTrigger id='support-category'>
									<SelectValue placeholder='Select category' />
								</SelectTrigger>
								<SelectContent>
									{supportTicketCategoryOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className='space-y-2'>
							<Label htmlFor='support-priority'>Priority</Label>
							<Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}>
								<SelectTrigger id='support-priority'>
									<SelectValue placeholder='Select priority' />
								</SelectTrigger>
								<SelectContent>
									{supportTicketPriorityOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className='space-y-2 md:col-span-2'>
							<Label htmlFor='support-description'>Description</Label>
							<Textarea
								id='support-description'
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								rows={6}
								minLength={15}
								placeholder='Include dates, affected platform, amount involved, and what you already tried.'
							/>
							<p className='text-xs text-muted-foreground'>
								Minimum 15 characters. Clear details speed up ticket resolution.
							</p>
						</div>

						<div className='md:col-span-2'>
							<button
								type='submit'
								disabled={!canSubmit || createTicket.isPending}
								className={buttonVariants({ className: 'w-full md:w-auto' })}
							>
								{createTicket.isPending ? 'Submitting...' : 'Submit ticket'}
							</button>
						</div>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className='text-base'>My Tickets</CardTitle>
					<CardDescription>
						Monitor status changes and advocate updates for each ticket.
					</CardDescription>
				</CardHeader>
				<CardContent className='space-y-4'>
					<div className='flex flex-wrap gap-2'>
						<Badge variant='secondary'>Total: {summary.total}</Badge>
						<Badge variant='outline'>Open: {summary.open}</Badge>
						<Badge variant='secondary'>Review: {summary.inReview}</Badge>
						<Badge>In Progress: {summary.inProgress}</Badge>
						<Badge variant='default'>Resolved: {summary.resolved}</Badge>
						<Badge variant='outline'>Closed: {summary.closed}</Badge>
					</div>

					<Separator />

					{ticketsQuery.isLoading ? (
						<div className='space-y-3'>
							<div className='h-20 animate-pulse rounded-md bg-muted' />
							<div className='h-20 animate-pulse rounded-md bg-muted' />
						</div>
					) : tickets.length === 0 ? (
						<p className='text-sm text-muted-foreground'>
							No support tickets yet. Submit one to start the support workflow.
						</p>
					) : (
						<div className='space-y-3'>
							{tickets.map((ticket) => (
								<article key={ticket.id} className='rounded-md border p-3'>
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
										<p className='text-xs text-muted-foreground'>
											{new Date(ticket.createdAt).toLocaleDateString('en-PK')}
										</p>
									</div>

									<p className='mt-2 text-sm font-medium'>{ticket.subject}</p>
									<p className='mt-1 text-sm leading-relaxed text-muted-foreground'>
										{ticket.description}
									</p>

									<div className='mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground'>
										<span>
											Assigned: {ticket.assignedAdvocate?.fullName ?? 'Pending assignment'}
										</span>
										{ticket.resolvedAt ? (
											<span>
												Resolved: {new Date(ticket.resolvedAt).toLocaleDateString('en-PK')}
											</span>
										) : null}
									</div>

									{ticket.advocateNote ? (
										<p className='mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground'>
											Advocate note: {ticket.advocateNote}
										</p>
									) : null}
								</article>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
