---
title: 'Tuck-Folding: A Computational Method for the Flattening and Fabrication of Compression-Dominant Shell Structures'
card_title: 'Tuck-Folding: A Computational Method for the Flattening and Fabrication of Compression-Dominant Shell
  Structures'
category: research
year: '2026'
published: true
featured: false
featured_order: 99
permalink: /research/tuck-folding/
cover: /assets/media/tuck-folding/fabric-hinge-model.webp
cover_alt: PLA panels printed on fabric, shown flat and folded into a shell formwork model
cover_preview_only: true
summary: Tuck-folds turn the gaps created by flattening a curved shell into controllable fold features, linking
  structural form-finding to fabrication in paper and PLA-on-fabric.
role: Co-author
institution: Lawrence Technological University · Cornell University · Thomas Jefferson University
project_type: Computational geometry and foldable shell formwork
project_stage: Geometric prototypes; casting and scale-up proposed
tags:
- tuck-folding
- 3D graphic statics
- computational fabrication
- shell structures
- reusable formwork
research_areas:
- material-computation
credits:
- 'Research authors: Yi Yang, Chun Zhou, Teng Teng'
- Yi Yang — Cornell University
- Chun Zhou — Thomas Jefferson University
- Teng Teng — Lawrence Technological University
- 'Images and diagrams: the authors'
primary_link:
  title: Read the paper · ACADIA 2026 (PDF)
  url: /assets/documents/tuck-folding-2026.pdf
related_publications:
- title: 'Tuck-Folding: A Computational Method for the Flattening and Fabrication of Compression-Dominant Shell
    Structures'
  url: /assets/documents/tuck-folding-2026.pdf
  publication_id: yang2026tuckfolding
  context: ACADIA 2026 · Computational geometry and fabrication
related_projects:
- /research/multi-material-deployable-structures/
- /design/operation-ppe/
sections:
- type: text
  anchor: paper-prototype
  heading: 'Thin sheet: reconstructing the shell in paper'
  body: 'A 1:10 Bristol-paper model, measuring 650 × 650 mm, reconstructs the shell from 21 pieces. Laser-cut dashed
    lines allow both mountain and valley folds. Gluing the tucks fixes their 180° creases and joins the pieces into
    the slab.


    Comparison with the digital target shows qualitative geometric agreement. Thin or long, narrow tucks provide
    weaker control of the folded shape, and the isolated model requires horizontal support at its outer boundary.
    The glued assembly demonstrates reconstruction but cannot be unfolded for reuse.'
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/paper-model.webp
  columns: one
  caption: 'The 1:10 paper prototype: laser-cut patterns, folding, glued modules, and the assembled slab in plan
    and elevation.'
- type: text
  anchor: fabric-prototype
  heading: 'Thick sheet: beveled panels and fabric hinges'
  body: 'A 1:25 prototype extends the method to PLA printed directly onto gold tulle mesh. The shell is divided
    into 13 pieces. Beveled panel edges accommodate material thickness and encode the required fold angles, while
    the continuous fabric layer connects the rigid panels across their creases. A 0.1 mm offset on each side of
    the 180° creases prevents adjacent faces from fusing during printing.


    The printed components fold into the target curvature. The fabric permits hinge motion, while the assembled
    prototypes shown in the presentation are fixed in their folded state. The study has not yet tested repeated
    assembly and reuse, formwork stiffness, or concrete casting.'
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/fabric-hinge-model.webp
  columns: one
  caption: The 1:25 PLA-on-fabric prototype, from flat printed pieces to folded modules and assembled formwork.
- type: text
  anchor: force-form
  heading: From equilibrium to a panel network
  body: 'PolyFrame 2 generates a planar-faced shell through reciprocal force and form diagrams. Each form edge is
    normal to its corresponding force face, whose area represents the edge-force magnitude at the chosen force scale.
    This relationship supplies both the target geometry and the force information used to guide tuck widths.


    The modular slab combines a column, canopy, and connecting arches. Subdivision changes the panel network and
    curvature: column and canopy regions are synclastic, while the connecting arches are anticlastic. The arch edges
    carry the highest forces in the studied configuration.'
- type: image
  image: /assets/media/tuck-folding/reciprocal-force-form.webp
  alt: Reciprocal force and form diagrams generated with PolyFrame 2
  caption: The force diagram defines the equilibrium relationships used to generate the shell geometry in the form
    diagram.
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/force-and-curvature.webp
  - /assets/media/tuck-folding/vertex-curvature.webp
  columns: two
  image_ratios:
  - 1.68185
  - 1.68185
  caption: Force cells and their corresponding shell regions (left); synclastic and anticlastic vertex configurations
    (right).
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/subdivision-typologies.webp
  columns: one
  caption: Four force-diagram subdivision patterns and their corresponding shell layouts.
