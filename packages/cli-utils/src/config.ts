import { access, readFile } from 'node:fs/promises';
import { get } from 'lodash';
import type { LogLevelFlagEnum, LogLevelModeEnum } from '.';

export type ProfileConfig = {
  baseUrl?: string;
  logLevel?: LogLevelFlagEnum;
  logMode?: LogLevelModeEnum;
  migrations?: {
    directory?: string;
    modelApiKey?: string;
    template?: string;
    tsconfig?: string;
  };
};

export type Config = {
  profiles: Record<string, ProfileConfig>;
};

function isProfileConfig(thing: unknown): thing is ProfileConfig {
  if (typeof thing !== 'object' || !thing) {
    return false;
  }

  for (const key of [
    'apiToken',
    'baseUrl',
    'logLevel',
    'migrations.directory',
    'migrations.modelApiKey',
    'migrations.template',
    'migrations.tsconfig',
  ]) {
    const value = get(thing, key);
    if (value !== undefined && typeof value !== 'string') {
      return false;
    }
  }

  return true;
}

function isConfig(thing: unknown): thing is Config {
  if (typeof thing !== 'object' || !thing) {
    return false;
  }

  if (!('profiles' in thing)) {
    return false;
  }

  const { profiles } = thing as any;

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
