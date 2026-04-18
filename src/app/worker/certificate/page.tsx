'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calendar as CalendarIcon,
  Building,
  CheckCircle,
  AlertCircle,
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

type CertificateVerificationResponse = {
  is_valid: boolean;
  message: string;
  certificate?: {
    certificate_id: string;
    worker_id: string;
    worker_name: string | null;
    from_date: string;
    to_date: string;
    total_verified: number;
    shift_count: number;
    platforms: string[];
    status: string;
    generated_at: string;
    expires_at: string | null;
    is_expired: boolean;
  } | null;
};

export default function CertificatePage() {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [includeUnverified, setIncludeUnverified] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
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

  function handlePreview() {
    const params = new URLSearchParams({
      from_date: fromDate,
      to_date: toDate,
      include_unverified: String(includeUnverified),
    });
    window.open(`/api/certificates/preview?${params}`, '_blank');
  }

  function handleSamplePreview() {
    window.open('/api/certificates/sample', '_blank');
  }

  return (
    <div className='container mx-auto max-w-4xl space-y-8 py-8'>
      {/* SECTION 1 — Page header */}
      <div>
        <div className='flex items-center space-x-3 border-b pb-4 text-slate-900'>
          <FileText className='h-8 w-8 text-blue-500' />
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              Income Certificate
            </h1>
            <p className='mt-1 text-slate-500'>
              Generate a verified earnings summary for landlords, banks, or
              official use
            </p>
          </div>
        </div>
      </div>

      {/* Error & Success States */}
      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lastGenerated && (
        <Alert className='border-green-200 bg-green-50 text-green-900'>
          <CheckCircle className='h-4 w-4 text-green-600' />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            Your certificate (ID: {lastGenerated}) was generated and opened in a
            new tab.
          </AlertDescription>
        </Alert>
      )}

      {/* SECTION 2 & 4 Container */}
      <div className='grid gap-8 md:grid-cols-3'>
        {/* SECTION 2 — Certificate generator form card */}
        <div className='md:col-span-2'>
          <Card>
            <CardHeader>
              <CardTitle>Certificate Options</CardTitle>
              <CardDescription>
                Select the date range for your certificate.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='fromDate'>From Date</Label>
                  <Input
                    id='fromDate'
                    type='date'
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='toDate'>To Date</Label>
                  <Input
                    id='toDate'
                    type='date'
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>

              <div className='flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm'>
                <div className='space-y-0.5'>
                  <Label className='text-base'>Include pending shifts</Label>
                  <p className='text-sm text-slate-500'>
                    Pending shifts are clearly marked as unverified on the
                    certificate
                  </p>
                </div>
                <Switch
                  checked={includeUnverified}
                  onCheckedChange={setIncludeUnverified}
                />
              </div>
            </CardContent>
            <CardFooter className='flex justify-end space-x-4'>
              <Button variant='outline' onClick={handlePreview}>
                Preview Certificate
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className='bg-blue-600 hover:bg-blue-700'
              >
                {isGenerating ? 'Generating...' : 'Generate & Download'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* SECTION 4 — Sample preview card */}
        <div className='md:col-span-1'>
          <Card className='flex h-full flex-col'>
            <CardHeader>
              <CardTitle>Certificate Preview</CardTitle>
              <CardDescription>
                See what your certificate looks like
              </CardDescription>
            </CardHeader>
            <CardContent className='flex grow items-center justify-center py-6'>
              <FileText className='h-16 w-16 text-slate-200' />
            </CardContent>
            <CardFooter>
              <Button
                variant='secondary'
                className='w-full'
                onClick={handleSamplePreview}
              >
                View Sample Certificate
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* SECTION 5 — How to print callout */}
      <div className='rounded-lg border border-blue-100 bg-blue-50 p-5'>
        <div className='flex'>
          <div className='shrink-0'>
            <FileText className='h-5 w-5 text-blue-400' />
          </div>
          <div className='ml-3'>
            <h3 className='text-sm font-medium text-blue-800'>How to print:</h3>
            <div className='mt-2 text-sm text-blue-700'>
              <p>
                Click 'Preview Certificate', then use the Print button on the
                certificate page, or press Ctrl+P (Cmd+P on Mac). Select 'Save
                as PDF' to create a file.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 — Info cards row */}
      <div className='grid gap-6 md:grid-cols-3'>
        <Card className='border-slate-100 bg-slate-50'>
          <CardHeader className='pb-3 text-center'>
            <div className='mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 p-2'>
              <CheckCircle className='h-5 w-5 text-blue-600' />
            </div>
            <CardTitle className='text-sm font-semibold'>
              Verified Earnings
            </CardTitle>
          </CardHeader>
          <CardContent className='text-center text-xs text-slate-500'>
            <p>
              Only shifts confirmed by a FairGig verifier are included by
              default
            </p>
          </CardContent>
        </Card>

        <Card className='border-slate-100 bg-slate-50'>
          <CardHeader className='pb-3 text-center'>
            <div className='mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 p-2'>
              <CalendarIcon className='h-5 w-5 text-blue-600' />
            </div>
            <CardTitle className='text-sm font-semibold'>Date Range</CardTitle>
          </CardHeader>
          <CardContent className='text-center text-xs text-slate-500'>
            <p>Cover any period from your first logged shift</p>
          </CardContent>
        </Card>

        <Card className='border-slate-100 bg-slate-50'>
          <CardHeader className='pb-3 text-center'>
            <div className='mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 p-2'>
              <Building className='h-5 w-5 text-blue-600' />
            </div>
            <CardTitle className='text-sm font-semibold'>
              Bank & Landlord Ready
            </CardTitle>
          </CardHeader>
          <CardContent className='text-center text-xs text-slate-500'>
            <p>Print directly from your browser — no PDF software needed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
