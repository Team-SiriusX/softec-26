// FairGig scaffold — implement logic here
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';

export const useGetIncomeDistribution = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.ANALYTICS, 'distribution'],
    queryFn: async () => {
      const response = await fetch(
        '/api/analytics/advocate/income-distribution-histogram',
      );

      if (!response.ok) {
        throw new Error('Failed to fetch income distribution');
      }

      return response.json();
    },
  });
};
