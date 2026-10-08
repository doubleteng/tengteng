---
title: 'Scutoid: Cell-Inspired Surface Design'
card_title: Scutoid
category: research
year: 2019–2021
published: true
featured: false
featured_order: 99
permalink: /research/scutoid-brick/
cover: /assets/media/scutoid/shell-project-thumbnail.webp
cover_alt: Scutoid shell architectural visualization on the Cornell campus in autumn
cover_preview_only: true
summary: Local cell geometry, interlocking shells and thermally programmable surfaces.
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
- /research/multi-material-deployable-structures/
- /research/robosense/
- /research/transformable-physical-design-media/
related_publications:
- title: Scutoid Brick - The Designing of Epithelial Cell Inspired-brick in Masonry Shell System
  url: https://doi.org/10.52842/conf.ecaade.2020.1.563
  publication_id: teng2020scutoid
  context: eCAADe 2020 · Interlocking shells
- title: The Design and 4D Printing of Epithelial Cell-Inspired Programmable Surface Geometry
  url: https://doi.org/10.52842/conf.ecaade.2021.1.105
  publication_id: teng2021design
  context: eCAADe 2021 · Programmable surfaces
- title: Interactive Fabrication and Design of Bioinspired Surface Geometry
  url: https://hdl.handle.net/1813/110467
  publication_id: teng2021masters
  context: Cornell University · Master of Science thesis
sections:
- type: text
  heading: 'Cell geometry: the local–global relationship'
  body: 'A curved epithelial tissue must accommodate different packing arrangements across its thickness. Cells
    can have different neighbors on their apical and basal faces; an edge on one face terminates at an intermediate
    vertex, creating the triangular contact associated with a scutoid. The research translates this relationship
    between cellular contact and tissue curvature into rules for surface design.


    A four-cell parametric model connects three layers: apical, intermediate and basal. Moving paired vertices changes
    the length of shared boundaries and the size of triangular contacts. Rotation and compression of neighboring
    cells relate these local changes to the bending of the cluster. The model makes both directions of the relationship
    accessible to design: an imposed surface curvature changes its constituent cells, while changes to the cells
    can generate surface curvature.'
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/epithelial-cell-packing.gif
  - /assets/media/scutoid-brick/img-1.webp
  caption: 'Biological reference: cell packing and the scutoid geometry. Source: Gómez-Gálvez et al., 2018.'
  image_ratios:
  - 1.136054422
  - 1.15407855
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid-brick/img-2.webp
  - /assets/media/scutoid-brick/img-5.webp
  caption: Three-layer construction of a four-cell cluster (left); variations in cell geometry and shared boundaries
    (right).
  image_ratios:
  - 2.06405694
  - 3.098106713
- type: media-row
  equal_height: true
  items:
  - type: video
    file: /assets/videos/scutoid/cell-rearrangement.mp4
    poster: /assets/media/scutoid/cell-rearrangement-poster.webp
    ratio: 1.7777777777777777
    heading: Rotation and changing contacts within a cell cluster
  - type: video
    file: /assets/videos/scutoid/surface-simulation.mp4
    poster: /assets/media/scutoid/surface-simulation-poster.webp
    ratio: 1.7777777777777777
    heading: Computational studies of responsive cellular surfaces
  caption: 'Computational studies: local cell rearrangement (left) and the deformation of cellular surface networks
    (right).'
- type: text
  heading: Scutoid Brick · 2020
  body: The masonry study uses triangular cell contacts as geometric joints between discrete shell units. Its design
    problem is to subdivide a curved surface into blocks that connect across the shell thickness and constrain relative
    sliding. Two computational methods explore different relationships between irregular cellular packing and repeatable
    fabrication rules.
- type: text
  heading: Two methods for generating shell units
  body: '**Voronoi-based generation.** A selection algorithm groups eligible neighboring polygons into four-cell
    clusters. A C# component in Grasshopper represents the surface as a network of nodes and spring-like edges,
    with boundary cells fixed. As the network bends, a geometric trigger introduces intermediate vertices and scutoid
    connections where edges become overextended. This method explores how changes in overall form reorganize local
    topology.


    **Rational subdivision.** A second generator starts from a prescribed doubly curved shell and constructs related
    subdivisions on three layers. Hexagons on the outer layer connect through intermediate diamond-shaped profiles
    to diamonds or octagons on the inner layer. Merging and reconnecting selected vertices produces two complementary
    brick families, making the subdivision more directly usable for fabrication and assembly.'
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/voronoi-cluster-selection.webp
  - /assets/media/scutoid/voronoi-grasshopper-generator.webp
  caption: Voronoi cluster selection (left) and the Grasshopper generation workflow (right), eCAADe 2020, Figures
    10–11.
  image_ratios:
  - 1.830282862
  - 2.949061662
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/shell-subdivision.webp
  - /assets/media/scutoid-brick/img-4.webp
  caption: Rational three-layer subdivision (left); complementary units assembled into crossing arch-like sequences
    (right).
  image_ratios:
  - 3.045023697
  - 2.222222222
