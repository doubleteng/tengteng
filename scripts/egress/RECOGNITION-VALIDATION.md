# Recognition validation

The isolated `/teaching/egress/recognition-qa.html` uses its own local project
database. A passing synthetic benchmark is not a claim of accuracy on arbitrary
architectural drawings. Production promotion requires source-plan inspection.

## Reproduce

```sh
node --test tests/egress/*.test.mjs
python scripts/egress/generate-recognition-benchmark.py /tmp/egress-benchmark
node scripts/egress/evaluate-recognition-benchmark.mjs exported.egress.json /tmp/egress-benchmark/truth.json
```

The generator uses Pillow and DejaVu Sans. It creates solid-wall, double-line,
and rotated faint-line drawings, plus independently known geometry. Send only
the drawing image to the recognition service. Set its scale to 40 source pixels
per metre (48 for the rotated drawing), save the recognized project through the
application, then evaluate the export. The rotated case uses
`truth-rotated-gray.json`.

The test plan has six indoor spaces, a covered balcony, an open courtyard and
nine doorway assemblies. It includes double leaves, staggered sliding panels,
continuous windows, loose furniture, three toilet cubicles and sanitary fixtures.
No coordinates from the benchmark appear in the recognition implementation.

## Observed service run, 2026-11-01

The shared service read the double-line PNG, first as an overview and then as
four regions. Before user edits, it identified all six indoor spaces, matched
their areas within 1%, found the two intended exterior areas and nine doorway
assemblies, and did not turn furniture or cubicles into rooms. All eight swinging
assemblies had the expected opening side; the sliding assembly remained sliding.

Two defects were exposed by this run:

- Source fitting initially located only eight of nine doorways. Sliding panel
  rails were entering the wall graph. Refinement version 10 locates the ninth
  assembly without a fictitious swing, and preserves all six rooms.
- A detail crop added one false covered exterior area in the blank sheet margin.
  Center-point counts alone missed this. Evaluation now reports extra exterior
  features and pending exterior extents. Clipped proposals cannot become usable
  outdoor/void geometry; they trigger a surrounding-context reread.

The original large community plan still contains unresolved opening evidence.
Several frontages in that source have thin continuous lines without readable
door swings. Do not invent openings to make route coverage appear complete.
Accuracy on arbitrary hand sketches, scan degradation, dense large buildings,
stairs and ambiguous glazing is not established by these tests.

A second shared-service run used the 17-degree rotated, faint solid-wall PNG.
All six indoor spaces, both exterior areas and nine doorway assemblies were
located. One opening side was initially unresolved because a thick jamb shifted
the fitted aperture endpoints; bounded source-pixel tolerance in refinement 11
recovers its distributed arc and leaf evidence. Replaying the actual saved
response through refinement 11 yields all nine expected assembly directions,
no extra doorways or exterior areas, and no pending enclosures. A clipped copy
of the already complete balcony is now discarded by spatial overlap.

## Reconstruction contracts

- A shorter detail wall replaces only its actual overlap, preserving both
  uncovered ends of the old wall.
- An opening-only reread first tries portals without unrelated wall redraws.
- Repairs cannot merge previously separate rooms, lose previously enclosed
  seed points or introduce new unlabelled cells to obtain a better score.
- Wall-face fragments collapse into one axis when supported by source pixels;
  two walls bounding an occupied strip remain separate.
- An opening inventory searches a large room's perimeter and resumes unread
  regions from its persisted ledger.
- A tile with one returned wall is still checked for substantial source strokes
  outside described areas, including angled or faint wings. Such strokes cause
  smaller rereads, never automatic wall generation.
- A continuous window-frame counterexample cannot pass sliding-panel evidence.
- Preview, application and reports use the same wall-derived room geometry.
