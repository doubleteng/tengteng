---
title: 'Scutoid: Cell-Inspired Surface Design'
card_title: Scutoid
category: research
year: '2019–2021'
published: true
featured: false
featured_order: 99
permalink: /research/scutoid-brick/
cover: /assets/media/scutoid-brick/img-3.webp
cover_alt: Assembled 3D-printed Scutoid shell prototype
cover_preview_only: true
summary: Interlocking shells and programmable surfaces derived from epithelial-cell geometry.
role: Project Lead
institution: Cornell University
project_type: Master's thesis research
project_stage: Computational and physical prototypes
publications_position: end
tags:
- bio-inspired design
- computation
- masonry
- 4D printing
- programmable materials
- tangible interfaces
research_areas:
- material-computation
- interfaces-and-tools
research_order: 4
credits:
- 'Research and design: Teng Teng'
- 'Thesis advisor: Jenny Sabin'
- 'eCAADe 2020 authors: Teng Teng, Mian Jia, Jenny Sabin'
- 'eCAADe 2021 authors: Teng Teng, Jenny Sabin'
related_projects:
- /research/pinbed/
- /research/robosense/
- /research/pica/
related_publications:
- title: Scutoid Brick - The Designing of Epithelial Cell Inspired-brick in Masonry Shell System
  url: https://doi.org/10.52842/conf.ecaade.2020.1.563
  publication_id: teng2020scutoid
  context: 'eCAADe 2020 · Interlocking shells'
- title: The Design and 4D Printing of Epithelial Cell-Inspired Programmable Surface Geometry
  url: https://doi.org/10.52842/conf.ecaade.2021.1.105
  publication_id: teng2021design
  context: 'eCAADe 2021 · Programmable surfaces'
- title: Interactive Fabrication and Design of Bioinspired Surface Geometry
  url: https://hdl.handle.net/1813/110467
  publication_id: teng2021masters
  context: 'Cornell University · Master of Science thesis'
sections:
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid-brick/img-3.webp
  - /assets/media/scutoid/printed-cell-detail.webp
  caption: Assembled shell prototype (left) and a close-up of printed cell geometry (right).
- type: text
  heading: Cell geometry and surface curvature
  body: |
    Epithelial cells pack into tissues that bend around complex cavities. Across the thickness of a curved tissue, neighboring cells can change their contact relationships. A scutoid accommodates this change through an additional vertex and a triangular face connecting different polygonal profiles.

    A three-layer parametric model connects the apical surface, an intermediate layer and the basal surface. Varying the shared boundaries between four neighboring units changes their contact geometry and the curvature of the cluster. This geometric model provides rules for both assembling a fixed shell and designing a surface that can deform.
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/epithelial-cell-packing.gif
  - /assets/media/scutoid-brick/img-1.webp
  caption: 'Biological reference: changing cell neighbors and Scutoid packing. Gómez-Gálvez et al., 2018.'
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid-brick/img-2.webp
  - /assets/media/scutoid-brick/img-5.webp
  caption: Three-layer construction of a scutoid cluster (left) and variations in local geometry as the cluster bends (right).
- type: video-gallery
  videos:
  - file: /assets/videos/scutoid/cell-rearrangement.mp4
    poster: /assets/media/scutoid/cell-rearrangement-poster.webp
    heading: Cell rearrangement and triangular connections
  - file: /assets/videos/scutoid/surface-generation.mp4
    poster: /assets/media/scutoid/surface-generation-poster.webp
    heading: From layered subdivisions to a Scutoid shell
  caption: Geometric studies connect local cell rearrangement (left) with the subdivision of an overall shell (right).
- type: text
  heading: Interlocking shells
  body: |
    Scutoid Brick translates triangular cell contacts into interlocking masonry joints. The research developed a Voronoi-based generator and a regular subdivision method for fabrication. The latter divides a double-curved shell into three related layers, then connects their vertices to produce two complementary brick types.

    The connection faces align along the shell's two principal directions. Neighboring units form intersecting arch-like sequences, using their geometry to limit relative sliding. The joint, the unit and the overall shell are generated together.
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/shell-subdivision.webp
  - /assets/media/scutoid-brick/img-4.webp
  caption: Layered shell subdivision (left) and interlocking units organized along intersecting arch-like sequences (right).
- type: text
  body: |
    Printed PLA units were assembled into a shell and evaluated through a loading demonstration. The 2020 paper reports that a model weighing 1.8 lb (0.82 kg), printed with 20% infill, supported two 40 lb dumbbells, totaling about 36 kg. This model-scale test and the preliminary finite-element study examined the assembled geometry; full-scale masonry construction remained a subsequent research step.
