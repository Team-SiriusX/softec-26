'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';

import { useCreateShift } from '../_api/create-shift';
import { useAnomalyDetect } from '../../dashboard/_api/use-anomaly-detect';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UploadDropzone } from '@/lib/uploadthing';
import { Loader2, X } from 'lucide-react';

const shiftSchema = z
  .object({
    platform: z.string().min(1, 'Platform name is required'),
    shiftDate: z
      .string()
      .min(1, 'Date is required')
      .refine((d) => new Date(d) <= new Date(), {
        message: 'Date cannot be in the future',
      }),
    hoursWorked: z
      .number({ message: 'Enter a valid number' })
      .min(0.5, 'Minimum 0.5 hours')
      .max(24, 'Maximum 24 hours'),
    grossEarned: z
      .number({ message: 'Enter a valid amount' })
      .positive('Total earned must be greater than zero'),
    platformDeductions: z
      .number({ message: 'Enter a valid amount' })
      .min(0, 'Platform cut cannot be negative'),
    netReceived: z.number({ message: 'Enter a valid amount' }),
    notes: z.string().optional(),
  })
  .refine((d) => d.platformDeductions <= d.grossEarned, {
    message: 'Platform cut cannot exceed total earned',
    path: ['platformDeductions'],
  });

type ShiftFormValues = z.infer<typeof shiftSchema>;

type UploadedScreenshot = {
  fileUrl: string;
  fileKey: string;
};

const MAX_SCREENSHOTS = 6;

