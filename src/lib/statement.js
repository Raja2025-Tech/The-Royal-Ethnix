import { format, parseISO, startOfWeek } from 'date-fns';
import { toast } from 'sonner';
import { ITEM_STATUS_LABEL, fabricLabel, fmtDate, itemMeasureFields, money } from '@/lib/tms';

export const PERIODS = { week: 'Weekly', month: 'Monthly', year: 'Yearly' };

export function periodKey(dateStr, period) {
  if (!dateStr) return 'none';
  const d = parseISO(dateStr);
  if (period === 'week') return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  if (period === 'month') return format(d, 'yyyy-MM');
  return format(d, 'yyyy');
}

export function periodLabel(key, period) {
  if (key === 'none') return 'No date';
  if (period === 'week') return `Week of ${format(parseISO(key), 'd MMM yyyy')}`;
  if (period === 'month') return format(parseISO(`${key}-01`), 'MMMM yyyy');
  return key;
}

export function groupPayments(rows, period) {
  const map = new Map();
  rows.forEach((p) => {
    const key = periodKey(p.paid_on_c, period);
    const g = map.get(key) ?? { key, label: periodLabel(key, period), total: 0, rows: [] };
    g.total += Number(p.amount_c) || 0;
    g.rows.push(p);
    map.set(key, g);
  });
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

// ---------------------------------------------------------------------------
// Printing for the Retsol RTP-82UE: 80 mm thermal roll, 72 mm printable width.
// The browser print preview opens automatically. Set the Retsol as the default
// printer; for no-dialog printing start Chrome with --kiosk-printing.
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const STYLE = `
  @page{size:80mm auto;margin:3mm 4mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{width:72mm;font-family:'Courier New',Courier,monospace;font-size:13px;font-weight:bold;line-height:1.45;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:18px;text-align:center;margin:0 0 3px}
  .c{text-align:center}.b{font-weight:bold;font-size:14px}.s{font-size:11px}
  .hr{border-top:1px dashed #000;margin:5px 0}
  .row{display:flex;justify-content:space-between;gap:6px}
  .row span:first-child{flex:1;word-break:break-word}
  .row span:last-child{text-align:right;white-space:nowrap}
  .big{font-size:18px;font-weight:bold;text-align:center;margin:4px 0}
  .sign div{border-top:1px solid #000;padding-top:2px;margin-top:26px;text-align:center;font-size:12px}
  .pb{page-break-after:always;padding-bottom:4px}
  .pb:last-child{page-break-after:auto}
  @media screen{body{margin:8px auto}}
`;

function openPrint(title, body) {
  const w = window.open('', '_blank');
  if (!w) {
    toast.error('Allow pop-ups for this site to open the print preview');
    return;
  }
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

const row = (left, right = '') => `<div class="row"><span>${esc(left)}</span><span>${esc(right)}</span></div>`;
const small = (text) => (text ? `<div class="s">${esc(text)}</div>` : '');
const hr = '<div class="hr"></div>';
const shopHead = (subtitle) =>
  `<h1>THE ROYAL ETHNIX</h1><div class="c s">${esc(subtitle)}</div><div class="c s">${esc(format(new Date(), 'd MMM yyyy, h:mm a'))}</div>${hr}`;

// Code 39 barcode (verified pattern table). Scanners type the text, so Track Order finds the bill.
const CODE39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};

export function code39Svg(text, height = 46) {
  const clean = String(text || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '-');
  const chars = `*${clean}*`.split('');
  let x = 10;
  const rects = [];
  chars.forEach((ch, ci) => {
    let bar = true;
    for (const e of CODE39[ch]) {
      const w = e === 'w' ? 3 : 1;
      if (bar) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`);
      x += w;
      bar = !bar;
    }
    if (ci < chars.length - 1) x += 1;
  });
  const total = x + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" width="100%" height="${height}" preserveAspectRatio="none" fill="#000">${rects.join('')}</svg>`;
}

export function openKarigarStatement({ karigar, payments, items = [], earned = null, range = 'All payments' }) {
  const sorted = [...payments].sort((a, b) => String(a.paid_on_c).localeCompare(String(b.paid_on_c)));
  const total = sorted.reduce((s, p) => s + (Number(p.amount_c) || 0), 0);
  const balance = earned === null ? null : earned - total;
  let body = shopHead('Karigar wage statement');
  body += `<div class="b">${esc(karigar?.Name ?? 'Karigar')}</div>`;
  body += small(karigar?.phone_c);
  body += small(range);
  body += hr;
  body += row('Payments received', money(total));
  if (earned !== null) body += row('Earned (ready garments)', money(earned));
  if (balance !== null) body += row(balance >= 0 ? 'Balance to receive' : 'Advance to adjust', money(Math.abs(balance)));
  body += `${hr}<div class="b">PAYMENTS (DATE WISE)</div>`;
  if (sorted.length === 0) body += small('No payments in this period.');
  sorted.forEach((p) => {
    body += row(`${fmtDate(p.paid_on_c)} ${p.type_c ?? ''}`, money(p.amount_c));
    body += small([p.bill_c ? `Bill ${p.bill_c}` : '', p.note_c].filter(Boolean).join(' - '));
  });
  body += hr + row('TOTAL', money(total));
  if (items.length) {
    body += `${hr}<div class="b">ITEM-WISE RATE</div>`;
    items.forEach((i) => {
      body += row(`${i.Name} x${i.qty_c ?? 1}`, money(i.wage_c));
      body += small(`Bill ${i.order_c?.Name ?? ''} - ${ITEM_STATUS_LABEL[i.status_c] ?? i.status_c}`);
    });
  }
  body += '<div class="sign"><div>Karigar signature</div><div>Authorised by</div></div>';
  openPrint(`Wage statement - ${karigar?.Name ?? ''}`, body);
}

export function openJobCard(item) {
  const bill = item.order_c?.Name ?? '';
  const fields = itemMeasureFields(item.kind_c, item.category_c?.Name).filter(
    (f) => item[f.key] !== null && item[f.key] !== undefined && item[f.key] !== '',
  );
  let body = shopHead('JOB CARD');
  body += `<div class="big">${esc(bill)}</div>${code39Svg(bill)}${hr}`;
  body += `<div class="b">${esc(item.Name)}</div>`;
  body += row('Category', item.category_c?.Name ?? '');
  body += row(
    'Karigar',
    ['karigar_c', 'karigar2_c', 'karigar3_c'].map((k) => item[k]?.Name).filter(Boolean).join(', ') || 'Not assigned',
  );
  body += row('Due date', fmtDate(item.due_date_c));
  body += row('Quantity', String(item.qty_c ?? 1));
  if (item.size_c) body += row('Size', String(item.size_c));
  if (item.sleeve_type_c) body += row('Sleeve', item.sleeve_type_c);
  if (item.fabric_c) body += row('Fabric', item.fabric_c);
  if (item.fabric_qty_c) body += row('Fabric given', `${fabricLabel(item)} on ${fmtDate(item.fabric_given_on_c)}`);
  if (fields.length) {
    body += `${hr}<div class="b">MEASUREMENTS (inch)</div>`;
    fields.forEach((f) => {
      body += row(f.label.replace(' (optional)', ''), String(item[f.key]));
    });
  }
  body += `${hr}<div class="b">DESIGN NOTES</div><div>${esc(item.design_c || 'None')}</div>`;
  body += '<div class="sign"><div>Karigar</div><div>Fabric given by</div></div>';
  openPrint(`Job card - ${bill}`, body);
}

export function openLabels({ bill, items = [] }) {
  const list = items.length ? items : [{ Name: '' }];
  const body = list
    .map(
      (i) =>
        `<div class="pb c"><div class="b">THE ROYAL ETHNIX</div><div class="big">${esc(bill)}</div>${code39Svg(bill)}<div class="s">${esc(bill)}</div>${
          i.Name ? `<div class="b">${esc(i.Name)}${i.qty_c > 1 ? ` x${esc(i.qty_c)}` : ''}</div>` : ''
        }${small([i.karigar_c?.Name, i.due_date_c ? `Due ${fmtDate(i.due_date_c)}` : ''].filter(Boolean).join(' - '))}</div>`,
    )
    .join('');
  openPrint(`Labels - ${bill}`, body);
}

export function openChallan({ bill, order, customer, items = [] }) {
  let body = shopHead('DELIVERY CHALLAN');
  body += `<div class="big">${esc(bill)}</div>${code39Svg(bill)}${hr}`;
  body += row('Customer', customer?.Name ?? '');
  if (customer?.phone_c) body += row('Phone', customer.phone_c);
  if (order?.trial_date_c) body += row('Trial date', fmtDate(order.trial_date_c));
  if (order?.delivery_date_c) body += row('Delivery date', fmtDate(order.delivery_date_c));
  body += `${hr}<div class="b">ITEMS</div>`;
  items.forEach((i, n) => {
    body += row(`${n + 1}. ${i.Name}`, `x${i.qty_c ?? 1}`);
    body += small(ITEM_STATUS_LABEL[i.status_c] ?? i.status_c);
  });
  body += `${hr}${row('Total pieces', String(items.reduce((s, i) => s + (Number(i.qty_c) || 1), 0)))}`;
  body += '<div class="sign"><div>Received by (customer)</div><div>Delivered by</div></div>';
  openPrint(`Challan - ${bill}`, body);
}

export function openCashbookClosing({ date, opening, rows, totalIn, totalOut, closing }) {
  const ins = rows.filter((r) => r.kind_c === 'In');
  const outs = rows.filter((r) => r.kind_c === 'Out');
  let body = shopHead('DAILY CASHBOOK CLOSING');
  body += `<div class="b c">${esc(fmtDate(date))}</div>${hr}`;
  body += row('Opening balance', money(opening));
  body += `${hr}<div class="b">CASH IN</div>`;
  if (!ins.length) body += small('No cash in entries.');
  ins.forEach((r) => {
    body += row(`${r.category_c ?? ''} ${r.Name ?? ''}`.trim(), money(r.amount_c));
    body += small(String(r.note_c ?? '').replace(/\s*\[order:[^\]]+\]/, ''));
  });
  body += row('Total cash in', money(totalIn));
  body += `${hr}<div class="b">CASH OUT</div>`;
  if (!outs.length) body += small('No cash out entries.');
  outs.forEach((r) => {
    body += row(`${r.category_c ?? ''} ${r.Name ?? ''}`.trim(), money(r.amount_c));
    body += small(r.note_c);
  });
  body += row('Total cash out', money(totalOut));
  body += `${hr}<div class="b">${row('CLOSING BALANCE', money(closing))}</div>`;
  body += `${hr}${row('Cash counted', '________')}${row('Difference', '________')}`;
  body += '<div class="sign"><div>Checked by</div><div>Approved by</div></div>';
  openPrint(`Cashbook closing - ${date}`, body);
}
