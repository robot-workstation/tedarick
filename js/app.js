// js/app.js
import {
  TR, esc, T, D, nowISO,
  parseDelimited, pickColumn,
  downloadBlob, toCSV, readFileText,
  inStock
} from './utils.js';

const $ = (id) => document.getElementById(id);

// Marka alias (Compel -> Products eşleştirme)
const BRAND_ALIASES = new Map([
  ['ALLEN & HEATH', 'ALLEN HEATH'],
  ['MARANTZ PROFESSIONAL', 'MARANTZ'],
  ['RUPERT NEVE DESIGNS', 'RUPERT NEVE'],
  ['RØDE', 'RODE'],
  ['RØDE X', 'RODE'],
]);

const bRaw = (s) => (s ?? '').toString().trim().toLocaleUpperCase(TR).replace(/\s+/g,' ');
const B = (s) => BRAND_ALIASES.get(bRaw(s)) || bRaw(s);
const Bx = (s) => bRaw(s); // alias yok (eski JSON key uyumu)

let L1 = [], L2 = [], L2all = [];
let map = { meta:{version:1,createdAt:nowISO(),updatedAt:nowISO()}, mappings:{} };

let C1 = {}, C2 = {};
let idxB = new Map(), idxW = new Map(), idxS = new Map();
let R = [], U = [];

// CSV kolon anahtarları (değişmiyor)
const COLS = [
  "Sıra No","Marka",
  "Ürün Adı (Compel)","Ürün Adı (Sescibaba)",
  "Ürün Kodu (Compel)","Ürün Kodu (Sescibaba)",
  "Stok (Compel)","Stok (Sescibaba)","Stok Durumu",
  "EAN (Compel)","EAN (Sescibaba)","EAN Durumu"
];

/* ======= Üst bilgi kutusu ======= */
function setChip(id, text, cls = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.title = text;
  el.className = 'chip' + (cls ? ` ${cls}` : '');
}
function setChipVisible(id, visible) {
  const el = $(id);
  if (!el) return;
  el.style.display = visible ? '' : 'none';
}
function setStatus(label, kind = 'ok') {
  setChip('stChip', label, kind);
}

/* ======= URL güvenliği ======= */
const safeUrl = (u) => {
  u = T(u);
  if (!u) return '';
  if (/^\s*javascript:/i.test(u)) return '';
  return u;
};

