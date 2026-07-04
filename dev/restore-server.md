# Server Restore Runbook

Codified from the **2026-07-03 dead-Fly-host incident** (TODO #26). When the Fly host
dies it takes the machine **and** its data volume; every request hangs with no error, the
`/health` monitor fires (GitHub emails the workflow author within ~15 min), and playing
devices silently accumulate unsynced turns showing "Connected". This runbook makes the next
recovery ~5 minutes instead of an evening of guessing.

**The one fact that makes this safe:** local is the source of truth. A playing device holds
the newest `worldState`/`memory` and re-uploads the complete current state on its next save.
Snapshot age (Fly snapshots are daily, 5-day retention → up to ~24h server-side loss window)
**does not matter for game state** — the device re-syncs over whatever the snapshot restored.

---

## Facts you'll need

| Thing | Value |
|---|---|
| Fly app | `traffic-and-dragons-server` |
| Public URL | `https://traffic-and-dragons-server.fly.dev` |
| Region | `ord` (Chicago) |
| Volume name | `tnd_data` (mounted by `fly.toml`) |
| DB | SQLite on the volume (Turso/libSQL) |
| Deploy cmd | `flyctl deploy --ha=false` from `traffic-and-dragons-server/` |
| Health check | `GET /health` — 200 + a real SQLite read (a corrupt/missing volume fails it) |

The server is a **separate, UNtracked repo** (no git) — deploy by `flyctl`, never `git push`.

---

## Recovery steps

Run these from inside `traffic-and-dragons-server/`.

**① Pick the newest snapshot of the dead volume.**
```
flyctl volumes list                                  # find the dead volume id
flyctl volumes snapshots list <dead-vol-id>          # newest snapshot at the bottom
```

**② Create a fresh volume from that snapshot.**
```
flyctl volumes create tnd_data --snapshot-id <snap-id> --region ord --yes
```

**③ Destroy the dead machine** (the one stranded on the dead host).
```
flyctl machine list                                  # find the dead machine id
flyctl machine destroy <machine-id> --force
```

**④ Deploy against the new volume.**
```
flyctl deploy --ha=false
```
> ⚠ **Expect to retry `deploy`.** Seen 2026-07-03: the first attempt can **race the destroy**
> (machine still tearing down); a second can grab the **dead volume** ("volume not found").
> Just run it again — two attempts cleared it both symptoms last time.

**⑤ Verify.**
```
curl -s -o /dev/null -w "%{http_code}\n" https://traffic-and-dragons-server.fly.dev/health
```
Expect **200** returning fast (not a hang). `/auth/me` returning **401** fast is also a good
liveness signal. The GitHub Actions `server-health.yml` cron will go green on its next run.

**⑥ Re-sync the devices.** Open the app on the device with the newest state and play/save one
turn (or trigger a sync) — it uploads the complete current state, closing the snapshot gap.
If multiple devices diverged, let the **highest-turn** device sync FIRST; the sync model is
still last-writer-wins (Known issue #5), so a stale device syncing first would roll the
newest state back.

---

## Gotchas

- **A dead host's volume may refuse to destroy** while its host is down (Fly API 408s). This
  is harmless — it's ghost-attached to the already-destroyed machine. Retry
  `flyctl volumes destroy <vol-id> --yes` after a few days, or open a Fly support ticket if it
  lingers. (2026-07-03 leftover: `vol_r7yw0lnl3lejpm1r`, host f0d2.)
- **Keep a diverged device read-only until the newest one has synced.** During the incident,
  the desktop was 20 turns *behind* the phone; letting it sync would have rolled the server
  (and then the phone) back. The write-side turn guard (Known issue #5) is the real fix; until
  then this is a manual discipline.
- **`/health` now does a real SQLite read** (v1.152 server side), so a restored-but-corrupt
  volume fails the check instead of returning a lying 200. Trust it.
