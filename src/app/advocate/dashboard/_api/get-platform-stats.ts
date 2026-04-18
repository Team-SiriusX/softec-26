// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

export type CommissionHeatmapResponse = {
  cells: Array<{
    weekStart: string;
    platformId: string;
    platformName: string;
    avgCommissionPct: number;
  }>;
};

export const useGetPlatformStats = () => {
  return useQuery<CommissionHeatmapResponse>({
    queryKey: [QUERY_KEYS.ANALYTICS, 'advocate', 'commission-heatmap'],
    queryFn: async () => {
      const response = await fetch(
        '/api/analytics/advocate/commission-rate-heatmap?weeks=12',
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch platform stats');
      }

      return response.json() as Promise<CommissionHeatmapResponse>;
    },
    staleTime: 60_000,
  });
};
