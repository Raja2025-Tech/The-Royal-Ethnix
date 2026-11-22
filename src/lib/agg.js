import { sdk } from '@/services/sdk';

export async function aggregateMany(table, specs) {
  const res = await sdk
    .table(table)
    .select([{ field: 'Id' }])
    .aggregate(
      specs.map((s) => ({
        id: s.id,
        fields: [{ field: s.field ?? 'Id', fn: s.fn ?? 'Count', alias: 'count' }],
        ...(s.where ? { where: s.where } : {}),
      })),
    )
    .limit(1)
    .fetch();
  if (!res.success) throw new Error(res.message || 'Could not load totals');
  const out = {};
  specs.forEach((s) => {
    const b = res.aggregators?.find((a) => a.id === s.id);
    out[s.id] = Number(b?.data?.count ?? b?.count ?? b?.value ?? 0);
  });
  return out;
}

export function monthStartStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-01`;
}
