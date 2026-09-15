---
title: Single-Nozzle Multi-Filament Additive Manufacturing
category: research
year: 2021–2025
published: true
featured: true
featured_order: 1
permalink: /research/snmm-additive-manufacturing-system/
cover: /assets/media/snmm-additive-manufacturing-system/detail-cover.webp
cover_alt: Single-nozzle printed object with a continuous material gradient
summary: A material-design workflow translates spatial composition maps into active-mixing commands and calibrated
  deposition.
role: Leading Contributor
institution: University of Pennsylvania · Polyhedral Structures Laboratory
location: ''
tags:
- fabrication
- material
- product
credits:
- 'Authors: Teng Teng, Yefan Zhi, Masoud Akbarzadeh'
team: []
acknowledgements: ''
sections:
- type: video
  heading: Active mixing in operation
  file: /assets/videos/snmf-active-mixing.mp4
  caption: A short demonstration of the printing system.
- type: gallery
  heading: Printed objects and material distributions
  images:
  - /assets/media/snmm-additive-manufacturing-system/detail-materials-design-3.webp
  - /assets/media/snmm-additive-manufacturing-system/detail-materials-design-1.webp
  - /assets/media/snmm-additive-manufacturing-system/detail-materials-design-2.webp
  - /assets/media/snmm-additive-manufacturing-system/detail-materials-design-4.webp
  caption: Structural specimens, graded surfaces, and image-based material placement.
  columns: two
- type: gallery
  heading: Active-mixing extrusion system
  images:
  - /assets/media/snmm-additive-manufacturing-system/detail-materials-design-5.webp
  - /assets/media/snmm-additive-manufacturing-system/detail-materials-design-6.webp
  caption: Extrusion-head components and the integrated printing platform.
  columns: one
- type: gallery
  heading: Additional experiments and design studies
  images:
  - /assets/media/snmm-additive-manufacturing-system/img-5.webp
  - /assets/media/snmm-additive-manufacturing-system/img-7.webp
  caption: ''
  columns: two
links: []
related_publications:
- title: Related paper (DOI)
  url: https://doi.org/10.1016/j.matdes.2024.113479
awards: []
editor_notes: ''
source_links:
- https://psl.design.upenn.edu/project/prototyping-high-fidelity-multifunctional-objects-using-single-nozzle-multi-filament-additive-manufacturing-system-with-active-mixing/
project_type: Fabrication research
project_stage: Research prototype
research_areas:
- material-computation
research_order: 2
research_question: How can a designer place a material transition where a component needs it?
contribution: The SNMF system connects representations of material distribution to a model of mixing inside the
  nozzle. Feed commands can therefore account for the transition between intended and deposited composition.
method_steps:
- title: Represent
  text: Assign material composition through image sampling, two-dimensional patches, or three-dimensional surface
    division.
- title: Model
  text: Describe the material transition inside an actively mixed extrusion head.
- title: Control
  text: Translate spatial composition into coordinated filament-feed and extrusion commands.
- title: Test
  text: Compare deposited transitions and printed case studies with their intended material distributions.
contributions:
- Led the development of the single-nozzle multi-filament research system.
- Developed computational material-assignment and fabrication workflows within the collaborative research.
- Coauthored the numerical and experimental study with Yefan Zhi and Masoud Akbarzadeh.
evidence: The published study combines a numerical description of mixing, experiments on deposited composition,
  and six design case studies. These establish the workflow under the tested material and printing conditions; the
  performance of an architectural assembly requires further component-specific testing.
related_projects:
- /research/multi-material-3d-printing-for-tension-compression-structure/
- /research/integrated-and-tailored-thermal-insulation/
card_title: Single-Nozzle Material Computation
---

## Material distribution as a design input

The Single-Nozzle Multi-Filament (SNMF) system combines multiple filament feeds in an actively mixed extrusion head. Programmable feed ratios create continuous changes in composition within one printed object.

The computational workflow supports three representations of material intent. Image sampling maps pixel values to composition. Discrete patches assign material to regions in a plane. Surface division organizes composition over three-dimensional geometry. Each representation becomes a sequence of fabrication instructions.

## Calibrating the translation into matter

Material already inside a nozzle continues to influence the output after a feed ratio changes. A numerical model describes this transition, while experiments relate feed commands to deposited composition. Accounting for this behavior is necessary to locate an interface within the printed geometry.

Six case studies connect the method to different shapes and functional requirements, including structural specimens and objects with graded material properties. The related truss and insulation studies examine how material assignment can respond to force flow and thermal demand.
