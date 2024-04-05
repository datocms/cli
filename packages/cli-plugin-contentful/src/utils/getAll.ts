import type { BasicQueryOptions, Collection } from 'contentful-management';

export async function getAll<Resource, ResourceProps>(
  fn: (
    query: BasicQueryOptions,
  ) => Promise<Collection<Resource, ResourceProps>>,
): Promise<Resource[]> {
  let allResources: Resource[] = [];

  const startRequest = await fn({ limit: 1, skip: allResources.length });
  const { total } = startRequest;

  while (allResources.length < total) {
    const result = await fn({ limit: 100, skip: allResources.length });
    allResources = [...allResources, ...result.items];
  }

  return allResources;
}
