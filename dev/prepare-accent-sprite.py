"""Pack an accent set (short one-shot samples) into ONE delivery sprite: one download, one checksum, one decode and one
cache entry per set (Proposal_general_audio.html §21.2).

Usage:
  py -3.12 dev/prepare-accent-sprite.py <name> <source.wav[@start-end]> [<source.wav[@start-end]> ...]
      [--rms -24] [--peak -6] [--fade-ms 10] [--gap 0.25] [--floor -50]
      [--license "CC0 1.0"] [--source-url URL] [--author NAME] [--deliver]

Each source is one sample; @start-end (seconds) cuts a phrase out of a longer take, so one chime recording can
yield several distinct strikes. Per sample: mono mean, DC removal, trim of leading/trailing material below
--floor dB relative to the sample's own peak (20 ms pre-roll kept), RMS matched to --rms over the trimmed sample
with a --peak ceiling, --fade-ms raised-cosine fades at both ends. Samples are joined with --gap seconds of
silence; the cut list is the [start, end] of each sample on the decoded timeline.

Writes Audio/Prepared/<name>.wav, .mp3 and .json (receipt: cuts, per-sample gain, source and derivative SHA-256).
With --deliver the MP3 is copied to sfx/<name>.mp3. Needs py -3.12 with numpy + imageio-ffmpeg (same as
prepare-ambience-loop.py): libmp3lame writes the Xing/LAME gapless header, so the browser's decoded timeline
matches the cut list; without that header every cut would shift by the encoder delay, so it is refused.
"""
import sys, os, json, wave, hashlib, argparse, shutil, subprocess
import numpy as np
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
        raise SystemExit('unsupported sample width %d in %s' % (sw, path))
    return x.reshape(-1, ch).mean(axis=1), sr

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def db(v):
    return 20 * np.log10(max(v, 1e-12))

