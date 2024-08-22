import {
  CmaClient,
  type LogLevelFlagEnum,
  logLevelMap,
} from '@datocms/cli-utils';
import {
  type ClientAPI,
  type Environment,
  createClient,
} from 'contentful-management';

type ContentfulClientType = {
  contentfulToken: string | undefined;
  contentfulSpaceId: string | undefined;
  contentfulEnvironment: string | undefined;
  logLevel?: LogLevelFlagEnum;
  logFn?: (message: string) => void;
};

let requestCount = 1;

export async function cfEnvironmentApi({
  contentfulToken,
  contentfulSpaceId,
  contentfulEnvironment = 'master',
  logLevel: logLevelString = 'NONE',
  logFn: log = () => true,
}: ContentfulClientType): Promise<Environment> {
  if (!(contentfulToken && contentfulSpaceId)) {
    throw new Error(
      'You need to provide a read-only Contentful API token and a Contentful space ID!',
    );
  }

  const logLevel = logLevelMap[logLevelString];

  const contentfulClient: ClientAPI = createClient({
    accessToken: contentfulToken,
    onBeforeRequest: (requestConfig) => {
      const requestId = `CF${requestCount}`;

      requestCount += 1;

      return { ...requestConfig, __requestId: requestId };
    },

    responseLogger: (response) => {
      if (response instanceof Error) {
        return;
      }

      const { config: request, status, statusText } = response;
      const {
        url,
        method,
        __requestId: requestId,
      } = request as typeof request & {
        __requestId?: number;
      };

      if (logLevel >= CmaClient.LogLevel.BASIC) {
        log(`[${requestId}] ${method?.toUpperCase()} ${url}`);
        if (logLevel >= CmaClient.LogLevel.BODY_AND_HEADERS) {
          for (const [key, value] of Object.entries(request.headers || {})) {
            log(`[${requestId}] ${key}: ${value}`);
          }
        }
        if (logLevel >= CmaClient.LogLevel.BODY && request.data) {
          log(`[${requestId}] ${JSON.stringify(request.data, null, 2)}`);
        }
      }

      if (logLevel >= CmaClient.LogLevel.BASIC) {
        log(`[${requestId}] Status: ${status} (${statusText})`);
        if (logLevel >= CmaClient.LogLevel.BODY_AND_HEADERS) {
          for (const [key, value] of Object.entries(response.headers || {})) {
            log(`[${requestId}] ${key}: ${value}`);
          }
        }
        if (logLevel >= CmaClient.LogLevel.BODY && response.data) {
          log(`[${requestId}] ${JSON.stringify(response.data, null, 2)}`);
        }
      }
    },
  });

  const contentful = await contentfulClient.getSpace(contentfulSpaceId);
  const environments = await contentful.getEnvironments();
  const environment = environments.items.find(
    (e) => e.name === contentfulEnvironment,
  );

  if (!environment) {
    throw new Error(
      `Could not find environment named "${contentfulEnvironment}"!`,
    );
  }

  return environment;
}
