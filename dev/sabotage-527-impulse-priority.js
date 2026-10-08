// #527(11): companion impulses yield to audits under the unchanged delivery budget.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "api.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 companion impulse yields to audits"
    ]
  ],
  "cases": [
    {
      "label": "impulse returns ahead of audit notes",
      "find": "var NOTE_BUILDERS=[buildDeathSceneNote,/* #301 */buildPlotArmorNote,/* #319 */buildDownedNote,buildRespawnNote,buildRecklessNote,/* #305 */buildRegisterNote,/* #355 */buildSuggestMissNote,/* #553 */buildElsewhereSpeechNote,/* #344 */buildCheckWithdrawnNote,/* #391 */buildSubLeaveNudge,/* #393 */buildTradeRefusedNudge,/* #6 F9 */buildTradeNote,/* #407 */buildItemNotHeldNudge,/* #481 A2 */buildStashRefusedNudge,/* #481 A3 */buildReturnNote,/* #6 C2 */buildResidentExchangeNote,/* #6 D2 */buildCarriedRecordNote,/* #433 */buildMoneyNote,/* #375 */buildAgendaOfferNote,/* #373 */buildMontageNote,buildWrapUpNote,/* #308 */buildWhispersNote,/* #317 *//* #300: consequence first — nothing outranks a hero at 0 HP */buildArcWallNudge,buildOrphanCombatNudge,buildCombatStaleNudge,buildUndefinedItemNudge,buildQuestEscalation,buildQuestObjectiveNudge,buildQuestStaleNudge,buildSplitAudit,buildReunionNote,buildPresenceAudit,buildStayBehindNudge,buildPlayerSplitNudge,buildDeityDriftNudge,buildReconcileSkipNudge,buildPhaseMismatchNudge,buildLocationFilingNudge,buildTravelPriceNudge,buildCommitmentNudge,buildFutureResolveNudge,buildLocationTwinNudge,buildLocationDescNudge,buildMarketNote,buildHoursNote,buildKeeperNote,/* #481 B4 */buildLayoutNote,/* #408 ② *//* #207 ③ */buildLocationStateNudge,buildScheduleEscalation,buildExpiredThreadNudge,buildConditionAudit,buildHpZeroNudge,buildReciprocityNudge,buildArcQuestNudge,buildArcStagingNudge,buildPrincipalStageNudge,buildArcDriftNudge,buildRelationshipAxisNudge,buildRelationshipDowngradeNudge,buildRelationshipAudit,buildAgendaBirthNote,buildAgendaAnnounceNote,buildAgendaBeatNote,/* #330: character colour yields to every audit above */buildDeathEvidenceNudge,buildIdentityConflictNudge,buildMergeConfirmNudge,buildProvisionalNudge,buildDupItemNudge,buildItemMisNudge,buildConsumableNudge,buildDeadStatusNudge,buildMpEndNote,buildMoodAudit,buildSayComplianceNudge,buildSceneCastNote,buildCastSpeakerNote,/* #481 B1 */buildCastOmitNote,/* #481 B2 */buildSkeletonTitleNote,/* #481 C4 */buildPersonDriftNudge,buildCanonContradictionNudge,buildRecurringNameNudge,buildMotifNudge,/* #469 */buildSoundscapeNote,buildCompanionImpulseNote];/* #168 W7: axis decisions precede the legacy downgrade compatibility note. #194: the death-evidence fork note sits BEFORE the conflict nudge (one ask per refusal); the cast ask rides after the SAY compliance sibling. */",
      "replace": "var NOTE_BUILDERS=[buildDeathSceneNote,/* #301 */buildPlotArmorNote,/* #319 */buildDownedNote,buildRespawnNote,buildRecklessNote,/* #305 */buildRegisterNote,/* #355 */buildSuggestMissNote,/* #553 */buildElsewhereSpeechNote,/* #344 */buildCheckWithdrawnNote,/* #391 */buildSubLeaveNudge,/* #393 */buildTradeRefusedNudge,/* #6 F9 */buildTradeNote,/* #407 */buildItemNotHeldNudge,/* #481 A2 */buildStashRefusedNudge,/* #481 A3 */buildReturnNote,/* #6 C2 */buildResidentExchangeNote,/* #6 D2 */buildCarriedRecordNote,/* #433 */buildMoneyNote,/* #375 */buildAgendaOfferNote,/* #373 */buildMontageNote,buildWrapUpNote,/* #308 */buildWhispersNote,/* #317 */buildCompanionImpulseNote,/* #300: consequence first — nothing outranks a hero at 0 HP */buildArcWallNudge,buildOrphanCombatNudge,buildCombatStaleNudge,buildUndefinedItemNudge,buildQuestEscalation,buildQuestObjectiveNudge,buildQuestStaleNudge,buildSplitAudit,buildReunionNote,buildPresenceAudit,buildStayBehindNudge,buildPlayerSplitNudge,buildDeityDriftNudge,buildReconcileSkipNudge,buildPhaseMismatchNudge,buildLocationFilingNudge,buildTravelPriceNudge,buildCommitmentNudge,buildFutureResolveNudge,buildLocationTwinNudge,buildLocationDescNudge,buildMarketNote,buildHoursNote,buildKeeperNote,/* #481 B4 */buildLayoutNote,/* #408 ② *//* #207 ③ */buildLocationStateNudge,buildScheduleEscalation,buildExpiredThreadNudge,buildConditionAudit,buildHpZeroNudge,buildReciprocityNudge,buildArcQuestNudge,buildArcStagingNudge,buildPrincipalStageNudge,buildArcDriftNudge,buildRelationshipAxisNudge,buildRelationshipDowngradeNudge,buildRelationshipAudit,buildAgendaBirthNote,buildAgendaAnnounceNote,buildAgendaBeatNote,/* #330: character colour yields to every audit above */buildDeathEvidenceNudge,buildIdentityConflictNudge,buildMergeConfirmNudge,buildProvisionalNudge,buildDupItemNudge,buildItemMisNudge,buildConsumableNudge,buildDeadStatusNudge,buildMpEndNote,buildMoodAudit,buildSayComplianceNudge,buildSceneCastNote,buildCastSpeakerNote,/* #481 B1 */buildCastOmitNote,/* #481 B2 */buildSkeletonTitleNote,/* #481 C4 */buildPersonDriftNudge,buildCanonContradictionNudge,buildRecurringNameNudge,buildMotifNudge,/* #469 */buildSoundscapeNote];/* #168 W7: axis decisions precede the legacy downgrade compatibility note. #194: the death-evidence fork note sits BEFORE the conflict nudge (one ask per refusal); the cast ask rides after the SAY compliance sibling. */",
      "mustFail": "#527 three real audits outrank"
    },
    {
      "label": "a final audit still follows impulse",
      "find": "buildSoundscapeNote,buildCompanionImpulseNote];",
      "replace": "buildCompanionImpulseNote,buildSoundscapeNote];",
      "mustFail": "#527 impulse is last"
    },
    {
      "label": "impulse bypasses delivery budgets",
      "find": "buildCompanionImpulseNote:{shape:\"cooldown-reminder\",",
      "replace": "buildCompanionImpulseNote:{neverYield:true,shape:\"cooldown-reminder\",",
      "mustFail": "#527 character-budget deferral"
    },
    {
      "label": "failed turn cannot restore impulse latch",
      "find": "var k=NOTE_LATCH_FIELDS[i],v=snap.t[k];",
      "replace": "var k=NOTE_LATCH_FIELDS[i],v=snap.t[k];if(k===\"impulseAsk\")continue;",
      "mustFail": "#527 failed-turn restore"
    }
  ]
}));
