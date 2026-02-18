import {
  TR, esc, T, nowISO,
  parseDelimited, pickColumn,
  downloadBlob, toCSV, readFileText
} from './utils.js';

import { B } from './core.js';
import { buildProductIndex, fillDatalist, buildDepotIndex, makeDepotLookup } from './indexer.js';
import { runMatch, outRow } from './match.js';
import { renderTables } from './render.js';

const $ = id => document.getElementById(id);

let L1 = [], L2 = [], L2all = [], LD = [];
let map = { meta: { version: 1, createdAt: nowISO(), updatedAt: nowISO() }, mappings: {} };

let C1 = {}, C2 = {}, CD = null;
let productIndex = null;
let depotLookup = null;

let R = [], U = [];

const COLS = [
  "Sıra No","Marka","Ürün Adı (Compel)","Ürün Adı (Sescibaba)",
  "Ürün Kodu (Compel)","Ürün Kodu (Sescibaba)",
  "Stok (Compel)","Stok (Sescibaba)","Stok Durumu",
  "EAN (Compel)","EAN (Sescibaba)","EAN Durumu"
];

const setChip = (id, t, cls = '') => {
  const e = $(id);
  if (!e) return;
  e.textContent = t;
  e.title = t;
  if (cls) e.className = 'chip ' + cls;
};
const chipVis = (id, v) => {
  const e = $(id);
  if (e) e.style.display = v ? '' : 'none';
};
const setStatus = (t, k = 'ok') => {
  const e = $('stChip');
  if (!e) return;
  e.textContent = t;
  e.title = t;
  e.className = 'chip ' + k;
};

/* ✅ Tek buton mod değişimi */
let listed = false;
const setGoMode = mode => {
  const b = $('go');
  if (!b) return;
  if (mode === 'reset') { listed = true; b.textContent = 'Temizle'; b.title = 'Temizle'; }
  else { listed = false; b.textContent = 'Listele'; b.title = 'Listele'; }
};

function getDepotStockFor(r2) {
  if (!depotLookup || !r2) return '';
  return depotLookup(r2, C2);
}

function manual(i) {
  const r = U[i];
  if (!r) return;

  const t2 = $('t2');
  const tr = t2?.querySelector('#u_' + i);
  if (!tr) return;

  const ws = tr.querySelector('input[data-f="ws"]')?.value?.trim() || '';
  const sup = tr.querySelector('input[data-f="sup"]')?.value?.trim() || '';

  const r2 = (ws && productIndex?.idxW?.get(ws)) || (sup && productIndex?.idxS?.get(sup)) || null;
  if (!r2) return alert('Ürün bulunamadı (marka filtresi sebebiyle de olabilir).');

  const b1 = r._bn, b2 = B(r2[C2.marka] || '');
  if (b1 && b2 && b1 !== b2 && !confirm(`Marka farklı:\n1) ${b1}\n2) ${b2}\nYine de eşleştirilsin mi?`)) return;

  map.mappings = map.mappings || {};
  map.mappings[r._k] = {
    webServisKodu: T(r2[C2.ws] || ''),
    tedarikciUrunKodu: T(r2[C2.sup] || ''),
    barkod: T(r2[C2.barkod] || ''),
    updatedAt: nowISO()
  };
  map.meta = map.meta || {};
  map.meta.updatedAt = nowISO();

  const idx = R.findIndex(x => x._k === r._k);
  if (idx >= 0) {
    const stub = {
      [C1.siraNo]: r["Sıra No"],
      [C1.marka]: r["Marka"],
      [C1.urunAdi]: r["Ürün Adı (Compel)"],
      [C1.urunKodu]: r["Ürün Kodu (Compel)"],
      [C1.stok]: r["Stok (Compel)"],
      [C1.ean]: r["EAN (Compel)"],
      [C1.link]: r._clink || ''
    };
    const depoRaw = getDepotStockFor(r2);
    R[idx] = outRow(stub, r2, 'MANUAL', C1, C2, depoRaw);
    R[idx]._k = r._k;
    R[idx]._bn = b1;
  }

  U.splice(i, 1);
  renderTables({ COLS, R, U, onManual: manual });
}

