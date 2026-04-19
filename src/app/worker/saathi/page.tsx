import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdvisorWidget from '@/components/advisor/AdvisorWidget';

export default function WorkerSaathiPage() {
  return (
    <div className='space-y-6'>
      <Card className='border-border/60 bg-card/95'>
        <CardHeader className='space-y-2'>
          <Badge variant='outline' className='w-fit'>
            FairGig Assistant
          </Badge>
          <CardTitle className='text-3xl font-semibold tracking-tight'>
            Saathi
          </CardTitle>
          <CardDescription className='max-w-3xl text-sm'>
            Ask about earnings, anomaly flags, policy context, and recommended next actions.
          </CardDescription>
        </CardHeader>
      </Card>

      <AdvisorWidget mode='page' />
    </div>
  );
}
