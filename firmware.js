/*
 * Sample ECU update packages and the vehicle's trusted manifest.
 *
 * Each "firmware image" is generated deterministically from a seed, so the
 * same bytes are produced every time and the trusted SHA-256 values below
 * stay valid. If you change the catalog, regenerate the hashes from the
 * browser console (see "How the sample firmware works" in README.md).
 */
(function (root) {
  'use strict';

  // Small deterministic PRNG (mulberry32) used to fill the image body.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CATALOG = [
    {
      id: 'pcm',
      name: 'Powertrain Control Module',
      ecu: 'PCM',
      hw: 'PCM-H3',
      version: '4.2.1',
      size: 131072,
      seed: 0x50c3a1,
      notes: 'Revised torque calibration and idle-stability fix.',
    },
    {
      id: 'bms',
      name: 'Battery Management System',
      ecu: 'BMS',
      hw: 'BMS-R2',
      version: '7.1.3',
      size: 196608,
      seed: 0x7a11c3,
      notes: 'Updated cell-balancing thresholds and thermal derating tables.',
    },
    {
      id: 'adas',
      name: 'ADAS Front Camera',
      ecu: 'ADAS-CAM',
      hw: 'FCM-G5',
      version: '2.8.0',
      size: 262144,
      seed: 0xada5c0,
      notes: 'Improved lane-marking detection in low-light conditions.',
    },
    {
      id: 'bcm',
      name: 'Body Control Module',
      ecu: 'BCM',
      hw: 'BCM-A1',
      version: '3.0.7',
      size: 65536,
      seed: 0xb0d7c1,
      notes: 'Door-lock timing and interior lighting fixes.',
    },
    {
      id: 'ivi',
      name: 'Infotainment Head Unit',
      ecu: 'IVI',
      hw: 'IVI-X9',
      version: '12.0.4',
      size: 327680,
      seed: 0x1f0e24,
      notes: 'Media stack update and Bluetooth stability improvements.',
    },
  ];

  // Trusted SHA-256 digests, as the vehicle would receive them from the
  // OEM's (signed) update manifest.
  const TRUSTED_MANIFEST = {
    pcm: '0708225ce9349fe61b5f2fc6a7c20f73e248ce52a2037236e52611b2899c1673',
    bms: '5ff3fbf3358dbdbd098019c17630d85702ca9f6b1e5e7230b6daf65dc0c71fdf',
    adas: '180989d7105445b130f8d1ab3dc6eba977df872396096c7efdcf0d3ffca6a47f',
    bcm: '9d26d35965dd21b5423c5dfb7f9a7eb8b441cfb413c62f0bff57d1c55127c76d',
    ivi: 'a177fd8310a8f91e946261f147330894c15d46f765218ff2208d1aa0d5f1bd06',
  };

  function imageHeader(entry) {
    return new TextEncoder().encode(
      'ECU-FW\n' +
        'TARGET=' + entry.ecu + '\n' +
        'HW=' + entry.hw + '\n' +
        'VERSION=' + entry.version + '\n\n'
    );
  }

  function buildImage(entry) {
    const header = imageHeader(entry);
    const bytes = new Uint8Array(entry.size);
    bytes.set(header, 0);
    const rand = mulberry32(entry.seed);
    for (let i = header.length; i < entry.size; i++) {
      bytes[i] = Math.floor(rand() * 256);
    }
    return { bytes: bytes, headerLength: header.length };
  }

  root.OTAFirmware = {
    CATALOG: CATALOG,
    TRUSTED_MANIFEST: TRUSTED_MANIFEST,
    buildImage: buildImage,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