// products.csv SEO Link: sitesiz path -> absolute link
const SEO_BASE = 'https://www.sescibaba.com/';
const normalizeSeoUrl = (raw) => {
  let u = T(raw);
  if (!u) return '';
  if (/^\s*javascript:/i.test(u)) return '';
  if (/^https?:\/\//i.test(u)) return u;

  if (/^www\./i.test(u)) return 'https://' + u;
  if (/^sescibaba\.com/i.test(u)) return 'https://' + u;

  u = u.replace(/^\/+/, '');
  return SEO_BASE + u;
};

const key = (r, brandFn) => {
  const b = brandFn(r[C1.marka] || '');
  const code = T(r[C1.urunKodu] || '');
  const name = T(r[C1.urunAdi] || '');
  return b + '||' + (code || ('NAME:' + name));
};
const kNew = (r) => key(r, B);
const kOld = (r) => key(r, Bx);

const eans = (v) => {
  v = (v ?? '').toString().trim();
  if (!v) return [];
  return v.split(/[^0-9]+/g).map(D).filter(x => x.length >= 8);
};

function buildIndices() {
  idxB = new Map(); idxW = new Map(); idxS = new Map();

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

  // datalist önerileri
  const wsDl = $('wsCodes'), supDl = $('supCodes');
  wsDl.innerHTML = ''; supDl.innerHTML = '';
  let a=0,b=0,MAX=20000;
  for (const r of L2) {
    const w = T(r[C2.ws] || ''), p = T(r[C2.sup] || '');
    const br = T(r[C2.marka] || ''), nm = T(r[C2.urunAdi] || '');
    if (w && a<MAX) { const o=document.createElement('option'); o.value=w; o.label=(br+' - '+nm).slice(0,140); wsDl.appendChild(o); a++; }
    if (p && b<MAX) { const o=document.createElement('option'); o.value=p; o.label=(br+' - '+nm).slice(0,140); supDl.appendChild(o); b++; }
  }
}

function findByEan(r1) {
  const br1 = B(r1[C1.marka] || '');
  for (const e of eans(r1[C1.ean] || '')) {
    const arr = idxB.get(e);
    if (arr?.length) {
      return arr.find(r2 => B(r2[C2.marka] || '') === br1) || arr[0];
    }
  }
  return null;
}

// EAN eşleşmezse: Compel Ürün Kodu -> Sescibaba Web Servis Kodu dene
function findByCompelCodeWs(r1) {
  const code = T(r1[C1.urunKodu] || '');
  if (!code) return null;

  const r2 = idxW.get(code) || null;
  if (!r2) return null;

  // marka güvenliği
  const b1 = B(r1[C1.marka] || '');
  const b2 = B(r2[C2.marka] || '');
  if (b1 && b2 && b1 !== b2) return null;

  return r2;
}

function findByMap(r1) {
  const m = map.mappings || {};
  const ent = m[kNew(r1)] ?? m[kOld(r1)];
  if (!ent) return null;

  if (typeof ent === 'string') return idxW.get(ent) || idxS.get(ent) || null;

  const ws = T(ent.webServisKodu || ent.ws || '');
  const sup = T(ent.tedarikciUrunKodu || ent.supplier || '');
  return (ws && idxW.get(ws)) || (sup && idxS.get(sup)) || null;
}

// stok var/yok karşılaştır (products'ta "-" => yok)
function stokDurumu(compelStokRaw, prodStokRaw, matched) {
  if (!matched) return '—';
  const a = inStock(compelStokRaw, { source: 'compel' });
  const b = inStock(prodStokRaw, { source: 'products' });
  return (a === b) ? 'Doğru' : 'Hatalı';
}

function stokLabelSescibaba(prodStokRaw, matched) {
  if (!matched) return '';
  return inStock(prodStokRaw, { source: 'products' }) ? 'Stokta Var' : 'Stokta Yok';
}

function eanDurumu(compelEanRaw, sesEanRaw, matched) {
  if (!matched) return '—';
  const a = new Set(eans(compelEanRaw || ''));
  const b = eans(sesEanRaw || '');
  if (!a.size || !b.length) return 'Eşleşmedi';
  for (const x of b) if (a.has(x)) return 'Eşleşti';
  return 'Eşleşmedi';
}

function outRow(r1, r2, how) {
  const s1 = T(r1[C1.stok] || '');
  const s2raw = r2 ? T(r2[C2.stok] || '') : '';

  const sup = r2 ? T(r2[C2.sup] || '') : '';
  const barkRaw = r2 ? T(r2[C2.barkod] || '') : '';

  const seoAbs = r2 ? safeUrl(normalizeSeoUrl(r2[C2.seo] || '')) : '';
  const clink = safeUrl(r1[C1.link] || '');

  return {
    "Sıra No": T(r1[C1.siraNo] || ''),
    "Marka": T(r1[C1.marka] || ''),

    "Ürün Adı (Compel)": T(r1[C1.urunAdi] || ''),
    "Ürün Adı (Sescibaba)": r2 ? T(r2[C2.urunAdi] || '') : '',

    "Ürün Kodu (Compel)": T(r1[C1.urunKodu] || ''),
    "Ürün Kodu (Sescibaba)": sup,

    "Stok (Compel)": s1,
    "Stok (Sescibaba)": stokLabelSescibaba(s2raw, !!r2),
    "Stok Durumu": stokDurumu(s1, s2raw, !!r2),

    "EAN (Compel)": T(r1[C1.ean] || ''),
    "EAN (Sescibaba)": barkRaw,
    "EAN Durumu": eanDurumu(r1[C1.ean] || '', barkRaw, !!r2),

    _m: !!r2,
    _how: r2 ? how : '',
    _k: kNew(r1),
    _bn: B(r1[C1.marka] || ''),
    _seo: seoAbs,
    _clink: clink
  };
}

function runMatching() {
  R = []; U = [];
  for (const r1 of L1) {
    // 1) EAN
    let r2 = findByEan(r1), how = r2 ? 'EAN' : '';

    // 2) Compel Ürün Kodu -> Sescibaba Web Servis Kodu
    if (!r2) { r2 = findByCompelCodeWs(r1); if (r2) how = 'KOD'; }

    // 3) JSON mapping
    if (!r2) { r2 = findByMap(r1); if (r2) how = 'JSON'; }

    const row = outRow(r1, r2, how);
    R.push(row);
    if (!row._m) U.push(row);
  }
  render();
}

/* ======= Sonuç tablosu: Ürün adları kısıtlanmaz (taşabilir) ======= */
function cellNameLink(fullText, href) {
  const v = (fullText ?? '').toString();
  const u = href || '';
  if (!u) return `<span class="nm" title="${esc(v)}">${esc(v)}</span>`;
  return `<a class="nm" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(v)}">${esc(v)}</a>`;
}

/* ======= Tablo responsive: yüzde kolonlar ======= */
function colGroupPerc(widths) {
  return `<colgroup>${widths.map(w => `<col style="width:${w}%">`).join('')}</colgroup>`;
}

function dispColName(c) {
  return (c === "Sıra No") ? "Sıra" : c;
}

/* Başlık formatı: (Compel)/(Sescibaba) kısmı küçük + bold değil */
function formatHeader(label) {
  const s = (label ?? '').toString();
  const m = s.match(/^(.*?)(\s*\([^)]*\))\s*$/);
  if (!m) return esc(s);
  const main = m[1].trimEnd();
  const par = m[2].trim();
  return `<span class="hMain">${esc(main)}</span> <span class="hParen">${esc(par)}</span>`;
}

