# Requested portrait models (#727)

The owner's successful Fal examples name two exact endpoints: `openai/gpt-image-2.6/sunburst/text-to-image` and `openai/gpt-image-2.5/flare/text-to-image`. Neither existed in the shared render registry or server allowlist. Both now appear without replacing the user's saved model or the Nano Banana 2 default. The documented request defaults are retained; portrait requests use the existing 3:4 override. No unverified edit endpoint is added.

The transport fault is independent of image anatomy: scene renders honor `slow`, but portraits previously always used synchronous `falFetch`. The supplied Sunburst example took 60.62 seconds, beyond the gateway's 55-second window. Portraits now honor that existing registry flag (including Seedream); one shared image-result check handles queued and synchronous data. Queue failures propagate with no extra generation attempt. The pinned Flux reference path remains unchanged.

Provider schemas: [Sunburst](https://fal.ai/models/openai/gpt-image-2.6/sunburst/text-to-image/api), [Flare](https://fal.ai/models/openai/gpt-image-2.5/flare/text-to-image/api).

Verification:
- Tests written first: missing-model engine assertions, three portrait transport/error failures, and eight real-HTTP server admission/body/metering failures.
- Full engine gate: 3,228 assertions, plus 139 standalone suites; five focused portrait transport/error checks.
- Six attributed deliberate regressions caught by `dev/sabotage-727-sunburst.js`; each file restored byte-identical. Server admission removed once per endpoint: four corresponding failures each, then 102/102 HTTP assertions pass after restoration. Full server npm gate passed.
- Independent pre/post review: approved; its test finding (Sunburst edit refusal checked twice) corrected so both unverified edit paths are covered.
- The existing #210 exact roster assertion intentionally expands from five to seven exact model IDs, preserving order and the default. This is an owner-requested contract update, not a relaxed assertion. No frozen hashes changed.
- No GM prompts, save schema, blueprint content, or campaign migration changes. The preceding eight paid diagnostic images did not reproduce the owner's animal-head failure; this change does not claim to have established its cause. The owner selected these models based on their successful images.

Deployment requires server v1.15.1 first (server commit `f62917e`), then client v1.1394 / cache `tnd-v3-20261111a`. Reload makes choices available in existing campaigns and Designer drafts. Existing portraits are regenerated only on request.
