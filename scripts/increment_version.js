const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = require(packageJsonPath);

const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.').map(Number);

// Increment patch version by default
versionParts[2] += 1;

const newVersion = versionParts.join('.');

console.log(`Incrementing version from ${currentVersion} to ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version successfully bumped to ${newVersion}.`);