- type: text
  anchor: split-rules
  heading: Curvature determines where the shell is split
  body: 'The corner-angle sum at a vertex controls how the surrounding faces flatten. In the illustrated configurations,
    developable vertices sum to 360° and unfold without a split. Synclastic vertices sum to less than 360° and open
    an angular gap after one split. Anticlastic vertices sum to more than 360° and require two splits in this workflow.


    Adjacent vertices also constrain the split path. Splitting along a shared edge can create a quadrilateral gap
    whose sides cannot close through a mirrored tuck. Splitting each illustrated synclastic vertex along its short
    edge produces isosceles triangular gaps that can close along their bisectors.'
- type: image
  image: /assets/media/tuck-folding/flattening-vertex-rules.webp
  alt: Anticlastic, synclastic, and developable vertices with their flattened patterns
  caption: Corner-angle sums distinguish the three vertex types. Red edges mark the splits used to flatten each
    configuration.
- type: image
  image: /assets/media/tuck-folding/neighboring-split-rules.webp
  alt: Two neighboring vertices split along a shared edge or along their short edges
  caption: The short-edge splits preserve mirrored gaps, allowing a simple tuck to reconnect the faces.
- type: image
  image: /assets/media/tuck-folding/shell-segmentation.webp
  alt: Shell geometry, edge-force magnitudes, and the segmented shell
  caption: The shell is divided primarily through the anticlastic arch regions. Further splits keep each piece within
    laser-cutter, CNC, or 3D-printer bed dimensions.
- type: text
  anchor: tuck-method
  heading: Inner tucks create a constrained design space
  body: 'A tuck inserts a local fold region between faces. Its central crease closes through 180°, while neighboring
    creases recover the target surface angles. Adding width separates the faces in the flat pattern and creates
    a small polygonal opening around the vertex. The offsets must close around that opening, coupling the widths
    of neighboring tucks.


    For the vertex configurations studied, n joining edges leave n − 2 independently adjustable widths. A three-edge
    vertex has one free width; a four-edge vertex has two. Two neighboring four-edge vertices share one width and
    therefore have three independent widths across their seven edges. The current workflow selects the controlling
    edges and adjusts widths manually within these geometric relationships.'
- type: image
  image: /assets/media/tuck-folding/inner-tuck-closure.webp
  alt: Minimal triangular splits and progressively wider inner tucks at three-face and four-face vertices
  caption: Increasing tuck widths preserves the mirrored split while opening a polygonal hub around the vertex.
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/single-vertex-widths.webp
  - /assets/media/tuck-folding/neighboring-vertex-widths.webp
  columns: two
  caption: Orange identifies selected widths and blue identifies dependent widths. Shared edges couple the choices
    at neighboring vertices.
- type: text
  anchor: force-sizing
  heading: Force information guides tuck widths
  body: 'Selected widths follow the relative edge forces from form-finding; the remaining widths follow geometric
    closure. A dependent tuck can become narrower than the chosen force-based target. Scaling the controlling widths
    together preserves their ratios and increases the dependent widths. Material thickness, fold collisions, and
    fabrication limits still constrain the feasible pattern.


    The diagram uses illustrative force values to explain this sizing logic. It does not establish the load capacity
    of the formwork under wet concrete; that requires structural analysis and physical testing.'
- type: image
  image: /assets/media/tuck-folding/force-informed-widths.webp
  alt: Illustrative force ratios, controlled ring widths, and a scaled pattern meeting the selected width targets
  caption: The ring widths are controlled while the spokes follow from closure. The example scales the ring by 1.06
    to bring the narrowest spokes up to the illustrative targets.
- type: text
  anchor: fold-junctions
  heading: Folded fins must meet at the vertices
  body: 'Each folded tuck forms a fin along the panel edge. Square-ended strips can collide or leave gaps where
    several fins meet, so their short edges are re-angled and the central hub is cut out. The required trimming
    changes with the direction of folding.


    Border tucks connect separate shell pieces. Their widths can be set independently because they do not participate
    in the internal vertex-closure loop. Neighboring border tucks still need adjusted ends so they meet after folding.'
- type: image
  image: /assets/media/tuck-folding/fold-junction-adjustment.webp
  alt: Upward and downward folded fins with adjusted short edges and a cut-out central hub
  caption: Short-edge adjustment brings the illustrated fins toward a common vertex axis. A general vertex requires
    checking the intersection of its fin planes.
- type: image
  image: /assets/media/tuck-folding/border-tuck-sizing.webp
  alt: Border-force distribution, independent tuck sizing, and adjusted border-tuck ends
  caption: Border tucks are sized separately and their ends are trimmed to meet at the corners. Force values are
    illustrative.
