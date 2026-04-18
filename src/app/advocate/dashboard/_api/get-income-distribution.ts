// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useGetIncomeDistribution = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'distribution'],
    queryFn: async () => {
      const response = await client.api.analytics.distribution.$get();

      if (!response.ok) {
        throw new Error('Failed to fetch income distribution');
      }

      return response.json();
    },
  });
};
