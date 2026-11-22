import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import '@/lib/audit';

import { eq, isIn as isInList } from '@/services/query';

export const ORDER_STATUSES = ['Draft', 'Active', 'Ready', 'Delivered', 'Cancelled'];
export const PRIORITIES = ['Normal', 'Urgent', 'VIP'];
export const CAD_STATUSES = ['Pending', 'Done', 'Not Required'];
export const ITEM_STATUSES = ['New', 'Fabric', 'Cut', 'Handwork', 'Stitch', 'Ready', 'Dispatched', 'Trial', 'Alter', 'Done', 'Delivered'];
export const ITEM_STATUS_LABEL = {
  New: 'New Order',
  Fabric: 'Fabric Received',
  Cut: 'Cutting',
  Stitch: 'Stitching',
  Handwork: 'Handwork',
  Ready: 'Ready for Dispatch',
  Dispatched: 'Item Dispatched',
  Trial: 'Trial',
  Alter: 'Alteration',
  Done: 'Job Done',
  Delivered: 'Delivered',
};
// Karigar can set every stage except Delivered (shop-side step).
export const KARIGAR_STAGES = ITEM_STATUSES.filter((s) => s !== 'Delivered');
// Stages from which the karigar may write the rate (and which count as earned).
export const RATE_STAGES = ['Ready', 'Dispatched', 'Trial', 'Alter', 'Done', 'Delivered'];
// Garment is finished and out of the workshop.
export const READY_STAGES = ['Ready', 'Dispatched', 'Trial', 'Done', 'Delivered'];
export const OPEN_STAGES = ['New', 'Fabric', 'Cut', 'Stitch', 'Handwork', 'Ready', 'Dispatched', 'Trial', 'Alter', 'Done'];

// Accessory input mode by category name.
export function accessoryMode(categoryName) {
  const n = String(categoryName || '').toUpperCase();
  if (n.includes('SAFA') || n.includes('DUPATTA')) return 'measure';
  if (n.includes('MOJRI') || n.includes('JUTI')) return 'size';
  return 'qty';
}

export const ACCESSORY_MEASURE_FIELDS = [
  { key: 'length_c', label: 'Length' },
  { key: 'width_c', label: 'Width' },
];

// Fields to show/collect for a garment.
export function itemMeasureFields(kind, categoryName) {
  if (kind === 'Bottom Wear') return BOTTOM_FIELDS;
  if (kind === 'Accessory') {
    return accessoryMode(categoryName) === 'measure' ? ACCESSORY_MEASURE_FIELDS : [];
  }
  return TOP_FIELDS;
}
export const ITEM_KINDS = ['Top Wear', 'Bottom Wear', 'Accessory'];
export const SLEEVES = ['Full', 'Half'];
export const SOURCES = ['Walk-in', 'Referral', 'Instagram', 'Website', 'Other'];
export const SPECIALTIES = ['Sher', 'Kurta', 'Indo', 'Suit', 'Pant', 'Hand', 'Juti', 'Safa', 'All'];
export const SPECIALTY_LABEL = {
  Sher: 'Sherwani',
  Kurta: 'Kurta / Shirt',
  Indo: 'Indo-Western',
  Suit: 'Suit / Coat',
  Pant: 'Bottom wear',
  Hand: 'Handwork',
  Juti: 'Mojri / Juti',
  Safa: 'Safa / Dupatta',
  All: 'All-rounder',
  Sherwani: 'Sherwani',
  Bottom: 'Bottom wear',
};
export const KARIGAR_PAY_TYPES = ['Advance', 'Majuri', 'Bonus'];
export const CASH_IN_HEADS = ['Cash sale', 'Advance', 'Due received', 'Other income'];
export const CASH_OUT_HEADS = ['Fabric', 'Karigar', 'Rent', 'Salary', 'Utility', 'Trims', 'Travel', 'Tea & Misc', 'Owner draw'];
export const NON_EXPENSE_HEADS = ['Karigar', 'Owner draw'];

export const TOP_FIELDS = [
  { key: 'length_c', label: 'Length' },
  { key: 'shoulder_c', label: 'Shoulder' },
  { key: 'sleeve_c', label: 'Sleeve length' },
  { key: 'chest_c', label: 'Chest' },
  { key: 'belly_c', label: 'Belly' },
  { key: 'hip_c', label: 'Hip' },
  { key: 'mohri_c', label: 'Mohri' },
  { key: 'cuff_c', label: 'Cuff (optional)' },
  { key: 'neck_c', label: 'Neck' },
  { key: 'armhole_c', label: 'Armhole' },
  { key: 'bicep_c', label: 'Muscle / Bicep' },
];