export function ShiftForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const createShift = useCreateShift();
  const detectAnomaly = useAnomalyDetect();
  const [uploadedScreenshots, setUploadedScreenshots] = useState<UploadedScreenshot[]>([]);
  const [isUploadingScreenshots, setIsUploadingScreenshots] = useState(false);

  const isGuided = searchParams.get('guided') === '1';
  const guidedSource = searchParams.get('source');
  const guidedShiftId = searchParams.get('shiftId');

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      platform: '',
      shiftDate: new Date().toISOString().split('T')[0],
      hoursWorked: undefined,
      grossEarned: undefined,
      platformDeductions: undefined,
      netReceived: undefined,
      notes: '',
    },
  });

  const gross = form.watch('grossEarned');
  const deductions = form.watch('platformDeductions');
  const netManuallyEdited = !!form.formState.dirtyFields.netReceived;

  // Auto-calculate net received
  useEffect(() => {
    if (gross !== undefined && deductions !== undefined && !isNaN(gross) && !isNaN(deductions)) {
      const auto = Math.max(0, gross - deductions);
      // Only auto-set if user hasn't overridden the field.
      if (!netManuallyEdited) {
        form.setValue('netReceived', auto, {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    }
  }, [gross, deductions, form, netManuallyEdited]);

  const autoNet = gross !== undefined && deductions !== undefined
    ? Math.max(0, (gross ?? 0) - (deductions ?? 0))
    : null;

  const manualNet = form.watch('netReceived');
  const showOverrideWarning =
    netManuallyEdited &&
    autoNet !== null &&
    manualNet !== undefined &&
    !isNaN(manualNet) &&
    Math.abs(manualNet - autoNet) / (autoNet || 1) > 0.05;

  useEffect(() => {
    if (!isGuided) {
      return;
    }

    const currentNotes = form.getValues('notes') ?? '';
    if (currentNotes.trim().length > 0) {
      return;
    }

    const guidance = [
      'AI guidance checklist before re-submitting shift evidence:',
      '- Ensure the screenshot clearly shows gross, deductions, and net values.',
      '- Ensure money-field currency is visible (PKR/USD marker).',
      '- Avoid cropped images; include full receipt area and date/time.',
      '- Upload readable screenshots (no blur, glare, or compression artifacts).',
      guidedShiftId ? `- Reference previous flagged shift ID: ${guidedShiftId}.` : null,
      guidedSource ? `- Guidance source: ${guidedSource}.` : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join('\n');

    form.setValue('notes', guidance, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, guidedShiftId, guidedSource, isGuided]);

  const onSubmit = async (values: ShiftFormValues) => {
    const screenshotsPayload = uploadedScreenshots.map((screenshot) => ({
      fileUrl: screenshot.fileUrl,
      fileKey: screenshot.fileKey,
    }));

    createShift.mutate(
      {
        ...values,
        ...(screenshotsPayload.length > 0
          ? { screenshots: screenshotsPayload }
          : {}),
      },
      {
        onSuccess: () => {
          // Fire-and-forget anomaly detect in background
          if (user?.id) {
            detectAnomaly.mutate(user.id);
          }
          router.push('/worker/dashboard');
        },
      },
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className='space-y-5'>
      {isGuided ? (
        <div className='rounded-2xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-900'>
          <p className='font-semibold'>AI guided re-submission mode</p>
          <p className='mt-1 text-xs leading-relaxed'>
            Focus on evidence clarity and currency visibility to reduce false flags.
            {guidedShiftId ? ` Previous shift: ${guidedShiftId}.` : ''}
          </p>
        </div>
      ) : null}

      {/* Platform */}
      <div className='space-y-1.5'>
        <Label htmlFor='platform'>
          Platform <span aria-hidden='true' className='text-destructive'>*</span>
        </Label>
        <Input
          id='platform'
          placeholder='e.g. Bykea, Foodpanda, Upwork'
          aria-required='true'
          aria-invalid={!!form.formState.errors.platform}
          {...form.register('platform')}
        />
        {form.formState.errors.platform && (
          <p className='text-sm text-destructive' role='alert'>
            {form.formState.errors.platform.message}
          </p>
        )}
        <p className='text-xs text-muted-foreground'>The app or company you worked through</p>
      </div>

      {/* Date */}
      <div className='space-y-1.5'>
        <Label htmlFor='shiftDate'>
          Date of shift <span aria-hidden='true' className='text-destructive'>*</span>
        </Label>
        <Input
          id='shiftDate'
          type='date'
          aria-required='true'
          aria-invalid={!!form.formState.errors.shiftDate}
          max={new Date().toISOString().split('T')[0]}
          {...form.register('shiftDate')}
        />
        {form.formState.errors.shiftDate && (
          <p className='text-sm text-destructive' role='alert'>
            {form.formState.errors.shiftDate.message}
          </p>
        )}
      </div>

      {/* Hours worked */}
      <div className='space-y-1.5'>
        <Label htmlFor='hoursWorked'>
          Hours worked <span aria-hidden='true' className='text-destructive'>*</span>
        </Label>
        <Input
          id='hoursWorked'
          type='number'
          step='0.5'
          min='0.5'
          max='24'
          placeholder='e.g. 6.5'
          aria-required='true'
          aria-invalid={!!form.formState.errors.hoursWorked}
          {...form.register('hoursWorked', { valueAsNumber: true })}
        />
        {form.formState.errors.hoursWorked && (
          <p className='text-sm text-destructive' role='alert'>
            {form.formState.errors.hoursWorked.message}
          </p>
        )}
      </div>

      {/* Gross earned */}
      <div className='space-y-1.5'>
        <Label htmlFor='grossEarned'>
          Total earned (PKR) <span aria-hidden='true' className='text-destructive'>*</span>
        </Label>
        <Input
          id='grossEarned'
          type='number'
          min='0'
          placeholder='Amount before platform deducted anything'
          aria-required='true'
          aria-invalid={!!form.formState.errors.grossEarned}
          {...form.register('grossEarned', { valueAsNumber: true })}
        />
        {form.formState.errors.grossEarned && (
          <p className='text-sm text-destructive' role='alert'>
            {form.formState.errors.grossEarned.message}
          </p>
        )}
        <p className='text-xs text-muted-foreground'>What the platform showed before it took its cut</p>
      </div>

      {/* Platform deductions */}
      <div className='space-y-1.5'>
        <Label htmlFor='platformDeductions'>
          Platform cut (PKR) <span aria-hidden='true' className='text-destructive'>*</span>
        </Label>
        <Input
          id='platformDeductions'
          type='number'
          min='0'
          placeholder='Amount the platform deducted'
          aria-required='true'
          aria-invalid={!!form.formState.errors.platformDeductions}
          {...form.register('platformDeductions', { valueAsNumber: true })}
        />
        {form.formState.errors.platformDeductions && (
          <p className='text-sm text-destructive' role='alert'>
            {form.formState.errors.platformDeductions.message}
          </p>
        )}
        <p className='text-xs text-muted-foreground'>Fees, commissions, or service charges taken by the platform</p>
      </div>

      {/* Net received (auto-calculated, overridable) */}
      <div className='space-y-1.5'>
        <Label htmlFor='netReceived'>
          Amount you received (PKR){' '}
          <span className='text-xs text-muted-foreground font-normal'>(auto-calculated)</span>
        </Label>
        <Input
          id='netReceived'
          type='number'
          min='0'
          placeholder={autoNet !== null ? String(autoNet) : 'Will be calculated'}
          aria-describedby={showOverrideWarning ? 'net-warning' : undefined}
          aria-invalid={!!form.formState.errors.netReceived}
          {...form.register('netReceived', { valueAsNumber: true })}
          onChange={(e) => {
            const value = e.target.value.trim();
            const parsed = value === '' ? undefined : Number(value);
            form.setValue('netReceived', parsed as number, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
        {showOverrideWarning && (
          <p id='net-warning' className='text-sm text-amber-600 dark:text-amber-400' role='alert'>
            ⚠ This is more than 5% different from the calculated amount (PKR {autoNet?.toLocaleString()}). Please double-check.
          </p>
        )}
        {form.formState.errors.netReceived && (
          <p className='text-sm text-destructive' role='alert'>
            {form.formState.errors.netReceived.message}
          </p>
        )}
      </div>

      {/* Screenshots (optional) */}
      <div className='space-y-2'>
        <Label>
          Earnings screenshots{' '}
          <span className='text-xs text-muted-foreground font-normal'>(optional, up to {MAX_SCREENSHOTS})</span>
        </Label>
        <p className='text-xs text-muted-foreground'>
          Upload one or more screenshots so verifiers can confirm this shift.
        </p>

        <UploadDropzone
          endpoint='screenshotUploader'
          onUploadBegin={() => {
            setIsUploadingScreenshots(true);
          }}
          onClientUploadComplete={(files) => {
            const uploaded = files.map((file) => ({
              fileUrl: file.serverData?.fileUrl ?? file.url,
              fileKey: file.serverData?.fileKey ?? file.key,
            }));

            setUploadedScreenshots((prev) => {
              const merged = [...prev, ...uploaded];
              const deduped = merged.filter((item, index, self) => {
                return self.findIndex((entry) => entry.fileKey === item.fileKey) === index;
              });
              return deduped.slice(0, MAX_SCREENSHOTS);
            });

            setIsUploadingScreenshots(false);
            toast.success(files.length > 1 ? `${files.length} screenshots uploaded` : 'Screenshot uploaded');
          }}
          onUploadError={(error) => {
            setIsUploadingScreenshots(false);
            toast.error(error.message);
          }}
        />

        {uploadedScreenshots.length > 0 ? (
          <div className='grid grid-cols-2 gap-2'>
            {uploadedScreenshots.map((screenshot, index) => (
              <div
                key={screenshot.fileKey}
                className='relative overflow-hidden rounded-xl border border-border/60'
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot.fileUrl}
                  alt={`Uploaded screenshot ${index + 1}`}
                  className='h-24 w-full object-cover'
                />
                <Button
                  type='button'
                  size='icon'
                  variant='secondary'
                  className='absolute right-1 top-1 size-7'
                  onClick={() => {
                    setUploadedScreenshots((prev) => {
                      return prev.filter((item) => item.fileKey !== screenshot.fileKey);
                    });
                  }}
                >
                  <X className='size-4' aria-hidden='true' />
                  <span className='sr-only'>Remove screenshot</span>
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='notes'>Notes <span className='text-xs text-muted-foreground font-normal'>(optional)</span></Label>
        <Textarea
          id='notes'
          placeholder='Anything else you want to remember about this shift'
          rows={3}
          {...form.register('notes')}
        />
      </div>

      {/* Submit */}
      <Button
        type='submit'
        disabled={createShift.isPending || isUploadingScreenshots}
        className='w-full min-h-11'
      >
        {isUploadingScreenshots ? (
          'Uploading screenshots…'
        ) : createShift.isPending ? (
          <>
            <Loader2 className='size-4 mr-2 animate-spin' aria-hidden='true' />
            Saving shift…
          </>
        ) : (
          'Log this shift'
        )}
      </Button>
    </form>
  );
}
