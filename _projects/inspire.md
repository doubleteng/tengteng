---
title: 'INSPIRE: Gesture-Based 3D Modeling'
category: research
year: '2014'
published: true
featured: true
featured_order: 3
permalink: /research/inspire/
cover: /assets/media/inspire/prototype-in-use.jpg
cover_alt: A digital wireframe appears above the user’s hand in the InSpire display
summary: An optical see-through interface brings hand gestures, digital geometry, and a responsive viewpoint into
  the same space for architectural sketch modeling.
role: Project lead; interface prototyping and gesture-based modeling
institution: University of Washington
location: Seattle, Washington, USA
tags:
- interface
- computation
- interaction design
credits:
- 'Lead Contributor: Teng Teng'
- 'Research and paper: Teng Teng and Brian R. Johnson'
- 'Project images: Teng Teng (2014)'
team:
- Brian R. Johnson · University of Washington
acknowledgements: ''
sections:
- type: gallery
  heading: Working prototype
  images:
  - /assets/media/inspire/prototype-in-use.jpg
  - /assets/media/inspire/portfolio-slide-15-i06.webp
  columns: two
  image_ratios:
  - 1.333333
  - 1.777778
  caption: A wireframe model appears above the hand (left), and a hand interacts with displayed geometry through
    the transparent screen (right).
- type: video
  anchor: demonstration
  heading: Prototype demonstration
  url: https://www.youtube.com/watch?v=LHzXghdVDZA
  caption: Original demonstration of InSpire’s integrated spatial gesture-based modeling and display.
- type: text
  heading: Bringing the model into reach
  body: 'InSpire is a single-user workstation combining a mini projector, rear-projection surface, adjustable
    semi-reflective screen, Leap Motion sensor, RGB webcam, and tablet. The reflected image and the view through
    the screen overlap, so the user sees digital geometry in the space occupied by their hands. The sensing volume
    and display area are arranged together to support direct spatial interaction.


    The tablet handles commands that have no clear physical gesture, including saving files, deleting objects,
    setting layers, and assigning textures. It sends Open Sound Control (OSC) messages over Wi-Fi. This division
    lets the hands shape and manipulate geometry while the tablet manages the surrounding modeling tasks.'
- type: gallery
  heading: ''
  images:
  - /assets/media/inspire/portfolio-slide-14-i10.webp
  - /assets/media/inspire/tablet-controls.png
  columns: two
  image_ratios:
  - 1.773241
  - 1.374539
  caption: Optical display and tracking arrangement (left), and the tablet command panel beside the gesture-sensing
    area (right).
- type: text
  anchor: gesture-modeling
  heading: Turning hand movement into geometry
  body: 'The prototype is built on **Rhino and Grasshopper**. Leap Motion reports fingertip and palm positions,
    trajectories, and speeds. These data enter Grasshopper over UDP, where Python components extract hand coordinates.
    Gesture rules use finger and palm counts, movement speed, and direction vectors to activate modeling operations.


    In modeling mode, users draw lines, polylines, and curves; create surfaces and volumes; and select, move,
    scale, or rotate objects. A virtual “hot-wire” cutting gesture and control-point adjustments allow an existing
    form to be developed further. Navigation uses a separate trigger mode: two-finger gestures change the camera’s
    direction to move around or through an architectural model.'
- type: gallery
  heading: ''
  images:
  - /assets/media/inspire/modeling-gestures.png
  - /assets/media/inspire/model-navigation.png
  columns: two
  image_ratios:
  - 4.593301
  - 2.926829
  caption: The modeling gesture vocabulary—push, click, drag, select, and move/rotate (left)—and a two-finger
    camera-navigation demonstration (right).
