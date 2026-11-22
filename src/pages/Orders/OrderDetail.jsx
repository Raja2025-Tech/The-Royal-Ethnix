import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { getFieldAccess, getTableAccess } from '@/services/userPermissions';
import {
  ITEM_FIELDS,
  fabricLabel,
  itemKarigars,
  karigarNames,
  stagesFor,
  ITEM_STATUS_LABEL,
  itemMeasureFields,
  ORDER_FIELDS,
  CUSTOMER_FIELDS,
  cadStyles,
  daysLabel,
  daysLeft,
  daysTone,
  deriveOrderStatus,
  fmtDate,
  kindStyles,
  lookupId,
  money,
  orderDue,
  orderPaid,
  orderStatusStyles,
  priorityStyles,
  syncOrderStatus,
  writeOk,
} from '@/lib/tms';
import { openChallan, openLabels } from '@/lib/statement';
import { WA_TEMPLATES, sendWhatsApp } from '@/lib/whatsapp';
import AppIcon from '@/components/AppIcon';
import { PageBody, PageHeader, headerGhostClass } from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Pipeline from '@/components/Pipeline';
import PickSelect from '@/components/PickSelect';
import ConfirmDelete from '@/components/ConfirmDelete';
import { InfoRow, StatCard } from '@/components/FormField';
import { EmptyBlock, ErrorBlock } from '@/components/StateBlocks';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { eq } from '@/services/query';

export const route = { path: '/orders/:id', layout: 'owner', access: 'authenticated' };

