import { Link } from 'react-router-dom';
import AppIcon from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="bg-primary text-primary-foreground">
      <div className="px-4 py-6 md:px-8 md:py-8">
        {back && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-3 mb-2 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link to={back.to}>
              <AppIcon name="ArrowLeft" size={16} /> {back.label}
            </Link>
          </Button>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-heading text-2xl font-semibold md:text-3xl">{title}</h1>
            {description && <p className="mt-1 text-sm text-primary-foreground/75">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
      <div className="h-1 bg-highlight" />
    </div>
  );
}

export function PageBody({ children, className }) {
  return <div className={cn('space-y-6 p-4 md:p-8', className)}>{children}</div>;
}

export const ctaClass = 'bg-highlight text-highlight-foreground hover:bg-highlight/90';
export const headerGhostClass =
  'border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground';
