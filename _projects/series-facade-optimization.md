---
title: 'SERIES: Free-Form Façade Optimization'
category: design
year: 2010–2012
published: true
featured: true
featured_order: 6
cover: /assets/media/series-facade-optimization/portfolio-slide-20-i01.webp
cover_alt: 'SERIES: Free-Form Façade Optimization design visualization'
sections:
- type: gallery
  heading: Geometric constraints
  images:
  - /assets/media/series-facade-optimization/portfolio-slide-20-i02.webp
  - /assets/media/series-facade-optimization/portfolio-slide-20-i04.webp
  - /assets/media/series-facade-optimization/portfolio-slide-20-i05.webp
  - /assets/media/series-facade-optimization/portfolio-slide-20-i06.webp
  caption: Tower overhang, floor outlines, corner alignment, and column inclination define the optimization problem.
  columns: two
- type: gallery
  heading: Parametric solvers
  images:
  - /assets/media/series-facade-optimization/portfolio-slide-21-i01.webp
  - /assets/media/series-facade-optimization/portfolio-slide-21-i02.webp
  - /assets/media/series-facade-optimization/portfolio-slide-21-i03.webp
  - /assets/media/series-facade-optimization/portfolio-slide-21-i04.webp
  - /assets/media/series-facade-optimization/portfolio-slide-21-i05.webp
  caption: Grasshopper interfaces coordinate floor data, outline geometry, tower form, and column alignment. Design
    studies.
  columns: two
credits:
- 'Computational designer and toolkit developer: Teng Teng'
team:
- Hui Chen
- Quanhong Li
- Shark Liang
- Henry Liu
- Danielle Gong
links: []
related_publications: []
awards: []
summary: A computational toolkit coordinates tower geometry, curtain-wall constraints, and consultant requirements
  within the design model.
editor_notes: ''
role: Computational designer and toolkit developer
institution: Callison, Shanghai
location: Shanghai, China
project_type: Computational design
project_stage: Design toolkit
source_links: []
tags:
- computation
- facade
- optimization
- architecture
research_areas:
- interfaces-and-tools
research_order: 3
research_question: How can fabrication and consultant constraints participate in early design decisions?
contribution: SERIES brings floor-area limits, column alignment, facade curvature, and panel requirements into a
  coordinated computational workflow. Separate solvers expose the effects of these constraints on architectural
  geometry.
method_steps:
- title: Define
  text: Record floor-area, structure, curvature, and panel requirements.
- title: Solve
  text: Use simulated annealing to adjust floor outlines within the stated constraints.
- title: Coordinate
  text: Connect form, floor profiles, inclined columns, and model information.
- title: Review
  text: Compare design alternatives with supplier and facade-consultant requirements.
contributions:
- Developed the Grasshopper and C# toolkit as a computational designer at Callison, Shanghai.
- Integrated geometric and manufacturing constraints into the design team’s modeling workflow.
evidence: The documented work includes constraint diagrams, parametric solver interfaces, and design studies from
  2010–2012. These show the coordination method; no measured project-wide time or cost reduction is claimed.
card_title: 'SERIES: Facade Design Toolkit'
---

SERIES is a computational design toolkit developed at Callison’s Shanghai office during 2010–2012. It links free-form tower design with the geometric and manufacturing constraints of curtain-wall systems.

The toolkit uses simulated annealing to adjust floor outlines while responding to floor-area limits, column alignment, façade curvature, and panel requirements. Separate solvers address overall form, floor profiles, inclined columns, and the coordination of model information.

The workflow incorporates supplier and façade-consultant requirements into the design team’s own model, allowing geometry to be rationalized while maintaining control of the intended appearance.
