'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useGetSupportTicketStats, useGetSupportTickets, useUpdateSupportTicket } from '@/hooks/use-support-tickets';
import {
	formatSupportTicketCategory,
	formatSupportTicketPriority,
	formatSupportTicketStatus,
	supportTicketCategoryOptions,
	supportTicketPriorityOptions,
	supportTicketPriorityTone,
	supportTicketStatusOptions,
	supportTicketStatusTone,
} from '@/lib/support-ticket';

const ADVOCATE_PAGE_LIMIT = 80;

export default function AdvocateSupportPage() {
	const { user } = useCurrentUser();

	const [statusFilter, setStatusFilter] = useState<'all' | 'OPEN' | 'IN_REVIEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('all');
	const [priorityFilter, setPriorityFilter] = useState<'all' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('all');
	const [categoryFilter, setCategoryFilter] = useState<'all' | 'ACCOUNT_ACCESS' | 'PAYMENT' | 'TECHNICAL' | 'SAFETY' | 'OTHER'>('all');
	const [noteDraftByTicket, setNoteDraftByTicket] = useState<Record<string, string>>({});

	const filters = useMemo(
		() => ({
			status: statusFilter === 'all' ? undefined : statusFilter,
			priority: priorityFilter === 'all' ? undefined : priorityFilter,
			category: categoryFilter === 'all' ? undefined : categoryFilter,
			limit: ADVOCATE_PAGE_LIMIT,
		}),
		[statusFilter, priorityFilter, categoryFilter],
	);

	const ticketsQuery = useGetSupportTickets(filters);
	const statsQuery = useGetSupportTicketStats();
	const updateTicket = useUpdateSupportTicket();

	const tickets = ticketsQuery.data?.tickets ?? [];
	const currentAdvocateId = user?.id;

	const updateStatus = async (ticketId: string, nextStatus: 'IN_REVIEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') => {
		if (!currentAdvocateId) {
			return;
		}

		await updateTicket.mutateAsync({
			id: ticketId,
			status: nextStatus,
			assignedAdvocateId: currentAdvocateId,
		});
	};

	const claimTicket = async (ticketId: string) => {
		if (!currentAdvocateId) {
			return;
		}

		await updateTicket.mutateAsync({
			id: ticketId,
			status: 'IN_REVIEW',
			assignedAdvocateId: currentAdvocateId,
		});
	};

	const saveNote = async (ticketId: string) => {
		const ticket = tickets.find((row) => row.id === ticketId);
		const note = noteDraftByTicket[ticketId] ?? ticket?.advocateNote ?? '';

		await updateTicket.mutateAsync({
			id: ticketId,
			advocateNote: note,
		});
	};

	const updatePriority = async (
		ticketId: string,
		priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
	) => {
		await updateTicket.mutateAsync({
			id: ticketId,
			priority,
		});
	};

	return (
		<main className='min-h-full bg-[radial-gradient(circle_at_90%_3%,rgba(251,146,60,0.16),transparent_38%)] px-4 py-8 md:px-8'>
			<div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
				<Card className='border-border/60 bg-card/90'>
					<CardHeader className='space-y-2'>
						<Badge variant='outline' className='w-fit'>
							Advocate Support Ops
						</Badge>
						<CardTitle className='text-2xl'>Ticket Management Panel</CardTitle>
						<p className='text-sm text-muted-foreground'>
							Triage incoming support tickets, assign ownership, update priority, and close cases.
						</p>
					</CardHeader>
				</Card>

				<section className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
					<Card className='border-border/60 bg-card/90'>
						<CardHeader className='pb-2'>
							<CardDescription>Total Tickets</CardDescription>
							<CardTitle>{statsQuery.data?.total ?? 0}</CardTitle>
						</CardHeader>
					</Card>
					<Card className='border-border/60 bg-card/90'>
						<CardHeader className='pb-2'>
							<CardDescription>Open</CardDescription>
							<CardTitle>{statsQuery.data?.openCount ?? 0}</CardTitle>
						</CardHeader>
					</Card>
					<Card className='border-border/60 bg-card/90'>
						<CardHeader className='pb-2'>
							<CardDescription>Unassigned Open</CardDescription>
							<CardTitle>{statsQuery.data?.unassignedOpenCount ?? 0}</CardTitle>
						</CardHeader>
					</Card>
					<Card className='border-border/60 bg-card/90'>
						<CardHeader className='pb-2'>
							<CardDescription>Currently Visible</CardDescription>
							<CardTitle>{tickets.length}</CardTitle>
						</CardHeader>
					</Card>
				</section>

				<Card className='border-border/60 bg-card/90'>
					<CardHeader>
						<CardTitle className='text-base'>Queue Filters</CardTitle>
					</CardHeader>
					<CardContent className='grid gap-3 md:grid-cols-3'>
						<Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
							<SelectTrigger>
								<SelectValue placeholder='Status' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All status</SelectItem>
								{supportTicketStatusOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}>
							<SelectTrigger>
								<SelectValue placeholder='Priority' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All priority</SelectItem>
								{supportTicketPriorityOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as typeof categoryFilter)}>
							<SelectTrigger>
								<SelectValue placeholder='Category' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all'>All category</SelectItem>
								{supportTicketCategoryOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</CardContent>
				</Card>

				<Card className='border-border/60 bg-card/90'>
					<CardHeader>
						<CardTitle className='text-base'>Support Ticket Queue</CardTitle>
					</CardHeader>
					<CardContent>
						{ticketsQuery.isLoading ? (
							<Skeleton className='h-64 rounded-3xl' />
						) : tickets.length === 0 ? (
							<p className='rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground'>
								No support tickets match these filters.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Ticket</TableHead>
										<TableHead>Worker</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Priority</TableHead>
										<TableHead>Owner</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{tickets.map((ticket) => (
										<TableRow key={ticket.id}>
											<TableCell className='min-w-75 align-top'>
												<p className='font-medium'>{ticket.subject}</p>
												<p className='line-clamp-2 text-xs text-muted-foreground'>
													{ticket.description}
												</p>
												<p className='mt-1 text-[11px] text-muted-foreground'>
													{formatSupportTicketCategory(ticket.category)} · {new Date(ticket.createdAt).toLocaleDateString('en-PK')}
												</p>
												<div className='mt-2 flex items-center gap-2'>
													<Input
														value={noteDraftByTicket[ticket.id] ?? ticket.advocateNote ?? ''}
														onChange={(event) =>
															setNoteDraftByTicket((current) => ({
																...current,
																[ticket.id]: event.target.value,
															}))
														}
														placeholder='Internal advocate note'
														className='h-8 text-xs'
													/>
													<Button
														type='button'
														size='sm'
														variant='outline'
														onClick={() => saveNote(ticket.id)}
														disabled={updateTicket.isPending}
													>
														Save Note
													</Button>
												</div>
											</TableCell>

											<TableCell className='align-top'>
												<p className='text-sm'>{ticket.worker.fullName}</p>
												<p className='text-xs text-muted-foreground'>{ticket.worker.email}</p>
											</TableCell>

											<TableCell className='align-top'>
												<Badge variant={supportTicketStatusTone[ticket.status]}>
													{formatSupportTicketStatus(ticket.status)}
												</Badge>
											</TableCell>

											<TableCell className='align-top'>
												<div className='space-y-2'>
													<Badge variant={supportTicketPriorityTone[ticket.priority]}>
														{formatSupportTicketPriority(ticket.priority)}
													</Badge>
													<Select
														value={ticket.priority}
														onValueChange={(value) => updatePriority(ticket.id, value as typeof ticket.priority)}
													>
														<SelectTrigger className='h-8 w-32'>
															<SelectValue placeholder='Priority' />
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
											</TableCell>

											<TableCell className='align-top text-sm text-muted-foreground'>
												{ticket.assignedAdvocate?.fullName ?? 'Unassigned'}
											</TableCell>

											<TableCell className='align-top'>
												<div className='flex flex-wrap gap-2'>
													<Button
														type='button'
														size='sm'
														variant='outline'
														onClick={() => claimTicket(ticket.id)}
														disabled={updateTicket.isPending}
													>
														Claim
													</Button>
													<Button
														type='button'
														size='sm'
														variant='secondary'
														onClick={() => updateStatus(ticket.id, 'IN_PROGRESS')}
														disabled={updateTicket.isPending}
													>
														Start
													</Button>
													<Button
														type='button'
														size='sm'
														onClick={() => updateStatus(ticket.id, 'RESOLVED')}
														disabled={updateTicket.isPending}
													>
														Resolve
													</Button>
													<Button
														type='button'
														size='sm'
														variant='destructive'
														onClick={() => updateStatus(ticket.id, 'CLOSED')}
														disabled={updateTicket.isPending}
													>
														Close
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
