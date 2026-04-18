'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  AlertCircle,
  FileDown,
  Eye,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CertificatePage() {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [includeUnverified, setIncludeUnverified] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  useEffect(() => {
    // 6 months ago as YYYY-MM-DD
    const dateSixMonthsAgo = new Date();
    dateSixMonthsAgo.setMonth(dateSixMonthsAgo.getMonth() - 6);
    setFromDate(dateSixMonthsAgo.toISOString().split('T')[0]);

    // today as YYYY-MM-DD
    const dateToday = new Date();
    setToDate(dateToday.toISOString().split('T')[0]);
  }, []);

  async function handleGenerate() {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError('Please choose a valid date range.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setLastGenerated(null);
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_date: fromDate,
          to_date: toDate,
          include_unverified: includeUnverified,
        }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: 'Generation failed' }));
        setError(err.error || 'Generation failed');
        return;
      }

      const data = await res.json();
      // Open HTML in new tab
      const blob = new Blob([data.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setLastGenerated(data.certificate_id);
    } catch (e) {
      setError('Certificate service unavailable');
    } finally {
      setIsGenerating(false);
    }
  }

  function buildPreviewParams(autoPrint: boolean = false) {
    const params = new URLSearchParams({
      from_date: fromDate,
      to_date: toDate,
      include_unverified: String(includeUnverified),
      auto_print: String(autoPrint),
    });
    return params;
  }

  function handlePreview() {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError('Please choose a valid date range.');
      return;
    }

    const params = buildPreviewParams();
    window.open(`/api/certificates/preview?${params}`, '_blank');
  }

  function handleExportPdf() {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError('Please choose a valid date range.');
      return;
    }

    setError(null);
    setIsExportingPdf(true);
    try {
      const params = buildPreviewParams(true);
      const previewWindow = window.open(`/api/certificates/preview?${params}`, '_blank');

      if (!previewWindow) {
        setError('Please allow pop-ups to export your certificate as PDF.');
      }
    } finally {
      setIsExportingPdf(false);
    }
  }

  function handleSamplePreview() {
    window.open('/api/certificates/sample', '_blank');
  }

  return (
    <div className='mx-auto max-w-5xl space-y-6 py-8'>
      <div className='border-b border-border/70 pb-4'>
        <div className='flex items-start gap-3'>
          <FileText className='mt-1 h-6 w-6 text-primary' />
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>Income Certificate</h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              Generate a professional earnings certificate for landlords, banks,
              and formal documentation.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lastGenerated && (
        <Alert className='border-emerald-200 bg-emerald-50 text-emerald-900'>
          <CheckCircle className='h-4 w-4 text-green-600' />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            Your certificate (ID: {lastGenerated}) was generated and opened in a
            new tab.
          </AlertDescription>
        </Alert>
      )}

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]'>
        <Card>
            <CardHeader>
              <CardTitle>Certificate Options</CardTitle>
              <CardDescription>
              Select the exact period to include in your certificate.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='fromDate'>From date</Label>
                  <Input
                    id='fromDate'
                    type='date'
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='toDate'>To date</Label>
                  <Input
                    id='toDate'
                    type='date'
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>

              <div className='flex flex-row items-center justify-between rounded-lg border border-border/70 bg-muted/20 p-4'>
                <div className='space-y-0.5'>
                  <Label className='text-base'>Include pending shifts</Label>
                  <p className='text-sm text-muted-foreground'>
                    If enabled, pending rows are shown as unverified in the final certificate.
                  </p>
                </div>
                <Switch
                  checked={includeUnverified}
                  onCheckedChange={setIncludeUnverified}
                />
              </div>

              <div className='rounded-lg border border-border/70 bg-background p-4'>
                <p className='text-sm font-medium'>What this document includes</p>
                <ul className='mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground'>
                  <li>Worker and date-range details</li>
                  <li>Total net earnings, hours, and rates</li>
                  <li>Platform-by-platform financial breakdown</li>
                  <li>Public verification URL and certificate ID</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className='flex flex-wrap justify-end gap-3'>
              <Button variant='outline' onClick={handlePreview} className='gap-2'>
                <Eye className='h-4 w-4' />
                Preview Certificate
              </Button>
              <Button
                variant='secondary'
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className='gap-2'
              >
                <FileDown className='h-4 w-4' />
                {isExportingPdf ? 'Opening Print Dialog...' : 'Download PDF'}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className='gap-2'
              >
                {isGenerating ? 'Generating...' : 'Open HTML Certificate'}
              </Button>
            </CardFooter>
        </Card>

        <Card className='flex h-full flex-col'>
            <CardHeader>
              <CardTitle>Sample Preview</CardTitle>
              <CardDescription>
              Review a sample of the professional template.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4 text-sm text-muted-foreground'>
              <p>
                Use this if you want to check layout and structure before generating
                your own certificate.
              </p>
              <div className='rounded-lg border border-dashed border-border/80 p-4'>
                <p className='font-medium text-foreground'>Professional format</p>
                <p className='mt-1'>Letterhead, summary table, platform details, and verification block.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant='outline'
                className='w-full'
                onClick={handleSamplePreview}
              >
                View Sample Certificate
              </Button>
            </CardFooter>
        </Card>
      </div>

      <Card className='border-border/70 bg-muted/15'>
        <CardContent className='pt-6 text-sm text-muted-foreground'>
          <div className='flex items-start gap-2'>
            <CalendarIcon className='mt-0.5 h-4 w-4' />
            <p>
              PDF export opens the print dialog in a new tab. Choose <span className='font-medium text-foreground'>Save as PDF</span> as destination.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
