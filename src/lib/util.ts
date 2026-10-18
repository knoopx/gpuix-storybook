export function pick<T>(values: Array<T | undefined>, def?: T): T | undefined {
  for (const v of values) if (v !== undefined) return v;
  return def;
}
