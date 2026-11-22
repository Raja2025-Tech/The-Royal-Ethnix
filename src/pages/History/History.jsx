import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { unwrapList } from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader } from '@/components/PageHeader';
import PickSelect from '@/components/PickSelect';
import Pager from '@/components/Pager';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { eq, contains, and } from '@/services/query';

export const route = { path: '/history', layout: 'owner', access: "profile === 'Owner_c' || profile === 'Manager_c'" };
export const nav = {
  icon: 'History',
  label: 'Change History',
  section: 'Overview',
  profiles: ['Owner_c', 'Manager_c'],
  order: 95,
};

const PAGE_SIZE = 20;
const ACTIONS = ['All actions', 'Create', 'Update', 'Delete'];
const ENTITIES = ['All records', 'Bill', 'Garment', 'Customer', 'Karigar', 'Karigar payment', 'Cashbook', 'Stock item', 'Stock move'];
const tone = { Create: 'text-success', Update: 'text-primary', Delete: 'text-destructive' };

function when(value) {
  try {
    return format(parseISO(value), 'd MMM yyyy, h:mm a');
  } catch {
    return '';
  }
}

export default function History() {
  const [bill, setBill] = useState('');
  const [action, setAction] = useState('All actions');
  const [entity, setEntity] = useState('All records');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [bill, action, entity]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (bill.trim()) f.push(contains('bill_c', bill.trim()));
    if (action !== 'All actions') f.push(eq('action_c', action));
    if (entity !== 'All records') f.push(eq('entity_c', entity));
    let q = sdk.table('audit_log_c').select(['Name', 'entity_c', 'bill_c', 'action_c', 'changes_c', 'by_c', 'role_c', 'CreatedOn']);
    if (f.length) q = q.where(and(...f));
    return q.orderByDesc('CreatedOn').page(page, PAGE_SIZE).fetch().then((r) => ({ rows: unwrapList(r), total: r.total ?? 0 }));
  }, [bill, action, entity, page]);

  const rows = data?.rows ?? [];
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader title="Change History" description="Who changed what, and when, on bills, garments, payments and the cashbook." />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-[1fr_12rem_12rem]">
          <div className="relative">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={bill} onChange={(e) => setBill(e.target.value)} placeholder="Filter by bill number…" className="pl-9" />
          </div>
          <PickSelect value={entity} onChange={setEntity} options={ENTITIES} />
          <PickSelect value={action} onChange={setAction} options={ACTIONS} />
        </div>

        {firstLoad && <ListSkeleton rows={6} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {!firstLoad && !error && rows.length === 0 && (
          <EmptyBlock icon="History" title="No changes recorded" text="Every edit made from now on appears here automatically." />
        )}
        {!firstLoad && !error && rows.length > 0 && (
          <div aria-busy={loading} className={cn('transition-opacity', loading && 'opacity-60')}>
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {rows.map((r) => (
                <div key={r.Id} className="space-y-1 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      <span className={tone[r.action_c]}>{r.action_c}</span> · {r.Name}
                      {r.bill_c && <span className="text-muted-foreground"> · Bill {r.bill_c}</span>}
                    </p>
                    <Badge variant="outline">{r.entity_c}</Badge>
                  </div>
                  {r.changes_c && <p className="whitespace-pre-line text-sm text-muted-foreground">{r.changes_c}</p>}
                  <p className="text-xs text-muted-foreground">
                    {r.by_c || 'Unknown'}
                    {r.role_c ? ` (${r.role_c.replace('_c', '')})` : ''} · {when(r.CreatedOn)}
                  </p>
                </div>
              ))}
            </div>
            <Pager page={page} setPage={setPage} total={data?.total ?? 0} pageSize={PAGE_SIZE} noun="change" />
          </div>
        )}
      </PageBody>
    </div>
  );
}
