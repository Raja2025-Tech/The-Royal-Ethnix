import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function FormField({ label, required, hint, className, children }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children ?? '—'}</dd>
    </div>
  );
}

export function StatCard({ label, value, hint, tone }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-heading text-2xl font-semibold md:text-3xl', tone)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
