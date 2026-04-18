import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ShiftForm } from './_components/shift-form';
import { CsvUpload } from './_components/csv-upload';
import { Suspense } from 'react';

export const metadata = {
  title: 'Log a Shift — FairGig',
  description: 'Record your earnings from a gig platform shift.',
};

export default function WorkerLogShiftPage() {
  return (
    <div className='space-y-6 max-w-xl'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Log a Shift</h1>
        <p className='text-sm text-muted-foreground mt-1'>
          Record your earnings for a shift. All amounts in PKR.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Shift details</CardTitle>
          <CardDescription>
            Enter the details exactly as shown in your platform app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <ShiftForm />
          </Suspense>
        </CardContent>
      </Card>

      <Separator />

      {/* CSV import — secondary action, not prominent */}
      <details className='group'>
        <summary className='text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1 select-none'>
          <span className='group-open:rotate-90 transition-transform inline-block'>▶</span>
          Import multiple shifts via CSV
        </summary>
        <Card className='mt-3'>
          <CardHeader>
            <CardTitle className='text-base'>CSV Bulk Import</CardTitle>
            <CardDescription>
              Upload a CSV file to import multiple shifts at once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CsvUpload />
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
