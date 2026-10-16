---
title: Low-cost Bespoke Paste Printer
category: research
year: '2022'
published: true
featured: false
featured_order: 99
permalink: /research/bespoke-paste-printer/
cover: /assets/media/bespoke-paste-printer/printed-branching-structure.webp
cover_alt: Multi-branched clay structure printed without support material or infill
cover_fit: contain
cover_background: '#ffffff'
cover_preview_only: true
summary: A desktop printer conversion pairs a two-stage paste extruder with nonplanar toolpaths to print branching
  clay forms without support or infill.
role: Hardware development and fabrication workflow
project_type: Fabrication tool
project_stage: Built prototype
tags:
- paste extrusion
- nonplanar printing
- tool development
- digital fabrication
credits:
- 'Project: Teng Teng'
team: []
links: []
related_publications: []
show_publications: false
awards: []
source_links: []
editor_notes: 2022 project; the supplied PDF and DOCX are background project documentation, not a published article.
  Do not add a publication or DOI.
research_areas:
- material-computation
research_order: 18
question_label: Design question
research_question: How can an accessible desktop printer fabricate branching clay geometry beyond horizontal layers?
role_summary: Developed a bespoke paste extrusion system and a Rhino/Grasshopper workflow for nonplanar deposition.
evidence_summary: The assembled printer, component drawings, toolpath studies, and printing film document the prototype
  and its branching-form test.
evidence_target: printing-test
related_projects:
- /research/robosense/
- /research/pinbed/
- /research/snmm-additive-manufacturing-system/
opening_sections:
- type: media-row
  heading: From desktop printer to branching clay form
  equal_height: true
  items:
  - type: image
    image: /assets/media/bespoke-paste-printer/printer-prototype.webp
    ratio: 0.6308180535966149
    alt: Assembled bespoke paste printer
  - type: image
    image: /assets/media/bespoke-paste-printer/printed-branching-structure.webp
    ratio: 0.6735270379338176
    alt: Printed multi-branched clay structure without support or infill
  caption: 'The converted printer and its branching-form test: an accessible machine developed together with the
    deposition method.'
reading_path:
- title: Printing test
  target: printing-test
- title: Extrusion hardware
  target: extrusion-hardware
- title: Nonplanar toolpaths
  target: nonplanar-toolpaths
sections:
- type: media-row
  heading: Printing a branching form
  anchor: printing-test
  equal_height: true
  items:
  - type: video
    heading: Nonplanar clay printing
    file: /assets/videos/bespoke-paste-printer-nonplanar-printing.mp4
    poster: /assets/media/bespoke-paste-printer/printing-film-poster.webp
    ratio: 0.5666666666666667
  - type: image
    image: /assets/media/bespoke-paste-printer/adaptive-extrusion-test.webp
    ratio: 1.4988235294117647
    alt: Nozzle following the nonplanar layers of a clay test print
  caption: The printing film follows the branching geometry as it develops. The close-up shows deposition across
    changing layer orientations.
- type: text
  heading: A two-stage extrusion system
  anchor: extrusion-hardware
  body: 'A geared motor drives a syringe-based material feeder, sending paste through a flexible hose to a compact
    auger nozzle. Separating storage from the moving printhead reduces the mass carried by the gantry; the auger
    controls material delivery at the nozzle.


    The Ender-3 conversion uses printed polycarbonate components, a detachable nozzle mount, a taller vertical frame,
    and a replacement control board with external motor drivers. The prototype’s documented 2022 parts budget was
    approximately US$596, including the base printer. Components were purchased commercially and assembled without
    custom metal-shop fabrication.'
- type: gallery
  heading: Feeder and auger nozzle
  images:
  - /assets/media/bespoke-paste-printer/material-feeder.webp
  - /assets/media/bespoke-paste-printer/auger-nozzle.webp
  columns: two
  caption: Dimensions, exploded assemblies, and assembled configurations of the two extrusion stages.
- type: gallery
  heading: Reinforcement and printer integration
  images:
  - /assets/media/bespoke-paste-printer/feeder-reinforcement.webp
  - /assets/media/bespoke-paste-printer/printer-mounting.webp
  columns: two
  caption: Printing direction, reinforcing fasteners, piston restraint, and the detachable mount coordinate the
    custom hardware with the desktop gantry.
- type: text
  heading: Toolpaths follow the branches
  anchor: nonplanar-toolpaths
  body: 'In Rhino/Grasshopper, the model’s branch centerlines guide the orientation of slicing planes. Toolpaths
    from the individual branches are merged into a sequence that changes height continuously, allowing the three-axis
    machine to deposit along nonplanar layers.


    The workflow distinguishes planar, intersecting, and transition regions. Local nozzle-clearance adjustments
    reduce collisions with previously deposited material. An adaptive extrusion rate responds to changing distances
    between adjacent paths, maintaining material delivery where the layer spacing varies.'
- type: gallery
  heading: Geometry, clearance, and extrusion
  images:
  - /assets/media/bespoke-paste-printer/branch-oriented-slicing.webp
  - /assets/media/bespoke-paste-printer/collision-and-extrusion-control.webp
  columns: two
  caption: Branch-oriented slicing generates the paths; clearance and extrusion adjustments address intersections
    and changing layer spacing.
- type: image
  heading: The printing sequence
  image: /assets/media/bespoke-paste-printer/printing-sequence.webp
  alt: Seven successive stages of the multi-branched clay structure being printed
  caption: The test progresses from a continuous base to multiple branches without support material or internal
    infill.
---
Developed in 2022, this project combines a low-cost desktop printer conversion with a custom design-to-fabrication workflow. The aim is to make paste printing more accessible while extending what a three-axis machine can produce.

Hardware and toolpath design are developed together. A separate material feeder supplies an auger nozzle, while branch-oriented slicing, nozzle-clearance adjustments, and adaptive extrusion coordinate the deposition of clay. A multi-branched test form demonstrates the resulting process without support material or internal infill.
