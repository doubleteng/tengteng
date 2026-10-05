---
title: 3D-Printed Multi-Material Deployable Structures
card_title: Multi-Material Deployable Structures
category: research
year: '2026'
published: true
featured: false
featured_order: 99
permalink: /research/multi-material-deployable-structures/
cover: /assets/media/multi-material-deployable-structures/completed-canopy.webp
cover_alt: Completed self-morphing lattice canopy on four branching supports
cover_preview_only: true
summary: 'Programmable shape transformation through additive manufacturing: flat-printed bio-based lattices develop
  canopy curvature through drying-driven hinges and suspended forming.'
role: Leading contributor; first and corresponding author
institution: University of Pennsylvania · Polyhedral Structures Laboratory; Lawrence Technological University
project_type: Multi-material fabrication and self-morphing structures
project_stage: Pavilion-scale research prototype
tags:
- multi-material 3D printing
- self-morphing
- bio-based materials
- robotics
- graphic statics
research_areas:
- material-computation
credits:
- 'Research authors: Teng Teng, Yefan Zhi, Yi Yang, Masoud Akbarzadeh'
- 'Material collaboration: Laia Mogas Soldevila and Behzad Modanloo'
- 'Early PLA/agarose studies: David Salas, Creston Singer, and Teng Teng'
acknowledgements: Supported by NSF CAREER-1944691 CMMI and NSF FMRG-2037097 CMMI, awarded to Masoud Akbarzadeh.
primary_link:
  title: Read the paper · IASS 2026
  url: https://psl.design.upenn.edu/wp-content/uploads/2026/09/23-3D-Printed-Multi-Material-Deployable-Structures-Programmable-Shape-Transformation-through-Additive-Manufacturing.pdf
related_publications:
- title: '3D-Printed Multi-Material Deployable Structures: Programmable Shape Transformation through Additive Manufacturing'
  url: https://psl.design.upenn.edu/wp-content/uploads/2026/09/23-3D-Printed-Multi-Material-Deployable-Structures-Programmable-Shape-Transformation-through-Additive-Manufacturing.pdf
  publication_id: teng2026deployable
related_projects:
- /research/snmm-additive-manufacturing-system/
- /research/multi-material-3d-printing-for-tension-compression-structure/
- /research/integrated-and-tailored-thermal-insulation/
links: []
sections:
- type: gallery
  heading: ''
  images:
  - /assets/media/multi-material-deployable-structures/completed-canopy.webp
  - /assets/media/multi-material-deployable-structures/canopy-connection.webp
  columns: two
  image_ratios:
  - 1.500375
  - 1.500375
  caption: The assembled pavilion and the connection between the self-morphed lattice canopy and a branching support.
- type: text
  heading: Force-informed geometry and flat patterns
  body: Polyhedral 3D graphic statics defines a funicular canopy around four supports. The curved network is divided
    into three module families whose shared boundaries preserve alignment during assembly. Modules A and B use developable
    curved folding. The saddle-shaped Module C uses tuck folds, inserting local fold regions into a planar pattern
    to produce anticlastic curvature.
- type: gallery
  heading: ''
  columns: two
  images:
  - /assets/media/multi-material-deployable-structures/graphic-statics.webp
  - /assets/media/multi-material-deployable-structures/tuck-folding.webp
  image_ratios:
  - 1.554002
  - 1.715266
  caption: Reciprocal force and form diagrams (left) and the tuck-folding geometry of the saddle module (right).
- type: gallery
  heading: ''
  columns: one
  images:
  - /assets/media/multi-material-deployable-structures/module-patterns.webp
  caption: The canopy is divided into three module families and translated into flat printing patterns.
- type: gallery
  heading: ''
  columns: one
  images:
  - /assets/media/multi-material-deployable-structures/hinge-map-front.webp
  caption: Mapped active hinge regions across the flat module set.
- type: text
  heading: Drying-driven material hinges
  body: A dried **cellulose–chitosan–fibroin lattice** constrains an active **agarose layer**. As agarose loses
    water, its contraction produces bending at the bonded hinge. Locating active material on different faces controls
    fold direction, while the surrounding passive lattice carries the module geometry. The early PLA/agarose studies
    below establish the bending mechanism; the later bio-based lattice studies extend it to connected folding patterns.
- type: video
  heading: Early PLA/agarose bending studies
  file: /assets/media/multi-material-deployable-structures/pla-agarose-bending.mp4
  poster: /assets/media/multi-material-deployable-structures/pla-agarose-bending-poster.webp
  caption: Drying-driven deformation across a series of passive lattice patterns.
- type: video
  heading: Active/passive lattice transformation
  file: /assets/media/multi-material-deployable-structures/lattice-transformation.mp4
  poster: /assets/media/multi-material-deployable-structures/lattice-transformation-poster.webp
  caption: Localized active hinges transform a flat lattice into a folded surface.
- type: video
  heading: Fold formation and physical handling
  file: /assets/media/multi-material-deployable-structures/fold-formation.mp4
  poster: /assets/media/multi-material-deployable-structures/fold-formation-poster.webp
  caption: A folding sequence followed by manual flexing of the formed lattice.
