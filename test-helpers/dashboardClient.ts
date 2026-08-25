import path from 'node:path';
import {
  ApiError,
  type Client,
  type ClientConfigOptions,
  buildClient,
} from '@datocms/dashboard-client';
import { config } from 'dotenv';

// Loaded from the repo root rather than from `process.cwd()`, so it doesn't
// matter which package directory mocha was started in.
config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * These suites used to sign themselves up a throwaway DatoCMS account on every
 * run:
 *
 *     nonLoggedDashboardClient.account.create({ email: `${random}@…`, … })
 *
 * That stopped working when the account API started requiring a `captcha_token`
 * — it answers `422 INVALID_FIELD / INVALID_CAPTCHA`, and no credential can
 * supply a captcha, so the suites were unrunnable everywhere, with or without a
 * `.env`. They log in to pre-existing accounts instead, which is what
 * `js-rest-api-clients` has always done.
 *
 * A *pool* of accounts, because the login endpoint rate-limits per account and
 * several of these suites can be running at once: on `RATE_LIMIT_EXCEEDED` we
 * move to the next account rather than failing the run. They are expected to
 * share a password and an organization.
 */
export async function buildTestDashboardClient(
  extraConfig?: Partial<ClientConfigOptions>,
): Promise<Client> {
  const baseConfig: Partial<ClientConfigOptions> = {
    baseUrl: process.env.ACCOUNT_API_BASE_URL,
    organization: process.env.DATOCMS_ORGANIZATION_ID,
  };

  // Reused across suites in the same process: logging in again would only cost
  // another hit on the rate limit.
  if (process.env.DATOCMS_SESSION_ID) {
    return buildClient({
      ...extraConfig,
      ...baseConfig,
      apiToken: process.env.DATOCMS_SESSION_ID,
    });
  }

  const { DATOCMS_ACCOUNT_EMAIL, DATOCMS_ACCOUNT_PASSWORD } = process.env;

  if (!DATOCMS_ACCOUNT_EMAIL || !DATOCMS_ACCOUNT_PASSWORD) {
    throw new Error(
      'DATOCMS_ACCOUNT_EMAIL and DATOCMS_ACCOUNT_PASSWORD (and optionally ' +
        'DATOCMS_ORGANIZATION_ID) must be set in the .env file at the root of ' +
        'this repository. See .env.sample.',
    );
  }

  const emails = shuffle(DATOCMS_ACCOUNT_EMAIL.split(/\s*,\s*/));

  for (const email of emails) {
    const client = buildClient({
      ...extraConfig,
      ...baseConfig,
      apiToken: null,
      autoRetry: false,
    });

    try {
      const session = await client.session.rawCreate({
        data: {
          type: 'email_credentials',
          attributes: { email, password: DATOCMS_ACCOUNT_PASSWORD },
        },
      });

      process.env.DATOCMS_SESSION_ID = session.data.id;

      return buildTestDashboardClient(extraConfig);
    } catch (error) {
      if (error instanceof ApiError && error.findError('RATE_LIMIT_EXCEEDED')) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Account pool exhausted: every account is rate-limited.');
}

/**
 * A fresh, empty project to import into, and the CMA token for it.
 *
 * The caller is responsible for destroying it — see `destroyTestSite`. That
 * matters now in a way it didn't before: the project used to live in an account
 * created for that one run and never looked at again, and now it lives in an
 * account the whole suite shares.
 */
export async function createTestSite(dashboardClient: Client, name: string) {
  const site = await dashboardClient.sites.create({ name });

  console.log(`Project: https://${site.internal_subdomain}.admin.datocms.com/`);

  return site;
}

export async function destroyTestSite(
  dashboardClient: Client,
  siteId: string | undefined,
) {
  if (!siteId) return;

  try {
    await dashboardClient.sites.destroy(siteId);
  } catch (error) {
    // Leaving a project behind must not turn a passing suite red. Say so and
    // move on — the account is a shared one, so someone will want to know.
    console.warn(`Could not delete the test project ${siteId}:`, error);
  }
}

function shuffle<T>(source: T[]): T[] {
  const array = [...source];

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }

  return array;
}
