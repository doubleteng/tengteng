---
layout: stresspath
title: StressPath
category: research
year: "2026"
published: true
featured: false
permalink: /research/stresspath/
cover: /assets/media/stresspath-preview-20261004.webp
cover_alt: StressPath material preview and the corresponding 3D-printed truss specimen.
cover_fit: contain
cover_preview_only: true
wide: true
research_areas:
  - interfaces-and-tools
research_order: 5
project_type: Interactive research tool
project_stage: Research prototype
summary: A browser-based workspace for structural design, analysis, toolpaths,
  and material distribution.
structure_lab: false
featured_order: 99
---

StressPath is a browser-based design and fabrication workspace for exploring how structural forces can inform printing paths and material placement. It connects editable frame models, structural analysis, continuous toolpaths, and four-feed material planning in one study. Developed by Teng Teng, the project translates research on continuous multi-filament printing into an interactive environment where geometry, deposition sequence, and material transitions can be examined together.

## From structural design to printing instructions

1. **Design.** Draw nodes and members, edit supports and loads, or import straight linework from a **3DM or DWG** file. The 2D workspace supports planar frames; the **3D assembly workspace, currently in beta,** organizes structures across multiple workplanes and printable planar modules.
2. **Analyze.** Examine tension and compression, bending moments, shear forces, and amplified deformation. Changing geometry, supports, or loads updates the structural response, making it possible to compare how alternative arrangements carry forces.
3. **Toolpath.** Use the analyzed member response to guide local infill and build connected deposition paths. Bead width, path spacing, member junctions, and layer staggering become explicit fabrication parameters. Preview the path in plan or as a layered assembly, then export **3DM curves or G-code**.
4. **Material.** Define four feed materials and their display colors. Set a default recipe, outline regions, and assign either a single material or a percentage-based mixture. Regions retain independent recipes, while unassigned areas use the default material.

## Material transitions along the path

Material gradients follow the ordered printing path and are controlled by distance along that path. A transition therefore describes how the mixture changes as the nozzle travels between assigned regions. The preview displays continuous toolpath width and blends the selected material colors according to the local recipe.

The intended gradient and the printer’s mixing response are controlled separately. Adjustable delay and mixing-length settings let users compare the designed distribution with predicted deposition and advance material commands to compensate for the configured response. Active-mixing G-code coordinates the mixing screw and four feeder ratios for the supported Marlin configuration.

Structural analysis uses the frame’s assigned sections and elastic properties; material recipes control deposition and do not update those properties.

## Save and continue a study

Choose **Save project** to download a JSON file containing the design, saved analysis results, toolpaths, and material settings. On a later visit, choose **Open project** and upload that file to resume the study. Use **Open full screen** for a larger working area.

The research basis is documented in [Multi-material 3D Printing for Tension-Compression Structure](/research/multi-material-3d-printing-for-tension-compression-structure/), which connects tensile and compressive demand to material placement along a continuous deposition path.
