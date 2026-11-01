# Recognition performance

The slow path used one overview call, serial whole-sheet tiles, and up to 12
serial repair calls. A tile reporting truncated output or unresolved structure
was sent unchanged a second time before being split. These waits accumulate
even when the page is responsive.

The revised client keeps at most two independent image requests outstanding.
Replies still merge in tile/repair order. Each repair is evaluated against the
latest accepted geometry with the existing enclosure and topology safeguards.
The look-ahead window includes unconsumed replies; finishing early leaves at
most one additional requested detail. Completed replies are checkpointed for
resume, including replies that arrive after cancellation. Quota failures stop
new requests. A busy shared service triggers one serial fallback after already
admitted requests finish. Instructor quotas and service concurrency are unchanged.

Truncation and omitted-structure failures split the region immediately. A small
sheet whose only coverage tile is the entire image can reuse its overview after
the same omitted-structure check. Large sheets retain whole-sheet coverage and
the existing image resolution. The Gemini model, prompt and response limits
are unchanged.

Wall fitting, furniture contour checks and wall-evidence checks share the same
source-pixel mask within a fit. Target selection reuses the current compiled
quality assessment. Neither optimization changes geometric thresholds.

The page displays elapsed time. Project exports retain `image.recognitionRun.timings`:
each session records elapsed wall time, summed call time, failures, and peak
concurrency for model requests, coverage, reconstruction and geometry. Summed
model call time overlaps under concurrency and must not be reported as elapsed
time. These timings remain in the local project; no analytics endpoint is used.

## Reproduce

```sh
node --test tests/egress/*.test.mjs
node scripts/egress/benchmark-recognition-speed.mjs
```

The controlled benchmark uses eight 40 ms simulated responses. One observed
run took 327 ms serially and 162 ms with two requests, with identical merge
order and eight calls in both cases. This isolates scheduling; it is not a
Gemini speed guarantee or a measurement of a student's ten-minute upload.

297 regression tests pass, including out-of-order completion, deterministic
splitting, cancellation/resume, quota handling, serial fallback, repair budgets,
and stopping after an early successful repair. Source geometry safeguards remain
covered by the recognition regression suite.

The first live parallel test exposed a repeated-read trigger: crop coverage
checks discarded already recognized whole-sheet room/fixture context. The
revised check maps complete, non-low-confidence context into crop coordinates.
A detail still needs its own architectural wall evidence, and source components
outside both interpretations still trigger subdivision. Geometry acceptance
checks and unread-region reporting remain unchanged.

Source-pixel diagnosis isolated two additional false coverage alarms: outward
door swing arcs extend beyond indoor polygons, and exterior perimeter strokes
can sit a few pixels outside a model polygon. Known polygon edges now receive
the same narrow tolerance as known walls. Visible door arcs/leaves are excluded
using their recognized jambs and swing side; the surrounding area is not masked.
Tests keep a separate omitted wing detectable next to those symbols.
