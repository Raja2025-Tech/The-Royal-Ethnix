const READERS = ['Owner_c', 'Staff_c', 'Manager_c', 'CadMaster_c'];
const WRITERS = ['Owner_c', 'Staff_c', 'Manager_c'];
const EDITORS = ['Owner_c', 'Staff_c', 'CadMaster_c'];

export const select = (record, user) => Boolean(user) && READERS.includes(user.profile);

export const insert = (record, user) => Boolean(user) && WRITERS.includes(user.profile);

export const update = (record, user) => Boolean(user) && EDITORS.includes(user.profile);

export const remove = (record, user) => Boolean(user) && user.profile === 'Owner_c';
