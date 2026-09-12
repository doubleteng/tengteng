---
title: Pica
category: research
year: '2019'
published: true
featured: true
featured_order: 5
permalink: /research/pica/
cover: /assets/media/pica/hero.webp
cover_alt: Pica
summary: A low-cost personal robotic fabrication platform connects physical prototyping with direct control in design
  software.
role: ''
institution: ''
location: ''
tags:
- fabrication
- robotics
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
---

As digital design and fabrication are becoming increasingly prevalent, it is essential to consider how these technologies can be made more affordable and intuitively introduced to individual designers with limited computing skills. In this paper, we present an affordable personal robotic fabrication platform, PICA, consisting of a 3D printed robotic arm with a set of controller programs. The platform allows designers with limited computational design skills to assemble motors and 3D printed parts easily and to operate it in a code-free environment with direct manipulation through 3D modeling software. With the real-time communication between 3D modeling software and this robotic fabrication platform, PICA also allows designers to efficiently change the topological properties of geometry during the fabrication process. Based on a comparative observation of several application scenarios of using PICA among two groups of architecture students, the research can be summarized as follows: 1.) The project has proved to be an affordable approach to ease the materializing process when converting a designer’s initial intent from digital space to a physical prototype. 2.) Designers could be facilitated by utilizing this robotic fabrication platform, especially during the period of conceptual design.

In order to achieve the vision of designer-oriented fabrication platform, I have made three generations of the open-source robotic arm to polish the project so far. The first two generations of the robotic arm are driven by servos and a set of sensors. The establishment of these early prototypes offered me opportunities to gain advanced knowledge in Inverse kinematics. Both first two prototypes could be fully controlled per the designer’s gesture as well as a voice command. But the motion generated through servos is not accurate enough for the robot to perform fabrication tasks.

The third generation of open-source robotic arm that I developed is driven by a series of step motors and Arduino controller, associates directly with 3d modeling software Rhinoceros/Grasshopper. I also made a series of Grasshopper components to manipulate the robotic arm. A designer who demand rapid fabrication task during his/her design process, merely need to plug a USB cable, and directly manipulates the robot arm through the modeling software interface such as Rhinoceros without any robotic programming required..

The project has been published at the 2020 annual conference for Computer-Aided Architectural Design Research in Asia.

Generally, for ensuring precision of movement of the robot arm, servo motors are used in the heavy-duty industrial robot arms. The motor encoder of the closed loop drive system is used to achieve high precision movement. However, as this project aims to develop a lower cost configuration with relatively acceptable accuracy control, seven bipolar stepper motors are used instead of servo motors.

All six axes can be classified as two types based on its stress situation, every kind of axes have similar calculations. For the axis of 6,4, and 1, it overcomes the inertia force and friction force since the 3D printed parts on these axes are engaging each other. Axis of 5, 3, and 2 is another type that is primarily rotating against inertial forces, friction, plus gravity. Therefore, the calculations of axis 5, 3, and 2 need to consider the impact of gravity. After determining the necessary load and transmission, the primary motor parameters such as holding torque and the rated current can be calculated based on a complete rotation range of the joint. The calculation above helps to determine the stepper motors. In this project, the stepper motor types that are used in PICA are NEMA 23, NEMA 17, and NEMA 14.

PICA connects with an Arduino Mega board as media to receive data. The host computer generates all joint rotation angles via grasshopper inverse kinematics components. These generated angles need to convert into step numbers to be sent to stepper motors through Arduino to get the robot working. A set of stepper motor drivers (TB6600 in this case) is associated with each stepper motor, which send step and direction information and provide sufficient rated current. We attached an ethernet shield with Arduino Mega board to convert it as a standalone client with an IP address. By locating this IP address with UDP in Grasshopper, all data for 6 or more stepper motors can be sent to Arduino as a string through the ethernet cable (no USB connection required).
