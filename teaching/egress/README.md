# Egress + Site Lab

Live app: https://teng-teng.org/teaching/egress/

An architectural teaching environment for drawing and comparing floor plans, connected stairs, exit discharge and site circulation. All geometric analysis and CAD decoding run in browser workers. The frontend is published by the existing GitHub Pages site. Google Apps Script supplies a shared instructor-funded recognition service; students do not sign in or provide API keys.

## Student workflow

1. Explore the two-floor example or start a new design. Select **All floors** to edit linked floor plans. The ground floor and site share one viewport; its exits connect the indoor and outdoor routes. Each viewport keeps its own camera.
2. Draw walls and door openings. Closed wall loops automatically create rooms and, when needed, the floor boundary; added partitions split rooms. Edit dimensions and occupancy assumptions in **Properties**. Add floors and use matching stair link names.
3. Draw site walkable areas, obstacles, pedestrian, accessible and vehicle routes. Mark actual public-way connections separately from assembly points.
4. Import DWG, DXF or Rhino 3DM; choose source layers, confirm units and optionally flatten nonplanar curves. Import editable CAD linework or assign selected linework as walls. Single-line walls require a user-entered thickness. Double-line straight faces have a conservative pairing preview with explicit review; ambiguous, curved or unmatched faces stay reference. Door symbols never create functional openings. Choose a PDF page and calibrate with two points on a known dimension before converting or tracing.
5. Toggle object types, circulation types, floor views and original CAD layers independently. Visibility changes display only, never the analyzed model.
6. Right-drag to pan; scroll to zoom at the pointer in single or multiple views. Osnap resolves End / Mid / Int / Perp / Near on visible model/CAD geometry. Wall/door/exit drawing always enables object snaps. Grid snap is separate; hold Shift or toggle F8 for Ortho. Alt only bypasses optional snaps on other tools. Draw walls as a continuous chain; Enter ends it. Drag doors, walls and route vertices. Automatic room boundaries follow the walls. Dragging triggers throttled live analysis; attached room edges, floor corners and doors follow wall edits. Areas, occupant loads and egress paths update during the drag. Optional room program-area targets compare the changed area with the design brief. Play animates route connections; it does not calculate evacuation times. Store a baseline and compare travel distances and flagged checks.
7. Use **Save report PDF** and choose Save as PDF in the browser print window. Edit the recognized plan online; areas, loads, widths and routes recalculate after each change. Save PDFs as records of successive design iterations. No Google account, Drive connection or student API key is needed. Local autosave and optional `.egress.json` project downloads remain available.

## Analysis scope

This is an educational design aid, not a compliance certificate or evacuation-time model. It uses a documented subset of **2021 IBC** for A/B/E/M and **2010 ADA**, not a claim about the jurisdiction's adopted edition. Results distinguish a checked condition, a flagged condition and an unresolved review item. Sprinkler and alarm assumptions must be checked by the student. The report includes sources.

Routes use sampled grids with wall/obstacle crossings blocked. The grid resolution and local geometry affect measurements. Exit travel ends at an assumed protected exit; the connected journey separately continues through linked stairs, the ground floor and the site. Stair lengths are user inputs. Common paths and dead ends are student-traced. Corridor widths, accessible turning/passing/ramps, exit independence, protected enclosures, exit capacity allocation, fire/smoke, door hardware and swings, terrain and local amendments require review. A green path is not proof of code compliance.

## Editable imported plans

After a PDF/image is calibrated, **Make PDF / image editable** opens extracted geometry in the same review workflow as CAD. Vector PDF paths are tessellated; PDF text is omitted. JPG, PNG and scanned PDFs are automatically vectorized in a worker using dark-stroke skeletons and simplified polylines, including angled and curved strokes. Faint/interrupted lines, image noise, text and furniture still require review and correction. All resulting vector endpoints are editable. Click single-line preview segments to exclude dimensions/furniture before wall conversion. The original reference remains independently hideable.

Closed wall loops become rooms automatically during drawing, wall editing and CAD wall conversion. Separate enclosures remain separate; nested rooms are subtracted from surrounding room areas. The optional **Detect rooms from editable walls** command can rebuild older models. Gaps remain open; the app does not invent an enclosing hull. Review the generated rooms, functions and area basis. Doors/exits always need explicit semantic assignment. Moving a wall carries attached room edges, connected wall junctions and doors, enabling live area/load/route changes. Loose CAD linework is also directly selectable and editable, but affects analysis only after it is assigned as a wall.