export const BOTTOM_FIELDS = [
  { key: 'waist_c', label: 'Waist' },
  { key: 'hip_c', label: 'Hip' },
  { key: 'fork_c', label: 'Fork' },
  { key: 'thigh_c', label: 'Thigh' },
  { key: 'length_c', label: 'Length' },
  { key: 'downfall_c', label: 'Downfall' },
];

export const MEASURE_KEYS = [
  'length_c', 'shoulder_c', 'sleeve_c', 'chest_c', 'belly_c', 'hip_c', 'mohri_c', 'cuff_c',
  'neck_c', 'armhole_c', 'bicep_c', 'waist_c', 'fork_c', 'thigh_c', 'downfall_c', 'width_c',
];

export const CUSTOMER_FIELDS = ['Name', 'phone_c', 'source_c', 'birthday_c', 'address_c', 'notes_c', 'CreatedOn'];
export const KARIGAR_FIELDS = ['Name', 'phone_c', 'specialty_c', 'joined_c', 'active_c', 'notes_c', 'login_c'];
export const CATEGORY_FIELDS = ['Name', 'kind_c', 'default_wage_c', 'notes_c'];
export const ORDER_FIELDS = [
  'Name', 'bill_no_c', 'customer_c', 'order_date_c', 'trial_date_c', 'delivery_date_c', 'event_date_c',
  'total_c', 'discount_c', 'cash_c', 'card_c', 'upi_c', 'paid_c', 'priority_c', 'status_c', 'cad_pattern_c', 'pattern_date_c',
  'remark_c', 'CreatedOn',
];
export const ITEM_FIELDS = [
  'Name', 'order_c', 'kind_c', 'category_c', 'karigar_c', 'wage_c', 'status_c', 'due_date_c', 'sleeve_type_c',
  'fabric_c', 'fabric_qty_c', 'fabric_given_on_c', 'fabric_note_c', 'received_on_c', 'received_note_c',
  'design_c', 'photos_c', 'fabric_photos_c', 'qty_c', 'size_c', 'karigar_note_c', ...MEASURE_KEYS, 'CreatedOn',
  'karigar2_c', 'karigar3_c', 'wage2_c', 'wage3_c', 'handwork_c', 'cad_c', 'cad_date_c', 'fabric_unit_c',
];

export const FABRIC_UNITS = ['Meter', 'CM'];
export const FABRIC_UNIT_LABEL = { Meter: 'Meter (m)', CM: 'Centimeter (cm)' };
export function fabricLabel(item) {
  if (item?.fabric_qty_c === null || item?.fabric_qty_c === undefined || item?.fabric_qty_c === '') return '';
  return `${item.fabric_qty_c} ${item.fabric_unit_c === 'CM' ? 'cm' : 'm'}`;
}
export const KPAY_FIELDS = ['Name', 'karigar_c', 'amount_c', 'type_c', 'paid_on_c', 'note_c', 'bill_c'];
export const CASHBOOK_FIELDS = ['Name', 'kind_c', 'category_c', 'amount_c', 'entry_date_c', 'note_c', 'CreatedOn'];

