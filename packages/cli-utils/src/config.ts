import { access, readFile } from 'fs/promises';
import { get } from 'lodash';

export type ProfileConfig = {
  baseUrl?: string;
  logLevel?: 'NONE' | 'BASIC' | 'BODY' | 'BODY_AND_HEADERS';
  migrations?: {
    directory?: string;
    modelApiKey?: string;
    template?: string;
  };
};

export type Config = {
  profiles: Record<string, ProfileConfig>;
};

function isProfileConfig(thing: any): thing is ProfileConfig {
  if (typeof thing !== 'object' || !thing) {
    return false;
  }

  for (const key of [
    'apiToken',
    'baseUrl',
    'logLevel',
    'migrations.directory',
    'migrations.modelApiKey',
  ]) {
    const value = get(thing, key);
    if (value !== undefined && typeof value !== 'string') {
      return false;
    }
  }

  return true;
}

function isConfig(thing: any): thing is Config {
  if (typeof thing !== 'object' || !thing) {
    return false;
  }

  if (!('profiles' in thing)) {
    return false;
  }

  const { profiles } = thing;

  if (typeof profiles !== 'object' || !profiles) {
    return false;
  }

  if (
    Object.values(profiles).some(
      (profileConfig) => !isProfileConfig(profileConfig),
    )
  ) {
    return false;
  }

  return true;
}

export async function readConfig(
  fullPath: string,
): Promise<Config | undefined> {
  try {
    await access(fullPath);
  } catch {
    return undefined;
  }

  const rawConfig = await readFile(fullPath, 'utf-8');

  const config = JSON.parse(rawConfig);

  if (!isConfig(config)) {
    throw new Error(`Invalid configuration file at "${fullPath}"!`);
  }

  return config;
}
