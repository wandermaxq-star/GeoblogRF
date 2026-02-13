const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const backendSrc = path.join(root, 'backend', 'src');

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (name.endsWith('.js')) files.push(full);
  }
  return files;
}

const files = walk(backendSrc);
const modified = [];

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('console.log(')) continue;

  // Replace all console.log( with logger.info(
  const replaced = src.replace(/console\.log\(/g, 'logger.info(');

  // Ensure import logger exists
  if (!/import\s+logger\s+from\s+['\"]/.test(replaced)) {
    // compute relative import path to backend/logger.js
    const rel = path.relative(path.dirname(file), path.join(root, 'backend', 'logger.js'))
      .replace(/\\/g, '/');
    const importPath = rel.startsWith('.') ? rel : './' + rel;

    // Insert after the last import statement (or at top)
    const importRegex = /(import\s[\s\S]+?;\n)/g;
    const imports = replaced.match(importRegex);
    if (imports && imports.length) {
      const lastImport = imports[imports.length - 1];
      const newSrc = replaced.replace(lastImport, lastImport + `import logger from '${importPath}';\n`);
      fs.writeFileSync(file, newSrc, 'utf8');
    } else {
      // no import found, add at top
      fs.writeFileSync(file, `import logger from '${importPath}';\n` + replaced, 'utf8');
    }
  } else {
    fs.writeFileSync(file, replaced, 'utf8');
  }

  modified.push(file.replace(root + path.sep, ''));
}

console.log('Modified files:', modified.length);
modified.forEach(f => console.log('  -', f));
