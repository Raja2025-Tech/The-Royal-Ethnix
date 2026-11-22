// Firebase backend: Firebase Authentication for logins, Cloud Firestore for data.
// Each table is a Firestore collection; every role listens only to the documents it may read
// (see firestore.rules), and the app filters, sorts and totals those documents in memory.
import { deleteApp, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { seed } from '@/services/data';

function toAppUser(id, d) {
  if (!d) return null;
  const [first, ...rest] = String(d.name || d.email || '').trim().split(/\s+/);
  return {
    Id: id,
    userId: id,
    email: d.email,
    emailAddress: d.email,
    name: d.name || d.email,
    firstName: d.firstName ?? first ?? '',
    lastName: d.lastName ?? rest.join(' '),
    profile: d.profile,
    active: d.active !== false,
    karigarId: d.karigarId ?? null,
  };
}

// Writes are kept in Firestore's offline queue when the internet drops, so the app does not wait
// for the server forever: after a few seconds the write counts as saved and syncs later.
function commit(promise, rollback) {
  const guarded = promise.catch((err) => {
    rollback?.();
    throw err;
  });
  return Promise.race([guarded, new Promise((resolve) => setTimeout(resolve, 4000))]);
}

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Wrong email or password',
  'auth/wrong-password': 'Wrong email or password',
  'auth/user-not-found': 'Wrong email or password',
  'auth/invalid-email': 'Enter a valid email address',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/email-already-in-use': 'A user with this email already exists',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/network-request-failed': 'No internet connection',
  'auth/requires-recent-login': 'Sign out and sign in again, then retry',
};

