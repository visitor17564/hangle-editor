// Upstream UI preferences remain local to an editor tab with an opaque origin.
const values = new Map();
Object.defineProperty(window, "localStorage", { configurable: true, value: {
  get length() { return values.size; },
  getItem: key => values.get(String(key)) ?? null,
  setItem: (key, value) => values.set(String(key), String(value)),
  removeItem: key => values.delete(String(key)),
  clear: () => values.clear(),
  key: index => [...values.keys()][index] ?? null
} });
