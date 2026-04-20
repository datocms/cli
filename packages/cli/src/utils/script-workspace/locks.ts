import fs from 'node:fs/promises';
import path from 'node:path';
import envPaths from 'env-paths';

export async function withLock<T>(
  name: string,
  fn: () => Promise<T>,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const lockDir = path.join(
    envPaths('datocms-cli', { suffix: '' }).data,
    `${name}.lock`,
  );
  const timeoutMs = opts?.timeoutMs ?? 2 * 60 * 1000;
  const start = Date.now();

  await fs.mkdir(path.dirname(lockDir), { recursive: true });

  while (true) {
    try {
      await fs.mkdir(lockDir);
      try {
        return await fn();
      } finally {
        await fs.rmdir(lockDir).catch(() => {});
      }
    } catch {
      if (Date.now() - start > timeoutMs) throw new Error('lock timeout');
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
