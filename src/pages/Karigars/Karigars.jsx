import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import { KARIGAR_FIELDS, SPECIALTIES, SPECIALTY_LABEL, activeStyles, unwrapList } from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass } from '@/components/PageHeader';
import PickSelect from '@/components/PickSelect';
import StatusBadge from '@/components/StatusBadge';
import Pager from '@/components/Pager';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import KarigarDialog from './KarigarDialog';

import { eq, or, contains, and } from '@/services/query';

export const route = { path: '/karigars', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'Scissors',
  label: 'Karigars',
  section: 'People',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 60,
  count: { table: 'karigars_c', where: null },
};

const PAGE_SIZE = 18;
const SPECIALTY_FILTERS = ['Any', ...SPECIALTIES];
const SPECIALTY_FILTER_LABEL = { ...SPECIALTY_LABEL, Any: 'Any specialty' };
const STATUS_FILTERS = ['Active', 'Inactive', 'Everyone'];

export default function Karigars() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'karigars_c');
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('Any');
  const [status, setStatus] = useState('Active');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, specialty, status]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (search.trim()) f.push(or(contains('Name', search.trim()), contains('phone_c', search.trim())));
    if (specialty !== 'Any') f.push(eq('specialty_c', specialty));
    if (status === 'Active') f.push(eq('active_c', true));
    if (status === 'Inactive') f.push(eq('active_c', false));
    let q = sdk.table('karigars_c').select(KARIGAR_FIELDS);
    if (f.length) q = q.where(and(...f));
    return q.orderBy('Name').page(page, PAGE_SIZE).fetch().then((r) => ({ rows: unwrapList(r), total: r.total ?? 0 }));
  }, [search, specialty, status, page]);

  const rows = data?.rows ?? [];
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader
        title="Karigars"
        description="Your workshop team, their specialties and majuri ledgers."
        actions={
          access.canCreate && (
            <Button className={ctaClass} onClick={() => setCreateOpen(true)}>
              <AppIcon name="UserPlus" size={16} /> New karigar
            </Button>
          )
        }
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-[1fr_13rem_11rem]">
          <div className="relative">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="pl-9"
            />
          </div>
          <PickSelect value={specialty} onChange={setSpecialty} options={SPECIALTY_FILTERS} labels={SPECIALTY_FILTER_LABEL} />
          <PickSelect value={status} onChange={setStatus} options={STATUS_FILTERS} />
        </div>

        {firstLoad && <ListSkeleton rows={6} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock
            icon="Scissors"
            title="No karigars found"
            text="Add a karigar to start assigning garments."
            action={access.canCreate && <Button onClick={() => setCreateOpen(true)}>New karigar</Button>}
          />
        )}

        {!firstLoad && !error && rows.length > 0 && (
          <div aria-busy={loading} className={cn('transition-opacity', loading && 'pointer-events-none opacity-60')}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((k) => (
                <div
                  key={k.Id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/karigars/${k.Id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/karigars/${k.Id}`)}
                  className="cursor-pointer space-y-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-highlight/25 font-heading text-lg font-semibold">
                      {k.Name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{k.Name}</p>
                      <p className="text-sm text-muted-foreground">{k.phone_c || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{SPECIALTY_LABEL[k.specialty_c] ?? '—'}</span>
                    <StatusBadge styles={activeStyles} value={k.active_c ? 'Active' : 'Inactive'} />
                  </div>
                </div>
              ))}
            </div>
            <Pager page={page} setPage={setPage} total={data?.total ?? 0} pageSize={PAGE_SIZE} noun="karigar" />
          </div>
        )}
      </PageBody>
      <KarigarDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={run} />
    </div>
  );
}
