/** Escapes user input so it is matched literally inside a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts inclusive `YYYY-MM-DD` bounds into a Mongo range on whole UTC days.
 * Returns undefined when neither bound is set, so callers can skip the clause entirely.
 */
export function toDateRange(from?: string, to?: string): { $gte?: Date; $lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999Z`);
  return range;
}

/**
 * Builds update operators from a validated partial body. Keys that were sent but resolved to
 * `undefined` (e.g. an optional field cleared to '' in a form) become `$unset` instead of being
 * silently dropped by Mongoose.
 */
export function toUpdateOperators(input: Record<string, unknown>) {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ''> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) $unset[key] = '';
    else $set[key] = value;
  }
  return {
    ...(Object.keys($set).length > 0 ? { $set } : {}),
    ...(Object.keys($unset).length > 0 ? { $unset } : {}),
  };
}

/**
 * Index-friendly search clause:
 *  - `$text` with the input as a quoted *phrase*: candidates come from the text index and must
 *    contain the whole phrase (plain `$text` would OR the words, so "john smith" matched every John)
 *  - anchored, case-insensitive prefix regexes on indexed fields give "type-ahead" partial matches
 * MongoDB allows `$text` inside `$or` only when every other clause is indexed, which the models guarantee.
 */
export function buildSearchClause(search: string, prefixFields: string[]) {
  const term = search.trim();
  const phrase = `"${term.replace(/"/g, '')}"`;
  const prefix = new RegExp(`^${escapeRegex(term)}`, 'i');
  return {
    $or: [{ $text: { $search: phrase } }, ...prefixFields.map((field) => ({ [field]: prefix }))],
  };
}
