const READERS = ['Owner_c', 'Manager_c'];

const ownsPayment = (record, user, storeAccessor) =>
  storeAccessor.getAll('karigars_c').some(
    (k) =>
      String(k.Id) === String(record.karigar_c?.Id ?? record.karigar_c) &&
      (k.login_c || []).some((p) => String(p.User?.Id ?? p.User) === String(user.Id)),
  );

export const select = (record, user, storeAccessor) => {
  if (!user) return false;
  if (READERS.includes(user.profile)) return true;
  if (user.profile === 'Karigar_c') return ownsPayment(record, user, storeAccessor);
  return false;
};

export const insert = (record, user) => Boolean(user) && ['Owner_c', 'Manager_c'].includes(user.profile);

export const update = (record, user) => Boolean(user) && user.profile === 'Owner_c';

export const remove = (record, user) => Boolean(user) && user.profile === 'Owner_c';
