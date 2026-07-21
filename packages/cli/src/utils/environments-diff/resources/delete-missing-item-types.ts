import { CmaClient } from '@datocms/cli-utils';
import { difference } from 'lodash';
import type { Command, ItemTypeInfo, Schema } from '../types';
import { buildItemTypeTitle } from '../utils';
import { buildComment } from './comments';

export function buildDestroyItemTypeClientCommand(
  itemTypeSchema: ItemTypeInfo,
): Command[] {
  return [
    buildComment(`Delete ${buildItemTypeTitle(itemTypeSchema.entity)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.itemTypes.destroy',
      arguments: [itemTypeSchema.entity.id, { skip_menu_items_deletion: true }],
    },
  ];
}

// The ids of the block models referenced (through modular content, single
// block or structured text fields) by any field of the given item type. A
// field keeps the block it references "in use", so the block cannot be
// destroyed while that field — and the item type owning it — still exist.
function referencedBlockItemTypeIds(itemTypeSchema: ItemTypeInfo): string[] {
  return Object.values(itemTypeSchema.fieldsById).flatMap((field) =>
    CmaClient.blockModelIdsReferencedInField(field),
  );
}

// Orders the item types to be destroyed so that a model/block is always
// destroyed *before* the block models it references through its fields.
// Destroying a block while a still-existing field references it makes the API
// reject the call with MODULAR_BLOCK_IN_USE, so any referrer must go first.
//
// This is a stable topological sort (Kahn's algorithm, breaking ties by the
// original schema order): unrelated deletions keep their previous order, and
// only referenced blocks get deferred after their referrers. Reference cycles
// (which no ordering can resolve on its own) fall back to the original order.
function sortItemTypeIdsForDestruction(
  destroyedItemTypeIds: string[],
  oldSchema: Schema,
): string[] {
  const destroyedSet = new Set(destroyedItemTypeIds);

  // referents.get(x) = block models that must be destroyed *after* x.
  const referents = new Map<string, string[]>(
    destroyedItemTypeIds.map((id) => [id, []]),
  );
  const incomingCount = new Map<string, number>(
    destroyedItemTypeIds.map((id) => [id, 0]),
  );

  for (const itemTypeId of destroyedItemTypeIds) {
    const referencedBlockIds = new Set(
      referencedBlockItemTypeIds(oldSchema.itemTypesById[itemTypeId]).filter(
        (id) => destroyedSet.has(id) && id !== itemTypeId,
      ),
    );

    for (const referencedId of referencedBlockIds) {
      referents.get(itemTypeId)!.push(referencedId);
      incomingCount.set(referencedId, incomingCount.get(referencedId)! + 1);
    }
  }

  const ordered: string[] = [];
  const emitted = new Set<string>();

  while (ordered.length < destroyedItemTypeIds.length) {
    // Emit the earliest item type (in original order) whose referrers have all
    // been emitted already.
    const next = destroyedItemTypeIds.find(
      (id) => !emitted.has(id) && incomingCount.get(id) === 0,
    );

    if (next === undefined) {
      // Only reachable with a reference cycle: emit whatever is left in the
      // original order as a best effort.
      for (const id of destroyedItemTypeIds) {
        if (!emitted.has(id)) {
          emitted.add(id);
          ordered.push(id);
        }
      }
      break;
    }

    emitted.add(next);
    ordered.push(next);

    for (const referencedId of referents.get(next)!) {
      incomingCount.set(referencedId, incomingCount.get(referencedId)! - 1);
    }
  }

  return ordered;
}

export function deleteMissingItemTypes(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const newItemTypeIds = Object.keys(newSchema.itemTypesById);
  const oldItemTypeIds = Object.keys(oldSchema.itemTypesById);

  const destroyedItemTypeIds = difference(oldItemTypeIds, newItemTypeIds);

  if (destroyedItemTypeIds.length === 0) {
    return [];
  }

  const orderedItemTypeIds = sortItemTypeIdsForDestruction(
    destroyedItemTypeIds,
    oldSchema,
  );

  return [
    buildComment('Destroy models/block models'),
    ...orderedItemTypeIds.flatMap((itemTypeId) =>
      buildDestroyItemTypeClientCommand(oldSchema.itemTypesById[itemTypeId]),
    ),
  ];
}
