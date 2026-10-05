---
title: 'Robosense 3.0: Adaptive Robotic Clay Printing'
card_title: 'Robosense 3.0'
category: research
year: '2025'
published: true
featured: false
featured_order: 99
permalink: /research/robosense/
cover: /assets/media/robosense/thumbnail.webp
cover_alt: CERA III depositing a clay prototype with a robot-mounted auger extruder
cover_preview_only: true
summary: A modular clay extrusion system combines calibrated material delivery with live toolpath control, allowing designers to adjust geometry and recover interrupted prints during fabrication.
role: Major Contributor; hardware, motor calibration, and PulseControl development
institution: Cornell University · Jenny Sabin Lab
location: Ithaca, New York, USA
project_type: Robotic hardware and control software
project_stage: Research prototypes; journal publication
tags:
- robotic fabrication
- additive manufacturing
- ceramics
- mechatronics
- interaction design
research_areas:
- material-computation
- interfaces-and-tools
contributions:
- Development of the extrusion hardware and motor-calibration workflow
- PulseControl Grasshopper component and Arduino motor-control firmware
- Nonplanar printing experiments with scutoid geometries
- Research methodology, analysis, visualization, and manuscript preparation
credits:
- 'Research, methodology, software, and hardware: Eda Begum Birol, Teng Teng, Mahshid Moghadasi'
- 'PulseControl: Teng Teng'
- 'DYNPath: Mahshid Moghadasi'
- 'Hardware and material development: Alexia Asgari, Kevin Guo, Karolina Piorko, Veronika Varga'
- 'Principal investigator: Jenny E. Sabin'
team: []
related_publications:
- title: 'Robosense 3.0: CERA III Adaptive Robotic Clay Printing'
  publication_id: birol2024robosense
  url: https://journals.sagepub.com/doi/abs/10.1177/23297662251388855
links:
- title: PulseControl — source code
  url: https://github.com/doubleteng/PulseControl
- title: DYNPath — source code
  url: https://github.com/Mahshid-Moghadasi/DynPath
sections:
- type: text
  heading: Separating material supply from deposition
  body: |
    CERA III separates clay delivery into two independently driven stages. A motorized piston pushes material from a reservoir through a hose; an auger mounted on the ABB IRB 4600 meters the clay through the nozzle. This separation gives the system control over both material supply and local deposition.

    A worm-gear screw jack increases the piston drive's torque, while a closed-loop stepper motor stops under excessive resistance. The assembly connects replaceable mechanical components to a parametric calibration model, allowing changes in reservoir, auger, and nozzle dimensions to be reflected in motor settings.
- type: gallery
  images:
  - /assets/media/robosense/extrusion-system.webp
  - /assets/media/robosense/extrusion-calibration.webp
  columns: two
  caption: CERA III assembly and robot-mounted configuration (left); travel-speed, nozzle-size, and layer-height calibration studies (right).
- type: text
  heading: Calibrating the flow
  body: |
    PulseControl connects Grasshopper to Arduino firmware for direct adjustment of stepper-motor speed and direction. A volumetric model relates piston displacement to auger rotation so that clay supplied through the hose matches the amount leaving the extruder. The motor settings are then calibrated against the robot's travel speed and the clay mixture.

    Cylinder tests show how excessive travel speed interrupts deposition, while nozzle tests document bead and layer dimensions across **4.5, 7, and 9 mm nozzle diameters**. These tests connect hardware settings to the continuity and resolution of the printed material.
- type: text
  heading: Changing the toolpath during printing
  body: |
    DYNPath sends successive toolpath points from Grasshopper through the MACHINA bridge. Between commands, the designer can offset a layer, translate the path in X, Y, or Z, and change the tool-center-point speed. Updates affect the remaining points in the current layer, allowing the printed form to develop through decisions made during fabrication.

    This control also supports print recovery. In the documented layer-skipping test, a **4.5 mm downward correction** reconnects deposition with the existing print. Without that intervention, continued extrusion produces an unsuccessful build. The adjustment is made by the designer in response to the observed material condition.
- type: gallery
  images:
  - /assets/media/robosense/dynamic-toolpath-workflow.webp
  - /assets/media/robosense/print-recovery.webp
  columns: two
  caption: Point-by-point toolpath execution with live offsets, XYZ translation, and speed control (left); recovery of a print after skipped layers (right).
- type: video-gallery
  videos:
  - heading: Live toolpath control in Grasshopper and MACHINA
    file: /assets/videos/robosense/dynamic-toolpath-control.mp4
    poster: /assets/media/robosense/dynamic-toolpath-poster.webp
  - heading: CERA III clay deposition
    file: /assets/videos/robosense/clay-printing.mp4
    poster: /assets/media/robosense/clay-printing-poster.webp
  caption: Supplementary recordings show the software-control workflow (left) and robot-mounted clay deposition (right).
- type: text
  heading: Designing through deposition
  body: |
    Inward and outward path offsets produce different wall profiles from the same initial cylinder toolpath. Further experiments combine path and speed changes to vary the deposited texture, while a MIDI controller gives designers a physical interface for adjusting the print in progress.
- type: gallery
  images:
  - /assets/media/robosense/toolpath-design-variations.webp
  - /assets/media/robosense/adaptive-clay-prototypes.webp
  columns: two
  caption: Controlled path variations applied during printing (left); interactive forms and column studies from Digital Impromptu by Mahshid Moghadasi (right).
- type: text
  heading: Architectural components and nonplanar printing
  body: |
    PolyBrick 2.0 tests the system's capacity to produce porous lattice components through controlled deposition and start-stop sequences. Scutoid experiments use nonplanar toolpaths and the robot's range of motion to print cell-derived components and curved assemblies.
- type: gallery
  images:
  - /assets/media/robosense/polybrick-lattice-printing.webp
  - /assets/media/robosense/nonplanar-scutoid-printing.webp
  columns: two
  caption: PolyBrick 2.0 printing and prototypes by Eda Begum Birol (left); nonplanar scutoid prototypes from Interactive Fabrication and Design of Bioinspired Surface Geometry by Teng Teng (right).
source_links:
- https://journals.sagepub.com/doi/abs/10.1177/23297662251388855
- https://drive.google.com/drive/folders/1IVaBSc3cc7V8EKGziswdyvNw39iM9zA1
---

Robosense 3.0 develops **CERA III**, a two-stage robotic clay extruder, together with software for motor calibration and real-time path adjustment. Developed at Cornell University's Jenny Sabin Lab, the system connects material delivery to robotic motion while keeping the designer able to intervene during a print.

Clay flow varies with moisture, internal pressure, and nozzle conditions. The research addresses these variations through calibrated feeding and extrusion, followed by live corrections or geometric changes in response to the material being deposited.
