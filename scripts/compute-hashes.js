// Prints the SHA-256 of every sample image in firmware.js so the
// TRUSTED_MANIFEST can be updated after catalog changes.
// Usage: node scripts/compute-hashes.js
'use strict';

const crypto = require('crypto');
const path = require('path');

require(path.join(__dirname, '..', 'firmware.js'));
const { CATALOG, buildImage } = globalThis.OTAFirmware;

for (const entry of CATALOG) {
  const { bytes } = buildImage(entry);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  console.log(`    ${entry.id}: '${hash}',`);
}
