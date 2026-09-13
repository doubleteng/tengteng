---
title: User guide
---
# Portfolio user guide

## Choose your interface language

Expand **English** or **中文** in the sidebar, then open a content section. Both menus edit the same projects, images, and profile. Switching languages does not duplicate or translate website content. Save your current edits before switching. Pages CMS system buttons, including Save and Settings, remain in English.

## Add or update a project

1. Open **Projects** and create a record, or select an existing project.
2. Enter the title, category, year, short description, project type, and stage. Use a short English filename and keep it stable after publication.
3. Upload a cover image and describe it in the image-description field.
4. Write the project context, your contribution, methods, and results in **Project description**.
5. Add **Content blocks** for text, individual images, galleries, video, or downloads. Arrange them in the order you want on the page.
6. Add team members, credits, institutions, and relevant publications. Credit students for their designs and collaborators for their specific roles.
7. Keep **Publish on website** off while preparing the record. Turn it on and save when ready to publish.

One project record updates its category page, All Work, and its detail page. Enable **Feature on homepage** to include it among the selected projects. Lower homepage-order numbers appear first.

Original project URLs are preserved. New projects use `/projects/filename/`. A title can change without changing the filename or URL.

## Images and files

Upload directly through a cover, image, or gallery field, or use the shared **Images / 图片素材** menu. Galleries accept multiple images and support one, two, or three columns. Use individual image blocks when captions or credits differ.

Use JPG or WebP images around 2,000 pixels on their longest side and preferably under 2 MB each. Uploads are not automatically compressed. Reuse existing images when appropriate and avoid overwriting unrelated files with the same name. Do not delete an image that another page uses.

For video, paste a YouTube, Vimeo, or public MP4/WebM URL. Keep large video files outside the repository.

## Profile and CV

Open **Profile and CV** to update your position, biography, appointments, education, or email. Upload a PDF in **Upload CV PDF** to show a Download CV button on About. Replacing that file updates the download. A blank field hides the button.

## Publications and news

Publications include title, authors, year, publication type, status, venue, and DOI. PDF, abstract, and BibTeX are optional. The public page supports search, type filters, abstract expansion, and citation copying.

News records include a title, date, category, summary, and body. Published records appear on News, and the latest three appear on the homepage. A future date is a display date, not a publishing schedule.

## Drafts, publishing, and recovery

Turning **Publish on website** off removes a record from the public website. Project and news draft pages are not generated. The repository itself is public, so draft source files and editor notes can still be viewed on GitHub.

Each save creates a GitHub commit. GitHub Pages then rebuilds the website, usually within a few minutes. Check the live page after publishing. If a change does not appear, confirm that you are editing `main` and that publishing is enabled, then check the [build history](https://github.com/doubleteng/tengteng/actions).

To withdraw a project, turn publishing off. To recover an earlier version, open the file’s History on GitHub and restore its previous content. Keep the existing filename to preserve its URL.

## Where content appears

| Editor | Website |
| --- | --- |
| Projects | Homepage selections, Research, Teaching, Design, All Work, project pages |
| Publications | Publications |
| News | News and the latest updates on the homepage |
| Profile and CV | About, homepage identity, Contact, footer email |
| Teaching and courses | Teaching |
| Fine art | Fine Art |
| Site settings | Page introductions, navigation options, contact form, footer |

Editor notes identify unresolved dates, credits, descriptions, and missing images. They do not appear in public project pages. Routine updates require no changes to HTML, JavaScript, Jekyll, or the CMS configuration.

## Uploading a video

In a project, add a **Video** content block. Use **Upload or select a video** to choose an MP4 or WebM file from **Videos / 视频**, or enter a YouTube or Vimeo link. An uploaded file takes priority over the link. Add a **Video cover image** if you want a separate poster; otherwise the project cover is used. Save the project to publish. Keep video files compressed for faster uploads and playback.
