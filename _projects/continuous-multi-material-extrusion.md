---
title: As-Continuous-As-Possible Multi-Material Extrusion with Gradient Composition and Transition
card_title: As-Continuous-As-Possible Multi-Material Extrusion with Gradient Composition and Transition
category: research
year: '2026'
published: true
featured: false
featured_order: 99
permalink: /research/continuous-multi-material-extrusion/
cover: /assets/media/continuous-multi-material-extrusion/printed-porous-cells.webp
cover_alt: Printed porous cells with purple, orange, and yellow material gradients and separate wiping units
cover_preview_only: true
summary: Material-aware toolpath planning combines gradient mixtures, transition-delay compensation, and selective
  wiping to print complex two- and three-dimensional objects through a single actively mixing nozzle.
role: Major contributor; second author
institution: Lawrence Technological University · University of Pennsylvania, Polyhedral Structures Laboratory
project_type: Multi-material additive manufacturing and toolpath computation
project_stage: Printed research prototypes; accepted for ACADIA 2026
tags:
- multi-material 3D printing
- gradient materials
- toolpath planning
- active mixing
- fabrication
- Grasshopper
research_areas:
- material-computation
- interfaces-and-tools
credits:
- 'Research authors: Yefan Zhi, Teng Teng, Masoud Akbarzadeh'
- Yefan Zhi and Masoud Akbarzadeh — University of Pennsylvania
- Teng Teng — Lawrence Technological University
- 'Project photographs and diagrams: the authors'
acknowledgements: Supported by NSF FMRG-2037097 CMMI and U.S. Department of Energy ARPA-E grant DE-AR0001631,
  awarded to Masoud Akbarzadeh.
primary_link:
  title: Read the paper · ACADIA 2026 (PDF)
  url: /assets/documents/continuous-multi-material-extrusion-acadia-2026.pdf
links:
- title: Ovenbird · Rhino and Grasshopper plugin on food4Rhino
  url: https://www.food4rhino.com/en/app/ovenbird
related_publications:
- title: As-Continuous-As-Possible Multi-Material Extrusion with Gradient Composition and Transition
  url: /assets/documents/continuous-multi-material-extrusion-acadia-2026.pdf
  context: Accepted for ACADIA 2026 · Conference in October 2026
