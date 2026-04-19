'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';

export type EarningsFilters = {
  platform: string;
  status: string;
  from: string;
  to: string;
};

interface EarningsFilterBarProps {
  filters: EarningsFilters;
  onChange: (filters: EarningsFilters) => void;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Awaiting review' },
  { value: 'CONFIRMED', label: 'Verified ✓' },
  { value: 'FLAGGED', label: 'Discrepancy flagged' },
  { value: 'UNVERIFIABLE', label: 'Could not be verified' },
];

export function EarningsFilterBar({ filters, onChange }: EarningsFilterBarProps) {
  const hasFilters =
    filters.platform || filters.status !== 'ALL' || filters.from || filters.to;

  const activeFiltersCount = [
    filters.platform,
    filters.status !== 'ALL' ? filters.status : '',
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  const update = (patch: Partial<EarningsFilters>) =>
    onChange({ ...filters, ...patch });

  const reset = () =>
    onChange({ platform: '', status: 'ALL', from: '', to: '' });

  return (
    <div className='rounded-xl border border-border/70 bg-background/80 p-3 sm:p-4'>
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-6'>
        <div className='space-y-1.5 xl:col-span-2'>
          <label
            htmlFor='filter-platform'
            className='text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground'
          >
            Platform
          </label>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' aria-hidden='true' />
            <Input
              id='filter-platform'
              placeholder='Search by platform name'
              value={filters.platform}
              onChange={(e) => update({ platform: e.target.value })}
              className='h-10 w-full pl-9'
              aria-label='Filter by platform name'
            />
          </div>
        </div>

        <div className='space-y-1.5 xl:col-span-2'>
          <p className='text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground'>
            Verification Status
          </p>
          <Select
            value={filters.status}
            onValueChange={(v) => update({ status: v ?? 'ALL' })}
          >
            <SelectTrigger
              className='h-10 w-full'
              aria-label='Filter by verification status'
            >
              <SelectValue placeholder='All statuses' />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5'>
          <label
            htmlFor='from-date'
            className='text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground'
          >
            From
          </label>
          <Input
            id='from-date'
            type='date'
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
            className='h-10 w-full'
            aria-label='From date'
          />
        </div>

        <div className='space-y-1.5'>
          <label
            htmlFor='to-date'
            className='text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground'
          >
            To
          </label>
          <Input
            id='to-date'
            type='date'
            value={filters.to}
            onChange={(e) => update({ to: e.target.value })}
            className='h-10 w-full'
            aria-label='To date'
          />
        </div>

        <div className='flex items-end justify-between gap-2 md:col-span-2 xl:col-span-6'>
          <p className='text-xs text-muted-foreground'>
            {hasFilters
              ? `${activeFiltersCount} active filter${activeFiltersCount > 1 ? 's' : ''}`
              : 'No active filters'}
          </p>

          {hasFilters && (
            <Button
              variant='ghost'
              size='sm'
              onClick={reset}
              className='h-9 gap-1 text-muted-foreground'
            >
              <X className='size-3.5' aria-hidden='true' />
              Clear filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
