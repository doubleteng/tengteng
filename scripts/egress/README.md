# Egress + Site Lab — Apps Script

Deployed project: https://script.google.com/home/projects/1OdUpP6jJHMNdfs52rNbvoqtX4w7v9E-Jk5Wlul7qfYSh3JjEn7Wa1_Mr/edit

Web app: https://script.google.com/macros/s/AKfycbzPs2uGUfiirZrd5UVjxQgJdyk2cmKZBNTvvHbbIe64_4N9pJWtNu6cJq61E0vg7zU/exec

Version 1 was deployed with **User accessing the web app**, available to **Anyone with a Google account**. Each student authorizes their own account; no student's files are saved in the teacher's Drive. The code creates an Egress + Site Lab folder and a Sheets project index privately for that user. The deployed code is mirrored in Code.gs, Bridge.html and appsscript.json.

## First use

Open the web app directly to review the Google authorization request, then return to the website's Cloud dialog and reconnect. The app has not undergone Google's OAuth verification and can show an unverified-app warning and Google user limits. For a class-wide rollout, complete the appropriate Google verification or Workspace institutional deployment. Do not describe the app as Google-verified. Initial owner authorization and live save/load testing remain outstanding until the owner approves access.

DriveApp and SpreadsheetApp require Drive and Sheets scopes. The implementation restricts reads/writes to the current user's indexed projects in the application folder, and offers no delete or sharing operation. These code restrictions do not reduce the scope granted by Google's consent screen. Students may use local saving without Google authorization.

## Updating

1. Open the linked Apps Script editor and replace Code.gs, Bridge.html and the manifest with this directory's files.
2. Save; Deploy → Manage deployments → edit → New version → Deploy. Preserve **User accessing the web app**.
3. Keep the existing deployment URL. If creating a new deployment, update `teaching/egress/cloud-config.json` and publish the frontend.
4. Test save, list and reload from https://teng-teng.org/teaching/egress/ using a test design.

The iframe bridge accepts messages only from https://teng-teng.org, verifies the source window and random session nonce, and correlates requests. UserProperties and a user-scoped lock isolate storage. Filenames are IDs rather than untrusted titles; Sheets titles are escaped to prevent formula injection. Loading/updating a project verifies its Drive parent. Payloads are limited to 4 million JSON characters. Avoid large embedded image references when using cloud storage; download them as local project files instead.
