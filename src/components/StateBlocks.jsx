import AppIcon from '@/components/AppIcon';
import { Button } from '@/components/ui/button';

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-card p-8 text-center">
      <AppIcon name="TriangleAlert" size={28} className="text-destructive" />
      <div>
        <p className="font-medium">Could not load this data</p>
        <p className="text-sm text-muted-foreground">{message || 'Something went wrong.'}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyBlock({ icon = 'Inbox', title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <AppIcon name={icon} size={22} />
      </span>
      <div>
        <p className="font-heading text-lg font-semibold">{title}</p>
        {text && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      </div>
      {action}
    </div>
  );
}
