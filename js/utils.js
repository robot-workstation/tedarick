// js/utils.js
export const TR = 'tr-TR';

export const esc = (s) => (s ?? '').toString()
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");

export const T = (s) => (s ?? '').toString().trim();
export const D = (s) => (s ?? '').toString().replace(/[^\d]/g, '').trim();

export const nowISO = () => new Date().toISOString();

export function detectDelimiter(headerLine) {
  const c = ['\t',';',',','|'];
  let best = c[0], m = -1;
  for (const d of c) {
    const k = headerLine.split(d).length - 1;
    if (k > m) { m = k; best = d; }
  }
  return best;
}

// Quote destekli basit CSV/TSV parser
export function parseDelimited(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  const first = lines.find(x => x.trim()) || '';
  const delim = detectDelimiter(first);

  const split = (line) => {
    const out = [];
    let cur = '', q = false;
    for (let i=0;i<line.length;i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i+1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (!q && ch === delim) {
        out.push(cur); cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map(v => v.trim());
  };

  let hdr = null;
  const rows = [];
  for (const line of lines) {
    if (!line || !line.trim()) continue;
    if (!hdr) { hdr = split(line); continue; }
    const vals = split(line);
    const obj = {};
    for (let i=0;i<hdr.length;i++) obj[hdr[i]] = vals[i] ?? '';
    rows.push(obj);
  }
  return { hdr: hdr || [], rows };
}

export const normHeader = (h) => (h ?? '').toString().trim().toLocaleUpperCase(TR).replace(/\s+/g,' ');

// Row obj içinden istenen kolon adlarını bulur (case/space normalize)
export function pickColumn(rowObj, wantedNames) {
  const map = new Map(Object.keys(rowObj).map(k => [normHeader(k), k]));
  for (const w of wantedNames) {
    const k = map.get(normHeader(w));
    if (k) return k;
  }
  return null;
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function toCSV(rows, cols, delimiter = ',') {
  const q = (v) => {
    v = (v ?? '').toString();
    if (v.includes('"') || v.includes('\n') || v.includes('\r') || v.includes(delimiter)) {
      return '"' + v.replace(/"/g,'""') + '"';
    }
    return v;
  };
  return cols.map(q).join(delimiter) + '\n' +
    rows.map(r => cols.map(c => q(r[c])).join(delimiter)).join('\n');
}

// Static dosyada çalışmak için (module’lerde file:// çalışmaz)
export async function readFileText(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsText(file, 'UTF-8');
  });
}

/**
 * Stok parse:
 * - products tarafında "-" => 0 (stok yok)
 * - compel tarafında "VAR/STOKTA/MEVCUT" gibi metinler => stok var kabul edilir
 * - sayısal değerler her iki tarafta da parse edilir
 */
export function stockToNumber(raw, { source } = {}) {
  const s = (raw ?? '').toString().trim();
  if (!s) return 0;

  // products: "-" => stok yok
  if (source === 'products' && s === '-') return 0;

  const up = s.toLocaleUpperCase(TR);

  // compel: metin bazlı stok ifadeleri
  if (source === 'compel') {
    // açıkça stok yok ifadeleri
    if (/(STOK\s*YOK|YOK|TÜKEND[İI]|TUKENDI|OUT\s*OF\s*STOCK|NONE|N*