- type: gallery
  heading: Modeling operations
  images:
  - /assets/media/inspire/draw-polyline.png
  - /assets/media/inspire/extrude-polyline.png
  columns: two
  image_ratios:
  - 1.373874
  - 1.373874
  caption: Drawing a polyline directly in space (left) and extruding it into a surface or solid form (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/inspire/draw-curves.png
  - /assets/media/inspire/create-volume.png
  columns: two
  image_ratios:
  - 1.373874
  - 1.373874
  caption: Drawing freeform curves (left) and creating a three-dimensional volume (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/inspire/virtual-hot-wire-cutting.png
  - /assets/media/inspire/move-and-rotate.png
  columns: two
  image_ratios:
  - 1.367713
  - 1.373874
  caption: Editing a form with the virtual hot-wire tool (left) and moving or rotating an object with two hands
    (right).
- type: text
  anchor: tracking
  heading: Keeping hands, model, and viewpoint aligned
  body: '**Head tracking** adds motion parallax: the displayed view changes when the user moves. Two LEDs mounted
    on a pair of glasses provide targets for the RGB webcam. Their image positions and apparent separation are
    used to estimate the viewer’s location and update Rhino’s rendering viewpoint, strengthening the impression
    of looking into a shared three-dimensional workspace.'
- type: gallery
  heading: ''
  images:
  - /assets/media/inspire/head-tracking-glasses.png
  - /assets/media/inspire/portfolio-slide-14-i12.webp
  columns: two
  image_ratios:
  - 1.967949
  - 1.771909
  caption: Glasses fitted with two tracking LEDs (left) and the view-dependent cube display (right).
- type: text
  heading: ''
  body: '**Hand occlusion** addresses a different depth cue. A reflected model can otherwise appear to sit on
    top of the hand even when the hand should be closer to the viewer. InSpire builds a simplified digital hand
    from the sensor data and renders it in flat black. Where that hand lies in front of the model, it masks the
    projected geometry; the dark region remains visually transparent, revealing the real hand beneath.'
- type: gallery
  heading: ''
  images:
  - /assets/media/inspire/portfolio-slide-15-i07.webp
  - /assets/media/inspire/portfolio-slide-15-i08.webp
  columns: two
  image_ratios:
  - 1.597064
  - 1.610368
  caption: Illustrations of the depth conflict (left) and the intended hand–model relationship after occlusion
    correction (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/inspire/hand-depth-before.png
  - /assets/media/inspire/hand-depth-corrected.png
  columns: two
  image_ratios:
  - 1.381279
  - 1.384454
  caption: 'Prototype photographs documenting the hand–geometry depth relationship before and after the occlusion
    adjustment. Source: ACADIA 2014, Figure 8.'
- type: text
  anchor: scope
  heading: Research contribution and scope
  body: 'InSpire demonstrates an integrated system for creating, editing, and viewing freeform geometry through
    spatial gestures. I led the research at the University of Washington. Presented at **ACADIA
    2014**, the work connects interface design, computational geometry, optical display, and human–computer interaction
    in an architectural modeling tool.


    The paper documents the working prototype and application scenarios. It does not report a controlled measurement
    of gains in modeling speed or design quality. Its strongest application is early massing and schematic exploration:
    vision-based positioning is approximate, the prototype lacks CAD-style object snapping and tactile feedback,
    and the workstation serves one user. More precise constraints, haptic feedback, and shared modeling were identified
    as directions for further development.'
- type: text
  heading: Publication
  body: 'Teng, T. and Johnson, B. R. (2014). **“InSpire: Integrated Spatial Gesture-Based Direct 3D Modeling and
    Display.”** *ACADIA 2014: Design Agency*, pp. 445–452.


    [Read the full paper](/assets/papers/inspire-acadia-2014.pdf) · [Publication record](https://doi.org/10.52842/conf.acadia.2014.445)'
links:
- title: Full paper · PDF
  url: /assets/papers/inspire-acadia-2014.pdf
- title: Prototype demonstration · YouTube
  url: https://www.youtube.com/watch?v=LHzXghdVDZA
related_publications:
- title: 'Inspire: Integrated Spatial Gesture-based Direct 3D Modeling and Display'
  url: https://doi.org/10.52842/conf.acadia.2014.445
  publication_id: teng2014inspire
awards: []
editor_notes: '延续用户对 Pinbed/PICA 的排版要求：无 money shot、无顶部大图、无轮播；每行两张，同方向、按竖向显示高度对齐；image_ratios 取图片原始宽高比，不裁切、不拉伸。封面仅用于索引卡片与分享预览。

  已阅读 ACADIA 2014 论文全文8页，结合旧站与现有作品集图像综合表述。角色沿用现站的 Leading Contributor，不擅自将 Brian R. Johnson 改为 PI 或导师。论文署名 Teng
  Teng / Brian R. Johnson，图像署名 Teng Teng (2014)。

  正文包含光学透视显示、Leap Motion 手部感测、UDP/Python/Grasshopper、OSC平板命令、手势建模、双LED视点跟踪与黑色手代理遮挡机制。论文只有原型展示与初步反馈，未报告受控生产率实验。明确精细定位、对象捕捉、触觉与单用户限制。

  媒体去重：不使用旧站电影参考图、现站蓝色占位图；重复图优先保留当前作品集较高清版本，六张建模截图用旧站原始BMP无损转换PNG，其余补充论文原图。18张静态图分9组双栏。

  视频要求已按用户最新说明修正：保留旧站公开视频 LHzXghdVDZA 的 YouTube 嵌入，放在首组实拍之后；下载限制不等于嵌入限制。旧站另一段 1n2uM-zQDpQ 已设为私密，未添加无效播放器。图片仍为9组双栏等高，且无顶部大图。

  '
source_links:
- http://ttistengteng.com/html/pic/d/450.html
- http://papers.cumincad.org/data/works/att/acadia14_445.content.pdf
project_type: Spatial modeling interface
project_stage: Working research prototype and application demonstrations
research_areas:
- interfaces-and-tools
research_order: 2
contributions:
- Development of the integrated gesture-modeling and optical display prototype
- Rhino/Grasshopper interaction tools connecting hand data to geometry operations
- Integration of hand tracking, viewpoint updates, and display occlusion
- Modeling and navigation demonstrations; first authorship of the ACADIA 2014 paper
related_projects:
- /research/transformable-physical-design-media/
- /research/pica/
cover_preview_only: true
primary_link:
  title: Read the paper · ACADIA 2014
  url: /assets/papers/inspire-acadia-2014.pdf
research_question: How can hand gestures and digital geometry share one visual space for architectural sketch modeling?
role_summary: Led the project and developed the interface, gesture-modeling tools, tracking integration, and working
  prototype.
evidence_summary: Prototype video and modeling demonstrations show gesture control, viewpoint updates, and display
  occlusion; the ACADIA 2014 paper describes the system.
related_connections:
- url: /research/transformable-physical-design-media/
  reason: Physical manipulation linked to digital geometry and feedback
- url: /research/pica/
  reason: Direct manipulation as an input to digital design and making
reading_path:
- title: Demonstration
  target: demonstration
- title: Gesture modeling
  target: gesture-modeling
- title: Tracking
  target: tracking
- title: Scope
  target: scope
evidence_target: demonstration
---
InSpire is an interactive 3D modeling system that places **hand gestures and digital geometry in the same visual space**. An optical see-through display, hand sensing, and head tracking let a designer create, reshape, and inspect a model through spatial movement.

I led the project and developed the prototype at the University of Washington. The project explores how the coordination of hand, eye, and model can support architectural schematic design, bringing the immediacy of making and handling a physical model into a digital workflow.