- type: gallery
  columns: two
  image_ratios: [1.777778, 0.5625]
  images:
  - /assets/media/scutoid/printed-layer-detail.webp
  - /assets/media/scutoid/shell-load-test-photo.webp
  caption: Printed layer detail (left) and the PLA shell model under load (right).
- type: gallery
  columns: two
  image_ratios: [2, 1.776833]
  images:
  - /assets/media/scutoid/shell-autumn-rendering.webp
  - /assets/media/scutoid/shell-snow-rendering.webp
  caption: Architectural-scale design renderings in autumn (left) and snow (right).
- type: media-row
  items:
  - type: video
    file: /assets/videos/scutoid/shell-walkthrough-portrait.mp4
    poster: /assets/media/scutoid/shell-walkthrough-portrait-poster.webp
    heading: Scutoid shell architectural walkthrough
  - type: video
    url: https://www.youtube.com/watch?v=AW-wgsr6PRU
    heading: Scutoid Brick project film
  caption: Architectural walkthrough of the Scutoid shell (left) and the Scutoid Brick project film (right).
- type: text
  heading: Programmable surfaces
  body: |
    The next experiments made the local–global relationship deformable through two complementary material configurations. Cast silicone provides compliant, passive components; 3D-printed shape-memory polymer provides thermally activated components. A surrounding frame keeps the units in contact as their geometry changes.
- type: media-row
  items:
  - image: /assets/media/scutoid/cell-frame-flat.webp
    ratio: 1.02957
    alt: Flat cell geometry and its surrounding constraint frame
  - image: /assets/media/scutoid/cell-frame-curved.webp
    ratio: 0.851711
    alt: Curved cell geometry and its surrounding constraint frame
  - image: /assets/media/scutoid/two-cell-prototype.webp
    ratio: 2.057613
    alt: Two-cell material prototype within a constraint frame
  - image: /assets/media/scutoid/four-cell-prototype.webp
    ratio: 2.057613
    alt: Four-cell material prototype within a constraint frame
  caption: Flat and curved cell geometry with constraint frames, followed by two-cell and four-cell material prototypes.
- type: text
  body: |
    **Active frame, passive cells.** A programmed shape-memory polymer frame bends when heated, pushing the silicone units into changing contact relationships. The experiment demonstrates how overall curvature reshapes the individual cells.

    **Active cells, passive frame.** Individually programmed polymer units deform within a silicone frame. Changes in their shared boundaries drive the assembly from a flat configuration into a curved surface. Here, local material transformations generate the overall shape.
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/active-cell-assembly.webp
  - /assets/media/scutoid/constraint-frame.webp
  caption: The geometry of the cell assembly (left) and its surrounding constraint frame (right) can be assigned different active and passive material roles.
- type: video-gallery
  videos:
  - file: /assets/videos/scutoid/frame-driven-deformation.mp4
    poster: /assets/media/scutoid/frame-driven-deformation-poster.webp
    heading: Active frame deforms passive silicone cells
  - file: /assets/videos/scutoid/cell-driven-deformation.mp4
    poster: /assets/media/scutoid/cell-driven-deformation-poster.webp
    heading: Active cells deform the surrounding surface
  caption: 'Two directions of shape change: frame-driven deformation of silicone cells (left) and thermally activated cell units bending the assembly (right).'
- type: text
  heading: Tangible design interface
  body: |
    A flex sensor attached to the material assembly translates bending into a change in electrical resistance. An Arduino converts the reading into curvature data and sends it to Rhino and Grasshopper. Manually shaping the prototype updates the digital model, connecting physical exploration with computational surface design.

    Thermal programming establishes a target material response, while sensing captures subsequent physical manipulation. Together, these experiments position the cell assembly as both a programmable surface and a tangible design medium.
- type: media-row
  items:
  - image: /assets/media/scutoid/programmable-surface.webp
    ratio: 1.509434
    alt: Printed cell assembly with an embedded flex sensor
  - image: /assets/media/scutoid/flex-sensor-prototype.webp
    ratio: 1.509434
    alt: Manual bending of the cell assembly and flex sensor
  - type: video
    file: /assets/videos/scutoid/physical-digital-interface.mp4
    poster: /assets/media/scutoid/physical-digital-interface-poster.webp
    ratio: 1.333333
    heading: Physical surface manipulation updates the digital model
  caption: The cell assembly and flex sensor at rest (left), manual bending (center), and the resulting digital model update (right).

---

Developed as part of my Master of Science thesis at Cornell University, this research investigates how local cell geometry organizes the construction and deformation of an overall surface. Geometric rules drawn from epithelial-cell packing connect two applications: interlocking shell units and thermally programmable material assemblies. Physical prototypes then extend the surface into a tangible interface for digital modeling. The work was published in two papers at eCAADe in 2020 and 2021; both papers and the master's thesis are [linked below](#research-publications-heading).
