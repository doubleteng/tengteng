---
layout: stresspath
title: StressPath
category: research
year: "2026"
published: true
featured: false
permalink: /research/stresspath/
cover: /assets/media/stresspath-preview-20261004.webp
cover_alt: StressPath material preview and the corresponding 3D-printed truss specimen.
cover_fit: contain
cover_preview_only: true
wide: true
research_areas:
  - interfaces-and-tools
research_order: 5
project_type: Interactive research tool
project_stage: Research prototype
summary: An interactive research tool connecting structural behavior, continuous
  printing paths, and material distribution.
structure_lab: false
featured_order: 99
related_publications:
- title: Continuous multi-filament 3D printing for tension-compression structure components
  url: https://psl.design.upenn.edu/wp-content/uploads/2023/05/TENG______IASS_Continuous_multi_filament__D.pdf
  publication_id: teng-2023-multi-material-truss
  context: Research foundation
- title: Prototyping high-fidelity multifunctional objects using single-nozzle multi-filament additive manufacturing
    system with active mixing
  url: https://doi.org/10.1016/j.matdes.2024.113479
  publication_id: teng2025113479
  context: Research foundation
research_question: How can a structure’s force flow guide continuous printing paths and material placement?
role_summary: Developed the browser-based research tool as an extension of my multi-material structural-printing
  work.
evidence_summary: The working model lets visitors change loads, inspect structural response, and compare paths.
  Material recipes do not feed back into the frame analysis.
role: Research tool developer
related_projects:
- /research/multi-material-3d-printing-for-tension-compression-structure/
- /teaching/structural-systems/
related_connections:
- url: /research/multi-material-3d-printing-for-tension-compression-structure/
  reason: Force-informed toolpaths and material placement
- url: /teaching/structural-systems/
  reason: Interactive experiments with loads, supports, and force flow
evidence_target: stresspath-workspace
---
StressPath is an interactive research tool that explores how structural behavior can inform continuous printing paths and material distribution. Developed as an extension of my work on [multi-material printing for tension-compression structures](/research/multi-material-3d-printing-for-tension-compression-structure/), the project brings structural modeling, analysis, toolpath generation, and material planning into a shared browser-based environment. It makes the relationship between force, geometry, and fabrication visible and available for direct experimentation.

The project is organized around a central question: how can the way a structure carries forces guide the way it is made? Editable frame models connect geometry, supports, and applied loads to visualizations of tension, compression, bending, shear, and deformation. These representations provide a basis for comparing structural arrangements and understanding how local changes affect the behavior of the whole. Planar studies form the core workflow, with an experimental assembly workspace extending the investigation to printable modules arranged in three dimensions.

Toolpath generation translates the analyzed member response into connected deposition paths. Bead width, spacing, member junctions, and layer staggering are treated as design variables, allowing structural intent to be considered alongside the continuity and sequence of printing. The resulting paths can be examined in plan or as layered assemblies, linking the abstract frame model to the geometry of deposited material.

Material planning adds another level of control to this relationship. Four feed materials can be assigned individually or combined as percentage-based mixtures within selected regions. Gradients are defined by distance along the ordered toolpath, so a transition follows the motion of the nozzle. A continuous-width preview makes these changes legible across the printed geometry. The intended distribution is considered separately from the printer’s mixing response: adjustable delay and mixing-length parameters support studies of how deposition may differ from the design and how advancing material commands may compensate for that response.

StressPath’s contribution is a shared workspace for examining these decisions together, from structural behavior to fabrication instructions. Geometry exchange, G-code export, and portable project files connect interactive studies to further modeling and printing workflows. The current prototype treats structural analysis and material planning as distinct stages: material recipes guide deposition, while the frame analysis retains its assigned section and elastic properties. The embedded tool above presents this ongoing research as an interactive study environment.