- type: text
  heading: Calibrating hinge rotation
  body: Hinge length converts local bilayer curvature into fold rotation. With **2 mm passive and 2 mm active layers**,
    the study compares 18, 32, and 50 mm active regions. The **50 mm hinge** develops the fold depth used in the
    pavilion modules. Separate thickness tests show how the balance between active contraction and passive restraint
    changes bending.
- type: gallery
  heading: ''
  images:
  - /assets/media/multi-material-deployable-structures/hinge-18mm.webp
  - /assets/media/multi-material-deployable-structures/hinge-50mm.webp
  columns: two
  image_ratios:
  - 1.55159
  - 1.437815
  caption: The 18 mm hinge reaches partial rotation (left); the 50 mm hinge produces deeper closure under the same
    layer thicknesses (right).
- type: video
  heading: Active/passive thickness tests
  file: /assets/media/multi-material-deployable-structures/hinge-thickness-tests.mp4
  poster: /assets/media/multi-material-deployable-structures/hinge-thickness-tests-poster.webp
  caption: Time-lapse comparison of samples with different active-layer thicknesses.
- type: text
  heading: Robotic printing and material placement
  body: 'An ABB IRB 6640 prints the passive lattice on a flat heated bed. Toolpaths maintain continuity through
    the cellular network to reduce extrusion starts and stops. The pavilion uses approximately **25 mm cells, 6
    mm beads, and a 120 mm/s tool speed**, with individual prints reaching approximately **2.3 m in plan span**.


    The passive lattice dries before agarose deposition so the active hinges contract against a stabilized scaffold.
    Mapped hinge regions are printed on one face, then the module is flipped for deposition on the opposite face
    where the fold direction requires it.'
- type: gallery
  heading: ''
  images:
  - /assets/media/multi-material-deployable-structures/robot-printing.webp
  - /assets/media/multi-material-deployable-structures/passive-lattice.webp
  columns: two
  image_ratios:
  - 0.866667
  - 0.9105
  caption: Robotic flat printing (left) and a dried passive lattice at architectural scale (right).
- type: video
  heading: Thermal view of active-material extrusion
  file: /assets/media/multi-material-deployable-structures/thermal-extrusion.mp4
  poster: /assets/media/multi-material-deployable-structures/thermal-extrusion-poster.webp
  caption: Infrared footage documents the heated extrusion process used in the active-material experiments.
- type: text
  heading: Suspended forming at meter scale
  body: 'Wet agarose adds weight and rehydrates the passive lattice at the hinges. At meter scale, early bending
    on the printbed concentrates stress along these softened regions and can tear the scaffold before its shape
    locks.


    **Suspended forming uses gravity as a controlled boundary condition.** Rope positions and lengths establish
    an intermediate curved geometry and redistribute self-weight during drying. Agarose contraction then refines
    the fold rotations. Module B retains developable curvature, while Module C forms an anticlastic surface through
    tuck activation.'
- type: video
  heading: Suspended forming and canopy assembly
  file: /assets/media/multi-material-deployable-structures/suspended-forming-video.mp4
  poster: /assets/media/multi-material-deployable-structures/suspended-forming-video-poster.webp
  caption: Pavilion assembly and time-lapse sequences of suspended modules developing curvature.
- type: gallery
  heading: ''
  images:
  - /assets/media/multi-material-deployable-structures/hinge-softening.webp
  - /assets/media/multi-material-deployable-structures/morphed-module.webp
  columns: two
  image_ratios:
  - 1.262911
  - 1.147028
  caption: A module damaged during flat-bed actuation (left) and the flat-to-curved transformation of Module C (right).
- type: text
  heading: Assembly and structural scope
  body: 'The formed modules are registered on a temporary frame and joined progressively with zip ties through their
    boundary lattices. Assembly takes approximately **13 hours**. Closing the module network allows the frame to
    be removed and the canopy to transfer to its four supports.


    The pavilion demonstrates a mold-free fabrication and assembly route for curved canopy modules. Drying and assembly
    still require temporary support; joint stiffness, long-term creep, and capacity under environmental loads remain
    to be quantified.'
source_links:
- https://psl.design.upenn.edu/wp-content/uploads/2026/09/23-3D-Printed-Multi-Material-Deployable-Structures-Programmable-Shape-Transformation-through-Additive-Manufacturing.pdf
editor_notes: 'Source: supplied IASS 2026 presentation (37 slides) and the 10-page IASS-IWSS 2026 paper. All six
  embedded videos are extracted from the presentation, retain their complete duration, and are embedded as local
  MP4s. No presentation download or link. Images are source photographs and diagrams, with no generated imagery.
  Publication URL is the user-supplied full paper. Role follows the portfolio rule for first-authored multi-material
  research. Use existing two-column galleries; cover is only for cards/social preview. Credits preserve material
  and early-study collaborators documented in the slides. The prototype demonstrates geometry and assembly, without
  implying certified structural performance. Layout updated per user: no money shot or opening hero; photographs
  in two columns within the project body, wide diagrams occupy a full row with uncropped proportions.'
---

This project embeds the shaping of a curved canopy within **flat, robotically printed modules**. Localized agarose hinges contract during drying and rotate a passive lattice, connecting material placement to architectural geometry. Scaling that mechanism to a pavilion requires the printing sequence, drying supports, and module connections to work together.