function friendly(err) {
  const msg = AUTH_ERRORS[err?.code];
  return msg ? new Error(msg) : err;
}

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  let current = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((cb) => cb(current));

  async function profileOf(fbUser) {
    const snap = await getDoc(doc(db, 'users', fbUser.uid));
    if (!snap.exists()) return null;
    const u = toAppUser(fbUser.uid, snap.data());
    return u?.active ? u : null;
  }

  // ---------------------------------------------------------------- data cache
  const caches = new Map();

  function load(table, scope) {
    if (caches.has(table)) return caches.get(table).ready;
    const entry = { map: new Map(), denied: false, unsub: null };
    entry.ready = new Promise((resolve) => {
      if (scope === 'deny') {
        entry.denied = true;
        resolve();
        return;
      }
      const cons = [];
      if (scope?.where) cons.push(where(...scope.where));
      if (scope?.orderBy) cons.push(orderBy(...scope.orderBy));
      if (scope?.limit) cons.push(limit(scope.limit));
      const q = cons.length ? query(collection(db, table), ...cons) : collection(db, table);
      let first = true;
      entry.unsub = onSnapshot(
        q,
        (snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type === 'removed') entry.map.delete(ch.doc.id);
            else entry.map.set(ch.doc.id, { ...ch.doc.data(), Id: ch.doc.id });
          });
          if (first) {
            first = false;
            resolve();
          }
        },
        (err) => {
          console.warn(`[firestore] ${table}:`, err?.message);
          entry.denied = true;
          if (first) {
            first = false;
            resolve();
          }
        },
      );
    });
    caches.set(table, entry);
    return entry.ready;
  }

  function resetCaches() {
    caches.forEach((c) => c.unsub?.());
    caches.clear();
  }

  // Signing in as someone else (or out) starts a fresh cache, so nobody sees the previous
  // user's documents. During first-run setup the owner record does not exist yet, so skip.
  let settingUp = false;
  let lastUid = null;
  onAuthStateChanged(auth, async (fbUser) => {
    if (settingUp) return;
    if ((fbUser?.uid ?? null) !== lastUid) resetCaches();
    lastUid = fbUser?.uid ?? null;
    if (!fbUser) {
      current = null;
      emit();
      return;
    }
    try {
      current = await profileOf(fbUser);
      if (!current) await signOut(auth);
    } catch {
      current = null;
    }
    emit();
  });

  let initPromise = null;

  return {
    mode: 'firebase',
    newId: (t = 'x') => doc(collection(db, t)).id,

    auth: {
      current: () => current,
      onChange(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      init() {
        if (!initPromise) {
          initPromise = new Promise((resolve) => {
            const stop = onAuthStateChanged(auth, async (fbUser) => {
              stop();
              if (!fbUser) return resolve(null);
              try {
                current = await profileOf(fbUser);
              } catch {
                current = null;
              }
              resolve(current);
            });
          });
        }
        return initPromise;
      },
      async login(email, password) {
        try {
          const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
          if (lastUid !== cred.user.uid) resetCaches();
          lastUid = cred.user.uid;
          const u = await profileOf(cred.user);
          if (!u) {
            await signOut(auth);
            throw new Error('This account is not active. Ask the owner to add you in Team.');
          }
          current = u;
          return u;
        } catch (err) {
          throw friendly(err);
        }
      },
      async logout() {
        resetCaches();
        lastUid = null;
        await signOut(auth);
        current = null;
      },
      async changePassword(oldPassword, newPassword) {
        try {
          const fbUser = auth.currentUser;
          await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(fbUser.email, oldPassword));
          await updatePassword(fbUser, newPassword);
        } catch (err) {
          throw friendly(err);
        }
      },
      async sendReset(email) {
        try {
          await sendPasswordResetEmail(auth, String(email).trim());
        } catch (err) {
          throw friendly(err);
        }
      },
      async needsSetup() {
        const snap = await getDoc(doc(db, 'meta', 'setup'));
        return !snap.exists();
      },
      // First run only: creates the owner account and the starter garment categories.
      async setupOwner({ name, email, password }) {
        settingUp = true;
        try {
          const cred = await createUserWithEmailAndPassword(auth, String(email).trim(), password);
          lastUid = cred.user.uid;
          const uid = cred.user.uid;
          const now = new Date().toISOString();
          const batch = writeBatch(db);
          batch.set(doc(db, 'users', uid), { name, email: cred.user.email, profile: 'Owner_c', active: true, CreatedOn: now });
          batch.set(doc(db, 'meta', 'setup'), { owner: uid, CreatedOn: now });
          await batch.commit();
          const cats = writeBatch(db);
          (seed.categories_c ?? []).forEach((c) => {
            const { Id, Owner, ...rest } = c;
            cats.set(doc(db, 'categories_c', Id), { ...rest, CreatedOn: now, Owner: { Id: uid, Name: name } });
          });
          await cats.commit();
          current = await profileOf(cred.user);
          emit();
          return current;
        } catch (err) {
          throw friendly(err);
        } finally {
          settingUp = false;
        }
      },
    },

    users: {
      async list() {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map((d) => toAppUser(d.id, d.data()));
      },
      // A second Firebase app creates the login, so the owner stays signed in.
      async add({ name, email, password, profile }) {
        const second = initializeApp(config, `add-user-${Date.now()}`);
        try {
          const secondAuth = getAuth(second);
          const cred = await createUserWithEmailAndPassword(secondAuth, String(email).trim(), password);
          await signOut(secondAuth);
          await setDoc(doc(db, 'users', cred.user.uid), {
            name: name || cred.user.email,
            email: cred.user.email,
            profile,
            active: true,
            CreatedOn: new Date().toISOString(),
          });
          return toAppUser(cred.user.uid, { name, email: cred.user.email, profile, active: true });
        } catch (err) {
          throw friendly(err);
        } finally {
          await deleteApp(second).catch(() => {});
        }
      },
      async update(id, changes) {
        await updateDoc(doc(db, 'users', id), changes);
        if (current?.Id === id) {
          current = { ...current, ...toAppUser(id, { ...current, ...changes, email: current.email }) };
          emit();
        }
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email);
        return `Password reset email sent to ${email}`;
      },
    },

    data: {
      load,
      denied: (t) => Boolean(caches.get(t)?.denied),
      all: (t) => [...(caches.get(t)?.map.values() ?? [])],
      async create(t, rec) {
        const id = rec.Id ?? doc(collection(db, t)).id;
        const { Id, ...data } = rec;
        const row = { ...data, Id: id };
        caches.get(t)?.map.set(id, row);
        await commit(setDoc(doc(db, t, id), data), () => caches.get(t)?.map.delete(id));
        return row;
      },
      async update(t, id, changes) {
        const cache = caches.get(t)?.map;
        const before = cache?.get(id);
        const { Id, ...data } = changes;
        if (cache && before) cache.set(id, { ...before, ...data });
        await commit(updateDoc(doc(db, t, id), data), () => {
          if (cache && before) cache.set(id, before);
        });
        return { ...(before ?? {}), ...data, Id: id };
      },
      async remove(t, id) {
        const cache = caches.get(t)?.map;
        const before = cache?.get(id);
        cache?.delete(id);
        await commit(deleteDoc(doc(db, t, id)), () => {
          if (cache && before) cache.set(id, before);
        });
      },
      reset: resetCaches,
    },
  };
}
