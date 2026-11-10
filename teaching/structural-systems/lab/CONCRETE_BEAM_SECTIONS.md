# Concrete beam sections — 10 November 2026

Code commit: 1feb9bacd4d4107e4936c91ace9e10ef05955858.

## Source requirements
The original Parameters & Prototypes PDF, pages 14, 15 and 17, permits L, T or rectangular beams for ALPHA, CHARLIE and KILO. Page 16 specifies DELTA deck and vertical systems without prescribing a beam family. The app exposes all three shapes; the default schematic arrangement is an inward-facing L at a one-sided perimeter support and an inverted T at an internal two-sided support. This is a modeled support arrangement, not a claim that the assignment mandates one particular beam family.

The original Precast Span & Load Tables PDF is retained: rectangular beams p.12, L-shaped beams p.13, inverted T beams p.14. No capacities were replaced with invented values.

## Implemented behavior
- Explicit L / inverted T / rectangular shape selection for roof and floor beam groups.
- Separate perimeter and interior selections when both occur, including CHARLIE.
- Actual non-overlapping flange and web solids; opposite edge L ledges face inward. Internal L beams are modeled in pairs, one ledge per deck side.
- Deck end geometry clears beam upstands. Nominal grid spans remain the conservative table-check spans; rendering cutbacks do not silently shorten the design span.
- A bearing-section diagram uses the same selected dimensions as the 3D model, with a Show beams only control.
- Original PDF cell selection applies section dimensions, service capacity, span and self-weight. Schematic geometry remains explicitly unverified until a compatible source cell is selected.
- Each beam group uses its own tributary width and source self-weight. Paired L members include both self-weights in reactions.
- Saved studies retain shape and independent source selections; legacy shared beam selections migrate on mixed layouts.
- Shared Wood / Steel / Concrete workspace, perspective default, orthographic option and face shading are preserved.

## Validation
36 automated tests passed, 0 failed. Full output: BEAM_TEST_RESULTS.txt.
Tests cover all four prototypes and all three shapes, inward L orientations, non-overlapping section solids, deck clearance, dimensional application, load and reaction conservation, saved-state migration and existing Wood / Steel / renderer regressions.

Browser checks in the local preview:
- KILO L beam: clicked original 18LB24, 24 ft, 4090 plf; model received 18 x 24 in section and 375 plf self-weight.
- Rectangular beam: clicked original 12RB24, 24 ft, 3830 plf.
- CHARLIE interior T: clicked original 28IT24, 20 ft, 5990 plf.
- CHARLIE floor: original 4HC8+2, 58-S, 30 ft, 95 psf.
- CHARLIE edge L: original 18LB24, 20 ft, 6038 plf.
- With this floor, edge demand is 2190 plf and interior demand is 4380 plf; both retain independent source records.
- DELTA can select paired L sections; ALPHA exposes all three section choices.

Service-table comparisons do not complete connection, reinforcement, lateral stability, camber, bearing-pad or soil design. The interface preserves these scope limits and source footnotes.

Actual browser Save study / Open study round-trip also passed: a saved DELTA paired-L selection was restored after changing the live shape to rectangular, with independent edge source records retained.
