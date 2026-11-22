// Demo backend: everything is stored in this browser (localStorage). Used automatically when no
// Firebase settings are present in .env, so the app can be tried without any setup.
import { seed } from '@/services/data';

const PREFIX = 'tms:v1:';

export const DEMO_USERS = [
  { Id: 'a41c9d27-5e8f-4b06-9c3a-d7f218e64b90', email: 'owner@demo.app', firstName: 'Subhasish', lastName: 'Owner', profile: 'Owner_c' },
  { Id: 'b52d0e38-6f90-4c17-8d4b-e8a329f75ca1', email: 'staff@demo.app', firstName: 'Counter', lastName: 'Staff', profile: 'Staff_c' },
  { Id: 'c63e1f49-7a01-4d28-9e5c-f93b4a86db12', email: 'karigar@demo.app', firstName: 'Mohammad', lastName: 'Rafique', profile: 'Karigar_c', karigarId: 'b1000000-0000-4000-8000-000000000001' },
  { Id: 'd74f2a5b-8b12-4e39-a0d6-0c4b97e53f21', email: 'manager@demo.app', firstName: 'Shop', lastName: 'Manager', profile: 'Manager_c' },
  { Id: 'e85a3b6c-9c23-4f4a-b1e7-1d5ca8f64a32', email: 'cad@demo.app', firstName: 'CAD', lastName: 'Master', profile: 'CadMaster_c' },
].map((u) => ({ ...u, password: 'demo1234', active: true, name: `${u.firstName} ${u.lastName}` }));

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    throw new Error(
      err?.name === 'QuotaExceededError'
        ? 'Browser storage is full. Remove some images, or connect Firebase for real storage.'
        : 'Could not save in this browser',
    );
  }
}

const uuid = () =>
  (window.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

// People fields are kept as arrays of user ids.
function normalizeSeed(rec) {
  const out = { ...rec };
  Object.keys(out).forEach((k) => {
    const v = out[k];
    if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'User' in v[0]) {
      out[k] = v.map((p) => p.User?.Id ?? p.User).filter(Boolean);
    }
  });
  return out;
}

export function createLocalBackend() {
  if (!read('seeded', false)) {
    Object.entries(seed).forEach(([table, rows]) => write(table, rows.map(normalizeSeed)));
    write('users', DEMO_USERS);
    write('seeded', true);
  }

  const tables = new Map();
  const getTable = (t) => {
    if (!tables.has(t)) tables.set(t, read(t, []));
    return tables.get(t);
  };
  const save = (t) => write(t, getTable(t));

  let users = read('users', DEMO_USERS);
  const saveUsers = () => write('users', users);
  const listeners = new Set();
  const toAppUser = (u) => (u ? { ...u } : null);

  let current = toAppUser(users.find((u) => u.Id === read('session', null) && u.active !== false));

  const emit = () => listeners.forEach((cb) => cb(current));

  return {
    mode: 'local',
    newId: uuid,

    auth: {
      current: () => current,
      onChange(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      async init() {
        return current;
      },
      async login(email, password) {
        const u = users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
        if (!u || u.password !== password) throw new Error('Wrong email or password');
        if (u.active === false) throw new Error('This account has been disabled');
        current = toAppUser(u);
        write('session', u.Id);
        emit();
        return current;
      },
      async logout() {
        current = null;
        write('session', null);
        emit();
      },
      async changePassword(oldPassword, newPassword) {
        const u = users.find((x) => x.Id === current?.Id);
        if (!u || u.password !== oldPassword) throw new Error('Current password is wrong');
        u.password = newPassword;
        saveUsers();
      },
      async sendReset() {
        throw new Error('Password reset email works only with Firebase. In demo mode the password is demo1234.');
      },
      async needsSetup() {
        return false;
      },
      async setupOwner() {
        throw new Error('Not needed in demo mode');
      },
    },

    users: {
      async list() {
        return users.map(({ password, ...u }) => u);
      },
      async add({ name, email, password, profile }) {
        const e = String(email).trim().toLowerCase();
        if (users.some((u) => u.email.toLowerCase() === e)) throw new Error('A user with this email already exists');
        const [firstName, ...rest] = String(name || e).trim().split(/\s+/);
        const u = { Id: uuid(), email: e, password, name: name || e, firstName, lastName: rest.join(' '), profile, active: true };
        users = [...users, u];
        saveUsers();
        return u;
      },
      async update(id, changes) {
        users = users.map((u) => (u.Id === id ? { ...u, ...changes } : u));
        saveUsers();
        if (current?.Id === id) {
          current = toAppUser(users.find((u) => u.Id === id));
          emit();
        }
      },
      async resetPassword(email) {
        const u = users.find((x) => x.email === email);
        if (u) {
          u.password = 'demo1234';
          saveUsers();
        }
        return 'Password reset to demo1234';
      },
    },

    data: {
      async load() {},
      denied: () => false,
      all: (t) => getTable(t),
      async create(t, rec) {
        const row = { ...rec, Id: rec.Id ?? uuid() };
        tables.set(t, [...getTable(t), row]);
        save(t);
        return row;
      },
      async update(t, id, changes) {
        let out = null;
        tables.set(
          t,
          getTable(t).map((r) => {
            if (String(r.Id) !== String(id)) return r;
            out = { ...r, ...changes };
            return out;
          }),
        );
        save(t);
        return out;
      },
      async remove(t, id) {
        tables.set(t, getTable(t).filter((r) => String(r.Id) !== String(id)));
        save(t);
      },
      reset() {},
    },
  };
}
