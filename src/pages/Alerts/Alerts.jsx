import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import {
  ITEM_STATUS_LABEL,
  OPEN_STAGES,
  daysLabel,
  daysLeft,
  daysTone,
  fmtDate,
  itemStatusStyles,
  karigarNames,
  lookupId,
  money,
  orderDue,
  unwrapList,
} from '@/lib/tms';
import { WA_TEMPLATES, sendWhatsApp } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { StatCard } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';

import { isIn } from '@/services/query';

export const route = {
  path: '/alerts',
  layout: 'owner',
  access: "profile === 'Owner_c' || profile === 'Staff_c' || profile === 'Manager_c'",
};
export const nav = {
  icon: 'BellRing',
  label: 'Alerts',
  section: 'Overview',
  profiles: ['Owner_c', 'Staff_c', 'Manager_c'],
  order: 15,
};

const SOON = 2;

function GarmentRow({ item }) {
  const n = daysLeft(item.due_date_c);
  return (
    <Link to={`/order-items/${item.Id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-accent/50">
      <div className="min-w-0">
        <p className="truncate font-medium">{item.Name}</p>
        <p className="text-xs text-muted-foreground">
          Bill {item.order_c?.Name} · {karigarNames(item, 'No karigar')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge styles={itemStatusStyles} value={item.status_c} label={ITEM_STATUS_LABEL[item.status_c]} />
        <div className="text-right">
          <p className="text-sm">{fmtDate(item.due_date_c)}</p>
          <p className={cn('text-xs font-medium', daysTone(n))}>{daysLabel(n)}</p>
        </div>
      </div>
    </Link>
  );
}

function Section({ title, tone, rows, children, empty }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <span className={cn('text-sm font-semibold', tone)}>{rows}</span>
      </div>
      {rows === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p> : children}
    </section>
  );
}

function CustomerAlert({ row, onSend, busy }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <Link to={`/orders/${row.order.Id}`} className="font-medium hover:underline">
          Bill {row.bill}
        </Link>
        <p className="text-xs text-muted-foreground">
          {row.customer?.Name ?? 'Customer'} · {row.customer?.phone_c ?? 'No phone'} · {row.reason}
        </p>
      </div>
      <Button size="sm" variant="outline" disabled={!row.customer?.phone_c || busy} onClick={() => onSend(row)}>
        <AppIcon name="MessageCircle" size={14} /> {WA_TEMPLATES[row.template].label}
      </Button>
    </div>
  );
}

export default function Alerts() {
  const [busy, setBusy] = useState(null);
  const [view, setView] = useState('garments');

  const { data, loading, error, run } = useFetch(async () => {
    const [items, orders, customers] = await Promise.all([
      sdk
        .table('order_items_c')
        .select(['Name', 'order_c', 'karigar_c', 'karigar2_c', 'karigar3_c', 'status_c', 'due_date_c'])
        .where(isIn('status_c', OPEN_STAGES))
        .orderBy('due_date_c')
        .page(1, 100)
        .fetch()
        .then(unwrapList),
      sdk
        .table('orders_c')
        .select(['Name', 'bill_no_c', 'customer_c', 'trial_date_c', 'delivery_date_c', 'total_c', 'paid_c', 'status_c'])
        .where(isIn('status_c', ['Draft', 'Active', 'Ready']))
        .orderBy('delivery_date_c')
        .page(1, 100)
        .fetch()
        .then(unwrapList),
      sdk.table('customers_c').select(['Name', 'phone_c']).page(1, 100).fetch().then(unwrapList),
    ]);
    return { items, orders, customers };
  }, []);

  const { overdue, soon, customerRows } = useMemo(() => {
    const items = data?.items ?? [];
    const orders = data?.orders ?? [];
    const byCustomer = new Map((data?.customers ?? []).map((c) => [String(c.Id), c]));
    const od = [];
    const sn = [];
    items.forEach((i) => {
      const n = daysLeft(i.due_date_c);
      if (n === null) return;
      if (n < 0) od.push(i);
      else if (n <= SOON) sn.push(i);
    });
    const rows = [];
    orders.forEach((o) => {
      const customer = byCustomer.get(String(lookupId(o.customer_c)));
      const bill = o.bill_no_c || o.Name;
      const due = orderDue(o);
      const base = { order: o, customer, bill, due };
      if (o.status_c === 'Ready') rows.push({ ...base, template: 'ready', reason: `Ready for pickup${due > 0 ? `, ${money(due)} due` : ''}` });
      const t = daysLeft(o.trial_date_c);
      if (t !== null && t >= 0 && t <= SOON) rows.push({ ...base, template: 'trial', date: fmtDate(o.trial_date_c), reason: `Trial ${daysLabel(t).toLowerCase()}` });
      const d = daysLeft(o.delivery_date_c);
      if (o.status_c !== 'Ready' && d !== null && d >= 0 && d <= SOON) rows.push({ ...base, template: 'delivery', date: fmtDate(o.delivery_date_c), reason: `Delivery ${daysLabel(d).toLowerCase()}` });
      if (due > 0 && o.status_c === 'Ready') rows.push({ ...base, template: 'due', reason: `Balance ${money(due)}` });
    });
    return { overdue: od, soon: sn, customerRows: rows };
  }, [data]);

  async function send(row) {
    const key = `${row.order.Id}-${row.template}`;
    setBusy(key);
    try {
      const result = await sendWhatsApp(row.template, {
        phone: row.customer?.phone_c,
        name: row.customer?.Name,
        bill: row.bill,
        due: row.due,
        date: row.date,
      });
      if (!result.ok) toast.error(result.message || 'Could not send');
      else if (result.via === 'api') toast.success('WhatsApp message sent');
    } finally {
      setBusy(null);
    }
  }

  const firstLoad = loading && data === undefined;

  return (
    <div>
      <PageHeader title="Alerts" description="Late garments and the customers who should hear from you today." />
      <PageBody>
        {error && <ErrorBlock message={error.message} onRetry={run} />}
        {firstLoad && <ListSkeleton rows={5} />}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Overdue garments" value={overdue.length} tone={overdue.length ? 'text-destructive' : undefined} />
              <StatCard label={`Due in ${SOON} days`} value={soon.length} tone={soon.length ? 'text-warning' : undefined} />
              <StatCard label="Customer reminders" value={customerRows.length} />
              <StatCard label="WhatsApp" value="Click to send" hint="Opens WhatsApp with the message" />
            </div>
            <div className="flex gap-2">
              <Button variant={view === 'garments' ? 'default' : 'outline'} onClick={() => setView('garments')}>
                Garment alerts
              </Button>
              <Button variant={view === 'customers' ? 'default' : 'outline'} onClick={() => setView('customers')}>
                Customer reminders
              </Button>
            </div>
            {view === 'garments' && (
              <div className="space-y-4">
                <Section title="Overdue" tone="text-destructive" rows={overdue.length} empty="No overdue garments.">
                  <div className="divide-y divide-border">
                    {overdue.map((i) => (
                      <GarmentRow key={i.Id} item={i} />
                    ))}
                  </div>
                </Section>
                <Section title={`Due within ${SOON} days`} tone="text-warning" rows={soon.length} empty="Nothing due soon.">
                  <div className="divide-y divide-border">
                    {soon.map((i) => (
                      <GarmentRow key={i.Id} item={i} />
                    ))}
                  </div>
                </Section>
              </div>
            )}
            {view === 'customers' && (
              <Section title="Send a reminder" rows={customerRows.length} empty="No customers need a reminder right now.">
                <div className="divide-y divide-border">
                  {customerRows.map((r) => (
                    <CustomerAlert key={`${r.order.Id}-${r.template}`} row={r} onSend={send} busy={busy === `${r.order.Id}-${r.template}`} />
                  ))}
                </div>
              </Section>
            )}
            {firstLoad === false && overdue.length + soon.length + customerRows.length === 0 && (
              <EmptyBlock icon="BellRing" title="All clear" text="No late garments or reminders pending." />
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
