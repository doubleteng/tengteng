---
title: 'INSPIRE: Gesture-Based 3D Modeling'
category: design
year: '2014'
published: true
featured: true
featured_order: 3
permalink: /design/inspire/
cover: /assets/media/inspire/hero.webp
cover_alt: Gesture modeling with the InSpire optical see-through display
summary: A spatial interface translates hand gestures and viewpoint changes into direct operations on digital geometry.
role: Leading Contributor
institution: University of Washington
location: Seattle, Washington, USA
tags:
- interface
- computation
- interaction design
credits:
- 'Leading Contributor: Teng Teng'
team:
- Brian R. Johnson
acknowledgements: ''
sections:
- type: gallery
  heading: Display and tracking system
  images:
  - /assets/media/inspire/portfolio-slide-14-i10.webp
  - /assets/media/inspire/portfolio-slide-14-i12.webp
  caption: The optical display combines projected geometry with hand tracking.
  columns: two
- type: gallery
  heading: Gesture-based modeling
  images:
  - /assets/media/inspire/portfolio-slide-15-i05.webp
  - /assets/media/inspire/portfolio-slide-15-i06.webp
  - /assets/media/inspire/portfolio-slide-15-i07.webp
  - /assets/media/inspire/portfolio-slide-15-i08.webp
  caption: Physical interaction with the display and diagrams of direct geometry manipulation.
  columns: two
links: []
related_publications:
- title: 'InSpire: Integrated Spatial Gesture-based Direct 3D Modeling and Display'
  url: https://doi.org/10.52842/conf.acadia.2014.445
awards: []
editor_notes: ''
source_links: []
project_type: Interface
project_stage: Research prototype
research_areas:
- interfaces-and-tools
research_order: 2
research_question: How can a designer manipulate geometry within the same space as their hands?
contribution: INSPIRE integrates gesture sensing, a see-through display, and modeling tools so that digital operations
  have a visible spatial relationship to the designer’s movements.
method_steps:
- title: Sense
  text: Track hand movement and the position of the viewer.
- title: Interpret
  text: Map gestures to drawing, surface creation, selection, scaling, and rotation.
- title: Display
  text: Place projected geometry above the hands through an adjustable reflective surface.
- title: Update
  text: Adjust the viewpoint and hand occlusion to preserve the apparent depth relationship.
contributions:
- Developed the interface prototype with Brian R. Johnson at the University of Washington.
- Connected gesture-based interaction with Rhino and Grasshopper modeling operations.
- Coauthored the ACADIA 2014 publication.
evidence: The prototype demonstrates integrated tracking, display, and geometric operations. The documented contribution
  is the interaction system and its working modeling sequence; it does not establish a measured improvement in design
  quality or speed.
related_projects:
- /research/pica/
- /research/epithelial-cell-inspired-programmable-surface-geometry/
---

InSpire combines an optical see-through display with motion sensing and head tracking for direct manipulation of digital geometry. A Leap Motion sensor records hand movement, while an adjustable reflective surface places the projected model above the user’s hands.

Custom tools in Rhino and Grasshopper translate gestures into drawing, surface creation, selection, scaling, and rotation. Head tracking updates the viewpoint as the user moves. A rendered hand proxy controls occlusion so that the display preserves the apparent depth relationship between hands and geometry.

I developed the prototype with Brian R. Johnson at the University of Washington. The work was presented at ACADIA 2014.
