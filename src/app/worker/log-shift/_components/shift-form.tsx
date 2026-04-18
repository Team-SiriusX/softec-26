'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useCreateShift } from '../_api/create-shift';
import { useAnomalyDetect } from '../../dashboard/_api/use-anomaly-detect';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

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
      .number({ invalid_type_error: 'Enter a valid number' })
      .min(0.5, 'Minimum 0.5 hours')
      .max(24, 'Maximum 24 hours'),
    grossEarned: z
      .number({ invalid_type_error: 'Enter a valid amount' })
      .positive('Total earned must be greater than zero'),
    platformDeductions: z
      .number({ invalid_type_error: 'Enter a valid amount' })
      .min(0, 'Platform cut cannot be negative'),
    netReceived: z.number({ invalid_type_error: 'Enter a valid amount' }),
    notes: z.string().optional(),
  })
  .refine((d) => d.platformDeductions <= d.grossEarned, {
    message: 'Platform cut cannot exceed total earned',
    path: ['platformDeductions'],
  });

type ShiftFormValues = z.infer<typeof shiftSchema>;

export function ShiftForm() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const createShift = useCreateShift();
  const detectAnomaly = useAnomalyDetect();

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

  // Auto-calculate net received
  useEffect(() => {
    if (gross !== undefined && deductions !== undefined && !isNaN(gross) && !isNaN(deductions)) {
      const auto = Math.max(0, gross - deductions);
      const current = form.getValues('netReceived');
      // Only auto-set if user hasn't overridden it
      if (current === undefined || isNaN(current)) {
        form.setValue('netReceived', auto, { shouldValidate: false });
      }
    }
  }, [gross, deductions, form]);

  const autoNet = gross !== undefined && deductions !== undefined
    ? Math.max(0, (gross ?? 0) - (deductions ?? 0))
    : null;

  const manualNet = form.watch('netReceived');
  const showOverrideWarning =
    autoNet !== null &&
    manualNet !== undefined &&
    !isNaN(manualNet) &&
    Math.abs(manualNet - autoNet) / (autoNet || 1) > 0.05;

  const onSubmit = async (values: ShiftFormValues) => {
    createShift.mutate(values, {
      onSuccess: () => {
        // Fire-and-forget anomaly detect in background
        if (user?.id) {
          detectAnomaly.mutate(user.id);
        }
        router.push('/worker/dashboard');
      },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className='space-y-5'>
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
            form.setValue('netReceived', parseFloat(e.target.value) || 0, {
              shouldValidate: true,
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

      {/* Notes (optional) */}
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
        disabled={createShift.isPending}
        className='w-full min-h-[44px]'
      >
        {createShift.isPending ? (
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
