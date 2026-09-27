import numpy as np
from PIL import Image
rng=np.random.default_rng(7)
N=512
fy=np.fft.fftfreq(N)[:,None]; fx=np.fft.fftfreq(N)[None,:]
def filt(noise, sx, sy, ang=0.0):
    c,s=np.cos(ang),np.sin(ang); u=fx*c+fy*s; v=-fx*s+fy*c
    G=np.exp(-((u*sx)**2+(v*sy)**2)*2*np.pi**2)
    r=np.real(np.fft.ifft2(np.fft.fft2(noise)*G)); return (r-r.mean())/(r.std()+1e-9)
W=rng.standard_normal((N,N))
mott=filt(W,90,90)*0.6+filt(rng.standard_normal((N,N)),35,35)*0.4
fibers=np.zeros((N,N))
for k in range(5):
    fibers+=filt(rng.standard_normal((N,N)),9,0.9,ang=rng.uniform(0,np.pi))*0.5
fibers/=np.abs(fibers).max()
fine=filt(rng.standard_normal((N,N)),0.7,0.7)
y=np.arange(N)[:,None]; x=np.arange(N)[None,:]
laid=0.5+0.5*np.cos(2*np.pi*y/(N/160))
chain=np.exp(-((x-256)/2.0)**2)*0.6
t=(np.tanh(mott*0.9)*0.5+0.5)[...,None]
dark=np.array([222,204,166.])/255; light=np.array([246,238,219.])/255
col=dark*(1-t)+light*t
col*=1+fibers[...,None]*0.035
col*=1+fine[...,None]*0.012
col*=1-laid[...,None]*0.010-chain[...,None]*0.025
Image.fromarray((np.clip(col,0,1)*255).astype(np.uint8)).save('../assets/vellum-tile.jpg',quality=90)
lea=filt(rng.standard_normal((N,N)),6,6)*0.5+filt(rng.standard_normal((N,N)),1.2,1.2)*0.5
lc=np.array([17,23,42.])/255
leather=lc*(1+lea[...,None]*0.09)
Image.fromarray((np.clip(leather,0,1)*255).astype(np.uint8)).save('../assets/desk-tile.jpg',quality=88)
print('ok')
