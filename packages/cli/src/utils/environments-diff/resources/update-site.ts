import type { CmaClient } from '@datocms/cli-utils';
import { isEqual, omit, pick } from 'lodash';
import type { Command, Schema } from '../types';
import { buildComment } from './comments';

export function updateSite(newSchema: Schema, oldSchema: Schema): Command[] {
  const newSite = newSchema.siteEntity;
  const oldSite = oldSchema.siteEntity;

  const attributesToUpdate = omit(
    pick(
      newSite.attributes,
      (
        Object.keys(newSite.attributes) as Array<
          keyof CmaClient.RawApiTypes.SiteAttributes
        >
      ).filter(
        (attribute) =>
          !isEqual(
            oldSite.attributes[attribute],
            newSite.attributes[attribute],
          ),
      ),
    ),
    'last_data_change_at',
    'global_seo',
    'theme',
  );

  if (Object.keys(attributesToUpdate).length === 0) {
    return [];
  }

  return [
    buildComment(`Update environment's settings`),
    {
      type: 'apiCallClientCommand',
      call: 'client.site.update',
      arguments: [
        {
          data: {
            type: 'site',
            id: newSite.id,
            attributes: attributesToUpdate,
          },
        },
      ],
    },
  ];
}
