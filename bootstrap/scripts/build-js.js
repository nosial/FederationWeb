const fs = require('fs');
const path = require('path');

const SRC_JS = path.join(__dirname, '..', '..', 'bootstrap', 'js');
const DIST_JS = path.join(__dirname, '..', '..', 'src', 'WebResources', 'js');
let exitCode = 0;

if (!fs.existsSync(SRC_JS)) {
  console.log('No src/js/ directory found.');
  process.exit(0);
}

fs.mkdirSync(DIST_JS, { recursive: true });
let copied = 0;

function copyJsFiles(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyJsFiles(srcPath, destPath);
    } else if (entry.name.endsWith('.js')) {
      try {
        fs.copyFileSync(srcPath, destPath);
        copied++;
      } catch (err) {
        console.error(`Error copying ${entry.name}: ${err.message}`);
      }
    }
  }
}

copyJsFiles(SRC_JS, DIST_JS);
console.log(`Copied ${copied} JS file${copied !== 1 ? 's' : ''} to src/WebResources/js/`);
process.exit(exitCode);
