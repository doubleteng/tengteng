---
title: 'PICA: Personal Robotic Fabrication'
category: research
year: 2019–2020
published: true
featured: true
featured_order: 2
permalink: /research/pica/
cover: /assets/media/pica/hero.webp
cover_alt: Pica
summary: A modular robot and Grasshopper controller connect design geometry directly to physical prototyping.
role: Leading Contributor
institution: Cornell University · Jenny Sabin Lab
location: ''
tags:
- robotics
- fabrication
- mechatronics
- interaction design
credits:
- 'PI: Jenny Sabin'
- 'Project Lead: Teng Teng'
team:
- Cornell Univeristy / Jenny Sabin Lab
acknowledgements: ''
sections:
- type: gallery
  heading: Project gallery
  images:
  - /assets/media/pica/img-1.webp
  - /assets/media/pica/img-2.webp
  - /assets/media/pica/img-3.webp
  - /assets/media/pica/img-4.webp
  - /assets/media/pica/img-5.webp
  - /assets/media/pica/img-6.webp
  - /assets/media/pica/img-7.webp
  - /assets/media/pica/img-8.webp
  - /assets/media/pica/img-9.webp
  - /assets/media/pica/img-10.webp
  caption: ''
  columns: two
links: []
related_publications:
- title: Related paper (DOI)
  url: https://papers.cumincad.org/cgi-bin/works/paper/caadria2020_436
awards: []
editor_notes: ''
source_links: []
project_type: Fabrication system
project_stage: Research prototype
research_areas:
- interfaces-and-tools
research_order: 1
research_question: What control over robotic fabrication can remain inside a designer’s modeling environment?
contribution: PICA combines an adaptable six-axis arm with geometric control tools. Designers work with geometry
  and toolpaths while the controller translates these into joint motion.
method_steps:
- title: Configure
  text: Adjust a parametric arm model to define link lengths and working range.
- title: Calculate
  text: Use forward and inverse kinematics to connect tool positions with joint angles.
- title: Fabricate
  text: Send motor commands from Grasshopper to the Arduino-based controller.
- title: Compare
  text: Use fabrication trials and an exploratory student study to examine the prototype-making workflow.
contributions:
- Led the development of PICA in Jenny Sabin Lab.
- Developed the robotic hardware and software connection between parametric models and fabrication.
- Coauthored the CAADRIA 2020 research with Jenny Sabin.
evidence: Four hardware iterations examined cost, reach, assembly, and control. Demonstrations included hot-wire
  cutting and hot-glue deposition informed by a scanned clay model. An exploratory study with eight architecture
  students compared workflows using PICA and an industrial robot. The small study supports a bounded account of
  prototype use, not a general claim about learning gains or productivity.
related_projects:
- /teaching/building-robots-for-robotic-fabrication/
- /design/inspire/
---

## A robot configured through design geometry

PICA is a personal fabrication platform developed at Cornell University. Its six-axis arm combines 3D-printed components, stepper motors, and an Arduino-based control system. A parametric model allows link lengths and working range to be adapted to a fabrication task.

Custom Grasshopper components calculate forward and inverse kinematics and translate joint angles into motor commands. This connection keeps geometry, toolpaths, and robotic control within the modeling workflow.

## Physical trials and use

Four hardware iterations explored trade-offs between cost, reach, assembly, and control. Hot-wire cutting and interactive hot-glue deposition tested different end effectors and relationships between source geometry and physical output.

The CAADRIA 2020 paper documents the platform and an exploratory study with eight architecture students. The study is a starting point for examining how a designer-oriented robot changes the steps of prototyping. The subsequent robotics boot camp extends robot construction and control into a teaching sequence.