function render() {
  // 12 kolon toplam %100
  const W1 = [4,9,15,15,7,7,6,6,6,9,9,7];

  const head1 = COLS.map(c => {
    const label = dispColName(c);
    return `<th title="${esc(label)}">${formatHeader(label)}</th>`;
  }).join('');

  const body1 = R.map((r) => {
    return `<tr>${
      COLS.map(c => {
        if (c === "Ürün Adı (Compel)") {
          return `<td class="left nameCell">${cellNameLink(r[c], r._clink || '')}</td>`;
        }
        if (c === "Ürün Adı (Sescibaba)") {
          return `<td class="left nameCell">${cellNameLink(r[c], r._seo || '')}</td>`;
        }
        const v = r[c] ?? '';
        return `<td title="${esc(v)}">${esc(v)}</td>`;
      }).join('')
    }</tr>`;
  }).join('');

  $('t1').innerHTML =
    colGroupPerc(W1) +
    `<thead><tr>${head1}</tr></thead>` +
    `<tbody>${body1}</tbody>`;

  // Unmatched kısmı: yoksa gizle + buton gizle
  const sec = $('unmatchedSection');
  const btn2 = $('dl2');

  if (!U.length) {
    if (sec) sec.style.display = 'none';
    if (btn2) btn2.style.display = 'none';
  } else {
    if (sec) sec.style.display = '';
    if (btn2) btn2.style.display = '';
  }

  if (U.length) {
    // Unmatched table (8 kolon %100)
    const W2 = [6,10,28,12,18,10,10,6];

    $('t2').innerHTML =
      colGroupPerc(W2) +
      `<thead><tr>
        <th title="Sıra">Sıra</th>
        <th title="Marka">Marka</th>
        <th title="Ürün Adı">Ürün Adı</th>
        <th title="Ürün Kodu">Ürün Kodu</th>
        <th title="EAN">EAN</th>
        <th title="Web Servis">Web Servis</th>
        <th title="Tedarikçi">Tedarikçi</th>
        <th title=""></th>
      </tr></thead>` +
      `<tbody>${U.map((r,i)=>`
        <tr id="u_${i}">
          <td title="${esc(r["Sıra No"])}">${esc(r["Sıra No"])}</td>
          <td title="${esc(r["Marka"])}">${esc(r["Marka"])}</td>
          <td class="left" title="${esc(r["Ürün Adı (Compel)"])}">${esc(r["Ürün Adı (Compel)"] || '')}</td>
          <td title="${esc(r["Ürün Kodu (Compel)"])}">${esc(r["Ürün Kodu (Compel)"])}</td>
          <td title="${esc(r["EAN (Compel)"])}">${esc(r["EAN (Compel)"])}</td>
          <td><input type="text" list="wsCodes" data-i="${i}" data-f="ws" placeholder="ws"></td>
          <td><input type="text" list="supCodes" data-i="${i}" data-f="sup" placeholder="sup"></td>
          <td><button class="mx" data-i="${i}">Eşleştir</button></td>
        </tr>`).join('')}</tbody>`;

    $('t2').querySelectorAll('.mx').forEach(b => b.onclick = () => manualMatch(+b.dataset.i));
  }

  const matched = R.filter(x => x._m).length;
  setChip('sum', `Toplam ${R.length} • ✓${matched} • ✕${R.length - matched}`, 'muted');

  // İndir butonları
  $('dl1').disabled = !R.length;
  $('dl3').disabled = false;
  if ($('dl2')) $('dl2').disabled = !U.length;
}

