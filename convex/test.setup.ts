/**
 * Shared Convex test setup for admin. Provides `modules` for convexTest().
 * Uses import.meta.glob when available (Vitest/Vite); falls back to
 * runtime fs-based glob when not (e.g. Bun's test runner).
 */
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { pathToFileURL } from "url";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadModulesFallback(): Record<string, () => Promise<unknown>> {
  const modules: Record<string, () => Promise<unknown>> = {};
  function walk(dir: string, base = ""): void {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!e.name.startsWith(".") && e.name !== "node_modules")
          walk(join(dir, e.name), rel);
      } else if (
        e.isFile() &&
        /\.(ts|js)$/.test(e.name) &&
        !e.name.endsWith(".d.ts") &&
        !e.name.includes(".test.") &&
        !e.name.includes("test.setup")
      ) {
        const key = "./" + rel;
        const fullPath = join(dir, e.name);
        modules[key] = () => import(pathToFileURL(fullPath).href);
      }
    }
  }
  walk(__dirname);
  return modules;
}

export const modules: Record<string, () => Promise<unknown>> =
  typeof import.meta.glob === "function"
    ? (import.meta.glob("./**/*.ts") as Record<string, () => Promise<unknown>>)
    : loadModulesFallback();
