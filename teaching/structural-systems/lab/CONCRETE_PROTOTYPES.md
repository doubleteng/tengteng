# Concrete prototype systems and original-table bindings

The four poster systems are now distinct. The default is a structural-system study on the course's 60 × 120 ft footprint and permitted deck modules, not a dimensional replica of the original poster. The System selector exposes the course adaptation separately.

| Type | Default poster load path | Course change shown separately |
|---|---|---|
| ALPHA A.3 | Double tees → wall haunches → structural wall panels; no independent columns or beams | Parameters p.14 and Lecture 12 pp.156–159 add one longitudinal column/beam line |
| CHARLIE C.2 | Hollow core → beams → haunches → columns | Parameters p.15 adds 1–3 lite-wall lines; Lecture p.151 specifies three |
| DELTA D.3 | Double tees → opening-bearing lite-wall panels; no independent columns or beams | Parameters p.16 adds a transverse column/beam line; Lecture p.152 omits it; beam subdivision is a design choice |
| KILO K.3 | Hollow core → perimeter cyclopean block walls and internal beams → portal lite walls | Parameters p.17 substitutes a continuous longitudinal lite-wall line; no ordinary columns |

Wall panels have openings and integral heads, ALPHA/DELTA have bearing seats, CHARLIE has column haunches, and KILO has block courses and portal wall supports. Enclosure is a separate switchable layer with type-specific fins, spandrels, guardrails, panels and hoods. These are schematic shapes; reinforcement and connection details are not fabricated.

## Member to source correspondence

- Each deck/beam group stores an original PDF cell ID. The same record supplies geometry, section, strand pattern, printed span, allowed superimposed service load and self-weight.
- Hollow core: pp.2–3. 8 ft double tees: pp.4–8. 10 ft double tees: p.9. Rectangular/L/inverted-T beams: pp.12/13/14.
- Roof and floor records are independent; edge/interior beam groups are independent. Existing live/snow/dead-load cases remain from Parameters p.12.
- Wrong family, module width, topping or an insufficient table span cannot overwrite a selection. An insufficient capacity may be selected for comparison but remains failing. Blank cells and source anomalies are not converted into passing capacities.
- Stair flight rows are p.10 (100 psf source live load); p.11 is bearing guidance. Landings/access slabs do not inherit flight capacities.
- Column pp.15–16 and wall pp.17–18 are reference diagrams, not verified capacities for the modeled haunches/openings/blocks. Enclosure and raft have no invented span-load cells.
- Member picks expose their source group. The source schedule export contains group records and rendered-member IDs with exact cell/page associations.
- Beam defaults are preliminary geometry, not prototype prescriptions. Two-sided L arrangements use a disclosed paired-member assumption; connection width and design require review.

## Verification

46 repository test entries passed, including 10 new prototype/source-binding tests. Tests cover both systems, all three occupancy cases, all seven stages, valid bearing lines, numeric source transcription, invalid-selection rejection, geometric source IDs and gravity-load conservation after openings. Browser QA additionally checks all four systems and direct PDF selection. These checks do not establish reinforcement, stability, connection or soil adequacy.
