const READERS = ['Owner_c', 'Staff_c', 'Manager_c'];

export const select = (record, user) => {
  if (!user) return false;
  if (READERS.includes(user.profile)) return true;
  if (user.profile === 'Karigar_c') {
    return (record.login_c || []).some((p) => String(p.User?.Id ?? p.User) === String(user.Id));
  }
  return false;
};

export const insert = (record, user) => Boolean(user) && ['Owner_c', 'Manager_c'].includes(user.profile);

export const update = (record, user) => Boolean(user) && user.profile === 'Owner_c';

export const remove = (record, user) => Boolean(user) && user.profile === 'Owner_c';
