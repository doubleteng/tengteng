---
title: AI Empowered Creative Robotics Workshop
card_title: AI, Robotics & Critical Making
category: teaching
year: '2023'
published: true
featured: true
featured_order: 7
permalink: /teaching/ai-empowered-creative-robotics-workshop/
cover: /assets/media/ai-empowered-creative-robotics-workshop/robotic-painting-poster.webp
cover_alt: A UR5 robot paints a layered portrait using a sponge end effector
cover_preview_only: true
summary: Students connect AI image generation, robotic painting, and manual intervention to examine how gender and leadership are represented in generated portraits.
role: Workshop organizer and instructor
institution: Tongji University
location: Shanghai, China
project_type: One-week workshop · August 2023
project_stage: Teaching
tags:
- teaching
- robotics
- AI
- critical making
credits:
- 'Instructors: Teng Teng and Kangyi Zheng'
- 'Inverse Portrait collaborators: Jinhong Cao, Shuming Xu, Long Lin, Jiachen Sun'
team: []
acknowledgements: ''
contributions:
- Organized and led the workshop in August 2023.
- Guided the exchange between AI-generated imagery, robotic painting, and manual intervention.
- Student participants developed Inverse Portrait and its visual and toolpath studies.
question_label: Teaching question
research_question: How can physical intervention expose and challenge assumptions in an AI-generated image?
method_steps:
- title: Generate
  text: Use text prompts to produce portraits and examine the identities they depict.
- title: Paint
  text: Translate image tones into toolpaths and paint with a robot-mounted sponge.
- title: Intervene
  text: Change the painted image by hand, introducing new marks and representations.
- title: Reintroduce
  text: Feed the altered image back into generation and compare the resulting portraits.
opening_sections:
- type: media-row
  equal_height: true
  items:
  - type: image
    image: /assets/media/ai-empowered-creative-robotics-workshop/inverse-portrait.webp
    alt: Inverse Portrait combines robot-painted dots with manual brushwork in a layered portrait
    ratio: 0.7075
  - type: video
    heading: UR5 robotic sponge painting in the workshop
    file: /assets/media/ai-empowered-creative-robotics-workshop/robotic-painting.mp4
    poster: /assets/media/ai-empowered-creative-robotics-workshop/robotic-painting-poster.webp
    ratio: 1.7778
  caption: 'Inverse Portrait: the layered artwork and a workshop recording of the UR5 applying paint with a sponge end effector.'
sections:
- type: text
  heading: 'Inverse Portrait: gender, leadership, and identity'
  body: |
    In the student project *Inverse Portrait*, the prompt “successful leader” produced a male figure in a business suit. Students intervened in the physical painting to introduce a female representation, then returned the altered image to the generation process. Their boards connect this experiment to a wider vocabulary of “successful,” “smart,” “brilliant,” and “entrepreneur,” showing how apparently neutral descriptions can acquire gendered visual form.

    The project uses “script” in two connected senses: the computational instructions that generate and paint an image, and the social expectations that shape its interpretation. Successive layers of generated portraits, robotic dots, and hand-painted strokes make those scripts visible and open to revision.
- type: gallery
  heading: Prompt, representation, and feedback
  columns: two
  images:
  - /assets/media/ai-empowered-creative-robotics-workshop/ai-bias-concept.webp
  - /assets/media/ai-empowered-creative-robotics-workshop/image-robot-feedback.webp
  caption: Text-to-image trials and concept mapping are paired with the feedback sequence linking Stable Diffusion, ControlNet, Grasshopper toolpaths, robotic painting, and hand drawing.
- type: text
  heading: From image to physical mark
  body: |
    Students developed a custom end-effector holder for a beauty sponge and tested how contact depth changes dot size and repeated contact changes the painted shade. Makeup brushes provided a second way to work across the same surface. Tool selection connected the project's questions about identity to the material techniques used to construct a portrait.

    Rhino and Grasshopper translated image information into drawing points and robot movements. The documented trials compare a regular grid and zigzag sequence, grayscale-dependent dot sizes, and brightness-based point generation with a nearest-neighbor sequence. Paint-dipping positions, approach points, and contact depth made image translation a problem of tool behavior and motion planning as well as representation.
- type: gallery
  heading: Drawing tools and toolpath studies
  columns: two
  images:
  - /assets/media/ai-empowered-creative-robotics-workshop/drawing-tools-process.webp
  - /assets/media/ai-empowered-creative-robotics-workshop/toolpath-generation.webp
  caption: Sponge-holder design, contact tests, and on-site fabrication accompany studies of point spacing, dot size, path order, and painting depth.
- type: text
  heading: Manual intervention as feedback
  body: |
    The robot deposits discrete marks according to a programmed sequence; participants overlay and connect those marks with a brush. Returning the altered painting to image generation makes the physical work an input to the next portrait. The exercise gives students a concrete way to examine how a prompt, an image-conditioning input, a toolpath, and a hand-painted decision each affect representation.
- type: gallery
  columns: two
  images:
  - /assets/media/ai-empowered-creative-robotics-workshop/robot-sponge-painting.webp
  - /assets/media/ai-empowered-creative-robotics-workshop/manual-brush-intervention.webp
  caption: Robot-applied sponge marks and manual brushwork on the same painted surface.
links:
- title: Workshop documentation (PDF)
  url: https://drive.google.com/file/d/1xA_S-aejT6YxlBy4Be6t-lsXRYMjkCwi/view
related_publications: []
awards: []
editor_notes: ''
source_links:
- title: Workshop source materials
  url: https://drive.google.com/drive/folders/1KXwKI2UxB2KuHgD3EPXp1ixhUIoBMs2U
related_projects:
- /teaching/building-robots-for-robotic-fabrication/
- /research/pica/
role_summary: Organized and taught the workshop with Kangyi Zheng; participants authored the portraits and robotic
  painting experiments.
evidence_summary: Student paintings, process images, and fabrication video show the AI–robot–hand feedback loop.
related_connections:
- url: /teaching/building-robots-for-robotic-fabrication/
  reason: Learning robotic control through physical experimentation
- url: /research/pica/
  reason: Human intervention within a robotic fabrication loop
evidence_target: project-evidence
---
I organized and led this one-week workshop at Tongji University in August 2023. Participants used AI image generation and robotic painting to investigate how a portrait encodes assumptions about gender, identity, and social roles. They moved repeatedly between digital images and painted surfaces, modifying machine-generated representations by hand before using them as inputs to further generation.


