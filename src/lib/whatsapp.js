import { money, waLink } from '@/lib/tms';

// Message templates for customer reminders.
export const WA_TEMPLATES = {
  ready: {
    label: 'Order ready',
    text: (c) =>
      `Hello ${c.name}, your order (bill ${c.bill}) from The Royal Ethnix is ready for pickup.${c.due > 0 ? ` Balance due: ${money(c.due)}.` : ''}`,
    params: (c) => [c.name, c.bill, c.due > 0 ? money(c.due) : 'Nil'],
  },
  trial: {
    label: 'Trial reminder',
    text: (c) => `Hello ${c.name}, your trial for bill ${c.bill} at The Royal Ethnix is scheduled on ${c.date}. Please visit us. Thank you.`,
    params: (c) => [c.name, c.bill, c.date],
  },
  delivery: {
    label: 'Delivery reminder',
    text: (c) => `Hello ${c.name}, your order (bill ${c.bill}) is due for delivery on ${c.date}. Thank you for choosing The Royal Ethnix.`,
    params: (c) => [c.name, c.bill, c.date],
  },
  due: {
    label: 'Balance due',
    text: (c) => `Hello ${c.name}, a friendly reminder: balance of ${money(c.due)} is pending for bill ${c.bill} at The Royal Ethnix. Thank you.`,
    params: (c) => [c.name, c.bill, money(c.due)],
  },
};

// WhatsApp messages open in WhatsApp (web or app) with the text filled in; staff press Send.
export const whatsappApiReady = () => false;

export async function sendWhatsApp(key, ctx) {
  const tpl = WA_TEMPLATES[key];
  const context = { ...ctx, name: ctx.name || 'Customer' };
  const link = waLink(ctx.phone, tpl.text(context));
  if (!link) return { ok: false, message: 'No phone number' };
  window.open(link, '_blank');
  return { ok: true, via: 'link' };
}
