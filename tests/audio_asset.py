"""Check the shipped PCM bed for silence, clipping, and a discontinuous seam."""
from pathlib import Path
import array, math, wave
with wave.open(str(Path(__file__).resolve().parents[1] / 'assets/ambient-crossfade.wav')) as audio:
    assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
    sr = audio.getframerate()
    samples = array.array('h', audio.readframes(audio.getnframes()))
def rms(values):
    return math.sqrt(sum(v*v for v in values)/len(values))
blocks = [rms(samples[i:i+sr//10]) for i in range(0,len(samples),sr//10)]
delta = rms([samples[i]-samples[i-1] for i in range(1,len(samples))])
assert min(blocks) > 100, 'Silent or near-silent 100ms interval'
assert max(map(abs,samples)) < 32767, 'Clipped sample'
assert abs(samples[0]-samples[-1]) < delta*4, 'Abnormal loop boundary jump'
print(f'Audio asset passed: {len(samples)/sr:.0f}s; minimum 100ms RMS {min(blocks):.0f}; seam jump {abs(samples[0]-samples[-1])} vs typical delta {delta:.0f}')