- type: text
  anchor: shell-test
  heading: Interlocking, fabrication and model testing
  body: 'Each brick family has triangular connections aligned with one of the shell’s two surface directions. Successive
    units form arch-like sequences that intersect and interlock, linking local joint geometry to the organization
    of the whole shell.


    The PLA prototype was printed as discrete units at 20% infill and assembled for a loading demonstration. The
    2020 paper reports a model weight of 1.8 lb (0.82 kg) and a supported load of two 40 lb dumbbells, approximately
    36 kg in total. An ANSYS study also compared deformation and equivalent stress in the selected shell models.
    These are prototype-scale investigations; full-scale material, joint and structural testing remained future
    work.'
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid-brick/img-3.webp
  - /assets/media/scutoid/shell-load-test-photo.webp
  caption: The assembled PLA shell (left) and the model-scale loading demonstration (right).
  image_ratios:
  - 2.057142857
  - 0.5625
- type: text
  heading: Architectural application
  body: The pavilion studies apply the cellular subdivision to a canopy, using the thickness and continuity of the
    interlocking units to shape its enclosure. The views below are architectural design visualizations; the built
    research artifact is the printed shell model shown above.
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid-brick/img-6.webp
  - /assets/media/scutoid/printed-layer-detail.webp
  caption: Shell assembly visualization (left) and an architectural material-detail rendering (right).
  image_ratios:
  - 1.125175809
  - 1.777777778
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/shell-autumn-rendering.webp
  - /assets/media/scutoid/shell-snow-rendering.webp
  caption: Architectural-scale canopy studies in autumn (left) and snow (right).
  image_ratios:
  - 2.0
  - 1.776833156
- type: media-row
  equal_height: true
  items:
  - type: video
    file: /assets/videos/scutoid/shell-walkthrough-portrait.mp4
    poster: /assets/media/scutoid/shell-walkthrough-portrait-poster.webp
    ratio: 0.5625
    heading: Scutoid shell architectural walkthrough
  - type: video
    url: https://www.youtube.com/watch?v=AW-wgsr6PRU
    ratio: 1.7777777777777777
    heading: Scutoid Brick project film
  caption: The uploaded architectural walkthrough (left) and the original Scutoid Brick project film (right).
- type: text
  heading: Programmable Surface Geometry · 2021
  body: 'The second study makes the cell–surface relationship physically changeable. It develops a material design
    medium whose shape is driven by thermal response, with no electric actuator required for deformation. Geometry,
    material assignment and thermal programming determine whether shape change begins in the surrounding frame or
    in the individual cells.


    Two materials divide the active and passive roles: 3D-printed shape-memory polymer (SMP) provides the programmed
    response, while cast silicone provides compliance. Heating allows the polymer to be reshaped and programmed;
    cooling fixes the temporary configuration, and subsequent heating activates its shape response. Silicone components
    are cast in PLA molds.


    The constraint frame is essential to both experiments. It keeps cells densely packed so that a change in one
    component is transmitted to its neighbors. The cell units and frame provide physical analogues of cell expansion
    and adhesion, translating the biological packing constraints into an assembly that can be fabricated and manipulated.'
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
  caption: Constraint geometry in flat and curved states, followed by two-cell and four-cell physical prototypes.
  equal_height: true
- type: text
  anchor: frame-driven
  heading: Experiment 1 · Global curvature changes local cells
  body: A programmed SMP frame surrounds passive silicone cells. When the frame bends under heating, it rotates
    and compresses adjacent cells, changing their shared boundary lengths and generating scutoid-like profiles.
    The experiment tests whether an imposed change in the assembly’s curvature produces the predicted local morphology.
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/cast-silicone-unit-types.webp
  - /assets/media/scutoid/silicone-cells-active-frame.webp
  caption: Cast silicone cell types (left) and the cells packed inside an active SMP constraint frame (right), eCAADe
    2021, Figures 4–5.
  image_ratios:
  - 0.939156035
  - 2.060085837
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/frame-driven-cell-sequence.webp
  - /assets/media/scutoid/frame-driven-array-sequence.webp
  caption: Frame-driven deformation of two silicone cells (left) and a larger array (right), eCAADe 2021, Figures
    6–7.
  image_ratios:
  - 7.857142857
  - 4.592901879
