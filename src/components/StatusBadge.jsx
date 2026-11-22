import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function StatusBadge({ styles, value, label }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={cn('font-medium', styles[value])}>
      {label ?? value}
    </Badge>
  );
}
