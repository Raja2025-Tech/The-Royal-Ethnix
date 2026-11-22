import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { aggregateMany, monthStartStr } from '@/lib/agg';
import { KARIGAR_PAY_TYPES, KPAY_FIELDS, fmtDate, kpayStyles, money, unwrapList } from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass } from '@/components/PageHeader';
import PickSelect from '@/components/PickSelect';
import StatusBadge from '@/components/StatusBadge';
import Pager from '@/components/Pager';
import { StatCard } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import KpayDialog from './KpayDialog';

import { eq, contains, and, gte } from '@/services/query';

export const route = { path: '/majuri', layout: 'owner', access: "profile === 'Owner_c' || profile === 'Manager_c'" };
export const nav = {
  icon: 'Wallet',
  label: 'Karigar Majuri',
  section: 'Money',
  profiles: ['Owner_c', 'Manager_c'],
  order: 80,
};

const PAGE_SIZE = 20;
const TYPE_FILTERS = ['All types', ...KARIGAR_PAY_TYPES];

export default function Majuri() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All types');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, type]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (search.trim()) f.push(contains('Name', search.trim()));
    if (type !== 'All types') f.push(eq('type_c', type));
    let q = sdk.table('karigar_payments_c').select(KPAY_FIELDS);
    if (f.length) q = q.where(and(...f));
    return q.orderByDesc('paid_on_c').page(page, PAGE_SIZE).fetch().then((r) => ({ rows: unwrapList(r), total: r.total ?? 0 }));
  }, [search, type, page]);

  const { data: totals, run: refetchTotals } = useFetch(
    () =>
      aggregateMany('karigar_payments_c', [
        { id: 'all', field: 'amount_c', fn: 'Sum' },
        { id: 'month', field: 'amount_c', fn: 'Sum', where: gte('paid_on_c', monthStartStr()) },
        { id: 'adv', field: 'amount_c', fn: 'Sum', where: eq('type_c', 'Advance') },
      ]),
    [],
  );

  const rows = data?.rows ?? [];
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader
        title="Karigar Majuri"
        description="Advances, majuri settlements and bonuses paid to the workshop."
        actions={
          (profile === 'Owner_c' || profile === 'Manager_c') && (
            <Button className={ctaClass} onClick={() => setCreateOpen(true)}>
              <AppIcon name="Plus" size={16} /> Pay karigar
            </Button>
          )
        }
      />
      <PageBody>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="This month" value={money(totals?.month)} />
          <StatCard label="Advances given" value={money(totals?.adv)} tone="text-warning" />
          <StatCard label="All time" value={money(totals?.all)} />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_13rem]">
          <div className="relative">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payment reference…"
              className="pl-9"
            />
          </div>
          <PickSelect value={type} onChange={setType} options={TYPE_FILTERS} />
        </div>

        {firstLoad && <ListSkeleton rows={6} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock icon="Wallet" title="No karigar payments" text="Record an advance or majuri to start the ledger." />
        )}
        {!firstLoad && !error && rows.length > 0 && (
          <div aria-busy={loading} className={cn('transition-opacity', loading && 'pointer-events-none opacity-60')}>
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {rows.map((p) => (
                <div
                  key={p.Id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/majuri/${p.Id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/majuri/${p.Id}`)}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{p.Name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.karigar_c?.Name} · {fmtDate(p.paid_on_c)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge styles={kpayStyles} value={p.type_c} />
                    <span className="font-semibold">{money(p.amount_c)}</span>
                  </div>
                </div>
              ))}
            </div>
            <Pager page={page} setPage={setPage} total={data?.total ?? 0} pageSize={PAGE_SIZE} noun="payment" />
          </div>
        )}
      </PageBody>
      <KpayDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => {
          run();
          refetchTotals();
        }}
      />
    </div>
  );
}
