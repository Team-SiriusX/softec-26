'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup, FieldLabel, FieldError } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';

const signUpSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    role: z.enum(['WORKER', 'VERIFIER', 'ADVOCATE']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

const roles = [
  {
    value: 'WORKER',
    label: 'Gig Worker',
    description: 'Log your earnings, get verified, and prove your income',
  },
  {
    value: 'VERIFIER',
    label: 'Verifier',
    description: 'Review worker screenshots and verify earnings claims',
  },
  {
    value: 'ADVOCATE',
    label: 'Advocate / Analyst',
    description: 'Analyze patterns and help workers understand their rights',
  },
];

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'role'>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'WORKER',
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = form;
  const selectedRole = watch('role');

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const approvalStatus = data.role === 'WORKER' ? 'APPROVED' : 'PENDING';

      const response = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.fullName,
        fullName: data.fullName,
        role: data.role,
        approvalStatus,
      });

      if (response.error) {
        setError(response.error.message || 'Sign-up failed. Please try again.');
      } else {
        // Redirect based on role
        if (data.role === 'WORKER') {
          router.push('/worker/onboarding/profile');
        } else {
          router.push('/pending-approval');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Sign-up error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='bg-background grid min-h-screen w-full lg:grid-cols-2'>
      <section className='relative hidden overflow-hidden lg:flex lg:items-end lg:justify-start'>
        <div
          className='absolute inset-0'
          style={{
            backgroundImage:
              "linear-gradient(140deg, rgba(15,23,42,0.92), rgba(49,46,129,0.88) 55%, rgba(180,83,9,0.85)), url('https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1800&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className='relative z-10 max-w-xl px-12 pb-16 text-white'>
          <p className='mb-4 text-xs font-semibold tracking-[0.24em] uppercase text-white/80'>
            FAIRGIG ONBOARDING
          </p>
          <h1 className='text-4xl leading-tight font-black xl:text-5xl'>
            Build your verified gig-work profile with evidence-first workflows.
          </h1>
        </div>
      </section>

      <section className='flex items-center justify-center px-4 py-12 sm:px-8 lg:px-12'>
        <div className='w-full max-w-md'>
          <Link href='/' className='mb-8 inline-flex items-center gap-3'>
            <Image
              src='/logo2.png'
              alt='FairGig logo'
              width={44}
              height={44}
              className='rounded-md object-cover'
              priority
            />
            <span className='text-2xl font-bold tracking-tight text-slate-900'>
              FairGig
            </span>
          </Link>

          <div className='mb-8'>
            <h2 className='mb-2 text-3xl font-black text-slate-900'>Join us today</h2>
            <p className='text-sm text-slate-600'>
              Start your FairGig journey with secure identity and role-based access.
            </p>
          </div>

          {error && (
            <div className='mb-6 rounded-xl border border-red-200 bg-red-50 p-3'>
              <p className='text-sm text-red-700'>{error}</p>
            </div>
          )}

          {step === 'details' && (
            <form
              onSubmit={handleSubmit(() => setStep('role'))}
              className='space-y-5'
            >
              <FieldGroup>
                <FieldLabel htmlFor='fullName' className='font-medium text-slate-700'>
                  Full name
                </FieldLabel>
                <Controller
                  name='fullName'
                  control={control}
                  render={({ field }) => (
                    <>
                      <Input
                        {...field}
                        id='fullName'
                        type='text'
                        placeholder='Enter your full name'
                        className='h-12 rounded-xl border border-slate-300 bg-white px-4 text-base'
                        aria-invalid={!!errors.fullName}
                      />
                      {errors.fullName && (
                        <FieldError errors={[errors.fullName]} />
                      )}
                    </>
                  )}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel htmlFor='email' className='font-medium text-slate-700'>
                  Your email
                </FieldLabel>
                <Controller
                  name='email'
                  control={control}
                  render={({ field }) => (
                    <>
                      <Input
                        {...field}
                        id='email'
                        type='email'
                        placeholder='hello@fairgig.app'
                        className='h-12 rounded-xl border border-slate-300 bg-white px-4 text-base'
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && <FieldError errors={[errors.email]} />}
                    </>
                  )}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel htmlFor='password' className='font-medium text-slate-700'>
                  Create new password
                </FieldLabel>
                <Controller
                  name='password'
                  control={control}
                  render={({ field }) => (
                    <>
                      <Input
                        {...field}
                        id='password'
                        type='password'
                        placeholder='At least 8 characters'
                        className='h-12 rounded-xl border border-slate-300 bg-white px-4 text-base'
                        aria-invalid={!!errors.password}
                      />
                      {errors.password && (
                        <FieldError errors={[errors.password]} />
                      )}
                    </>
                  )}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel
                  htmlFor='confirmPassword'
                  className='font-medium text-slate-700'
                >
                  Confirm password
                </FieldLabel>
                <Controller
                  name='confirmPassword'
                  control={control}
                  render={({ field }) => (
                    <>
                      <Input
                        {...field}
                        id='confirmPassword'
                        type='password'
                        placeholder='Re-enter your password'
                        className='h-12 rounded-xl border border-slate-300 bg-white px-4 text-base'
                        aria-invalid={!!errors.confirmPassword}
                      />
                      {errors.confirmPassword && (
                        <FieldError errors={[errors.confirmPassword]} />
                      )}
                    </>
                  )}
                />
              </FieldGroup>

              <Button
                type='submit'
                className='h-12 w-full rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600'
              >
                Continue
              </Button>

              <div className='text-center'>
                <p className='text-sm text-slate-600'>
                  Already have an account?{' '}
                  <Link
                    href='/auth/sign-in'
                    className='font-semibold text-slate-900 hover:text-orange-600'
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === 'role' && (
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
              <div>
                <h2 className='mb-2 text-2xl font-black text-slate-900'>
                  Select your role
                </h2>
                <p className='mb-6 text-sm text-slate-600'>
                  Verifier and advocate accounts require approval from an
                  approved advocate.
                </p>
              </div>

              <Controller
                name='role'
                control={control}
                render={({ field }) => (
                  <RadioGroup value={field.value} onValueChange={field.onChange}>
                    <div className='space-y-3'>
                      {roles.map((role) => (
                        <label
                          key={role.value}
                          className={`flex cursor-pointer items-center rounded-xl border p-4 transition-all ${
                            selectedRole === role.value
                              ? 'border-orange-500 bg-orange-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <RadioGroupItem
                            value={role.value}
                            id={role.value}
                            className='mt-0.5'
                          />
                          <div className='ml-3 flex-1'>
                            <p className='font-semibold text-slate-900'>
                              {role.label}
                            </p>
                            <p className='text-sm text-slate-600'>
                              {role.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                )}
              />

              <div className='flex gap-3 pt-2'>
                <Button
                  type='button'
                  variant='outline'
                  className='h-12 flex-1 rounded-xl text-base font-semibold'
                  onClick={() => setStep('details')}
                >
                  Back
                </Button>
                <Button
                  type='submit'
                  disabled={isLoading}
                  className='h-12 flex-1 rounded-xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600'
                >
                  {isLoading ? (
                    <>
                      <Spinner className='mr-2 h-4 w-4' />
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
