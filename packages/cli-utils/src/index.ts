import dotenv from 'dotenv';

// Load .env.local and .env (local values take precedence)
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

export * as CmaClient from '@datocms/cma-client-node';
export * as oclif from '@oclif/core';
export * from './base-command';
export * from './cma-client-command';
export * from './config';
export * from './credentials';
export * from './dato-config-command';
export * from './dato-profile-config-command';
export * from './fuzzyScore';
export * from './oauth';
export * from './schema-info';
