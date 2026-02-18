import { T, D, stockToNumber } from './utils.js';

export function buildProductIndex(L2, C2, { maxOptions = 20000 } = {}) {
  const idxB = new Map();
  const idxW = new Map();
  const idxS = new Map();

  for (const r of L2) {
    const bark = D(r[C2.barkod] || '');
    const ws = T(r[C2.ws] || '');
    const sup = T(r[C2.sup] || '');

    if (bark) {
      if (!idxB.has(bark)) idxB.set(bark, []);
      idxB.get(bark).push(r);
    }
    if (ws) idxW.set(ws, r);
    if (sup) idxS.set(sup, r);
  }

  const wsOptions = [];
  const supOptions = [];
  let a = 0, b = 0;

  for (const r of L2) {
    const w = T(r[C2.ws] || '');
    const p = T(r[C2.sup] || '');
    const br = T(r[C2.marka] || '');
    const nm = T(r[C2.urunAdi] || '');
    const label = (br + ' - ' + nm).slice(0, 140);

    if (w && a < maxOptions) { wsOptions.push({ value: w, label }); a++; }
    if (p && b < maxOptions) { supOptions.push({ value: p, label }); b++; }
  }

  return { idxB, idxW, idxS, wsOptions, supOptions };
}

export function fillDatalist(idOrEl, options) {
  const dl = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!dl) return;
  dl.innerHTML = '';
  for (const opt of options || []) {
    const o = document.createElement('option');
    o.value = opt.value;
    if (opt.label) o.label = opt.label;
    dl.appendChild(o);
  }
}

// Depo index
export function buildDepotIndex(LD, CD) {
  const idxB = new Map();
  const idxW = new Map();
  const idxS = new Map();

  for (const r of LD) {
    const bark = CD.barkod ? D(r[CD.barkod] || '') : '';
    const ws = CD.ws ? T(r[CD.ws] || '') : '';
    const sup = CD.sup ? T(r[CD.sup] || '') : '';

    if (bark) {
      if (!idxB.has(bark)) idxB.set(bark, []);
      idxB.get(bark).push(r);
    }
    if (ws) idxW.set(ws, r);
    if (sup) idxS.set(sup, r);
  }
  return { idxB, idxW, idxS };
}

export function makeDepotLookup(depotIndex, CD) {
  if (!depotIndex || !CD?.stok) return () => '';

  const pickBestStockRaw = (arr) => {
    if (!arr?.length) return '';
    let bestRaw = '';
    let bestN = -Infinity;
    for (const r of arr) {
      const raw = T(r[CD.stok] || '');
      const n = stockToNumber(raw);
      if (n > bestN) { bestN = n; bestRaw = raw; }
    }
    return bestRaw;
  };

  return (r2, C2) => {
    if (!r2) return '';

    const ws = C2.ws ? T(r2[C2.ws] || '') : '';
    const sup = C2.sup ? T(r2[C2.sup] || '') : '';
    const bark = C2.barkod ? D(r2[C2.barkod] || '') : '';

    if (ws && depotIndex.idxW.has(ws)) return T(depotIndex.idxW.get(ws)?.[CD.stok] || '');
    if (sup && depotIndex.idxS.has(sup)) return T(depotIndex.idxS.get(sup)?.[CD.stok] || '');
    if (bark && depotIndex.idxB.has(bark)) return pickBestStockRaw(depotIndex.idxB.get(bark));

    return '';
  };
}
