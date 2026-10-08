---
title: Pinbed
category: research
year: '2020'
published: true
featured: false
featured_order: 99
permalink: /research/pinbed/
cover: /assets/media/pinbed/prototype-printing-setup.jpg
cover_alt: Pinbed prototype beside the robotic arm, supporting an initial printed component
summary: A reconfigurable 6 × 6 actuator bed, with custom electronics and Grasshopper control, supports nonplanar
  robotic additive manufacturing.
role: Project lead; mechanical design, electronics, and control software
institution: Cornell University · Jenny Sabin Lab
location: Ithaca, New York, USA
tags:
- robotics
- fabrication
- nonplanar printing
- mechatronics
credits:
- 'PI: Jenny Sabin (Cornell University)'
- 'Project Lead and Main Contributor: Teng Teng'
team:
- Cornell University | Jenny Sabin Lab
acknowledgements: ''
sections:
- type: gallery
  anchor: printing-tests
  heading: Prototype and printing tests
  images:
  - /assets/media/pinbed/prototype-printing-setup.jpg
  - /assets/media/pinbed/printed-surface-test.jpg
  columns: two
  caption: Initial printing tests — the robot and assembled printbed (left), and the deposited component supported
    by the bed (right).
  image_ratios:
  - 1.4549
  - 1.451243
- type: gallery
  heading: ''
  images:
  - /assets/media/pinbed/actuator-frame-assembly.jpg
  columns: two
  caption: Assembly — the 6 × 6 actuator array mounted in its wooden frame, before the flexible printing surface
    is installed.
- type: text
  anchor: actuation
  heading: Structure and actuation
  body: |-
    The prototype has an approximately **30 × 30-inch working area** and **6 inches of vertical travel**. Its 36 linear actuators form a 6 × 6 grid. Flexible metal strips span the actuator heads and support a cast silicone-rubber printing surface, translating the individual pin heights into a continuous bed.

    Each actuator combines a 12 V DC motor, an 11.5:1 geared reducer, and a lead screw. A magnet and Hall-effect sensor register motor rotation, allowing the controller to estimate actuator travel. The frame carries the actuator holders, power supply, and control modules, with wheels for moving the prototype within the lab.
- type: gallery
  heading: ''
  images:
  - /assets/media/pinbed/actuator-wiring.jpg
  - /assets/media/pinbed/physical-configuration.png
  columns: two
  caption: Assembly wiring (left) and the labelled mechanical configuration (right), including the flexible
    surface, actuator mechanism, frame, and electronics.
  image_ratios:
  - 0.743527
  - 0.727273
- type: text
  anchor: control
  heading: Electronics and Grasshopper control
  body: |-
    I designed and fabricated three PCB-based control modules, each serving 12 linear actuators. H-bridge drivers control the DC motors, while Hall-effect feedback records their rotation. The modular arrangement was intended to allow additional actuator groups to be connected for a higher-resolution bed.

    I also developed a Grasshopper plugin that samples a target surface into a 6 × 6 grid and converts the sampled heights into actuator commands. A wireless serial connection links the computer to the Arduino-based modules, carrying motor-speed and rotation-count commands.
- type: gallery
  heading: ''
  images:
  - /assets/media/pinbed/control-module-circuit.jpg
  - /assets/media/pinbed/grasshopper-height-control.jpg
  columns: two
  caption: Control-module circuit design (left) and the Grasshopper interface for translating surface geometry
    into actuator heights and motion commands (right).
  image_ratios:
  - 1.793462
  - 2.569966
- type: text
  heading: Reconfiguration and the robot workflow
  body: |-
    The same digital surface provides both the target bed geometry and a reference for generating the robot’s printing toolpath. At each deposition position, the end effector is oriented to the local surface normal. This shared geometry coordinates the adjustable support surface with the robot’s motion.

    The GIF shows the actuator array changing configuration alongside the robotic arm. The accompanying diagram traces the connection from Grasshopper through the serial link, Arduino, motor drivers, and Hall-effect feedback, alongside the robot-control branch.
