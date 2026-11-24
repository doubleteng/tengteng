"""Trace as-built rooflight, monitor, secondary façade and sky-court support into primary timber.

Measures shared contact patches in plan for vertical bearing and checks actual
closed-solid contact for anchor pins, platework, side connections and hinges.
Dimensions are metres. Capacity, hardware specification and deflection require engineering.
"""
import argparse
from collections import defaultdict
from functools import lru_cache
import json
from pathlib import Path

import numpy as np
from check_envelope import read_parts
from check_gallery import touch, bearing_area
from check_apertures import sash_sweep


def components(path):
    groups=defaultdict(list)
    for part,_,_ in read_parts(path,True,all_layers=True):
        groups[part.layer.split(' / ')[-1]].append(part)
    return groups


def geometry_signature(parts):
    def vertices(p):
        return tuple(sorted(tuple(float(z) for z in xyz) for xyz in np.round(p.v,4)))
    return sorted(vertices(p) for p in parts)


def audit(path,baseline=None):
    groups=components(path)
    failures=[]
    all_parts={id(p):p for parts in groups.values() for p in parts}

    @lru_cache(maxsize=None)
    def contact(i,j):
        return touch(all_parts[i],all_parts[j])

    @lru_cache(maxsize=None)
    def area(i,j):
        return bearing_area(all_parts[i],all_parts[j]) if contact(i,j) else 0.

    def meets(a,b):
        return contact(*sorted((id(a),id(b))))
    def patch(a,b):
        return area(*sorted((id(a),id(b))))
    def has_bearing(a,others,min_area):
        return [b for b in others if patch(a,b)>min_area]
    def attached(a,others):
        return [b for b in others if meets(a,b)]
    def check(ok,part,msg):
        if not ok:
            failures.append(f'{part.layer} #{part.serial} at {part.center.round(3).tolist()}: {msg}')

    panes=groups['Roof daylight apertures']
    rails=groups['Rooflight glazing rails']
    stools=groups['Rooflight bearing stools']
    runners=groups['Rooflight bearing runners']
    rafters=groups['Glulam secondary roof rafters']
    upstands=groups['Glulam roof upstands']
    girders=groups['Glulam roof girders']
    forum=groups['Forum glulam roof frame']
    curtain=groups['North facing monitor vents']
    data={}
    pane_areas=[]
    for p in panes:
        for y in (p.lo[1],p.hi[1]):
            carriers=has_bearing(p,[r for r in rails if abs(r.center[1]-y)<.001],.002)
            check(len(carriers)==1,p,'missing supported head or sill')
            pane_areas.extend(patch(p,r) for r in carriers)
    spacing=[];overhang=[]
    for r in rails:
        supports=sorted(has_bearing(r,stools,.006),key=lambda p:p.center[0])
        check(len(supports)>=2,r,'fewer than two welded stools')
        if len(supports)>=2:
            xs=[s.center[0] for s in supports]
            spacing.extend(np.diff(xs))
            overhang.extend((xs[0]-r.lo[0],r.hi[0]-xs[-1]))
    for s in stools:
        check(len(has_bearing(s,runners,.006))==1,s,'stool has no unique bearing runner')
    for r in runners:
        check(bool(has_bearing(r,rafters+forum,.015)),r,'runner has no finite timber bearing')
    for r in rafters:
        supports=has_bearing(r,upstands,.014)
        check(len(supports)==2 and abs(supports[0].center[1]-supports[1].center[1])>.15,
              r,'roof rafter does not bear on two independent upstands')
    for u in upstands:
        check(len(has_bearing(u,girders,.014))==1,u,'upstand does not land on a primary girder')
    chord=groups['Glulam chords']
    hangers=groups['Roof girder hangers']
    shelves=[s for s in hangers if s.hi[2]-s.lo[2]<.03]
    backs=[s for s in hangers if s.hi[1]-s.lo[1]<.02]
    main_pins=groups['Roof hanger chord anchors']
    for g in girders:
        count=2 if g.hi[1]-g.lo[1]>10 else 1
        check(len(has_bearing(g,shelves,.035))==count,g,'primary girder is missing a truss-face hanger')
    for s in shelves:
        plates=attached(s,backs)
        check(len(plates)==1,s,'roof hanger shelf is not welded to its heel')
        for p in plates:
            fasteners=attached(p,main_pins)
            check(len(fasteners)==4 and all(attached(f,chord) for f in fasteners),p,'hanger lacks four anchors embedded in its upper chord')
    forum_girders=[f for f in forum if f.hi[0]-f.lo[0]>3.]
    forum_rafters=[f for f in forum if f.hi[0]-f.lo[0]<1.]
    forum_seats=groups['Forum concealed rafter shoes']
    forum_shelves=[f for f in forum_seats if f.hi[2]-f.lo[2]<.06]
    forum_backs=[f for f in forum_seats if f.hi[2]-f.lo[2]>.10]
    forum_pins=groups['Forum rafter shoe pins']
    for f in forum_rafters:
        check(len(has_bearing(f,forum_shelves,.022))==2,f,'annex rafter lacks two exposed end-bearing seats')
    for s in forum_shelves:
        pb=attached(s,forum_backs)
        check(len(pb)==1,s,'annex shoe has no heel plate')
        for b in pb:
            ps=attached(b,forum_pins)
            check(len(ps)==2 and all(attached(p,forum_girders) for p in ps),s,'annex shoe lacks two embedded girder pins')
    for g in forum_girders:
        check(len(has_bearing(g,groups['Head house glulam columns'],.06))==3,g,'annex primary girder lacks three columns')
    data['daylight']={'panes':len(panes),'glazingRails':len(rails),'stools':len(stools),'runners':len(runners),
                      'mainRafters':len(rafters),'mainUpstands':len(upstands),'minimumPaneBearingM2':round(min(pane_areas,default=0),5),
                      'mainGirderEndBearings':len(shelves),'upperChordAnchors':len(main_pins),
                      'annexRafters':len(forum_rafters),'annexRafterShoes':len(forum_shelves),'annexGirderAnchors':len(forum_pins),
                      'maximumCarrierSupportSpacingM':round(max(spacing,default=0),3),'maximumRailCantileverM':round(max(overhang,default=0),3)}
    hinges=groups['Monitor sash hinge leaves']
    headers=groups['Monitor hinge headers']
    shoes=groups['Monitor header shoes']
    shelf=[s for s in shoes if s.hi[2]-s.lo[2]<.03]
    plates=[s for s in shoes if s.hi[2]-s.lo[2]>.03]
    pins=groups['Monitor header fasteners']
    for p in curtain:
        check(len(attached(p,hinges))==1,p,'missing attached hinge')
    for h in hinges:
        check(len(attached(h,headers))==1,h,'hinge does not join a continuous header')
    for h in headers:
        check(len(has_bearing(h,shelf,.008))>=2,h,'header lacks two bearing shelves')
    for s in shelf:
        check(len(attached(s,plates))==1,s,'shelf lacks a welded heel plate')
    for s in plates:
        fasteners=attached(s,pins)
        check(len(fasteners)==2 and all(attached(f,rafters) for f in fasteners),s,'heel lacks both pins embedded in a rafter')
    data['monitor']={'operableSashes':len(curtain),'hinges':len(hinges),'continuousHeaders':len(headers),
                     'weldedShoes':len(shelf),'rafterPins':len(pins)}

    market=[p for p in groups['Operable northlight vents'] if 'glass' in p.material.lower()]
    deck=groups['CLT market roof deck']
    high=groups['Northlight head channels'];low=groups['Northlight sill channels']
    returns=groups['Northlight sill returns'];anchors=groups['Northlight curb anchors']
    market_hinges=groups['Northlight sash hinges']
    jambs=[p for p in groups['Operable northlight vents'] if 'glass' not in p.material.lower()]
    hardware=high+low+returns+anchors+jambs
    lower=np.array([p.lo for p in hardware]);upper=np.array([p.hi for p in hardware])
    operable=0
    for pane in market:
        tri=pane.v[pane.faces]
        normal=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
        normal=normal[np.linalg.norm(normal,axis=1).argmax()]
        normal=normal/np.linalg.norm(normal)
        sweeping=sash_sweep(pane,normal,hardware,lower,upper,.002)
        if sweeping is None:
            check(len(attached(pane,high))==1,pane,'fixed glass head does not meet a head channel')
            check(len(has_bearing(pane,low,.008))==1,pane,'fixed northlight lacks sill bearing')
        else:
            operable+=1
            hinges=attached(pane,market_hinges)
            check(len(hinges)==1 and all(attached(h,high) for h in hinges),pane,'operable glass lacks a hinge connected to its head')
            check(not sweeping,pane,'closing sash fouls a head, sill, curb or anchor')
    for c in low:
        check(len([p for p in attached(c,returns) if abs(p.center[0]-c.center[0])<.01])==1,c,'sill lacks an attached backing return')
    for c in high+returns:
        anchor_pts=attached(c,anchors)
        check(len(anchor_pts)>=2 and all(attached(pin,deck) for pin in anchor_pts),
              c,'curb anchorage does not embed into a roof deck')
    market_rafters=groups['Glulam market rafters'];collectors=groups['Glulam market collectors']
    # Verify each roof panel that supports a head or sill has a finite bearing
    # patch on a lower rafter or collector; any roof edge gap stays visible.
    anchored_decks={id(d):d for pin in anchors for d in attached(pin,deck)}
    for d in anchored_decks.values():
        check(bool(has_bearing(d,market_rafters+collectors,.01)),d,'monitor deck panel has no timber bearing')
    data['marketNorthlights']={'lights':len(market),'openingSashes':operable,'headChannels':len(high),
                              'sillChannels':len(low),'anchoredDeckPanels':len(anchored_decks),
                              'deckAnchorPins':len(anchors),'sashHinges':len(market_hinges),'jambs':len(jambs)}

    girts=groups['Glulam secondary girts']
    girt_seats=groups['Inboard girt seats']
    clips=groups['Girt anchorage plates']
    bolts=groups['Girt anchorage bolts']
    posts=groups['Glulam posts']
    for g in girts:
        seats=has_bearing(g,girt_seats,.004)
        check(len(seats)==2 and min(s.center[0] for s in seats)<g.center[0]<max(s.center[0] for s in seats),
              g,'girt requires two distinct supported ends')
    for s in girt_seats:
        check(bool(attached(s,clips)),s,'seat lacks welded post anchorage')
    for p in clips:
        anchors=attached(p,bolts)
        check(len(anchors)==2 and all(attached(f,posts) for f in anchors),p,'anchorage plate lacks two pins embedded in the post')
    data['facade']={'girts':len(girts),'bearingSeats':len(girt_seats),'postAnchorPlates':len(clips),'anchorPins':len(bolts)}

    trimmers=[p for p in groups['Court rim girders'] if p.center[2]>12.]
    court_shoes=groups['Court roof transfer shoes']
    gussets=[s for s in court_shoes if s.hi[2]-s.lo[2]>.2]
    seats=[s for s in court_shoes if s.hi[2]-s.lo[2]<.025]
    court_pins=groups['Court roof anchor pins']
    # A later freight-core opening also splits a roof girder. Identify the
    # court members by the actual trimmer end elevations and plan footprint.
    sides=[g for g in girders if any(t.lo[0]<g.center[0]<t.hi[0] and
           min(abs(g.hi[1]-t.lo[1]),abs(g.lo[1]-t.hi[1]))<.035 for t in trimmers)]
    for t in trimmers:
        check(len(has_bearing(t,seats,.045))==2,t,'court longitudinal trimmer lacks two end bearings')
    for g in sides:
        check(len(has_bearing(g,seats,.045))==1,g,'short court girder lacks a trimmer end shoe')
    for s in seats:
        hosts=has_bearing(s,trimmers+sides,.045)
        straps=attached(s,gussets)
        check(len(hosts)==1 and len(straps)==1,s,'shoe must hold a single beam and attach to one backplate')
        for strap in straps:
            anchors=attached(strap,court_pins)
            targets=trimmers if hosts and any(hosts[0] is g for g in sides) else [g for g in girders if g.hi[1]-g.lo[1]>=10.]
            check(len(anchors)==4 and all(attached(f,targets) for f in anchors),s,'four anchors must enter the receiving timber')
    data['skyCourt']={'trimmers':len(trimmers),'incomingGirderEnds':len(sides),'seatedBeamJoints':len(seats),'anchorPins':len(court_pins)}
    expected=[(panes,1),(rails,1),(curtain,1),(headers,1),(market,1),(high,1),(low,1),(anchors,1),
              (girts,1),(trimmers,2),(sides,4),(seats,8),(court_pins,32)]
    if any(len(parts)<n for parts,n in expected):failures.append('Missing a required roof, façade or court support system.')
    if baseline:
        before=components(baseline)
        data['primaryFrame']={}
        for key in ('Glulam chords','Glulam Warren webs','Glulam posts','Glulam bearing columns','Primary bearing pedestals'):
            unchanged=geometry_signature(before[key])==geometry_signature(groups[key])
            data['primaryFrame'][key]={'before':len(before[key]),'after':len(groups[key]),'sameGeometryWithin0.1mm':unchanged}
            if not unchanged:failures.append(f'Primary geometry differs from supplied baseline: {key}.')
    data['failures']=failures
    return data


if __name__=='__main__':
    arg=argparse.ArgumentParser(description=__doc__)
    arg.add_argument('model',type=Path)
    arg.add_argument('--baseline',type=Path)
    arg.add_argument('--report',type=Path)
    args=arg.parse_args()
    result=audit(args.model,args.baseline)
    formatted=json.dumps(result,indent=2)
    print(formatted)
    if args.report:args.report.write_text(formatted+'\n')
    raise SystemExit(bool(result['failures']))
