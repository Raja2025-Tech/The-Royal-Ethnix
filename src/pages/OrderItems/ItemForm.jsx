import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useProfile } from '@/hooks/useProfile';
import { getFieldAccess } from '@/services/userPermissions';
import {
  accessoryMode,
  itemMeasureFields,
  ITEM_KINDS,
  stagesFor,
  FABRIC_UNITS,
  FABRIC_UNIT_LABEL,
  ITEM_STATUS_LABEL,
  MEASURE_KEYS,
  SLEEVES,
  lookupId,
  syncOrderStatus,
  toNumber,
  writeOk,
} from '@/lib/tms';
import { cn } from '@/lib/utils';
import AppIcon from '@/components/AppIcon';
import LookupPicker from '@/components/LookupPicker';
import FilePicker from '@/components/FilePicker';
import PickSelect from '@/components/PickSelect';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { eq, isIn, and } from '@/services/query';

const PHOTO_CONFIG = {
  supportMultipleValues: true,
  supportedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
  minValue: 1,
  maxValue: 5120,
};

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ItemForm({ orderId, record }) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const wageHidden = getFieldAccess(profile, 'order_items_c', 'wage_c').hidden;
  const isEdit = Boolean(record);
  const [saving, setSaving] = useState(false);
  const [titleTouched, setTitleTouched] = useState(isEdit);
  const [categoryName, setCategoryName] = useState(record?.category_c?.Name ?? '');
  const [form, setForm] = useState(() => {
    const base = {
      Name: record?.Name ?? '',
      kind_c: record?.kind_c ?? 'Top Wear',
      category_c: lookupId(record?.category_c),
      karigar_c: lookupId(record?.karigar_c),
      karigar2_c: lookupId(record?.karigar2_c),
      karigar3_c: lookupId(record?.karigar3_c),
      wage_c: record?.wage_c ?? '',
      wage2_c: record?.wage2_c ?? '',
      wage3_c: record?.wage3_c ?? '',
      handwork_c: Boolean(record?.handwork_c),
      fabric_qty_c: record?.fabric_qty_c ?? '',
      fabric_unit_c: record?.fabric_unit_c ?? 'Meter',
      status_c: record?.status_c ?? 'New',
      due_date_c: record?.due_date_c ?? '',
      sleeve_type_c: record?.sleeve_type_c ?? 'Full',
      fabric_c: record?.fabric_c ?? '',
      design_c: record?.design_c ?? '',
      photos_c: record?.photos_c ?? [],
      fabric_photos_c: record?.fabric_photos_c ?? [],
      qty_c: record?.qty_c ?? 1,
      size_c: record?.size_c ?? '',
    };
    MEASURE_KEYS.forEach((k) => {
      base[k] = record?.[k] ?? '';
    });
    return base;
  });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const fields = itemMeasureFields(form.kind_c, categoryName);
  const isAccessory = form.kind_c === 'Accessory';
  const accMode = isAccessory ? accessoryMode(categoryName) : null;
  const targetOrder = orderId ?? lookupId(record?.order_c);
  const backTo = isEdit ? `/order-items/${record.Id}` : `/orders/${targetOrder}?tab=process`;

  async function pickCategory(id) {
    set('category_c', id);
    if (!id) {
      setCategoryName('');
      return;
    }
    const res = await sdk.table('categories_c').select(['Name', 'default_wage_c']).get(id);
    if (!res.data) return;
    setCategoryName(res.data.Name);
    setForm((f) => ({
      ...f,
      Name: titleTouched && f.Name ? f.Name : res.data.Name,
      wage_c: f.wage_c === '' && res.data.default_wage_c ? res.data.default_wage_c : f.wage_c,
    }));
  }

  async function copyPrevious() {
    if (!form.category_c) {
      toast.error('Pick a category first');
      return;
    }
    try {
      const ord = await sdk.table('orders_c').select(['customer_c']).get(targetOrder);
      const custId = lookupId(ord.data?.customer_c);
      if (!custId) {
        toast.error('No customer on this bill');
        return;
      }
      const orders = await sdk.table('orders_c').select(['Name']).where(eq('customer_c', custId)).page(1, 50).fetch();
      const ids = (orders.data ?? []).map((o) => o.Id).filter((x) => String(x) !== String(targetOrder));
      if (!ids.length) {
        toast.info('No earlier bills for this customer');
        return;
      }
      const res = await sdk
        .table('order_items_c')
        .select(['Name', 'CreatedOn', ...MEASURE_KEYS])
        .where(and(isIn('order_c', ids), eq('category_c', form.category_c)))
        .orderByDesc('CreatedOn')
        .page(1, 1)
        .fetch();
      const prev = (res.data ?? [])[0];
      if (!prev) {
        toast.info('No earlier garment of this category found');
        return;
      }
      setForm((f) => {
        const next = { ...f };
        MEASURE_KEYS.forEach((k) => {
          if (prev[k] !== null && prev[k] !== undefined) next[k] = prev[k];
        });
        return next;
      });
      toast.success(`Measurements copied from ${prev.Name}`);
    } catch (err) {
      toast.error(err?.message || 'Could not copy measurements');
    }
  }

  async function save(e) {
    e.preventDefault();
    if (!form.Name.trim() || !form.category_c) {
      toast.error('Pick a category and give the garment a title');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Name: form.Name.trim(),
        order_c: targetOrder,
        kind_c: form.kind_c,
        category_c: form.category_c,
        karigar_c: form.karigar_c || null,
        karigar2_c: form.karigar2_c || null,
        karigar3_c: form.karigar3_c || null,
        handwork_c: form.handwork_c,
        fabric_qty_c: toNumber(form.fabric_qty_c),
        fabric_unit_c: form.fabric_unit_c,
        status_c: form.status_c,
        due_date_c: form.due_date_c || null,
        sleeve_type_c: form.kind_c === 'Top Wear' ? form.sleeve_type_c : null,
        fabric_c: form.fabric_c || null,
        design_c: form.design_c || null,
        qty_c: Math.max(1, Math.round(toNumber(form.qty_c) ?? 1)),
        size_c: isAccessory && accMode === 'size' ? form.size_c.trim() || null : null,
      };
      if (!wageHidden) {
        payload.wage_c = toNumber(form.wage_c) ?? 0;
        payload.wage2_c = form.karigar2_c ? toNumber(form.wage2_c) ?? 0 : null;
        payload.wage3_c = form.karigar3_c ? toNumber(form.wage3_c) ?? 0 : null;
      }
      if (!isEdit) {
        payload.cad_c = form.kind_c === 'Accessory' ? 'Not Required' : 'Pending';
      }
      const keys = fields.map((f) => f.key);
      MEASURE_KEYS.forEach((k) => {
        payload[k] = keys.includes(k) ? toNumber(form[k]) : null;
      });
      const res = isEdit
        ? await sdk.table('order_items_c').update({
            Id: record.Id,
            ...payload,
            photos_c: sdk.storage.toUpdateFormat(form.photos_c),
            fabric_photos_c: sdk.storage.toUpdateFormat(form.fabric_photos_c),
          })
        : await sdk.table('order_items_c').create({
            ...payload,
            photos_c: sdk.storage.toCreateFormat(form.photos_c),
            fabric_photos_c: sdk.storage.toCreateFormat(form.fabric_photos_c),
          });
      if (!writeOk(res)) return;
      await syncOrderStatus(targetOrder);
      toast.success(isEdit ? 'Garment updated' : 'Garment added');
      navigate(isEdit ? `/order-items/${record.Id}` : `/orders/${targetOrder}?tab=process`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Section title="Garment" description="Choose top wear, bottom wear or an accessory, then the category.">
        <div className="mb-4 inline-flex rounded-xl border border-border bg-muted p-1">
          {ITEM_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                set('kind_c', k);
                set('category_c', null);
                setCategoryName('');
              }}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                form.kind_c === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Category" required hint="Need a custom category? Add it under Garment Categories.">
            <LookupPicker
              key={form.kind_c}
              table="categories_c"
              searchField="Name"
              value={form.category_c}
              onChange={pickCategory}
              fetchParams={{ filter: eq('kind_c', form.kind_c) }}
              placeholder="Select category…"
            />
          </FormField>
          <FormField label="Item title" required>
            <Input
              value={form.Name}
              onChange={(e) => {
                setTitleTouched(true);
                set('Name', e.target.value);
              }}
              placeholder="Sherwani – Royal Blue"
            />
          </FormField>
          {form.kind_c === 'Top Wear' && (
            <FormField label="Sleeve type">
              <PickSelect value={form.sleeve_type_c} onChange={(v) => set('sleeve_type_c', v)} options={SLEEVES} />
            </FormField>
          )}
          <FormField label="Handwork" hint="Adds a Handwork stage before Stitching.">
            <div className="flex h-10 items-center justify-between rounded-xl border border-border px-3">
              <span className="text-sm">{form.handwork_c ? 'Handwork required' : 'No handwork'}</span>
              <Switch checked={form.handwork_c} onCheckedChange={(v) => set('handwork_c', v)} />
            </div>
          </FormField>
        </div>
      </Section>

      {fields.length > 0 && (
        <Section
          title="Measurements"
          description={isAccessory ? 'Length and width in inches.' : 'All measurements in inches. Leave optional ones empty.'}
        >
          {!isEdit && !isAccessory && (
            <div className="mb-4">
              <Button type="button" variant="outline" size="sm" onClick={copyPrevious}>
                <AppIcon name="Copy" size={14} /> Copy from customer's previous garment
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {fields.map((f) => (
              <FormField key={f.key} label={f.label}>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder="e.g. 42"
                />
              </FormField>
            ))}
          </div>
        </Section>
      )}

      {isAccessory && (
        <Section
          title={accMode === 'size' ? 'Size and quantity' : 'Quantity'}
          description={
            accMode === 'size'
              ? 'Size number (for example 9) and how many pairs.'
              : 'How many pieces of this accessory.'
          }
        >
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            {accMode === 'size' && (
              <FormField label="Size number">
                <Input value={form.size_c} onChange={(e) => set('size_c', e.target.value)} placeholder="e.g. 9" />
              </FormField>
            )}
            <FormField label="Quantity">
              <Input type="number" min="1" step="1" value={form.qty_c} onChange={(e) => set('qty_c', e.target.value)} placeholder="1" />
            </FormField>
          </div>
        </Section>
      )}

      <Section title="Fabric and design">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Fabric">
            <Input value={form.fabric_c} onChange={(e) => set('fabric_c', e.target.value)} placeholder="Raw silk – royal blue" />
          </FormField>
          <FormField label="Fabric quantity">
            <div className="grid grid-cols-[1fr_9rem] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={form.fabric_qty_c}
                onChange={(e) => set('fabric_qty_c', e.target.value)}
                placeholder="e.g. 1.70"
              />
              <PickSelect
                value={form.fabric_unit_c}
                onChange={(v) => set('fabric_unit_c', v)}
                options={FABRIC_UNITS}
                labels={FABRIC_UNIT_LABEL}
              />
            </div>
          </FormField>
          <FormField label="Design notes">
            <Textarea
              rows={2}
              value={form.design_c}
              onChange={(e) => set('design_c', e.target.value)}
              placeholder="Collar style, buttons, embroidery…"
            />
          </FormField>
          <FormField label="Item image">
            <FilePicker value={form.photos_c} onChange={(v) => set('photos_c', v)} fieldConfig={PHOTO_CONFIG} />
          </FormField>
          <FormField label="Fabric image">
            <FilePicker value={form.fabric_photos_c} onChange={(v) => set('fabric_photos_c', v)} fieldConfig={PHOTO_CONFIG} />
          </FormField>
        </div>
      </Section>

      <Section title="Karigar and stage">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Karigar">
            <LookupPicker
              table="karigars_c"
              searchField="Name"
              value={form.karigar_c}
              onChange={(id) => set('karigar_c', id)}
              fetchParams={{ filter: eq('active_c', true) }}
              placeholder="Assign a karigar…"
              clearable
            />
          </FormField>
          {!wageHidden && (
            <FormField label="Karigar wage (INR)">
              <Input
                type="number"
                min="0"
                value={form.wage_c}
                onChange={(e) => set('wage_c', e.target.value)}
                placeholder="0.00"
              />
            </FormField>
          )}
          {[
            ['karigar2_c', 'wage2_c', 'Second karigar'],
            ['karigar3_c', 'wage3_c', 'Third karigar'],
          ].map(([kKey, wKey, label], idx) => {
            const prevKey = idx === 0 ? 'karigar_c' : 'karigar2_c';
            if (!form[prevKey] && !form[kKey]) return null;
            return (
              <div key={kKey} className="contents">
                <FormField label={label} hint="Another karigar working on the same garment.">
                  <LookupPicker
                    table="karigars_c"
                    searchField="Name"
                    value={form[kKey]}
                    onChange={(id) => set(kKey, id)}
                    fetchParams={{ filter: eq('active_c', true) }}
                    placeholder="Assign another karigar…"
                    clearable
                  />
                </FormField>
                {!wageHidden && (
                  <FormField label={`${label} wage (INR)`}>
                    <Input
                      type="number"
                      min="0"
                      value={form[wKey]}
                      onChange={(e) => set(wKey, e.target.value)}
                      placeholder="0.00"
                      disabled={!form[kKey]}
                    />
                  </FormField>
                )}
              </div>
            );
          })}
          <FormField label="Current stage">
            <PickSelect
              value={form.status_c}
              onChange={(v) => set('status_c', v)}
              options={stagesFor({ status_c: form.status_c, handwork_c: form.handwork_c })}
              labels={ITEM_STATUS_LABEL}
            />
          </FormField>
          <FormField label="Karigar due date">
            <Input type="date" value={form.due_date_c} onChange={(e) => set('due_date_c', e.target.value)} />
          </FormField>
        </div>
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
            'Add garment'
          )}
        </Button>
      </div>
    </form>
  );
}