related_projects:
- /research/snmm-additive-manufacturing-system/
- /research/automated-concrete-toolpaths/
- /research/stresspath/
- /research/integrated-and-tailored-thermal-insulation/
sections:
- type: text
  heading: Composition and continuity in one workflow
  body: 'Changing a nozzle’s input mixture does not immediately change the material leaving its tip. Material
    retained in the mixing chamber delays and blends each transition, while disconnected print regions introduce
    travel moves and additional material changes. The workflow coordinates mixture assignment, transition compensation,
    and the order of extrusion paths so these effects can be planned together.


    Implemented in [**Ovenbird for Rhino and Grasshopper**](https://www.food4rhino.com/en/app/ovenbird), it converts three-dimensional models or posterized
    images into material-coded toolpaths, predicts the resulting gradients, and exports machine instructions.'
- type: gallery
  heading: ''
  images:
  - /assets/media/continuous-multi-material-extrusion/computation-workflow.webp
  columns: one
  caption: The 3D workflow assigns mixtures to a sliced model; the 2D workflow connects paths within image regions.
    Both pass through transition adjustment and visual inspection before G-code export.
- type: text
  heading: Modeling the material transition
  body: 'Each mixture is stored as a vector of input-material fractions; the collection forms a reusable palette.
    The nozzle response is modeled as a **moving average with a lag**, with delay and transition lengths calibrated
    from extrusion tests. Advancing the commanded mixture change aligns the midpoint of the predicted transition
    with its intended position.


    Changes spaced more closely than the transition length blend together before the nozzle reaches the requested
    mixture. Longer gradients can be constructed from intermediate palette entries.'
- type: gallery
  heading: ''
  images:
  - /assets/media/continuous-multi-material-extrusion/transition-model.webp
  columns: one
  caption: 'Predicted input and output compositions: delay compensation, consecutive mixture changes, extended
    gradients, and color blending across a palette.'
- type: text
  heading: Assigning mixtures to geometry
  body: The toolpath stores each segment by **layer, curve, and segment**, with an associated mixture index. Explicit
    boundary objects split paths into material regions; sampled fields assign mixtures from values such as local
    overhang or structural response. Continuous values are mapped to the nearest palette entry, and neighboring
    segments with the same assignment are merged.
- type: gallery
  heading: ''
  images:
  - /assets/media/continuous-multi-material-extrusion/material-data-structure.webp
  - /assets/media/continuous-multi-material-extrusion/ovenbird-interface.webp
  columns: two
  image_ratios:
  - 1.063395
  - 1.805556
  caption: Layer–curve–segment indexing and alternative material-assignment methods (left); Ovenbird components
    and a Grasshopper workflow (right).
- type: text
  heading: Keeping material changes out of the printed body
  body: 'For a closed curve, the planner places entry and exit within the same material region. It then uses a
    greedy sequence to print as many compatible curves and layers as possible before changing that transit material.
    The algorithm reduces wiping stops without claiming a globally optimal sequence.


    Separate wipe units collect transitions when a change is required. Clearance between the print and wipe zones
    lets the extruder reach the bed without colliding with the growing object, so wipe units do not need to rise
    to the current print height.'
- type: gallery
  heading: ''
  images:
  - /assets/media/continuous-multi-material-extrusion/mixing-systems.webp
  - /assets/media/continuous-multi-material-extrusion/wiping-layout.webp
  columns: two
  image_ratios:
  - 1.934524
  - 1.435671
  caption: Actively mixed filament and paste extrusion concepts (left); separate print and wipe zones with extruder-clearance
    allowances (right). The experiments presented here use thermoplastic filaments.
- type: text
  heading: Three-dimensional printing results
  body: 'A **90-layer planning example** on a **300 × 300 mm bed** uses **8 wipe units**. Compared with a tower
    requiring at least one unit per layer, the paper reports **91% less wiping material**, **11% less total material**,
    and **13.8% less travel time** for that example.


    A separate **45-layer printed specimen** maps local overhang to a gradient palette across porous Schwarz P
    cells. The comparison shows the sampled field, predicted extrusion, and physical print, with the transition
    waste collected beside the object.'
- type: gallery
  heading: ''
  images:
  - /assets/media/continuous-multi-material-extrusion/porous-print-comparison.webp
  columns: one
  caption: 'The 45-layer thermoplastic specimen: local-overhang sampling and toolpath visualization (left), with
    the printed porous cells and wipe units (right).'
- type: text
  heading: 'Two-dimensional printing: soft and hard boundaries'
  body: 'Parallel zigzag paths carry repeated material transitions across an image, producing a directional blur.
    The hard-edge method fills each material region before moving to the next. Circle packing and an alpha-complex
    graph support a continuous path through each region; the regions are then connected to reduce material changes.


    The **200 × 200 mm prints** compare both strategies using a posterized Mona Lisa image. Their different edge
    qualities arise from the relationship between path direction, transition length, and the order in which material
    regions are filled.'
- type: gallery
  heading: ''
  images:
  - /assets/media/continuous-multi-material-extrusion/soft-edge-print.webp
  - /assets/media/continuous-multi-material-extrusion/hard-edge-print.webp
  columns: two
  image_ratios:
  - 1.0
  - 0.750293
  caption: 'Physical 200 × 200 mm prints: soft-edge parallel filling (left) and hard-edge alpha-complex filling
    (right).'
- type: text
  heading: Experimental scope
  body: The printed demonstrations use thermoplastic filaments, mainly PLA. Extension to paste extrusion and architectural-scale
    production requires further testing of material compatibility, deposition accuracy, and transition behavior.
    Color is used to inspect material distribution; the examples do not establish mechanical performance gains
    from the gradients.
editor_notes: 'Sources: the user-provided Google Drive folder 1a_i1een68PyVhkA3-A_9Gn99_d__2nr-, its 11-page ACADIA2026_Paper
  Template.pdf, and independent figure PDFs. Acceptance for ACADIA 2026 and the October 2026 conference were confirmed
  by the user. Formal proceedings metadata is not final; do not create a definitive proceedings citation from
  the earlier provisional Volume 2 information. The supplied manuscript is hosted unchanged and linked directly
  from the project. All figures are rendered from the supplied vector PDFs; physical photographs are extracted
  from their original embedded images. No generated imagery, money shot, hero, or opening image. Pair compatible
  figures and photographs in two columns, with wide composite figures on their own rows. Preserve complete figures
  and image proportions. Author order and affiliations follow the manuscript; second-author role follows the user’s
  portfolio rule. Distinguish the 90-layer planning example from the 45-layer printed specimen; the reported time
  saving concerns travel time, not total print time. Experimental demonstrations use thermoplastics; paste and
  construction-scale extensions are not represented as validated outcomes. No separate formal Publications entry
  until final metadata is confirmed.'
---
