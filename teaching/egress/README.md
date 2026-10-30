# Egress + Site Lab

Live app: https://teng-teng.org/teaching/egress/

An architectural teaching environment for drawing and comparing floor plans, connected stairs, exit discharge and site circulation. All geometric analysis and CAD decoding run in browser workers. The frontend is published by the existing GitHub Pages site. Google Apps Script supplies optional private Drive storage and a Sheets project index.

## Student workflow

1. Explore the two-floor example or start a new design. Select **All floors** to edit linked floor plans. The ground floor and site share one viewport; its exits connect the indoor and outdoor routes. Each viewport keeps its own camera.
2. Draw a floor boundary, rooms, walls and door openings. Edit dimensions and occupancy assumptions in **Properties**. Add floors and use matching stair link names.
3. Draw site walkable areas, obstacles, pedestrian, accessible and vehicle routes. Mark actual public-way connections separately from assembly points.
4. Import DWG, DXF or Rhino 3DM; choose source layers, confirm units and optionally flatten nonplanar curves. Import editable CAD linework or assign selected linework as walls. Single-line walls require a user-entered thickness. Double-line straight faces have a conservative pairing preview with explicit review; ambiguous, curved or unmatched faces stay reference. Door symbols never create functional openings. Choose a PDF page and calibrate with two points on a known dimension before converting or tracing.
5. Toggle object types, circulation types, floor views and original CAD layers independently. Visibility changes display only, never the analyzed model.
6. Right-drag to pan; scroll to zoom at the pointer in single or multiple views. Osnap resolves End / Mid / Int / Perp / Near on visible model/CAD geometry. Grid snap is separate; Shift or F8 constrains Ortho, and Alt bypasses snapping. Draw walls as a continuous chain; Enter ends it. Drag doors, walls, rooms and route vertices. Dragging triggers throttled live analysis; attached room edges, floor corners and doors follow wall edits. Areas, occupant loads and egress paths update during the drag. Optional room program-area targets compare the changed area with the design brief. Play animates route connections; it does not calculate evacuation times. Store a baseline and compare travel distances and flagged checks.
7. Download/open a `.egress.json` project, use local autosave, or choose Cloud → Connect Google for optional Google storage. Keep the Google connection window open while saving and loading. Export report opens a printable page with results, assumptions and references.

## Analysis scope

This is an educational design aid, not a compliance certificate or evacuation-time model. It uses a documented subset of **2021 IBC** for A/B/E/M and **2010 ADA**, not a claim about the jurisdiction's adopted edition. Results distinguish a checked condition, a flagged condition and an unresolved review item. Sprinkler and alarm assumptions must be checked by the student. The report includes sources.

Routes use sampled grids with wall/obstacle crossings blocked. The grid resolution and local geometry affect measurements. Exit travel ends at an assumed protected exit; the connected journey separately continues through linked stairs, the ground floor and the site. Stair lengths are user inputs. Common paths and dead ends are student-traced. Corridor widths, accessible turning/passing/ramps, exit independence, protected enclosures, exit capacity allocation, fire/smoke, door hardware and swings, terrain and local amendments require review. A green path is not proof of code compliance.

## Editable imported plans

After a PDF/image is calibrated, **Make PDF / image editable** opens extracted geometry in the same review workflow as CAD. Vector PDF paths are tessellated; PDF text is omitted. JPG, PNG and scanned PDFs are automatically vectorized in a worker using dark-stroke skeletons and simplified polylines, including angled and curved strokes. Faint/interrupted lines, image noise, text and furniture still require review and correction. All resulting vector endpoints are editable. Click single-line preview segments to exclude dimensions/furniture before wall conversion. The original reference remains independently hideable.

**Detect rooms from editable walls** finds enclosed regions in a connected wall-centerline network and can use its outer loop as the floor boundary. Gaps and disconnected loops require correction; the app does not invent an enclosing hull. Review the generated rooms, functions and area basis. Doors/exits always need explicit semantic assignment. Moving a wall carries attached room edges, connected wall junctions and doors, enabling live area/load/route changes. Loose CAD linework is also directly selectable and editable, but affects analysis only after it is assigned as a wall.

## Floor registration and multi-height spaces

All floor plans and the site use shared world XY coordinates in meters; display units do not alter the model. Floor elevation supplies Z. CAD imports preserve the source origin by default. Use the reference-floor overlay to align walls and stairs while drawing. Overhangs and setbacks remain different outlines in the same coordinate system; the app never recenters floors by their bounding boxes.

