---
title: Automated Toolpath Design for 3D Concrete Printing
category: research
year: 2022–2025
published: true
featured: false
featured_order: 99
permalink: /research/automated-concrete-toolpaths/
summary: Geometry and graph algorithms coordinate buildability, continuous deposition, and toolpath visualization
  for concrete printing.
tags:
- 3D concrete printing
- toolpath design
- Grasshopper
- fabrication
credits:
- 'Authors: Yefan Zhi, Hua Chai, Teng Teng, Masoud Akbarzadeh'
team: []
awards: []
related_publications:
- title: Additive Manufacturing · 2025
  url: https://doi.org/10.1016/j.addma.2025.104662
links: []
sections:
- type: gallery
  heading: Printed components
  images:
  - /assets/media/automated-concrete-toolpaths/detail-1-1-2y1a9911.webp
  - /assets/media/automated-concrete-toolpaths/detail-1-2-2y1a9899.webp
  - /assets/media/automated-concrete-toolpaths/detail-2-1-2y1a9976.webp
  - /assets/media/automated-concrete-toolpaths/detail-3-1-2y1a9987.webp
  - /assets/media/automated-concrete-toolpaths/detail-3-2-2y1a9997.webp
  - /assets/media/automated-concrete-toolpaths/detail-4-1-2y1a9877.webp
  - /assets/media/automated-concrete-toolpaths/detail-4-2-2y1a9865.webp
  - /assets/media/automated-concrete-toolpaths/detail-4-3-2y1a9853.webp
  - /assets/media/automated-concrete-toolpaths/detail-4-4-2y1a9838.webp
  caption: Fabricated components demonstrate different surface geometries, openings, and branching conditions.
  columns: two
- type: gallery
  heading: Toolpath design workflow
  images:
  - /assets/media/automated-concrete-toolpaths/detail-4-5.webp
  - /assets/media/automated-concrete-toolpaths/detail-5-1-fig-0-130mm-graphical-abstract-01.webp
  - /assets/media/automated-concrete-toolpaths/detail-5-2-page-02.webp
  - /assets/media/automated-concrete-toolpaths/detail-5-3-page-20.webp
  - /assets/media/automated-concrete-toolpaths/detail-5-4.webp
  caption: Geometric data structures, processing stages, and fabrication examples.
  columns: one
- type: gallery
  heading: Buildability and continuous deposition
  images:
  - /assets/media/automated-concrete-toolpaths/detail-7-page-01.webp
  - /assets/media/automated-concrete-toolpaths/detail-7-page-05.webp
  - /assets/media/automated-concrete-toolpaths/detail-7-page-06.webp
  - /assets/media/automated-concrete-toolpaths/detail-7-page-08.webp
  - /assets/media/automated-concrete-toolpaths/detail-7-page-10.webp
  - /assets/media/automated-concrete-toolpaths/detail-7-page-11.webp
  - /assets/media/automated-concrete-toolpaths/detail-7-page-16.webp
  - /assets/media/automated-concrete-toolpaths/detail-7-page-18.webp
  - /assets/media/automated-concrete-toolpaths/detail-7-page-19.webp
  caption: Overhang evaluation, path adjustment, seam reduction, and toolpath visualization.
  columns: one
source_links: []
institution: University of Pennsylvania · Polyhedral Structures Laboratory
role: Research coauthor
project_type: Fabrication research
project_stage: Research prototype
cover: /assets/media/automated-concrete-toolpaths/detail-0-1-2y1a9949.webp
cover_alt: Layered surface and openings of a 3D-printed concrete component
---

This research automates toolpath design for 3D-printed concrete structural components. Hierarchical geometric data structures and graph algorithms connect the topology of a component to its printing sequence.

Overhang analysis provides criteria for assessing buildability and locating potential failures. Offsetting and filleting methods adjust the path to improve dimensional accuracy and manage overfill at changes in direction.

For branching and porous geometries, the workflow minimizes interruptions by generating paths with as few starts and stops as their topology permits. The resulting paths can also be converted into meshes that represent layer textures or support finite element analysis.

The methods are implemented in Ovenbird, a Grasshopper plug-in for Rhino. Printed specimens test the workflow across different component geometries. I contributed as a coauthor alongside Yefan Zhi, Hua Chai, and Masoud Akbarzadeh.
