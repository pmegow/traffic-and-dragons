"""Prepare a delivery ambience loop from a WAV master (the smithy-fire pipeline, scripted).

Usage:
  py -3.12 dev/prepare-ambience-loop.py <source.wav> <name> [--crossfade 1.0] [--rms -32] [--peak -6]
      [--start 0] [--seconds N] [--license "CC0 1.0"] [--source-url URL] [--author NAME] [--deliver]

Writes Audio/Prepared/<name>.wav (16-bit mono, source rate), Audio/Prepared/<name>.mp3 (128 kbps mono,
metadata-free) and Audio/Prepared/<name>.json (the processing receipt with source/derivative SHA-256).
With --deliver the MP3 is also copied to sfx/<name>.mp3. Loop end = prepared length (the crossfade folds
the tail into the head, so sample 0 follows the last sample continuously).

Needs: py -3.12 with numpy + imageio-ffmpeg (pip install numpy imageio-ffmpeg). The wheel ships ffmpeg; libmp3lame
writes the Xing/LAME gapless header (encoder delay + padding) that browsers use to decode the loop sample-exact.
A plain lameenc encode omits that header and would shift the loop by ~23 ms - refused, not silently accepted.
"""
import sys, os, json, wave, hashlib, argparse, shutil
import numpy as np, subprocess
try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_wav(path):
    w = wave.open(path)
    n, sw, ch, sr = w.getnframes(), w.getsampwidth(), w.getnchannels(), w.getframerate()
    raw = w.readframes(n); w.close()
    if sw == 2:
        x = np.frombuffer(raw, '<i2').astype(np.float64) / 32768.0
    elif sw == 3:
        b = np.frombuffer(raw, 'u1').reshape(-1, 3).astype(np.int32)
        x = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        x = np.where(x >= 1 << 23, x - (1 << 24), x).astype(np.float64) / float(1 << 23)
    elif sw == 4:
        x = np.frombuffer(raw, '<i4').astype(np.float64) / 2147483648.0
    else:
        raise SystemExit('unsupported sample width %d' % sw)
    return x.reshape(-1, ch), sr

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def db(v):
    return 20 * np.log10(max(v, 1e-12))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source'); ap.add_argument('name')
    ap.add_argument('--crossfade', type=float, default=1.0)
    ap.add_argument('--rms', type=float, default=-32.0, help='target RMS dBFS (v1 smithy fire measured -32.0)')
    ap.add_argument('--peak', type=float, default=-6.0, help='peak ceiling dBFS')
    ap.add_argument('--start', type=float, default=0.0); ap.add_argument('--seconds', type=float, default=0.0)
    ap.add_argument('--license', default=''); ap.add_argument('--source-url', default=''); ap.add_argument('--author', default='')
    ap.add_argument('--deliver', action='store_true')
    a = ap.parse_args()

    src = os.path.abspath(a.source)
    x, sr = load_wav(src)
    x = x.mean(axis=1)                                   # stereo mean / mono passthrough
    s0 = int(round(a.start * sr)); s1 = len(x) if a.seconds <= 0 else min(len(x), s0 + int(round(a.seconds * sr)))
    x = x[s0:s1]
    x = x - x.mean()                                     # DC removal
    c = int(round(a.crossfade * sr))
    if c > 0:
        if c * 2 >= len(x): raise SystemExit('crossfade longer than half the material')
        head, tail = x[:c], x[-c:]
        t = (1 - np.cos(np.linspace(0, np.pi, c, endpoint=False))) / 2   # raised cosine 0→1
        blend = tail * (1 - t) + head * t
        y = np.concatenate([x[c:-c], blend])              # ends on head[-1]; loops into x[c]
    else:
        y = x
    rms = np.sqrt((y ** 2).mean()); peak = np.abs(y).max()
    gain_db = a.rms - db(rms)
    if db(peak) + gain_db > a.peak: gain_db = a.peak - db(peak)   # peak ceiling wins
    y = y * (10 ** (gain_db / 20))
    d = np.abs(np.diff(y))
    receipt = {
        'source': src, 'sourceSha256': sha256(src), 'sourceLicense': a.license, 'sourceUrl': a.source_url, 'author': a.author,
        'sourceStartSeconds': a.start, 'sourceSeconds': round((s1 - s0) / sr, 3), 'crossfadeSeconds': a.crossfade,
        'method': 'mono mean; DC removal; %.2f-second raised-cosine overlap of tail/head; RMS target %g dBFS with peak ceiling %g dBFS; libmp3lame 128 kbps mono with Xing/LAME gapless header, no ID3' % (a.crossfade, a.rms, a.peak),
        'gainDb': round(gain_db, 3), 'durationSeconds': len(y) / sr, 'sampleRate': sr, 'channels': 1,
        'rmsDb': round(db(np.sqrt((y ** 2).mean())), 2), 'peakDb': round(db(np.abs(y).max()), 2),
        'boundaryStep': float(abs(y[0] - y[-1])), 'adjacentStepP99': float(np.percentile(d, 99)),
        'loopEndSeconds': int(len(y) / sr * 1000) / 1000.0,
        'loopEndPolicy': 'Round down to a whole millisecond to stay within sample-rate-dependent decoder length.',
    }
    out_dir = os.path.join(ROOT, 'Audio', 'Prepared'); os.makedirs(out_dir, exist_ok=True)
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype('<i2')
    wav_path = os.path.join(out_dir, a.name + '.wav')
    w = wave.open(wav_path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes()); w.close()
    if imageio_ffmpeg is None: raise SystemExit('imageio-ffmpeg missing: py -3.12 -m pip install imageio-ffmpeg')
    mp3_path = os.path.join(out_dir, a.name + '.mp3')
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', wav_path, '-map_metadata', '-1',
                    '-c:a', 'libmp3lame', '-b:a', '128k', '-ac', '1', '-write_xing', '1', '-id3v2_version', '0', mp3_path], check=True)
    mp3 = open(mp3_path, 'rb').read()
    lame_tag = (b'Xing' in mp3[:2048] or b'Info' in mp3[:2048]) and any(k in mp3[:2048] for k in (b'LAME', b'Lavc', b'Lavf'))  # the encoder-string forms ffmpeg's demuxer honours
    if not lame_tag: raise SystemExit('MP3 has no LAME gapless header; loop bounds would drift - not delivered')
    receipt.update({'wavSha256': sha256(wav_path), 'mp3Sha256': sha256(mp3_path), 'mp3Bytes': len(mp3), 'mp3LameTag': True,
                    'encoder': 'ffmpeg ' + imageio_ffmpeg.get_ffmpeg_version() + ' libmp3lame'})
    if a.deliver:
        shutil.copyfile(mp3_path, os.path.join(ROOT, 'sfx', a.name + '.mp3')); receipt['delivered'] = 'sfx/' + a.name + '.mp3'
    with open(os.path.join(out_dir, a.name + '.json'), 'w') as f: json.dump(receipt, f, indent=2)
    print(json.dumps(receipt, indent=2))

if __name__ == '__main__':
    main()
