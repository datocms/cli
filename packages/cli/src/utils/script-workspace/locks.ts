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
  const pidFile = path.join(lockDir, 'pid');
  const timeoutMs = opts?.timeoutMs ?? 2 * 60 * 1000;
  const start = Date.now();

  await fs.mkdir(path.dirname(lockDir), { recursive: true });

  while (true) {
    try {
      await fs.mkdir(lockDir);
      await fs.writeFile(pidFile, String(process.pid), { encoding: 'utf8' });
      try {
        return await fn();
      } finally {
        await fs.rm(lockDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch {
      if (await isStaleLock(lockDir, pidFile)) {
        await fs.rm(lockDir, { recursive: true, force: true }).catch(() => {});
        continue;
      }
      if (Date.now() - start > timeoutMs) throw new Error('lock timeout');
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

async function isStaleLock(lockDir: string, pidFile: string): Promise<boolean> {
  const pidContent = await fs.readFile(pidFile, 'utf8').catch(() => null);

  if (pidContent === null) {
    // Lock dir exists but no pid file yet — could be a brand-new acquisition
    // mid-write, or a legacy lock from before pid tracking. If it's been
    // around for more than a few seconds, treat as stale.
    const stat = await fs.stat(lockDir).catch(() => null);
    if (!stat) return false;
    return Date.now() - stat.mtimeMs > 5_000;
  }

  const pid = Number.parseInt(pidContent.trim(), 10);
  if (!Number.isFinite(pid) || pid <= 0) return true;

  try {
    process.kill(pid, 0);
    return false;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'ESRCH';
  }
}
