---
title: Minimum Device, Maximum Space
category: research
year: 2026
published: true
featured: false
permalink: /research/minimum-device-maximum-space/
cover: /assets/media/minimum-device-maximum-space/interior-spray.webp
cover_alt: A compact robot spraying polyurethane inside an inflated architectural enclosure
cover_preview_only: true
summary: A compact robot sprays polyurethane inside an inflated membrane, combining pneumatic formwork and projected deposition to fabricate an enclosure beyond the arm's physical reach.
project_type: Robotic spray fabrication of inflatable architectural enclosures
project_stage: 2 m calibration tests and 5 m-span research prototype
tags:
- robotics
- fabrication
- inflatable formwork
- polyurethane
- toolpath planning
research_areas:
- material-computation
- interfaces-and-tools
primary_link:
  title: Project manuscript (PDF)
  url: /assets/documents/minimum-device-maximum-space-project-manuscript.pdf
publications_position: end
related_publications:
- title: 'Minimum Device, Maximum Space: Reach-Aware Robotic Spray Fabrication of Inflatable Architectural Enclosures'
  url: /assets/documents/minimum-device-maximum-space-project-manuscript.pdf
  context: Project manuscript
related_projects:
- /research/pica/
- /research/automated-concrete-toolpaths/
- /research/snmm-additive-manufacturing-system/
- /research/integrated-and-tailored-thermal-insulation/
source_links:
- https://drive.google.com/drive/folders/1ae5pGhZTSvtJ8JbvS0A8xlMM-A-nX2pz
sections:
- type: media-row
  equal_height: true
  items:
  - type: image
    image: /assets/media/minimum-device-maximum-space/interior-spray.webp
    alt: A compact robotic arm projects polyurethane onto the inner surface of an inflated membrane
    ratio: 1.494152
  - type: image
    image: /assets/media/minimum-device-maximum-space/exterior-illumination.webp
    alt: Interior illumination reveals the deposited polyurethane pattern through the exterior PVC membrane
    ratio: 1
  caption: Inside-out robotic spraying (left) and the illuminated enclosure (right). Variations in internal coating thickness change light transmission through the smooth outer membrane.
- type: text
  heading: Inflation defines the fabrication volume
  body: >-
    The inflated PVC membrane establishes the enclosure's geometry before rigid material is added.
    A compact arm positioned inside directs a polyurethane jet across the interior air volume.
    The membrane receives and temporarily supports the wet material as it foams, adheres, and cures.
    Fabrication access therefore depends on robot posture, nozzle orientation, projection distance,
    and the membrane's ability to retain the deposit.
- type: image
  image: /assets/media/minimum-device-maximum-space/method-overview.webp
  alt: Built sprayed membrane prototype, digital robot placement, and custom polyurethane spray end-effector
  caption: Built prototype, digital fabrication setup, and custom spray end-effector. The nozzle projects material onto a receiving surface beyond the robot's contact workspace.
- type: text
  heading: Calibrating reach and material retention
  body: >-
    Tests in **2 m spherical membranes** established the relationship between nozzle clearance
    and deposited band width. Six standoff settings from **20–70 cm** produced paths approximately
    **12–24 cm wide**, providing a basis for planning coverage and overlap. Substrate trials compared
    PVC, Oxford cloth, and carbon-fiber membrane. The documented Oxford-cloth test showed dripping
    and gaps between passes; textured PVC retained wet polyurethane more effectively and supported
    a more continuous coating. These tests connected usable spray reach to both geometry and
    receiving-surface behavior.
- type: media-row
  equal_height: true
  items:
  - type: image
    image: /assets/media/minimum-device-maximum-space/two-metre-calibration.webp
    alt: Two-metre PVC membrane prototype beside its digital reach-calibration model with dimensions
    ratio: 2.710552
  - type: image
    image: /assets/media/minimum-device-maximum-space/substrate-comparison.webp
    alt: Polyurethane retention on Oxford cloth compared with the more continuous coating on PVC
    ratio: 2.704212
  caption: Small-membrane reach calibration (left); deposited PU on Oxford cloth and PVC (right). Nozzle distance and substrate retention informed the larger prototype.
- type: text
  heading: Curing time organizes the sequence
  body: >-
    Spraying began near the lower perimeter and progressed upward in staged bands. Lower regions
    gained stiffness before subsequent passes added material above them, while the crown avoided
    early accumulation of wet polyurethane. The sequence coordinated deposition with foaming,
    adhesion, and curing to limit sagging of the compliant membrane.
- type: image
  image: /assets/media/minimum-device-maximum-space/spray-sequence.webp
  alt: Spherical spray toolpaths and sequential photographs of bottom-up robotic polyurethane deposition
  caption: Toolpath geometry and staged spraying in the small spherical membrane. Previously deposited lower bands had time to stiffen as fabrication progressed upward.
- type: text
  heading: Projected deposition at 5 m span
  body: |-
    The **5 m-span prototype** transferred the calibration and sequencing approach to a membrane that the arm could not surface-follow. In many regions, polyurethane traveled **more than 2 m** before reaching the membrane. Nozzle direction and robot speed shaped the impact zone; membrane curvature, surface condition, and reaction state influenced how the material accumulated.

    Overspray created secondary deposits, wet-material accumulation caused local sagging, and hose drag constrained wrist motion. Operators adjusted nozzle direction, dwell time, and band sequence as membrane deformation and curing conditions changed. The prototype demonstrates architectural-scale deposition from a compact internal robot and identifies projection control, band overlap, and hose management as requirements for a more repeatable process.
- type: media-row
  equal_height: true
  items:
  - type: image
    image: /assets/media/minimum-device-maximum-space/five-metre-setup.webp
    alt: Isometric, plan, and sectional views of the five-metre membrane showing robot placement and limited reach
    ratio: 1.772727
  - type: image
    image: /assets/media/minimum-device-maximum-space/interior-test.webp
    alt: Robot and researchers inside the five-metre prototype inspecting polyurethane bands during curing
    ratio: 1.333333
  caption: Robot placement and access constraints in the 5 m enclosure (left); inspection of deposited bands during an early spraying test (right).
---

**Minimum Device, Maximum Space** investigates how a compact fabrication device can materialize an architectural enclosure larger than its reach. Inflation establishes the volume, projected polyurethane bridges the distance between nozzle and membrane, and staged curing converts the deposited material into a stiffened coating.
