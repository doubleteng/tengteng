# ARC 2713 lecture alignment — 6 November 2026

## Evidence reviewed

All 15 supplied Zoom links were accessed and their complete available transcripts read. Key steel-floor slides were checked visually to resolve the office load and girder-load-pattern ambiguity. This was not a continuous viewing of every video minute. Two supplied links contain the same 213 transcript rows for the September 17 truss tutorial. Recording-access tokens are intentionally not copied into this public repository.

| Supplied link order | Lecture date | Content | Lab relationship |
|---|---|---|---|
| 1 | Oct 6 | Steel roof | Deck span, joist spacing, girder panel points, ASD and self-weight |
| 2 | Sep 29 | Wood project completion | Lateral system, column classes, foundations, assembly and evidence |
| 3 | Aug 25 | Structural origins/hierarchy | Bay, surface, secondary/primary member, vertical supports |
| 4 | Aug 27 | Bay morphology | One/two-way action, direction changes, removal of supports |
| 5 | Sep 1 | Equilibrium and stability | Force/moment equilibrium, diaphragm and two-axis lateral paths |
| 6 | Sep 3 | Loads | Tributary area, psf/plf/force units, self-weight and reactions |
| 7 | Sep 8 | Force and deformation | Axial force, bending, stress/strain, exaggerated deformation |
| 8 | Sep 15 | Wood roof | MPP → purlin → truss; node coordination |
| 9, 10 | Sep 17 | Same truss tutorial | Economy targets, member forces and model evidence |
| 11 | Sep 22 | Wood floor | Partial floor, clear span, panel seams, beam/girder/column coordination |
| 12 | Oct 13 | Steel floor/lateral | Partial floor options, composite deck, discrete girder loads |
| 13 | Oct 20 | Steel columns/foundations | Coordinate-specific loads, restraint and foundation records |
| 14 | Oct 27 | Concrete introduction | Precast systems and initial prototype constraints |
| 15 | Nov 3 | Concrete project update | Final prototype modifications and coordinated assembly |

## Teaching decisions

- Design from the smallest spanning element outward; distinguish this from foundations-up construction assembly.
- Preserve wood office live load **50 psf** and steel office live load **65 psf**. The latter is visible in the Oct 13 slide at 11:37. Grocery/library use 75/150 psf in both floor assignments.
- Preserve wood soil assumption **3,000 psf** versus steel **1,500 psf**. Bearing area P/q is not footing-thickness design. Classroom examples are not universal approvals.
- Keep deck/table self-weight accounting separate from downstream load accounting. A capacity table that includes panel self-weight does not remove that weight from the supporting member.
- Preserve the existing correction of `40LH13` (13 = section number), three-span deck = four supports, ASD/live-load checks, and girder weight versus panel-load units.
- Preserve discrete two-third-point loading for a girder with three equal spaces. The Oct 13 calculator screenshot at 32:23 uses a midpoint example, whose result cannot verify the two-point case. Existing W18×44 invalid-designation guidance remains intact.
- Retain partial floors and double-height voids. Require actual headers, collectors, connections and lateral paths in the coordinated model; a rendered frame does not verify these conditions.
- Retain compression-blue/tension-red force meanings, adjusted for visibility on medium gray. Displayed deformations remain illustrative and amplified.
- Add concise stage evidence and a course sequence guide, with the same guidance available to the local Coach knowledge retrieval.
- Add a concrete briefing bridge using Oct 27 and Nov 3. The concrete workspace still explicitly identifies its elastic-study scope; no unverified precast capacity tables or full project model were invented.

## Interaction repairs

1. Shared `#666666` canvas background, charcoal interface, warmer annotation cards, brighter role/force colors. Opaque member fills maintain at least 3:1 contrast to the background. Thin members use brighter outlines.
2. Floor bay and whole-building models use the same elevation and nominal W-section depth inputs. The preview is flush-top and schematic, as stated in the course guide.
3. Every foundation-stage column has a unique support-coordinate picking ID. Selection uses existing per-column records; no duplicate overlay column is added.
4. Roof, floor and foundation re-renders retain camera position within the same view scope; Fit, plan/3D and whole-building/bay switches establish an appropriate new view.
5. Floor model annotations now render using the shared steel annotation renderer.
6. Source tasks open the original PDF/calculation workspace alongside the live conditions panel. It replaces the model area instead of obscuring the controls. Closing stays respected during same-step edits.
7. Column-only/foundation views suppress unrelated roof/floor labels. Course guide and checkpoint disclosures keep the full original task navigation available.

## Verification

Existing suites: `steel-roof.test.cjs` (including 360 assignment/spacing combinations), `steel-explain.test.cjs`, `steel-linked-tables.test.cjs`, `studio-regression.test.cjs`.

New suite: `lecture-alignment.test.cjs` checks 80 linked roof/floor combinations for matching elevations/depths, all support IDs, camera snapshot isolation, palette contrast and course/Coach load distinctions.

Browser checks: actual PDF cell selection updates deck gauge and self-weight; Save/Open restores that choice; roof-to-floor flow preserves the shared brief; partial-floor model and local bay respond to elevation changes; clicking another column changes the grid record; course guide opens with the correct stage-specific evidence. Publication is checked against the live site after deployment.
