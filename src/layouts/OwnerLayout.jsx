import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useOwnerLayoutData } from '@/hooks/useOwnerLayoutData';
import { APP_CONFIG } from '@/config/app.config';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import UserMenu from '@/components/UserMenu';
import { Input } from '@/components/ui/input';
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function OwnerLayout() {
  const { user, logout, homeRoute, navItems, navGroups, initials, displayName, counts } = useOwnerLayoutData();
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const grouped = navGroups.length ? navGroups : [{ label: null, items: navItems }];

  function submitSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/track?q=${encodeURIComponent(q)}`);
    setQuery('');
    setNavOpen(false);
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-(--spacing-sidebar) flex-col bg-sidebar text-sidebar-foreground transition-transform duration-(--transition-normal) md:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Link
          to={homeRoute}
          onClick={() => setNavOpen(false)}
          className="flex h-(--spacing-header) items-center gap-3 border-b border-sidebar-border px-5"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <AppIcon name={APP_CONFIG.icon} size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-lg font-semibold leading-tight">Royal Ethnix</span>
            <span className="block truncate text-xs text-sidebar-foreground/60">Tailor management</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {grouped.map((g, i) => (
            <div key={g.label ?? `group-${i}`} className="space-y-1">
              {g.label && (
                <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {g.label}
                </span>
              )}
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    )
                  }
                >
                  <AppIcon name={item.icon ?? 'Circle'} size={18} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {counts[item.to] != null && (
                    <span className="rounded-full bg-sidebar-border px-2 py-0.5 text-xs text-sidebar-foreground/80">
                      {counts[item.to]}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/50">
          City of the Royals
        </div>
      </aside>

      <div className="md:pl-(--spacing-sidebar)">
        <header className="sticky top-0 z-(--z-sticky) flex h-(--spacing-header) items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            className="-ml-1 flex size-10 items-center justify-center rounded-lg hover:bg-accent md:hidden"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <AppIcon name="Menu" size={22} />
          </button>
          {['Karigar_c', 'CadMaster_c'].includes(user?.profile) ? (
            <div className="flex-1" />
          ) : (
          <form onSubmit={submitSearch} className="relative min-w-0 max-w-md flex-1">
            <AppIcon
              name="Search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Track order: bill no. or phone"
              className="h-10 rounded-full bg-card pl-9"
              aria-label="Track order by bill number or phone"
            />
          </form>
          )}
          <div className="ml-auto">
            <UserMenu user={user} initials={initials} displayName={displayName} logout={logout} />
          </div>
        </header>
        <main>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
