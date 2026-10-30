# Instructor-funded plan recognition

Students use the public design lab without Google sign-in, a personal API key or Drive storage. The instructor's Gemini key lives only in Apps Script Script Properties. The browser sends a plan image when the student explicitly starts recognition; projects and PDF reports remain on the student's device.

## Deployment

Use the existing Apps Script project, retaining old deployment versions only for rollback. Replace Code.gs with this directory's Code.gs followed by Vision.gs, replace Bridge.html, and apply appsscript.json. There must be no additional public functions, Drive/Sheets helpers, credential forms or old code files in the deployed version.

For migration, run `initializeInstructorVision_()` once from an editor-only temporary wrapper, then remove that wrapper before deployment. It copies the instructor's previously saved UserProperties key/model internally into Script Properties; it never returns the key. Alternatively the owner can configure Script Properties directly. Required properties: VISION_API_KEY, VISION_MODEL, VISION_SESSION_SECRET. Never paste any property values into source control or the frontend.

Create a new Web app deployment with **Execute as: Me** and **Who has access: Anyone** (including anonymous users). Only the external_request OAuth scope is needed. Point `teaching/egress/vision-config.json` to its /exec URL. The GitHub Pages site embeds the bridge automatically on recognition; no login popup is opened.

Only `doGet` and `visionCall` are public. All administration and helpers end with an underscore, so google.script.run cannot call them. The server fixes the provider URL, prompt and model; callers cannot request arbitrary network calls, storage actions or credential changes. Parent/bridge messages pin the origin, frame identity, nonce and request ID. Session tokens are signed and expire after six hours.

Default limits: 120 recognition attempts per UTC day across the entire service, three simultaneous requests, and 12 attempts per signed browser session. Global admission uses a short ScriptLock; the lock is released before calling Gemini. Failed requests count toward the daily cap. Leases expire after seven minutes if execution is interrupted. The per-session cache is a secondary throttle, not a claim of user identity; anonymous users can open new sessions, while the global cap remains enforced. The owner can set VISION_DAILY_LIMIT (1–1000) and VISION_MAX_CONCURRENT (1–10) privately. Gemini billing and provider quotas still apply.

The service stores only its private configuration and usage counters, not student plan images, projects or reports. Model output is validated again by the browser before any geometry is accepted. Doors and entrances remain proposals requiring confirmation.

## Official references

- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/html/communication#private_functions
- https://developers.google.com/apps-script/manifest/web-app-api-executable
