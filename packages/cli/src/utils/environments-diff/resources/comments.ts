import type { LogCommand } from '../types';

export function buildLog(message: string): LogCommand {
  return { type: 'log', message };
}