- type: gallery
  heading: ''
  images:
  - /assets/media/pinbed/reconfiguration.gif
  - /assets/media/pinbed/control-workflow.jpg
  columns: two
  caption: Reconfiguration demonstration (left, looping GIF) and the software–electronics–robot communication
    workflow (right).
  image_ratios:
  - 1.324503
  - 2.662037
- type: text
  anchor: scope
  heading: Research scope
  body: The work produced an assembled and programmed printbed, custom control electronics, a Grasshopper interface,
    and initial printing tests. It explored a reusable support surface for curved deposition as part of my
    master’s research into bio-inspired architectural geometry. Fabricating larger architectural components
    remained a direction for further development at this prototype stage.
links: []
related_publications:
- title: Interactive Fabrication and Design of Bioinspired Surface Geometry
  url: https://hdl.handle.net/1813/110467
  publication_id: teng2021masters
awards: []
editor_notes: |-
  用户要求：无 money shot，无顶部大图、无轮播；所有项目图片和 GIF 采用双栏。按竖向显示高度排版，横图只与横图并排，竖图只与竖图并排。每对图的 image_ratios 按原始宽高比设置，使两张图等高，保留完整比例、不裁切、不拉伸；装配横图单独保留半栏，避免为了凑对而重复图片。封面仅用于索引卡片和分享预览。
  动态内容只使用 GIF，不添加 video/iframe。现有 GIF 与 MP4 为同一段演示，网页GIF保留完整动作顺序与15.9秒总时长，以400像素宽、80帧降低加载体积；不重复加入MP4。
  PDF 中2984×2051原型照片替代Picture1.jpg；从PDF右栏提取含原始标注的高清机械结构图，替代Picture2.jpg。其余使用Drive独立图。保留3张横向照片、1张竖向装配照片、4张技术/流程图及1张GIF，共9项。
  文字依据旧站及作品集；作品集记录2020年9月至12月、Cornell independent study/master thesis research。保留现有PI Jenny Sabin及Project Lead and Main Contributor Teng Teng署名。不给项目添加建筑幕墙类职责。
  原型规格：6×6共36个执行器，约30×30英寸工作范围，6英寸行程；三组自制PCB控制模块，每组12个执行器。只陈述原型和初步打印试验，不添加精度、速度或建成全尺寸建筑构件的未经证实结论。
source_links:
- http://ttistengteng.com/html/pic/d/511.html
- https://drive.google.com/drive/folders/1DHJugWukhGd6TKNgSbecBuh-4KlDy4bn
project_type: Reconfigurable fabrication system
project_stage: Research prototype and initial printing tests
research_areas:
- interfaces-and-tools
research_order: 5
cover_preview_only: true
contributions:
- Mechanical design, fabrication, and assembly of the 36-actuator printbed
- Design and fabrication of three PCB-based motor-control modules
- Wiring, actuator programming, and Hall-effect rotation feedback
- Grasshopper interface linking target surface geometry to actuator heights and robot toolpaths
- Prototype integration and initial robotic printing tests
research_question: How can a reconfigurable printbed support robotic deposition on nonplanar surfaces?
role_summary: Led mechanical design, electronics, actuator control, Grasshopper integration, assembly, and initial
  printing tests.
evidence_summary: A working 36-actuator bed, custom control boards, and initial robot-printing tests demonstrate
  reconfiguration; structural performance of prints is not established.
related_projects:
- /research/robosense/
- /research/minimum-device-maximum-space/
related_connections:
- url: /research/robosense/
  reason: Hardware and control for nonplanar robotic deposition
- url: /research/minimum-device-maximum-space/
  reason: Using a receiving surface to extend robotic deposition
reading_path:
- title: Printing tests
  target: printing-tests
- title: Actuation
  target: actuation
- title: Control
  target: control
- title: Scope
  target: scope
evidence_target: printing-tests
---
Pinbed is a reconfigurable printing bed for robotic additive manufacturing. Inspired by multi-point forming, it uses an array of independently driven pins to generate different nonplanar support surfaces from a digital model.

Developed in 2020 as part of my master’s research at Cornell University’s Jenny Sabin Lab, the project connects **mechanical design, custom electronics, and Grasshopper control** in one fabrication system. I led the prototype development, including its construction, wiring, programming, and initial printing tests.