def parse_source(spec):
    path, cut = spec, None
    if '@' in spec:
        path, rng = spec.rsplit('@', 1)
        a, b = rng.split('-')
        cut = (float(a), float(b))
        if not cut[1] > cut[0] >= 0: raise SystemExit('bad cut range in ' + spec)
    return os.path.abspath(path), cut

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name'); ap.add_argument('sources', nargs='+')
    ap.add_argument('--rms', type=float, default=-24.0); ap.add_argument('--peak', type=float, default=-6.0)
    ap.add_argument('--fade-ms', type=float, default=10.0); ap.add_argument('--gap', type=float, default=0.25)
    ap.add_argument('--fade-in-ms', type=float, default=None, help='overrides --fade-ms at the head (a phrase cut from a continuous take)')
    ap.add_argument('--fade-out-ms', type=float, default=None, help='overrides --fade-ms at the tail')
    ap.add_argument('--floor', type=float, default=-50.0)
    ap.add_argument('--license', default=''); ap.add_argument('--source-url', default=''); ap.add_argument('--author', default='')
    ap.add_argument('--deliver', action='store_true')
    a = ap.parse_args()
    if not all(c.isalnum() or c == '-' for c in a.name): raise SystemExit('name must be [a-z0-9-]')

    rate, pieces, receipt_samples = None, [], []
    for spec in a.sources:
        path, cut = parse_source(spec)
        x, sr = load_wav(path)
        if rate is None: rate = sr
        if sr != rate: raise SystemExit('all sources must share one sample rate (%d vs %d): %s' % (sr, rate, path))
        if cut: x = x[int(round(cut[0] * sr)):int(round(cut[1] * sr))]
        x = x - x.mean()
        peak = np.abs(x).max()
        if peak <= 0: raise SystemExit('silent source: ' + spec)
        loud = np.nonzero(np.abs(x) >= peak * 10 ** (a.floor / 20))[0]
        pre = int(0.02 * sr)
        x = x[max(0, loud[0] - pre):loud[-1] + 1]
        rms = np.sqrt((x ** 2).mean()); gain_db = a.rms - db(rms)
        if db(np.abs(x).max()) + gain_db > a.peak: gain_db = a.peak - db(np.abs(x).max())
        x = x * 10 ** (gain_db / 20)
        fi = min(int((a.fade_in_ms if a.fade_in_ms is not None else a.fade_ms) / 1000 * sr), len(x) // 2)
        fo = min(int((a.fade_out_ms if a.fade_out_ms is not None else a.fade_ms) / 1000 * sr), len(x) // 2)
        if fi > 0: x[:fi] *= (1 - np.cos(np.linspace(0, np.pi, fi))) / 2
        if fo > 0: x[-fo:] *= ((1 - np.cos(np.linspace(0, np.pi, fo))) / 2)[::-1]
        pieces.append(x)
        receipt_samples.append({'source': os.path.relpath(path, ROOT).replace('\\', '/'), 'cut': cut, 'sourceSha256': sha256(path),
                                'gainDb': round(gain_db, 2), 'seconds': round(len(x) / sr, 4),
                                'rmsDbfs': round(db(np.sqrt((x ** 2).mean())), 2), 'peakDbfs': round(db(np.abs(x).max()), 2)})

    gap = np.zeros(int(round(a.gap * rate)))
    out, cuts, pos = [gap], [], len(gap)
    for x in pieces:
        start = pos / rate; out.append(x); pos += len(x); cuts.append([round(start, 4), round(pos / rate, 4)])
        out.append(gap); pos += len(gap)
    y = np.concatenate(out)

    prep = os.path.join(ROOT, 'Audio', 'Prepared'); os.makedirs(prep, exist_ok=True)
    wav_path, mp3_path, json_path = [os.path.join(prep, a.name + ext) for ext in ('.wav', '.mp3', '.json')]
    w = wave.open(wav_path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes((np.clip(y, -1, 1) * 32767).round().astype('<i2').tobytes()); w.close()
    if imageio_ffmpeg is None: raise SystemExit('imageio-ffmpeg is required for the gapless LAME header (pip install imageio-ffmpeg)')
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', wav_path, '-map_metadata', '-1', '-id3v2_version', '0',
                    '-write_xing', '1', '-c:a', 'libmp3lame', '-b:a', '128k', '-ac', '1', mp3_path], check=True)
    with open(mp3_path, 'rb') as f: head = f.read(4096)
    if b'Xing' not in head and b'Info' not in head: raise SystemExit('encoder wrote no gapless (Xing/LAME) header; cuts would shift')
    receipt = {'name': a.name, 'sampleRate': rate, 'channels': 1, 'seconds': round(len(y) / rate, 4), 'cuts': cuts,
               'samples': receipt_samples, 'method': 'mono mean; DC removal; trim below %g dB of sample peak with 20 ms pre-roll; RMS %g dBFS, peak ceiling %g dBFS; raised-cosine fades %g ms in / %g ms out; %g s silence between samples; libmp3lame 128 kbps mono with Xing/LAME gapless header, no ID3' % (a.floor, a.rms, a.peak, a.fade_in_ms if a.fade_in_ms is not None else a.fade_ms, a.fade_out_ms if a.fade_out_ms is not None else a.fade_ms, a.gap),
               'license': a.license, 'sourceUrl': a.source_url, 'author': a.author,
               'wavSha256': sha256(wav_path), 'mp3Sha256': sha256(mp3_path), 'bytes': os.path.getsize(mp3_path)}
    if a.deliver:
        dst = os.path.join(ROOT, 'sfx', a.name + '.mp3'); shutil.copyfile(mp3_path, dst); receipt['delivery'] = 'sfx/' + a.name + '.mp3'
    with open(json_path, 'w', encoding='utf-8') as f: json.dump(receipt, f, indent=2)
    print(json.dumps({k: receipt[k] for k in ('name', 'seconds', 'cuts', 'bytes', 'mp3Sha256')}, indent=1))

if __name__ == '__main__':
    main()
