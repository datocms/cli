import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import envPaths from 'env-paths';

const CREDENTIALS_PATH = join(
  envPaths('datocms-cli', { suffix: '' }).config,
  'credentials.json',
);

export type Credentials = {
  apiToken: string;
  dashboardBaseUrl?: string;
};

export async function readCredentials(): Promise<Credentials | undefined> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    if (typeof parsed?.apiToken !== 'string') {
      return undefined;
    }

    return parsed as Credentials;
  } catch {
    return undefined;
  }
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await mkdir(dirname(CREDENTIALS_PATH), { recursive: true });

  const toSave: Record<string, string> = { apiToken: credentials.apiToken };

  if (credentials.dashboardBaseUrl) {
    toSave.dashboardBaseUrl = credentials.dashboardBaseUrl;
  }

  await writeFile(CREDENTIALS_PATH, JSON.stringify(toSave, null, 2), 'utf-8');
  await chmod(CREDENTIALS_PATH, 0o600);
}

export async function deleteCredentials(): Promise<void> {
  try {
    await rm(CREDENTIALS_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
