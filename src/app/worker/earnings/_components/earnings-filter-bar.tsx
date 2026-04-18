'use client';

import { Badge } from '@/components/ui/badge';
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

  const update = (patch: Partial<EarningsFilters>) =>
    onChange({ ...filters, ...patch });

  const reset = () =>
    onChange({ platform: '', status: 'ALL', from: '', to: '' });

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap gap-2 items-center'>
        {/* Platform search */}
        <div className='relative'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' aria-hidden='true' />
          <Input
            id='filter-platform'
            placeholder='Filter by platform'
            value={filters.platform}
            onChange={(e) => update({ platform: e.target.value })}
            className='pl-8 h-9 w-44'
            aria-label='Filter by platform name'
          />
        </div>

        {/* Status filter */}
        <Select
          value={filters.status}
          onValueChange={(v) => update({ status: v })}
        >
          <SelectTrigger className='w-48 h-9' aria-label='Filter by verification status'>
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

        {/* Date range */}
        <div className='flex items-center gap-1'>
          <Input
            type='date'
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
            className='h-9 w-36'
            aria-label='From date'
          />
          <span className='text-muted-foreground text-sm'>–</span>
          <Input
            type='date'
            value={filters.to}
            onChange={(e) => update({ to: e.target.value })}
            className='h-9 w-36'
            aria-label='To date'
          />
        </div>

        {hasFilters && (
          <Button
            variant='ghost'
            size='sm'
            onClick={reset}
            className='h-9 gap-1 text-muted-foreground'
          >
            <X className='size-3.5' aria-hidden='true' />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