function manualMatch(i) {
  const r = U[i]; if (!r) return;
  const tr = $('t2').querySelector('#u_' + i);
  const ws = tr.querySelector('input[data-f="ws"]').value.trim();
  const sup = tr.querySelector('input[data-f="sup"]').value.trim();

  const r2 = (ws && idxW.get(ws)) || (sup && idxS.get(sup)) || null;
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
    const r1stub = {
      [C1.siraNo]: r["Sıra No"],
      [C1.marka]: r["Marka"],
      [C1.urunAdi]: r["Ürün Adı (Compel)"],
      [C1.urunKodu]: r["Ürün Kodu (Compel)"],
      [C1.stok]: r["Stok (Compel)"],
      [C1.ean]: r["EAN (Compel)"],
      [C1.link]: r._clink || ''
    };
    const upd = outRow(r1stub, r2, 'MANUAL');
    upd._k = r._k; upd._bn = b1;
    R[idx] = upd;
  }

  U.splice(i,1);
  render();
}

async function generate() {
  const a = $('f1').files[0], b = $('f2').files[0], j = $('f3').files[0];
  if (!a || !b) return alert('Lütfen 1) ve 2) CSV dosyalarını seç.');

  setStatus('Okunuyor…', 'unk');
  setChip('l1Chip', 'L1:—');
  setChip('l2Chip', 'L2:—');
  setChipVisible('jsonChip', false);

  let jsonLoaded = false;

  try {
    const [t1, t2, t3] = await Promise.all([
      readFileText(a),
      readFileText(b),
      j ? readFileText(j) : Promise.resolve(null)
    ]);

    if (t3) {
      try {
        const p = JSON.parse(t3);
        map = (p?.mappings) ? p : { meta:{version:1,createdAt:nowISO(),updatedAt:nowISO()}, mappings: (p || {}) };
        map.meta = map.meta || {version:1,createdAt:nowISO(),updatedAt:nowISO()};
        map.meta.updatedAt = nowISO();
        jsonLoaded = true;
      } catch {
        alert('JSON okunamadı, mapping kullanılmadan devam.');
        map = { meta:{version:1,createdAt:nowISO(),updatedAt:nowISO()}, mappings:{} };
        jsonLoaded = false;
      }
    } else {
      map = { meta:{version:1,createdAt:nowISO(),updatedAt:nowISO()}, mappings:{} };
      jsonLoaded = false;
    }

    const p1 = parseDelimited(t1), p2 = parseDelimited(t2);
    if (!p1.rows.length || !p2.rows.length) return alert('CSV boş görünüyor.');

    const s1 = p1.rows[0], s2 = p2.rows[0];

    C1 = {
      siraNo: pickColumn(s1, ['Sıra No','Sira No','SIRA NO']),
      marka:  pickColumn(s1, ['Marka']),
      urunAdi: pickColumn(s1, ['Ürün Adı','Urun Adi','Ürün Adi']),
      urunKodu: pickColumn(s1, ['Ürün Kodu','Urun Kodu']),
      stok: pickColumn(s1, ['Stok']),
      ean: pickColumn(s1, ['EAN','Ean']),
      link: pickColumn(s1, ['Link','LINK','Ürün Linki','Urun Linki'])
    };

    C2 = {
      ws: pickColumn(s2, ['Web Servis Kodu','WebServis Kodu','WebServisKodu']),
      urunAdi: pickColumn(s2, ['Ürün Adı','Urun Adi','Ürün Adi']),
      sup: pickColumn(s2, ['Tedarikçi Ürün Kodu','Tedarikci Urun Kodu','Tedarikçi Urun Kodu']),
      barkod: pickColumn(s2, ['Barkod','BARKOD']),
      stok: pickColumn(s2, ['Stok']),
      marka: pickColumn(s2, ['Marka']),
      seo: pickColumn(s2, ['SEO Link','Seo Link','SEO','Seo'])
    };

    const need = (o, arr) => arr.filter(k => !o[k]);
    const m1 = need(C1, ['siraNo','marka','urunAdi','urunKodu','stok','ean','link']);
    const m2 = need(C2, ['ws','sup','barkod','stok','marka','urunAdi','seo']);
    if (m1.length || m2.length) {
      setStatus('Sütun eksik', 'bad');
      console.warn('L1 eksik:', m1, 'L2 eksik:', m2);
      return;
    }

    L1 = p1.rows;
    L2all = p2.rows;

    const brands = new Set(L1.map(r => B(r[C1.marka] || '')).filter(Boolean));
    L2 = L2all.filter(r => brands.has(B(r[C2.marka] || '')));

    buildIndices();
    runMatching();

    setStatus('Hazır', 'ok');
    setChip('l1Chip', `L1:${L1.length}`);
    setChip('l2Chip', `L2:${L2.length}/${L2all.length}`);

    if (jsonLoaded) {
      const n = Object.keys(map.mappings||{}).length;
      setChip('jsonChip', `JSON:${n}`, 'muted');
      setChipVisible('jsonChip', true);
    } else {
      setChipVisible('jsonChip', false);
    }

  } catch (e) {
    console.error(e);
    setStatus('Hata (konsol)', 'bad');
  }
}

