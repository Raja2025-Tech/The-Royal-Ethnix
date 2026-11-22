import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import {
  ORDER_FIELDS,
  fmtDate,
  isoDays,
  money,
  monthKey,
  monthLabel,
  orderDue,
  unwrapList,
  waLink,
} from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader } from '@/components/PageHeader';
import PickSelect from '@/components/PickSelect';
import { StatCard } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton, StatsSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { ne, isIn } from '@/services/query';

export const route = { path: '/dues', layout: 'owner', access: "profile === 'Owner_c' || profile === 'Staff_c' || profile === 'Manager_c'" };
export const nav = {
  icon: 'IndianRupee',
  label: 'Dues and Collections',
  section: 'Money',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 80,
};

export default function Dues() {
  const [month, setMonth] = useState('All');
  const [search, setSearch] = useState('');

  const { data, loading, error, run } = useFetch(async () => {
    const orders = await sdk
      .table('orders_c')
      .select(ORDER_FIELDS)
      .where(ne('status_c', 'Cancelled'))
      .orderByDesc('order_date_c')
      .page(1, 200)
      .fetch()
      .then(unwrapList);
    const ids = [...new Set(orders.filter((o) => orderDue(o) > 0).map((o) => o.customer_c?.Id).filter(Boolean))];
    const phones = {};
    if (ids.length) {
      const r = await sdk.table('customers_c').select(['Name', 'phone_c']).where(isIn('Id', ids)).page(1, 200).fetch();
      (r.data ?? []).forEach((c) => {
        phones[c.Id] = c.phone_c;
      });
    }
    return { orders, phones };
  }, []);

  const months = useMemo(() => {
    const keys = [...new Set((data?.orders ?? []).map((o) => monthKey(o.order_date_c)))].sort().reverse();
    return keys;
  }, [data]);

  const view = useMemo(() => {
    const orders = (data?.orders ?? []).filter((o) => month === 'All' || monthKey(o.order_date_c) === month);
    const q = search.trim().toLowerCase();
    const withDue = orders
      .filter((o) => orderDue(o) > 0)
      .filter((o) => !q || `${o.bill_no_c ?? o.Name} ${o.customer_c?.Name ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => orderDue(b) - orderDue(a));
    const sum = (key) => orders.reduce((s, o) => s + (Number(o[key]) || 0), 0);
    return {
      withDue,
      totalDue: withDue.reduce((s, o) => s + orderDue(o), 0),
      billed: sum('total_c'),
      cash: sum('cash_c'),
      card: sum('card_c'),
      upi: sum('upi_c'),
    };
  }, [data, month, search]);

  const monthOptions = ['All', ...months];
  const monthLabels = { All: 'All months', ...Object.fromEntries(months.map((k) => [k, monthLabel(k)])) };
  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader title="Dues and Collections" description="Pending balances and how customers paid, month by month." />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-[1fr_13rem]">
          <div className="relative">
            <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bill number or customer…" className="pl-9" />
          </div>
          <PickSelect value={month} onChange={setMonth} options={monthOptions} labels={monthLabels} />
        </div>

        {firstLoad && <StatsSkeleton count={4} />}
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total dues" value={money(view.totalDue)} tone={view.totalDue > 0 ? 'text-destructive' : 'text-success'} hint={`${view.withDue.length} bills`} />
              <StatCard label="Collected in cash" value={money(view.cash)} />
              <StatCard label="Collected by card" value={money(view.card)} />
              <StatCard label="Collected by UPI" value={money(view.upi)} />
            </div>

            {view.withDue.length === 0 ? (
              <EmptyBlock icon="CircleCheck" title="No pending dues" text="Every bill in this view is fully paid." />
            ) : (
              <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                {view.withDue.map((o) => {
                  const phone = data.phones[o.customer_c?.Id];
                  const link = waLink(
                    phone,
                    `Hello ${o.customer_c?.Name ?? ''}, a friendly reminder: balance of ${money(orderDue(o))} is pending for bill ${o.bill_no_c || o.Name} at The Royal Ethnix. Thank you.`,
                  );
                  return (
                    <div key={o.Id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <Link to={`/orders/${o.Id}`} className="font-medium hover:underline">
                          {o.bill_no_c || o.Name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {o.customer_c?.Name} · Billed {fmtDate(o.order_date_c)} · Total {money(o.total_c)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-destructive">{money(orderDue(o))}</span>
                        {link ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={link} target="_blank" rel="noreferrer">
                              <AppIcon name="MessageCircle" size={14} /> Remind
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No phone</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
