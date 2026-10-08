# Steel Project Lectures 1 and 1.1

This module turns the supplied Lecture 9 assignment into a linked nominal-span model and table-reading exercise. Students first choose 3060 or 4060, then A–E from the original diagrams, then their assigned use/load condition. The study stays gated until those choices are explicit. It shares state between the two lectures and preserves the earlier steel material and anatomy activities.

Sizing uses discrete source-table entries, not continuous size sliders. Clicking a deck row applies its listed thickness and self-weight; clicking a joist or girder trial changes its nominal depth. Dimension annotations project endpoints from the same 3D member geometry and report the selected source row, nominal span and exact panel spacing. The active service load and support conditions stay visible next to the table. Chord/angle profiles remain schematic because the supplied tables do not specify their fabrication dimensions.

## Source trail

All source page numbers below refer to the uploaded PDFs, not the course's lecture numbering. The original PDFs in `steel-sources/` are copied unchanged from the supplied files. PDF.js 5.6.205 (legacy build, Apache-2.0 license in `vendor/pdfjs/LICENSE`) renders the original pages locally. Transparent PDF-coordinate hit regions highlight selectable cells; the printed layout, colors and values remain intact. `steel-pdf-map.js` maps joist/girder source coordinates to the separately validated lookup data. The student can zoom, inspect original headings, return to a selection or open the complete PDF. Source-page JPEGs are retained for reference; they no longer replace the table reader.

- `Lecture_9_Steel_Building_Roof.pdf`: project brief pp. 59–61; 3060 options pp. 65, 71–74; 4060 options pp. 75–79; deck and load example pp. 85–102; support and extension details pp. 103–105.
- `Steel_Roof_Deck_Span_Load_Table.pdf`: p. 1, printed p. 8. All displayed gauge / span / continuity values are transcribed from the allowable-load table. Each pair is total load / load causing L/240 deflection, in psf. Source blanks remain unavailable entries. The double-span 16 ga, 7 ft deflection value is 163 psf.
- `Joist_Span_Load_Tables.pdf`: p. 4 (printed 28), nominal 30 ft group; p. 8 (printed 32), nominal 40 ft group; p. 17 (printed 41), the displayed continuation of the nominal 60 ft group. Columns retain LRFD, ASD, L/240, L/360 and self-weight semantics. These are source excerpts, not an exhaustive catalog.
- `Joist_Girder_Span_Load_Tables.pdf`: p. 1 notes; p. 4, 30 ft group; p. 5, 40 ft group; p. 8, 60 ft group. Body entries are estimated girder self-weight in plf, not capacities. The source panel-load designation includes a girder self-weight allowance.
- `Joist_Girder_Column_Connection.pdf`: p. 1.
- `Top_Chord_Extensions.pdf`: pp. 1–3. Supplied as separate source checks; not automatically validated by the simple-span calculations.

## Deliberate calculation boundary

The interactive framing bay uses nominal horizontal dimensions, matching the lecture arithmetic. The original roof-option image supplies its actual roof form and slopes. The table exercise does not certify a sloped roof: actual member lengths, pitch effects, drift, uplift, load combinations, construction loading, bracing, connections and cantilevers need separate checks. Do not treat the supplied parallel-chord tables as verification of arbitrary roof shapes.

An interior joist carries `q × spacing + joist self-weight`; its two simple-span reactions each equal `wL/2`. Two-sided girder loading sums two equal joist reactions. A user-entered girder self-weight allowance (initially 1.0 kip per interior panel point, an explicit teaching assumption) is added before reading the ASD panel-load column. The result is a preliminary weight lookup, not girder strength or deflection verification.

The Lecture 9 replay keeps the example as a trial: 4060 C, Houghton, 20 ga triple-span deck, 7 spaces, 60 ft joist. Exact roof pressure is 116.98 psf; the joist roof load is 668.457 plf. Adding the 40LH13 self-weight of 29.9 plf gives 698.357 plf, exceeding the 678 plf ASD entry. The displayed feedback exposes that omitted self-weight instead of marking the slide's trial as verified.

## Verification

Run `node tests/steel-roof.test.cjs` from this directory. It checks the source example, load conservation, service/deflection distinctions, source blanks, conservative span lookup, differing E-option constraints, state restoration and 360 assignment/spacing combinations. Browser checks cover table interaction, incorrect/correct student attempts, trial changes, study export/import, existing anatomy, and desktop/mobile layouts.

## Coach integration

Structure Coach uses the same Lecture 9 knowledge and source-table data. Five optional conversation starters cover the assignment, deck, joist, girder and independent modeling. They prepare an editable message without sending it. Source-backed row lookup retains PDF page, nominal span, units and blanks. General explanations leave the calculation prompt unchanged. The evidence step connects recorded dimensions/designations to student-built grids, bearings, family/type dimensions and roof geometry. Steel Lecture 2 remains Upcoming.