function measureSummary(item) {
  const fields = itemMeasureFields(item.kind_c, item.category_c?.Name);
  return fields.filter((f) => item[f.key] !== null && item[f.key] !== undefined && item[f.key] !== '');
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const { profile } = useProfile();
  const orderAccess = getTableAccess(profile, 'orders_c');
  const itemAccess = getTableAccess(profile, 'order_items_c');
  const wageHidden = getFieldAccess(profile, 'order_items_c', 'wage_c').hidden;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyItem, setBusyItem] = useState(null);

  const { data, loading, error, run } = useFetch(async () => {
    const orderRes = await sdk.table('orders_c').select(ORDER_FIELDS).get(id);
    let order = orderRes.data;
    if (!order) return { order: null, customer: null, items: [] };
    const custId = lookupId(order.customer_c);
    const [custRes, itemsRes] = await Promise.all([
      custId ? sdk.table('customers_c').select(CUSTOMER_FIELDS).get(custId) : Promise.resolve({ data: null }),
      sdk.table('order_items_c').select(ITEM_FIELDS).where(eq('order_c', id)).orderBy('CreatedOn').page(1, 50).fetch(),
    ]);
    if (!itemsRes.success) throw new Error(itemsRes.message);
    const next = deriveOrderStatus(order, itemsRes.data);
    if (next !== order.status_c && orderAccess.canUpdate) {
      const upd = await sdk.table('orders_c').update({ Id: id, status_c: next });
      if (upd.data && upd.data.length) order = { ...order, status_c: next };
    }
    return { order, customer: custRes.data, items: itemsRes.data };
  }, [id]);

  const order = data?.order;
  const customer = data?.customer;
  const items = data?.items ?? [];

  async function changeStage(item, status) {
    if (status === item.status_c) return;
    setBusyItem(item.Id);
    try {
      const res = await sdk.table('order_items_c').update({ Id: item.Id, status_c: status });
      if (!writeOk(res)) return;
      await syncOrderStatus(id);
      toast.success(`${item.Name} moved to ${ITEM_STATUS_LABEL[status]}`);
      run();
    } finally {
      setBusyItem(null);
    }
  }

  async function removeOrder() {
    setDeleting(true);
    try {
      if (items.length) {
        await sdk.table('order_items_c').remove(items.map((i) => i.Id));
      }
      const res = await sdk.table('orders_c').remove(id);
      if (!writeOk(res)) return;
      toast.success('Order deleted');
      navigate('/orders');
    } finally {
      setDeleting(false);
    }
  }

  if (loading && data === undefined) {
    return (
      <div>
        <PageHeader title="Order" back={{ to: '/orders', label: 'Back to Orders' }} />
        <PageBody>
          <DetailSkeleton />
        </PageBody>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <PageHeader title="Order" back={{ to: '/orders', label: 'Back to Orders' }} />
        <PageBody>
          {error ? (
            <ErrorBlock message={error.message} onRetry={run} />
          ) : (
            <EmptyBlock icon="SearchX" title="Order not found" text="It may have been deleted." />
          )}
        </PageBody>
      </div>
    );
  }

  const bill = order.bill_no_c || order.Name;
  const due = orderDue(order);
  const paid = orderPaid(order);
  const dl = order.status_c === 'Delivered' ? null : daysLeft(order.event_date_c || order.delivery_date_c);
  async function remind(key) {
    const dateStr = key === 'trial' ? fmtDate(order.trial_date_c) : fmtDate(order.delivery_date_c);
    const result = await sendWhatsApp(key, { phone: customer?.phone_c, name: customer?.Name, bill, due, date: dateStr });
    if (!result.ok) toast.error(result.message || 'Could not send');
    else if (result.via === 'api') toast.success('WhatsApp message sent');
  }
  const split = [
    { label: 'Cash', value: order.cash_c },
    { label: 'Card', value: order.card_c },
    { label: 'UPI / GPay / Paytm', value: order.upi_c },
  ];

  return (
    <div>
      <PageHeader
        title={`Bill ${bill}`}
        description={customer?.Name ?? order.customer_c?.Name ?? 'No customer'}
        back={{ to: '/orders', label: 'Back to Orders' }}
        actions={
          <>
            <Button
              variant="outline"
              className={headerGhostClass}
              onClick={() => openChallan({ bill, order, customer, items })}
            >
              <AppIcon name="Truck" size={16} /> Challan
            </Button>
            <Button variant="outline" className={headerGhostClass} onClick={() => openLabels({ bill, items })}>
              <AppIcon name="Barcode" size={16} /> Labels
            </Button>
            {orderAccess.canUpdate && (
              <Button variant="outline" className={headerGhostClass} asChild>
                <Link to={`/orders/${id}/edit`}>
                  <AppIcon name="Pencil" size={16} /> Edit
                </Link>
              </Button>
            )}
            {orderAccess.canDelete && (
              <Button variant="outline" className={headerGhostClass} onClick={() => setDeleteOpen(true)}>
                <AppIcon name="Trash2" size={16} /> Delete
              </Button>
            )}
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total bill" value={money(order.total_c)} />
          <StatCard label="Paid" value={money(paid)} tone="text-success" />
          <StatCard label="Balance due" value={money(due)} tone={due > 0 ? 'text-destructive' : undefined} />
          <StatCard
            label={order.event_date_c ? 'Event in' : 'Delivery in'}
            value={dl === null ? '—' : daysLabel(dl)}
            tone={daysTone(dl)}
            hint={fmtDate(order.event_date_c || order.delivery_date_c)}
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="process">Order process ({items.length})</TabsTrigger>
            <TabsTrigger value="bill">Bill and payment</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-heading text-lg font-semibold">Order details</h2>
                <dl className="mt-2">
                  <InfoRow label="Status"><StatusBadge styles={orderStatusStyles} value={order.status_c} /></InfoRow>
                  <InfoRow label="Priority"><StatusBadge styles={priorityStyles} value={order.priority_c} /></InfoRow>
                  <InfoRow label="Bill number">{bill}</InfoRow>
                  <InfoRow label="Order date">{fmtDate(order.order_date_c)}</InfoRow>
                  <InfoRow label="Trial date">{fmtDate(order.trial_date_c)}</InfoRow>
                  <InfoRow label="Delivery date">{fmtDate(order.delivery_date_c)}</InfoRow>
                  <InfoRow label="Event date">{fmtDate(order.event_date_c)}</InfoRow>
                </dl>
              </section>
              <div className="space-y-4">
                <section className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="font-heading text-lg font-semibold">Customer</h2>
                  {customer ? (
                    <>
                      <dl className="mt-2">
                        <InfoRow label="Name">
                          <Link to={`/customers/${customer.Id}`} className="text-primary hover:underline">
                            {customer.Name}
                          </Link>
                        </InfoRow>
                        <InfoRow label="Phone">
                          {customer.phone_c ? (
                            <a href={`tel:${customer.phone_c}`} className="text-primary hover:underline">
                              {customer.phone_c}
                            </a>
                          ) : null}
                        </InfoRow>
                        <InfoRow label="Address">{customer.address_c}</InfoRow>
                      </dl>
                      {customer.phone_c && (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {['ready', 'trial', 'delivery', ...(due > 0 ? ['due'] : [])].map((key) => (
                              <Button key={key} variant="outline" size="sm" onClick={() => remind(key)}>
                                <AppIcon name="MessageCircle" size={14} /> {WA_TEMPLATES[key].label}
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Opens a WhatsApp chat with the message filled in.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No customer linked.</p>
                  )}
                </section>
                <section className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="font-heading text-lg font-semibold">Pattern and remark</h2>
                  <dl className="mt-2">
                    <InfoRow label="CAD pattern"><StatusBadge styles={cadStyles} value={order.cad_pattern_c} /></InfoRow>
                    <InfoRow label="Pattern date">{fmtDate(order.pattern_date_c)}</InfoRow>
                  </dl>
                  <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                    {order.remark_c || 'No remark.'}
                  </p>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="process" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {items.length} garment{items.length === 1 ? '' : 's'} on this bill. Each one has its own measurements, karigar and stage.
              </p>
              {itemAccess.canCreate && (
                <Button asChild>
                  <Link to={`/orders/${id}/add-item`}>
                    <AppIcon name="Plus" size={16} /> Add garment
                  </Link>
                </Button>
              )}
            </div>
            {items.length === 0 && (
              <EmptyBlock
                icon="Shirt"
                title="No garments yet"
                text="Add the first garment with its measurements and karigar."
              />
            )}
            {items.map((item) => (
              <article key={item.Id} className="space-y-3 rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/order-items/${item.Id}`} className="font-heading text-lg font-semibold hover:underline">
                      {item.Name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <StatusBadge styles={kindStyles} value={item.kind_c} />
                      <span>{item.category_c?.Name ?? '—'}</span>
                      {item.kind_c === 'Top Wear' && item.sleeve_type_c && (
                        <span className="font-medium text-foreground">· {item.sleeve_type_c} sleeve</span>
                      )}
                      {item.handwork_c && <span className="font-medium text-foreground">· Handwork</span>}
                      {item.fabric_qty_c ? <span>· Fabric {fabricLabel(item)}</span> : null}
                      <span>· Karigar: {karigarNames(item)}</span>
                      {!wageHidden && itemKarigars(item).some((k) => k.wage) ? (
                        <span>· Wage {itemKarigars(item).map((k) => money(k.wage)).join(' + ')}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="w-40">
                    <PickSelect
                      value={item.status_c}
                      onChange={(v) => changeStage(item, v)}
                      options={stagesFor(item)}
                      labels={ITEM_STATUS_LABEL}
                      disabled={!itemAccess.canUpdate || busyItem === item.Id}
                    />
                  </div>
                </div>
                <Pipeline status={item.status_c} handwork={item.handwork_c} />
                <div className="flex flex-wrap gap-1.5">
                  {measureSummary(item).map((f) => (
                    <span key={f.key} className="rounded-md bg-muted px-2 py-1 text-xs">
                      <span className="text-muted-foreground">{f.label.replace(' (optional)', '')}</span>{' '}
                      <span className="font-semibold">{item[f.key]}</span>
                    </span>
                  ))}
                  {item.kind_c === 'Top Wear' && item.sleeve_type_c && (
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold">{item.sleeve_type_c} sleeve</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {item.fabric_c || 'Fabric not set'} · Karigar due {fmtDate(item.due_date_c)}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/order-items/${item.Id}`}>Open</Link>
                    </Button>
                    {itemAccess.canUpdate && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/order-items/${item.Id}/edit`}>Edit</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </TabsContent>

          <TabsContent value="bill" className="mt-4">
            <section className="max-w-xl rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold">Bill {bill}</h2>
                {orderAccess.canUpdate && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/orders/${id}/edit`}>Update payment</Link>
                  </Button>
                )}
              </div>
              <dl className="mt-2">
                <InfoRow label="Total bill">{money(order.total_c)}</InfoRow>
                {Number(order.discount_c) > 0 && <InfoRow label="Discount given">{money(order.discount_c)}</InfoRow>}
                {split.map((s) => (
                  <InfoRow key={s.label} label={s.label}>{money(s.value)}</InfoRow>
                ))}
                <InfoRow label="Total paid"><span className="font-semibold text-success">{money(paid)}</span></InfoRow>
                <InfoRow label="Balance due">
                  <span className={due > 0 ? 'font-semibold text-destructive' : 'font-semibold'}>{money(due)}</span>
                </InfoRow>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Payment modes come from the bill. They will sync automatically once the billing software is connected.
              </p>
            </section>
          </TabsContent>
        </Tabs>
      </PageBody>

      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete bill ${bill}?`}
        description="This also removes its garments. This cannot be undone."
        onConfirm={removeOrder}
        busy={deleting}
      />
    </div>
  );
}
