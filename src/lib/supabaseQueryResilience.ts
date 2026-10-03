/** Shared page size for catalog / list loads (keeps Vercel lite REST fast). */
export const CATALOG_PAGE_SIZE = 250;

export function isTransientSupabaseError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "").toLowerCase();
  return (
    msg.includes("emaxconnsession") ||
    msg.includes("max clients reached") ||
    msg.includes("connection terminated") ||
    msg.includes("timeout") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withSupabaseRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts?: { attempts?: number }
): Promise<T> {
  const attempts = opts?.attempts ?? 4;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransientSupabaseError(err) || i === attempts - 1) break;
      console.warn(`[supabase] retry ${label} (${i + 1}/${attempts})`);
      await sleepMs(350 * (i + 1));
    }
  }
  throw last;
}

/** Run async tasks in small parallel batches to avoid connection storms. */
export async function runInBatches<T>(
  tasks: Array<() => Promise<T>>,
  batchSize = 3
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const slice = tasks.slice(i, i + batchSize);
    out.push(...(await Promise.all(slice.map((t) => t()))));
  }
  return out;
}
