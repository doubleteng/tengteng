---
title: 'Building Robots: From Assembly to Fabrication and Interaction'
category: teaching
year: 2021–2024
published: true
featured: false
featured_order: 99
permalink: /teaching/building-robots-for-robotic-fabrication/
cover: /assets/media/building-robots-for-robotic-fabrication/robot-assembly-poster.webp
cover_preview_only: true
cover_alt: A desktop robotic arm assembled from individual mechanical parts and servos
summary: Students assemble and program robotic arms, then use their understanding of motion and control to develop fabrication
  or interaction applications.
role: Course designer and instructor
institution: ''
location: Online lectures and remote studio sessions
project_type: Robotics workshop · six offerings
project_stage: Robot construction and student applications
tags:
- robotics
- kinematics
- motor control
- fabrication
- interaction
credits:
- 'Course design and instruction: Teng Teng'
- 'Application projects and documentation: students'
team: []
acknowledgements: ''
sections:
- type: text
  anchor: robot-assembly
  heading: From components to a working robot
  body: '1. **Assemble.** Build the base, arm, wrist, and end-effector mount from individual parts; install the
    servos and connect the control board. Assembly makes joint axes, link lengths, movement limits, and mechanical
    connections tangible.

    2. **Model.** Reconstruct the physical arm in Grasshopper. Use forward kinematics to relate joint angles to
    the tool pose, and calculate inverse kinematics to find joint angles for a target position and orientation.

    3. **Control.** Develop motor-control algorithms that translate joint angles into timed servo commands. Learn
    how serial communication and pulse-width modulation (PWM) connect the digital model to physical movement, then
    calibrate and test the assembled arm.

    4. **Apply.** Develop a fabrication or interaction application using the same robot. Design an end effector,
    plan its motion, test the process, and revise the hardware or control logic in response to the results.'
- type: video
  heading: Assembly from individual parts
  file: /assets/videos/building-robots/robot-assembly.mp4
  poster: /assets/media/building-robots-for-robotic-fabrication/robot-assembly-poster.webp
  caption: Assembly footage shows the progression from loose components and servos to a desktop robotic arm.
- type: image
  heading: Connecting geometry, electronics, and movement
  image: /assets/media/building-robots-for-robotic-fabrication/assembly-kinematics-servo-control.webp
  alt: Student diagram of six joint axes, seven servos, inverse kinematics, mechanical assembly, serial commands,
    and PWM control
  caption: Student documentation traces the control chain from a geometric model and joint angles to serial commands,
    a servo controller, and physical motion. The shoulder uses two coordinated servos.
- type: video
  anchor: control
  heading: Grasshopper motion control
  file: /assets/videos/building-robots/grasshopper-motion-control.mp4
  poster: /assets/media/building-robots-for-robotic-fabrication/grasshopper-motion-control-poster.webp
  caption: A control demonstration connects the Grasshopper model with the assembled arm and its changing pose.
- type: video
  heading: Testing the assembled arm
  file: /assets/videos/building-robots/robot-control-demonstration.mp4
  poster: /assets/media/building-robots-for-robotic-fabrication/robot-control-demonstration-poster.webp
  caption: A second demonstration records the operator, controller, and robot together during motion tests.
- type: text
  anchor: student-work
  heading: 'Robotic winding: Traditional Yurt'
  body: '**Fall 2024 · Individual student project.** *Robotic Rhythms of the Traditional Yurt* applies the assembled
    arm to winding twine around wooden frames. The student developed the kinematic model, planned winding points
    and sequences, and produced modules for a 1:100 pavilion model inspired by the structure of a traditional yurt.


    The project records inverse-kinematics calculations, servo control, a threading-needle end effector, three winding
    patterns, and magnetic connections between modules. The final model brings the robot''s motion planning and
    a material assembly process into one design exercise.'
