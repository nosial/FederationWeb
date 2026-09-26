const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIST_VENDOR = path.join(ROOT, 'src', 'WebResources', 'vendor');
let exitCode = 0;

function copyFile(src, dest) {
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(src)) {
    console.warn(`  SKIP (not found): ${path.relative(ROOT, src)}`);
    return false;
  }
  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    console.error(`  ERROR copying ${path.relative(ROOT, src)}: ${err.message}`);
    return false;
  }
  return true;
}

function copyTree(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`  SKIP (not found): ${path.relative(ROOT, srcDir)}`);
    return false;
  }
  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      count += copyTree(src, dest);
    } else {
      try {
        fs.copyFileSync(src, dest);
        count++;
      } catch (err) {
        console.error(`  ERROR copying ${path.relative(ROOT, src)}: ${err.message}`);
      }
    }
  }
  return count;
}

const VENDOR_FILES = [
  {
    src: 'bootstrap/dist/js/bootstrap.bundle.min.js',
    destDir: 'bootstrap',
    destName: 'bootstrap.bundle.min.js'
  },
  {
    src: 'bootstrap/dist/js/bootstrap.bundle.min.js.map',
    destDir: 'bootstrap',
    destName: 'bootstrap.bundle.min.js.map'
  },
  {
    src: 'bootstrap-icons/font/bootstrap-icons.min.css',
    destDir: 'bootstrap-icons',
    destName: 'bootstrap-icons.min.css'
  },
  {
    src: 'bootstrap-icons/font/fonts/bootstrap-icons.woff2',
    destDir: 'bootstrap-icons/fonts',
    destName: 'bootstrap-icons.woff2'
  },
  {
    src: 'bootstrap-icons/font/fonts/bootstrap-icons.woff',
    destDir: 'bootstrap-icons/fonts',
    destName: 'bootstrap-icons.woff'
  },
  {
    src: 'flag-icons/css/flag-icons.min.css',
    destDir: 'flag-icons/css',
    destName: 'flag-icons.min.css'
  }
];

let copied = 0;
let skipped = 0;

for (const file of VENDOR_FILES) {
  const srcPath = path.join(ROOT, 'node_modules', file.src);
  const destPath = path.join(DIST_VENDOR, file.destDir, file.destName);
  if (copyFile(srcPath, destPath)) {
    copied++;
  } else {
    skipped++;
  }
}

// Copy flag-icons flags directory
const flagsSrc = path.join(ROOT, 'node_modules', 'flag-icons', 'flags');
const flagsDest = path.join(DIST_VENDOR, 'flag-icons', 'flags');
const flagCount = copyTree(flagsSrc, flagsDest);
if (flagCount > 0) {
  copied += flagCount;
  console.log(`  Copied ${flagCount} flag icon${flagCount !== 1 ? 's' : ''}`);
} else {
  skipped++;
}

console.log(`Copied ${copied} vendor file${copied !== 1 ? 's' : ''} to src/WebResources/vendor/`);
if (skipped > 0) {
  console.warn(`${skipped} file${skipped !== 1 ? 's' : ''} skipped.`);
  exitCode = 1;
}
process.exit(exitCode);
