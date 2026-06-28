#!/usr/bin/env python3
"""Generate a seamless tiling water-caustics texture (procedural, CC0).

Caustics = the bright refracted light-net you see on shallow sand. We approximate
it with summed, domain-warped sinusoids on a torus (so it tiles seamlessly in both
axes). Output is a grayscale PNG used as a `screen`/`soft-light` overlay on the
water band; animating its background-position makes the net drift and shimmer.
"""
import numpy as np
from PIL import Image

S = 512  # tile size (seamless)
yy, xx = np.mgrid[0:S, 0:S].astype(float)
# angular coords so sin() is periodic over the tile -> seamless
u = xx / S * 2 * np.pi
v = yy / S * 2 * np.pi

def warp(u, v, k):
    # domain warp using low-freq periodic offset
    return (np.sin(u * 1 + np.cos(v * 1) * 0.6) + np.sin(v * 2 + np.cos(u * 1) * 0.5))

acc = np.zeros((S, S))
rng = np.random.default_rng(3)
# sum several periodic "ridged" sine layers at integer frequencies (keeps tiling)
for freq, amp, ph in [(1,1.0,0.0),(2,0.7,1.3),(3,0.5,2.1),(5,0.32,0.7),(8,0.2,2.8)]:
    a = rng.uniform(0, 2*np.pi)
    wu = np.cos(a); wv = np.sin(a)
    field = np.sin(freq*(u*wu + v*wv) + ph + 0.7*warp(u, v, freq))
    # ridged: sharp bright lines like caustics
    ridged = 1.0 - np.abs(field)
    acc += amp * ridged**2

acc = acc / acc.max()
# raise contrast so the bright net pops and the rest goes dark (screen-friendly)
acc = np.clip((acc - 0.45) / (1 - 0.45), 0, 1) ** 1.4
img = (acc * 255).astype('uint8')
Image.fromarray(img, 'L').save('/home/user/workspace/quiet/assets/caustics.png', optimize=True)

# verify seamlessness: edge continuity
left, right = img[:,0].astype(int), img[:,-1].astype(int)
top, bot = img[0,:].astype(int), img[-1,:].astype(int)
print('caustics', img.shape, 'edge-diff LR', abs(left-right).mean().round(1), 'TB', abs(top-bot).mean().round(1))