- type: gallery
  heading: Yurt project documentation
  images:
  - /assets/media/building-robots-for-robotic-fabrication/yurt-winding-01.webp
  - /assets/media/building-robots-for-robotic-fabrication/yurt-winding-02.webp
  - /assets/media/building-robots-for-robotic-fabrication/yurt-winding-03.webp
  - /assets/media/building-robots-for-robotic-fabrication/yurt-winding-04.webp
  - /assets/media/building-robots-for-robotic-fabrication/yurt-winding-05.webp
  columns: two
  caption: Five boards cover the design concept, inverse kinematics, assembly and motor control, winding sequences,
    and completed scale model. Click a board to enlarge it.
- type: text
  heading: Interactive spatial winding
  body: '**Fall 2023 · Individual student project.** *Spatial One-line Winding* combines a desktop arm with a camera,
    fiducial markers, and a mobile control interface. reacTIVision identifies marker positions; Grasshopper translates
    the selected spatial points into robot motion; TouchOSC provides controls for the participant.


    Participants guide a continuous thread around a field of vertical pins. The documented trials include a five-pointed
    star, a letter, a Tetris-like figure, an abstract portrait, and a rotating square, showing how one assembled
    robot can support different interactive making processes.'
- type: gallery
  heading: Spatial winding documentation
  images:
  - /assets/media/building-robots-for-robotic-fabrication/spatial-winding-overview.webp
  - /assets/media/building-robots-for-robotic-fabrication/spatial-winding-workflow.webp
  - /assets/media/building-robots-for-robotic-fabrication/spatial-winding-assembly.webp
  - /assets/media/building-robots-for-robotic-fabrication/spatial-winding-experiments.webp
  columns: two
  caption: The setup, vision and interaction workflow, joint assembly, and five participant trials.
- type: text
  heading: Human–machine interaction for 3D printing
  body: '**2022 · Individual student project.** *Robotic Fabricator: Human–Machine Interaction* develops a robotic
    printing setup with an E3D printhead, a custom mount, and a mobile augmented-reality interface built with Fologram.


    The student connects toolpath generation and joint control with separate systems for material feeding and temperature
    control. The interface allows the user to preview geometry and modify parameters, while the project boards document
    the mechanical assembly, electronics, and physical setup.'
- type: gallery
  heading: Interactive printing documentation
  images:
  - /assets/media/building-robots-for-robotic-fabrication/interactive-printing-overview.webp
  - /assets/media/building-robots-for-robotic-fabrication/interactive-printing-mechanics.webp
  - /assets/media/building-robots-for-robotic-fabrication/interactive-printing-control.webp
  - /assets/media/building-robots-for-robotic-fabrication/interactive-printing-prototype.webp
  columns: two
  caption: Printhead design, toolpath control, material and temperature circuits, and the augmented-reality interface.
- type: text
  heading: Computer vision and block assembly
  body: '**2022 · Individual study.** *Re-order Construction* connects a camera and OpenCV image processing to a
    robotic arm equipped with a suction tool. The student investigates how the robot can identify the position and
    orientation of scattered pieces, then use Grasshopper-based motion planning to place them into a stacked assembly.


    The boards document image-boundary tests, pose extraction, inverse kinematics, robot construction, and physical
    stacking experiments. A proposal for assembling traditional timber components extends the study beyond the desktop
    trials.'
- type: gallery
  heading: Vision-guided assembly documentation
  images:
  - /assets/media/building-robots-for-robotic-fabrication/vision-block-assembly-1.webp
  - /assets/media/building-robots-for-robotic-fabrication/vision-block-assembly-2.webp
  columns: two
  caption: Computer-vision workflow, camera and suction-tool setup, component recognition tests, and stacked models.
- type: text
  heading: Tool testing, foam cutting, and vault models
  body: '**2021 · Individual student project.** *Robotic Arm Democratization* follows the robot from initial writing
    tests through end-effector development and fabrication trials. The student tests a crayon, suction gripper,
    3D-printing pen, and electric foam-cutting tools, then adjusts the model and tool orientation in response to
    alignment errors, servo play, limited joint travel, and tool weight.


    The final design studies a vault generated with RhinoVault. Robotic foam cutting and plaster casting informed
    the experiments; the final panelized vault model was laser-cut because the student encountered time and servo-accuracy
    limits. A 3D-printed reference model supports comparison with the original curved form.'
