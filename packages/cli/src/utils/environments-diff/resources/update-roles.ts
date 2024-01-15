import { CmaClient } from '@datocms/cli-utils';
import { differenceWith, isEqual } from 'lodash';
import {
  Command,
  RoleItemTypePermission,
  RoleUploadPermission,
  UpdateRoleClientCommand,
  UpdateRoleDiff,
} from '../types';
import { buildComment } from './comments';

function omitNullProperties<T extends Record<string, unknown>>(
  hash: T,
): Omit<T, 'environment'> {
  return Object.entries(hash).reduce(
    (result, [key, value]) =>
      !value || key === 'environment' ? result : { ...result, [key]: value },
    {} as T,
  );
}

function buildUpdateRoleDiff<T>(
  newData: T[],
  oldData: T[],
): UpdateRoleDiff<T> | undefined {
  const remove = differenceWith(oldData, newData, isEqual);
  const add = differenceWith(newData, oldData, isEqual);

  if (add.length === 0 && remove.length === 0) {
    return undefined;
  }

  return {
    ...(add.length > 0 ? { add } : {}),
    ...(remove.length > 0 ? { remove } : {}),
  };
}

function getEnvItemTypePermissions(
  permissions: CmaClient.SchemaTypes.RoleAttributes['positive_item_type_permissions'],
  newEnvironmentId: string,
  oldEnvironmentId: string,
): UpdateRoleDiff<RoleItemTypePermission> | undefined {
  const newPermissions = permissions
    .filter((rule) => rule.environment === newEnvironmentId)
    .map(omitNullProperties);

  const oldPermissions = permissions
    .filter((rule) => rule.environment === oldEnvironmentId)
    .map(omitNullProperties);

  return buildUpdateRoleDiff(newPermissions, oldPermissions);
}

function getEnvUploadPermissions(
  permissions: CmaClient.SchemaTypes.RoleAttributes['positive_upload_permissions'],
  newEnvironmentId: string,
  oldEnvironmentId: string,
): UpdateRoleDiff<RoleUploadPermission> | undefined {
  const newPermissions = permissions
    .filter((rule) => rule.environment === newEnvironmentId)
    .map(omitNullProperties);

  const oldPermissions = permissions
    .filter((rule) => rule.environment === oldEnvironmentId)
    .map(omitNullProperties);

  return buildUpdateRoleDiff(newPermissions, oldPermissions);
}

export function updateRole(
  role: CmaClient.SchemaTypes.Role,
  newEnvironmentId: string,
  oldEnvironmentId: string,
): Command[] {
  const positiveItemType = getEnvItemTypePermissions(
    role.attributes.positive_item_type_permissions,
    newEnvironmentId,
    oldEnvironmentId,
  );

  const negativeItemType = getEnvItemTypePermissions(
    role.attributes.negative_item_type_permissions,
    newEnvironmentId,
    oldEnvironmentId,
  );

  const positiveUpload = getEnvUploadPermissions(
    role.attributes.positive_upload_permissions,
    newEnvironmentId,
    oldEnvironmentId,
  );

  const negativeUpload = getEnvUploadPermissions(
    role.attributes.negative_upload_permissions,
    newEnvironmentId,
    oldEnvironmentId,
  );

  if (
    !(positiveItemType || negativeItemType || positiveUpload || negativeUpload)
  ) {
    return [];
  }

  const command: UpdateRoleClientCommand = {
    type: 'apiCallClientCommand',
    call: 'client.roles.updateCurrentEnvironmentPermissions',
    roleId: role.id,
    changes: {
      ...(positiveItemType
        ? { positive_item_type_permissions: positiveItemType }
        : {}),
      ...(negativeItemType
        ? { negative_item_type_permissions: negativeItemType }
        : {}),
      ...(positiveUpload
        ? { positive_upload_permissions: positiveUpload }
        : {}),
      ...(negativeUpload
        ? { negative_upload_permissions: negativeUpload }
        : {}),
    },
  };

  return [
    buildComment(
      `Update permissions for environment in role ${role.attributes.name}`,
    ),
    command,
  ];
}

export function updateRoles(
  roles: CmaClient.SchemaTypes.Role[],
  newEnvironmentId: string,
  oldEnvironmentId: string,
): Command[] {
  return roles.flatMap((role) =>
    updateRole(role, newEnvironmentId, oldEnvironmentId),
  );
}