- type: text
  anchor: fabrication-details
  heading: Encoding the fold in the fabrication file
  body: 'For the paper prototype, both mountain and valley folds become dashed laser cuts. The perforations bend
    in either direction, allowing all outlines and creases to be cut from one side. Scoring would require two aligned
    passes on opposite faces of the sheet.


    For the thick-sheet prototype, PLA panels are printed above the continuous fabric layer. Bevels leave room for
    the panels to rotate and then meet at the intended angle. The central 180° fold bends fabric against fabric
    and needs a separation gap rather than a bevel. Turning the printed assembly over places the fabric above the
    ribs as the proposed casting surface.'
- type: image
  image: /assets/media/tuck-folding/laser-perforation.webp
  alt: Fold pattern translated into one-sided perforation cuts and a two-sided scoring alternative
  caption: Mountain and valley creases share the same dashed-cut treatment in the laser file. The comparison is
    a simplified pattern illustrating the fabrication method.
- type: image
  image: /assets/media/tuck-folding/printed-fabric-hinge-detail.webp
  alt: Exploded PLA and fabric layers, followed by a turned-over and partially folded tuck
  caption: PLA carries the bevel geometry; tulle connects the panels across the folds. The 0.1 mm offset applies
    to each side of the central 180° crease.
- type: text
  anchor: scope
  heading: 'Folding Concrete: a 10 × 5 m pavilion proposal'
  body: 'The outdoor gallery proposal applies the method to a modular compression-dominant canopy. Repeated modules
    would provide neighboring support; a standalone canopy requires lateral bracing. The proposed construction sequence
    mills plywood panels, bolts them to fabric, transports the pieces flat, and folds and assembles the formwork
    before casting.


    The related competition proposal, Folding Concrete by Yi Yang and Chun Zhou, received the [Buildner Student
    Award](https://architecturecompetitions.com/concretepavilion/). The pavilion renderings show the architectural
    proposal; full-scale plywood fabrication and concrete construction remain future work.'
- type: image
  image: /assets/media/tuck-folding/pavilion-gallery-render.webp
  alt: Rendering of the proposed concrete canopy sheltering an outdoor gallery
  caption: 'Folding Concrete: proposed outdoor gallery pavilion. Rendering, not a built structure.'
- type: gallery
  heading: ''
  images:
  - /assets/media/tuck-folding/proposed-construction.webp
  - /assets/media/tuck-folding/pavilion-design.webp
  columns: two
  image_ratios:
  - 0.772698
  - 0.736842
  caption: Proposed fabrication, transport, assembly, and casting sequence (left); pavilion renderings, plan, and
    section (right). The pavilion is a design proposal.
- type: text
  anchor: next-steps
  heading: 'Next tests: casting and a constraint-based solver'
  body: 'The next physical step is a 1:10 concrete casting test to evaluate sealing, resistance to casting pressure,
    and demolding. Scanning the cast piece against the digital target would provide measured geometric deviation.
    Repeated folding, stiffness, tolerance accumulation, and hinge durability also require testing before scale-up.


    The computational next step is a solver that encodes vertex closure, width bounds, and machine-bed limits as
    explicit constraints. It would reconcile force-based width targets with geometric feasibility and package the
    workflow as a design tool. Full-scale plywood-on-fabric construction follows these tests.'
editor_notes: 'Sources: original 195_Yang.pdf, existing Drive figures, and the user-supplied 28-slide ACADIA 2026
  presentation, updated October 2026. Added diagrams are extracted from presentation slides 7, 10–18, 20, 23 and
  28, converted to WebP without changing their content. Existing seven project images, paper PDF, author order,
  affiliations, prototype-first order, and card-only cover are preserved. Presentation slides 26–27 distinguish
  geometric proof from untested casting, stiffness, reuse, and scale-up; use that narrower scope where the older
  manuscript claims reusability. Force values and the 1.06 scaling example are illustrative, not pavilion test results.
  No general E−2V solver claim is made. Buildner award attribution is to Yi Yang and Chun Zhou, verified against
  the official competition page. No animation is embedded in the PPTX. Proceedings metadata is unchanged pending
  confirmation.'
research_question: How can local folds and hinge arrangements reconstruct a compression-dominant shell from flat
  sheets?
role_summary: Coauthor of the computational folding study with Yi Yang and Chun Zhou.
evidence_summary: A 1:10 paper shell and 1:25 PLA-on-fabric prototype demonstrate geometric reconstruction. Tuck
  widths respond to force information and fold constraints; casting, stiffness, reuse, and full-scale construction
  remain to be tested.
related_connections:
- url: /research/multi-material-deployable-structures/
  reason: Encoding curved geometry in flat patterns and local folds
- url: /design/operation-ppe/
  reason: Transforming flat printed patterns through flexible hinges
reading_path:
- title: Physical prototypes
  target: paper-prototype
- title: Force and form
  target: force-form
- title: Split and tuck rules
  target: split-rules
- title: Fabrication details
  target: fabrication-details
- title: Pavilion and next steps
  target: scope
evidence_target: paper-prototype
evidence_first: 4
question_label: Research question
---
