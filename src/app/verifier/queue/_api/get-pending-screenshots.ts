// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useGetPendingScreenshots = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.SCREENSHOTS, 'pending'],
    queryFn: async () => {
      const response = await client.api.screenshots.$get({
        query: { status: 'PENDING' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending screenshots');
      }

      return response.json();
    },
  });
};
