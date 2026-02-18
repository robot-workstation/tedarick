import { T } from './utils.js';
import { B, eans, kNew, kOld, safeUrl, normSeo } from './core.js';
import { compelLbl, sesciLbl, stokDur } from './stock.js';

function byEan(r1, idxB, C1, C2) {
  const br1 = B(r1[C1.marka] || '');
  for (const e of eans(r1[C1.ean] || '')) {
    const arr = idxB.get(e);
    if (arr?.length) return arr.find(r2 => B(r2[C2.marka] || '') === br1) || arr[0];
  }
  return null;
}

function byCompelCodeWs(r1, idxW, C1, C2) {
  const code = T(r1[C1.urunKodu] || '');
  if (!code) return null;

  const r2 = idxW.get(code) || null;
  if (!r2) return null;

  const b1 = B(r1[C1.marka] || '');
  const b2 = B(r2[C2.marka] || '');
  if (b1 && b2 && b1 !== b2) return null;

  return r2;
}

function byMap(r1, map, idxW, idxS, C1) {
  const m = map?.mappings || {};
  const ent = m[kNew(r1, C1)] ?? m[kOld(r1, C1)];
  if (!ent) return null;

  if (typeof ent === 'string') return idxW.get(ent) || idxS.get(ent) || null;

  const ws = T(ent.webServisKodu || ent.ws || '');
  const sup = T(ent.tedarikciUrunKodu || ent.supplier || '');
  return (ws && idxW.get(ws)) || (sup && idxS.get(sup)) || null;
}

export function outRow(r1, r2, how, C1, C2, depoRaw) {
  const s1raw = T(r1[C1.stok] || '');
  const s2raw = r2 ? T(r2[C2.stok] || '') : '';
  const dRaw = T(depoRaw || '');

  const sup = r2 ? T(r2[C2.sup] || '') : '';
  const bark = r2 ? T(r2[C2.barkod] || '') : '';

  const seoAbs = r2 ? safeUrl(normSeo(r2[C2.seo] || '')) : '';
  const clink = safeUrl(r1[C1.link] || '');

  return {
    "Sıra No": T(r1[C1.siraNo] || ''),
    "Marka": T(r1[C1.marka] || ''),
    "Ürün Adı (Compel)": T(r1[C1.urunAdi] || ''),
    "Ürün Adı (Sescibaba)": r2 ? T(r2[C2.urunAdi] || '') : '',
    "Ürün Kodu (Compel)": T(r1[C1.urunKodu] || ''),
    "Ürün Kodu (Sescibaba)": sup,

    "Stok (Compel)": compelLbl(s1raw),
    "Stok (Sescibaba)": sesciLbl(s2raw, !!r2),
    "Stok Durumu": stokDur(s1raw, s2raw, dRaw, !!r2),

    "EAN (Compel)": T(r1[C1.ean] || ''),
    "EAN (Sescibaba)": bark,
    "EAN Durumu": eanDur(r1[C1.ean] || '', bark, !!r2),

    _m: !!r2,
    _how: r2 ? how : '',
    _k: kNew(r1, C1),
    _bn: B(r1[C1.marka] || ''),
    _seo: seoAbs,
    _clink: clink
  };
}

function eanDur(aRaw, bRaw, ok) {
  if (!ok) return '—';
  const a = new Set(eans(aRaw || ''));
  const b = eans(bRaw || '');
  if (!a.size || !b.length) return 'Eşleşmedi';
  for (const x of b) if (a.has(x)) return 'Eşleşti';
  return 'Eşleşmedi';
}

export function runMatch(L1, productIndex, map, C1, C2, getDepotStockForR2) {
  const R = [];
  const U = [];

  const idxB = productIndex.idxB;
  const idxW = productIndex.idxW;
  const idxS = productIndex.idxS;

  for (const r1 of L1) {
    let r2 = byEan(r1, idxB, C1, C2), how = r2 ? 'EAN' : '';
    if (!r2) { r2 = byCompelCodeWs(r1, idxW, C1, C2); if (r2) how = 'KOD'; }
    if (!r2) { r2 = byMap(r1, map, idxW, idxS, C1); if (r2) how = 'JSON'; }

    const depoRaw = r2 ? (getDepotStockForR2?.(r2) || '') : '';
    const row = outRow(r1, r2, how, C1, C2, depoRaw);

    R.push(row);
    if (!row._m) U.push(row);
  }

  return { R, U };
}
