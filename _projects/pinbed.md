---
title: Pinbed
category: research
year: '2019'
published: true
featured: false
featured_order: 99
permalink: /research/pinbed/
cover: /assets/media/pinbed/hero.webp
cover_alt: Pinbed
summary: A reconfigurable printbed provides adjustable support for robotic deposition on nonplanar surfaces.
role: ''
institution: ''
location: ''
tags:
- fabrication
- robotics
credits:
- 'PI: Jenny Sabin (Cornell University)'
- 'Project Lead and Main Contributor: Teng Teng'
team:
- Cornell University | Jenny Sabin Lab
acknowledgements: ''
sections:
- type: gallery
  heading: Project gallery
  images:
  - /assets/media/pinbed/img-2.webp
  - /assets/media/pinbed/img-3.webp
  - /assets/media/pinbed/img-4.webp
  - /assets/media/pinbed/img-5.webp
  - /assets/media/pinbed/img-6.webp
  caption: ''
  columns: two
links: []
related_publications: []
awards: []
editor_notes: ''
source_links: []
---

This is a work-in-progress fabrication tool development project I am currently working on at Cornell University. As my current thesis focuses on designing and fabricating bio-inspired complex surface geometry, the main constrain is printing curved surface geometry through robotic additive manufacturing.

The project aims to address the problem by developing an easy use and reconfigurable 2.5-D printbed to help the robot print complex architectural components. The limited capability of depositing material on nonplanar surfaces has been recognized as one of the universal challenges for additive manufacturing. Much work in the field has been done to solve this issue, but they are mostly focusing on modifying current FDM 3d printer firmware or taking advantage of the multiple detentions of freedom of a robotic arm to print along statically curved surfaces for small scale experimental prototyping. But there are fewer works that have been done at a large scale for producing architectural components or fail to provide an adaptive solution of generating different printing surfaces.

The idea of this reconfigurable 2.5-D printbed was inspired by multi-point forming technology that has been wildly used in aerospace manufacturing and shipbuilding for precisely forming sheet metal. I found this technology suits well for robotic additive manufacturing to generate nonplanar printing surface..

I have designed and fabricated 3 PCB boards and made 3 control modules out of them. Each control model contains 6 H. bridges, that being said, each control module is capable of controlling 12 linear actuators. If the project demands a higher resolution reconfigurable 2.5-D printbed, the user just needs to attach more linear actuators with another control module.

A grasshopper plugin was also developed to connect and control each control module. The Grasshopper plugin converts a surface into a 6\*6 points grid and sends the height information to the serial port. The information sends to Arduino wirelessly from the serial port through TTL, which gives the printbed more mobility. Arduino is receiving two types of data: the linear actuator's speed and the number of rotations. While the H-bridge drives the motor, the hall sensor attached to the bottom of the motor reads the number of rotations so that the system knows how far the linear actuator has traveled. Meanwhile, the surface in Grasshopper can be used for generating a toolpath for the robot arm, so the robot and the printed could be synchronizing together to conduct additive manufacturing.
