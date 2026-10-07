---
title: Single-Nozzle Multi-Filament Additive Manufacturing
category: research
year: 2021–2025
published: true
featured: true
featured_order: 1
permalink: /research/snmm-additive-manufacturing-system/
cover: /assets/media/snmm-additive-manufacturing-system/detail-cover.webp
cover_alt: Single-nozzle printed object with a continuous material gradient
summary: A four-filament printhead, a calibrated transition model, and material-aware toolpaths place graded compositions
  and functional regions within one continuous print.
role: Leading Contributor
institution: University of Pennsylvania · Polyhedral Structures Laboratory
location: ''
tags:
- fabrication
- material
- product
credits:
- 'Authors: Teng Teng, Yefan Zhi, Masoud Akbarzadeh'
team: []
acknowledgements: ''
sections:
- type: video
  heading: Active mixing in operation
  file: /assets/videos/snmf-active-mixing.mp4
  caption: A short demonstration of the printing system.
- type: text
  heading: Active mixing in a four-filament printhead
  body: |-
    Four independently driven filament feeds enter a shared, heated aluminum-alloy nozzle. A motor-driven, 2 mm tungsten-steel auger mixes the molten materials in the output chamber. Changing the relative feed rates changes composition; coordinating the total feed and auger rotation sustains extrusion along the toolpath.

    The modular assembly combines filament feeders, heat breaks, a cooling tower, and a heated mixing chamber on a CR-10 three-axis gantry. The chamber has a 2 mm diameter and a 5 mm length. This finite volume matters: material remains inside the head while the input ratios change, so the output records a history of earlier commands.
- type: gallery
  heading: Active-mixing extrusion system
  images:
  - /assets/media/snmm-additive-manufacturing-system/detail-materials-design-5.webp
  - /assets/media/snmm-additive-manufacturing-system/detail-materials-design-6.webp
  caption: Extrusion-head components and the integrated printing platform.
  columns: one
- type: text
  heading: Programming material profiles
  body: |-
    A material profile stores the fraction of each input filament in a mixture. Two filaments can therefore supply more than two printable compositions: black and white PLA, for example, produce four grayscale profiles with ratios of 1:0, 0.7:0.3, 0.3:0.7, and 0:1.

    Custom software associates these profiles with segments of a curve and translates the result into G-code. The modified Marlin firmware uses M163 to assign feeder weights, M164 to store a mixture, and tool-selection commands to recall it during motion. The selected tool index identifies a material recipe within the same printhead. Coordinated feeder speeds then deliver that recipe while the auger maintains extrusion.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/paper-fig-02-material-programming.webp
  alt: Flowchart for storing filament ratios as material profiles and recalling them along a print toolpath
  caption: Material recipes are defined before printing and recalled for successive path segments. The flowchart
    connects profile setup to motion and extrusion. Figure 2, Teng, Zhi & Akbarzadeh, Materials & Design 249 (2025),
    113479.
- type: text
  heading: Calibrating the translation into matter
  body: |-
    Material already inside a nozzle continues to influence the output after a feed ratio changes. A numerical model describes this transition, while experiments relate feed commands to deposited composition. Accounting for this behavior is necessary to locate an interface within the printed geometry.

    The model separates two distances along the deposited path. The delay length, L₁, runs from a change in feeder commands to the first appearance of the new material. The transition length, L₂, covers the subsequent change in composition. A linear approximation places the visual midpoint at L₀ = L₁ + L₂/2 after the command.

    Advancing the feed change by L₀ moves the deposited midpoint toward the intended interface. A moving-average formulation extends the model to repeated switches and multiple materials, allowing the software to preview the effect of the mixing chamber before printing.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/paper-fig-05-transition-model.webp
  alt: Diagram relating feeder speed changes to delayed and gradually changing deposited material fractions
  caption: An abrupt change at the motor breakpoint produces a delayed ramp in deposited composition. The visual
    breakpoint lies at the midpoint of that ramp. Figure 5, Teng, Zhi & Akbarzadeh, Materials & Design 249 (2025),
    113479.
