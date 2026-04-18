'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useGetMedian = (category?: string, zone?: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.MEDIAN, category, zone],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (category) query.category = category;
      if (zone) query.zone = zone;

      const response = await client.api.analytics.median.$get({ query });

      if (!response.ok) {
        throw new Error('Failed to fetch city median');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
};
