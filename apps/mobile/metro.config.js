const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Expo watches the whole monorepo by default. On Windows there is no native
// watcher, so Metro walks every directory (.git, api, web, worker...) and times
// out with "Failed to start watch mode". The app only needs its own folder plus
// the hoisted dependencies in the root node_modules.
config.watchFolders = [path.resolve(workspaceRoot, 'node_modules')];

module.exports = config;
