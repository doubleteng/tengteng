"""Test for clashes inside the folded market roofs and arcade canopy of an exported GLB.

Unlike a weather-face test, this measures intrusion into the zinc itself and
the CLT underneath. The west portals are checked across the thickness of
their upright fascia. Steel clips, timber linings and framing are included.
"""
import argparse
from collections import Counter
import json
from pathlib import Path

import numpy as np
from scipy.spatial import ConvexHull

from check_envelope import extrema, face_planes, read_parts
from market_roofs import BANKS

ARCADE_ROOF = 'Enclosure / Arcade solar canopy'
MARKET_ROOF = 'Market / Folded zinc roof planes'
ARCADE_CLT = 'Structure / Arcade CLT roof'
MARKET_CLT = 'Structure / CLT market roof deck'
PORTAL = 'Market / Folded entrance reveals'
CONNECTORS = 'Structure / Concealed timber connections'
ARCADE_PV = 'Energy / Arcade photovoltaics'
MARKET_PV = 'Energy / Roof photovoltaics'
ASSEMBLY_LAYERS = {ARCADE_ROOF, MARKET_ROOF, ARCADE_CLT, MARKET_CLT, ARCADE_PV}


def panel_kind(part):
    if part.layer in ASSEMBLY_LAYERS:
        return part.layer
    if part.layer == MARKET_PV and part.center[1] >= BANKS[0][0]:
        return 'Vendor photovoltaics'
    if part.layer == PORTAL and part.material == 'Galvanized silver' and part.lo[0] < .5:
        return 'West portal fascia'


def west_face(fascia):
    # The exposed fascia faces Fourth Avenue (west, negative U).
    normal = np.array([-1., 0., 0.])
    height = -fascia.lo[0]
    outline = fascia.v[np.isclose(-fascia.v[:, 0], height)]
    basis = np.array([[0., 1., 0.], [0., 0., 1.]])
    edges = ConvexHull(outline @ basis.T).equations
    return normal, height, np.column_stack((edges[:, :2] @ basis, edges[:, 2]))


def check(model, tolerance):
    parts = list(read_parts(model, True, extra_layers=(PORTAL,)))
    objects = [p for p, _, _ in parts
               if any(m in p.material.casefold() for m in ('glulam', 'clt', 'laminated timber'))
               or p.layer == CONNECTORS or (p.layer == PORTAL and p.material == 'Oiled birch')]
    panels = [(p, panel_kind(p)) for p, _, _ in parts if panel_kind(p)]
    counts = Counter(kind for _, kind in panels)
    required = ASSEMBLY_LAYERS | {'Vendor photovoltaics', 'West portal fascia'}
    if missing := required - counts.keys():
        raise ValueError(f'Missing canopy layers: {sorted(missing)}')
    low = np.array([p.lo for p in objects])
    high = np.array([p.hi for p in objects])
    hits = []
    for panel, kind in panels:
        candidates = np.flatnonzero(np.all(high >= panel.lo - tolerance, axis=1) &
                                    np.all(low <= panel.hi + tolerance, axis=1))
        faces = [west_face(panel)] if kind == 'West portal fascia' else face_planes(panel, True)
        for normal, outside, edges in faces:
            inside = min(panel.v @ normal)
            boundary = edges.copy()
            boundary[:, 3] += tolerance
            for index in candidates:
                member = objects[index]
                if member.layer == panel.layer:
                    continue
                distances = member.v @ normal
                if distances.max() <= inside + tolerance or distances.min() >= outside + tolerance:
                    continue
                span = extrema(member, boundary, normal)
                if span is None:
                    continue
                lower, upper = span
                if upper[0] <= inside + tolerance or lower[0] >= outside + tolerance:
                    continue
                hits.append(dict(panel=kind, panel_index=panel.serial, member=member.layer,
                                 member_index=member.serial,
                                 intrusion_m=round(float(upper[0] - inside), 5),
                                 point=np.round(upper[1], 4).tolist()))
    return dict(tolerance_m=tolerance, panels=dict(counts), members=len(objects),
                pair_count=len(hits), pairs=hits)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--tolerance-mm', type=float, default=.5)
    args = parser.parse_args()
    if args.tolerance_mm < 0:
        parser.error('Tolerance must be nonnegative.')
    result = check(args.model, args.tolerance_mm / 1000)
    if args.report:
        args.report.write_text(json.dumps(result, indent=2) + '\n')
    print(f"{sum(result['panels'].values())} canopy panels; {result['pair_count']} clashes.")
    for group, total in Counter((h['panel'], h['member']) for h in result['pairs']).most_common():
        print(total, *group, sep=' | ')
    raise SystemExit(bool(result['pairs']))
