import { createClient, ClientAPI, Environment } from 'contentful-management';

type ContentfulClientType = {
  contentfulToken: string | undefined;
  contentfulSpaceId: string | undefined;
  contentfulEnvironment: string | undefined;
};

export async function cfEnvironmentApi({
  contentfulToken,
  contentfulSpaceId,
  contentfulEnvironment = 'master',
}: ContentfulClientType): Promise<Environment> {
  if (!contentfulToken || !contentfulSpaceId) {
    throw new Error(
      `You need to provide a read-only Contentful API token and a Contentful space ID!`,
    );
  }

  const contentfulClient: ClientAPI = createClient({
    accessToken: contentfulToken,
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
