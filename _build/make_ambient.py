"""Build one periodic PCM soundscape; requires ffmpeg, no Python dependencies."""
from pathlib import Path
import array, math, subprocess, wave
ROOT = Path(__file__).resolve().parents[1]
SR = 44100

def decode(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'])
    return array.array('f', raw)

def seamless(samples, seconds=2):
    # Overlap the end with the beginning, then start AFTER the overlap.
    # Unlike fading both endpoints to zero, this maintains the ambient bed.
    n = min(int(seconds * SR), len(samples)//4)
    result = array.array('f', samples[n:])
    for i in range(n):
        u = i / (n - 1)
        a = (u*u*(3-2*u)) * math.pi / 2
        result[len(result)-n+i] = samples[len(samples)-n+i]*math.cos(a) + samples[i]*math.sin(a)
    return result

surf = seamless(decode(ROOT / 'assets/waves.mp3'))
# Three wave periods; stagger real bird recordings around this circular buffer.
N = len(surf)*3
mix = array.array('f', (surf[i % len(surf)]*.8 for i in range(N)))
position = 0
birds = [decode(ROOT / f'assets/birds/bird{i}.mp3') for i in range(1,8)]
k = 0
while position < N:
    bird = birds[k % len(birds)]
    peak = max(abs(x) for x in bird) or 1
    for i, sample in enumerate(bird):
        ramp = min(1, i/(SR*.3), (len(bird)-1-i)/(SR*.6))
        envelope = math.sin(max(0, ramp)*math.pi/2)**2
        mix[(position+i)%N] += sample/peak*.075*envelope
    position += max(SR, len(bird)-int(.9*SR))
    k += 1
# Crossfade the COMPLETE mix, including any bird phrase at the loop boundary.
mix = seamless(mix, seconds=3)
N = len(mix)
peak = max(abs(x) for x in mix)
pcm = array.array('h', (round(x / max(1, peak/.85) * 32767) for x in mix))
with wave.open(str(ROOT / 'assets/ambient-crossfade.wav'), 'wb') as out:
    out.setparams((1,2,SR,0,'NONE','not compressed')); out.writeframes(pcm.tobytes())
print(f'Generated {N/SR:.2f}s seamless ambient loop; peak {peak:.3f}')
