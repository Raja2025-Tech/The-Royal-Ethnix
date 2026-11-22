const READERS = ['Owner_c', 'Staff_c', 'Manager_c', 'CadMaster_c'];
const WRITERS = ['Owner_c', 'Staff_c'];

const SLOTS = ['karigar_c', 'karigar2_c', 'karigar3_c'];

const ownsGarment = (record, user, storeAccessor) => {
  const ids = SLOTS.map((s) => record[s]?.Id ?? record[s]).filter(Boolean).map(String);
  return storeAccessor.getAll('karigars_c').some(
    (k) =>
      ids.includes(String(k.Id)) &&
      (k.login_c || []).some((p) => String(p.User?.Id ?? p.User) === String(user.Id)),
  );
};

export const select = (record, user, storeAccessor) => {
  if (!user) return false;
  if (READERS.includes(user.profile)) return true;
  if (user.profile === 'Karigar_c') return ownsGarment(record, user, storeAccessor);
  return false;
};

export const insert = (record, user) => Boolean(user) && [...WRITERS, 'Manager_c'].includes(user.profile);

export const update = (record, user, storeAccessor) => {
  if (!user) return false;
  if (WRITERS.includes(user.profile)) return true;
  if (user.profile === 'CadMaster_c') return true;
  if (user.profile === 'Karigar_c') return ownsGarment(record, user, storeAccessor);
  return false;
};

export const remove = (record, user) => Boolean(user) && user.profile === 'Owner_c';
