import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <Link href="/" className={cn('flex items-center gap-2', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          className="text-white"
        >
          <rect x="2" y="2" width="9" height="9" rx="1" fill="currentColor" />
          <rect x="13" y="2" width="9" height="9" rx="1" fill="currentColor" fillOpacity="0.7" />
          <rect x="2" y="13" width="9" height="9" rx="1" fill="currentColor" fillOpacity="0.7" />
          <rect x="13" y="13" width="9" height="9" rx="1" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </div>
      {showText && (
        <span className="text-xl font-bold tracking-tight">CrateFit</span>
      )}
    </Link>
  );
}
