---
title: 'Embodied Material Gradients: Reframing 3D-Printed Footwear through Circular Multi-Material Fabrication'
card_title: 'Embodied Material Gradients: 3D-Printed Footwear'
category: research
year: '2026'
published: true
featured: false
featured_order: 99
permalink: /research/programmable-footwear/
cover: /assets/media/programmable-footwear/gradient-footwear-main.jpg
cover_alt: Three-quarter view of the printed sneaker, with material gradients from the pale upper to the blue sole and toe
cover_preview_only: false
cover_width_percent: 64
gallery_width_percent: 80
summary: Recycled TPU and PET-G are blended during extrusion to place flexibility and support within a continuous printed shoe, linking simulated loading to material composition.
role: Leading contributor; first author
project_type: Gradient multi-material additive manufacturing
project_stage: Printed research prototypes; accepted for ACADIA 2026
autoplay_videos: true
tags:
- multi-material 3D printing
- recycled polymers
- gradient materials
- footwear
- active mixing
- fabrication
credits:
- 'Authors: Teng Teng (first author), Yefan Zhi (second author)'
- 'Project photographs, diagrams, and video: research team'
related_publications:
- title: 'Embodied Material Gradients: Reframing 3D-Printed Footwear through Circular Multi-Material Fabrication'
  context: Accepted for ACADIA 2026 · Conference in October 2026
research_areas:
- material-computation
research_order: 10
related_projects:
- /research/continuous-multi-material-extrusion/
- /research/snmm-additive-manufacturing-system/
- /research/multi-material-deployable-structures/
- /research/integrated-and-tailored-thermal-insulation/
sections:
- type: text
  heading: Material composition follows the body
  body: |
    The heel, arch, forefoot, and upper experience different combinations of compression, bending, and contact. This project assigns local material mixtures to those demands, producing a shoe whose composition changes continuously between flexible and supportive regions. Recycled TPU and PET-G form the thermoplastic feedstocks; polyol additives adjust the TPU blend before it is combined with PET-G.

    A **single nozzle with active mixing** deposits the graded material as one body. The resulting prototypes integrate upper and sole without stitching or adhesive joints, linking functional zoning directly to the fabrication sequence.
- type: gallery
  images:
  - /assets/media/programmable-footwear/two-stage-mixing-head.webp
  - /assets/media/programmable-footwear/functional-material-zones.webp
  columns: two
  image_ratios: [1.292908, 1.540541]
  caption: Two-stage mixing head with independently controlled thermoplastic and additive feeds (left); functional material regions within the shoe (right).
- type: text
  heading: From simulated loading to material zones
  body: |
    Finite element analysis examines loading during heel strike, mid-stance, and toe-off. Stress and deformation patterns inform surface regions with different composition targets: PET-G-rich blends reinforce the toe and ground-contact zones, while softer TPU-rich blends accommodate bending and fit around the upper.

    The simulation guides where properties are assigned; printed specimens show how those assignments are materialized.
- type: gallery
  images:
  - /assets/media/programmable-footwear/geometry-stress-material-zones.webp
  columns: one
  caption: Shoe geometry, finite element simulation, and the resulting material-zone model.
- type: text
  heading: Programming softness and the transition
  body: |
    Four controlled feeds enter a two-stage mixing chamber. Recycled TPU first mixes with polyether and polyester polyols; the adjusted blend then mixes with PET-G before extrusion. Feed rates define composition, while auger rotation affects how material transitions develop along the deposited path.

    The material study reports **Shore 62A–93A** across the tested polyol formulations. Separate transition samples and tensile strips examine mixing speed: lower speeds produce longer gradients in the transition samples and higher peak stresses in the tested PET-G/TPU interfaces. These results connect the material boundary to a fabrication parameter that can be controlled during printing.
- type: gallery
  images:
  - /assets/media/programmable-footwear/transition-and-bonding-tests.webp
  columns: one
  caption: Color-transition samples at different auger speeds, a tensile specimen, and stress–strain curves for the tested PET-G/TPU interfaces.