- type: video
  heading: First drawing tests
  file: /assets/videos/building-robots/robotic-drawing.mp4
  poster: /assets/media/building-robots-for-robotic-fabrication/robotic-drawing-poster.webp
  caption: The assembled arm follows a drawing path, providing an initial test of tool position and control.
- type: video
  heading: Robotic foam cutting
  file: /assets/videos/building-robots/robotic-foam-cutting.mp4
  poster: /assets/media/building-robots-for-robotic-fabrication/robotic-foam-cutting-poster.webp
  caption: A modified electric cutting tool is mounted on the arm and tested on a foam block; the video also shows
    the resulting cut surface.
- type: gallery
  heading: End-effector and fabrication documentation
  images:
  - /assets/media/building-robots-for-robotic-fabrication/robotic-arm-democratization.webp
  - /assets/media/building-robots-for-robotic-fabrication/end-effectors-and-calibration.webp
  - /assets/media/building-robots-for-robotic-fabrication/foam-tests-and-vault-design.webp
  - /assets/media/building-robots-for-robotic-fabrication/vault-model-comparison.webp
  columns: two
  caption: Writing, tool tests, calibration, foam cutting and casting, vault design, and comparison of the laser-cut
    and 3D-printed models. The robot's assembly and control board appears above.
- type: text
  heading: 'Related independent study: Nutri-Print'
  body: 'This separately mentored food-printing project extends the relationship between fabrication tools and interaction
    design. *Nutri-Print* proposes an app for customizing meals and sharing recipes, connected to a food-extrusion
    workflow.


    The documentation brings together user research, interface prototypes, ingredient and nozzle tests, printer
    mechanics, G-code, and printed food patterns. It is presented here as a related independent study using a food
    printer.'
- type: gallery
  heading: Nutri-Print documentation
  images:
  - /assets/media/building-robots-for-robotic-fabrication/nutri-print-overview.webp
  - /assets/media/building-robots-for-robotic-fabrication/nutri-print-process.webp
  columns: two
  caption: An independent mentee project connects an app concept with food-printing experiments and process documentation.
links: []
related_publications: []
awards: []
editor_notes: Revised from the supplied course portfolio, 13 original A/B/C project boards, the five-page Traditional
  Yurt project, two Nutri-Print boards, and five distinct videos. Media1.mp4 and videoplayback (2).mp4 are byte-identical
  and appear once. Portfolio collages duplicate the original A/B/C boards; their two unique Re-order Construction
  boards are retained. The original syllabus describes a six-week format; a 2022 student board records eight weeks,
  so the page does not assign one duration to every offering. Nutri-Print is labeled as a related independent study.
  Student names are not identified in the supplied boards. The original permalink is retained.
source_links: []
related_projects:
- /research/pica/
- /teaching/ai-empowered-creative-robotics-workshop/
research_question: How does building a fabrication tool change what students can design and make?
role_summary: Independently designed and taught six course offerings, from mechanical assembly and kinematics to
  student application development.
evidence_summary: Assembly and control videos, plus student winding, printing, cutting, and vision-guided assembly
  projects.
related_connections:
- url: /research/pica/
  reason: Develops an adaptable robot as a tool for design exploration.
- url: /research/robosense/
  reason: Connects robotic control with material delivery and geometric intent.
- url: /teaching/ai-empowered-creative-robotics-workshop/
  reason: Uses physical intervention to question computational output.
reading_path:
- title: Build a robot
  target: robot-assembly
- title: Control
  target: control
- title: Student work
  target: student-work
evidence_target: robot-assembly
question_label: Learning question
---
**I designed this course around learning robotics by building a robot from individual components.** Students assemble a desktop six-axis robotic arm by hand and use that process to understand its mechanics, calculate inverse kinematics, and develop motor-control algorithms. They then use the arm they built to create a fabrication or interaction application.

I independently developed and taught six offerings between 2021 and 2024. Online lectures and remote studio sessions connect mechanical assembly, Grasshopper modeling, electronics, programming, and project development. Students enter with Rhino and Grasshopper experience; the course introduces the programming needed to control their robot.

