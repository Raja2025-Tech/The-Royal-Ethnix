import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import {
  CAD_STATUSES,
  ORDER_STATUSES,
  PRIORITIES,
  formatBill,
  lookupId,
  money,
  syncOrderCash,
  toNumber,
  todayStr,
  writeOk,
} from '@/lib/tms';
import AppIcon from '@/components/AppIcon';
import LookupPicker from '@/components/LookupPicker';
import PickSelect from '@/components/PickSelect';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { eq, contains } from '@/services/query';

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
      <div className={description ? 'grid gap-4 md:grid-cols-2' : 'mt-4 grid gap-4 md:grid-cols-2'}>{children}</div>
    </section>
  );
}

export default function OrderForm({ record }) {
  const navigate = useNavigate();
  const isEdit = Boolean(record);
  const [saving, setSaving] = useState(false);
  const [custPhone, setCustPhone] = useState('');
  const [custName, setCustName] = useState('');
  const [form, setForm] = useState(() => ({
    bill_no_c: record?.bill_no_c ?? record?.Name ?? '',
    customer_c: lookupId(record?.customer_c),
    order_date_c: record?.order_date_c ?? todayStr(),
    trial_date_c: record?.trial_date_c ?? '',
    delivery_date_c: record?.delivery_date_c ?? '',
    event_date_c: record?.event_date_c ?? '',
    total_c: record?.total_c ?? '',
    discount_c: record?.discount_c ?? '',
    cash_c: record?.cash_c ?? '',
    card_c: record?.card_c ?? '',
    upi_c: record?.upi_c ?? '',
    priority_c: record?.priority_c ?? 'Normal',
    status_c: record?.status_c && record.status_c !== 'Draft' ? record.status_c : 'Active',
    cad_pattern_c: record?.cad_pattern_c ?? 'Pending',
    pattern_date_c: record?.pattern_date_c ?? '',
    remark_c: record?.remark_c ?? '',
  }));

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const backTo = isEdit ? `/orders/${record.Id}` : '/orders';

  const total = toNumber(form.total_c) ?? 0;
  const paid = (toNumber(form.cash_c) ?? 0) + (toNumber(form.card_c) ?? 0) + (toNumber(form.upi_c) ?? 0);
  const due = Math.max(0, total - paid);

  async function save(e) {
    e.preventDefault();
    const bill = formatBill(form.bill_no_c, form.order_date_c);
    const phone = custPhone.replace(/\D/g, '').slice(-10);
    if (!bill) {
      toast.error('Bill number is required');
      return;
    }
    if (isEdit ? !form.customer_c : phone.length < 10) {
      toast.error(isEdit ? 'Customer is required' : 'Enter the customer 10-digit phone number');
      return;
    }
    if (paid > total) {
      toast.error('Paid amount is more than the bill total');
      return;
    }
    setSaving(true);
    try {
      const dup = await sdk.table('orders_c').select(['Name']).where(eq('bill_no_c', bill)).page(1, 5).fetch();
      const clash = (dup.data ?? []).find((r) => String(r.Id) !== String(record?.Id));
      if (clash) {
        toast.error(`Bill number ${bill} already exists`);
        return;
      }
      let customerId = form.customer_c;
      if (!isEdit) {
        const found = await sdk.table('customers_c').select(['Name', 'phone_c']).where(contains('phone_c', phone)).page(1, 1).fetch();
        const existing = (found.data ?? [])[0];
        if (existing) {
          customerId = existing.Id;
          const typed = custName.trim();
          if (typed && existing.Name === existing.phone_c) {
            await sdk.table('customers_c').update({ Id: existing.Id, Name: typed });
          }
        } else {
          const made = await sdk.table('customers_c').create({ Name: custName.trim() || phone, phone_c: phone, source_c: 'Walk-in' });
          if (!writeOk(made)) return;
          customerId = made.data[0].Id;
        }
      }
      const payload = {
        Name: bill,
        bill_no_c: bill,
        customer_c: customerId,
        order_date_c: form.order_date_c || null,
        trial_date_c: form.trial_date_c || null,
        delivery_date_c: form.delivery_date_c || null,
        event_date_c: form.event_date_c || null,
        total_c: total,
        discount_c: toNumber(form.discount_c) ?? 0,
        cash_c: toNumber(form.cash_c) ?? 0,
        card_c: toNumber(form.card_c) ?? 0,
        upi_c: toNumber(form.upi_c) ?? 0,
        paid_c: paid,
        priority_c: form.priority_c,
        status_c: form.status_c,
        cad_pattern_c: form.cad_pattern_c,
        pattern_date_c: form.pattern_date_c || null,
        remark_c: form.remark_c || null,
      };
      const res = isEdit
        ? await sdk.table('orders_c').update({ Id: record.Id, ...payload })
        : await sdk.table('orders_c').create(payload);
      if (!writeOk(res)) return;
      await syncOrderCash(res.data[0].Id, bill, toNumber(form.cash_c) ?? 0);
      toast.success(isEdit ? 'Order updated' : 'Order created');
      navigate(`/orders/${res.data[0].Id}${isEdit ? '' : '?tab=process'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Section
        title="Bill and customer"
        description="Every order is tracked by its bill number. These values will be fetched from your billing software later."
      >
        <FormField
          label="Bill number"
          required
          hint={
            /^\d+$/.test(form.bill_no_c.trim())
              ? `Will be saved as ${formatBill(form.bill_no_c, form.order_date_c)}`
              : 'Type only the serial number, for example 1061. Prefix and financial year are added automatically.'
          }
        >
          <Input
            value={form.bill_no_c}
            onChange={(e) => set('bill_no_c', e.target.value)}
            onBlur={() => set('bill_no_c', formatBill(form.bill_no_c, form.order_date_c))}
            placeholder="1061"
          />
        </FormField>
        {isEdit ? (
          <FormField label="Customer" required>
            <LookupPicker
              table="customers_c"
              searchField="Name"
              value={form.customer_c}
              onChange={(id) => set('customer_c', id)}
              placeholder="Search customer…"
            />
          </FormField>
        ) : (
          <>
            <FormField label="Customer phone" required hint="An existing customer is matched by this number, otherwise a new one is created.">
              <Input inputMode="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="98300 11201" />
            </FormField>
            <FormField label="Customer name (optional)">
              <Input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Rahul Banerjee" />
            </FormField>
          </>
        )}
        <FormField label="Total bill (INR)">
          <Input type="number" min="0" value={form.total_c} onChange={(e) => set('total_c', e.target.value)} placeholder="10000" />
        </FormField>
        <FormField label="Discount (INR)">
          <Input type="number" min="0" value={form.discount_c} onChange={(e) => set('discount_c', e.target.value)} placeholder="0" />
        </FormField>
      </Section>

      <Section
        title="Payment received"
        description="One bill can be paid in parts, for example ₹5,000 cash, ₹4,000 card and ₹1,000 UPI."
      >
        <FormField label="Cash (INR)">
          <Input type="number" min="0" value={form.cash_c} onChange={(e) => set('cash_c', e.target.value)} placeholder="5000" />
        </FormField>
        <FormField label="Card (INR)">
          <Input type="number" min="0" value={form.card_c} onChange={(e) => set('card_c', e.target.value)} placeholder="4000" />
        </FormField>
        <FormField label="UPI / GPay / Paytm (INR)">
          <Input type="number" min="0" value={form.upi_c} onChange={(e) => set('upi_c', e.target.value)} placeholder="1000" />
        </FormField>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="font-semibold text-success">{money(paid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due</p>
            <p className={due > 0 ? 'font-semibold text-destructive' : 'font-semibold'}>{money(due)}</p>
          </div>
        </div>
      </Section>

      <Section title="Important dates">
        <FormField label="Order date">
          <Input type="date" value={form.order_date_c} onChange={(e) => set('order_date_c', e.target.value)} />
        </FormField>
        <FormField label="Trial date">
          <Input type="date" value={form.trial_date_c} onChange={(e) => set('trial_date_c', e.target.value)} />
        </FormField>
        <FormField label="Delivery date">
          <Input type="date" value={form.delivery_date_c} onChange={(e) => set('delivery_date_c', e.target.value)} />
        </FormField>
        <FormField label="Event date" hint="Wedding or function date, used for days left.">
          <Input type="date" value={form.event_date_c} onChange={(e) => set('event_date_c', e.target.value)} />
        </FormField>
      </Section>

      <Section title="Production">
        <FormField label="Priority">
          <PickSelect value={form.priority_c} onChange={(v) => set('priority_c', v)} options={PRIORITIES} />
        </FormField>
        <FormField label="Order status">
          <PickSelect value={form.status_c} onChange={(v) => set('status_c', v)} options={ORDER_STATUSES.filter((s) => s !== 'Draft')} />
        </FormField>
        <FormField label="CAD pattern">
          <PickSelect value={form.cad_pattern_c} onChange={(v) => set('cad_pattern_c', v)} options={CAD_STATUSES} />
        </FormField>
        <FormField label="Pattern date">
          <Input type="date" value={form.pattern_date_c} onChange={(e) => set('pattern_date_c', e.target.value)} />
        </FormField>
        <FormField label="Remark" className="md:col-span-2">
          <Textarea
            rows={3}
            value={form.remark_c}
            onChange={(e) => set('remark_c', e.target.value)}
            placeholder="Special instructions for the workshop…"
          />
        </FormField>
      </Section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link to={backTo}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <AppIcon name="LoaderCircle" size={16} className="animate-spin" /> Saving…
            </>
          ) : isEdit ? (
            'Save changes'
          ) : (
            'Create order'
          )}
        </Button>
      </div>
    </form>
  );
}
