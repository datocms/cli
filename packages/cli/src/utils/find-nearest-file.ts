import { join, resolve, dirname } from 'path';
import { access } from 'fs/promises';

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
      throw new Error(`No ${fileName} files found`);
    }

    return findNearestFile(parentDirectoryPath);
  }
}
