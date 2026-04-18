'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleAlert,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const workerCategoryOptions = [
  {
    value: 'RIDE_HAILING',
    label: 'Ride-Hailing (Careem, Uber, etc.)',
  },
  {
    value: 'FOOD_DELIVERY',
    label: 'Food Delivery (Foodpanda, Daraz, etc.)',
  },
  {
    value: 'FREELANCE_DESIGN',
    label: 'Freelance / Design',
  },
  {
    value: 'DOMESTIC_WORK',
    label: 'Domestic Work',
  },
  {
    value: 'OTHER',
    label: 'Other',
  },
] as const;

const cityZoneOptions = [
  { value: 'gulberg', label: 'Gulberg' },
  { value: 'dha', label: 'DHA' },
  { value: 'johar-town', label: 'Johar Town' },
  { value: 'mall-road', label: 'Mall Road' },
  { value: 'cantt', label: 'Cantt' },
  { value: 'iqbal-town', label: 'Iqbal Town' },
  { value: 'g-6', label: 'G-6 (Islamabad)' },
  { value: 'f-7', label: 'F-7 (Islamabad)' },
  { value: 'saddar', label: 'Saddar (Karachi)' },
  { value: 'clifton', label: 'Clifton (Karachi)' },
] as const;

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().trim().optional(),
  cityZone: z.string().trim().min(1, 'Please select your city zone'),
  category: z.enum([
    'RIDE_HAILING',
    'FOOD_DELIVERY',
    'FREELANCE_DESIGN',
    'DOMESTIC_WORK',
    'OTHER',
  ]),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type WorkerCategoryValue = ProfileFormValues['category'];

export type WorkerProfileEditorUser = {
  id: string;
  email: string;
  role: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
  fullName: string;
  phone: string | null;
  cityZone: string | null;
  category: WorkerCategoryValue | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  image: string | null;
};

type ProfileEditorProps = {
  initialUser: WorkerProfileEditorUser;
};

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'FW';
  }

  return parts
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function findLabel(
  value: string | null,
  options: ReadonlyArray<{ value: string; label: string }>,
): string {
  return options.find((option) => option.value === value)?.label ?? 'Not set yet';
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className='flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3'>
      <div className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
        <Icon className='size-4' aria-hidden='true' />
      </div>
      <div className='min-w-0'>
        <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
          {label}
        </p>
        <p className='truncate text-sm font-medium text-foreground'>{value}</p>
      </div>
    </div>
  );
}