## Floor registration and multi-height spaces

All floor plans and the site use shared world XY coordinates in meters; display units do not alter the model. Floor elevation supplies Z. CAD imports preserve the source origin by default. Use the reference-floor overlay to align walls and stairs while drawing. Overhangs and setbacks remain different outlines in the same coordinate system; the app never recenters floors by their bounding boxes.

For a PDF or drawings with different origins, calibrate scale first, then choose **Align floor**. Pick A and B on the current drawing and the corresponding A and B on the reference drawing. The app applies a rigid translation/rotation to that floor's image, CAD and modeled geometry. A baseline mismatch above 1% is rejected; alignment does not rescale. Matching stair link names require overlapping XY footprints before a complete route can connect; offset stairs remain unresolved for review.

**Multi-height space** is one shared polygon with an occupied base floor and the highest level without a slab. Ground → Level 2 makes a double-height space; Ground → Level 3 removes slabs on Levels 2 and 3. Every intermediate floor is updated automatically by elevation. Upper-floor routing treats the void as an obstacle; room area/occupant-load calculations subtract the union of overlapping voids. The base retains its floor area. Moving the shared polygon updates every affected floor. Hiding its display layer does not restore the slab. Smoke control, guards, atrium separation and structural support remain separate review items.

## CAD preparation

Use 1:1 model-space plan curves on XY, explicit units, one floor per import, and consistent origins/orientation. Separate wall linework, door symbols, furniture, annotation and site layers. Meshes and surfaces need exported 2D curves. The import preview displays real-world extents and retained coordinates for checking. Moving each drawing near its own origin is opt-in and warns that this breaks registration. Nonplanar geometry requires explicit XY projection.

Double-line pairing proposes only unique, nearly parallel straight faces on the same layer with substantial length overlap and a thickness inside the selected range. It is a reviewed conversion, not automatic wall semantics. Original CAD remains available for tracing and verification of corners, junctions and openings.

Native DWG uses LibreDWG Web 0.8.2 and Rhino uses rhino3dm 8.17.0. Curves are tessellated. Supported linework includes lines, polylines, circles/arcs, ellipses, nested blocks and supported splines; unsupported entities are reported rather than fabricated. Meshes, surfaces and fit-only DWG splines are excluded. Maximum CAD file size 35 MB, 35,000 selected reference segments or 1,500 converted walls per import. Original CAD files are processed locally. Projects stay on the device.

## Development and deployment

```sh
cd teaching/egress
npm ci
npm run build
npm test
npm run dev
```

The checked-in `index.html`, styles, source and browser modules are published directly; npm is only needed to develop or regenerate vendor files. The application has no frontend API secrets. `vision-config.json` points to the anonymous instructor-funded recognition service. Backend source and deployment details are in `../../scripts/egress/`.

The app is GPL-3.0; see LICENSE.txt and THIRD_PARTY.md. This license applies to this application directory, not the unrelated portfolio content.

## Architectural image recognition (vision setup required)

`AI · recognize rooms + circulation` sends the selected plan to the fixed Google Gemini endpoint through the shared instructor-funded service. It returns typed room, corridor, lobby, outdoor, courtyard, void, projected context, furniture, stair, wall and opening proposals. The user reviews colored geometry over the original image and can relabel, exclude and reshape it. Calibration is required before applying an analysis model.

Furniture is stored in `floor.features`; it never creates rooms, partition walls or occupant area. Optional `blocksMovement` affects route obstacles only. Indoor room polygons are supplied by semantic interpretation, not by furniture outlines. Openings remain in `floor.candidates` until a user confirms jamb position, clear width and exit status. AI stairs default to unprotected and unlinked. Other-floor gray geometry stays reference; courtyards/voids are removed from indoor area and routes.

**Shared instructor service:** students need no Google account or personal key. The instructor's Gemini key is in Apps Script Script Properties, never in the frontend, repository, reports or project files. The public service is fixed to plan interpretation and has no Drive/Sheets operations. `scripts/egress/README.md` documents deployment and configurable request limits. The current instructor model is `gemini-4-argon`.

