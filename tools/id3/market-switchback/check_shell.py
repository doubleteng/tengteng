"""One longitudinal glulam truss of the market hall. Run with Python and NumPy.

python check_shell.py [output.json]

Gravity-only concept comparison. Width is across the building (Y); depth is
normal to the member axis in X-Z. Geometry uses centre lines. All calculations
in SI. The JSON includes assumptions, sources and exclusions alongside results.
"""
import json
import sys
from pathlib import Path

import numpy as np


X = np.linspace(2.6, 56.6, 16)
N = len(X)
WEST, EAST = 3, 12
TOP, TRIBUTARY = 13.35, 8.35
PSI = 6894.757
E = 1.8e6 * PSI  # Along the grain, conservative proxy from apparent strong-axis E.
EMIN_IN, EMIN_OUT = .95e6 * PSI, .85e6 * PSI
FC, FT = 1650 * PSI, 1100 * PSI
DENSITY = 530.
SECTIONS = {'chord': (.630, .990), 'diagonal': (.585, .855),
            'post': (.315, .450), 'bearing_post': (.630, .900)}
DECK_DEAD, DECK_LIVE = 2700., 4800.
ROOF_DEAD, ROOF_VARIABLE, SHELL_ALLOWANCE = 1300., 1200., 2000.
DEAD_PARTS = {'CLT_175mm_at_5kN_m3': .875, 'topping_and_finish': 1.025,
              'MEP_and_ceiling': .35, 'secondary_glulam_and_connections': .45}
OCCUPANCY = ('full', 'west_occupied', 'east_occupied', 'backspan_occupied', 'both_tips_occupied')
CASE_NAMES = ('dead_only', *OCCUPANCY, 'erection_west_only')
SLIP_GN_M = (None, 4., 2., 1., .5)
LIMIT_MM = (X[EAST]-X[WEST])*1000/360
TIP_LIMIT_MM = (X[WEST]-X[0])*1000/180


def make_members(web_system):
    members = []
    for i in range(N-1):
        members.extend([(i, i+1, 'chord'), (N+i, N+i+1, 'chord')])
        # Pratt directions follow the gravity shear between supports and reverse
        # on the outer cantilevers. Both systems have end posts and all verticals.
        rises_east = (i % 2 == 0 if web_system == 'Warren' else
                      (i < WEST or (7 <= i < EAST)))
        start, end = (i, N+i+1) if rises_east else (N+i, i+1)
        members.append((start, end, 'diagonal'))
    members.extend((i, N+i, 'bearing_post' if i in (WEST, EAST) else 'post')
                   for i in range(N))
    return members


def column_stress(effective_length, depth, minimum_modulus):
    """NDS form with other adjustment factors fixed at 1, dry ambient only."""
    ratio = .822*minimum_modulus*(depth/effective_length)**2/FC
    c = .90
    half = (1 + ratio)/(2*c)
    return FC * (half - np.sqrt(half**2-ratio/c))


def stiffness(bottom, system, sections, joint_k):
    coords = np.column_stack((np.tile(X, 2), np.r_[bottom, np.full(N, TOP)]))
    matrix = np.zeros((4*N, 4*N))
    recovery = []
    volume = 0.
    for a, b, group in make_members(system):
        delta = coords[b]-coords[a]
        length = np.linalg.norm(delta)
        direction = delta/length
        projection = np.r_[-direction, direction]
        dofs = [2*a, 2*a+1, 2*b, 2*b+1]
        width, depth = sections[group]
        area = width*depth
        # At each end one equal axial connection spring; a single spring stands
        # for the entire assembled group, not one individual dowel or bolt.
        compliance = length/(E*area) + (2/(joint_k*1e9) if joint_k else 0)
        k = 1/compliance
        matrix[np.ix_(dofs, dofs)] += k*np.outer(projection, projection)
        cin = column_stress(length, depth, EMIN_IN)
        cout = column_stress(length, width, EMIN_OUT)
        recovery.append((dofs, k*projection, group, area, cin, cout))
        volume += length*area
    return matrix, recovery, volume