export default function ProfileEditor({ initialUser }: ProfileEditorProps) {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: initialUser.fullName,
      phone: initialUser.phone ?? '',
      cityZone: initialUser.cityZone ?? '',
      category: initialUser.category ?? 'RIDE_HAILING',
    },
  });

  const watchedValues = form.watch();

  useEffect(() => {
    form.reset({
      fullName: initialUser.fullName,
      phone: initialUser.phone ?? '',
      cityZone: initialUser.cityZone ?? '',
      category: initialUser.category ?? 'RIDE_HAILING',
    });
  }, [form, initialUser]);

  const profileCompletion = useMemo(() => {
    const requiredFields = [
      watchedValues.fullName.trim().length >= 2,
      watchedValues.cityZone.trim().length > 0,
      watchedValues.category.trim().length > 0,
    ];

    return Math.round(
      (requiredFields.filter(Boolean).length / requiredFields.length) * 100,
    );
  }, [watchedValues.category, watchedValues.cityZone, watchedValues.fullName]);

  const displayName = watchedValues.fullName.trim() || initialUser.fullName;
  const cityZoneLabel = findLabel(watchedValues.cityZone || null, cityZoneOptions);
  const categoryLabel = findLabel(watchedValues.category || null, workerCategoryOptions);
  const hasPhone = (watchedValues.phone?.trim() ?? '').length > 0;
  const profileStatusTone = initialUser.isActive
    ? 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/30'
    : 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/30';

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          phone: values.phone?.trim() ? values.phone.trim() : null,
          cityZone: values.cityZone.trim(),
          category: values.category,
        }),
      });

      if (!response.ok) {
        let message = 'Failed to save profile. Please try again.';

        try {
          const payload = (await response.json()) as {
            error?: string;
            message?: string;
          };
          message = payload.error ?? payload.message ?? message;
        } catch {
          // Keep the default fallback message if the response is not JSON.
        }

        throw new Error(message);
      }

      return (await response.json()) as WorkerProfileEditorUser;
    },
  });

  const { mutateAsync, isPending } = updateProfileMutation;

  const onSubmit = async (values: ProfileFormValues): Promise<void> => {
    setSubmitError(null);

    try {
      const updatedUser = await mutateAsync(values);

      queryClient.setQueryData(['me'], updatedUser);
      form.reset({
        fullName: updatedUser.fullName,
        phone: updatedUser.phone ?? '',
        cityZone: updatedUser.cityZone ?? '',
        category: updatedUser.category ?? 'RIDE_HAILING',
      });

      toast.success('Profile updated successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      setSubmitError(message);
      toast.error(message);
    }
  };

  return (
    <div className='space-y-6'>
      <section className='relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-xl shadow-slate-950/20 lg:p-8'>
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.18),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.16),_transparent_32%)]' />
        <div className='relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5'>
            <Avatar className='size-20 border border-white/15 shadow-lg shadow-slate-950/30 ring-4 ring-white/10 sm:size-24'>
              <AvatarImage src={initialUser.image ?? undefined} alt={displayName} />
              <AvatarFallback className='bg-white/10 text-lg font-semibold text-white'>
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>

            <div className='space-y-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge
                  className={cn(
                    'border-0 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]',
                    profileStatusTone,
                  )}
                >
                  {initialUser.isActive ? 'Active worker' : 'Inactive worker'}
                </Badge>
                <Badge className='border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white'>
                  {initialUser.role.toLowerCase()}
                </Badge>
              </div>

              <div className='space-y-1'>
                <h1 className='text-3xl font-black tracking-tight text-white lg:text-4xl'>
                  {displayName}
                </h1>
                <p className='max-w-2xl text-sm text-slate-300 sm:text-base'>
                  Keep your worker profile current so your earning insights,
                  verification flows, and local comparisons stay accurate.
                </p>
              </div>

              <div className='flex flex-wrap gap-2 text-xs text-slate-300'>
                <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                  <Mail className='size-3.5' aria-hidden='true' />
                  {initialUser.email}
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                  <MapPin className='size-3.5' aria-hidden='true' />
                  {cityZoneLabel}
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5'>
                  <Building2 className='size-3.5' aria-hidden='true' />
                  {categoryLabel}
                </span>
              </div>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-3 lg:min-w-[360px] lg:grid-cols-1 xl:grid-cols-3'>
            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                    Completion
                  </p>
                  <p className='mt-1 text-2xl font-bold text-white'>{profileCompletion}%</p>
                </div>
                <Sparkles className='size-5 text-cyan-200' aria-hidden='true' />
              </div>
              <div className='mt-3 h-2 rounded-full bg-white/10'>
                <div
                  className='h-2 rounded-full bg-linear-to-r from-cyan-300 to-emerald-300'
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
            </div>

            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                Last updated
              </p>
              <p className='mt-1 text-sm font-medium text-white'>
                {formatDateTime(initialUser.updatedAt)}
              </p>
            </div>

            <div className='rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm'>
              <p className='text-xs uppercase tracking-[0.22em] text-slate-300'>
                Member since
              </p>
              <p className='mt-1 text-sm font-medium text-white'>
                {formatDateTime(initialUser.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className='grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]'>
        <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
          <CardHeader className='space-y-3'>
            <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <CardTitle className='text-xl'>Edit profile details</CardTitle>
                <CardDescription>
                  Update the information used across worker analytics and account
                  verification.
                </CardDescription>
              </div>
              <Badge variant='outline' className='w-fit gap-1.5'>
                <ShieldCheck className='size-3.5' aria-hidden='true' />
                Protected account data
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form className='space-y-6' onSubmit={form.handleSubmit(onSubmit)} noValidate>
              {submitError && (
                <div className='flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'>
                  <CircleAlert className='mt-0.5 size-4 shrink-0' aria-hidden='true' />
                  <p className='text-sm font-medium'>{submitError}</p>
                </div>
              )}

              <FieldGroup className='gap-5'>
                <div className='space-y-2'>
                  <FieldLabel htmlFor='fullName'>Full name</FieldLabel>
                  <Controller
                    control={form.control}
                    name='fullName'
                    render={({ field }) => (
                      <>
                        <Input
                          {...field}
                          id='fullName'
                          placeholder='Enter your full name'
                          aria-invalid={!!form.formState.errors.fullName}
                          disabled={isPending}
                        />
                        <FieldError errors={[form.formState.errors.fullName]} />
                      </>
                    )}
                  />
                </div>

                <div className='space-y-2'>
                  <FieldLabel htmlFor='phone'>Phone number</FieldLabel>
                  <Controller
                    control={form.control}
                    name='phone'
                    render={({ field }) => (
                      <>
                        <Input
                          {...field}
                          id='phone'
                          type='tel'
                          placeholder='03XX-XXXXXXX'
                          aria-invalid={!!form.formState.errors.phone}
                          disabled={isPending}
                        />
                        <FieldError errors={[form.formState.errors.phone]} />
                      </>
                    )}
                  />
                  <p className='text-xs text-muted-foreground'>Optional, but useful for support and account recovery.</p>
                </div>

                <div className='space-y-2'>
                  <FieldLabel htmlFor='cityZone'>City zone</FieldLabel>
                  <Controller
                    control={form.control}
                    name='cityZone'
                    render={({ field }) => (
                      <>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isPending}
                        >
                          <SelectTrigger
                            id='cityZone'
                            aria-invalid={!!form.formState.errors.cityZone}
                          >
                            <SelectValue placeholder='Select your city zone' />
                          </SelectTrigger>
                          <SelectContent>
                            {cityZoneOptions.map((zone) => (
                              <SelectItem key={zone.value} value={zone.value}>
                                {zone.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[form.formState.errors.cityZone]} />
                      </>
                    )}
                  />
                  <p className='text-xs text-muted-foreground'>Used to compare your earnings against nearby workers.</p>
                </div>

                <div className='space-y-2'>
                  <FieldLabel htmlFor='category'>Primary work category</FieldLabel>
                  <Controller
                    control={form.control}
                    name='category'
                    render={({ field }) => (
                      <>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isPending}
                        >
                          <SelectTrigger
                            id='category'
                            aria-invalid={!!form.formState.errors.category}
                          >
                            <SelectValue placeholder='Select your work category' />
                          </SelectTrigger>
                          <SelectContent>
                            {workerCategoryOptions.map((categoryOption) => (
                              <SelectItem
                                key={categoryOption.value}
                                value={categoryOption.value}
                              >
                                {categoryOption.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[form.formState.errors.category]} />
                      </>
                    )}
                  />
                  <p className='text-xs text-muted-foreground'>This powers category-aware analytics and platform comparisons.</p>
                </div>
              </FieldGroup>

              <Separator />

              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <p className='text-sm text-muted-foreground'>
                  Changes will update your worker profile, dashboard, and future
                  verification flows.
                </p>

                <div className='flex flex-col gap-3 sm:flex-row'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      form.reset({
                        fullName: initialUser.fullName,
                        phone: initialUser.phone ?? '',
                        cityZone: initialUser.cityZone ?? '',
                        category: initialUser.category ?? 'RIDE_HAILING',
                      });
                      setSubmitError(null);
                    }}
                    disabled={isPending || !form.formState.isDirty}
                  >
                    Reset changes
                  </Button>

                  <Button type='submit' disabled={isPending} className='gap-2'>
                    <Save className='size-4' aria-hidden='true' />
                    {isPending ? 'Saving...' : 'Save profile'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className='space-y-6'>
          <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
            <CardHeader>
              <CardTitle className='text-base'>Profile snapshot</CardTitle>
              <CardDescription>
                A quick readout of the information currently in your profile.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <InfoRow icon={UserRound} label='Display name' value={displayName} />
              <InfoRow icon={Mail} label='Email address' value={initialUser.email} />
              <InfoRow
                icon={MapPin}
                label='City zone'
                value={cityZoneLabel}
              />
              <InfoRow
                icon={Building2}
                label='Category'
                value={categoryLabel}
              />
              <InfoRow
                icon={Clock3}
                label='Profile updated'
                value={formatDateTime(initialUser.updatedAt)}
              />
            </CardContent>
          </Card>

          <Card className='border-border/70 shadow-sm shadow-slate-950/5'>
            <CardHeader>
              <CardTitle className='text-base'>Why this matters</CardTitle>
              <CardDescription>
                Profile data helps the app make the rest of the worker experience
                smarter.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <BadgeCheck className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  Your zone and category improve fair earnings benchmarks and
                  local comparisons.
                </p>
              </div>

              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <Phone className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  A current phone number helps support reach you during account
                  review or certificate delivery.
                </p>
              </div>

              <div className='flex gap-3 rounded-2xl bg-primary/5 px-4 py-3'>
                <CalendarDays className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                <p className='text-sm text-muted-foreground'>
                  Account details sync across your dashboard and future worker
                  tools immediately after saving.
                </p>
              </div>

              <Separator />

              <div className='flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3'>
                <div>
                  <p className='text-sm font-medium text-foreground'>Contact status</p>
                  <p className='text-xs text-muted-foreground'>
                    {hasPhone ? 'Reachable' : 'Phone number not set'}
                  </p>
                </div>
                <Badge variant={hasPhone ? 'secondary' : 'outline'}>
                  {hasPhone ? 'Ready' : 'Optional'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}