// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useGetShifts = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.SHIFTS],
    queryFn: async () => {
      const response = await client.api.shifts.$get();

      if (!response.ok) {
        throw new Error('Failed to fetch shifts');
      }

      return response.json();
    },
  });
};
