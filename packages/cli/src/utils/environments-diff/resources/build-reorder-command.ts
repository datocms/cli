import { isEqual } from 'lodash';
import { buildLog } from './comments';

type ReorderableEntity<EntityType extends string> = {
  id: string;
  type: EntityType;
  /**
   * JSON API attributes
   */
  attributes: {
    /**
     * Ordering index
     */
    position: number;
  };
  relationships: {
    /**
     * Parent menu item
     */
    parent: {
      data: null | {
        id: string;
        type: EntityType;
      };
    };
  };
};

type SingleReorderCommand<EntityType extends string> = {
  id: string;
  type: EntityType;
  /**
   * JSON API attributes
   */
  attributes: {
    /**
     * Ordering index
     */
    position: number;
  };
  relationships: {
    /**
     * Parent menu item
     */
    parent: {
      data: null | {
        id: string;
        type: EntityType;
      };
    };
  };
};

export function buildReorderCommand<
  T extends string,
  Command extends {
    type: 'apiCallClientCommand';
    call: string;
    arguments: [{ data: SingleReorderCommand<T>[] }];
  },
>(
  call: Command['call'],
  keptEntities: [ReorderableEntity<T>, ReorderableEntity<T>][],
  newEntities: ReorderableEntity<T>[],
) {
  const commands: SingleReorderCommand<T>[] = [
    ...newEntities,
    ...keptEntities
      .filter(
        ([newEntity, oldEntity]) =>
          !isEqual(
            newEntity.attributes.position,
            oldEntity.attributes.position,
          ) ||
          !isEqual(
            newEntity.relationships.parent.data?.id,
            oldEntity.relationships.parent.data?.id,
          ),
      )
      .map((tuple) => tuple[0]),
  ].map((entity) => ({
    id: entity.id,
    type: entity.type,
    attributes: { position: entity.attributes.position },
    relationships: {
      parent: {
        data: entity.relationships.parent.data?.id
          ? {
              id: entity.relationships.parent.data.id,
              type: entity.type,
            }
          : null,
      },
    },
  }));

  if (commands.length === 0) {
    return [];
  }

  return [
    buildLog('Reorder elements in the tree'),
    {
      type: 'apiCallClientCommand',
      call,
      arguments: [
        {
          data: commands,
        },
      ],
    },
  ] as Command[];
}
