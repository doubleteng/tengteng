---
title: 'Tuck-Folding: A Computational Method for the Flattening and Fabrication of Compression-Dominant Shell Structures'
card_title: 'Tuck-Folding: A Computational Method for the Flattening and Fabrication of Compression-Dominant Shell Structures'
category: research
year: '2026'
published: true
featured: false
featured_order: 99
permalink: /research/tuck-folding/
cover: /assets/media/tuck-folding/fabric-hinge-model.webp
cover_alt: PLA panels printed on fabric, shown flat and folded into a shell formwork model
cover_preview_only: true
summary: A computational folding method translates compression-dominant shells into flat sheet patterns. Local
  tucks encode the geometry needed to reconstruct curvature in paper and fabric-hinged panels.
role: Co-author
institution: Lawrence Technological University · Cornell University · Thomas Jefferson University
project_type: Computational geometry and foldable shell formwork
project_stage: Physical prototypes and pavilion proposal
tags:
- tuck-folding
- 3D graphic statics
- computational fabrication
- shell structures
- reusable formwork
research_areas:
- material-computation
credits:
- 'Research authors: Yi Yang, Chun Zhou, Teng Teng'
- Yi Yang — Cornell University
- Chun Zhou — Thomas Jefferson University
- Teng Teng — Lawrence Technological University
- 'Images and diagrams: the authors'
primary_link:
  title: Read the paper · ACADIA 2026 (PDF)
  url: /assets/documents/tuck-folding-2026.pdf
related_publications:
- title: 'Tuck-Folding: A Computational Method for the Flattening and Fabrication of Compression-Dominant Shell
    Structures'
  url: /assets/documents/tuck-folding-2026.pdf
  publication_id: yang2026tuckfolding
  context: Accepted for ACADIA 2026 · Conference in October 2026
related_projects:
- /research/multi-material-deployable-structures/
- /research/multi-material-3d-printing-for-tension-compression-structure/
sections:
- type: text
  heading: From force diagrams to foldable geometry
  body: 'PolyFrame 2 generates a planar-faced shell through reciprocal force and form diagrams. A modular slab
    is organized into a column, canopy, and connecting arches. Subdivision controls the panel network and curvature:
    the column and canopy regions are synclastic, while the arches are anticlastic. These differences determine
    where the shell is split before flattening.'
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/force-and-curvature.webp
  - /assets/media/tuck-folding/vertex-curvature.webp
  columns: two
  image_ratios:
  - 1.68185
  - 1.68185
  caption: Force cells and their corresponding shell regions (left); synclastic and anticlastic vertex configurations
    (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/subdivision-typologies.webp
  columns: one
  caption: Four force-diagram subdivision patterns and their corresponding shell layouts.
- type: text
  heading: Tucks compensate for flattening
  body: 'Unfolding a doubly curved panel network creates gaps, overlaps, and rotational mismatch. A tuck inserts
    a local fold region that absorbs this mismatch when the sheet is refolded. Its central crease closes through
    180°, while neighboring creases recover the target surface angles.


    Tuck widths are coupled by closure relationships at shared vertices. Compression-force data guides their distribution
    within limits set by material thickness, fold collisions, machine-bed dimensions, and assembly. Splitting
    along the anticlastic arch regions separates demanding curvature into manageable pieces.'
- type: text
  heading: 'Thin sheet: reconstructing the shell in paper'
  body: 'A **1:10 Bristol-paper model**, measuring **650 × 650 mm**, assembles the shell from **21 pieces**. Laser-cut
    dashed lines allow both mountain and valley folds. Gluing the tucks fixes their 180° creases and joins the
    pieces into the slab.


    Comparison with the digital target shows qualitative geometric agreement. Thin or long, narrow tucks provide
    weaker control of the folded shape; the isolated model also requires horizontal support at its outer boundary.
    The glued assembly demonstrates reconstruction but cannot be unfolded for reuse.'
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/paper-model.webp
  columns: one
  caption: 'The 1:10 paper prototype: laser-cut patterns, folding, glued modules, and the assembled slab in plan
    and elevation.'
- type: text
  heading: 'Thick sheet: beveled panels and fabric hinges'
  body: 'Finite material thickness introduces collisions at a fold. Beveled panel edges encode the required angles,
    while a continuous fabric layer acts as a hinge. A **1:25 prototype** uses **PLA printed directly onto gold
    tulle mesh**, divided into **13 pieces**. A 0.1 mm offset on each side of the 180° creases prevents adjacent
    faces from fusing during printing.


    The printed components fold into the target curvature and can be unfolded without damaging the fabric hinges.
    This prototype demonstrates thick-sheet geometry and reusable folding; it was not used to cast concrete.'
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/fabric-hinge-model.webp
  columns: one
  caption: The 1:25 PLA-on-fabric prototype, from flat printed pieces to folded modules and assembled formwork.
- type: text
  heading: A proposed route to concrete shell construction
  body: 'A **10 × 5 m outdoor gallery pavilion** applies the system as a modular shell canopy. The proposed construction
    sequence combines CNC-cut plywood ribs with fabric membranes, transports the components flat, and folds and
    assembles them for casting. Repeated modules would provide neighboring support; a standalone canopy requires
    lateral bracing.


    Full-scale plywood fabrication and concrete casting remain future work. Geometric tolerances, stiffness, casting
    pressure, waterproofing, demolding, and hinge durability require quantitative testing.'
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/proposed-construction.webp
  - /assets/media/tuck-folding/pavilion-design.webp
  columns: two
  image_ratios:
  - 0.772698
  - 0.736842
  caption: Proposed fabrication, transport, assembly, and casting sequence (left); pavilion renderings, plan,
    and section (right). The pavilion is a design proposal.
editor_notes: 'Sources: user-supplied 195_Yang.pdf and original figures in Google Drive folder 1pSq1wLPkjPtEMNIUCpXWzy_30JtvpEdJ.
  Author order and affiliations follow the manuscript. No contribution beyond co-authorship is inferred. The user
  confirmed acceptance for ACADIA 2026, with the conference in October 2026. Proceedings metadata and the formal
  citation are not final; leave the Publications entry unchanged until confirmed. Original PDF is hosted unchanged.
  Figures use the supplied Drive originals; only blank lower
  artboard areas are removed from the two model montages. No generated imagery. No money shot, hero, or opening
  image; diagrams and proposal plates use two-column galleries, wide montages use single rows. The cover appears
  only in cards/social previews. Paper and PLA/fabric models are physical prototypes; concrete casting and the
  pavilion remain proposals.'
---