// Downloads
$('dl1').onclick = () => {
  const clean = R.map(r => Object.fromEntries(COLS.map(c => [c, r[c]])));
  downloadBlob('sonuc-eslestirme.csv', new Blob([toCSV(clean, COLS)], { type:'text/csv;charset=utf-8' }));
};

$('dl2').onclick = () => {
  const cols = ["Sıra No","Marka","Ürün Adı (Compel)","Ürün Kodu (Compel)","Stok (Compel)","EAN (Compel)"];
  const clean = U.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
  downloadBlob('eslesmeyenler.csv', new Blob([toCSV(clean, cols)], { type:'text/csv;charset=utf-8' }));
};

$('dl3').onclick = () => {
  map.meta = map.meta || {}; map.meta.updatedAt = nowISO();
  downloadBlob('mapping.json', new Blob([JSON.stringify(map, null, 2)], { type:'application/json;charset=utf-8' }));
};

$('go').onclick = generate;

// Temizle
const resetBtn = $('reset');
if (resetBtn) resetBtn.onclick = () => location.reload();

/* Dosya kutularında isim sabit kalsın; sağ taraf sadece durum göstersin */
function bindFileStatus(inputId, nameId, emptyText) {
  const inp = $(inputId);
  const out = $(nameId);
  if (!inp || !out) return;

  const upd = () => {
    const f = inp.files?.[0];
    if (!f) {
      out.textContent = emptyText;
      out.title = emptyText;
    } else {
      out.textContent = 'Seçildi';
      out.title = f.name;
    }
  };

  inp.addEventListener('change', upd);
  upd();
}

bindFileStatus('f1','n1','Seçilmedi');
bindFileStatus('f2','n2','Seçilmedi');
bindFileStatus('f3','n3','Seçilmedi');
