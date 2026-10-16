---
title: ACADIA 2026 Conference Management System
card_title: ACADIA 2026 Conference Management System
category: research
year: '2026'
published: true
featured: false
featured_order: 99
permalink: /research/acadia-author-portal/
summary: An integrated post-peer-review conference management system connecting accepted submissions, publication production, author coordination, and conference presentations.
cover: /assets/media/acadia-author-portal/portal-screenshot.jpg
cover_alt: Screenshot of the ACADIA 2026 Author Portal showing the Humanism Recoded banner, author requirements, and submission access form
cover_preview_only: true
author_portal: true
application_url: https://script.google.com/macros/s/AKfycbzn3IDku0YuDDEzxf6ex2FHrqv2mNY8Z0GVpQr2yZ-6Y27_QWTqNGaqRuzmGNWsNX8/exec
role: System design and development; ACADIA 2026 Technical Chair
institution: ACADIA
location: Detroit, Michigan
project_type: Research infrastructure · Conference management
project_stage: Deployed platform
question_label: Scope
research_question: The full workflow after peer review, from accepted submissions to publication and conference delivery.
role_summary: Designed and developed the platform, author interface, task workflows, and integrations with Google Sheets and Drive.
show_publications: false
related_publications: []
editor_notes: Deployed software and research infrastructure project. Do not imply an associated research publication or responsibility for the peer-review decision process. The cover is a screenshot of the public Author Portal entry page.
research_areas:
- interfaces-and-tools
research_order: 20
tags:
- research infrastructure
- post-peer-review management
- workflow design
- interface design
- Google Apps Script
- conference management
reading_path:
- title: Author portal
  target: author-portal-workspace
- title: Connected workflows
  target: connected-workflows
- title: System architecture
  target: system-architecture
- title: Using the portal
  target: using-the-portal
links:
- title: Author Portal on the ACADIA 2026 website
  url: https://2026.acadia.org/author-portal
credits:
- 'System design and development: Teng Teng'
team: []
related_connections:
- url: /research/after-chinatown/
  reason: Shared records and interfaces connect distributed information to a public-facing platform.
- url: /teaching/structural-systems/
  reason: Task-oriented interfaces translate complex processes into guided actions and feedback.
sections:
- type: text
  heading: Connected workflows after peer review
  anchor: connected-workflows
  body: |
    The system brought Papers, Projects, Field Notes, PhD Workshop submissions, and Book Forum contributions into a shared framework, with requirements adapted to each track.

    | Workflow | What the system connected |
    | --- | --- |
    | Publication preparation | Reviewer feedback, author information, abstracts, website images, camera-ready files, and track-specific posters or proceedings materials. |
    | Author proof | Release of copyedited PDFs, return of annotated proofs, supporting figures, and confirmation of the completed correction package. |
    | Participation | Attendance confirmation, registration records, copyright and recording consent, acceptance letters, and visa invitation letters. |
    | Conference presentation | Session time, venue, room, chair, presentation order, fellow presenters, calendar invitations, and PowerPoint templates and uploads. |
    | Coordination and follow-up | Per-task progress, recent activity, deadlines, file versions, and submission status within one author dashboard. |
- type: text
  heading: One submission, a connected record
  anchor: system-architecture
  body: |
    Submission identifiers linked author information, task states, uploaded files, and presentation details. Authors could save a draft, submit an individual task, and return to the same record as later stages opened. Track-specific tasks and release conditions kept the interface aligned with the work required at each stage.

    The HTML, CSS, and JavaScript interface communicated asynchronously with a Google Apps Script backend. Google Sheets held submission records, configuration, task data, and activity logs; Google Drive held the associated files. This separation kept the working records editable for organizers while giving authors a focused interface for completing requirements.

    File transfers were divided into chunks. Publication materials used Apps Script-mediated uploads, while presentation files used resumable transfers directly to Drive. The presentation workflow checked saved upload progress and file identity before resuming, verified completion, and retained earlier versions for organizers. Session information was refreshed from the conference schedule so presentation instructions and submitted files remained associated with the correct contribution.
- type: text
  heading: Using the portal
  anchor: using-the-portal
  body: |
    1. Select the submission type and open the accepted record with the original submission details. Papers, Projects, Field Notes, and PhD Workshop entries use the submission ID and original title; Book Forum entries use the complete book title.
    2. Open an available task, review its instructions, and save or submit the requested information and files. The dashboard shows the resulting status and recent activity.
    3. Return when the proof stage is released and when preparing the conference presentation. Review session details, download the relevant templates, and upload or resume the presentation file.

    Task availability follows the conference's current settings.
- type: text
  heading: Development contribution
  body: |
    I designed and developed the system as ACADIA 2026 Technical Chair, translating the conference's publication and participation requirements into connected data records, task interfaces, and file-handling workflows. The work combined interface design with operational infrastructure: a consistent submission identifier connected activities that otherwise involved separate forms, folders, and correspondence.

    The conference website and this project page embed the same deployed application. Updates to its workflows and records remain centralized in the working system.
---
Developed for ACADIA 2026, the platform organized the work between peer-review acceptance and conference delivery. Its Author Portal served as the author-facing entry to an integrated management system spanning publication production, participation requirements, and presentation logistics.
