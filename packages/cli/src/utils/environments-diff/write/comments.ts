import * as ts from 'typescript';
import { Comment } from '../types';

export function buildCommentNode(comment: Comment): ts.Node {
  return ts.factory.createCallExpression(
    ts.factory.createIdentifier('console.log'),
    undefined,
    [ts.factory.createStringLiteral(comment.message)],
  );
}
