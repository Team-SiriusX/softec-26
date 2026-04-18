'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';

const WorkerCategory = {
  RIDE_HAILING: 'Ride-Hailing (Careem, Uber, etc.)',
  FOOD_DELIVERY: 'Food Delivery (Foodpanda, Daraz, etc.)',
  FREELANCE_DESIGN: 'Freelance / Design',
  DOMESTIC_WORK: 'Domestic Work',
  OTHER: 'Other',
} as const;

const cityZones = [
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
];

const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
  cityZone: z.string().min(1, 'Please select your city zone'),
  category: z.enum(['RIDE_HAILING', 'FOOD_DELIVERY', 'FREELANCE_DESIGN', 'DOMESTIC_WORK', 'OTHER']),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function WorkerProfileSetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      cityZone: '',
      category: 'RIDE_HAILING',
    },
  });

  const { control, handleSubmit, formState: { errors } } = form;

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Update user profile
      const response = await authClient.updateUser({
        name: data.fullName,
        data: {
          phone: data.phone,
          cityZone: data.cityZone,
          category: data.category,
        },
      });

      if (response.error) {
        setError(response.error.message || 'Failed to save profile. Please try again.');
      } else {
        // Redirect to worker dashboard
        router.push('/worker/dashboard');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Profile update error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl shadow-lg border border-slate-200">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Complete Your Profile</h1>
            <p className="text-slate-600">Help us understand your work better. This information helps us show you relevant data.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-red-900 font-medium text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Full Name Field */}
            <FieldGroup>
              <FieldLabel htmlFor="fullName" className="text-slate-700 font-medium">
                Full Name
              </FieldLabel>
              <Controller
                name="fullName"
                control={control}
                render={({ field }) => (
                  <>
                    <Input
                      {...field}
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      className="text-base"
                      aria-invalid={!!errors.fullName}
                      disabled={isLoading}
                    />
                    {errors.fullName && (
                      <FieldError errors={[errors.fullName]} />
                    )}
                  </>
                )}
              />
            </FieldGroup>

            {/* Phone Field (Optional) */}
            <FieldGroup>
              <FieldLabel htmlFor="phone" className="text-slate-700 font-medium">
                Phone Number (Optional)
              </FieldLabel>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <>
                    <Input
                      {...field}
                      id="phone"
                      type="tel"
                      placeholder="03XX-XXXXXXX"
                      className="text-base"
                      disabled={isLoading}
                    />
                    {errors.phone && (
                      <FieldError errors={[errors.phone]} />
                    )}
                  </>
                )}
              />
            </FieldGroup>

            {/* City Zone Field */}
            <FieldGroup>
              <FieldLabel htmlFor="cityZone" className="text-slate-700 font-medium">
                City Zone
              </FieldLabel>
              <Controller
                name="cityZone"
                control={control}
                render={({ field }) => (
                  <>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                      <SelectTrigger
                        id="cityZone"
                        className="text-base"
                        aria-invalid={!!errors.cityZone}
                      >
                        <SelectValue placeholder="Select your city zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {cityZones.map((zone) => (
                          <SelectItem key={zone.value} value={zone.value}>
                            {zone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.cityZone && (
                      <FieldError errors={[errors.cityZone]} />
                    )}
                  </>
                )}
              />
              <p className="text-xs text-slate-500 mt-2">
                This helps us compare your earnings with other workers in your area
              </p>
            </FieldGroup>

            {/* Primary Category Field */}
            <FieldGroup>
              <FieldLabel htmlFor="category" className="text-slate-700 font-medium">
                Primary Platform Category
              </FieldLabel>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                      <SelectTrigger
                        id="category"
                        className="text-base"
                        aria-invalid={!!errors.category}
                      >
                        <SelectValue placeholder="Select your work category" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(WorkerCategory).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <FieldError errors={[errors.category]} />
                    )}
                  </>
                )}
              />
              <p className="text-xs text-slate-500 mt-2">
                This helps us show you relevant insights and connect you with similar workers
              </p>
            </FieldGroup>

            {/* Privacy Notice */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900">
                <span className="font-semibold">Privacy:</span> Your city zone and category help us show you fair market comparisons, but your identity remains anonymous in any public data.
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full mt-8 py-6 text-base font-semibold"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Saving profile...
                </>
              ) : (
                'Get Started'
              )}
            </Button>

            <p className="text-center text-xs text-slate-500">
              You can update this information anytime from your settings
            </p>
          </form>
        </div>
      </Card>
    </div>
  );
}
