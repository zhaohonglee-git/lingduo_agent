import { Link } from '@/i18n/navigation';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">Page not found</p>
      <Link
        href="/demo"
        className="mt-8 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to Demo
      </Link>
    </div>
  );
}
