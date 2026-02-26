// Page-level idle fixtures: practice card states for screenshot captures.
// These are informational — the idle phase is the default state, so no
// engine state injection is needed. These fixtures document the expected
// practice card content for reference.

export const idleConsolidating = {
  statusLabel: 'Consolidating',
  statusDetail: 'Master current groups before adding more',
  recommendationText:
    'solidify +1 to +3 \u2014 8 slow items\nstart +4 to +6 \u2014 13 new items',
};

export const idleReadyToExpand = {
  statusLabel: 'Ready to expand',
  statusDetail: 'Current groups mastered',
  recommendationText: 'start +4 to +6 \u2014 13 new items',
};
