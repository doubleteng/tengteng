---
title: Multi-material 3D Printing for Tension-Compression Structure
category: research
year: 2022–2023
published: true
featured: false
featured_order: 99
permalink: /research/multi-material-3d-printing-for-tension-compression-structure/
cover: /assets/media/multi-material-3d-printing-for-tension-compression-structure/detail-2.webp
cover_alt: Printed truss with distinct materials along tension and compression regions
summary: Stress-informed material placement tunes the response of continuously printed tension and compression members.
role: Leading Contributor
institution: University of Pennsylvania · Polyhedral Structures Laboratory
location: ''
tags:
- computation
- fabrication
credits:
- 'Authors: Teng Teng, Yefan Zhi, Kun-Hao Yu, Shu Yang, Masoud Akbarzadeh'
team: []
acknowledgements: ''
sections:
- type: gallery
  anchor: load-testing
  heading: Toolpath and load testing
  images:
  - /assets/media/multi-material-3d-printing-for-tension-compression-structure/detail-4.webp
  - /assets/media/multi-material-3d-printing-for-tension-compression-structure/detail-5.webp
  - /assets/media/multi-material-3d-printing-for-tension-compression-structure/detail-6new.webp
  caption: Material assignment, comparative load tests, and measured specimen response.
  columns: one
- type: gallery
  anchor: printed-trusses
  heading: Printed trusses
  images:
  - /assets/media/multi-material-3d-printing-for-tension-compression-structure/detail-1.webp
  - /assets/media/multi-material-3d-printing-for-tension-compression-structure/detail-3.webp
  caption: Material distribution and structural analysis of the truss prototype.
  columns: two
- type: gallery
  anchor: strut-tie
  heading: Strut-and-tie printing study
  images:
  - /assets/media/multi-material-3d-printing-for-tension-compression-structure/detail-strut-and-tie-truss-print.webp
  caption: Specimen printed by Teng Teng and Yefan Zhi in 2023; underlying graphic-statics research by Salma Mozaffari,
    Masoud Akbarzadeh, and Thomas Vogel.
  columns: one
- type: gallery
  heading: Additional experiments and design studies
  images:
  - /assets/media/multi-material-3d-printing-for-tension-compression-structure/img-7.webp
  caption: ''
  columns: two
links:
- title: StressPath — interactive research tool
  url: /research/stresspath/
- title: Open StressPath workspace
  url: /research/stresspath/app/
related_publications:
- title: Continuous multi-filament 3D printing for tension-compression structure components
  url: https://psl.design.upenn.edu/wp-content/uploads/2023/05/TENG______IASS_Continuous_multi_filament__D.pdf
  publication_id: teng-2023-multi-material-truss
awards: []
editor_notes: ''
source_links: []
project_type: Fabrication research
project_stage: Research prototype
research_areas:
- material-computation
research_order: 4
research_question: How does material distribution affect structural response within a given geometry?
contribution: A toolpath generator assigns materials according to tensile and compressive demand, connecting structural
  analysis to fabrication instructions.
method_steps:
- title: Analyze
  text: Identify tensile and compressive regions in a truss.
- title: Assign
  text: Relate the local stress condition to material selection.
- title: Deposit
  text: Maintain a connected path while switching between filament feeds.
- title: Load test
  text: Compare single-material and multimaterial Pratt-truss specimens.
contributions:
- Led the continuous multi-filament structural-printing study.
- Developed material-assignment and fabrication methods within the coauthored research.
- Printed the related strut-and-tie specimen with Yefan Zhi; its underlying graphic-statics method belongs to Salma
  Mozaffari, Masoud Akbarzadeh, and Thomas Vogel.
evidence: Comparative tests show improved performance for the tested multimaterial Pratt trusses. The evidence is
  specific to the specimen geometry, material combinations, and test setup reported in the study.
related_projects:
- /research/snmm-additive-manufacturing-system/
- /research/stresspath/
role_summary: Led the continuous multi-filament structural-printing study and developed material-assignment and
  fabrication methods.
evidence_summary: Printed Pratt trusses and comparative load tests support specimen-specific performance claims;
  the related strut-and-tie study is identified separately.
related_connections:
- url: /research/stresspath/
  reason: Turns force patterns into toolpaths and material assignments.
- url: /research/snmm-additive-manufacturing-system/
  reason: Makes spatial material assignments physically controllable.
- url: /research/integrated-and-tailored-thermal-insulation/
  reason: Extends material allocation from structural demand to combined structural and thermal needs.
reading_path:
- title: Load testing
  target: load-testing
- title: Printed trusses
  target: printed-trusses
- title: Related specimen
  target: strut-tie
evidence_target: load-testing
evidence_first: 2
question_label: Research question
---
This project develops continuous multi-filament printing for structural components whose material distribution follows tensile and compressive demand. A single nozzle switches between filament feeds while maintaining a connected deposition path.

A toolpath generator assigns materials to specific regions according to their stress conditions. Printed Pratt trusses provide a test case for coordinating structural geometry, material selection, and fabrication sequence.

Comparative load tests examine the behavior of single-material and multimaterial specimens. The experiments demonstrate improved performance for the tested multimaterial trusses and make the relationship between force flow and material placement visible in the printed components.

A related strut-and-tie specimen was printed by Yefan Zhi and me in 2023. Its underlying graphic-statics research was developed by Salma Mozaffari, Masoud Akbarzadeh, and Thomas Vogel.



### StressPath

StressPath provides a browser-based workspace for exploring structural design, analysis, toolpath generation, and material distribution alongside this research. Save a study as a JSON project file and open it later to continue working.

[Explore StressPath](/research/stresspath/) · [Open the workspace](/research/stresspath/app/)

