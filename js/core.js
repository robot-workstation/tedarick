import { TR, T, D } from './utils.js';

export const ALIAS = new Map([
  ['ALLEN & HEATH','ALLEN HEATH'],
  ['MARANTZ PROFESSIONAL','MARANTZ'],
  ['RUPERT NEVE DESIGNS','RUPERT NEVE'],
  ['RØDE','RODE'],
  ['RØDE X','RODE']
]);

export const bRaw = s => (s ?? '').toString().trim().toLocaleUpperCase(TR).replace(/\s+/g, ' ');
export const B = s => ALIAS.get(bRaw(s)) || bRaw(s);
export const Bx = s => bRaw(s);

export const eans = v => {
  v = (v ?? '').toString().trim();
  if (!v) return [];
  return v.split(/[^0-9]+/g).map(D).filter(x => x.length >= 8);
};

export const safeUrl = u => {
  u = T(u);
  if (!u || /^\s*javascript:/i.test(u)) return '';
  return u;
};

export const SEO = 'https://www.sescibaba.com/';
export const normSeo = raw => {
  let u = T(raw);
  if (!u || /^\s*javascript:/i.test(u)) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^www\./i.test(u)) return 'https://' + u;
  if (/^sescibaba\.com/i.test(u)) return 'https://' + u;
  return SEO + u.replace(/^\/+/, '');
};

export const makeKey = (r, fn, C1) => {
  const b = fn(r[C1.marka] || '');
  const code = T(r[C1.urunKodu] || '');
  const name = T(r[C1.urunAdi] || '');
  return b + '||' + (code || ('NAME:' + name));
};

export const kNew = (r, C1) => makeKey(r, B, C1);
export const kOld = (r, C1) => makeKey(r, Bx, C1);
