import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import VoiceOrbAgent from '@/components/advisor/voice-orb-agent';

export default function WorkerSaathiPage() {
  return (
    <div className='space-y-6'>
      <Card className='border-border/60 bg-card/95'>
        <CardHeader className='space-y-2'>
          <Badge variant='outline' className='w-fit'>
            FairGig Voice Assistant
          </Badge>
          <CardTitle className='text-3xl font-semibold tracking-tight'>
            Saathi
          </CardTitle>
          <CardDescription className='max-w-3xl text-sm'>
            Voice-only mode: click the orb, speak your question, and get guided actions.
          </CardDescription>
        </CardHeader>
      </Card>

      <VoiceOrbAgent />
    </div>
  );
}
