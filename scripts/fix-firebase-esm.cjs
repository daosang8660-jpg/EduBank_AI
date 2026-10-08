'use strict';

// Compatibility patch for jwks-rsa 4.x loading the ESM-only jose 6.x.
// Runs after install and before build, including builds using an install cache.
// No token verification or access checks are changed.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

function patchJwks(projectRoot) {
  const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
  const firebaseRequire = createRequire(projectRequire.resolve('firebase-admin/app'));
  const entry = firebaseRequire.resolve('jwks-rsa');
  const utilsPath = path.join(path.dirname(entry), 'utils.js');
  const pkgPath = path.join(path.dirname(entry), '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!String(pkg.version).startsWith('4.')) {
    console.log('[firebase-esm] jwks-rsa version does not need the 4.x patch.');
    return;
  }
  const marker = '// edubank: load jose through native asynchronous import';
  const requireLine = /^const jose = require\(['"]jose['"]\);\r?$/m;
  const targets = [
    { file: utilsPath, anchor: 'async function retrieveSigningKeys(jwks) {',
      replacement: 'async function retrieveSigningKeys(jwks) {\n  const jose = await loadJose();' },
    { file: path.join(path.dirname(entry), 'integrations', 'passport.js'),
      anchor: 'return function secretProvider(req, rawJwtToken, cb) {',
      replacement: 'return async function secretProvider(req, rawJwtToken, cb) {' },
  ];
  const writes = [];
  for (const target of targets) {
    const source = fs.readFileSync(target.file, 'utf8');
    if (source.includes(marker)) continue;
    if (!requireLine.test(source)) {
      if (/\bimport\(['"]jose['"]\)/.test(source)) continue;
      throw new Error('Unexpected jwks-rsa loader. Compatibility patch was not applied.');
    }
    if (source.split(target.anchor).length !== 2) {
      throw new Error('Unexpected jwks-rsa function. Compatibility patch was not applied.');
    }
    let patched = source.replace(requireLine,
      `${marker}\nlet josePromise;\nconst loadJose = () => (josePromise ??= import('jose'));`)
      .replace(target.anchor, target.replacement);
    if (target.file.endsWith('passport.js')) {
      const tryAnchor = '    try {';
      if (patched.split(tryAnchor).length !== 2) throw new Error('Unexpected passport decoder.');
      patched = patched.replace(tryAnchor, `${tryAnchor}\n      const jose = await loadJose();`);
    }
    writes.push({ file: target.file, content: patched });
  }
  for (const write of writes) fs.writeFileSync(write.file, write.content, 'utf8');
  console.log(writes.length
    ? `[firebase-esm] Patched jwks-rsa ${pkg.version} to import jose asynchronously.`
    : '[firebase-esm] Compatibility patch already applied.');
}

module.exports = { patchJwks };
if (require.main === module) patchJwks(path.resolve(__dirname, '..'));
