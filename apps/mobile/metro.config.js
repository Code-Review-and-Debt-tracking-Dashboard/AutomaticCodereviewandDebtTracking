const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// only watch this app + root node_modules, watching the whole repo times out on windows
config.watchFolders = [path.resolve(workspaceRoot, 'node_modules')];

module.exports = config;
