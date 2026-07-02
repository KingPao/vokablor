import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

const testEnvPath = path.resolve(import.meta.dirname, '../.env.test');
config({ path: existsSync(testEnvPath) ? testEnvPath : path.resolve(import.meta.dirname, '../.env') });
