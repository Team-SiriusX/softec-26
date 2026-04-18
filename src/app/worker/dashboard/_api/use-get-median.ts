'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

type CityMedianResponse = {
  median_hourly: number | null;
  median_income: number | null;
  avg_commission_rate: number | null;
  sample_size: number;
  city_zone?: string;
  category?: string;
  message?: string;
};

export const useGetMedian = (category?: string, zone?: string) => {
  return useQuery<CityMedianResponse>({
    queryKey: [QUERY_KEYS.CITY_MEDIAN, category, zone],
    queryFn: async () => {
      const query: Record<string, string> = {};
      if (category) query.category = category;
      if (zone) query.cityZone = zone;

      const response = await client.api.anomaly['city-median'].$get({ query });

      if (!response.ok) {
        throw new Error('Failed to fetch city median');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
};
