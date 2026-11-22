const READERS = ['Owner_c', 'Staff_c', 'Manager_c'];
const WRITERS = ['Owner_c', 'Staff_c', 'Manager_c'];

// Karigar payments are visible only to Admin and Manager, never to counter staff.
export const select = (record, user) =>
  Boolean(user) && READERS.includes(user.profile) && !(user.profile === 'Staff_c' && record?.category_c === 'Karigar');

export const insert = (record, user) => Boolean(user) && WRITERS.includes(user.profile);

export const update = (record, user) => Boolean(user) && user.profile === 'Owner_c';

export const remove = (record, user) => Boolean(user) && user.profile === 'Owner_c';
