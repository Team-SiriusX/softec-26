import { Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GrievanceItem } from '@/lib/grievance';

type GrievanceClusterViewProps = {
  grievances: GrievanceItem[];
};

export function GrievanceClusterView({ grievances }: GrievanceClusterViewProps) {
  const clusterMap = new Map<string, number>();

  for (const grievance of grievances) {
    if (!grievance.clusterId) continue;
    clusterMap.set(grievance.clusterId, (clusterMap.get(grievance.clusterId) ?? 0) + 1);
  }

  const clusters = [...clusterMap.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const clusteredCount = clusters.reduce((acc, row) => acc + row.count, 0);
  const unclusteredCount = Math.max(0, grievances.length - clusteredCount);

  return (
    <Card className='border-border/60 bg-card/90'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Layers3 className='size-4 text-primary' />
          Complaint Clusters
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {clusters.length === 0 ? (
          <p className='rounded-2xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground'>
            No clusters assigned yet.
          </p>
        ) : (
          <div className='space-y-2'>
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className='flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-3 py-2'
              >
                <p className='truncate text-sm font-medium'>{cluster.id}</p>
                <Badge variant='secondary'>{cluster.count} cases</Badge>
              </div>
            ))}
          </div>
        )}

        <div className='rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground'>
          {unclusteredCount} grievances are currently unclustered.
        </div>
      </CardContent>
    </Card>
  );
}
