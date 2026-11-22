// Query filters used by every page: eq('status_c', 'Active'), and(...), or(...), contains(...).
// A filter is a plain object; `matches(record, filter)` evaluates it against a stored record.

export const eq = (field, value) => ({ op: 'eq', field, value });
export const ne = (field, value) => ({ op: 'ne', field, value });
export const lt = (field, value) => ({ op: 'lt', field, value });
export const lte = (field, value) => ({ op: 'lte', field, value });
export const gt = (field, value) => ({ op: 'gt', field, value });
export const gte = (field, value) => ({ op: 'gte', field, value });
export const isIn = (field, values) => ({ op: 'in', field, value: values ?? [] });
export const notIn = (field, values) => ({ op: 'nin', field, value: values ?? [] });
export const contains = (field, value) => ({ op: 'contains', field, value });
export const startsWith = (field, value) => ({ op: 'startsWith', field, value });
export const and = (...filters) => ({ op: 'and', filters: filters.flat().filter(Boolean) });
export const or = (...filters) => ({ op: 'or', filters: filters.flat().filter(Boolean) });

// Lookups are stored as { Id, Name }; filters compare their Id. People fields are arrays of user ids.
function plain(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v.Id ?? v.Name ?? null;
  return v;
}

function norm(v) {
  const p = plain(v);
  return p === undefined ? null : p;
}

function same(a, b) {
  if (a === null || b === null) return a === b;
  return String(a) === String(b);
}

function cmp(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb) && typeof a !== 'boolean') return na - nb;
  return String(a).localeCompare(String(b));
}

export function matches(record, filter) {
  if (!filter) return true;
  if (filter.op === 'and') return filter.filters.every((f) => matches(record, f));
  if (filter.op === 'or') return filter.filters.length === 0 || filter.filters.some((f) => matches(record, f));

  const raw = record?.[filter.field];
  const value = norm(filter.value);

  if (Array.isArray(raw)) {
    const list = raw.map((x) => norm(x?.User ?? x));
    switch (filter.op) {
      case 'eq':
        return list.some((x) => same(x, value));
      case 'ne':
        return !list.some((x) => same(x, value));
      case 'in':
        return list.some((x) => filter.value.some((v) => same(x, norm(v))));
      case 'contains':
        return list.some((x) => String(x ?? '').toLowerCase().includes(String(value ?? '').toLowerCase()));
      default:
        return false;
    }
  }

  const v = norm(raw);
  switch (filter.op) {
    case 'eq':
      return same(v, value);
    case 'ne':
      return !same(v, value);
    case 'lt':
      return v !== null && value !== null && cmp(v, value) < 0;
    case 'lte':
      return v !== null && value !== null && cmp(v, value) <= 0;
    case 'gt':
      return v !== null && value !== null && cmp(v, value) > 0;
    case 'gte':
      return v !== null && value !== null && cmp(v, value) >= 0;
    case 'in':
      return filter.value.some((x) => same(v, norm(x)));
    case 'nin':
      return !filter.value.some((x) => same(v, norm(x)));
    case 'contains': {
      const hay = raw && typeof raw === 'object' ? `${raw.Name ?? ''}` : String(v ?? '');
      return hay.toLowerCase().includes(String(value ?? '').toLowerCase());
    }
    case 'startsWith': {
      const hay = raw && typeof raw === 'object' ? `${raw.Name ?? ''}` : String(v ?? '');
      return hay.toLowerCase().startsWith(String(value ?? '').toLowerCase());
    }
    default:
      return false;
  }
}

// Sort helper: lookups sort by their Name, empty values go last.
export function sortValue(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v.Name ?? v.Id ?? null;
  return v ?? null;
}

export function compareValues(a, b) {
  const x = sortValue(a);
  const y = sortValue(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  if (typeof x === 'boolean' || typeof y === 'boolean') return Number(x) - Number(y);
  return cmp(x, y);
}
