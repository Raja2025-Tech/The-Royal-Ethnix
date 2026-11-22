// The app's data layer. Pages call sdk.table('orders_c').select(...).where(...).fetch() and get
// back { success, data, total }. Role permissions (userPermissions.js) and record rules
// (policies/*.policy.js) are applied here; with Firebase, firestore.rules enforces the same rules
// on the server.
import { backend, usingFirebase } from './backend';
import { schema } from './data';
import { policies } from './policies';
import { getFieldAccess, getTableAccess } from './userPermissions';
import { compareValues, matches } from './query';

const SYSTEM_FIELDS = new Set(['Id', 'CreatedOn', 'ModifiedOn', 'Owner', 'karigar_ids']);
const MAX_RECORD_CHARS = 900000; // Firestore documents are limited to 1 MB

const me = () => backend.auth.current();
const fieldsOf = (table) => Object.entries(schema[table] ?? {}).filter(([k]) => k !== '_table');
const labelOf = (table) => schema[table]?._table?.plural ?? table;
const idOf = (v) => (v && typeof v === 'object' ? (v.Id ?? null) : (v ?? null));

// ------------------------------------------------------------------ loading

// Which documents each role may load (mirrors firestore.rules).
function scopeFor(table, u) {
  if (table === 'users') return u ? null : 'deny';
  if (!u || !getTableAccess(u.profile, table).canRead) return 'deny';
  if (u.profile === 'Karigar_c') {
    if (table === 'order_items_c') return u.karigarId ? { where: ['karigar_ids', 'array-contains', u.karigarId] } : 'deny';
    if (table === 'karigar_payments_c') return u.karigarId ? { where: ['karigar_c.Id', '==', u.karigarId] } : 'deny';
    if (table === 'karigars_c') return { where: ['login_c', 'array-contains', u.Id] };
  }
  if (u.profile === 'Staff_c' && table === 'cashbook_c') return { where: ['category_c', '!=', 'Karigar'] };
  if (table === 'audit_log_c') return { orderBy: ['CreatedOn', 'desc'], limit: 1000 };
  return null;
}

function related(table) {
  const out = new Set();
  fieldsOf(table).forEach(([, def]) => {
    if (def.type === 'Lookup' && def.lookup) out.add(def.lookup);
    if (def.type === 'People') out.add('users');
  });
  return [...out];
}

async function ensure(table) {
  const u = me();
  const tables = [table, ...related(table)];
  await Promise.all(tables.map((t) => backend.data.load(t, scopeFor(t, u))));
}

// ------------------------------------------------------------------ reading

function nameIndex(table) {
  const map = new Map();
  backend.data.all(table).forEach((r) => map.set(String(r.Id), table === 'users' ? r.name || r.email : r.Name));
  return map;
}

function makeExpander(table, u) {
  const indexes = {};
  const index = (t) => {
    if (!indexes[t]) indexes[t] = nameIndex(t);
    return indexes[t];
  };
  const fields = fieldsOf(table);
  return (rec) => {
    const out = { ...rec };
    fields.forEach(([f, def]) => {
      if (def.type === 'Lookup') {
        const id = idOf(rec[f]);
        out[f] = id ? { Id: id, Name: index(def.lookup).get(String(id)) ?? rec[f]?.Name ?? '' } : null;
      } else if (def.type === 'People') {
        const list = Array.isArray(rec[f]) ? rec[f] : [];
        out[f] = list.map((uid) => ({ Id: uid, User: { Id: uid, Name: index('users').get(String(uid)) ?? '' } }));
      }
      if (u && getFieldAccess(u.profile, table, f).hidden) delete out[f];
    });
    delete out.karigar_ids;
    return out;
  };
}

const accessor = {
  getAll(table) {
    const expand = makeExpander(table, null);
    return backend.data.all(table).map(expand);
  },
};

function canSee(table, rec, u) {
  const p = policies[table];
  return p?.select ? Boolean(p.select(rec, u, accessor)) : true;
}

function visibleRows(table, u) {
  const expand = makeExpander(table, u);
  const policyExpand = makeExpander(table, null);
  return backend.data
    .all(table)
    .filter((r) => canSee(table, policyExpand(r), u))
    .map(expand);
}

// ------------------------------------------------------------------ writing

