// Explicit first-time provisioning command. Never run for routine deployment.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const config = 'scripts/admin-auth/wrangler.jsonc';
const executable = process.execPath, wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const env = { ...process.env, WRANGLER_SEND_METRICS:'false' };
const check = spawnSync(executable, [wrangler,'secret','list','--config',config], {encoding:'utf8',env});
if (check.status !== 0) {
  // A missing Worker must be reviewed/created explicitly; don't infer absence
  // from an auth/network failure and accidentally replace an existing key.
  console.error('Could not inspect Worker secret names. Run wrangler secret list for this Worker and resolve its account/creation prompt first. No key was generated or changed.');
  process.exit(1);
}
let secrets;
try { secrets = JSON.parse(check.stdout); } catch {
  console.error('Could not confirm the existing secret list. No key was changed.'); process.exit(1);
}
if (!Array.isArray(secrets)) { console.error('Unexpected secret-list response. No key was changed.'); process.exit(1); }
if (secrets.some(value => value.name === 'SESSION_SECRET')) {
  console.log('SESSION_SECRET already exists; preserved unchanged.'); process.exit(0);
}
const result = spawnSync(executable, [wrangler,'secret','bulk','--config',config], {
  input:JSON.stringify({SESSION_SECRET:randomBytes(32).toString('hex')}), stdio:['pipe','inherit','inherit'],env
});
process.exit(result.status ?? 1);
