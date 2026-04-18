// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

export const useGetPlatformStats = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'platforms'],
    queryFn: async () => {
      const response = await fetch(
        '/api/analytics/advocate/platform-concentration-treemap',
      );

      if (!response.ok) {
        throw new Error('Failed to fetch platform stats');
      }

      return response.json();
    },
  });
};
