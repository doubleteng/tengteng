# Egress + Site Lab

Live app: https://teng-teng.org/teaching/egress/

An architectural teaching environment for drawing and comparing floor plans, connected stairs, exit discharge and site circulation. All geometric analysis and CAD decoding run in browser workers. The frontend is published by the existing GitHub Pages site. Google Apps Script supplies optional private Drive storage and a Sheets project index.

## Student workflow

1. Explore the two-floor example or start a new design. Select **All floors** to edit floor plans alongside the site.
2. Draw a floor boundary, rooms, walls and door openings. Edit dimensions and occupancy assumptions in **Properties**. Add floors and use matching stair link names.
3. Draw site walkable areas, obstacles, pedestrian, accessible and vehicle routes. Mark actual public-way connections separately from assembly points.
4. Import DWG, DXF or Rhino 3DM; choose source layers, confirm units and optionally flatten nonplanar curves. Import references or wall centerlines. Double-line walls and door symbols need analysis geometry traced over them. PDF page 1 and images can be calibrated with a known distance.
5. Toggle object types, circulation types, floor views and original CAD layers independently. Visibility changes display only, never the analyzed model.
6. Drag doors, walls, rooms and route vertices. Checks update after each edit. Play animates route connections; it does not calculate evacuation times. Store a baseline and compare travel distances and flagged checks.
7. Download/open a `.egress.json` project, use local autosave, or authorize the optional Google storage. Export report opens a printable page with results, assumptions and references.

## Analysis scope

This is an educational design aid, not a compliance certificate or evacuation-time model. It uses a documented subset of **2021 IBC** for A/B/E/M and **2010 ADA**, not a claim about the jurisdiction's adopted edition. Results distinguish a checked condition, a flagged condition and an unresolved review item. Sprinkler and alarm assumptions must be checked by the student. The report includes sources.

Routes use sampled grids with wall/obstacle crossings blocked. The grid resolution and local geometry affect measurements. Exit travel ends at an assumed protected exit; the connected journey separately continues through linked stairs, the ground floor and the site. Stair lengths are user inputs. Common paths and dead ends are student-traced. Corridor widths, accessible turning/passing/ramps, exit independence, protected enclosures, exit capacity allocation, fire/smoke, door hardware and swings, terrain and local amendments require review. A green path is not proof of code compliance.

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
