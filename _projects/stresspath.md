---
layout: default
title: StressPath
category: research
year: "2026"
published: true
featured: false
permalink: /research/stresspath/
cover: /assets/img/stresspath/stresspath-thumbnail-photo.webp
cover_alt: 3D-printed truss with green, yellow, and blue material transitions.
cover_preview_only: true
wide: true
research_areas:
  - interfaces-and-tools
research_order: 5
project_type: Interactive research tool
project_stage: Research prototype
summary: A browser-based workspace for structural design, analysis, toolpaths, and material distribution.
---

<style>
.stresspath-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:18px 0 20px}
.stresspath-heading h1{margin:0 0 8px}.stresspath-heading p{max-width:780px;margin:0}
.stresspath-frame{display:block;width:100%;height:90vh;height:90dvh;min-height:720px;border:1px solid var(--line);border-radius:6px;background:var(--paper)}
@media(max-width:760px){.stresspath-heading{display:block}.stresspath-heading .button{display:inline-block;margin-top:14px}.stresspath-frame{min-height:720px}}
</style>
<div class="page-top"><a class="back-link" href="/research/">← Research</a><p class="eyebrow">2026</p></div>
<header class="stresspath-heading">
  <div><h1>StressPath</h1><p>Explore structural geometry, forces, printing paths, and material distribution in 2D and 3D.</p></div>
  <a class="button" href="/research/stresspath/app/?v=1.35" target="_blank" rel="noopener">Open full screen ↗</a>
</header>
<iframe class="stresspath-frame" src="/research/stresspath/app/?v=1.35" title="StressPath interactive workspace" loading="eager" allow="fullscreen; clipboard-write" allowfullscreen></iframe>
<p style="margin-top:20px">Work through <strong>Design → Analyze → Toolpath → Material</strong> in one workspace. Use <strong>Save project</strong> to download your current study as a JSON file. When you return, choose <strong>Open project</strong> and select that file to continue.</p>
<p>Related research: <a href="/research/multi-material-3d-printing-for-tension-compression-structure/">Multi-material 3D Printing for Tension-Compression Structure</a>.</p>
