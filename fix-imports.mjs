// fix-imports.mjs
// Run with: node fix-imports.mjs

import fs from 'fs';
import path from 'path';
import { glob } from 'fs/promises';

const SRC_DIR = './src';

// Get all .ts files
function getAllTsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileDir = path.dirname(filePath);
  let changed = false;
  const log = [];

  // Match: from 'src/...' or from "src/..."
  const importRegex = /from ['"]src\/([^'"]+)['"]/g;

  content = content.replace(importRegex, (match, importPath) => {
    // Resolve the target path from project root
    const targetPath = path.join('./src', importPath);
    // Get relative path from the file's directory to the target
    let rel = path.relative(fileDir, targetPath).replace(/\\/g, '/');
    // Ensure it starts with ./
    if (!rel.startsWith('.')) rel = './' + rel;

    log.push(`  ✅  src/${importPath}  →  ${rel}`);
    changed = true;
    return `from '${rel}'`;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n📄 ${filePath}`);
    log.forEach(l => console.log(l));
  }
}

function fixTypoInFilenames(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixTypoInFilenames(fullPath);
    } else if (entry.name.includes('syestem')) {
      const newName = entry.name.replace(/syestem/g, 'system');
      const newPath = path.join(dir, newName);
      fs.renameSync(fullPath, newPath);
      console.log(`\n🔤 Renamed file: ${fullPath} → ${newPath}`);
    }
  }
}

function fixTypoInFileContents(files) {
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('syestem')) {
      const fixed = content.replace(/syestem/g, 'system');
      fs.writeFileSync(file, fixed, 'utf8');
      console.log(`🔤 Fixed 'syestem' typo in: ${file}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────
console.log('════════════════════════════════════════');
console.log('  Fixing src/ imports → relative paths  ');
console.log('════════════════════════════════════════');

// Step 1: Fix typo in filenames first
console.log('\n[1/3] Fixing filename typos...');
fixTypoInFilenames(SRC_DIR);

// Step 2: Get all ts files after rename
const files = getAllTsFiles(SRC_DIR);

// Step 3: Fix typo in file contents
console.log('\n[2/3] Fixing typos inside files...');
fixTypoInFileContents(files);

// Step 4: Fix all src/ imports
console.log('\n[3/3] Rewriting src/ imports to relative paths...');
for (const file of files) {
  fixImportsInFile(file);
}

console.log('\n════════════════════════════════════════');
console.log('  Done! Now run:                        ');
console.log('  npx tsc --noEmit                      ');
console.log('════════════════════════════════════════\n');
