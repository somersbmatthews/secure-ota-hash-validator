(function () {
  'use strict';

  const { CATALOG, TRUSTED_MANIFEST, buildImage } = window.OTAFirmware;

  const el = {
    list: document.getElementById('update-list'),
    tamperBtn: document.getElementById('tamper-btn'),
    tamperNote: document.getElementById('tamper-note'),
    metaEcu: document.getElementById('meta-ecu'),
    metaVersion: document.getElementById('meta-version'),
    metaSize: document.getElementById('meta-size'),
    metaState: document.getElementById('meta-state'),
    hexView: document.getElementById('hex-view'),
    calcBtn: document.getElementById('calc-btn'),
    compareBtn: document.getElementById('compare-btn'),
    trustedHash: document.getElementById('trusted-hash'),
    computedHash: document.getElementById('computed-hash'),
    calcTime: document.getElementById('calc-time'),
    result: document.getElementById('result'),
    resultBadge: document.getElementById('result-badge'),
    resultText: document.getElementById('result-text'),
    log: document.getElementById('log'),
    cryptoWarning: document.getElementById('crypto-warning'),
  };

  const HEX_ROW = 16;
  const HEADER_ROWS = 4;

  const state = {
    entry: null,
    bytes: null,
    headerLength: 0,
    tamper: null, // { offset, before, after, bit }
    computed: null,
  };

  // ---------- helpers ----------

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function hex2(n) {
    return n.toString(16).padStart(2, '0').toUpperCase();
  }

  function formatSize(bytes) {
    return (bytes / 1024).toLocaleString() + ' KiB (' + bytes.toLocaleString() + ' bytes)';
  }

  function log(message, kind) {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString([], { hour12: false });
    const text = document.createElement('span');
    text.textContent = message;
    if (kind) text.className = kind;
    li.append(time, text);
    el.log.append(li);
    while (el.log.children.length > 60) el.log.firstElementChild.remove();
    el.log.scrollTop = el.log.scrollHeight;
  }

  // ---------- rendering ----------

  function renderUpdateList() {
    for (const entry of CATALOG) {
      const label = document.createElement('label');
      label.className = 'update-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'update';
      input.value = entry.id;
      input.addEventListener('change', () => selectUpdate(entry));

      const name = document.createElement('span');
      name.className = 'update-name';
      name.textContent = entry.name;

      const version = document.createElement('span');
      version.className = 'update-version';
      version.textContent = entry.ecu + ' · v' + entry.version;

      const notes = document.createElement('span');
      notes.className = 'update-notes';
      notes.textContent = entry.notes;

      label.append(input, name, version, notes);
      el.list.append(label);
    }
  }

  function hexRow(offset, highlight) {
    const frag = document.createDocumentFragment();
    frag.append(offset.toString(16).padStart(8, '0') + '  ');

    let ascii = '';
    for (let i = 0; i < HEX_ROW; i++) {
      const idx = offset + i;
      if (idx >= state.bytes.length) {
        frag.append('   ');
        continue;
      }
      const b = state.bytes[idx];
      if (idx === highlight) {
        const mark = document.createElement('mark');
        mark.textContent = hex2(b);
        frag.append(mark, ' ');
      } else {
        frag.append(hex2(b) + ' ');
      }
      if (i === 7) frag.append(' ');
      ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.';
    }
    frag.append(' |' + ascii + '|\n');
    return frag;
  }

  function renderHexView() {
    el.hexView.textContent = '';
    if (!state.bytes) return;

    const highlight = state.tamper ? state.tamper.offset : -1;
    for (let r = 0; r < HEADER_ROWS; r++) {
      el.hexView.append(hexRow(r * HEX_ROW, highlight));
    }

    const gap = document.createElement('span');
    gap.className = 'gap';
    const rowStart = state.tamper ? Math.floor(state.tamper.offset / HEX_ROW) * HEX_ROW : -1;
    // A tampered byte inside the header rows is already highlighted above.
    if (rowStart >= HEADER_ROWS * HEX_ROW) {
      gap.textContent = '…\n';
      el.hexView.append(gap);
      el.hexView.append(hexRow(rowStart, highlight));
      const tail = document.createElement('span');
      tail.className = 'gap';
      tail.textContent = '…';
      el.hexView.append(tail);
    } else {
      gap.textContent = '… ' + (state.bytes.length - HEADER_ROWS * HEX_ROW).toLocaleString() + ' more bytes';
      el.hexView.append(gap);
    }
  }

  function renderPackage() {
    const { entry, tamper } = state;
    el.metaEcu.textContent = entry ? entry.name + ' (' + entry.ecu + ')' : '—';
    el.metaVersion.textContent = entry ? 'v' + entry.version : '—';
    el.metaSize.textContent = entry ? formatSize(entry.size) : '—';

    if (!entry) {
      el.metaState.textContent = '—';
      el.metaState.className = '';
    } else if (tamper) {
      el.metaState.textContent = 'Modified in transit';
      el.metaState.className = 'state-bad';
    } else {
      el.metaState.textContent = 'As published by OEM';
      el.metaState.className = 'state-ok';
    }

    if (tamper) {
      el.tamperNote.hidden = false;
      el.tamperNote.textContent =
        'Simulated attack: a single bit (bit ' + tamper.bit + ') was flipped at offset 0x' +
        tamper.offset.toString(16).toUpperCase() + ', changing byte 0x' + hex2(tamper.before) +
        ' to 0x' + hex2(tamper.after) + '. The package looks identical in every other respect.';
      el.tamperBtn.textContent = 'Restore original update';
    } else {
      el.tamperNote.hidden = true;
      el.tamperBtn.textContent = 'Simulate tampered update';
    }

    el.tamperBtn.disabled = !entry;
    el.calcBtn.disabled = !entry || !window.crypto || !window.crypto.subtle;
    el.trustedHash.textContent = entry ? TRUSTED_MANIFEST[entry.id] : '—';
    renderHexView();
  }

  function resetVerification() {
    state.computed = null;
    el.computedHash.textContent = 'Not calculated yet';
    el.calcTime.textContent = '';
    el.compareBtn.disabled = true;
    el.result.hidden = true;
    el.result.className = 'result';
    el.trustedHash.textContent = state.entry ? TRUSTED_MANIFEST[state.entry.id] : '—';
  }

  function renderDiff(target, value, reference) {
    target.textContent = '';
    for (let i = 0; i < value.length; i++) {
      if (value[i] === reference[i]) {
        target.append(value[i]);
      } else {
        const span = document.createElement('span');
        span.className = 'diff';
        span.textContent = value[i];
        target.append(span);
      }
    }
  }

  // ---------- actions ----------

  function selectUpdate(entry) {
    const image = buildImage(entry);
    state.entry = entry;
    state.bytes = image.bytes;
    state.headerLength = image.headerLength;
    state.tamper = null;
    resetVerification();
    renderPackage();
    log('Received ' + entry.ecu + ' v' + entry.version + ' package (' + entry.size.toLocaleString() + ' bytes).');
  }

  function toggleTamper() {
    if (!state.entry) return;

    if (state.tamper) {
      state.bytes[state.tamper.offset] = state.tamper.before;
      state.tamper = null;
      log('Original package restored.');
    } else {
      // Flip one random bit somewhere in the image body.
      const bodyLength = state.bytes.length - state.headerLength;
      const offset = state.headerLength + Math.floor(Math.random() * bodyLength);
      const bit = Math.floor(Math.random() * 8);
      const before = state.bytes[offset];
      const after = before ^ (1 << bit);
      state.bytes[offset] = after;
      state.tamper = { offset, before, after, bit };
      log('Package intercepted: 1 bit altered at offset 0x' + offset.toString(16).toUpperCase() + '.', 'warn');
    }

    resetVerification();
    renderPackage();
  }

  async function calculateHash() {
    if (!state.entry) return;
    // Tampering or switching updates while hashing makes this result stale.
    const bytes = state.bytes;
    const tamper = state.tamper;
    el.calcBtn.disabled = true;
    el.computedHash.textContent = 'Calculating…';

    try {
      const start = performance.now();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const elapsed = performance.now() - start;
      if (bytes !== state.bytes || tamper !== state.tamper) {
        log('Package changed while hashing; result discarded.', 'warn');
        return;
      }
      state.computed = toHex(digest);
      el.computedHash.textContent = state.computed;
      el.calcTime.textContent = '(' + elapsed.toFixed(1) + ' ms, in your browser)';
      el.compareBtn.disabled = false;
      log('SHA-256 calculated: ' + state.computed.slice(0, 16) + '…');
    } catch (err) {
      el.computedHash.textContent = 'Hash calculation failed: ' + err.message;
      log('Hash calculation failed.', 'bad');
    } finally {
      el.calcBtn.disabled = false;
    }
  }

  function compareHashes() {
    if (!state.entry || !state.computed) return;
    const trusted = TRUSTED_MANIFEST[state.entry.id];
    const match = state.computed === trusted;

    el.result.hidden = false;
    el.result.className = 'result ' + (match ? 'ok' : 'bad');

    if (match) {
      el.computedHash.textContent = state.computed;
      el.trustedHash.textContent = trusted;
      el.resultBadge.textContent = 'Verified';
      el.resultText.textContent =
        'The calculated hash matches the trusted value. The ' + state.entry.ecu +
        ' update is intact and may proceed to installation.';
      log('VERIFIED: hash matches manifest. ' + state.entry.ecu + ' installation authorized.', 'ok');
    } else {
      renderDiff(el.computedHash, state.computed, trusted);
      let differing = 0;
      for (let i = 0; i < trusted.length; i++) if (state.computed[i] !== trusted[i]) differing++;
      el.resultBadge.textContent = 'Rejected';
      el.resultText.textContent =
        'Hash mismatch: ' + differing + ' of 64 hex characters differ. The package has been ' +
        'altered or corrupted, so the vehicle discards it and keeps the current firmware.';
      log('REJECTED: hash mismatch. Installation blocked; package discarded.', 'bad');
    }
  }

  // ---------- init ----------

  if (!window.crypto || !window.crypto.subtle) {
    el.cryptoWarning.hidden = false;
  }

  renderUpdateList();
  el.tamperBtn.addEventListener('click', toggleTamper);
  el.calcBtn.addEventListener('click', calculateHash);
  el.compareBtn.addEventListener('click', compareHashes);

  const first = el.list.querySelector('input');
  first.checked = true;
  selectUpdate(CATALOG[0]);
  log('Vehicle ready. Awaiting verification.');
})();
