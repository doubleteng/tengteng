# Egress + Site Lab — Apps Script

Deployed project: https://script.google.com/home/projects/1OdUpP6jJHMNdfs52rNbvoqtX4w7v9E-Jk5Wlul7qfYSh3JjEn7Wa1_Mr/edit

Web app: https://script.google.com/macros/s/AKfycbzPs2uGUfiirZrd5UVjxQgJdyk2cmKZBNTvvHbbIe64_4N9pJWtNu6cJq61E0vg7zU/exec

The deployment runs with **User accessing the web app**, available to **Anyone with a Google account**. Each student authorizes their own account; no student's files are saved in the teacher's Drive. The code creates an Egress + Site Lab folder and a Sheets project index privately for that user. The deployed code is mirrored in Code.gs, Bridge.html and appsscript.json.

## First use

Choose Cloud → Connect Google in the website. Review the Google authorization request in the separate connection window, then leave that window open and return to the design tab. This avoids dependence on third-party Google login cookies. The app has not undergone Google's OAuth verification and can show an unverified-app warning and Google user limits. For a class-wide rollout, complete the appropriate Google verification or Workspace institutional deployment. Do not describe the app as Google-verified. The owner has approved the initial Google authorization. Each other account must grant its own authorization.

DriveApp and SpreadsheetApp require Drive and Sheets scopes. The implementation restricts reads/writes to the current user's indexed projects in the application folder, and offers no delete or sharing operation. These code restrictions do not reduce the scope granted by Google's consent screen. Students may use local saving without Google authorization.

## Updating

1. Open the linked Apps Script editor and replace Code.gs, Bridge.html and the manifest with this directory's files.
2. Save; Deploy → Manage deployments → edit → New version → Deploy. Preserve **User accessing the web app**.
3. Keep the existing deployment URL. If creating a new deployment, update `teaching/egress/cloud-config.json` and publish the frontend.
4. Test save, list and reload from https://teng-teng.org/teaching/egress/ using a test design.

The popup bridge accepts messages only from https://teng-teng.org, verifies the source window and random session nonce, and correlates requests. The frontend discovers the popup's nested window identities using standard Window references, then pins the connected Google origin and source. Discovery messages contain only a nonce, never project data. Save/load payloads use an exact target origin. UserProperties and a user-scoped lock isolate storage. Filenames are IDs rather than untrusted titles; Sheets titles are escaped to prevent formula injection. Loading/updating a project verifies its Drive parent. Payloads are limited to 4 million JSON characters. Avoid large embedded image references when using cloud storage; download them as local project files instead.

## Vision backend update

Add `Vision.gs` beside `Code.gs`, or concatenate its contents after Code.gs in the editor. Do not do both. Update Bridge.html and the manifest, including `script.external_request`. Publish a new version of the existing deployment, preserving USER_ACCESSING and its URL.

The Google connection page includes **AI plan recognition**. The signed-in user enters their Gemini API key there; the backend stores it in that user's UserProperties. The public app can ask only for configured status and recognition, never retrieve or change the key. API endpoint is fixed to Google, with no model tool execution. Payload max 6 million data-URL characters; incomplete or invalid model responses are rejected. No API credential has been supplied or included in this repository. The deployed source may be ready while recognition itself remains unavailable until configured.

Model and request format checked against Google's official image-understanding and structured-output docs on 2026-10-30:
- https://ai.google.dev/gemini-api/docs/image-understanding
- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
