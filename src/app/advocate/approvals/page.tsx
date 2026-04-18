'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { client } from '@/lib/hono';
import { cn } from '@/lib/utils';

type PendingApprovalUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  cityZone: string | null;
  phone: string | null;
};

type PendingApprovalsResponse = {
  users: PendingApprovalUser[];
};

type UpdateApprovalInput = {
  userId: string;
  status: 'APPROVED' | 'REJECTED';
};

const approvalsQueryKey = ['admin', 'pending-approvals'] as const;

async function fetchPendingApprovals(): Promise<PendingApprovalsResponse> {
  const response = await client.api.admin.approvals.pending.$get();

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(payload?.error ?? payload?.message ?? 'Failed to load pending approvals');
  }

  return response.json() as Promise<PendingApprovalsResponse>;
}

async function updateApprovalStatus(input: UpdateApprovalInput): Promise<void> {
  const response = await client.api.admin.approvals[':userId'].$patch({
    param: { userId: input.userId },
    json: { status: input.status },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(payload?.error ?? payload?.message ?? 'Failed to update approval status');
  }
}

function roleBadgeVariant(role: PendingApprovalUser['role']): 'default' | 'secondary' | 'outline' {
  if (role === 'ADVOCATE') return 'default';
  if (role === 'VERIFIER') return 'secondary';
  return 'outline';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AdvocateApprovalsPage() {
  const queryClient = useQueryClient();

  const approvalsQuery = useQuery<PendingApprovalsResponse, Error>({
    queryKey: approvalsQueryKey,
    queryFn: fetchPendingApprovals,
    staleTime: 30_000,
  });

  const approvalMutation = useMutation<void, Error, UpdateApprovalInput>({
    mutationFn: updateApprovalStatus,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: approvalsQueryKey });
    },
  });

  const users = approvalsQuery.data?.users ?? [];

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_5%_10%,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_96%_4%,rgba(245,158,11,0.12),transparent_38%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
        <Card className='border-border/60 bg-card/90'>
          <CardHeader className='gap-4 md:flex-row md:items-end md:justify-between'>
            <div className='space-y-2'>
              <Badge variant='outline'>Advocate Governance</Badge>
              <CardTitle className='text-3xl tracking-tight'>Account Approval Panel</CardTitle>
              <CardDescription className='max-w-3xl'>
                Approve or reject pending verifier and advocate accounts. Worker accounts are approved automatically.
              </CardDescription>
            </div>
            <Link href='/advocate/dashboard' className={cn(buttonVariants({ variant: 'outline' }))}>
              Back To Dashboard
              <ArrowRight className='size-4' />
            </Link>
          </CardHeader>
        </Card>

        <Card className='border-border/60 bg-card/90'>
          <CardHeader>
            <CardTitle className='text-base'>Pending Requests</CardTitle>
            <CardDescription>
              Pending verifier and advocate sign-ups waiting for advocate approval.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {approvalsQuery.isLoading ? (
              <Skeleton className='h-72 w-full rounded-3xl' />
            ) : approvalsQuery.isError ? (
              <div className='flex h-72 items-center justify-center rounded-3xl border border-dashed border-destructive/40 bg-destructive/5 text-sm text-destructive'>
                {approvalsQuery.error.message}
              </div>
            ) : users.length === 0 ? (
              <div className='flex h-48 items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground'>
                No pending account requests.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isUpdating =
                      approvalMutation.isPending &&
                      approvalMutation.variables?.userId === user.id;

                    return (
                      <TableRow key={user.id}>
                        <TableCell className='font-medium'>
                          <div className='space-y-1'>
                            <p>{user.fullName}</p>
                            {user.cityZone ? (
                              <p className='text-xs text-muted-foreground'>Zone: {user.cityZone}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariant(user.role)}>{user.role}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell>
                          <div className='flex items-center justify-end gap-2'>
                            <Button
                              size='sm'
                              disabled={isUpdating}
                              onClick={() => {
                                approvalMutation.mutate({
                                  userId: user.id,
                                  status: 'APPROVED',
                                });
                              }}
                            >
                              <Check className='size-4' />
                              Approve
                            </Button>
                            <Button
                              size='sm'
                              variant='destructive'
                              disabled={isUpdating}
                              onClick={() => {
                                approvalMutation.mutate({
                                  userId: user.id,
                                  status: 'REJECTED',
                                });
                              }}
                            >
                              <X className='size-4' />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