function normalizeFiles(list) {
  return (Array.isArray(list) ? list : []).map((f) => ({
    Id: f.Id ?? backend.newId('files'),
    Name: f.Name ?? f.name ?? 'file',
    Size: f.Size ?? Math.round((f.size ?? 0) / 1024),
    Type: f.Type ?? f.type ?? '',
    url: f.url ?? f.dataUrl ?? '',
  }));
}

function normalizeWrite(table, payload, u) {
  const out = {};
  const defs = Object.fromEntries(fieldsOf(table));
  Object.entries(payload).forEach(([k, v]) => {
    if (k === 'Id' || SYSTEM_FIELDS.has(k)) return;
    const def = defs[k];
    if (!def) return;
    if (u && getFieldAccess(u.profile, table, k).hidden) return;
    if (def.type === 'Lookup') {
      const id = idOf(v);
      out[k] = id ? { Id: String(id), Name: nameIndex(def.lookup).get(String(id)) ?? v?.Name ?? '' } : null;
    } else if (def.type === 'People') {
      out[k] = (Array.isArray(v) ? v : [])
        .map((p) => p?.User?.Id ?? p?.User ?? p?.Id ?? p)
        .filter((x) => typeof x === 'string' || typeof x === 'number')
        .map(String);
    } else if (def.type === 'Files') {
      out[k] = normalizeFiles(v);
    } else if (def.type === 'Boolean') {
      out[k] = v === null || v === undefined ? null : Boolean(v);
    } else if (['Number', 'Decimal'].includes(def.type)) {
      out[k] = v === '' || v === null || v === undefined ? null : Number(v);
    } else {
      out[k] = v === undefined ? null : v;
    }
  });
  return out;
}

const same = (a, b) => JSON.stringify(idOf(a) ?? a ?? null) === JSON.stringify(idOf(b) ?? b ?? null);

// Values the app keeps in step automatically.
function derive(table, rec) {
  if (table === 'order_items_c') {
    return { karigar_ids: ['karigar_c', 'karigar2_c', 'karigar3_c'].map((k) => idOf(rec[k])).filter(Boolean).map(String) };
  }
  return {};
}

async function afterWrite(table, rec, changes) {
  // Linking a karigar to a login lets that karigar see their own garments and payments.
  if (table === 'karigars_c' && changes.login_c) {
    for (const uid of changes.login_c) {
      try {
        await backend.users.update(uid, { karigarId: String(rec.Id) });
      } catch {
        // only the owner can link logins; others keep working without it
      }
    }
  }
}

const deny = (message) => ({ success: false, message, messages: [message], data: [] });

