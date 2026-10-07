// Mutable UI state is shared explicitly; feature modules never copy its values.
export function createState(app) {
  const { isoDate, takeWithTies } = app.format;
  const { latestTime, modelStartTime, ranked, coreIds } = app.catalog;

  return {
    compareIds: takeWithTies(ranked, 3).map((release) => release.id),
    compareOrder: 'score',
    draftIds: new Set(),
    previousPage: '',
    currentRoute: null,
    timelinePrefs: {
      familyIds: [...coreIds],
      from: isoDate(modelStartTime),
      to: isoDate(latestTime),
      range: 'all',
      mode: 'highest',
      weights: 'all',
      kind: 'all',
      status: 'all',
    },
    indexPrefs: {
      query: '',
      family: 'all',
      sort: 'date',
      direction: 'desc',
      weights: 'all',
      status: 'all',
      kind: 'model',
    },
    leaderboardScope: 'all',
    pinnedPoint: null,
    suppressPointFocus: false,
    toastTimer: undefined,
    resizeTimer: undefined,
    timelineGesture: null,
    timelineDrag: null,
    timelineGestureTimer: undefined,
    timelineDrawFrame: undefined,
  };
}
