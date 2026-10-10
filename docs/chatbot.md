# Ask about Teng

Status: implemented for Google Gemini; not connected or enabled in production.

The portfolio remains on GitHub Pages. An independent Cloudflare Worker calls Gemini 3.8 Flash through the Interactions API and File Search. No website content is rewritten. The pending GitHub-login backend is a separate service and is not required for public chat.

## Visitor experience

- Bottom-right button, opened by the visitor; English interface with English/Chinese answers.
- Project-page context, four recent messages, questions up to 1,200 characters.
- Citations resolve to allowlisted portfolio pages. An answer without a recognized file citation becomes an explicit insufficient-information response.
- Answers are plain text, never executable HTML. The model cannot edit the site or call other APIs.
- Conversation stays in page memory and clears on navigation/reload. No chat messages are stored in the repository or D1; Gemini receives the question and recent context with `store: false`. Google's service-level retention and processing terms still apply.

## Knowledge

`/chatbot/manifest.json` lists About, Research, Publications, Computational Tools, Contact and projects explicitly marked `published: true`. A project's `chatbot: false` omits its individual page; its already-public mentions in aggregate pages may still be indexed. Do not use this flag as a privacy boundary for publicly published content.

`npm run sync:chatbot` downloads only those pages from `https://teng-teng.org`, extracts the main readable content, and removes scripts, embeds, forms and hidden content. It does not read private conversations, Google Drive, drafts, raw YAML, source comments, or paper PDFs. A failed page fetch stops activation rather than silently dropping that page.

Unchanged content makes no Gemini indexing calls. Changed content is indexed into a new store; the old complete catalog remains active until every upload succeeds. Activation uses a compare-and-swap revision check. One previous catalog is retained. Older stores are deleted only when owned by this integration and older than one hour. Failed staging stores can be inspected and removed manually in the same Google project; never delete the current or previous store.

The workflow runs after a successful Pages build, manually, and every 30 minutes as a fallback. Scheduled GitHub jobs may be delayed; this is eventual synchronization, not instantaneous. During synchronization the previous published snapshot remains available. Removing information from the website is not an immediate deletion from Google's stored index; run sync and verify the new catalog before relying on its removal.

## Account and deployment setup

No real API key, Cloudflare account, D1 database or Gemini store has been created by this change. No real Gemini answer quality or response time has been measured yet.

1. Use a Google AI Studio / Google Cloud project with Gemini API access. Use a dedicated project/key for this portfolio, with the appropriate API restriction and billing/quota settings. Do not paste keys into chat or commit them to GitHub. The existing Structure Coach key is not copied or reused.
2. In the intended Cloudflare account, create an empty Worker named `teng-portfolio-chat`, then authenticate Wrangler and run:

   ```sh
   npm ci
   npx wrangler login
   npx wrangler d1 create teng-portfolio-chat --binding CHAT_DB --update-config --config scripts/chatbot/wrangler.jsonc
   npm run migrate:chatbot
   npx wrangler secret put GEMINI_API_KEY --config scripts/chatbot/wrangler.jsonc
   npx wrangler secret put SYNC_TOKEN --config scripts/chatbot/wrangler.jsonc
   npx wrangler secret put RATE_LIMIT_SECRET --config scripts/chatbot/wrangler.jsonc
   npm run deploy:chatbot
   ```

   Enter secrets in the hidden prompts. `SYNC_TOKEN` and `RATE_LIMIT_SECRET` must be separate randomly generated secrets of at least 32 characters. This database contains only source mappings and expiring quota counters. Worker logging is disabled to avoid logging visitor questions or credentials.

3. Publish the source change with `_data/chatbot.yml` still disabled. That makes the public source manifest available without displaying a nonfunctional widget.
4. In this repository's Actions settings, add the secrets `GEMINI_API_KEY` and `CHAT_SYNC_TOKEN` (same value as the Worker `SYNC_TOKEN`), and the variable `CHAT_BACKEND_URL` (the deployed HTTPS origin, without `/chat`). Run the “Sync published portfolio to Gemini” workflow. The first successful run establishes the knowledge catalog.
5. Run `node scripts/chatbot/activate.mjs https://YOUR-DEPLOYED-ORIGIN` from the repository. This makes real English/Chinese Gemini calls and enables the frontend only if they return recognized sources. Review accuracy and live desktop/mobile behavior before committing the enabled configuration.

Neither Gemini credentials nor the sync token appear in the public frontend. CORS allows only the two portfolio origins, but CORS alone is not authentication: automated clients can spoof Origin. D1 enforces global limits independently of that header.

## Cost and abuse controls

Default limits: 6 requests/minute/IP, 40/day/IP, 200/day total and 3,000/month total; at most 1,800 output tokens per call, low thinking, 30-second provider timeout. Counts are atomic and include failed attempts. Limits are request caps, not an exact dollar spending ceiling. File indexing can incur additional costs. Adjust the named Worker variables deliberately after usage is known; set `CHAT_ENABLED=false` for an immediate backend kill switch. Set `enabled: false` in `_data/chatbot.yml` to hide the widget on the next site build.

Visitor IPs are hashed with a server secret and a daily salt; only those pseudonymous quota keys are retained, with scheduled expiry cleanup. Persistent raw IPs and chat logs are not stored by this application. Hosting/provider infrastructure has its own data policies.

## Validation

Implemented checks passed: 18 chatbot tests; 57 existing page-rendering, homepage-sort and motion checks; a Worker dry-run build; actual local Worker/D1 activation and access checks. The real Liquid templates rendered all 43 published project pages, and the manifest contains 48 public pages. Browser screenshot/mobile visual review could not run in this environment because the browser could not reach the local preview. Gemini requests in automated tests are mocked; production credentials, real model quality and latency remain unverified.

```sh
npm run test:chatbot
npm run check:chatbot
```

Before enabling: check English and Chinese follow-ups, Scutoid's project role, unsupported private/future questions, prompt-injection attempts, quota exhaustion, source links, keyboard interaction, mobile layout, and a publish/sync cycle that removes an outdated fact. A recognized citation proves source identity, not that every generated sentence is entailed; factual quality still needs real-model review.

Official references: [Gemini Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview), [File Search](https://ai.google.dev/gemini-api/docs/file-search), [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
