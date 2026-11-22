export const select = (record, user) => Boolean(user) && ['Owner_c', 'Manager_c'].includes(user.profile);

export const insert = (record, user) => Boolean(user);

export const update = () => false;

export const remove = () => false;
