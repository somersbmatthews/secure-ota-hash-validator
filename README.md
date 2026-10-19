# Secure OTA Hash Validator

An interactive, browser-based demo of how a connected vehicle checks an over-the-air (OTA)
software update with SHA-256 before an ECU installs it.

You pick a sample ECU update, optionally flip a single bit to simulate tampering, compute the
package's SHA-256 hash in the browser, and compare it with the trusted value from the OEM's
update manifest. A match authorizes installation. A mismatch rejects the package and
highlights the hex characters that differ.

## Features

- Five synthetic ECU update packages (PCM, BMS, ADAS camera, BCM, infotainment), 64–320 KiB each
- One-click tamper simulation that flips one random bit in the image body
- Hex dump of the package header and of the byte that was tampered with
- SHA-256 hashing done locally with the Web Crypto API (`crypto.subtle.digest`)
- Side-by-side comparison of the hashes, with the differing characters highlighted
- Vehicle update log, plus a section on what production OTA systems add (signatures,
  certificates, Uptane, secure boot)
- Light and dark themes that follow the system setting

## Running it

There are no dependencies and no build step. The Web Crypto API only works in a secure
context, so serve the folder from `localhost` or over HTTPS with any static server.

For example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Opening `index.html` straight from disk (`file://`) may not work in every browser. If
`crypto.subtle` isn't available, the page shows a warning.

## Project structure

```
.
├── index.html               # Page markup
├── styles.css               # Styles (light/dark theme tokens)
├── firmware.js              # Sample update catalog, trusted manifest, image generator
└── app.js                   # UI logic: selection, tampering, hashing, comparison, log
```

## How the sample firmware works

`firmware.js` builds each image the same way every time. It starts with a short text
header (`ECU-FW`, target ECU, hardware ID, version) and fills the rest with bytes from a
seeded PRNG (mulberry32). Because the bytes never change, the hashes in `TRUSTED_MANIFEST`
stay valid.

If you add, remove or change a catalog entry (size, seed, version, etc.), regenerate the
trusted hashes. Open the running page, paste this into the browser's developer console,
and copy the output into `TRUSTED_MANIFEST` in `firmware.js`:

```js
for (const e of OTAFirmware.CATALOG) {
  const d = await crypto.subtle.digest('SHA-256', OTAFirmware.buildImage(e).bytes);
  console.log(`    ${e.id}: '${[...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')}',`);
}
```

## Disclaimer

This is a simplified teaching demo. A bare hash proves that a package hasn't changed, but
not who produced it. Real OTA systems check a digital signature on the update metadata
against a trusted root of trust before relying on any hash in it. All packages here are
synthetic, and nothing leaves your browser.
