import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getTableAccess } from '@/services/userPermissions';
import CadDesk from '@/pages/Cad/CadDesk';
import { aggregateMany } from '@/lib/agg';
import { useReconcileOrders } from '@/lib/useReconcileOrders';
import {
  ORDER_FIELDS,
  daysLabel,
  daysLeft,
  daysTone,
  fmtDate,
  money,
  monthKey,
  monthLabel,
  orderDue,
  priorityStyles,
  todayStr,
  unwrapList,
} from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, ctaClass } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { StatCard } from '@/components/FormField';
import { StatsSkeleton, ListSkeleton } from '@/components/PageSkeleton';
import { ErrorBlock } from '@/components/StateBlocks';
import { Button } from '@/components/ui/button';
import KarigarHome from '@/pages/MyWork/KarigarHome';

import { eq, ne, isIn, lt, gte, lte, and } from '@/services/query';

export const route = { path: '/', layout: 'owner', access: 'authenticated' };
export const nav = {
  icon: 'LayoutDashboard',
  label: 'Dashboard',
  section: 'Overview',
  profiles: null,
  order: 10,
};

const OPEN = ['Draft', 'Active', 'Ready'];

function OrderRow({ order }) {
  const n = daysLeft(order.delivery_date_c);
  return (
    <Link
      to={`/orders/${order.Id}`}
      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-accent/50"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {order.bill_no_c || order.Name}{' '}
          <span className="font-normal text-muted-foreground">· {order.customer_c?.Name}</span>
        </p>
        <p className="text-xs text-muted-foreground">Due {money(orderDue(order))}</p>
      </div>
      <div className="flex items-center gap-3">
        {order.priority_c && order.priority_c !== 'Normal' && (
          <StatusBadge styles={priorityStyles} value={order.priority_c} />
        )}
        <div className="text-right">
          <p className="text-sm">{fmtDate(order.delivery_date_c)}</p>
          <p className={cn('text-xs font-medium', daysTone(n))}>{daysLabel(n)}</p>
        </div>
      </div>
    </Link>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const access = getTableAccess(profile, 'orders_c');
  const cashAccess = getTableAccess(profile, 'cashbook_c');
  const today = todayStr();
  const weekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd');
  const refreshAll = () => {
    metrics.run();
    upcoming.run();
    overdue.run();
  };
  useReconcileOrders(access.canUpdate, () => refreshAll());

  const metrics = useFetch(async () => {
    const orders = await aggregateMany('orders_c', [
      { id: 'open', where: isIn('status_c', OPEN) },
      { id: 'overdue', where: and(isIn('status_c', OPEN), lt('delivery_date_c', today)) },
      { id: 'ready', where: eq('status_c', 'Ready') },
    ]);
    let cash = null;
    if (cashAccess.canRead) {
      const c = await aggregateMany('cashbook_c', [
        { id: 'in', field: 'amount_c', fn: 'Sum', where: eq('kind_c', 'In') },
        { id: 'out', field: 'amount_c', fn: 'Sum', where: eq('kind_c', 'Out') },
      ]);
      cash = c.in - c.out;
    }
    return { orders, cash };
  }, []);

  const billed = useFetch(
    () =>
      sdk
        .table('orders_c')
        .select(['Name', 'bill_no_c', 'customer_c', 'order_date_c', 'delivery_date_c', 'total_c', 'paid_c', 'priority_c'])
        .where(ne('status_c', 'Cancelled'))
        .orderByDesc('order_date_c')
        .page(1, 200)
        .fetch()
        .then(unwrapList),
    [],
  );

  const upcoming = useFetch(
    () =>
      sdk
        .table('orders_c')
        .select(ORDER_FIELDS)
        .where(and(isIn('status_c', OPEN), gte('delivery_date_c', today), lte('delivery_date_c', weekEnd)))
        .orderBy('delivery_date_c')
        .page(1, 8)
        .fetch()
        .then(unwrapList),
    [today],
  );

  const overdue = useFetch(
    () =>
      sdk
        .table('orders_c')
        .select(ORDER_FIELDS)
        .where(and(isIn('status_c', OPEN), lt('delivery_date_c', today)))
        .orderBy('delivery_date_c')
        .page(1, 5)
        .fetch()
        .then(unwrapList),
    [today],
  );

  const { chartData, totalDue, topDues, dueBills } = useMemo(() => {
    const rows = billed.data ?? [];
    const byMonth = {};
    let sum = 0;
    const withDue = [];
    rows.forEach((o) => {
      const d = orderDue(o);
      if (d > 0) {
        const k = monthKey(o.order_date_c);
        byMonth[k] = (byMonth[k] ?? 0) + d;
        sum += d;
        withDue.push({ ...o, due: d });
      }
    });
    const keys = Object.keys(byMonth).sort().slice(-6);
    return {
      chartData: keys.map((k) => ({ month: monthLabel(k), due: byMonth[k] })),
      totalDue: sum,
      dueBills: withDue.length,
      topDues: withDue.sort((a, b) => b.due - a.due).slice(0, 5),
    };
  }, [billed.data]);

  const m = metrics.data?.orders;
  const cash = metrics.data?.cash;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="What needs attention in the workshop today."
        actions={
          access.canCreate && (
            <Button className={ctaClass} asChild>
              <Link to="/orders/new">
                <AppIcon name="Plus" size={16} /> Create order
              </Link>
            </Button>
          )
        }
      />
      <PageBody>
        {metrics.error && <ErrorBlock message={metrics.error.message} onRetry={metrics.run} />}
        {metrics.loading && metrics.data === undefined && <StatsSkeleton count={4} />}
        {m && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Open orders" value={m.open} hint={`${m.ready} ready for delivery`} />
            <StatCard
              label="Overdue"
              value={m.overdue}
              tone={m.overdue > 0 ? 'text-destructive' : undefined}
              hint="Past delivery date"
            />
            <StatCard
              label="Total dues"
              value={money(totalDue)}
              tone={totalDue > 0 ? 'text-warning' : 'text-success'}
              hint={`${dueBills} bill${dueBills === 1 ? '' : 's'} pending`}
            />
            {cash !== null && cash !== undefined && (
              <StatCard label="Cash in hand" value={money(cash)} hint="From the daily cashbook" />
            )}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Panel
            title="Deliveries in the next 7 days"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/orders">All orders</Link>
              </Button>
            }
          >
            {upcoming.loading && upcoming.data === undefined && <ListSkeleton rows={4} />}
            {upcoming.error && (
              <div className="p-4">
                <ErrorBlock message={upcoming.error.message} onRetry={upcoming.run} />
              </div>
            )}
            {upcoming.data && upcoming.data.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No deliveries due this week.</p>
            )}
            <div className="divide-y divide-border">
              {(upcoming.data ?? []).map((o) => (
                <OrderRow key={o.Id} order={o} />
              ))}
            </div>
          </Panel>

          <Panel title="Total dues by month">
            <div className="h-64 p-3">
              {billed.loading && billed.data === undefined && <ListSkeleton rows={3} />}
              {billed.error && <ErrorBlock message={billed.error.message} onRetry={billed.run} />}
              {billed.data && chartData.length === 0 && (
                <p className="p-6 text-center text-sm text-success">No dues pending. All bills are settled.</p>
              )}
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      cursor={{ fill: 'var(--accent)' }}
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12 }}
                      formatter={(v) => money(v)}
                    />
                    <Bar dataKey="due" name="Due" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Overdue orders">
            {overdue.loading && overdue.data === undefined && <ListSkeleton rows={3} />}
            {overdue.data && overdue.data.length === 0 && (
              <p className="p-6 text-center text-sm text-success">Nothing overdue. Well done.</p>
            )}
            <div className="divide-y divide-border">
              {(overdue.data ?? []).map((o) => (
                <OrderRow key={o.Id} order={o} />
              ))}
            </div>
          </Panel>
          <Panel
            title="Biggest dues to collect"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/dues')}>
                All dues
              </Button>
            }
          >
            {billed.loading && billed.data === undefined && <ListSkeleton rows={3} />}
            {billed.data && topDues.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No pending dues.</p>
            )}
            <div className="divide-y divide-border">
              {topDues.map((o) => (
                <Link
                  key={o.Id}
                  to={`/orders/${o.Id}`}
                  className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.bill_no_c || o.Name}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_c?.Name}</p>
                  </div>
                  <span className="font-semibold text-destructive">{money(o.due)}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </PageBody>
    </div>
  );
}

export default function Home() {
  const { profile } = useProfile();
  if (profile === 'Karigar_c') return <KarigarHome />;
  if (profile === 'CadMaster_c') return <CadDesk />;
  return <Dashboard />;
}
