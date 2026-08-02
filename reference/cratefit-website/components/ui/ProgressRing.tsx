'use client';

import { cn } from '@/lib/utils';

interface ProgressRingProps {
  value: number; // 0-1
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  animated?: boolean;
}

export function ProgressRing({
  value,
  size = 60,
  strokeWidth = 6,
  className,
  showValue = true,
  animated = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - value * circumference;

  // Color based on value
  const getColor = () => {
    if (value >= 0.8) return 'text-green-500';
    if (value >= 0.6) return 'text-yellow-500';
    if (value >= 0.4) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(getColor(), animated && 'transition-[stroke-dashoffset] duration-500')}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium">{Math.round(value * 100)}%</span>
        </div>
      )}
    </div>
  );
}
