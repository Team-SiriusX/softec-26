'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface RoleOption {
  value: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
  label: string;
  description: string;
  icon?: React.ReactNode;
}

interface RoleSelectionProps {
  value: 'WORKER' | 'VERIFIER' | 'ADVOCATE';
  onChange: (value: 'WORKER' | 'VERIFIER' | 'ADVOCATE') => void;
  roles?: RoleOption[];
  disabled?: boolean;
  className?: string;
}

export const DEFAULT_ROLES: RoleOption[] = [
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

export function RoleSelection({
  value,
  onChange,
  roles = DEFAULT_ROLES,
  disabled = false,
  className = '',
}: RoleSelectionProps) {
  return (
    <RadioGroup value={value} onValueChange={onChange} disabled={disabled}>
      <div className={`space-y-3 ${className}`}>
        {roles.map((role) => (
          <label
            key={role.value}
            className={`flex items-start p-4 border rounded-lg cursor-pointer transition-all ${
              value === role.value
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RadioGroupItem
              value={role.value}
              id={role.value}
              className="mt-1 shrink-0"
              disabled={disabled}
            />
            <div className="ml-3 flex-1">
              {role.icon && <div className="mb-2">{role.icon}</div>}
              <p className="font-semibold text-slate-900">{role.label}</p>
              <p className="text-sm text-slate-600">{role.description}</p>
            </div>
          </label>
        ))}
      </div>
    </RadioGroup>
  );
}
