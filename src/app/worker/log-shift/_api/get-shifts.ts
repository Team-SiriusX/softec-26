'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

type GetShiftsFilters = {
  status?: string;
  platform?: string;
  from?: string;
  to?: string;
};

export const useGetShifts = (filters: GetShiftsFilters = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.SHIFTS, filters],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (filters.status) query.status = filters.status;
      if (filters.platform) query.platform = filters.platform;
      if (filters.from) query.from = filters.from;
      if (filters.to) query.to = filters.to;

      const response = await client.api.shifts.$get({ query });

      if (!response.ok) {
        throw new Error('Failed to fetch shifts');
      }

      return response.json();
    },
  });
};