// ------------------------------------------------------------------ query builder

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orders = [];
    this.offset = 0;
    this.max = null;
    this.aggs = null;
  }

  select() {
    return this;
  }

  where(filter) {
    if (filter) this.filters.push(filter);
    return this;
  }

  orderBy(field, dir = 'asc') {
    this.orders.push([field, String(dir).toLowerCase() === 'desc' ? -1 : 1]);
    return this;
  }

  orderByDesc(field) {
    return this.orderBy(field, 'desc');
  }

  page(n, size) {
    this.max = size;
    this.offset = (Math.max(1, Number(n) || 1) - 1) * size;
    return this;
  }

  limit(n) {
    this.max = n;
    return this;
  }

  aggregate(specs) {
    this.aggs = specs;
    return this;
  }

  async fetch() {
    const u = me();
    if (!u) return { ...deny('Please sign in'), total: 0 };
    if (!getTableAccess(u.profile, this.table).canRead) return { ...deny(`You do not have access to ${labelOf(this.table)}`), total: 0 };
    try {
      await ensure(this.table);
      let rows = visibleRows(this.table, u).filter((r) => this.filters.every((f) => matches(r, f)));
      let aggregators;
      if (this.aggs) {
        aggregators = this.aggs.map((spec) => {
          const set = spec.where ? rows.filter((r) => matches(r, spec.where)) : rows;
          const data = {};
          (spec.fields ?? []).forEach((f) => {
            const nums = set.map((r) => Number(r[f.field]) || 0);
            const fn = String(f.fn ?? 'Count').toLowerCase();
            let value = set.length;
            if (fn === 'sum') value = nums.reduce((s, n) => s + n, 0);
            if (fn === 'avg' || fn === 'average') value = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
            if (fn === 'min') value = nums.length ? Math.min(...nums) : 0;
            if (fn === 'max') value = nums.length ? Math.max(...nums) : 0;
            data[f.alias ?? 'count'] = value;
          });
          return { id: spec.id, data };
        });
      }
      if (this.orders.length) {
        rows = [...rows].sort((a, b) => {
          for (const [field, dir] of this.orders) {
            const c = compareValues(a[field], b[field]);
            if (c !== 0) return c * dir;
          }
          return 0;
        });
      }
      const total = rows.length;
      if (this.max !== null) rows = rows.slice(this.offset, this.offset + this.max);
      return { success: true, data: rows, total, aggregators };
    } catch (err) {
      return { ...deny(err?.message || 'Could not load data'), total: 0 };
    }
  }

  async get(id) {
    const res = await this.fetch();
    if (!res.success) return { ...res, data: null };
    await ensure(this.table);
    const row = visibleRows(this.table, me()).find((r) => String(r.Id) === String(id));
    return row ? { success: true, data: row } : { success: false, data: null, message: 'Record not found' };
  }

  async create(payload) {
    const u = me();
    const list = Array.isArray(payload) ? payload : [payload];
    if (!u) return deny('Please sign in');
    if (!getTableAccess(u.profile, this.table).canCreate) return deny(`Your role cannot add ${labelOf(this.table)}`);
    await ensure(this.table);
    const created = [];
    const messages = [];
    const now = new Date().toISOString();
    for (const item of list) {
      const rec = normalizeWrite(this.table, item, u);
      if (schema[this.table]?.Name?.required && !String(rec.Name ?? '').trim()) {
        messages.push(`${schema[this.table].Name.label ?? 'Name'} is required`);
        continue;
      }
      const full = { ...rec, CreatedOn: now, ModifiedOn: now, Owner: { Id: u.Id, Name: u.name } };
      Object.assign(full, derive(this.table, full));
      const p = policies[this.table];
      if (p?.insert && !p.insert(makeExpander(this.table, null)(full), u, accessor)) {
        messages.push('You are not allowed to add this record');
        continue;
      }
      if (JSON.stringify(full).length > MAX_RECORD_CHARS) {
        messages.push('Images are too large for one record. Remove a few images and save again.');
        continue;
      }
      try {
        const saved = await backend.data.create(this.table, full);
        await afterWrite(this.table, saved, rec);
        created.push(makeExpander(this.table, u)(saved));
      } catch (err) {
        messages.push(err?.message || 'Could not save');
      }
    }
    return { success: messages.length === 0, data: created, messages };
  }

  async update(payload) {
    const u = me();
    const list = Array.isArray(payload) ? payload : [payload];
    if (!u) return deny('Please sign in');
    if (!getTableAccess(u.profile, this.table).canUpdate) return deny(`Your role cannot edit ${labelOf(this.table)}`);
    await ensure(this.table);
    const updated = [];
    const messages = [];
    for (const item of list) {
      const existing = backend.data.all(this.table).find((r) => String(r.Id) === String(item.Id));
      if (!existing) {
        messages.push('Record not found');
        continue;
      }
      const p = policies[this.table];
      if (p?.update && !p.update(makeExpander(this.table, null)(existing), u, accessor)) {
        messages.push('You are not allowed to change this record');
        continue;
      }
      const changes = normalizeWrite(this.table, item, u);
      const locked = Object.keys(changes).filter(
        (k) => getFieldAccess(u.profile, this.table, k).readOnly && !same(changes[k], existing[k]),
      );
      if (locked.length) {
        messages.push(`Your role cannot change: ${locked.join(', ')}`);
        continue;
      }
      const merged = { ...existing, ...changes };
      Object.assign(changes, derive(this.table, merged), { ModifiedOn: new Date().toISOString() });
      if (JSON.stringify({ ...existing, ...changes }).length > MAX_RECORD_CHARS) {
        messages.push('Images are too large for one record. Remove a few images and save again.');
        continue;
      }
      try {
        const saved = await backend.data.update(this.table, existing.Id, changes);
        await afterWrite(this.table, saved, changes);
        updated.push(makeExpander(this.table, u)(saved));
      } catch (err) {
        messages.push(err?.message || 'Could not save');
      }
    }
    return { success: messages.length === 0, data: updated, messages };
  }

  async remove(ids) {
    const u = me();
    const list = Array.isArray(ids) ? ids : [ids];
    if (!u) return deny('Please sign in');
    if (!getTableAccess(u.profile, this.table).canDelete) return deny(`Your role cannot delete ${labelOf(this.table)}`);
    await ensure(this.table);
    const messages = [];
    for (const id of list) {
      const existing = backend.data.all(this.table).find((r) => String(r.Id) === String(idOf(id)));
      if (!existing) continue;
      const p = policies[this.table];
      if (p?.remove && !p.remove(makeExpander(this.table, null)(existing), u, accessor)) {
        messages.push('You are not allowed to delete this record');
        continue;
      }
      try {
        await backend.data.remove(this.table, existing.Id);
      } catch (err) {
        messages.push(err?.message || 'Could not delete');
      }
    }
    return { success: messages.length === 0, data: [], messages };
  }
}

