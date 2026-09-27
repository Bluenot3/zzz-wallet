import math
def fmt(v): 
    s=f"{v:.1f}"
    if s.endswith('.0'): s=s[:-2]
    if s=='-0': s='0'
    return s
def polar_curve(rfun, drfun, n):
    # closed curve r(th); hermite cubic segments
    pts=[];ders=[]
    for i in range(n):
        th=2*math.pi*i/n
        r=rfun(th); dr=drfun(th)
        x=r*math.cos(th); y=r*math.sin(th)
        dx=dr*math.cos(th)-r*math.sin(th); dy=dr*math.sin(th)+r*math.cos(th)
        pts.append((x,y)); ders.append((dx,dy))
    h=2*math.pi/n
    d=f"M{fmt(pts[0][0])} {fmt(pts[0][1])}"
    for i in range(n):
        j=(i+1)%n
        c1=(pts[i][0]+ders[i][0]*h/3, pts[i][1]+ders[i][1]*h/3)
        c2=(pts[j][0]-ders[j][0]*h/3, pts[j][1]-ders[j][1]*h/3)
        d+=f"C{fmt(c1[0])} {fmt(c1[1])} {fmt(c2[0])} {fmt(c2[1])} {fmt(pts[j][0])} {fmt(pts[j][1])}"
    return d+"Z"
def wave(R0,a,k,per=5):
    return polar_curve(lambda t:R0+a*math.sin(k*t), lambda t:a*k*math.cos(k*t), k*per)
out={}
out['outer']=wave(88,5,36,4)     # fine outer lathe band
out['mid']=wave(66,9,18,5)       # mid band
out['inner']=wave(34,15,12,6)    # flower
out['core']=wave(18,6,8,6)
for k,v in out.items(): print(k,len(v))
import json; json.dump(out,open('rose.json','w'))