def load_vector(name):
    applied = np.zeros(4*N)
    for i, dx in enumerate(np.diff(X)):
        live = (name == 'full' or
                (i < WEST and name in ('west_occupied', 'both_tips_occupied')) or
                (i >= EAST and name in ('east_occupied', 'both_tips_occupied')) or
                (WEST <= i < EAST and name == 'backspan_occupied'))
        floor_pressure = 2*(DECK_DEAD + DECK_LIVE*live) + SHELL_ALLOWANCE/2
        roof_pressure = ROOF_DEAD + ROOF_VARIABLE*(name != 'dead_only') + SHELL_ALLOWANCE/2
        if name == 'erection_west_only':
            # Imbalance diagnostic only, using a completed-plane stiffness matrix.
            floor_pressure = roof_pressure = SHELL_ALLOWANCE/2 if i < WEST else 0.
        for start, pressure in ((i, floor_pressure), (N+i, roof_pressure)):
            half = pressure*TRIBUTARY*dx/2
            applied[2*start+1] -= half
            applied[2*(start+1)+1] -= half
    return applied


def deflections(dy):
    middle = dy[WEST:EAST+1]
    lowest = np.argmin(middle)
    return {'west_tip_vertical_mm': round(dy[0], 2),
            'east_tip_vertical_mm': round(dy[-1], 2),
            'backspan_lowest_vertical_mm': round(middle[lowest], 2),
            'lowest_backspan_node_x_m': round(X[WEST+lowest], 2)}


def solve(bottom, system, sections, joint_k):
    matrix, bars, volume = stiffness(bottom, system, sections, joint_k)
    free = np.setdiff1d(np.arange(4*N), [2*WEST, 2*WEST+1, 2*EAST+1])
    all_loads = np.column_stack([load_vector(name) for name in CASE_NAMES])
    displacements = np.zeros_like(all_loads)
    displacements[free] = np.linalg.solve(matrix[np.ix_(free, free)], all_loads[free])
    cases = {}
    for i, name in enumerate(CASE_NAMES):
        disp, applied = displacements[:, i], all_loads[:, i]
        residual = matrix@disp-applied
        reactions = residual[[2*WEST+1, 2*EAST+1]]
        nodal_gravity = applied[1::2].reshape(2, N).sum(axis=0)
        assert np.max(np.abs(residual[free])) < 1e-4
        assert abs(reactions.sum()+nodal_gravity.sum()) < 1e-4
        assert abs(reactions[1]*(X[EAST]-X[WEST])+nodal_gravity@(X-X[WEST])) < 1e-3
        families = {}
        for group in sections:
            values = [(factor@disp[dofs], area, cin, cout)
                      for dofs, factor, key, area, cin, cout in bars if key == group]
            force, area, in_stress, out_stress = np.array(values).T
            stress = force/area
            families[group] = {
                'compression_kN': round(min(0., force.min())/1e3, 1),
                'tension_kN': round(max(0., force.max())/1e3, 1),
                'maximum_gross_compression_MPa': round(max(0., -stress.min())/1e6, 2),
                'maximum_gross_tension_MPa': round(max(0., stress.max())/1e6, 2),
                'gross_compression_screen_in_plane': round(max(0., max(-stress/in_stress)), 3),
                'gross_compression_screen_out_of_plane': round(max(0., max(-stress/out_stress)), 3),
                'gross_tension_screen': round(max(0., stress.max())/FT, 3)}
        cases[name] = {**deflections(1000*disp[1:2*N:2]),
                       'west_reaction_kN': round(reactions[0]/1e3, 1),
                       'east_reaction_kN': round(reactions[1]/1e3, 1),
                       'axial_force_by_family': families}
    return cases, displacements[1:2*N:2]*1000, volume


def service_envelope(dy, creep):
    # Applied to dead only. Roof variable and occupied-deck live stay short term.
    # Joint-dead deformation multiplied equally as a schematic sensitivity only.
    tip = 0.
    sag = 0.
    governs = ''
    for name in OCCUPANCY:
        profile = dy[:, CASE_NAMES.index(name)] + (creep-1)*dy[:, 0]
        down = -min(profile[WEST:EAST+1])
        if down > sag:
            sag, governs = down, name
        tip = max(tip, abs(profile[0]), abs(profile[-1]))
    return {'worst_backspan_sag_mm': round(sag, 2), 'backspan_case': governs,
            'worst_abs_tip_mm': round(tip, 2)}


