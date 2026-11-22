import { useMemo, useState } from 'react';
import { fmtDate, kpayStyles, karigarEarned, money } from '@/lib/tms';
import { PERIODS, groupPayments, openKarigarStatement } from '@/lib/statement';
import AppIcon from '@/components/AppIcon';
import StatusBadge from '@/components/StatusBadge';
import PickSelect from '@/components/PickSelect';
import { StatCard } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';

const ALL = 'All bills';

export default function PaymentsTab({ me, payments, items }) {
  const [period, setPeriod] = useState('month');
  const [bill, setBill] = useState(ALL);
  const all = payments.data ?? [];

  const bills = useMemo(() => {
    const set = new Set();
    items.forEach((i) => i.order_c?.Name && set.add(i.order_c.Name));
    all.forEach((p) => p.bill_c && set.add(p.bill_c));
    return [ALL, ...[...set].sort()];
  }, [items, all]);

  if (payments.loading && payments.data === undefined) return <ListSkeleton rows={4} />;
  if (payments.error) return <ErrorBlock message={payments.error.message} onRetry={payments.run} />;

  const filtering = bill !== ALL;
  const list = filtering ? all.filter((p) => p.bill_c === bill) : all;
  const scopeItems = filtering ? items.filter((i) => i.order_c?.Name === bill) : items;
  const earned = karigarEarned(scopeItems);
  const received = list.reduce((s, p) => s + (Number(p.amount_c) || 0), 0);
  const balance = earned - received;
  const groups = groupPayments(list, period);
  const karigar = me.data;
  const range = filtering ? `Bill ${bill}` : 'All payments';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Earned" value={money(earned)} hint={filtering ? `Bill ${bill}` : 'Ready garments'} />
        <StatCard label="Received" value={money(received)} tone="text-success" />
        <StatCard
          label={balance >= 0 ? 'Balance' : 'Advance to adjust'}
          value={money(Math.abs(balance))}
          tone={balance > 0 ? 'text-destructive' : undefined}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            {Object.entries(PERIODS).map(([key, label]) => (
              <Button key={key} size="sm" variant={period === key ? 'default' : 'outline'} onClick={() => setPeriod(key)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="w-44">
            <p className="mb-1 text-xs text-muted-foreground">Filter by bill number</p>
            <PickSelect value={bill} onChange={setBill} options={bills} />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openKarigarStatement({ karigar, payments: list, items: scopeItems, earned, range })}
        >
          <AppIcon name="Download" size={14} /> Full statement (PDF)
        </Button>
      </div>

      {groups.length === 0 && (
        <EmptyBlock icon="Wallet" title="No payments found" text="Payments you receive will be listed here date wise." />
      )}

      {groups.map((g) => (
        <section key={g.key} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-heading text-lg font-semibold">{g.label}</p>
              <p className="text-xs text-muted-foreground">
                {g.rows.length} payment{g.rows.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-success">{money(g.total)}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openKarigarStatement({ karigar, payments: g.rows, range: `${g.label}${filtering ? ` - Bill ${bill}` : ''}` })}
              >
                <AppIcon name="Download" size={14} /> PDF
              </Button>
            </div>
          </div>
          <div className="mt-3 divide-y divide-border">
            {g.rows.map((p) => (
              <div key={p.Id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p>
                    {fmtDate(p.paid_on_c)}
                    {p.bill_c && <span className="text-muted-foreground"> · Bill {p.bill_c}</span>}
                  </p>
                  {p.note_c && <p className="truncate text-xs text-muted-foreground">{p.note_c}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge styles={kpayStyles} value={p.type_c} />
                  <span className="w-20 text-right font-medium">{money(p.amount_c)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
