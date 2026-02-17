const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Configure git to use a dummy identity to create the commit
try {
  execSync('git config user.email "action@github.com"');
  execSync('git config user.name "GitHub Action"');
} catch (e) {
  // Ignore errors if git config fails (e.g. locally)
}

// Stage package.json
execSync(`git add ${packageJsonPath}`);

// Create a commit
execSync(`git commit -m "chore: bump version to ${newVersion}"`);

// Create a tag
execSync(`git tag v${newVersion}`);

// Push changes and tag
// Note: This requires the workflow to have write permissions
// We'll handle push in the workflow or manually if running locally
console.log(`Version bumped to ${newVersion}. Run 'git push && git push --tags' to publish.`);
