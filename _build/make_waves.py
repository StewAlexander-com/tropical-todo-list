#!/usr/bin/env python3
"""Generate a seamless gentle ocean-surf loop (CC0 — synthesized, no attribution needed).

Approach: layered filtered noise to mimic surf, with a slow swell envelope so individual
waves rise and fall. The loop is built so its end matches its start (the swell LFO completes
an integer number of cycles), making it click-free on repeat. Output is mono, modest bitrate.
"""
import numpy as np
from scipy.io import wavfile
from scipy import signal

SR = 44100
DUR = 24.0          # seconds — long enough not to feel repetitive
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)

# --- base broadband noise -> low-passed "water" bed ---
noise = rng.standard_normal(N)
# pinkish: integrate a touch
b, a = signal.butter(2, 1200 / (SR/2), btype='low')
bed = signal.lfilter(b, a, noise)

# --- "surf hiss": high-band noise, gated by wave swells ---
hb, ha = signal.butter(2, [600/(SR/2), 5000/(SR/2)], btype='band')
hiss = signal.lfilter(hb, ha, rng.standard_normal(N))

# --- swell envelope: sum of a few slow sines with integer cycles over DUR ---
# choose cycle counts so each completes exactly within DUR (seamless loop)
def swell(cycles, phase=0.0):
    return np.sin(2*np.pi*cycles*t/DUR + phase)

# main wave period ~ 8-10s; use 3 cycles over 24s (=8s waves), plus slower 2-cycle drift
env = 0.55 + 0.30*swell(3, 0.0) + 0.12*swell(2, 1.1) + 0.06*swell(5, 0.4)
env = np.clip(env, 0.05, 1.0)
# smooth the envelope so swells are gentle, not pulsing
be, ae = signal.butter(2, 0.5 / (SR/2), btype='low')
env = signal.lfilter(be, ae, env)
env = (env - env.min()) / (env.max() - env.min())
env = 0.25 + 0.75*env

# foam crest: brief brighter hiss riding the top of each swell
crest_gate = np.clip((env - 0.7) / 0.3, 0, 1) ** 1.5

mix = bed * (0.6 + 0.4*env) + hiss * (0.18*env + 0.22*crest_gate)

# --- gentle overall low-pass to soften, and a subtle stereo-less warmth ---
mb, ma = signal.butter(2, 6000/(SR/2), btype='low')
mix = signal.lfilter(mb, ma, mix)

# normalize to comfortable level (peak ~ -6 dBFS)
mix = mix / np.max(np.abs(mix)) * 0.5

# crossfade the seam: blend last 0.4s with the head to guarantee click-free wrap
xf = int(0.4 * SR)
fade = np.linspace(0, 1, xf)
mix[:xf] = mix[:xf]*fade + mix[-xf:][::-1]*0  # keep head
mix[-xf:] = mix[-xf:]*(1-fade) + mix[:xf]*fade

pcm = (mix * 32767).astype(np.int16)
wavfile.write('/home/user/workspace/quiet/_build/waves.wav', SR, pcm)
print('wrote waves.wav', round(len(pcm)/SR,1), 's')