- type: text
  heading: Locating the intended interface
  body: |-
    The calibration test prints a 200 × 50 mm zig-zag pattern with a 2 mm extrusion width and a 0.8 mm layer height. Without an advance, the observed interface falls beyond the intended boundary. A 30 mm advance overcompensates; an 18 mm advance aligns the visual breakpoint for this tested setup.

    The 18 mm value is an empirical calibration for these materials and printing conditions. Treating the delay and transition as fixed path lengths assumes a fixed extrusion cross-section and flow condition, with materials of similar viscosity.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/paper-fig-04-transition-calibration.webp
  alt: Three-column comparison of toolpaths, printed transitions, and predictions with zero, 30 mm, and 18 mm advance
  caption: 'Left to right: no advance, a 30 mm advance, and the calibrated 18 mm advance. Each column compares the
    command locations, deposited result, and modeled transition. Figure 4, Teng, Zhi & Akbarzadeh, Materials & Design
    249 (2025), 113479.'
- type: text
  heading: Comparing designed and deposited gradients
  body: |-
    A 200 × 100 mm sample tests ten programmed mixtures of red and green PLA. The study compares the toolpath visualization with the printed sample by extracting average red and green intensity profiles along the images.

    The profiles follow the overall intended gradient, with a substantial green-channel deviation and a smaller red-channel deviation near the beginning. Agreement improves through the middle and final regions. The intensity profiles quantify visual agreement between the design and print and reveal where blending control still needs refinement.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/paper-fig-07-gradient-validation.webp
  alt: Designed red-green PLA gradient, printed sample, and corresponding image intensity profiles
  caption: Ten mixture profiles are compared through the design visualization, the 200 × 100 mm print, and measured
    image-color intensities. Initial deviations remain visible in the curves. Figure 7, Teng, Zhi & Akbarzadeh,
    Materials & Design 249 (2025), 113479.
- type: text
  heading: Auger speed changes the material transition
  body: |-
    Two experiments isolate different consequences of active mixing. With red and blue PLA of similar viscosity, speeds of 50 and 75 rpm produce longer, smoother transitions; 125 and 150 rpm produce sharper transitions, with 100 rpm between them. These samples use a 0.8 mm layer height and a 3 mm extrusion width.

    A separate series prints 200 × 19 × 4 mm strips transitioning from white PLA to black TPU at 170, 200, 240, and 270 rpm. In the reported tensile tests, 170 rpm gives the highest peak stress, followed by 200 rpm; the 240 and 270 rpm specimens show lower strength and stiffness. The two series connect auger speed to visual transition length and mechanical behavior under their respective material and process conditions.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/paper-fig-08-auger-speed-tests.webp
  alt: PLA color transitions at five auger speeds beside a PLA-to-TPU tensile specimen and stress-strain curves
  caption: 'Left: red-to-blue PLA transitions at 50–150 rpm. Center and right: a separate PLA-to-TPU tensile experiment
    at 170–270 rpm. The speed ranges belong to different tests. Figure 8, Teng, Zhi & Akbarzadeh, Materials & Design
    249 (2025), 113479.'
- type: text
  heading: Printed objects and material distributions
  body: |-
    Six case studies connect the method to different shapes and functional requirements, including structural specimens and objects with graded material properties. The related truss and insulation studies examine how material assignment can respond to force flow and thermal demand.

    Structural specimens, graded surfaces, and image-based material placement use three ways of assigning composition: sampling an image, partitioning planar regions, and dividing a three-dimensional surface. The same material-profile and transition-control workflow connects these representations to fabrication.
- type: text
  heading: 'Image sampling: four grayscales from two filaments'
  body: |-
    The Mona Lisa study converts an image into a monochrome bitmap and quantizes it to four grayscale levels: 0, 0.3, 0.7, and 1. Each level maps to a black-and-white PLA mixture. Sampling along a continuous zig-zag path assigns the appropriate mixture to each segment.

    The 12 × 12 cm print uses 2 mm path spacing. Its image is formed by changes in the deposited blend, connecting pixel values, material recipes, and physical resolution in one fabrication sequence.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/detail-materials-design-4.webp
  alt: Image sampling workflow from the Mona Lisa bitmap to four grayscale mixtures and a continuous printed pattern
  caption: Image sampling maps a four-level grayscale bitmap to black-and-white PLA mixtures along a continuous
    toolpath.