def study():
    lifted = np.interp(X, X[[0, WEST, EAST, -1]], [8.2616, 6.05, 6.05, 7.75])
    first_sections = dict(SECTIONS, chord=(.630, .900), diagonal=(.540, .760))
    first_cases, first_dy, _ = solve(lifted, 'Warren', first_sections, 1.)
    alternatives = {}
    shapes = [('shallow_parallel', np.full(N, 8.2616), 'Warren'),
              ('deep_parallel', np.full(N, 6.05), 'Pratt'),
              ('two_lifted_tips', lifted, 'Warren')]
    for key, bottom, system in shapes:
        sensitivities = {}
        for joint_k in SLIP_GN_M:
            cases, dy, volume = solve(bottom, system, SECTIONS, joint_k)
            label = 'rigid_axial_ends' if joint_k is None else f'{joint_k:g}_GN_per_m_per_end'
            sensitivities[label] = {
                'instantaneous': service_envelope(dy, 1.),
                'permanent_multiplier_1_5': service_envelope(dy, 1.5),
                'permanent_multiplier_2': service_envelope(dy, 2.)}
            if joint_k == 2.:
                reference_cases = cases
        installed_weight = volume*DENSITY*9.81/(54*TRIBUTARY*1e3)
        assert installed_weight < SHELL_ALLOWANCE/1000
        alternatives[key] = {'web_system': system,
                             'bottom_elevations_m': np.round(bottom, 5).tolist(),
                             'member_mass_t_per_plane': round(volume*DENSITY/1000, 2),
                             'member_volume_m3_per_plane': round(volume, 2),
                             'installed_member_weight_kPa_over_tributary': round(installed_weight, 3),
                             'member_count_per_plane': len(make_members(system)),
                             'cases': reference_cases, 'service_sensitivity': sensitivities}
    return {
        'section_iteration': {
            'first_timber_trial_chord_and_diagonal_mm': [[630, 900], [540, 760]],
            'first_trial_governing_sag_at_1_GN_per_m_1_5_creep_mm':
                service_envelope(first_dy, 1.5)['worst_backspan_sag_mm'],
            'first_diagonal_gross_tension_screen_full_gravity':
                first_cases['full']['axial_force_by_family']['diagonal']['gross_tension_screen'],
            'final_chord_and_diagonal_mm': [[630, 990], [585, 855]],
            'revision': 'Increased both chord depth and diagonal section to reduce long-term deflection in the 1 GN/m slip scenario and create more gross area for tension-node detailing.'},
        'method': 'Small-displacement planar axial finite elements. Pin at west bearing; vertical roller at east. Each joint free in rotation. Sections are solid fabricated timber.',
        'panel_x_m': np.round(X, 2).tolist(), 'transverse_lines_m': [1.65, 18.35],
        'support_x_m': np.round(X[[WEST, EAST]], 2).tolist(), 'tributary_m': TRIBUTARY,
        'upper_chord_elevation_m': TOP, 'selected_alternative': 'two_lifted_tips',
        'nominal_glulam_sections_mm_width_out_of_plane_by_depth_in_plane':
            {k: [round(1000*b), round(1000*h)] for k, (b, h) in SECTIONS.items()},
        'material': {'species_grade_basis': 'Balanced Douglas-fir 24F-V8, dry-service reference. Fabricated custom block-glulam members. Require supplier evaluation for actual dimensions and layup.',
                     'E_long_GPa': round(E/1e9, 3), 'Emin_in_plane_GPa': round(EMIN_IN/1e9, 3),
                     'Emin_out_of_plane_GPa': round(EMIN_OUT/1e9, 3),
                     'Fc_parallel_MPa': round(FC/1e6, 3), 'Ft_parallel_MPa': round(FT/1e6, 3),
                     'Fc_perpendicular_side_face_reference_MPa': round(560*PSI/1e6, 3),
                     'density_kg_m3': DENSITY,
                     'orthotropy': 'Grain follows every bar. The 2D axial model uses E-long only. Species-level E_R/E_L and E_T/E_L are on the order of 0.05–0.07, not longitudinal E. Joint bearing, rolling shear and CLT plate behavior require orientation- and product-specific properties.'},
        'pressure_kPa': {'per_deck_dead': DECK_DEAD/1000, 'per_deck_dead_parts': DEAD_PARTS,
                         'per_deck_patterned_occupancy': DECK_LIVE/1000,
                         'roof_dead': ROOF_DEAD/1000, 'roof_variable': ROOF_VARIABLE/1000,
                         'main_glulam_and_hardware_allowance': SHELL_ALLOWANCE/1000},
        'one_plane_full_line_load_kN_m': round(TRIBUTARY*(2*(DECK_DEAD+DECK_LIVE)+ROOF_DEAD+ROOF_VARIABLE+SHELL_ALLOWANCE)/1e3, 3),
        'load_scope': 'Two complete occupied deck footprints for all schemes, including voids and the removed west tip deck. Roof tributary included. Floor-reaction collectors and decking must frame to nodes. Nominal gravity scenario for concept comparison; local snow drift, wind uplift, and actual assembly/gallery/concentrated loads still require project-specific determination.',
        'stability_screen': 'Dry-reference axial screen using NDS column-stability equation c=0.9, other factors taken as unity, K=1 and full member length between pinned ends independently in each axis. Whole-section widths require factory block gluing; field bolting separate leaves does not establish composite weak-axis inertia. Every panel point requires positive transverse restraint with roof/deck diaphragms, cross-frames and bracing back to the cores, including cut-floor tips. Lower nodes cannot rely on a missing CLT deck.',
        'service_criteria': {'backspan_studio_target_mm_L_over_360': round(LIMIT_MM, 1),
                             'cantilever_studio_target_mm_L_over_180': round(TIP_LIMIT_MM, 1),
                             'joint_screen': '2 GN/m per assembled member-end is a comparison assumption. 0.5–4 GN/m are sensitivities, not connector test results. Forces use two axial springs per bar; full envelopes include all occupancy patterns. The paired trusses, bearing and core may deform beyond this idealization.',
                             'creep_screen': '1.5 times permanent plus immediate transient compares dry-service response. 2.0 is adverse sensitivity; no additional persistent exhibition loading included. Long-term connector slip must be tested separately.'},
        'support_detail': 'Seat the bearing post directly on a concealed shoe spreading load into the core. The post end transmits compression parallel to grain. Additional chord and floor forces must enter the same bearing node. Avoid imposing the entire reaction across the side grain of a continuous lower chord. Detail end-grain drainage, movement, replaceable bearings and temporary hold-down for erection.',
        'fabrication': 'Custom factory block-glulam with parallel grain and certified structural glue lines. Transport 2–3-panel chord lengths (7.2–10.8 m), individual posts and diagonals; field-assemble at centrelines on engineered falsework. Provide concealed symmetric multi-plate/dowel groups, direct compression seats and accessible protected node pockets; stagger chord splice locations where practicable and explicitly design each reversing splice. Replace a member only after unloading and engineered temporary shoring. Pin one core bearing and slide the opposite shoe longitudinally. Prove joist collectors, distributed force transfer, plate slot net area, tension perpendicular to grain, group tear-out, dowel yielding, splits, fire cover and core anchors independently.',
        'scope_limit': 'Concept calculations are not construction documents. No 3D lateral analysis, weathering or fire residual section, foundation design, core/connection deformation validation, diaphragm or secondary-beam vibration assessment, fabrication release, or site erection-stage approval.',
        'sources': {'material': 'https://kalesnikoff.com/wp-content/uploads/2022/09/APAPR-L333KalesnikoffGlulam-5.pdf',
                    'supplier_dimensions': 'https://kalesnikoff.com/products/mass-timber-glulam-beams/',
                    'orthotropy': 'https://research.fs.usda.gov/fpl/wood-handbook',
                    'connection_detailing': 'https://www.apawood.org/guides-tools-training/technical-document-library/technical-guides/glulam-connection-details/',
                    'assembled_joint_experiments': 'https://www.proceedings.com/content/069/069179-0156open.pdf',
                    'creep': 'https://awc.org/modules/',
                    'column_equation': 'https://web-media.awc.org/wp-content/uploads/2021/12/17210640/AWC-2005NDS-Updates-Errata.pdf'},
        'alternatives': alternatives}


if __name__ == '__main__':
    result = json.dumps(study(), indent=2, allow_nan=False) + '\n'
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(result)
    else:
        print(result, end='')
