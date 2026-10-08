---
title: 'PICA: Personal Robotic Fabrication'
category: research
year: 2019–2020
published: true
featured: true
featured_order: 2
permalink: /research/pica/
cover: /assets/media/pica/assembled-prototype.jpg
cover_alt: PICA six-axis robotic arm with its controller
summary: A low-cost, six-axis robot connects Rhino/Grasshopper, real-time control, and hands-on fabrication for
  sketch-level architectural prototyping.
role: Project lead; robotic hardware, control software, and fabrication experiments
institution: Cornell University · Jenny Sabin Lab
location: Ithaca, New York, USA
tags:
- robotics
- fabrication
- mechatronics
- interaction design
credits:
- 'Project Lead: Teng Teng'
- 'PI: Jenny Sabin'
- 'Paper authors: Teng Teng and Jenny Sabin'
team:
- Cornell University · Jenny Sabin Lab
acknowledgements: ''
sections:
- type: gallery
  anchor: working-prototypes
  heading: Prototypes and fabrication
  images:
  - /assets/media/pica/assembled-prototype.jpg
  - /assets/media/pica/hot-glue-deposition.jpg
  columns: two
  image_ratios:
  - 1.002342
  - 1.0
  caption: The assembled six-axis arm and controller (left), and hot-glue deposition with a replaceable end effector
    (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/pica/printed-components.jpg
  - /assets/media/pica/hot-wire-setup.jpg
  columns: two
  image_ratios:
  - 2.066773
  - 2.056555
  caption: 3D-printed parts, motors, and transmission components before assembly (left); PICA configured for hot-wire
    foam cutting (right).
- type: text
  anchor: user-study
  heading: What the study found
  body: 'The CAADRIA paper reports a study with **eight Cornell architecture students**, divided by prior digital-fabrication
    experience. Each participant completed two 15-minute tasks: making a vase from an assigned reference using
    clay manipulation and PICA, and modeling another vase in Rhino for fabrication with an ABB IRB 4600. Completion
    was measured by the printed proportion of the vase: a fully printed vase scored 5, 80% completion scored 4,
    and so on.


    | Fabrication workflow | Junior fabricators | Senior fabricators | Overall mean |

    | --- | ---: | ---: | ---: |

    | PICA with direct manipulation | 4.75 | 4.00 | 4.375 |

    | IRB 4600 with the conventional workflow | 2.00 | 3.00 | 2.50 |


    The higher completion scores support PICA’s potential for rapid, sketch-level prototyping in this experiment.
    The comparison changed both the robot and the modeling workflow, so it does not isolate a hardware effect
    or establish a general productivity advantage. The project’s contribution is an integrated, affordable platform
    through which designers can build a robot, work directly with geometry, and test ideas through fabrication.'
- type: text
  heading: Testing two fabrication approaches
  body: '**Hot-wire cutting** translates surfaces modeled in Rhino/Grasshopper into the arm’s motion. A wire mounted
    on a custom end effector cuts foam blocks into a family of curved forms, testing the connection between surface
    geometry, tool orientation, and physical output.


    **Interactive hot-glue deposition**, the application examined in the paper, starts with a clay vase shaped
    by hand on a turntable. Two infrared depth scanners capture the changing form. Rhino/Grasshopper reconstructs
    the geometry and generates a surrounding toolpath, while PICA deposits a corresponding form using a modified
    glue gun and a motor-driven feed. The heated tool can also push or drag the deposited wall as the source shape
    changes. Material cooling and the relatively coarse glue feed limited precision; the aim was an adaptable
    working model during concept development.'
- type: gallery
  heading: ''
  images:
  - /assets/media/pica/foam-cutting-results.jpg
  - /assets/media/pica/surface-toolpath.jpg
  columns: two
  image_ratios:
  - 1.689266
  - 1.473684
  caption: Foam models produced by hot-wire cutting (left) and the corresponding surface geometry used to develop
    the fabrication paths (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/pica/clay-scan-workflow.jpg
  - /assets/media/pica/printed-vases.jpg
  columns: two
  image_ratios:
  - 1.644416
  - 2.037618
  caption: Hand-shaped clay captured as a point cloud and reconstructed geometry (left), and examples of the resulting
    hot-glue vase prototypes (right).
- type: text
  anchor: hardware
  heading: A robot designers can build and adapt
  body: 'PICA begins with a parametric joint–link model in Grasshopper. Link lengths define the robot’s configuration
    and working range; changing a segment allows a new part to be printed while updating the corresponding kinematic
    model. The platform combines a printed base, shoulder, arm, wrist, and interchangeable end effectors.


    The project progressed from early servo-driven interaction prototypes to stepper-driven fabrication arms.
    The portfolio documents four hardware iterations. The fabrication configuration uses **seven bipolar stepper
    motors across six axes**, with NEMA 23, NEMA 17, and NEMA 14 motors selected according to joint loads. Timing-belt
    transmissions and geared reducers provide the required torque within a compact printed structure. The portfolio’s
    bill of materials totals **US$748 at the time of the research**, consistent with the paper’s reported cost
    of under US$800.'
- type: gallery
  heading: ''
  images:
  - /assets/media/pica/exploded-assembly.png
  - /assets/media/pica/joint-transmissions.png
  columns: two
  image_ratios:
  - 0.727982
  - 0.783898
  caption: Exploded assembly with motor and transmission labels (left), and joint mechanisms showing the belt
    drives and axis arrangement (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/pica/parametric-links.jpg
  - /assets/media/pica/control-circuit.jpg
  columns: two
  image_ratios:
  - 1.773533
  - 1.685144
  caption: The joint–link model and alternative arm lengths (left); the Arduino control circuit and motor-driver
    connections (right).
- type: text
  anchor: control
  heading: From geometry to joint motion
  body: 'I developed custom Grasshopper components for both forward and inverse kinematics. Direct joint-angle
    inputs support positioning and motion tests. For fabrication, the inverse-kinematics component starts from
    an end effector’s position and orientation, checks reachability, and calculates joint angles using geometric
    analysis and Denavit–Hartenberg parameters. Candidate poses are filtered against the task constraints and
    a shortest-path criterion.


    The resulting joint angles are converted into motor steps, accounting for transmission ratios. In the system
    documented in the paper, Grasshopper streams commands over **UDP/Ethernet to an Arduino Mega**, which drives
    the motors through stepper drivers. This keeps geometry, toolpaths, and robot control within the designer’s
    modeling environment and allows commands to change during fabrication without a separate robot-language programming
    stage.'
- type: gallery
  heading: ''
  images:
  - /assets/media/pica/forward-kinematics.jpg
  - /assets/media/pica/inverse-kinematics.jpg
  columns: two
  image_ratios:
  - 3.223235
  - 4.018919
  caption: Forward-kinematics control through individual joint angles (left) and inverse-kinematics control from
    a fabrication toolpath (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/pica/grasshopper-simulation.gif
  - /assets/media/pica/gesture-control.gif
  columns: two
  image_ratios:
  - 1.941748
  - 1.764706
  caption: Grasshopper motion simulation (left) and a gesture-control demonstration from the project archive (right).
    Both are looping GIFs.
- type: gallery
  heading: ''
  images:
  - /assets/media/pica/arm-motion.gif
  - /assets/media/pica/hot-wire-end-effector.png
  columns: two
  image_ratios:
  - 0.756501
  - 0.77453
  caption: Physical motion test of the assembled arm (left, looping GIF) and the hot-wire end-effector design
    (right).
- type: text
  heading: Publication
  body: 'Teng, T. and Sabin, J. (2020). **“PICA: A Designer Oriented Low-Cost Personal Robotic Fabrication Platform
    for Sketch Level Prototyping.”** *RE: Anthropocene — Proceedings of the 25th CAADRIA Conference*, Volume 2,
    pp. 473–483.


    [Read the full paper](https://drive.google.com/file/d/1oLjuYMiO45a3WtiozpaBjIVz4ZCrXU8L/view) · [Publication
    record](https://papers.cumincad.org/cgi-bin/works/paper/caadria2020_436) · [Related robotics teaching project](/teaching/building-robots-for-robotic-fabrication/)'
links: []
related_publications:
- title: PICA - A Designer Oriented Low-Cost Personal Robotic Fabrication Platform for Sketch Level Prototyping
  url: https://doi.org/10.52842/conf.caadria.2020.2.473
  publication_id: teng2020pica
awards: []
editor_notes: '用户要求：不设 money shot 或顶部单张大图；每行两张，所有项目图片和 GIF 双栏排列，同方向配对，image_ratios 使用实际宽高比以按显示高度对齐，不裁切、不拉伸。cover
  仅用于索引与分享预览。

  综合表述已阅读完整 CAADRIA 2020 论文（11页）和4页作品集，以论文为主要依据。论文记录 Ethernet/UDP，优先于旧站简化的USB描述；作品集记载四次硬件迭代与当时748美元材料成本。明确八人研究的任务、评分、数值及机器人与流程同时改变的限制。

  静态图优先从PDF提取原始图像，标注图从PDF高分辨率渲染。旧站2268×2268打印实拍优于作品集版本。Drive Picture1.gif仅一帧、低分辨率，未作为动画重复加入；旧站新年演示与已有运动展示重复，未加入。两个独有MP4转为完整循环GIF；手势GIF保留完整9.6秒演示，降低尺寸和帧率适配网页。无video或iframe。

  '
source_links:
- http://ttistengteng.com/html/pic/d/468.html
- https://drive.google.com/drive/folders/1w9fBA4OPfMUiZiBT0RTHWxt36ofUjpzV
project_type: Personal robotic fabrication platform
project_stage: Research prototypes, fabrication trials, and exploratory user study
research_areas:
- interfaces-and-tools
research_order: 1
contributions:
- Parametric robotic-arm design, prototyping, and assembly
- Motor selection, transmission design, and Arduino control integration
- Grasshopper components for forward and inverse kinematics
- Hot-wire cutting and interactive hot-glue fabrication experiments
- Usability study and first authorship of the CAADRIA 2020 paper
related_projects:
- /research/robosense/
- /teaching/building-robots-for-robotic-fabrication/
- /research/minimum-device-maximum-space/
cover_preview_only: true
primary_link:
  title: Read the paper · CAADRIA 2020
  url: https://drive.google.com/file/d/1oLjuYMiO45a3WtiozpaBjIVz4ZCrXU8L/view
research_question: How can a low-cost, adaptable robot support sketch-level fabrication by designers?
role_summary: Led the project; developed robotic hardware, electronics, kinematics, control software, and fabrication
  applications.
evidence_summary: Working prototypes and an eight-participant study compare task completion. Results support sketch-level
  use within that small study, not a general robot-performance ranking.
related_connections:
- url: /research/robosense/
  reason: Live interaction between modeling and robotic fabrication
- url: /teaching/building-robots-for-robotic-fabrication/
  reason: Building and programming adaptable six-axis robots
- url: /research/minimum-device-maximum-space/
  reason: Extending a compact robot through custom fabrication end effectors
reading_path:
- title: Working prototypes
  target: working-prototypes
- title: User study
  target: user-study
- title: Hardware
  target: hardware
- title: Control
  target: control
evidence_target: working-prototypes
evidence_first: 3
---
PICA is a personal robotic fabrication platform for making **sketch-level architectural prototypes**. It brings together a configurable six-axis arm, custom Grasshopper controls, and replaceable fabrication tools so that designers can move from a digital or hand-shaped idea to a physical working model.

I led the project at Cornell University’s Jenny Sabin Lab, developing its hardware and software. Published at CAADRIA 2020, the research asks how robotic fabrication can become affordable and accessible during early design, when forms are still changing and direct engagement with a model can help generate the next idea.

