from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely import affinity
W,H=100,86
BOX=box(0,0,W,H)
def band(u0,u1):
    # region u0<=x+y<=u1 (big)
    return Polygon([(u0+50,-50),(u1+50,-50),(u1-200,200),(u0-200,200)])
def half_u(le=None,ge=None):
    if le is not None: return Polygon([(-600,-600),(le+600,-600),(le-600,600),(-600,600)])
    return Polygon([(ge+600,-600),(600,-600),(600,600),(ge-600,600)])
parts=[]
parts.append(box(0,0,W,9).intersection(half_u(le=100)))          # top bar
parts.append(box(0,0,10,31))                                      # left column
parts.append(box(0,21,W,31).intersection(half_u(le=43)))          # hook bottom
parts.append(band(53,67).intersection(box(0,9,W,H)))              # S1
lt=Polygon([(0,53),(10,53),(10,70),(5,75),(0,75)])               # left tab w/ bevel
parts.append(lt)
parts.append(band(86,100).intersection(BOX))                      # S2
left=unary_union(parts).intersection(BOX)
# mirror 180 about center
right=affinity.rotate(left,180,origin=(W/2,H/2))
mark=unary_union([left,right]).buffer(0)
print(mark.geom_type, mark.area)
def path(g):
    polys=[g] if g.geom_type=='Polygon' else list(g.geoms)
    d=''
    for p in polys:
        cs=[p.exterior]+list(p.interiors)
        for c in cs:
            pts=list(c.coords)[:-1]
            d+='M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in pts)+'Z '
    return d.strip()
d=path(mark.simplify(0.01))
print(d)
open('mark_path.txt','w').write(d)
