/**
 * These suites talk to live APIs and, for WordPress, to a container. That is a
 * lot of ways to be misconfigured, and each of them used to surface as something
 * unrelated — a 401 deep inside an import, or `expected 0 to equal 3`. The
 * checks here run before anything else and say what to do about it.
 */

export function requireEnv(...names: string[]) {
  const missing = names.filter((name) => !process.env[name]);

  if (missing.length === 0) {
    return;
  }

  const [is, they] =
    missing.length === 1 ? ['is', 'It goes'] : ['are', 'They go'];

  throw new Error(
    `${missing.join(', ')} ${is} not set, so this suite cannot run.\n` +
      `  ${they} in the .env file at the root of this repository; ` +
      'see .env.sample.',
  );
}

/**
 * The WordPress instance the importer reads from, with the dump loaded.
 *
 * Reachability and readiness are separate failures with separate fixes: the
 * container not running, and the container running against a database that
 * hasn't finished importing `wp_test_data/mysql/dump.sql` (MySQL takes a while,
 * and WordPress happily serves a "connection refused" page in the meantime).
 */
export async function requireWordPress(url: string) {
  const endpoint = new URL('?rest_route=/wp/v2/posts', url).toString();

  let response: Response;

  try {
    response = await fetch(endpoint, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(
      `No WordPress at ${url} (${(error as Error).message}), so this suite ` +
        'cannot run.\n' +
        '  Start it with "docker compose up" from packages/cli-plugin-wordpress.',
    );
  }

  const body = await response.text();
  let posts: unknown;

  try {
    posts = JSON.parse(body);
  } catch {
    throw new Error(
      `WordPress at ${url} answered ${response.status} with something that ` +
        'is not JSON, which usually means MySQL is still importing the dump.\n' +
        '  Give it a minute, or check "docker compose logs db".\n' +
        `  It said: ${body.replace(/\s+/g, ' ').trim().slice(0, 200)}`,
    );
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error(
      `WordPress at ${url} is up but has no posts, so the assertions below ` +
        'would all fail.\n' +
        '  Its database should have been seeded from ' +
        'packages/cli-plugin-wordpress/wp_test_data/mysql/dump.sql — try ' +
        '"docker compose down -v" and "docker compose up" to reload it.',
    );
  }
}
