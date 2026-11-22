import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import { CATEGORY_FIELDS, ITEM_KINDS, kindStyles, money, unwrapList } from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass } from '@/components/PageHeader';
import PickSelect from '@/components/PickSelect';
import StatusBadge from '@/components/StatusBadge';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CategoryDialog from './CategoryDialog';

import { eq, contains, and } from '@/services/query';

export const route = { path: '/categories', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'Shirt',
  label: 'Garment Categories',
  section: 'Setup',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 110,
};

const KIND_FILTERS = ['All types', ...ITEM_KINDS];

export default function Categories() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'categories_c');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('All types');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (search.trim()) f.push(contains('Name', search.trim()));
    if (kind !== 'All types') f.push(eq('kind_c', kind));
    let q = sdk.table('categories_c').select(CATEGORY_FIELDS);
    if (f.length) q = q.where(and(...f));
    return q.orderBy('Name').page(1, 100).fetch().then(unwrapList);
  }, [search, kind]);

  const rows = data ?? [];
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader
        title="Garment Categories"
        description="Top wear and bottom wear types offered in the order form."
        actions={
          access.canCreate && (
            <Button className={ctaClass} onClick={() => setCreateOpen(true)}>
              <AppIcon name="Plus" size={16} /> New category
            </Button>
          )
        }
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-[1fr_13rem]">
          <div className="relative">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories…" className="pl-9" />
          </div>
          <PickSelect value={kind} onChange={setKind} options={KIND_FILTERS} />
        </div>

        {firstLoad && <ListSkeleton rows={6} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock icon="Shirt" title="No categories found" text="Add a custom garment category." />
        )}
        {!firstLoad && !error && rows.length > 0 && (
          <div aria-busy={loading} className={cn('grid gap-3 transition-opacity sm:grid-cols-2 xl:grid-cols-3', loading && 'pointer-events-none opacity-60')}>
            {rows.map((c) => (
              <div
                key={c.Id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/categories/${c.Id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/categories/${c.Id}`)}
                className="cursor-pointer space-y-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-heading text-lg font-semibold">{c.Name}</p>
                  <StatusBadge styles={kindStyles} value={c.kind_c} />
                </div>
                <p className="text-sm text-muted-foreground">Default wage {money(c.default_wage_c)}</p>
              </div>
            ))}
          </div>
        )}
      </PageBody>
      <CategoryDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={run} />
    </div>
  );
}
