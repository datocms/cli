import { CmaClient } from '@datocms/cli-utils';
import { difference, intersection, isEqual, pick } from 'lodash';
import { Command, Schema } from '../types';
import { buildWorkflowTitle, isBase64Id } from '../utils';
import { buildComment } from './comments';

function buildCreateWorkflowClientCommand(
  workflow: CmaClient.SchemaTypes.Workflow,
): Command[] {
  return [
    buildComment(`Create ${buildWorkflowTitle(workflow)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.workflows.create',
      arguments: [
        {
          data: {
            type: 'workflow',
            id: isBase64Id(workflow.id) ? workflow.id : undefined,
            attributes: workflow.attributes,
          },
        },
      ],
      oldEnvironmentId: workflow.id,
    },
  ];
}

function buildDestroyWorkflowClientCommand(
  workflow: CmaClient.SchemaTypes.Workflow,
): Command[] {
  return [
    buildComment(`Delete ${buildWorkflowTitle(workflow)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.workflows.destroy',
      arguments: [workflow.id],
    },
  ];
}

function buildUpdateWorkflowClientCommand(
  newWorkflow: CmaClient.SchemaTypes.Workflow,
  oldWorkflow: CmaClient.SchemaTypes.Workflow,
): Command[] {
  const attributesToUpdate = pick(
    newWorkflow.attributes,
    (
      Object.keys(newWorkflow.attributes) as Array<
        keyof CmaClient.SchemaTypes.WorkflowAttributes
      >
    ).filter(
      (attribute) =>
        !isEqual(
          oldWorkflow.attributes[attribute],
          newWorkflow.attributes[attribute],
        ),
    ),
  );

  if (Object.keys(attributesToUpdate).length === 0) {
    return [];
  }

  return [
    buildComment(`Update ${buildWorkflowTitle(newWorkflow)}`),
    {
      type: 'apiCallClientCommand',
      call: 'client.workflows.update',
      arguments: [
        oldWorkflow.id,
        {
          data: {
            type: 'workflow',
            id: newWorkflow.id,
            attributes: attributesToUpdate,
          },
        },
      ],
    },
  ];
}

export function manageWorkflows(
  newSchema: Schema,
  oldSchema: Schema,
): Command[] {
  const oldEntityIds = Object.keys(oldSchema.workflowsById);
  const newEntityIds = Object.keys(newSchema.workflowsById);

  const keptEntityIds = intersection(oldEntityIds, newEntityIds);

  const deletedEntities = difference(oldEntityIds, newEntityIds).map(
    (workflowId) => oldSchema.workflowsById[workflowId],
  );

  const createdEntities = difference(newEntityIds, oldEntityIds).map(
    (workflowId) => newSchema.workflowsById[workflowId],
  );

  const commands: Command[] = [
    ...deletedEntities.flatMap(buildDestroyWorkflowClientCommand),
    ...createdEntities.flatMap(buildCreateWorkflowClientCommand),
    ...keptEntityIds.flatMap((workflowId) =>
      buildUpdateWorkflowClientCommand(
        newSchema.workflowsById[workflowId],
        oldSchema.workflowsById[workflowId],
      ),
    ),
  ];

  if (commands.length === 0) {
    return [];
  }

  return [buildComment('Manage workflows'), ...commands];
}
