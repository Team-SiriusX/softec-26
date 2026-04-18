'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  FileText,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type VerificationResponse = {
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractCertificateId(rawValue: string): string {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return '';
  }

  if (UUID_PATTERN.test(trimmedValue)) {
    return trimmedValue;
  }

  try {
    const parsedUrl = new URL(
      trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')
        ? trimmedValue
        : `https://${trimmedValue}`,
    );

    const queryId =
      parsedUrl.searchParams.get('id') ??
      parsedUrl.searchParams.get('certificate_id');
    if (queryId && UUID_PATTERN.test(queryId)) {
      return queryId;
    }

    if (parsedUrl.pathname.includes('/certificate/verify/')) {
      const pathId = parsedUrl.pathname.split('/').filter(Boolean).at(-1);
      if (pathId && UUID_PATTERN.test(pathId)) {
        return pathId;
      }
    }
  } catch {
    // Fall back to direct input below.
  }

  const embeddedUuid = trimmedValue.match(UUID_PATTERN);
  return embeddedUuid?.[0] ?? trimmedValue;
}

function VerifyCertificatePageContent() {
  const searchParams = useSearchParams();
  const initialId = useMemo(() => searchParams.get('id') ?? '', [searchParams]);

  const [certificateId, setCertificateId] = useState(initialId);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(
    initialId || null,
  );

  const handleVerify = async () => {
    const extractedId = extractCertificateId(certificateId);

    if (!extractedId || !UUID_PATTERN.test(extractedId)) {
      setError(
        'Enter a valid certificate ID or a public verify link that includes ?id=...',
      );
      setResult(null);
      return;
    }

    setIsVerifying(true);
    setError(null);
    setSubmittedId(extractedId);

    try {
      const response = await fetch(
        `/api/certificates/verify/${encodeURIComponent(extractedId)}`,
      );

      if (!response.ok) {
        setError('Verification service is unavailable right now');
        setResult(null);
        return;
      }

      const data = (await response.json()) as VerificationResponse;
      setResult(data);
    } catch {
      setError('Verification service is unavailable right now');
      setResult(null);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className='min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 px-4 py-12 text-slate-900'>
      <div className='mx-auto max-w-6xl space-y-8'>
        {/* Header */}
        <div className='space-y-3 text-center'>
          <div className='inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold tracking-widest text-emerald-700 uppercase'>
            <BadgeCheck className='h-4 w-4' /> Certificate Verification
          </div>
          <h1 className='text-5xl font-bold tracking-tight text-balance'>
            Verify a FairGig Certificate
          </h1>
          <p className='mx-auto max-w-2xl text-lg leading-relaxed text-slate-600'>
            Instantly confirm the authenticity of FairGig certificates. Paste a
            certificate ID or verification link to see complete details.
          </p>
        </div>

        {/* Main Card */}
        <div className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50'>
          <div className='relative p-8 md:p-12'>
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_50%)]' />

            <div className='relative space-y-8'>
              {/* Input Section */}
              <div className='space-y-4'>
                <Label
                  htmlFor='certificate-id'
                  className='block text-sm font-semibold text-slate-900'
                >
                  Certificate ID or Verification Link
                </Label>
                <div className='flex flex-col gap-3 sm:flex-row'>
                  <Input
                    id='certificate-id'
                    value={certificateId}
                    onChange={(event) => setCertificateId(event.target.value)}
                    placeholder='Paste UUID or verification link'
                    className='h-12 border-slate-300 bg-white text-base shadow-sm focus:border-emerald-400 focus:ring-emerald-400'
                  />
                  <Button
                    onClick={handleVerify}
                    disabled={isVerifying || !certificateId.trim()}
                    className='h-12 shrink-0 gap-2 bg-emerald-600 px-6 font-semibold hover:bg-emerald-700'
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                    {!isVerifying && <ArrowRight className='h-5 w-5' />}
                  </Button>
                </div>
                <p className='text-sm text-slate-500'>
                  Accepted: UUID certificate ID, links like
                  /certificate/verify?id=UUID, or public FairGig verification
                  URLs
                </p>
              </div>

              {/* Error State */}
              {error && (
                <Alert
                  variant='destructive'
                  className='border-red-300 bg-red-50'
                >
                  <AlertCircle className='h-5 w-5 text-red-600' />
                  <AlertTitle className='text-red-900'>
                    Verification failed
                  </AlertTitle>
                  <AlertDescription className='text-red-800'>
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Features Grid */}
              <div className='grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-3'>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <ShieldCheck className='h-5 w-5 text-emerald-600' />
                    <p className='font-semibold text-slate-900'>Authenticity</p>
                  </div>
                  <p className='text-sm leading-relaxed text-slate-600'>
                    Instant confirmation of certificate validity and registry
                    status
                  </p>
                </div>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <FileText className='h-5 w-5 text-emerald-600' />
                    <p className='font-semibold text-slate-900'>
                      Complete Details
                    </p>
                  </div>
                  <p className='text-sm leading-relaxed text-slate-600'>
                    Worker info, dates, platforms, and expiration status
                    included
                  </p>
                </div>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <BadgeCheck className='h-5 w-5 text-emerald-600' />
                    <p className='font-semibold text-slate-900'>
                      Public Access
                    </p>
                  </div>
                  <p className='text-sm leading-relaxed text-slate-600'>
                    No login required. Anyone can verify certificates instantly
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Card */}
        {result && (
          <Card className='overflow-hidden border-slate-200 shadow-lg shadow-slate-200/50 p-0'>
          <CardHeader
            className={
              result.is_valid
                ? 'border-b border-emerald-200 bg-linear-to-r from-emerald-50 to-emerald-100'
                : 'border-b border-red-200 bg-linear-to-r from-red-50 to-red-100'
            }
          >
              <div className='flex items-center gap-4 mt-4'>
                {result.is_valid ? (
                  <ShieldCheck className='h-8 w-8 shrink-0 text-emerald-600' />
                ) : (
                  <ShieldX className='h-8 w-8 shrink-0 text-red-600' />
                )}
                <div>
                  <CardTitle
                    className={
                      result.is_valid ? 'text-emerald-900' : 'text-red-900'
                    }
                  >
                    {result.is_valid
                      ? '✓ Certificate Verified'
                      : '✗ Certificate Not Verified'}
                  </CardTitle>
                  <CardDescription
                    className={
                      result.is_valid ? 'text-emerald-700' : 'text-red-700'
                    }
                  >
                    {result.message}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className='space-y-8 p-8 md:p-10'>
              {result.certificate ? (
                <>
                  {/* Details Grid */}
                  <div className='space-y-4'>
                    <h3 className='text-sm font-semibold tracking-widest text-slate-500 uppercase'>
                      Certificate Information
                    </h3>
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                      <DetailItem
                        label='Certificate ID'
                        value={result.certificate.certificate_id}
                        mono
                      />
                      <DetailItem
                        label='Status'
                        value={result.certificate.status}
                        badge
                      />
                      <DetailItem
                        label='Worker Name'
                        value={result.certificate.worker_name || 'Unknown'}
                      />
                      <DetailItem
                        label='Worker ID'
                        value={result.certificate.worker_id}
                        mono
                      />
                      <DetailItem
                        label='Date Range'
                        value={`${result.certificate.from_date} to ${result.certificate.to_date}`}
                      />
                      <DetailItem
                        label='Amount Verified'
                        value={`PKR ${result.certificate.total_verified.toLocaleString()}`}
                        highlight
                      />
                      <DetailItem
                        label='Shifts Completed'
                        value={String(result.certificate.shift_count)}
                      />
                      <DetailItem
                        label='Platforms'
                        value={
                          result.certificate.platforms.length
                            ? result.certificate.platforms.join(', ')
                            : 'N/A'
                        }
                      />
                      <DetailItem
                        label='Generated At'
                        value={result.certificate.generated_at}
                        mono
                        small
                      />
                      <DetailItem
                        label='Expires At'
                        value={result.certificate.expires_at || 'No expiry'}
                        mono
                        small
                      />
                      <DetailItem
                        label='Expired Status'
                        value={result.certificate.is_expired ? 'Yes' : 'No'}
                      />
                      <DetailItem
                        label='Verified Input'
                        value={submittedId || 'N/A'}
                        mono
                        small
                      />
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className='rounded-2xl border border-slate-200 bg-slate-50 p-6'>
                    <div className='flex items-start gap-3'>
                      <FileText className='mt-1 h-5 w-5 shrink-0 text-slate-500' />
                      <div>
                        <p className='mb-2 font-semibold text-slate-900'>
                          Verification Summary
                        </p>
                        <p className='text-sm leading-relaxed text-slate-600'>
                          {result.is_valid
                            ? 'This certificate was found in the FairGig registry and passes all validity checks. The worker details and completion metrics are accurate as of the date shown above.'
                            : 'The certificate record exists but failed one or more validity checks. Please contact FairGig support for more information.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className='rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center'>
                  <p className='text-sm text-slate-600'>
                    No certificate details are available for this result.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function VerifyCertificateLoadingFallback() {
  return (
    <div className='min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 px-4 py-12 text-slate-900'>
      <div className='mx-auto max-w-6xl space-y-8'>
        <div className='space-y-3 text-center'>
          <div className='inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold tracking-widest text-emerald-700 uppercase'>
            <BadgeCheck className='h-4 w-4' /> Certificate Verification
          </div>
          <h1 className='text-5xl font-bold tracking-tight text-balance'>
            Verify a FairGig Certificate
          </h1>
          <p className='mx-auto max-w-2xl text-lg leading-relaxed text-slate-600'>
            Loading verification interface...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyCertificatePage() {
  return (
    <Suspense fallback={<VerifyCertificateLoadingFallback />}>
      <VerifyCertificatePageContent />
    </Suspense>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
  badge = false,
  highlight = false,
  small = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        highlight
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white shadow-sm hover:shadow-md'
      }`}
    >
      <p className='text-xs font-semibold tracking-widest text-slate-500 uppercase'>
        {label}
      </p>
      <p
        className={`mt-2 text-slate-900 ${
          mono ? 'font-mono text-[12px] text-slate-700' : 'text-sm'
        } ${badge ? 'inline-flex items-center gap-2 font-medium' : ''}`}
      >
        {badge && (
          <span className='inline-block h-2 w-2 rounded-full bg-emerald-500' />
        )}
        {small && (
          <span className='text-xs font-normal text-slate-600'>{value}</span>
        )}
        {!small && value}
      </p>
    </div>
  );
}
