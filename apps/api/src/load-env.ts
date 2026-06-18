import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(currentDir, '..');
const repoRoot = path.resolve(apiRoot, '../..');

// Monorepo: .env at repo root (primary), optional apps/api/.env override
dotenv.config({ path: path.join(repoRoot, '.env'), override: true });
dotenv.config({ path: path.join(apiRoot, '.env'), override: true });

export function ensureDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to the repo root as .env and start PostgreSQL (npm run docker:up).',
    );
  }
  return url;
}