- type: text
  heading: 'Discrete patches: assigning material by structural demand'
  body: |-
    A pair of 250 × 65 × 16 mm Pratt trusses tests material assignment under three-point bending. The multimaterial specimen places carbon-fiber-reinforced PLA in tensile members and white PLA in compressive members. The control uses white PLA throughout. Both are printed at 30 mm/s with a 0.8 mm layer height and a 2 mm extrusion width, then tested over a 220 mm span.

    The multimaterial specimen reaches 1.16 kN, compared with 0.83 kN for the control, while weighing 166 g rather than 179 g. The paper reports approximately 67% greater toughness from numerical integration of the bending response. These results describe the tested pair of specimens; buckling of a compression member governs the observed deformation.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/paper-fig-10-truss-bending-test.webp
  alt: Multimaterial and all-PLA Pratt trusses with their three-point-bending load-displacement curves
  caption: The tested multimaterial truss reaches 1.16 kN versus 0.83 kN for the white-PLA control. The corresponding
    specimen masses are 166 g and 179 g. Figure 10, Teng, Zhi & Akbarzadeh, Materials & Design 249 (2025), 113479.
- type: text
  heading: Connecting stress regions into a continuous path
  body: |-
    An intricate strut-and-tie example begins with four loading points and two supports. Algebraic graphic statics and layout optimization identify tensile and compressive regions. Toolpaths run parallel to the tensile stress directions and perpendicular to the compressive directions, then connect through local detours and crossings into a continuous zig-zag path.

    This specimen uses carbon-fiber-reinforced PETG in tensile regions and white PETG in compressive regions. Its material system differs from the PLA pair used in the bending comparison above. The path visualization and fabricated object document how the regional assignment survives the transition from structural model to print.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/paper-fig-11-stress-informed-toolpaths.webp
  alt: Sequence from loads and supports through a strut-and-tie model and connected toolpaths to a multimaterial
    PETG print
  caption: Loads and supports define stress regions; local paths are connected into a continuous print sequence.
    Black and white in the final object identify reinforced and standard PETG. Figure 11, Teng, Zhi & Akbarzadeh,
    Materials & Design 249 (2025), 113479.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/detail-materials-design-1.webp
  alt: Close view of the printed strut-and-tie object with black tensile regions and white compressive regions
  caption: Printed strut-and-tie object, showing the material boundaries and connected deposition paths in detail.
- type: text
  heading: 'Surface division: a funicular structure within a continuous shell'
  body: |-
    The column study starts from a funicular polyhedral geometry designed with 3D graphic statics. An intersecting geometry transfers the positions of its compression members onto a continuous envelope. Dividing that envelope assigns wood-fiber-reinforced PLA to the member regions and lightweight foaming filament to the spaces between them.

    The 250 mm prototype explores how structural regions and an infill intended for insulation can share a continuous printed surface. The photographs compare the multimaterial print with the earlier concrete geometry. The case documents material placement and fabrication; the paper does not report a thermal test or a structural load test of this printed column.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/detail-materials-design-3.webp
  alt: Funicular column geometry, divided surface, material toolpaths, and photographs of concrete and multimaterial
    prototypes
  caption: Surface division maps the compression-member geometry onto a continuous shell. Wood-fiber-reinforced
    PLA and lightweight foaming filament occupy different regions of the printed prototype.
- type: text
  heading: 'Surface division: making a stress field visible'
  body: |-
    A triply periodic minimal surface (TPMS) provides a second three-dimensional case. Finite-element analysis under a simulated 50 kN vertical load generates a stress field. Sampling that field assigns blue PLA to low-stress regions, green to intermediate regions, and yellow to high-stress regions.

    The print turns the numerical field into a physical color distribution on the complex surface. The 50 kN is the simulation input; the case demonstrates the placement of three colored PLA filaments, without reporting that load as a tested capacity of the printed object.
- type: image
  image: /assets/media/snmm-additive-manufacturing-system/detail-materials-design-2.webp
  alt: TPMS stress visualization and a blue-green-yellow PLA print reproducing the simulated stress distribution
  caption: The stress field, material visualization, and printed TPMS show how a numerical result becomes a spatial
    color distribution.
- type: gallery
  heading: Additional experiments and design studies
  images:
  - /assets/media/snmm-additive-manufacturing-system/img-5.webp
  - /assets/media/snmm-additive-manufacturing-system/img-7.webp
  caption: ''
  columns: two