// ------------------------------------------------------------------ files (images)

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(blob);
  });
}

// Photos are shrunk (max 1280 px, JPEG) and stored inside the record, so no paid file storage is needed.
async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  for (const [side, quality] of [[1280, 0.72], [1024, 0.6], [800, 0.5]]) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length < 260000 || side === 800) return url;
  }
  return null;
}

async function dataUrlToObjectUrl(url) {
  const blob = await (await fetch(url)).blob();
  return URL.createObjectURL(blob);
}

const storage = {
  validate(file, config = {}) {
    const exts = String(config.supportedExtensions ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);
    const ext = String(file.name).split('.').pop().toLowerCase();
    if (exts.length && !exts.includes(ext)) return { valid: false, error: `Only ${exts.join(', ')} files are allowed` };
    if (!file.type.startsWith('image/') && file.size > 700 * 1024) return { valid: false, error: 'File is too large (max 700 KB)' };
    if (config.maxValue && file.size > config.maxValue * 1024 * 4) return { valid: false, error: 'File is too large' };
    return { valid: true };
  },
  async upload(file, { onProgress } = {}) {
    onProgress?.(10);
    const isImage = file.type.startsWith('image/');
    const url = isImage ? await compressImage(file) : await readAsDataUrl(file);
    onProgress?.(100);
    const name = isImage ? file.name.replace(/\.[^.]+$/, '.jpg') : file.name;
    const bytes = Math.round((url.length * 3) / 4);
    return {
      Id: backend.newId('files'),
      Name: name,
      name,
      Size: Math.round(bytes / 1024),
      size: bytes,
      Type: isImage ? 'image/jpeg' : file.type,
      type: isImage ? 'image/jpeg' : file.type,
      url,
    };
  },
  async preview(file) {
    return { url: await dataUrlToObjectUrl(file.url), name: file.Name ?? file.name };
  },
  async download(file) {
    return { url: await dataUrlToObjectUrl(file.url), name: file.Name ?? file.name ?? 'file' };
  },
  toCreateFormat: (files) => normalizeFiles(files),
  toUpdateFormat: (files) => normalizeFiles(files),
};

// ------------------------------------------------------------------ public sdk

export const sdk = {
  mode: backend.mode,
  usingFirebase,
  table: (name) => new Query(name),
  storage,
  session: {
    user: () => backend.auth.current(),
    init: () => backend.auth.init(),
    subscribe(cb) {
      return backend.auth.onChange((u) => cb(u ? { status: 'authenticated', user: u } : { status: 'anonymous' }));
    },
    async login({ email, password }) {
      try {
        return { ok: true, value: await backend.auth.login(email, password) };
      } catch (err) {
        return { ok: false, error: { message: err?.message || 'Sign in failed' } };
      }
    },
    logout: () => backend.auth.logout(),
    changePassword: (oldPassword, newPassword) => backend.auth.changePassword(oldPassword, newPassword),
    sendResetLink: (email) => backend.auth.sendReset(email),
    needsSetup: () => backend.auth.needsSetup(),
    setupOwner: (details) => backend.auth.setupOwner(details),
  },
  users: backend.users,
};
