import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve,dirname } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!existsSync(resolve(root,'runtime/dupes/feedback/src/node.ts'))||!existsSync(resolve(root,'runtime/dupes/forms/src/node.ts'))||!existsSync(resolve(root,'runtime/LICENSE')))throw Error('Prepare the complete release from the repository root with npm run release:prepare before packing or publishing.');