- type: text
  heading: Material fidelity and the scope of the system
  body: |-
    The hardware, transition model, and three assignment strategies give designers control over both the intended mixture and the position of its transition. Finite mixing lengths set a limit on how quickly composition can change, and viscosity differences affect the predictability of a material pair. Auger speed must be calibrated together with flow, cross-section, and the desired interface behavior.

    The research establishes a prototype workflow through gradient measurements, interface tests, a structural comparison, and printed design cases. Extending it to architectural assemblies requires component-specific mechanical and thermal validation, as pursued through the related truss and insulation research.
links:
- title: Project at Polyhedral Structures Laboratory
  url: https://psl.design.upenn.edu/project/prototyping-high-fidelity-multifunctional-objects-using-single-nozzle-multi-filament-additive-manufacturing-system-with-active-mixing/
related_publications:
- title: Prototyping high-fidelity multifunctional objects using single-nozzle multi-filament additive manufacturing
    system with active mixing
  url: https://doi.org/10.1016/j.matdes.2024.113479
  publication_id: teng2025113479
  context: Published in Materials & Design 249 (2025), article 113479. The paper presents the printhead, transition
    model, validation experiments, and six design case studies. Figures 2, 4, 5, 7, 8, 10, and 11 are reproduced
    below from this study.
awards: []
editor_notes: ''
source_links:
- https://psl.design.upenn.edu/project/prototyping-high-fidelity-multifunctional-objects-using-single-nozzle-multi-filament-additive-manufacturing-system-with-active-mixing/
project_type: Fabrication research
project_stage: Research prototype
research_areas:
- material-computation
research_order: 2
research_question: How can a designer place a material transition where a component needs it?
contribution: The SNMF system connects representations of material distribution to a model of mixing inside the
  nozzle. Feed commands can therefore account for the transition between intended and deposited composition.
method_steps:
- title: Represent
  text: Assign material composition through image sampling, two-dimensional patches, or three-dimensional surface
    division.
- title: Model
  text: Describe the material transition inside an actively mixed extrusion head.
- title: Control
  text: Translate spatial composition into coordinated filament-feed and extrusion commands.
- title: Test
  text: Compare deposited transitions and printed case studies with their intended material distributions.
contributions:
- Led the development of the single-nozzle multi-filament research system.
- Developed computational material-assignment and fabrication workflows within the collaborative research.
- Coauthored the numerical and experimental study with Yefan Zhi and Masoud Akbarzadeh.
evidence: The published study combines a numerical description of mixing, experiments on deposited composition,
  and six design case studies. These establish the workflow under the tested material and printing conditions; the
  performance of an architectural assembly requires further component-specific testing.
related_projects:
- /research/multi-material-3d-printing-for-tension-compression-structure/
- /research/integrated-and-tailored-thermal-insulation/
card_title: Single-Nozzle Material Computation
primary_link:
  title: Read the paper · Materials & Design
  url: https://doi.org/10.1016/j.matdes.2024.113479
---

## Material distribution as a design input

A component can demand different material behavior at adjacent locations: a stronger tensile member, a lighter infill, or a gradual transition between regions. This project treats that spatial distribution as an input to fabrication. Its central measure is **material fidelity**—how closely the composition and location of deposited material follow the design.

The Single-Nozzle Multi-Filament (SNMF) system combines multiple filament feeds in an actively mixed extrusion head. Programmable feed ratios create continuous changes in composition within one printed object.

The research joins three parts of the problem: a four-filament printhead with active mixing, a numerical model of the delay between commanded and deposited composition, and design methods that attach material information to toolpaths. Together, they make both a mixture and its position programmable within a continuous print.

The computational workflow supports three representations of material intent. Image sampling maps pixel values to composition. Discrete patches assign material to regions in a plane. Surface division organizes composition over three-dimensional geometry. Each representation becomes a sequence of fabrication instructions.

Developed at the University of Pennsylvania’s Polyhedral Structures Laboratory, the study was published by Teng Teng, Yefan Zhi, and Masoud Akbarzadeh in *Materials & Design* 249 (2025), article 113479. The experiments below trace the workflow from material recipes and calibrated transitions to image patterns, structural regions, and three-dimensional surfaces.
