'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { GrievanceClusterView } from './_components/grievance-cluster-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { QUERY_KEYS } from '@/constants/query-keys';
import {
  formatGrievanceCategory,
  formatGrievanceStatus,
  GrievanceCategory,
  GrievanceItem,
  GrievanceStatus,
  grievanceCategoryOptions,
  grievanceStatusOptions,
} from '@/lib/grievance';
import {
  useAddGrievanceTag,
  useEscalateGrievance,
  useGetGrievancePlatforms,
  useGetGrievances,
  useResolveGrievance,
  useUpdateGrievance,
} from '@/hooks/use-grievances';

const ADVOCATE_PAGE_LIMIT = 120;

export default function AdvocateGrievancesPage() {
  const queryClient = useQueryClient();

  const [platformFilter, setPlatformFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<GrievanceCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GrievanceStatus | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [clusterInput, setClusterInput] = useState('');
  const [escalationNote, setEscalationNote] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const filters = useMemo(
    () => ({
      platformId: platformFilter === 'all' ? undefined : platformFilter,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: ADVOCATE_PAGE_LIMIT,
    }),
    [platformFilter, categoryFilter, statusFilter],
  );

  const grievancesQuery = useGetGrievances(filters);
  const platformsQuery = useGetGrievancePlatforms();

  const addTag = useAddGrievanceTag();
  const updateGrievance = useUpdateGrievance();
  const escalateGrievance = useEscalateGrievance();
  const resolveGrievance = useResolveGrievance();

  const grievances = grievancesQuery.data?.grievances ?? [];

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    grievances.length > 0 && grievances.every((grievance) => selectedSet.has(grievance.id));

  const isMutating =
    addTag.isPending ||
    updateGrievance.isPending ||
    escalateGrievance.isPending ||
    resolveGrievance.isPending;

  const toggleRow = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }

      return [...current, id];
    });
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(grievances.map((grievance) => grievance.id));
  };

  const runBulk = async (
    items: string[],
    runner: (id: string) => Promise<unknown>,
    successMessage: string,
  ) => {
    if (items.length === 0) {
      toast.error('Select at least one grievance first');
      return;
    }

    const outcomes = await Promise.allSettled(items.map((id) => runner(id)));
    const successCount = outcomes.filter((result) => result.status === 'fulfilled').length;

    if (successCount > 0) {
      toast.success(`${successMessage} (${successCount}/${items.length})`);
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCES_LIST] });
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GRIEVANCE_STATS] });
    }

    if (successCount !== items.length) {
      toast.error(`Some updates failed (${items.length - successCount} failed)`);
    }
  };

  const applyTag = async () => {
    const normalized = tagInput.trim().toLowerCase();
    if (!normalized) {
      toast.error('Enter a tag before applying');
      return;
    }

    await runBulk(
      selectedIds,
      (id) => addTag.mutateAsync({ id, tag: normalized }),
      'Tag applied',
    );
  };

  const applyCluster = async () => {
    const clusterId = clusterInput.trim();
    if (!clusterId) {
      toast.error('Enter a cluster ID first');
      return;
    }

    await runBulk(
      selectedIds,
      (id) =>
        updateGrievance.mutateAsync({
          id,
          status: 'TAGGED',
          clusterId,
        }),
      'Cluster assigned',
    );
  };

  const markTagged = async () => {
    const openIds = grievances
      .filter((grievance) => selectedSet.has(grievance.id) && grievance.status === 'OPEN')
      .map((grievance) => grievance.id);

    await runBulk(
      openIds,
      (id) => updateGrievance.mutateAsync({ id, status: 'TAGGED' }),
      'Marked as tagged',
    );
  };

  const escalate = async () => {
    if (escalationNote.trim().length < 5) {
      toast.error('Escalation note must be at least 5 characters');
      return;
    }

    await runBulk(
      selectedIds,
      (id) => escalateGrievance.mutateAsync({ id, note: escalationNote.trim() }),
      'Escalated for action',
    );
  };

  const resolve = async () => {
    await runBulk(
      selectedIds,
      (id) =>
        resolveGrievance.mutateAsync({
          id,
          note: resolutionNote.trim() || undefined,
        }),
      'Marked as resolved',
    );
  };

  const latestNote = (grievance: GrievanceItem) => grievance.escalations[0]?.note ?? '-';

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_90%_3%,rgba(251,146,60,0.16),transparent_38%)] px-4 py-8 md:px-8'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
        <Card className='border-border/60 bg-card/90'>
          <CardHeader className='space-y-2'>
            <Badge variant='outline' className='w-fit'>
              Advocate Moderation
            </Badge>
            <CardTitle className='text-2xl'>Grievance Management Panel</CardTitle>
            <p className='text-sm text-muted-foreground'>
              Filter complaints, tag recurring issues, cluster similar reports,
              and move cases through open, tagged, escalated, and resolved states.
            </p>
          </CardHeader>
        </Card>

        <section className='grid gap-4 lg:grid-cols-[1fr_320px]'>
          <div className='space-y-4'>
            <Card className='border-border/60 bg-card/90'>
              <CardContent className='grid gap-3 p-4 md:grid-cols-3'>
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
              </CardContent>
            </Card>

            <Card className='border-border/60 bg-card/90'>
              <CardHeader>
                <CardTitle className='text-base'>Bulk actions</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-2 md:grid-cols-2'>
                  <Input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder='Tag label (e.g. commission-spike)'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    onClick={applyTag}
                    disabled={isMutating}
                  >
                    Apply Tag
                  </Button>
                </div>

                <div className='grid gap-2 md:grid-cols-2'>
                  <Input
                    value={clusterInput}
                    onChange={(event) => setClusterInput(event.target.value)}
                    placeholder='Cluster ID (e.g. cluster-commission-apr)'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    onClick={applyCluster}
                    disabled={isMutating}
                  >
                    Assign Cluster
                  </Button>
                </div>

                <div className='grid gap-2 md:grid-cols-2'>
                  <Input
                    value={escalationNote}
                    onChange={(event) => setEscalationNote(event.target.value)}
                    placeholder='Escalation note for selected complaints'
                  />
                  <Button
                    type='button'
                    variant='destructive'
                    onClick={escalate}
                    disabled={isMutating}
                  >
                    Escalate Selected
                  </Button>
                </div>

                <div className='grid gap-2 md:grid-cols-2'>
                  <Input
                    value={resolutionNote}
                    onChange={(event) => setResolutionNote(event.target.value)}
                    placeholder='Optional resolution note for workers'
                  />
                  <Button
                    type='button'
                    onClick={resolve}
                    disabled={isMutating}
                  >
                    Resolve Selected
                  </Button>
                </div>

                <Button
                  type='button'
                  variant='secondary'
                  onClick={markTagged}
                  disabled={isMutating}
                >
                  Mark Selected as Tagged
                </Button>
              </CardContent>
            </Card>

            <Card className='border-border/60 bg-card/90'>
              <CardHeader>
                <CardTitle className='text-base'>Complaint Queue</CardTitle>
              </CardHeader>
              <CardContent>
                {grievancesQuery.isLoading ? (
                  <Skeleton className='h-56 rounded-3xl' />
                ) : grievances.length === 0 ? (
                  <p className='rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground'>
                    No complaints match these filters.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-10'>
                          <input
                            type='checkbox'
                            checked={allVisibleSelected}
                            onChange={toggleAll}
                            aria-label='Select all grievances'
                            className='size-4 rounded border border-input accent-primary'
                          />
                        </TableHead>
                        <TableHead>Complaint</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Latest Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grievances.map((grievance) => (
                        <TableRow key={grievance.id}>
                          <TableCell>
                            <input
                              type='checkbox'
                              checked={selectedSet.has(grievance.id)}
                              onChange={() => toggleRow(grievance.id)}
                              aria-label={`Select grievance ${grievance.id}`}
                              className='size-4 rounded border border-input accent-primary'
                            />
                          </TableCell>
                          <TableCell className='min-w-70'>
                            <p className='truncate font-medium'>{grievance.title}</p>
                            <p className='line-clamp-2 text-xs text-muted-foreground'>
                              {grievance.description}
                            </p>
                            <p className='mt-1 text-[11px] text-muted-foreground'>
                              {grievance.platform?.name ?? 'Unknown Platform'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant='outline'>
                              {formatGrievanceStatus(grievance.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className='text-xs'>
                              {formatGrievanceCategory(grievance.category)}
                            </span>
                          </TableCell>
                          <TableCell className='max-w-65 whitespace-normal text-xs text-muted-foreground'>
                            {latestNote(grievance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className='space-y-4'>
            <GrievanceClusterView grievances={grievances} />

            <Card className='border-border/60 bg-card/90'>
              <CardHeader>
                <CardTitle className='text-base'>Selection Snapshot</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-sm text-muted-foreground'>
                <p>{selectedIds.length} selected complaints</p>
                <p>
                  Status mix:{' '}
                  {grievanceStatusOptions
                    .map((status) => {
                      const count = grievances.filter(
                        (grievance) =>
                          selectedSet.has(grievance.id) &&
                          grievance.status === status.value,
                      ).length;

                      return `${status.label}: ${count}`;
                    })
                    .join(' · ')}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
