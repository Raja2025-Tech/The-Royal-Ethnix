// Table definitions (field types used to store Lookups, People and Files correctly) and the starter
// records. Each JSON file holds `_meta` (the table schema) and `records` (seed data).
const modules = import.meta.glob('./*.json', { eager: true });

export const schema = {};
export const seed = {};

for (const [key, mod] of Object.entries(modules)) {
  const name = key.replace('./', '').replace('.json', '');
  const data = mod.default ?? mod;
  schema[name] = data._meta ?? {};
  seed[name] = Array.isArray(data.records) ? data.records : [];
}

export const TABLES = Object.keys(schema);