export const orderStatusStyles = {
  Draft: 'bg-muted text-muted-foreground border-border',
  Active: 'bg-primary/10 text-primary border-primary/20',
  Ready: 'bg-warning-muted text-warning border-warning-border',
  Delivered: 'bg-success-muted text-success border-success-border',
  Cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

export const itemStatusStyles = {
  New: 'bg-muted text-muted-foreground border-border',
  Fabric: 'bg-muted text-foreground border-border',
  Cut: 'bg-primary/10 text-primary border-primary/20',
  Stitch: 'bg-secondary text-secondary-foreground border-border',
  Handwork: 'bg-highlight/25 text-foreground border-highlight/40',
  Ready: 'bg-warning-muted text-warning border-warning-border',
  Dispatched: 'bg-warning-muted text-warning border-warning-border',
  Trial: 'bg-highlight/25 text-foreground border-highlight/40',
  Alter: 'bg-destructive/10 text-destructive border-destructive/20',
  Done: 'bg-success-muted text-success border-success-border',
  Delivered: 'bg-success-muted text-success border-success-border',
};

export const priorityStyles = {
  Normal: 'bg-muted text-muted-foreground border-border',
  Urgent: 'bg-destructive/10 text-destructive border-destructive/20',
  VIP: 'bg-highlight/25 text-foreground border-highlight/40',
};

export const cadStyles = {
  Pending: 'bg-warning-muted text-warning border-warning-border',
  Done: 'bg-success-muted text-success border-success-border',
  'Not Required': 'bg-muted text-muted-foreground border-border',
};

export const kindStyles = {
  'Top Wear': 'bg-primary/10 text-primary border-primary/20',
  'Bottom Wear': 'bg-secondary text-secondary-foreground border-border',
  Accessory: 'bg-highlight/25 text-foreground border-highlight/40',
};

export const kpayStyles = {
  Advance: 'bg-warning-muted text-warning border-warning-border',
  Majuri: 'bg-primary/10 text-primary border-primary/20',
  Bonus: 'bg-success-muted text-success border-success-border',
};

export const handoverStyles = {
  'Not issued': 'bg-muted text-muted-foreground border-border',
  'With karigar': 'bg-warning-muted text-warning border-warning-border',
  Received: 'bg-success-muted text-success border-success-border',
};

export function handoverState(item) {
  if (item?.received_on_c) return 'Received';
  if (item?.fabric_given_on_c) return 'With karigar';
  return 'Not issued';
}

export const activeStyles = {
  Active: 'bg-success-muted text-success border-success-border',
  Inactive: 'bg-muted text-muted-foreground border-border',
};

export function money(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(value) {
  if (!value) return '—';
  return formatLocalDate(value, DATE_FORMATS.SHORT);
}

export function lookupId(value) {
  if (!value) return null;
  return value.Id ?? value;
}

export function daysLeft(dateStr) {
  if (!dateStr) return null;
  return differenceInCalendarDays(parseISO(dateStr), new Date());
}

export function daysLabel(n) {
  if (n === null || n === undefined) return '—';
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return 'Today';
  return `${n}d left`;
}

export function daysTone(n) {
  if (n === null || n === undefined) return 'text-muted-foreground';
  if (n < 0) return 'text-destructive';
  if (n <= 3) return 'text-warning';
  return 'text-muted-foreground';
}

export function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function toNumber(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function unwrapList(res) {
  if (!res.success) throw new Error(res.message || 'Could not load data');
  return res.data;
}

export function writeOk(res) {
  if (res.messages && res.messages.length) {
    toast.error(res.messages[0], { description: res.messages.slice(1).join('\n') || undefined });
  }
  return Boolean(res.data && res.data.length);
}

export function orderDue(order) {
  return Math.max(0, (Number(order.total_c) || 0) - (Number(order.paid_c) || 0));
}

export function orderPaid(order) {
  const split = (Number(order.cash_c) || 0) + (Number(order.card_c) || 0) + (Number(order.upi_c) || 0);
  return split > 0 ? split : Number(order.paid_c) || 0;
}

export function isoDays(dateStr, delta) {
  return format(addDays(parseISO(dateStr), delta), 'yyyy-MM-dd');
}

export function monthKey(dateStr) {
  return dateStr ? String(dateStr).slice(0, 7) : 'Unknown';
}

export function monthLabel(key) {
  if (!key || key === 'Unknown') return 'No date';
  const [y, m] = key.split('-');
  return format(new Date(Number(y), Number(m) - 1, 1), 'MMM yy');
}

export function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export function deriveOrderStatus(order, items) {
  if (!items.length || order.status_c === 'Cancelled') return order.status_c;
  if (items.every((i) => i.status_c === 'Delivered')) return 'Delivered';
  if (items.every((i) => READY_STAGES.includes(i.status_c))) return 'Ready';
  return 'Active';
}

// Brings order status in line with garment stages for every open bill. Karigars change garment
// stages but cannot edit orders, so users who can edit orders run this when they open a page.
export async function reconcileOrders() {
  const ordersRes = await sdk.table('orders_c').select(['status_c']).where(eq('status_c', 'Active')).page(1, 100).fetch();
  const readyRes = await sdk.table('orders_c').select(['status_c']).where(eq('status_c', 'Ready')).page(1, 100).fetch();
  const orders = [...(ordersRes.data ?? []), ...(readyRes.data ?? [])];
  if (!orders.length) return 0;
  const ids = orders.map((o) => o.Id);
  const items = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = await sdk.table('order_items_c').select(['order_c', 'status_c']).where(isInList('order_c', ids)).page(page, 100).fetch();
    const rows = res.data ?? [];
    items.push(...rows);
    if (rows.length < 100) break;
  }
  const byOrder = new Map();
  items.forEach((i) => {
    const k = lookupId(i.order_c);
    byOrder.set(k, [...(byOrder.get(k) ?? []), i]);
  });
  let changed = 0;
  for (const o of orders) {
    const list = byOrder.get(o.Id) ?? [];
    if (!list.length) continue;
    const next = deriveOrderStatus(o, list);
    if (next !== o.status_c) {
      await sdk.table('orders_c').update({ Id: o.Id, status_c: next });
      changed += 1;
    }
  }
  return changed;
}

export async function syncOrderStatus(orderId) {
  const [orderRes, itemsRes] = await Promise.all([
    sdk.table('orders_c').select(['status_c']).get(orderId),
    sdk.table('order_items_c').select(['status_c']).where(eq('order_c', orderId)).page(1, 50).fetch(),
  ]);
  const order = orderRes.data;
  const items = itemsRes.data ?? [];
  if (!order || !items.length) return;
  if (order.status_c === 'Cancelled' || order.status_c === 'Draft') return;
  const next = deriveOrderStatus(order, items);
  if (next !== order.status_c) {
    await sdk.table('orders_c').update({ Id: orderId, status_c: next });
  }
}

// Garment stages; Handwork is only part of the flow when the garment needs handwork.
export function stagesFor(item) {
  return ITEM_STATUSES.filter((s) => s !== 'Handwork' || item?.handwork_c || item?.status_c === 'Handwork');
}

const KARIGAR_SLOTS = [
  ['karigar_c', 'wage_c'],
  ['karigar2_c', 'wage2_c'],
  ['karigar3_c', 'wage3_c'],
];

// Up to three karigars can work on one garment, each with their own wage.
export function itemKarigars(item) {
  return KARIGAR_SLOTS.map(([k, w]) => ({
    slot: k,
    wageKey: w,
    id: lookupId(item?.[k]),
    name: item?.[k]?.Name,
    wage: item?.[w],
  })).filter((x) => x.id);
}

export function karigarNames(item, fallback = 'Not assigned') {
  return itemKarigars(item).map((x) => x.name).filter(Boolean).join(', ') || fallback;
}

export function hasKarigar(item, kid) {
  return itemKarigars(item).some((x) => String(x.id) === String(kid));
}

export function wageKeyFor(item, kid) {
  const s = itemKarigars(item).find((x) => String(x.id) === String(kid));
  return s ? s.wageKey : 'wage_c';
}

// The garment as one karigar sees it: wage_c is that karigar's own wage.
export function forKarigar(item, kid) {
  const key = wageKeyFor(item, kid);
  return { ...item, wage_c: item[key], _wageKey: key };
}

export function fyCode(dateStr) {
  const d = dateStr ? parseISO(dateStr) : new Date();
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1;
  const two = (n) => String(n % 100).padStart(2, '0');
  return `${two(start)}${two(start + 1)}`;
}

// 1061 becomes AT/1061/2627 (financial year from the order date). Full numbers are kept as typed.
export function formatBill(input, dateStr) {
  const v = String(input ?? '').trim();
  return /^\d+$/.test(v) ? `AT/${v}/${fyCode(dateStr)}` : v;
}

// Cash received on a bill goes into the Daily Cashbook automatically. Later changes to the cash
// amount add a correcting entry, so the book always matches the bill.
export async function syncOrderCash(orderId, bill, cash) {
  const tag = `[order:${orderId}]`;
  const name = `Bill ${bill}`;
  try {
    // Look up by entry name (always filled) and match the order tag in code; filtering on the
    // note field directly breaks when other entries have an empty note.
    const res = await sdk
      .table('cashbook_c')
      .select(['Name', 'kind_c', 'amount_c', 'note_c'])
      .where(eq('Name', name))
      .page(1, 100)
      .fetch();
    const mine = (res?.data ?? []).filter((r) => String(r.note_c ?? '').includes(tag));
    const recorded = mine.reduce((s, r) => s + (r.kind_c === 'In' ? 1 : -1) * (Number(r.amount_c) || 0), 0);
    const diff = Math.round(((Number(cash) || 0) - recorded) * 100) / 100;
    if (Math.abs(diff) < 0.01) return;
    const made = await sdk.table('cashbook_c').create({
      Name: name,
      kind_c: diff > 0 ? 'In' : 'Out',
      category_c: 'Cash sale',
      amount_c: Math.abs(diff),
      entry_date_c: todayStr(),
      note_c: `${diff > 0 ? 'Cash received' : 'Cash correction'} on bill ${bill} ${tag}`,
    });
    if (made?.data?.length) {
      toast.success(`${money(Math.abs(diff))} ${diff > 0 ? 'cash in' : 'cash out'} added to Daily Cashbook`);
    } else {
      toast.error('Order saved, but the cashbook entry failed', { description: made?.messages?.[0] || made?.message });
    }
  } catch (err) {
    toast.error('Order saved, but the cashbook entry failed', { description: err?.message });
  }
}

export function karigarEarned(items) {
  return items
    .filter((i) => RATE_STAGES.includes(i.status_c))
    .reduce((sum, i) => sum + (Number(i.wage_c) || 0), 0);
}
