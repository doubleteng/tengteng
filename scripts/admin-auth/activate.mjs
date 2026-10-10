import fs from 'node:fs';
import { verifyAnonymous } from './deploy-ci.mjs';
const value = process.argv[2];
if (!value) throw new Error('Provide the verified HTTPS origin of the authenticated editor.');
const origin = new URL(value);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.hostname === 'teng-teng.org') throw new Error('Expected a separate HTTPS origin, with no path or credentials.');
await verifyAnonymous(origin.origin);
fs.writeFileSync('admin/index.html',fs.readFileSync('scripts/admin-auth/entry.html','utf8').replaceAll('__STUDIO_ORIGIN__',origin.origin));
console.log('Prepared login-only admin entry: ' + origin.origin + '/admin/. Owner consent may still be required.');