For a PDF or drawings with different origins, calibrate scale first, then choose **Align floor**. Pick A and B on the current drawing and the corresponding A and B on the reference drawing. The app applies a rigid translation/rotation to that floor's image, CAD and modeled geometry. A baseline mismatch above 1% is rejected; alignment does not rescale. Matching stair link names require overlapping XY footprints before a complete route can connect; offset stairs remain unresolved for review.

**Multi-height space** is one shared polygon with an occupied base floor and the highest level without a slab. Ground → Level 2 makes a double-height space; Ground → Level 3 removes slabs on Levels 2 and 3. Every intermediate floor is updated automatically by elevation. Upper-floor routing treats the void as an obstacle; room area/occupant-load calculations subtract the union of overlapping voids. The base retains its floor area. Moving the shared polygon updates every affected floor. Hiding its display layer does not restore the slab. Smoke control, guards, atrium separation and structural support remain separate review items.

## CAD preparation

Use 1:1 model-space plan curves on XY, explicit units, one floor per import, and consistent origins/orientation. Separate wall linework, door symbols, furniture, annotation and site layers. Meshes and surfaces need exported 2D curves. The import preview displays real-world extents and retained coordinates for checking. Moving each drawing near its own origin is opt-in and warns that this breaks registration. Nonplanar geometry requires explicit XY projection.

Double-line pairing proposes only unique, nearly parallel straight faces on the same layer with substantial length overlap and a thickness inside the selected range. It is a reviewed conversion, not automatic wall semantics. Original CAD remains available for tracing and verification of corners, junctions and openings.

Native DWG uses LibreDWG Web 0.8.2 and Rhino uses rhino3dm 8.17.0. Curves are tessellated. Supported linework includes lines, polylines, circles/arcs, ellipses, nested blocks and supported splines; unsupported entities are reported rather than fabricated. Meshes, surfaces and fit-only DWG splines are excluded. Maximum CAD file size 35 MB, 35,000 selected reference segments or 1,500 converted walls per import. Original CAD files are processed locally. Cloud saving sends the resulting project only on request.

## Development and deployment

```sh
cd teaching/egress
npm ci
npm run build
npm test
npm run dev
```

The checked-in `index.html`, styles, source and browser modules are published directly; npm is only needed to develop or regenerate vendor files. The application has no frontend API secrets. `cloud-config.json` points to the deployed Apps Script web app. Backend source and deployment details are in `../../scripts/egress/`.

The app is GPL-3.0; see LICENSE.txt and THIRD_PARTY.md. This license applies to this application directory, not the unrelated portfolio content.

## Architectural image recognition (vision setup required)

`AI · recognize rooms + circulation` sends the selected plan to the fixed Google Gemini endpoint through the account's Apps Script bridge. It returns typed room, corridor, lobby, outdoor, courtyard, void, projected context, furniture, stair, wall and opening proposals. The user reviews colored geometry over the original image and can relabel, exclude and reshape it. Calibration is required before applying an analysis model.

Furniture is stored in `floor.features`; it never creates rooms, partition walls or occupant area. Optional `blocksMovement` affects route obstacles only. Indoor room polygons are supplied by semantic interpretation, not by furniture outlines. Openings remain in `floor.candidates` until a user confirms jamb position, clear width and exit status. AI stairs default to unprotected and unlinked. Other-floor gray geometry stays reference; courtyards/voids are removed from indoor area and routes.

**Not enabled without credentials:** configure a Gemini API key inside the Google connection window. Keys are private per account in Apps Script UserProperties, never in GitHub, browser local storage, exported projects or bridge messages. This version does not provide a shared teacher-paid key. Backend source: `scripts/egress/Vision.gs`; default model `gemini-3.8-flash`, configurable. External-request OAuth authorization is required. The per-account limit is 20 requests/day. Google API quota/charges apply.

`Trace image / PDF linework` is a separate manual aid, not architectural recognition. It preserves up to 2400 px for tracing instead of the old 1200 px downsample. It may contain furniture, lettering and stair treads. Raw linework must not be described as automatically recognized rooms.

Validation: semantic contract tests cover furniture/room isolation, route-obstacle opt-in, unconfirmed-opening isolation, projected context, coordinate transforms, scale checks, malformed responses, private credentials and provider errors. These are implementation tests, **not recognition-accuracy benchmarks**. Real-image semantic accuracy remains unverified until a configured vision account is used.
