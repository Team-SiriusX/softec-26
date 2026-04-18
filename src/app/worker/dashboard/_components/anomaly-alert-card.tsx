'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
}

interface AnomalyAlertCardProps {
  anomalies: Anomaly[];
}

const severityColor = {
  low: 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800',
  medium: 'border-orange-400 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700',
  high: 'border-destructive bg-destructive/5',
  critical: 'border-destructive bg-destructive/5',
};

export function AnomalyAlertCard({ anomalies }: AnomalyAlertCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || anomalies.length === 0) return null;

  const topAnomaly = anomalies.reduce(
    (prev, curr) => {
      const order = { critical: 4, high: 3, medium: 2, low: 1 };
      return order[curr.severity] > order[prev.severity] ? curr : prev;
    },
    anomalies[0],
  );

  return (
    <Alert
      className={`relative flex items-start gap-3 pr-10 ${severityColor[topAnomaly.severity]}`}
      role='alert'
    >
      <AlertTriangle className='size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400' aria-hidden='true' />
      <div className='flex-1 min-w-0'>
        <AlertDescription className='text-sm leading-relaxed font-medium'>
          {/* Use explanation verbatim as per spec */}
          {topAnomaly.explanation}
        </AlertDescription>
        {anomalies.length > 1 && (
          <p className='text-xs text-muted-foreground mt-1'>
            +{anomalies.length - 1} more{' '}
            {anomalies.length - 1 === 1 ? 'anomaly' : 'anomalies'} detected
          </p>
        )}
        <div className='mt-2'>
          <Link
            href='/worker/community-feed?source=anomaly'
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'h-8 text-xs')}
          >
            Open Community Feed →
          </Link>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label='Dismiss anomaly alert'
        className='absolute top-3 right-3 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors'
      >
        <X className='size-4' aria-hidden='true' />
      </button>
    </Alert>
  );
}
