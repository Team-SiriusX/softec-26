'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useGetShift = (id: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.SHIFT_DETAIL, id],
    queryFn: async () => {
      const response = await client.api.shifts[':id'].$get({ param: { id } });

      if (!response.ok) {
        throw new Error('Failed to fetch shift');
      }

      return response.json();
    },
    enabled: !!id,
  });
};