`Trace image / PDF linework` is a separate manual aid, not architectural recognition. It preserves up to 2400 px for tracing instead of the old 1200 px downsample. It may contain furniture, lettering and stair treads. Raw linework must not be described as automatically recognized rooms.

Validation: semantic contract tests cover furniture/room isolation, route-obstacle opt-in, unconfirmed-opening isolation, projected context, coordinate transforms, scale checks, malformed responses, private credentials and provider errors. These are implementation tests, **not recognition-accuracy benchmarks**. Real-image semantic accuracy remains unverified until a configured vision account is used.

## Area, served occupants and capacity

The report lists every room's area, selected net/gross basis, use factor and rounded design occupant load, including before exits have been modeled. A corridor carries served room loads and adds no independent occupant load. Uses and gross-area allocation require confirmation.

Door and stair widths use entered clear dimensions. Corridor widths are proposed from perpendicular sections between opposing polygon boundary faces; narrow segments are not replaced by a bounding-box width. Enabled furniture/obstacles reduce the contiguous clear section. Tapered or ambiguous boundaries need a measured width.

A geometry-based scenario allocates each room's people by reachable sample area, grouped by first door and nearest exit, and follows representative paths through shared doors and corridor sections. Shared components accumulate contributing room loads. The report gives served occupants, actual/estimated width, component minimum, load-based required width and shortfall, with a location in the live checks. This is not a code-approved exit allocation or crowd simulation; unsampled paths and route independence require review. Unreachable loads stay explicitly unassigned, not converted into a pass.

Width-based capacity uses the documented 2021 IBC teaching subset: horizontal components 0.2 in/person, or 0.15 only with both selected qualifying sprinkler and voice/alarm assumptions; stairs 0.3 or 0.2 respectively. Component minima still govern (general doors 32 in; general corridors/stairs 44 in, 36 in when serving fewer than 50; Group E corridors serving 100+ use 72 in). Special occupancies and exceptions are outside this subset. Stairs are assessed by story, not by summing every upper floor. Shared multi-floor discharge/convergence remains an explicit review item.

## Visible occupant-load basis

The Checks panel links to a room-by-room load schedule and selected 2021 IBC Table 1004.5 factors. Room Properties and the PDF show both sf/person and m²/person, net/gross basis, the area-division calculation and its rounded-up result. Display rounding does not affect the calculation. Overrides to the default factor or basis are labeled custom. Library reading rooms (50 net) and stack areas (100 gross) are available separately. Fixed-seat calculations remain outside this area-based subset.

### Per-room route coverage

Every occupied room appears in the route inventory and report, including blocked or unresolved rooms. Reachable portions remain visible in amber when part of a room is disconnected; disconnected areas never receive an invented path. Rooms outside the floor boundary are identified explicitly. Confirmed doors cut coincident shared wall segments, while nearby parallel walls remain barriers.

## Studio plan code checks: indoors + outdoors

The **Code** tab groups the modeled plan checks by topic, with Indoor / Outdoor filters. Each result identifies a design revision, missing information, a review item or an individual check met. It links to the plan location and source. The PDF includes this schedule. Scope is studio floor-plan and site-plan analysis, not a whole-building compliance audit. No construction-type, height/area, structural, energy or plumbing workflow is added.

Door Properties now record swing relative to egress travel. The 50-person trigger uses the whole served room/area, not the share allocated to each door (2021 IBC 1010.1.2.1). Common-path traces can be linked to a starting room; its current use/load determines the limit, and an excessive linked trace affects the doorway-count check (1006.2.1). Missing room traces remain explicit input gaps.

Pedestrian and accessible site paths can be classified as approach, exit discharge or egress court. For discharge/court paths, select the actual ground-floor exits served and enter the narrowest clear width. Assigned exit loads are summed once; width is checked against a capacity lower bound and known upstream requirements (1005.3.2 / 1028.3). The 44-inch egress-court minimum applies only to explicitly classified courts in the supported A/B/E/M subset (1029.2), not to arbitrary site lines. Multiple-floor discharge, merges, gates and continuous clear width remain review items when not established. A walking-route width/slope check does not establish accessible means of egress.

Regression cases cover a 60-person room with two 30-person door allocations, missing swing, ordinary paths versus egress courts, combined outdoor loads, missing exit assignments, sprinkler/voice factors, multi-floor limitations, linked common-path thresholds, site-check deduplication and report escaping.


