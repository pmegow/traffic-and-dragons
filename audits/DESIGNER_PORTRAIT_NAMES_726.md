# Creature portrait names #726

The reported fresh squirrel/frog portraits contradicted their authored humanlike anatomy. Inspection and a free intercepted browser request established that the complete Public appearance text reached the outgoing image body. The prompt nevertheless led with the canonical creature name or disguise name. The owner explicitly directed removal of creature names while retaining character names; image-model adherence was not assumed to be proven.

Designer v0.67 removes the automatic `name`/`displayName` interpolation from both creature portrait branches. Public appearance remains verbatim; the legacy fallback retains its existing kind/threat/notes inputs. Disguises still require an appearance. Blueprint identity, attachment guards and NPC/character prompt construction retain their names. Authored descriptions are not rewritten to redact words. The Designer script URL includes its new version so an existing service-worker cache fetches the changed helper; the engine and CACHE stay unchanged under the Designer-only version rule.

Verification:

- Failure-first unit assertion rejected the old public-name interpolation. The actual browser request assertion also failed before the change.
- The 24-group creature suite passes. The new group checks canonical/public name exclusion in both branches, name-independent prompt identity, exact appearance and blueprint-data preservation, and secret exclusion.
- The real Designer browser test creates fresh Frog-Eyed Reedjumper and Squirrel-Tailed Branchrunner portraits against a mocked image endpoint. Both outgoing prompts include the authored humanlike-face wording, omit both name fields and GM secrets, and have no previous-image reference. The NPC request still includes `Character portrait of Fen Keeper.`. No paid generation occurred.
- Four deliberate mutations are guarded: restore public creature name, restore legacy canonical name, leak canonical name into the actual request, and remove an NPC character name. Each must fail its named assertion.
- Independent pre/post review by `/root/drift_review`; full engine/pre-push gates are mandatory on the commit/push.

Intentional assertion change: the #719 unit assertion previously required `Rider` in the creature render prompt. It now requires `Rider` to be absent, as expressly requested by the owner. Its appearance and private-note assertions remain. The browser mock's old combined name-based admission check is replaced by actual outgoing-body assertions that distinguish unnamed creatures from named NPCs. No frozen hash changed.

This changes subsequent portrait requests. It does not regenerate existing images, and no paid visual-quality claim is made. Existing character/party render builders were not changed.
