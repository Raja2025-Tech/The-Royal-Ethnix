import { useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { ITEM_FIELDS, KARIGAR_FIELDS, KPAY_FIELDS, daysLeft, forKarigar, karigarEarned, money, unwrapList } from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton, StatsSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import GarmentCard, { isFinished } from './GarmentCard';
import PaymentsTab from './PaymentsTab';

export default function KarigarHome() {
  const [view, setView] = useState('todo');

  const me = useFetch(
    () => sdk.table('karigars_c').select(KARIGAR_FIELDS).page(1, 5).fetch().then((r) => unwrapList(r)[0] ?? null),
    [],
  );
  const payments = useFetch(
    () => sdk.table('karigar_payments_c').select(KPAY_FIELDS).orderByDesc('paid_on_c').page(1, 200).fetch().then(unwrapList),
    [],
  );
  const { data, loading, error, run } = useFetch(
    () => sdk.table('order_items_c').select(ITEM_FIELDS).orderBy('due_date_c').page(1, 100).fetch().then(unwrapList),
    [],
  );

  // Each garment shows this karigar's own wage when several karigars share it.
  const items = (data ?? []).map((i) => (me.data ? forKarigar(i, me.data.Id) : i));
  const todo = items.filter((i) => !isFinished(i));
  const done = items.filter(isFinished);
  const dueSoon = todo.filter((i) => {
    const n = daysLeft(i.due_date_c);
    return n !== null && n <= 1;
  });
  const earned = karigarEarned(items);
  const received = (payments.data ?? []).reduce((s, p) => s + (Number(p.amount_c) || 0), 0);
  const shown = view === 'todo' ? todo : done;
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader
        title={me.data ? `Hello, ${me.data.Name.split(' ')[0]}` : 'My work'}
        description="Update stages, write your rate and see your payments."
      />
      <PageBody>
        {firstLoad && <StatsSkeleton count={3} />}
        {!firstLoad && !error && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="To do" value={todo.length} />
            <StatCard
              label="Due now"
              value={dueSoon.length}
              tone={dueSoon.length > 0 ? 'text-destructive' : undefined}
              hint="Today or overdue"
            />
            <StatCard label="Earned" value={money(earned)} tone="text-success" hint="Rate written, ready onward" />
            <StatCard label="Received" value={money(received)} hint="All payments" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant={view === 'todo' ? 'default' : 'outline'} onClick={() => setView('todo')}>
            To do ({todo.length})
          </Button>
          <Button variant={view === 'done' ? 'default' : 'outline'} onClick={() => setView('done')}>
            Finished ({done.length})
          </Button>
          <Button variant={view === 'pay' ? 'default' : 'outline'} onClick={() => setView('pay')}>
            <AppIcon name="Wallet" size={14} /> My payments
          </Button>
        </div>

        {view === 'pay' && <PaymentsTab me={me} payments={payments} items={items} />}

        {view !== 'pay' && firstLoad && <ListSkeleton rows={4} />}
        {view !== 'pay' && error && <ErrorBlock message={error.message} onRetry={run} />}
        {view !== 'pay' && !firstLoad && !error && shown.length === 0 && (
          <EmptyBlock
            icon="Scissors"
            title={view === 'todo' ? 'Nothing to do right now' : 'No finished garments yet'}
            text={view === 'todo' ? 'New garments assigned to you will show up here.' : 'Garments marked Job Done will appear here.'}
          />
        )}

        {view !== 'pay' && (
          <div className="space-y-4">
            {shown.map((item) => (
              <GarmentCard key={item.Id} item={item} onChanged={run} />
            ))}
          </div>
        )}
      </PageBody>
    </div>
  );
}
