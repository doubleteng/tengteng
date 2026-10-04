---
title: Transformable Physical Design Media
category: research
year: '2015'
published: true
featured: false
featured_order: 99
permalink: /research/transformable-physical-design-media/
cover: /assets/media/transformable-physical-design-media/cube-tabletop-information.webp
cover_alt: CuBe physical building models with projected height, floor count, and floor-area information
summary: CuBe connects tangible massing models to digital geometry and projected building information, shadow studies,
  and wind-field visualizations.
role: Project lead; interface and research prototype development
institution: University of Washington · Design Machine Group
location: Seattle, Washington, USA
tags:
- tangible interface
- physical computing
- architectural massing
- human-computer interaction
credits:
- 'Leading Contributor: Teng Teng'
team:
- Brian R. Johnson
acknowledgements: ''
sections:
- type: video
  heading: CuBe in use
  url: https://www.youtube.com/watch?v=VnZFhSAxrmk
  caption: 'Prototype demonstration: physical manipulation and projected feedback share one working surface.'
- type: text
  heading: A tracked tabletop
  body: A camera beneath the translucent tabletop reads markers attached to the models. reacTIVision and Processing
    pass position and orientation data through UDP to Grasshopper; a projector returns visual information to the
    table. This arrangement lets designers move physical objects while maintaining their digital representation.
- type: text
  heading: From fixed blocks to changing geometry
  body: 'The first toolkit uses fixed cube, keystone, and tapered forms to study placement and orientation. A second
    toolkit adds a twisting, height-adjustable block: rotational and sliding potentiometers measure its deformation
    and drive a matching digital model.'
- type: gallery
  heading: Tangible model families
  images:
  - /assets/media/transformable-physical-design-media/cube-fixed-blocks.webp
  - /assets/media/transformable-physical-design-media/cube-twisting-prototype.webp
  caption: Fixed massing objects and a deformable twisting block. Figures 10–11 from Transformable Physical Design
    Media, eCAADe 2015.
  columns: two
- type: text
  heading: Reconstructing a deformable frame
  body: A third prototype uses ten adjustable members, including two diagonals, and four fixed members. Sliding
    potentiometers measure member lengths; a microcontroller supplies the data for trigonometric reconstruction
    of the geometry. Lengthening or shortening the frame changes the proportions of the corresponding digital model.
- type: image
  heading: ''
  image: /assets/media/transformable-physical-design-media/cube-physical-digital-model.webp
  alt: Two configurations of the instrumented CuBe frame paired with their reconstructed digital geometry
  caption: Measured changes in the physical frame are reconstructed as digital geometry.
- type: text
  heading: Feedback during massing studies
  body: Building height, floor count, and area remain associated with the objects as they move. Shadow studies respond
    to model position, sun position, and deformation of the twisting block. A projected wind-vector field updates
    with changes in the arrangement of the models, making the effect of a design move visible on the work surface.
- type: image
  heading: Shadow studies
  image: /assets/media/transformable-physical-design-media/cube-shadow-study.webp
  alt: CuBe massing objects and their projected shadows on the tabletop
  caption: Projected shadows connect the position of the physical models with the digital study.
- type: image
  heading: ''
  image: /assets/media/transformable-physical-design-media/cube-twisting-shadow.webp
  alt: Two views of a user deforming the twisting CuBe block during a shadow study
  caption: Changing the height and twist of the physical block updates its digital geometry and shadow.
- type: image
  heading: Wind-field feedback
  image: /assets/media/transformable-physical-design-media/cube-wind-feedback.webp
  alt: Two tabletop configurations showing projected wind vectors around CuBe building models
  caption: The wind-field visualization changes with the placement and orientation of the massing objects.
- type: text
  heading: Shared physical and digital design
  body: The deformable frame also supports discussion around a physical model while retaining a digital record of
    its geometry. The 2015 paper presents CuBe alongside [InSpire](/research/inspire/), connecting tangible manipulation
    and gesture-based modeling within the same investigation of physical design media.
links:
- title: Read the paper · eCAADe 2015, pp. 45–54
  url: https://papers.cumincad.org/data/works/att/ecaade2015_319.content.pdf
related_publications:
- title: Transformable Physical Design Media
  url: https://doi.org/10.52842/conf.ecaade.2015.1.045
  publication_id: teng2015transformable
- title: Transformable Physical Design Media
  url: http://hdl.handle.net/1773/33440
  publication_id: teng2015masters
awards: []
editor_notes: Updated from the original CuBe project page and the full eCAADe 2015 paper, pp. 45–54. Prototype descriptions
  draw on pp. 50–53. The paper documents implementations and application scenarios; it does not provide a comparative
  productivity study or validation of the wind solver.
source_links:
- http://www.ttistengteng.com/html/pic/d/472.html
- https://papers.cumincad.org/data/works/att/ecaade2015_319.content.pdf
project_type: Tangible design interface
project_stage: Research prototype
research_areas:
- interfaces-and-tools
research_order: 6
cover_caption: CuBe brings building information into the same tabletop space as the physical massing models.
contributions:
- Led CuBe’s design and prototype development at the University of Washington’s Design Machine Group.
- First author of Transformable Physical Design Media, eCAADe 2015.
related_projects:
- /research/inspire/
- /research/epithelial-cell-inspired-programmable-surface-geometry/
---

CuBe is a tangible toolkit for architectural massing studies. I led its development at the University of Washington’s Design Machine Group. Designers move, rotate, twist, and stretch physical models while the system tracks their position or deformation and updates digital geometry. The prototypes give the hands a physical reference and bring building information and environmental visualizations into the working space. The work was published in *Transformable Physical Design Media* at eCAADe 2015.
