// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

export type ZoneTreemapResponse = {
  nodes: Array<{
    cityZone: string;
    workerCount: number;
    medianNetEarned: number;
  }>;
};

export const useGetIncomeDistribution = () => {
  return useQuery<ZoneTreemapResponse>({
    queryKey: [QUERY_KEYS.ANALYTICS, 'advocate', 'zone-treemap'],
    queryFn: async () => {
      const response = await fetch(
        '/api/analytics/advocate/city-zone-treemap?weeks=12',
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch income distribution');
      }

      return response.json() as Promise<ZoneTreemapResponse>;
    },
    staleTime: 60_000,
  });
};
