/** Vitest/convex-test use import.meta.glob to load Convex modules. */
interface ImportMeta {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}
