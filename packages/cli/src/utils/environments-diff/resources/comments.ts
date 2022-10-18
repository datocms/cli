import { Comment } from '../types';

export function buildComment(message: string): Comment {
  return { type: 'comment', message };
}
