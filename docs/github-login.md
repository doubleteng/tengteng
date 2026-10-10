# GitHub login for Content Studio

Status: implemented and locally tested; **not activated** until the Worker is deployed and the owner completes GitHub App registration/installation. The existing GitHub Pages editor remains available during setup. Do not describe the public `/admin/` as protected before the final cutover.

## Hosting

GitHub Pages cannot run the OAuth code exchange or protect secrets. This package serves the same editor and its APIs together on one Cloudflare Worker origin. The portfolio stays on GitHub Pages. First-party cookies avoid cross-site cookie dependence, and every editor asset is checked by the Worker before serving it.

Requirements: a Cloudflare account with Workers and D1, Node 24+, and the owner's `doubleteng` GitHub account. No personal access token is required by the new editor. Never paste GitHub secrets, Cloudflare tokens, or session keys into chat or commit them.

## First deployment

First create an empty Worker named `teng-content-studio` in the intended Cloudflare account (Workers & Pages → Create application). This establishes the account-owned Worker before attaching secrets. Then run from this repository's root on a trusted computer. Review the resources and account shown by Wrangler before approving its browser login or resource creation.

```sh
npm ci
npx wrangler login
npm run build:secure-admin
npx wrangler d1 create teng-content-studio-auth --binding DB --update-config --config scripts/admin-auth/wrangler.jsonc
npm run migrate:secure-admin
```

The D1 command writes the new database ID to the config. If this database already exists, use its existing ID; do not create another one. The ID is configuration, not a secret.

Generate the encryption key directly into Wrangler's secret input, without displaying it:

```sh
node scripts/admin-auth/create-session-key.mjs
npm run deploy:secure-admin
```

The key helper refuses to replace an existing `SESSION_SECRET`. It receives a random 256-bit value over stdin. The helper does not print or save that value. Preserve the key: rotating it makes existing encrypted GitHub App settings unreadable.

Use the HTTPS Worker URL returned by deployment. Before configuring GitHub, choose the permanent origin (either that Workers address or a custom domain). Set `vars.ADMIN_ORIGIN` in `scripts/admin-auth/wrangler.jsonc` to that exact origin and redeploy. Do not add a trailing slash. No DNS change to the portfolio is necessary when using the Worker address.

## Owner setup: no copying GitHub credentials

1. Open the deployed URL. Choose **开始配置 GitHub 登录**, then **在 GitHub 创建应用**.
2. Sign in to GitHub as `doubleteng`. Review and create the private GitHub App. It requests repository Contents read/write and no events/webhooks.
3. After returning, choose **选择 tengteng 仓库**. In GitHub use **Only select repositories → tengteng** and approve installation.
4. Return and choose **使用 GitHub 登录**. GitHub App user authorization is a separate approval from installation.

The registration callback checks immutable GitHub owner ID `54260562` before saving app credentials. It encrypts the client secret into D1; it discards the unused GitHub App private key and webhook secret. Login exchanges codes server-side with PKCE, verifies that same user ID, and confirms write access to repository ID `1075654318` (`doubleteng/tengteng`). The user access token request is further restricted to that repository ID.

## Verification before changing the existing entry point

- Open `/admin/`, `/assets/admin/studio.js`, and `/api/session` in a signed-out browser. The editor/assets must redirect to login; the API must return 401.
- Complete real GitHub login as the owner. Check title editing, image selection, inline editing, and preview before publishing anything. Local text drafts should survive refresh on this origin.
- Check a different GitHub account is refused. Then log out and confirm a captured old session cannot reopen the editor or call the API.
- Publish a deliberate small content change only after reviewing its diff. Confirm the resulting commit touches only the selected file (and explicitly added assets).
- Make a concurrent edit through another client and confirm a stale draft stops with a conflict.

Local mocked OAuth/API tests cover these authorization and conflict boundaries, but cannot substitute for the real GitHub consent and installation checks above.

After those checks, run `node scripts/admin-auth/activate.mjs https://YOUR-DEPLOYED-ORIGIN` and review/commit the resulting `admin/index.html` redirect. The helper checks the deployed login entry and signed-out access boundaries before changing the entry point. The secure build reads its own `scripts/admin-auth/editor.html`, so the redirect cannot accidentally be packaged as the editor. Keep the existing fallback assets during the change. Existing local drafts belong to the old origin: export/import any unfinished drafts before cutover. Repository content does not need migration.

## Security and operation

- Sessions live in D1, with only a random opaque ID in a `__Host-` Secure, HttpOnly, SameSite=Lax cookie. D1 stores its SHA-256 hash, not the cookie value. No GitHub token is returned by a browser API.
- Tokens and app credentials use AES-256-GCM encryption with purpose-bound authentication data and a random IV. The encryption key is a Worker secret, separate from D1.
- OAuth state is bound to a second HttpOnly browser cookie, expires after ten minutes, and is atomically consumed once. PKCE uses S256.
- Sessions last at most two hours and expire after thirty minutes without server interaction. Logout deletes the database session. No long-lived refresh token is stored.
- POST operations require an exact Origin match and a per-session CSRF token. No CORS credentials or cross-origin write endpoint is exposed.
- Publishing rechecks GitHub identity and repository permission, validates source and upload paths, checks the original file SHA, and updates `main` with `force:false`. There is no arbitrary GitHub write proxy.
- The secure service accepts at most eight newly uploaded files and 20 MB total per publish. It accepts only the existing content path allowlist and supported media types; templates, scripts, workflows and existing assets cannot be overwritten through its publishing endpoint.
- Responses are `no-store`; browser access is HTTPS-only. A nonce-based script CSP preserves the existing sandboxed preview bridge. No raw request/token/error payload is logged by application code; Worker observability is disabled so OAuth callback query strings are not captured in routine request logs.
- The local-draft export/import/undo model and lossless YAML editing are unchanged. Logout optionally clears local drafts for shared devices.

To revoke all editor sessions, delete rows in `studio_sessions`. To revoke access at GitHub, uninstall or revoke authorization for the dedicated GitHub App. Changing GitHub permissions is checked again before every publish. To replace the app registration, first revoke the previous app, clear sessions and the `github` row from `studio_settings`, then repeat owner setup. Do not rotate the encryption key merely to redeploy.

## Build and tests

```sh
npm run build:secure-admin
npm run check:secure-admin
npm run test:auth
node --test tests/admin-github.test.mjs tests/admin-render.test.mjs
```

The secure build replaces the browser GitHub adapter with a same-origin session adapter. Server code and secrets are outside the static asset directory. `.secure-admin`, local environment files, and Wrangler state are ignored by Git; Jekyll already excludes `scripts`, `tests`, and `docs`.

Later deployments: build, apply any new migrations, and deploy. Keep the same database, origin, encryption key, and GitHub App. The `--keep-vars` deploy option preserves a runtime `ADMIN_ORIGIN` set through the dashboard.

Primary references:

- [GitHub App manifest registration](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
- [GitHub App authorization and PKCE](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Cloudflare Worker-first asset authentication](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare Wrangler secrets](https://developers.cloudflare.com/workers/wrangler/configuration/#secrets)
