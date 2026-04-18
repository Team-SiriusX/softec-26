import { MessageSquareWarning, Siren, UserRoundCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  countSameHappened,
  formatGrievanceCategory,
  formatGrievanceStatus,
  GrievanceItem,
  grievanceStatusTone,
} from '@/lib/grievance';

type GrievanceCardProps = {
  grievance: GrievanceItem;
  canMarkSameHappened?: boolean;
  hasMarkedSameHappened?: boolean;
  isTogglingSameHappened?: boolean;
  onToggleSameHappened?: () => void;
  showWorkerIdentity?: boolean;
};

export function GrievanceCard({
  grievance,
  canMarkSameHappened = false,
  hasMarkedSameHappened = false,
  isTogglingSameHappened = false,
  onToggleSameHappened,
  showWorkerIdentity = false,
}: GrievanceCardProps) {
  const supportCount = countSameHappened(grievance.tags);
  const latestNote = grievance.escalations[0]?.note;

  return (
    <Card className='border-border/60 bg-card/90 shadow-sm transition-shadow hover:shadow-md'>
      <CardHeader className='space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline'>
              {grievance.platform?.name ?? 'Unknown Platform'}
            </Badge>
            <Badge variant='secondary'>
              {formatGrievanceCategory(grievance.category)}
            </Badge>
            <Badge variant={grievanceStatusTone[grievance.status]}>
              {formatGrievanceStatus(grievance.status)}
            </Badge>
          </div>
          <p className='text-xs text-muted-foreground'>
            {new Date(grievance.createdAt).toLocaleDateString('en-PK', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <CardTitle className='text-lg'>{grievance.title}</CardTitle>
      </CardHeader>

      <CardContent className='space-y-4'>
        <p className='text-sm leading-relaxed text-foreground/90'>
          {grievance.description}
        </p>

        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          {showWorkerIdentity ? (
            <span className='inline-flex items-center gap-1'>
              <UserRoundCheck className='size-3.5' />
              {grievance.worker?.fullName ?? 'Anonymous Worker'}
            </span>
          ) : null}

          {latestNote ? (
            <span className='inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-300'>
              <MessageSquareWarning className='size-3.5' />
              Advocate note: {latestNote}
            </span>
          ) : null}

          {grievance.tags
            .filter((tag) => !tag.tag.startsWith('same-happened-'))
            .slice(0, 4)
            .map((tag) => (
              <span
                key={tag.id}
                className='rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-800 dark:text-emerald-300'
              >
                #{tag.tag}
              </span>
            ))}
        </div>

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
            <Siren className='size-3.5' />
            {supportCount} worker{supportCount === 1 ? '' : 's'} reported same issue
          </p>

          {canMarkSameHappened ? (
            <Button
              type='button'
              variant={hasMarkedSameHappened ? 'default' : 'outline'}
              size='sm'
              disabled={isTogglingSameHappened}
              onClick={onToggleSameHappened}
              className='min-h-10'
            >
              {hasMarkedSameHappened ? 'Marked: Same happened' : 'Same happened to me'}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