- type: text
  heading: Encoding mixtures along a continuous path
  body: |
    Closed material-zone geometries intersect the extrusion curves to assign each path segment a mixture. Eight cross-sections from toe to heel illustrate how these assignments change through the shoe. Material-change commands are advanced along the path by a calibrated distance to compensate for the material retained in the mixing chamber.

    The exported G-code coordinates movement and feed ratios, allowing composition to vary without breaking the extrusion path or assembling separate material components.
- type: gallery
  images:
  - /assets/media/programmable-footwear/material-coded-cross-sections.webp
  columns: one
  caption: Eight cross-sections from toe to heel show the local material assignments along the extrusion paths.
- type: text
  heading: Printing the graded sneaker
  body: |
    The **US men's size 10 sneaker** combines five material formulations in a single print. Blue PET-G makes the composition changes visible across the sole, toe, sidewall, and upper. The prototype is reported at **350 g**, with **45 minutes of continuous extrusion per sneaker** and no support material or post-assembly.
- type: gallery
  images:
  - /assets/media/programmable-footwear/sneaker-printing.webp
  columns: one
  caption: Continuous fabrication of the sneaker (left) and a close view of deposition around the toe (right).
- type: video
  heading: Continuous multi-material deposition
  file: /assets/media/programmable-footwear/gradient-shoe-printing.mp4
  poster: /assets/media/programmable-footwear/printing-video-poster.webp
  width_percent: 50
  caption: Printing the footwear prototype with continuous variation in material composition.
- type: gallery
  images:
  - /assets/media/programmable-footwear/upper-stress-gradient.webp
  columns: one
  caption: Simulated stress and the corresponding printed material regions across the toe and upper.
- type: gallery
  images:
  - /assets/media/programmable-footwear/sidewall-material-gradient.webp
  columns: one
  caption: Side view comparing the simulated response with the composition gradient in the printed shoe.
- type: text
  heading: Adapting the gradient to different footwear
  body: |
    The sneaker places stiffer mixtures in selected sole and toe regions while retaining compliance through the upper. A **US women's size 8 flat** uses a more TPU-rich distribution for a lower-profile form. Manual compression demonstrates localized flexibility in its forefoot and arch, extending the fabrication method to a second footwear geometry.
- type: gallery
  images:
  - /assets/media/programmable-footwear/sole-stress-gradient.webp
  - /assets/media/programmable-footwear/flat-shoe-compression.webp
  columns: two
  image_ratios: [1.205303, 0.772692]
  caption: Stress-informed material distribution in the sneaker sole (left); the printed flat and manual compression of its forefoot and arch (right).
- type: text
  heading: Circularity through feedstock and fabrication
  body: |
    Failed TPU and PET-G prints are shredded and returned to the extrusion feed. Integrating upper and sole removes adhesive joints and assembly operations from the demonstrated process. Long-term wear, user comfort, and recovery of the mixed polymers after use require further testing to establish the full lifecycle performance of the footwear.
editor_notes: >-
  Sources: user-supplied Teng_Acadia_2026.pdf and Drive folder 1sqkJ0Te_nyld-VWrqPhhYTLdMSqkTCxy.
  The user confirms the year 2026, acceptance for ACADIA 2026, a conference in October 2026,
  Teng Teng as first author and Yefan Zhi as second author. Preserve this existing project URL.
  Do not upload or link the manuscript, create a paper download, or publish a final proceedings citation.
  All project images were reduced to 80 percent of their previous display size. The user-supplied Picture1.jpg
  is centered at 64 percent of the page content width; body galleries are centered at 80 percent width.
  Use paired figures where proportions permit and full rows for wide composite diagrams.
  Images are supplied research assets; video is embedded locally, muted, autoplaying, and looping.
  The supplied manuscript is anonymized and does not confirm additional authors or affiliations.
  Do not infer those details. Distinguish prototype fabrication results from long-term use and lifecycle validation.
---
