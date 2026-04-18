// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useGetGrievances = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.GRIEVANCES],
    queryFn: async () => {
      const response = await client.api.grievances.$get();

      if (!response.ok) {
        throw new Error('Failed to fetch grievances');
      }

      return response.json();
    },
  });
};
