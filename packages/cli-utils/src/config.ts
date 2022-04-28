import { access, readFile } from 'fs/promises';

export type ProjectConfig = {
  apiToken: string;
};

export type Config = {
  projects: Record<string, ProjectConfig>;
};

function isProjectConfig(thing: any): thing is ProjectConfig {
  if (typeof thing !== 'object' || !thing) {
    return false;
  }

  if (!('apiToken' in thing) || typeof thing.apiToken !== 'string') {
    return false;
  }

  return true;
}

function isConfig(thing: any): thing is Config {
  if (typeof thing !== 'object' || !thing) {
    return false;
  }

  if (!('projects' in thing)) {
    return false;
  }

  const { projects } = thing;

  if (typeof projects !== 'object' || !projects) {
    return false;
  }

  if (
    Object.values(projects).some(
      (projectConfig) => !isProjectConfig(projectConfig),
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
    throw new Error(`Invalid configuration file at ${fullPath}!`);
  }

  return config;
}
