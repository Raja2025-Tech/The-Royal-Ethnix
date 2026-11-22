export const select = (record, user) => Boolean(user) && ['Owner_c', 'Manager_c', 'Staff_c'].includes(user.profile);

export const insert = (record, user) => Boolean(user) && ['Owner_c', 'Manager_c', 'Staff_c'].includes(user.profile);

export const update = (record, user) => Boolean(user) && user.profile === 'Owner_c';

export const remove = (record, user) => Boolean(user) && user.profile === 'Owner_c';
