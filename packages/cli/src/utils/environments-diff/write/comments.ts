import * as ts from 'typescript';
import type { LogCommand } from '../types';

export function buildLogNode(comment: LogCommand): ts.Node {
  return ts.factory.createCallExpression(
    ts.factory.createIdentifier('console.log'),
    undefined,
    [ts.factory.createStringLiteral(comment.message)],
  );
}
