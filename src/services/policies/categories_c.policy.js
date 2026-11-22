const READERS = ['Owner_c', 'Staff_c', 'Manager_c', 'CadMaster_c'];

export const select = (record, user) => Boolean(user) && READERS.includes(user.profile);

export const insert = (record, user) => Boolean(user) && ['Owner_c', 'Manager_c'].includes(user.profile);

export const update = (record, user) => Boolean(user) && user.profile === 'Owner_c';

export const remove = (record, user) => Boolean(user) && user.profile === 'Owner_c';
