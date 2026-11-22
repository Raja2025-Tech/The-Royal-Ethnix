import { sdk } from '@/services/sdk';
import { store } from '@/store';

// Automatic change history. Every create, update and delete on these tables is written to audit_log_c
// with who did it and what changed. Logging never blocks or fails the original write.
const AUDITED = {
  orders_c: 'Bill',
  order_items_c: 'Garment',
  customers_c: 'Customer',
  karigars_c: 'Karigar',
  karigar_payments_c: 'Karigar payment',
  cashbook_c: 'Cashbook',
  categories_c: 'Category',
  stock_items_c: 'Stock item',
  stock_moves_c: 'Stock move',
};
const SKIP = new Set(['photos_c', 'fabric_photos_c', 'CreatedOn', 'Owner', 'Id']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

const pretty = (k) => k.replace(/_c$/, '').replace(/_/g, ' ');
const plain = (v) => (v && typeof v === 'object' ? (v.Id ?? v.Name ?? '') : v);
const show = (v) => {
  const p = v && typeof v === 'object' ? (v.Name ?? v.Id) : v;
  return p === null || p === undefined || p === '' ? '—' : String(p);
};

const rawTable = sdk.table.bind(sdk);

function actor() {
  try {
    const u = store.getState().user.user;
    const name =
      [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.name || u?.Name || u?.emailAddress || u?.email || 'Unknown';
    return { by: name, role: u?.profile ?? '' };
  } catch {
    return { by: 'Unknown', role: '' };
  }
}

function billOf(name, rec) {
  if (!rec) return null;
  if (name === 'orders_c') return rec.bill_no_c || rec.Name || null;
  if (name === 'order_items_c') return rec.order_c?.Name ?? null;
  if (name === 'karigar_payments_c') return rec.bill_c ?? null;
  return null;
}

async function writeLog(name, action, record, label, bill, changes) {
  try {
    const { by, role } = actor();
    await rawTable('audit_log_c').create({
      Name: `${AUDITED[name]} ${label || ''}`.trim().slice(0, 120),
      entity_c: AUDITED[name],
      record_c: String(record ?? ''),
      bill_c: bill || null,
      action_c: action,
      changes_c: changes.join('\n').slice(0, 1500) || null,
      by_c: by,
      role_c: role,
    });
  } catch {
    // audit must never break the real write
  }
}

async function readBefore(name, d) {
  try {
    const keys = new Set(['Name']);
    Object.keys(d).forEach((k) => {
      if (!SKIP.has(k)) keys.add(k);
    });
    if (name === 'order_items_c') keys.add('order_c');
    if (name === 'orders_c') keys.add('bill_no_c');
    if (name === 'karigar_payments_c') keys.add('bill_c');
    const res = await rawTable(name).select([...keys]).get(d.Id);
    return res?.data ?? null;
  } catch {
    return null;
  }
}

function diffOf(before, d) {
  const lines = [];
  Object.keys(d).forEach((k) => {
    if (k === 'Id') return;
    if (k === 'photos_c' || k === 'fabric_photos_c') {
      lines.push(`${pretty(k)}: updated`);
      return;
    }
    if (SKIP.has(k)) return;
    const oldV = before?.[k];
    const newV = d[k];
    if (String(plain(oldV) ?? '') === String(newV ?? '')) return;
    const lookup = (oldV && typeof oldV === 'object') || (typeof newV === 'string' && UUID.test(newV));
    lines.push(`${pretty(k)}: ${show(oldV)} → ${lookup ? 'changed' : show(newV)}`);
  });
  if (!before && !lines.length) lines.push(`Updated: ${Object.keys(d).filter((k) => k !== 'Id').join(', ')}`);
  return lines;
}

function summaryOf(d) {
  return Object.entries(d)
    .filter(([k, v]) => !SKIP.has(k) && v !== null && v !== '' && !Array.isArray(v) && !(typeof v === 'string' && UUID.test(v)))
    .slice(0, 8)
    .map(([k, v]) => `${pretty(k)}: ${show(v)}`);
}

function wrapTable(name) {
  const builder = rawTable(name);
  if (!AUDITED[name]) return builder;
  return new Proxy(builder, {
    get(target, prop) {
      if (prop === 'create') {
        return async (data, ...rest) => {
          const res = await target.create(data, ...rest);
          try {
            const list = Array.isArray(data) ? data : [data];
            for (let i = 0; i < list.length; i += 1) {
              const created = res?.data?.[i];
              if (!created) continue;
              let bill = billOf(name, { ...list[i], Name: created.Name, bill_no_c: list[i].bill_no_c });
              if (name === 'order_items_c' && list[i].order_c) {
                const o = await rawTable('orders_c').select(['Name']).get(list[i].order_c);
                bill = o?.data?.Name ?? null;
              }
              await writeLog(name, 'Create', created.Id, created.Name, bill, summaryOf(list[i]));
            }
          } catch {
            // ignore
          }
          return res;
        };
      }
      if (prop === 'update') {
        return async (data, ...rest) => {
          const list = Array.isArray(data) ? data : [data];
          const befores = await Promise.all(list.map((d) => readBefore(name, d)));
          const res = await target.update(data, ...rest);
          try {
            if (res?.data?.length) {
              for (let i = 0; i < list.length; i += 1) {
                const lines = diffOf(befores[i], list[i]);
                if (!lines.length) continue;
                const b = befores[i];
                await writeLog(name, 'Update', list[i].Id, b?.Name ?? res.data[i]?.Name, billOf(name, b), lines);
              }
            }
          } catch {
            // ignore
          }
          return res;
        };
      }
      if (prop === 'remove') {
        return async (ids, ...rest) => {
          const list = Array.isArray(ids) ? ids : [ids];
          const befores = await Promise.all(list.map((id) => readBefore(name, { Id: id })));
          const res = await target.remove(ids, ...rest);
          try {
            if (res?.success !== false) {
              for (let i = 0; i < list.length; i += 1) {
                const b = befores[i];
                await writeLog(name, 'Delete', list[i], b?.Name, billOf(name, b), ['Record deleted']);
              }
            }
          } catch {
            // ignore
          }
          return res;
        };
      }
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

try {
  if (!sdk.__audited) {
    sdk.table = wrapTable;
    sdk.__audited = true;
  }
} catch {
  // audit disabled if the sdk object cannot be patched
}