- type: text
  anchor: cell-driven
  heading: Experiment 2 · Local cells generate global curvature
  body: 'Reversing the material assignment makes the cells active. Individually programmed SMP units sit inside
    a passive silicone frame. Heating changes the units’ shared boundaries and triangular contacts, forcing the
    assembly to bend as the frame accommodates their motion. Experiments demonstrate bending toward both the apical
    and basal sides.


    The unit construction, frame and assembled array below belong to this deformable surface study. The before-and-after
    photographs record changes in cell openings and contacts as the material assembly changes curvature.'
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/cell-array-construction.webp
  - /assets/media/scutoid/active-smp-cell-array.webp
  caption: The relationship between local cell units and the array (left); the active SMP cell geometry (right).
  image_ratios:
  - 1.872340426
  - 1.489505755
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/passive-silicone-frame.webp
  - /assets/media/scutoid/framed-smp-cell-array.webp
  caption: Passive silicone constraint frame (left) and the cell array with its frame (right).
  image_ratios:
  - 1.522491349
  - 1.507882111
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/cell-boundary-before-after.webp
  - /assets/media/scutoid/cell-morphology-before-after.webp
  caption: 'Before-and-after close-ups of the deformable prototype: changes in shared boundaries (left) and cell
    morphology across the array (right).'
  image_ratios:
  - 2.211055276
  - 2.494331066
- type: gallery
  columns: two
  images:
  - /assets/media/scutoid/cell-driven-array-sequences.webp
  - /assets/media/scutoid/printed-cell-detail.webp
  caption: Active-cell experiments at two scales and in opposite bending directions (left, eCAADe 2021, Figure 8);
    close-up of the printed cellular prototype (right).
  image_ratios:
  - 2.689486553
  - 1.777777778
- type: media-row
  equal_height: true
  items:
  - type: video
    file: /assets/videos/scutoid/frame-driven-deformation.mp4
    poster: /assets/media/scutoid/frame-driven-deformation-poster.webp
    ratio: 1.7777777777777777
    heading: 'Experiment 1: active frame and passive silicone cells'
  - type: video
    file: /assets/videos/scutoid/cell-driven-deformation.mp4
    poster: /assets/media/scutoid/cell-driven-deformation-poster.webp
    ratio: 1.7777777777777777
    heading: 'Experiment 2: active SMP cells and passive frame'
  - type: video
    file: /assets/videos/scutoid/additional-cell-deformation.mp4
    poster: /assets/media/scutoid/additional-cell-deformation-poster.webp
    ratio: 1
    heading: Additional programmable cell-array deformation experiment
  caption: 'Thermal deformation experiments: frame-driven silicone cells (left), cell-driven surface bending (center),
    and an additional cell-array deformation sequence (right).'
- type: text
  anchor: tangible-interface
  heading: Tangible interface · From physical shaping to digital geometry
  body: 'A flex sensor attached to the assembly converts bending into a change in electrical resistance. An Arduino
    reads that change and transmits curvature data to Rhino and Grasshopper, where the corresponding digital geometry
    updates during physical manipulation.


    The designer can therefore work through two connected operations: programming a material configuration and manually
    shaping a sensed prototype. Thermal actuation changes the physical geometry; sensing carries the designer’s
    manipulation back into the digital model. This interface extends the thesis’s interactive design–fabrication
    approach by using a material assembly as an input to surface design.'
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
  caption: The cell assembly and flex sensor at rest (left), manual bending (center), and the resulting digital
    model update (right).
  equal_height: true
research_question: How can local cell connections generate interlocking shells and programmable surface curvature?
role_summary: Led the computational and physical prototyping research into cell geometry, interlocking units, and
  responsive surfaces.
evidence_summary: A PLA shell loading demonstration and two thermal-deformation experiments support distinct model-scale
  claims; architectural canopy images are proposals.
related_connections:
- url: /research/multi-material-deployable-structures/
  reason: Material actuation connecting local deformation to global curvature
- url: /research/robosense/
  reason: Scutoid geometry as a nonplanar printing experiment
- url: /research/transformable-physical-design-media/
  reason: Sensing physical deformation to update a digital model
reading_path:
- title: Shell test
  target: shell-test
- title: Frame-driven test
  target: frame-driven
- title: Cell-driven test
  target: cell-driven
- title: Tangible interface
  target: tangible-interface
evidence_target: shell-test
---
Developed as part of my Master of Science thesis at Cornell University, this research asks how the geometry and behavior of individual cells can organize an architectural surface. It connects three modes of design: computational generation, physical construction and material transformation. Scutoid Brick investigates how cellular contacts become interlocking shell joints; Programmable Surface Geometry tests how local deformation and overall curvature influence each other, then connects physical shaping to digital modeling. The two studies were published at eCAADe in 2020 and 2021. Both papers and the master’s thesis are [linked below](#research-publications-heading).

