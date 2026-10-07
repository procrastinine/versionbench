import { browserModules, startApp } from '../src/app.js';

// Native ES modules keep feature boundaries explicit during development. Their
// factories capture no module-local state: dependencies arrive through `app`.
// Function source can therefore be embedded directly, without a transpiler,
// runtime loader, or network request when index.html is opened as a local file.
export function buildBrowserScript() {
  const factories = [...Object.values(browserModules), startApp];
  return [
    '(() => {',
    "  'use strict';",
    ...factories.map((factory) => factory.toString()),
    '  startApp();',
    '})();',
    '',
  ].join('\n\n');
}
