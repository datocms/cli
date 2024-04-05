import { access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export async function findNearestFile(
  fileName: string,
  directoryPath: string = resolve(),
): Promise<string> {
  try {
    const path = join(directoryPath, fileName);
    await access(path);
    return path;
  } catch {
    const parentDirectoryPath = dirname(directoryPath);

    if (parentDirectoryPath === directoryPath) {
      throw new Error(`No "${fileName}" file found`);
    }

    return findNearestFile(fileName, parentDirectoryPath);
  }
}