async function generate() {
  const a = $('f1')?.files?.[0];
  const b = $('f2')?.files?.[0];
  const d = $('f4')?.files?.[0]; // ✅ depo.csv (opsiyonel)
  const j = $('f3')?.files?.[0];

  if (!a || !b) return alert('Lütfen 1) ve 2) CSV dosyalarını seç.');

  setStatus('Okunuyor…', 'unk');
  setChip('l1Chip', 'L1:—');
  setChip('l2Chip', 'L2:—');
  chipVis('jsonChip', false);

  let jsonLoaded = false, ok = false;

  try {
    const [t1, t2, t4, t3] = await Promise.all([
      readFileText(a),
      readFileText(b),
      d ? readFileText(d) : Promise.resolve(null),
      j ? readFileText(j) : Promise.resolve(null)
    ]);

    // JSON Map
    if (t3) {
      try {
        const p = JSON.parse(t3);
        map = (p?.mappings)
          ? p
          : { meta: { version: 1, createdAt: nowISO(), updatedAt: nowISO() }, mappings: (p || {}) };
        map.meta = map.meta || { version: 1, createdAt: nowISO(), updatedAt: nowISO() };
        map.meta.updatedAt = nowISO();
        jsonLoaded = true;
      } catch {
        alert('JSON okunamadı, mapping kullanılmadan devam.');
        map = { meta: { version: 1, createdAt: nowISO(), updatedAt: nowISO() }, mappings: {} };
        jsonLoaded = false;
      }
    } else {
      map = { meta: { version: 1, createdAt: nowISO(), updatedAt: nowISO() }, mappings: {} };
    }

    const p1 = parseDelimited(t1);
    const p2 = parseDelimited(t2);

    if (!p1.rows.length || !p2.rows.length) return alert('CSV boş görünüyor.');
    const s1 = p1.rows[0], s2 = p2.rows[0];

    C1 = {
      siraNo: pickColumn(s1, ['Sıra No', 'Sira No', 'SIRA NO']),
      marka: pickColumn(s1, ['Marka']),
      urunAdi: pickColumn(s1, ['Ürün Adı', 'Urun Adi', 'Ürün Adi']),
      urunKodu: pickColumn(s1, ['Ürün Kodu', 'Urun Kodu']),
      stok: pickColumn(s1, ['Stok']),
      ean: pickColumn(s1, ['EAN', 'Ean']),
      link: pickColumn(s1, ['Link', 'LINK', 'Ürün Linki', 'Urun Linki'])
    };

    C2 = {
      ws: pickColumn(s2, ['Web Servis Kodu', 'WebServis Kodu', 'WebServisKodu']),
      urunAdi: pickColumn(s2, ['Ürün Adı', 'Urun Adi', 'Ürün Adi']),
      sup: pickColumn(s2, ['Tedarikçi Ürün Kodu', 'Tedarikci Urun Kodu', 'Tedarikçi Urun Kodu']),
      barkod: pickColumn(s2, ['Barkod', 'BARKOD']),
      stok: pickColumn(s2, ['Stok']),
      marka: pickColumn(s2, ['Marka']),
      seo: pickColumn(s2, ['SEO Link', 'Seo Link', 'SEO', 'Seo'])
    };

    const need = (o, a) => a.filter(k => !o[k]);
    const m1 = need(C1, ['siraNo', 'marka', 'urunAdi', 'urunKodu', 'stok', 'ean', 'link']);
    const m2 = need(C2, ['ws', 'sup', 'barkod', 'stok', 'marka', 'urunAdi', 'seo']);
    if (m1.length || m2.length) {
      setStatus('Sütun eksik', 'bad');
      console.warn('L1', m1, 'L2', m2);
      return;
    }

    L1 = p1.rows;
    L2all = p2.rows;

    const brands = new Set(L1.map(r => B(r[C1.marka] || '')).filter(Boolean));
    L2 = L2all.filter(r => brands.has(B(r[C2.marka] || '')));

    // ✅ Product index + datalist
    productIndex = buildProductIndex(L2, C2);
    fillDatalist('wsCodes', productIndex.wsOptions);
    fillDatalist('supCodes', productIndex.supOptions);

    // ✅ Depo (opsiyonel)
    depotLookup = null;
    CD = null;
    LD = [];
    if (t4) {
      const p4 = parseDelimited(t4);
      LD = p4.rows || [];
      const s4 = LD[0] || {};

      CD = {
        ws: pickColumn(s4, ['Web Servis Kodu', 'WebServis Kodu', 'WebServisKodu', 'WS', 'WebServis', 'Web Servis']),
        sup: pickColumn(s4, ['Tedarikçi Ürün Kodu', 'Tedarikci Urun Kodu', 'TedarikciUrunKodu', 'Supplier Code', 'Tedarikçi Kod']),
        barkod: pickColumn(s4, ['Barkod', 'BARKOD', 'EAN', 'Ean']),
        stok: pickColumn(s4, ['Stok', 'STOK', 'Depo Stok', 'DEPO STOK', 'Miktar', 'Adet', 'Qty', 'Quantity'])
      };

      const hasKey = !!(CD.ws || CD.sup || CD.barkod);
      if (LD.length && CD.stok && hasKey) {
        const depotIndex = buildDepotIndex(LD, CD);
        depotLookup = makeDepotLookup(depotIndex, CD);
      } else {
        // depo yüklense bile kolonlar bulunamazsa sessizce devre dışı
        depotLookup = null;
      }
    }

    // ✅ Match + render
    ({ R, U } = runMatch(L1, productIndex, map, C1, C2, r2 => getDepotStockFor(r2)));
    renderTables({ COLS, R, U, onManual: manual });

    setStatus('Hazır', 'ok');
    setChip('l1Chip', `L1:${L1.length}`);
    setChip('l2Chip', `L2:${L2.length}/${L2all.length}`);

    if (jsonLoaded) {
      const n = Object.keys(map.mappings || {}).length;
      const jc = $('jsonChip');
      if (jc) { jc.textContent = `JSON:${n}`; jc.title = `JSON:${n}`; }
      chipVis('jsonChip', true);
    } else {
      chipVis('jsonChip', false);
    }

    ok = true;
  } catch (e) {
    console.error(e);
    setStatus('Hata (konsol)', 'bad');
  }

  if (ok) setGoMode('reset');
}

