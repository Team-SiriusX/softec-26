'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

import { useCurrentUser } from '@/hooks/use-current-user';
import {
  useCreateGrievance,
  useGetGrievancePlatforms,
  useGetGrievances,
} from '@/hooks/use-grievances';
import {
  formatGrievanceCategory,
  formatGrievanceStatus,
  grievanceCategoryOptions,
  grievanceStatusTone,
} from '@/lib/grievance';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export default function WorkerGrievancesPage() {
  const [platformId, setPlatformId] = useState('');
  const [category, setCategory] = useState<string>('COMMISSION_CHANGE');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { user } = useCurrentUser();
  const workerId = user?.id;

  const grievancePlatformsQuery = useGetGrievancePlatforms(Boolean(workerId));
  const grievanceListQuery = useGetGrievances(
    {
      workerId,
      limit: 25,
    },
    Boolean(workerId),
  );

  const createGrievance = useCreateGrievance();

  const platforms = grievancePlatformsQuery.data ?? [];
  const grievances = useMemo(
    () => grievanceListQuery.data?.grievances ?? [],
    [grievanceListQuery.data?.grievances],
  );

  const canSubmit =
    platformId.length > 0 &&
    description.trim().length >= 10 &&
    grievanceCategoryOptions.some((option) => option.value === category);

  const summary = useMemo(() => {
    const open = grievances.filter((row) => row.status === 'OPEN').length;
    const escalated = grievances.filter((row) => row.status === 'ESCALATED').length;
    const resolved = grievances.filter((row) => row.status === 'RESOLVED').length;

    return {
      total: grievances.length,
      open,
      escalated,
      resolved,
    };
  }, [grievances]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    createGrievance.mutate(
      {
        platformId,
        category: category as (typeof grievanceCategoryOptions)[number]['value'],
        description: description.trim(),
        isAnonymous,
      },
      {
        onSuccess: () => {
          setDescription('');
          setIsAnonymous(false);
        },
      },
    );
  };

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Grievance Board</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Submit complaints about commissions, deductions, and account issues. Advocates
            review and escalate validated cases.
          </p>
        </div>
        <Link href='/worker/community-feed' className={buttonVariants({ variant: 'outline' })}>
          Open Community Feed
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Post A Grievance</CardTitle>
          <CardDescription>
            Include enough details for advocates to verify what happened.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className='grid gap-4 md:grid-cols-2' onSubmit={handleSubmit}>
            <div className='space-y-2'>
              <Label htmlFor='grievance-platform'>Platform</Label>
              <Select value={platformId} onValueChange={(value) => setPlatformId(value ?? '')}>
                <SelectTrigger id='grievance-platform'>
                  <SelectValue placeholder='Select platform' />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='grievance-category'>Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value ?? 'COMMISSION_CHANGE')}>
                <SelectTrigger id='grievance-category'>
                  <SelectValue placeholder='Select category' />
                </SelectTrigger>
                <SelectContent>
                  {grievanceCategoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2 md:col-span-2'>
              <Label htmlFor='grievance-description'>Description</Label>
              <Textarea
                id='grievance-description'
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                minLength={10}
                placeholder='Describe what happened, when it happened, and estimated financial impact.'
              />
              <p className='text-xs text-muted-foreground'>
                Minimum 10 characters. Clear details improve escalation quality.
              </p>
            </div>

            <div className='flex items-center justify-between rounded-md border p-3 md:col-span-2'>
              <div>
                <Label htmlFor='grievance-anonymous' className='text-sm'>
                  Post anonymously
                </Label>
                <p className='text-xs text-muted-foreground'>
                  Your identity will be hidden from public listings.
                </p>
              </div>
              <Switch
                id='grievance-anonymous'
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
            </div>

            <div className='md:col-span-2'>
              <button
                type='submit'
                disabled={!canSubmit || createGrievance.isPending}
                className={buttonVariants({ className: 'w-full md:w-auto' })}
              >
                {createGrievance.isPending ? 'Submitting...' : 'Submit grievance'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>My Grievance Status</CardTitle>
          <CardDescription>
            Track status updates and advocacy progress for your submitted complaints.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>Total: {summary.total}</Badge>
            <Badge variant='outline'>Open: {summary.open}</Badge>
            <Badge variant='destructive'>Escalated: {summary.escalated}</Badge>
            <Badge>Resolved: {summary.resolved}</Badge>
          </div>

          <Separator />

          {grievanceListQuery.isLoading ? (
            <div className='space-y-3'>
              <div className='h-16 animate-pulse rounded-md bg-muted' />
              <div className='h-16 animate-pulse rounded-md bg-muted' />
            </div>
          ) : grievances.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No grievances yet. Submit one to start the review workflow.
            </p>
          ) : (
            <div className='space-y-3'>
              {grievances.map((grievance) => (
                <article key={grievance.id} className='rounded-md border p-3'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant={grievanceStatusTone[grievance.status]}>
                        {formatGrievanceStatus(grievance.status)}
                      </Badge>
                      <Badge variant='outline'>{formatGrievanceCategory(grievance.category)}</Badge>
                      {grievance.isAnonymous ? <Badge variant='secondary'>Anonymous</Badge> : null}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {new Date(grievance.createdAt).toLocaleDateString('en-PK')}
                    </p>
                  </div>

                  <p className='mt-2 text-sm leading-relaxed'>{grievance.description}</p>

                  <div className='mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground'>
                    <span>Platform: {grievance.platform?.name ?? 'Unknown'}</span>
                    <span>Tags: {grievance.tags.length}</span>
                    <span>Escalations: {grievance.escalations.length}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
