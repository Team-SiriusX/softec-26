'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { GrievanceCard } from './_components/grievance-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  GrievanceCategory,
  GrievanceStatus,
  grievanceCategoryOptions,
  grievanceStatusOptions,
  makeSameHappenedTag,
} from '@/lib/grievance';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  useAddGrievanceTag,
  useCreateGrievance,
  useGetGrievancePlatforms,
  useGetGrievanceStats,
  useGetGrievances,
  useRemoveGrievanceTag,
} from '@/hooks/use-grievances';

const complaintSchema = z.object({
  platformId: z.string().min(1, 'Choose a platform'),
  category: z.enum([
    'COMMISSION_CHANGE',
    'ACCOUNT_DEACTIVATION',
    'PAYMENT_DISPUTE',
    'UNFAIR_RATING',
    'SAFETY_CONCERN',
    'OTHER',
  ]),
  description: z
    .string()
    .min(10, 'Please share at least 10 characters')
    .max(2000, 'Please keep it under 2000 characters'),
  isAnonymous: z.boolean(),
});

type ComplaintFormValues = z.infer<typeof complaintSchema>;

const FEED_LIMIT = 80;

export default function CommunityBoardPage() {
  const { user } = useCurrentUser();
  const isSignedIn = Boolean(user?.id);

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<GrievanceCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GrievanceStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const grievanceFilters = useMemo(
    () => ({
      platformId: platformFilter === 'all' ? undefined : platformFilter,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: FEED_LIMIT,
    }),
    [platformFilter, categoryFilter, statusFilter],
  );

  const grievanceQuery = useGetGrievances(grievanceFilters);
  const myGrievanceQuery = useGetGrievances(
    { workerId: user?.id, limit: FEED_LIMIT },
    Boolean(user?.id),
  );
  const platformsQuery = useGetGrievancePlatforms();
  const statsQuery = useGetGrievanceStats();

  const createGrievance = useCreateGrievance();
  const addTag = useAddGrievanceTag();
  const removeTag = useRemoveGrievanceTag();

  const form = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintSchema),
    defaultValues: {
      platformId: '',
      category: 'OTHER',
      description: '',
      isAnonymous: false,
    },
  });

  const filteredFeed = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    const grievances = grievanceQuery.data?.grievances ?? [];

    if (!normalized) {
      return grievances;
    }

    return grievances.filter((grievance) => {
      const workerName = grievance.worker?.fullName ?? '';
      const platformName = grievance.platform?.name ?? '';

      return [
        grievance.title,
        grievance.description,
        workerName,
        platformName,
        grievance.category,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [grievanceQuery.data?.grievances, searchTerm]);

  const onCreateComplaint = (values: ComplaintFormValues) => {
    createGrievance.mutate(values, {
      onSuccess: () => {
        form.reset({
          platformId: '',
          category: values.category,
          description: '',
          isAnonymous: false,
        });
      },
    });
  };

  const toggleSameHappened = async (grievanceId: string, hasMarked: boolean) => {
    if (!user?.id) {
      return;
    }

    const sameTag = makeSameHappenedTag(user.id);

    if (hasMarked) {
      await removeTag.mutateAsync({ id: grievanceId, tag: sameTag });
      return;
    }

    await addTag.mutateAsync({ id: grievanceId, tag: sameTag });
  };

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_5%_2%,rgba(34,197,94,0.14),transparent_35%),radial-gradient(circle_at_100%_90%,rgba(14,165,233,0.14),transparent_34%)] px-4 py-8 md:px-8'>
      <div className='mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[360px_1fr]'>
        <section className='space-y-4'>
          <Card className='border-border/60 bg-card/90'>
            <CardHeader className='space-y-2'>
              <Badge variant='outline' className='w-fit'>
                Worker Community
              </Badge>
              <CardTitle className='text-2xl'>Grievance Board</CardTitle>
              <p className='text-sm text-muted-foreground'>
                Share platform issues, spot recurring patterns, and help advocates
                escalate systemic unfairness.
              </p>
            </CardHeader>
            <CardContent className='grid grid-cols-3 gap-2 text-center'>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-3 py-2'>
                <p className='text-xl font-semibold'>
                  {statsQuery.data?.total ?? '--'}
                </p>
                <p className='text-xs text-muted-foreground'>Total</p>
              </div>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-3 py-2'>
                <p className='text-xl font-semibold'>
                  {statsQuery.data?.openCount ?? '--'}
                </p>
                <p className='text-xs text-muted-foreground'>Open</p>
              </div>
              <div className='rounded-2xl border border-border/60 bg-muted/30 px-3 py-2'>
                <p className='text-xl font-semibold'>
                  {statsQuery.data?.thisWeekCount ?? '--'}
                </p>
                <p className='text-xs text-muted-foreground'>This Week</p>
              </div>
            </CardContent>
          </Card>

          <Card className='border-border/60 bg-card/90'>
            <CardHeader>
              <CardTitle className='text-lg'>Post a complaint</CardTitle>
            </CardHeader>
            <CardContent>
              {!isSignedIn ? (
                <p className='rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground'>
                  Sign in to post grievances and mark similar complaints.
                </p>
              ) : (
                <form
                  onSubmit={form.handleSubmit(onCreateComplaint)}
                  className='space-y-5'
                  noValidate
                >
                  <FieldGroup>
                    <Controller
                      control={form.control}
                      name='platformId'
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor='platformId'>Platform</FieldLabel>
                          <FieldContent>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                id='platformId'
                                aria-invalid={fieldState.invalid}
                                className='w-full'
                              >
                                <SelectValue placeholder='Select a platform' />
                              </SelectTrigger>
                              <SelectContent>
                                {(platformsQuery.data ?? []).map((platform) => (
                                  <SelectItem key={platform.id} value={platform.id}>
                                    {platform.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FieldError errors={[fieldState.error]} />
                          </FieldContent>
                        </Field>
                      )}
                    />

                    <Controller
                      control={form.control}
                      name='category'
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor='category'>Category</FieldLabel>
                          <FieldContent>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                id='category'
                                aria-invalid={fieldState.invalid}
                                className='w-full'
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {grievanceCategoryOptions.map((category) => (
                                  <SelectItem
                                    key={category.value}
                                    value={category.value}
                                  >
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FieldError errors={[fieldState.error]} />
                          </FieldContent>
                        </Field>
                      )}
                    />

                    <Controller
                      control={form.control}
                      name='description'
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor='description'>Description</FieldLabel>
                          <FieldContent>
                            <Textarea
                              id='description'
                              rows={5}
                              placeholder='Explain what happened in plain language. Include dates, amounts, or sudden platform changes if you can.'
                              aria-invalid={fieldState.invalid}
                              {...field}
                            />
                            <FieldDescription>
                              Honest details help advocates identify repeated abuse.
                            </FieldDescription>
                            <FieldError errors={[fieldState.error]} />
                          </FieldContent>
                        </Field>
                      )}
                    />

                    <Controller
                      control={form.control}
                      name='isAnonymous'
                      render={({ field }) => (
                        <Field>
                          <FieldLabel htmlFor='isAnonymous'>
                            <input
                              id='isAnonymous'
                              type='checkbox'
                              checked={field.value}
                              onChange={(event) => field.onChange(event.target.checked)}
                              className='size-4 rounded border border-input accent-primary'
                            />
                            Post anonymously
                          </FieldLabel>
                          <FieldContent>
                            <FieldDescription>
                              Your name will be hidden as Anonymous Worker in the
                              community feed.
                            </FieldDescription>
                          </FieldContent>
                        </Field>
                      )}
                    />
                  </FieldGroup>

                  <Button
                    type='submit'
                    className='w-full min-h-11'
                    disabled={createGrievance.isPending}
                  >
                    {createGrievance.isPending ? 'Posting...' : 'Post Complaint'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </section>

        <section className='space-y-4'>
          <Card className='border-border/60 bg-card/90'>
            <CardContent className='grid gap-3 p-4 md:grid-cols-4'>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Search descriptions or platform'
                className='md:col-span-2'
              />

              <Select
                value={platformFilter}
                onValueChange={(value) => setPlatformFilter(value ?? 'all')}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Platform' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All platforms</SelectItem>
                  {(platformsQuery.data ?? []).map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className='grid grid-cols-2 gap-2'>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) =>
                    setCategoryFilter((value ?? 'all') as GrievanceCategory | 'all')
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Category' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All categories</SelectItem>
                    {grievanceCategoryOptions.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter((value ?? 'all') as GrievanceStatus | 'all')
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Status' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All status</SelectItem>
                    {grievanceStatusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue='feed'>
            <TabsList>
              <TabsTrigger value='feed'>Community Feed</TabsTrigger>
              <TabsTrigger value='mine'>My Complaints</TabsTrigger>
            </TabsList>

            <TabsContent value='feed' className='space-y-3'>
              {grievanceQuery.isLoading ? (
                <div className='space-y-3'>
                  <Skeleton className='h-44 rounded-3xl' />
                  <Skeleton className='h-44 rounded-3xl' />
                </div>
              ) : filteredFeed.length === 0 ? (
                <Card className='border-dashed'>
                  <CardContent className='p-6 text-sm text-muted-foreground'>
                    No matching grievances yet. Try adjusting filters or post the
                    first complaint.
                  </CardContent>
                </Card>
              ) : (
                filteredFeed.map((grievance) => {
                  const userTag = user?.id ? makeSameHappenedTag(user.id) : null;
                  const hasMarked =
                    userTag !== null &&
                    grievance.tags.some((tag) => tag.tag === userTag);

                  return (
                    <GrievanceCard
                      key={grievance.id}
                      grievance={grievance}
                      showWorkerIdentity
                      canMarkSameHappened={isSignedIn}
                      hasMarkedSameHappened={hasMarked}
                      isTogglingSameHappened={
                        addTag.isPending || removeTag.isPending
                      }
                      onToggleSameHappened={() =>
                        toggleSameHappened(grievance.id, Boolean(hasMarked))
                      }
                    />
                  );
                })
              )}
            </TabsContent>

            <TabsContent value='mine' className='space-y-3'>
              {!isSignedIn ? (
                <Card className='border-dashed'>
                  <CardContent className='p-6 text-sm text-muted-foreground'>
                    Sign in to view your complaint history and status updates.
                  </CardContent>
                </Card>
              ) : myGrievanceQuery.isLoading ? (
                <Skeleton className='h-44 rounded-3xl' />
              ) : (myGrievanceQuery.data?.grievances.length ?? 0) === 0 ? (
                <Card className='border-dashed'>
                  <CardContent className='p-6 text-sm text-muted-foreground'>
                    You have not submitted any complaints yet.
                  </CardContent>
                </Card>
              ) : (
                myGrievanceQuery.data?.grievances.map((grievance) => (
                  <GrievanceCard key={grievance.id} grievance={grievance} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </main>
  );
}
