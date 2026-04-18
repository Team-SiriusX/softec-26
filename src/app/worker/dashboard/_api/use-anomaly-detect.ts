'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/query-keys';
import { client } from '@/lib/hono';

export const useAnomalyDetect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workerId: string) => {
      const response = await client.api.anomaly.detect.$post({
        json: { workerId },
      });
      if (!response.ok) {
        return { anomalies: [] };
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ANOMALY] });
    },
    // Fail silently — anomaly detection should not block the user
    onError: () => {},
  });
};