## Guided practice cases

**Start** opens the Kendeda study, an upload or a blank drawing. **Examples** offers Kendeda Building and Bullitt Center plus three drawing exercises. The case links open a preview before replacing a saved project. Historical precedents remain readable in saved projects, including their guide and PDF attribution, but are no longer offered to new students.

For the U.S. models, their source drawings and the limits of the IBC comparison, see [U.S. precedent records](US-PRECEDENTS.md). A prior permit, drawing, award or sustainability certification is not by itself an egress baseline. Exercises are not certified building examples.

- **Rooms, doors + people:** confirm an assembly room's use and area basis, repair
  a narrow door and its swing, then move a shared wall to see both room loads change.
- **From exit to public way:** widen a ground-floor egress court, investigate a
  pedestrian/vehicle crossing and move an exit shared by the building/site view.
- **Floors, stairs + a lightwell:** compare a setback using shared XY coordinates,
  repair a stair link and extend a double-height opening through the third floor.

Guide actions locate the actual model objects and open their existing Properties.
Practice goals read the current analysis; they are not a compliance score and do
not become complete while analysis is pending. Removed objects cannot satisfy a
goal. All cases remain fully editable, exportable and undoable.

Before the first case replaces a non-practice project, the app stores that project
under the separate IndexedDB `before-examples` key. It waits for the transaction
before replacing the canvas; a storage failure leaves the current project intact.
Switching or restarting cases does not overwrite that checkpoint. **Return to my
design** restores it, including after a page reload. Current practice geometry and
step are saved by the existing local autosave, and downloadable project files also
retain the guide. A new visitor sees the case chooser; existing projects are kept.

Validation: `node --test tests/egress/*.test.mjs` from the repository root (110 tests).
The example regression tests verify room connectivity, repairable door/court
findings, shared-wall area updates, real crossing removal, stair continuity and
upper-floor slab subtraction. Browser QA also covers guided selection/property
edits, moving a wall, case switching, reload and restoration of the original plan.


Open or unverified upper-floor stairs now receive separate amber circulation paths. These paths end at the landing and never contribute to qualified exit travel, complete public-way routes or egress capacity. A shared floor notice names the stair and explains why exit analysis stops; disconnected room portions retain their own location markers. Reports distinguish these limited circulation distances from full egress routes.

### Drawing workspace

The studio interface keeps the plan central, with a compact tool rail and a collapsible inspector. Practice steps show one action at a time; editing help, finding evidence, IBC references and detailed route notes expand on request. The complete evidence remains in the PDF report. The Inspector control changes only the layout, and Show underlay changes only the reference-image display. Dimension fields accept hundredth-unit increments.


### Import integrity

Recognition now separates source evidence, semantic objects and connectivity checks.
It preserves original CAD vectors and PDF paths, offers whole-page stroke extraction
for hybrid scanned/vector PDFs, and retains faint pencil lines and short stroke
branches. The source image stays available for comparison. Native CAD coordinates
are retained when preparing a semantic recognition image.

A floor outline no longer creates physical perimeter walls. New image recognition
can recover visible stroke runs along recognized architectural boundaries, excluding
furniture polygons, and join small (at most three source pixels) junction gaps only
where the source has ink. These remain reviewable proposals. No blank gap is closed
solely to make a room or a route work.

The review canvas supports adding/removing objects, editing the floor boundary,
source-line picking, shared-corner movement, snapping, Shift ortho, local detail
recognition, undo and original/object/source visibility. Detail recognition adds
proposals without replacing surrounding geometry. The instructor service is unchanged.

Import diagnostics locate unsupported wall spans, near-junction gaps, duplicate
walls, room boundary omissions, self-crossing room polygons, unhosted openings and
unclear room/door/corridor relationships. They are recomputed in the workspace and
included in PDF results. Unconfirmed door candidates are explicit temporary routing
barriers. Confirming a real jamb gap creates a portal host at the original gap,
without snapping the door to an adjacent endpoint or widening a neighboring wall.

These checks are not a measured universal recognition-accuracy guarantee. Source
strokes can still represent furniture/annotation; faint, occluded or ambiguous
architecture may need local recognition or a correction. The original two uploaded
plan sheets are used for private manual QA, not published as repository assets.
