import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useGetSample = () => {
  const query = useQuery({
    queryKey: [QUERY_KEYS.SAMPLE],
    queryFn: async () => {
      const response = await client.api.sample.$get({
        query: { name: 'SURGE' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Analytics');
      }

      const res = await response.json();
      return res;
    },
  });

  return query;
};
