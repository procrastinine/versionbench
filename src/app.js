import { createFormatting } from './format.js';
import { createCatalog } from './data.js';
import { createState } from './state.js';
import { createRouter } from './router.js';
import { createUI } from './ui.js';
import { createChartPoints } from './chart-points.js';
import { createTimelineNavigation } from './timeline/navigation.js';
import { createTimelineChart } from './timeline/chart.js';
import { createTimeline } from './timeline/view.js';
import { createReleaseIndex } from './releases.js';
import { createFamilyPage } from './family.js';
import { createComparison } from './comparison.js';
import { createLeaderboard } from './leaderboard.js';
import { createMethodology } from './methodology.js';
import { bindEvents } from './events.js';

// The offline build embeds these self-contained factories with startApp.
export const browserModules = {
  createFormatting,
  createCatalog,
  createState,
  createRouter,
  createUI,
  createChartPoints,
  createTimelineNavigation,
  createTimelineChart,
  createTimeline,
  createReleaseIndex,
  createFamilyPage,
  createComparison,
  createLeaderboard,
  createMethodology,
  bindEvents,
};

export function startApp() {
  const app = {
    dom: {
      main: document.getElementById('main'),
      tooltip: document.getElementById('tooltip'),
      dialog: document.getElementById('model-dialog'),
    },
  };
  app.format = createFormatting(app);
  app.catalog = createCatalog(app);
  app.state = createState(app);
  app.router = createRouter(app);
  app.ui = createUI(app);
  app.points = createChartPoints(app);
  app.timelineNavigation = createTimelineNavigation(app);
  app.timelineChart = createTimelineChart(app);
  app.timeline = createTimeline(app);
  app.releases = createReleaseIndex(app);
  app.family = createFamilyPage(app);
  app.comparison = createComparison(app);
  app.leaderboard = createLeaderboard(app);
  app.methodology = createMethodology(app);
  bindEvents(app);
  app.router.renderRoute();
}
