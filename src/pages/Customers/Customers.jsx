import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import { CUSTOMER_FIELDS, SOURCES, fmtDate, unwrapList } from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass } from '@/components/PageHeader';
import PickSelect from '@/components/PickSelect';
import Pager from '@/components/Pager';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CustomerDialog from './CustomerDialog';

import { eq, or, contains, and } from '@/services/query';

export const route = { path: '/customers', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'Users',
  label: 'Customers',
  section: 'People',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 50,
  count: { table: 'customers_c', where: null },
};

const PAGE_SIZE = 20;
const SOURCE_FILTERS = ['All sources', ...SOURCES];

export default function Customers() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'customers_c');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('All sources');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, source, sort]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (search.trim()) f.push(or(contains('Name', search.trim()), contains('phone_c', search.trim())));
    if (source !== 'All sources') f.push(eq('source_c', source));
    let q = sdk.table('customers_c').select(CUSTOMER_FIELDS);
    if (f.length) q = q.where(and(...f));
    q = sort === 'name' ? q.orderBy('Name') : q.orderByDesc('CreatedOn');
    return q.page(page, PAGE_SIZE).fetch().then((r) => ({ rows: unwrapList(r), total: r.total ?? 0 }));
  }, [search, source, sort, page]);

  const rows = data?.rows ?? [];
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Phone book and order history for every client."
        actions={
          access.canCreate && (
            <Button className={ctaClass} onClick={() => setCreateOpen(true)}>
              <AppIcon name="UserPlus" size={16} /> New customer
            </Button>
          )
        }
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-[1fr_12rem_12rem]">
          <div className="relative">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="pl-9"
            />
          </div>
          <PickSelect value={source} onChange={setSource} options={SOURCE_FILTERS} />
          <PickSelect
            value={sort}
            onChange={setSort}
            options={['name', 'recent']}
            labels={{ name: 'Name A–Z', recent: 'Newest first' }}
          />
        </div>

        {firstLoad && <ListSkeleton rows={8} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock
            icon="Users"
            title="No customers found"
            text="Add your first customer or clear the filters."
            action={access.canCreate && <Button onClick={() => setCreateOpen(true)}>New customer</Button>}
          />
        )}

        {!firstLoad && !error && rows.length > 0 && (
          <div aria-busy={loading} className={cn('transition-opacity', loading && 'pointer-events-none opacity-60')}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((c) => (
                <div
                  key={c.Id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/customers/${c.Id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/customers/${c.Id}`)}
                  className="cursor-pointer space-y-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-heading font-semibold text-secondary-foreground">
                      {c.Name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.Name}</p>
                      <p className="text-sm text-muted-foreground">{c.phone_c || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="outline">{c.source_c || 'Unknown'}</Badge>
                    <span>Since {fmtDate(c.CreatedOn)}</span>
                  </div>
                </div>
              ))}
            </div>
            <Pager page={page} setPage={setPage} total={data?.total ?? 0} pageSize={PAGE_SIZE} noun="customer" />
          </div>
        )}
      </PageBody>
      <CustomerDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={run} />
    </div>
  );
}
