import { ITEM_STATUS_LABEL, stagesFor } from '@/lib/tms';
import { cn } from '@/lib/utils';

export default function Pipeline({ status, handwork }) {
  const ITEM_STATUSES = stagesFor({ status_c: status, handwork_c: handwork });
  const idx = ITEM_STATUSES.indexOf(status);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1">
      {ITEM_STATUSES.map((s, i) => (
        <li key={s} className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              i < idx && 'bg-success-muted text-success',
              i === idx && 'bg-primary text-primary-foreground',
              i > idx && 'bg-muted text-muted-foreground',
            )}
          >
            {ITEM_STATUS_LABEL[s]}
          </span>
          {i < ITEM_STATUSES.length - 1 && <span className="h-px w-3 bg-border" />}
        </li>
      ))}
    </ol>
  );
}