// downloads
$('dl1').onclick = () => {
  const clean = R.map(r => Object.fromEntries(COLS.map(c => [c, r[c]])));
  downloadBlob('sonuc-eslestirme.csv', new Blob([toCSV(clean, COLS)], { type: 'text/csv;charset=utf-8' }));
};
$('dl2').onclick = () => {
  const cols = ["Sıra No", "Marka", "Ürün Adı (Compel)", "Ürün Kodu (Compel)", "Stok (Compel)", "EAN (Compel)"];
  const clean = U.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
  downloadBlob('eslesmeyenler.csv', new Blob([toCSV(clean, cols)], { type: 'text/csv;charset=utf-8' }));
};
$('dl3').onclick = () => {
  map.meta = map.meta || {};
  map.meta.updatedAt = nowISO();
  downloadBlob('mapping.json', new Blob([JSON.stringify(map, null, 2)], { type: 'application/json;charset=utf-8' }));
};

// go: Listele / Temizle
$('go').onclick = () => { if (listed) location.reload(); else generate(); };

// file labels
const bind = (inId, outId, empty) => {
  const inp = $(inId), out = $(outId);
  if (!inp || !out) return;
  const upd = () => {
    const f = inp.files?.[0];
    if (!f) { out.textContent = empty; out.title = empty; }
    else { out.textContent = 'Seçildi'; out.title = f.name; }
  };
  inp.addEventListener('change', upd);
  upd();
};
bind('f1', 'n1', 'Yükle');
bind('f2', 'n2', 'Yükle');
bind('f4', 'n4', 'Yükle'); // ✅ depo artık gerçekten kullanılıyor
bind('f3', 'n3', 'Yükle');

setGoMode('list');
