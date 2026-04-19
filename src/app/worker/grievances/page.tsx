'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Flag,
  MessageSquareWarning,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

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
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-PK', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

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
  const resolvedPlatformId = platformId || platforms[0]?.id || '';
  const grievances = useMemo(
    () =>
      [...(grievanceListQuery.data?.grievances ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [grievanceListQuery.data],
  );

  const canSubmit =
    resolvedPlatformId.length > 0 &&
    description.trim().length >= 10 &&
    grievanceCategoryOptions.some((option) => option.value === category);

  const summary = useMemo(() => {
    const open = grievances.filter((row) => row.status === 'OPEN').length;
    const tagged = grievances.filter((row) => row.status === 'TAGGED').length;
    const escalated = grievances.filter((row) => row.status === 'ESCALATED').length;
    const resolved = grievances.filter((row) => row.status === 'RESOLVED').length;

    return {
      total: grievances.length,
      open,
      tagged,
      escalated,
      resolved,
    };
  }, [grievances]);

  const platformSelectDisabled =
    grievancePlatformsQuery.isLoading || platforms.length === 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    createGrievance.mutate(
      {
        platformId: resolvedPlatformId,
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
    <div className='space-y-6 lg:space-y-7'>
      <section className='relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-background to-muted/30 p-5 shadow-sm sm:p-7'>
        <div
          className='pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl'
          aria-hidden='true'
        />

        <div className='relative flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
              Grievance board
            </h1>
            <p className='max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]'>
              Report commission, payment, or account issues with structured
              evidence so advocates can review and escalate cases quickly.
            </p>

            <div className='flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground'>
              <span className='inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1'>
                <Clock3 className='size-3.5' />
                Avg review window: 24-48 hours
              </span>
              <span className='inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1'>
                <ShieldAlert className='size-3.5' />
                Anonymous mode available
              </span>
            </div>
          </div>

          <Link
            href='/worker/community-feed'
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'h-10 rounded-full px-5 font-medium',
            )}
          >
            Open community feed
          </Link>
        </div>
      </section>

      <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {[
          {
            title: 'Total Cases',
            value: summary.total,
            hint: 'All submitted grievances',
            icon: MessageSquareWarning,
          },
          {
            title: 'Open + Tagged',
            value: summary.open + summary.tagged,
            hint: `${summary.open} open / ${summary.tagged} tagged`,
            icon: Flag,
          },
          {
            title: 'Escalated',
            value: summary.escalated,
            hint: 'Currently under advocate escalation',
            icon: ArrowUpRight,
          },
          {
            title: 'Resolved',
            value: summary.resolved,
            hint: 'Closed after review process',
            icon: CheckCircle2,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title} className='border-border/70 bg-card/80 shadow-xs'>
              <CardContent className='space-y-2 p-4'>
                <div className='flex items-center justify-between gap-3'>
                  <p className='text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground'>
                    {item.title}
                  </p>
                  <span className='inline-flex rounded-md border border-border/70 bg-background/60 p-1.5 text-muted-foreground'>
                    <Icon className='size-4' />
                  </span>
                </div>
                <p className='text-xl font-semibold tracking-tight'>{item.value}</p>
                <p className='text-xs text-muted-foreground'>{item.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className='border-border/70 shadow-xs'>
        <CardHeader className='space-y-2 border-b border-border/70 bg-muted/20'>
          <CardTitle className='text-base sm:text-lg'>Submit a grievance</CardTitle>
          <CardDescription>
            Capture clear facts and impact details so the case can be verified
            and escalated faster.
          </CardDescription>
        </CardHeader>
        <CardContent className='pt-5'>
          <form className='grid gap-4 md:grid-cols-2' onSubmit={handleSubmit}>
            <div className='space-y-2'>
              <Label htmlFor='grievance-platform'>Platform</Label>
              <Select value={resolvedPlatformId} onValueChange={(value) => setPlatformId(value)}>
                <SelectTrigger id='grievance-platform' disabled={platformSelectDisabled}>
                  <SelectValue
                    placeholder={
                      grievancePlatformsQuery.isLoading
                        ? 'Loading platforms...'
                        : 'Select platform'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {grievancePlatformsQuery.isLoading ? (
                    <SelectItem value='__loading' disabled>
                      Loading platforms...
                    </SelectItem>
                  ) : platforms.length === 0 ? (
                    <SelectItem value='__empty' disabled>
                      No platforms available
                    </SelectItem>
                  ) : (
                    platforms.map((platform) => (
                      <SelectItem key={platform.id} value={platform.id}>
                        {platform.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {grievancePlatformsQuery.isError ? (
                <p className='flex items-center gap-1 text-xs text-destructive'>
                  <AlertCircle className='size-3.5' />
                  Could not load platforms. Refresh to try again.
                </p>
              ) : (
                <p className='text-xs text-muted-foreground'>
                  Pick the platform where the issue occurred.
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='grievance-category'>Category</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(value ?? 'COMMISSION_CHANGE')
                }
              >
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
              <p className='text-xs text-muted-foreground'>
                Category helps route your case to the right reviewer.
              </p>
            </div>

            <div className='space-y-2 md:col-span-2'>
              <Label htmlFor='grievance-description'>Description</Label>
              <Textarea
                id='grievance-description'
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                minLength={10}
                placeholder='Describe what happened, when it happened, and estimated financial impact.'
                className='resize-y'
              />
              <div className='flex items-center justify-between gap-3 text-xs'>
                <p className='text-muted-foreground'>
                  Minimum 10 characters. Clear details improve escalation quality.
                </p>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    description.trim().length >= 10
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {description.trim().length}/10+
                </span>
              </div>
            </div>

            <div className='flex items-center justify-between rounded-lg border border-border/70 bg-background/80 p-3 md:col-span-2'>
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

            <div className='flex flex-wrap items-center gap-3 md:col-span-2'>
              <button
                type='submit'
                disabled={!canSubmit || createGrievance.isPending}
                className={buttonVariants({ className: 'h-10 rounded-full px-5' })}
              >
                {createGrievance.isPending ? 'Submitting...' : 'Submit grievance'}
              </button>

              {!platformSelectDisabled && !canSubmit ? (
                <p className='text-xs text-muted-foreground'>
                  Complete platform, category, and description to submit.
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className='border-border/70 shadow-xs'>
        <CardHeader className='space-y-2 border-b border-border/70 bg-muted/20'>
          <CardTitle className='text-base sm:text-lg'>My grievance status</CardTitle>
          <CardDescription>
            Track status updates and advocacy progress for your submitted complaints.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4 pt-5'>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>Total: {summary.total}</Badge>
            <Badge variant='outline'>Open: {summary.open}</Badge>
            <Badge variant='outline'>Tagged: {summary.tagged}</Badge>
            <Badge variant='destructive'>Escalated: {summary.escalated}</Badge>
            <Badge>Resolved: {summary.resolved}</Badge>
          </div>

          <Separator />

          {grievanceListQuery.isLoading ? (
            <div className='space-y-3'>
              <div className='h-20 animate-pulse rounded-lg bg-muted' />
              <div className='h-20 animate-pulse rounded-lg bg-muted' />
              <div className='h-20 animate-pulse rounded-lg bg-muted' />
            </div>
          ) : grievances.length === 0 ? (
            <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-14 text-center'>
              <Sparkles className='mb-3 size-9 text-muted-foreground/50' />
              <p className='text-sm font-medium text-foreground'>
                No grievances submitted yet
              </p>
              <p className='mt-1 max-w-sm text-xs text-muted-foreground'>
                Submit your first case using the form above to start the review
                and escalation workflow.
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {grievances.map((grievance) => (
                <article key={grievance.id} className='rounded-lg border border-border/70 bg-background/80 p-4'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant={grievanceStatusTone[grievance.status]}>
                        {formatGrievanceStatus(grievance.status)}
                      </Badge>
                      <Badge variant='outline'>
                        {formatGrievanceCategory(grievance.category)}
                      </Badge>
                      {grievance.isAnonymous ? (
                        <Badge variant='secondary'>Anonymous</Badge>
                      ) : null}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {dateFormatter.format(new Date(grievance.createdAt))}
                    </p>
                  </div>

                  <p className='mt-3 text-sm leading-relaxed'>{grievance.description}</p>

                  <div className='mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground'>
                    <span className='rounded-full border border-border/70 bg-muted/30 px-2 py-1'>
                      Platform: {grievance.platform?.name ?? 'Unknown'}
                    </span>
                    <span className='rounded-full border border-border/70 bg-muted/30 px-2 py-1'>
                      Tags: {grievance.tags.length}
                    </span>
                    <span className='rounded-full border border-border/70 bg-muted/30 px-2 py-1'>
                      Escalations: {grievance.escalations.length}
                    </span>
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
