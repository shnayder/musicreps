// Leaf fixtures for CountdownBar / timer state.

export const timerMidRound = {
  pct: 65,
  text: '0:39',
  warning: false,
  lastQuestion: false,
};

export const timerWarning = {
  pct: 12,
  text: '0:07',
  warning: true,
  lastQuestion: false,
};

/** 1 second left — bar nearly empty, warning color. */
export const timerAlmostExpired = {
  pct: 2,
  text: '0:01',
  warning: true,
  lastQuestion: false,
};

/** Timer hit 0:00 — "Last question" shown, awaiting answer. */
export const timerExpired = {
  pct: 0,
  text: '0:00',
  warning: false,
  lastQuestion: true,
};
