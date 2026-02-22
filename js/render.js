import { esc,stockToNumber } from './utils.js';
import { COLS } from './match.js';
const $=id=>document.getElementById(id);
const colGrp=w=>`<colgroup>${w.map(x=>`<col style="width:${x}%">`).join('')}</colgroup>`;

const HDR1={
  "Sıra No":"Sıra","Marka":"Marka",
  "Ürün Kodu (Compel)":"Compel Ürün Kodu","Ürün Adı (Compel)":"Compel Ürün Adı",
  "Ürün Kodu (T-Soft)":"T-Soft Ürün Kodu","Ürün Adı (T-Soft)":"Tsoft Ürün Adı",
  "Stok (Compel)":"Compel","Stok (Depo)":"Aide","Stok (T-Soft)":"T-Soft","Stok Durumu":"Stok Durumu",
  "EAN (Compel)":"Compel EAN","EAN (T-Soft)":"T-Soft EAN"
};
const disp=c=>HDR1[c]||c;
const fmtHdr=s=>{s=(s??'').toString();const m=s.match(/^(.*?)(\s*\([^)]*\))\s*$/);return m?`<span class="hMain">${esc(m[1].trimEnd())}</span> <span class="hParen">${esc(m[2].trim())}</span>`:esc(s)};

let _css=false;
function css(){
  if(_css)return;_css=true;
  const st=document.createElement('style');
  st.textContent=`
@keyframes namePulse{0%{text-shadow:0 0 0 rgba(134,239,172,0)}55%{text-shadow:0 0 14px rgba(134,239,172,.75)}100%{text-shadow:0 0 0 rgba(134,239,172,0)}}
.namePulse{animation:namePulse 1000ms ease-in-out infinite;will-change:text-shadow}
.tagFlex{display:flex;gap:10px;align-items:center;justify-content:space-between}
.tagLeft{min-width:0;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tagRight{flex:0 0 auto;text-align:right;white-space:nowrap;opacity:.92;font-weight:1100}
.tagLeft .nm,.tagLeft .cellTxt{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sepL{border-left:1px solid rgba(232,60,97,.28)!important;box-shadow:inset 1px 0 0 rgba(0,0,0,.35)}
#listTitle,#unmatchedTitle{font-weight:1300!important;font-size:20px!important;letter-spacing:.02em}
#t1 thead th .hTxt,#t2 thead th .hTxt{display:inline-block;transform-origin:left center}
th.hdrThin{font-weight:700!important}
th.hdrTight .hTxt{letter-spacing:-.02em;font-size:12px}
#t1 thead th,#t2 thead th{position:sticky!important;top:var(--theadTop,0px)!important;z-index:120!important;background:#1b1b1b!important;box-shadow:0 1px 0 rgba(31,36,48,.9)}
.warnHalo{
  text-shadow:
    -0.8px 0 #000,
     0.8px 0 #000,
     0 -0.8px #000,
     0  0.8px #000,
     0 0 2px var(--warn-halo-2, rgba(245,245,245,.20)),
     0 0 10px var(--warn-halo-1, rgba(245,245,245,.38));
}

/* ✅ dar kolonlar: padding kıs + metni KESME/ALT SATIR YAPMA, sığmazsa yatay scroll */
th.tightCol,td.tightCol{padding-left:4px!important;padding-right:4px!important}
td.scrollCell{overflow-x:auto!important;overflow-y:hidden!important;text-overflow:clip!important}
td.scrollCell .cellTxt{display:inline-block;white-space:nowrap}
`;
  document.head.appendChild(st)
}
css();

const cellName=(txt,href,pulse=false)=>{
  const v=(txt??'').toString(),u=href||'',cls=`nm${pulse?' namePulse':''}`;
  return u?`<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(v)}">${esc(v)}</a>`:`<span class="${cls}" title="${esc(v)}">${esc(v)}</span>`
};

let _raf=0,_bound=false;
const sched=()=>{_raf&&cancelAnimationFrame(_raf);_raf=requestAnimationFrame(adjust)};
const firstEl=td=>td?.querySelector('.cellTxt,.nm,input,button,select,div')||null;

function enforceSticky(){
  document.querySelectorAll('.tableWrap').forEach(w=>{w.style.overflow='visible';w.style.overflowX='visible';w.style.overflowY='visible'});
  document.documentElement.style.setProperty('--theadTop','0px')
}
function fitHeader(tableId){
  const t=$(tableId);if(!t)return;
  t.querySelectorAll('thead th').forEach(th=>{
    const sp=th.querySelector('.hTxt');if(!sp)return;
    sp.style.transform='scaleX(1)';
    const avail=Math.max(10,th.clientWidth-2),need=sp.scrollWidth||0,s=need>avail?(avail/need):1;
    sp.style.transform=`scaleX(${s})`
  })
}
function adjust(){
  _raf=0;enforceSticky();fitHeader('t1');fitHeader('t2');
  const nameFit=tableId=>{
    const t=$(tableId);if(!t)return;
    const rows=t.querySelectorAll('tbody tr'),G=6;
    for(const tr of rows){
      const tds=tr.querySelectorAll('td.nameCell');if(!tds.length)continue;
      for(let i=tds.length-1;i>=0;i--){
        const td=tds[i],nm=td.querySelector('.nm');if(!nm)continue;
        const next=td.nextElementSibling,tdR=td.getBoundingClientRect(),nmR=nm.getBoundingClientRect();
        let maxRight=tdR.right-G;
        if(next){
          const el=firstEl(next);
          if(el){const r=el.getBoundingClientRect();maxRight=Math.min(tdR.right+next.getBoundingClientRect().width,r.left-G)}
          else maxRight=next.getBoundingClientRect().right-G
        }
        nm.style.maxWidth=Math.max(40,maxRight-nmR.left)+'px'
      }
    }
  };
  nameFit('t1');nameFit('t2');
  if(!_bound){_bound=true;addEventListener('resize',sched)}
}

const fmtNum=n=>{const x=Number(n);return Number.isFinite(x)?(Math.round(x)===x?String(x):String(x)):'0'};

export function createRenderer({ui}={}){
  return{render(R,Ux,depotReady){
    const T1_SEP_LEFT=new Set(["Stok (Compel)","EAN (Compel)"]);
    const tight=c=>(c==="Ürün Kodu (Compel)"||c==="Ürün Kodu (T-Soft)");

    // ✅ çok dar olsun istenen kolonlar
    const NARROW_SCROLL=new Set(["Sıra No","Marka","Ürün Kodu (Compel)","Ürün Kodu (T-Soft)","EAN (Compel)","EAN (T-Soft)"]);

    // 12 kolon: Sıra, Marka, Kodu, Adı, Kodu, Adı, Stok, Aide, Stok, Durum, EAN, EAN  (toplam 100)
    const W1=[3,6,6,21,6,21,6,6,6,6,6,7];

    const head=COLS.map(c=>{
      const l=disp(c);
      const cls=[
        T1_SEP_LEFT.has(c)?'sepL':'',
        tight(c)?'hdrThin hdrTight':'',
        NARROW_SCROLL.has(c)?'tightCol':''
      ].filter(Boolean).join(' ');
      return `<th class="${cls}" title="${esc(l)}"><span class="hTxt">${fmtHdr(l)}</span></th>`
    }).join('');

    const Rview=(R||[])
      .map((row,idx)=>({row,idx}))
      .sort((a,b)=>{
        const aBad=String(a.row?.["Stok (Compel)"]||'')==='Stokta Yok';
        const bBad=String(b.row?.["Stok (Compel)"]||'')==='Stokta Yok';
        if(aBad!==bBad)return aBad?1:-1;
        return a.idx-b.idx;
      })
      .map(x=>x.row);

    const body=(Rview||[]).map((r,rowIdx)=>`<tr>${COLS.map((c,idx)=>{
      let v=r[c]??'';
      if(c==="Sıra No") v=String(rowIdx+1);

      if(c==="Ürün Adı (Compel)")return `<td class="left nameCell">${cellName(v,r._clink||'')}</td>`;

      if(c==="Ürün Adı (T-Soft)"){
        const hasMatch=!!r?._m,txt=(v??'').toString().trim();
        if(!hasMatch||!txt){
          return `<td class="nameCell" style="text-align:center" title="Eşleştir veya Stok Aç"><span class="nm warnHalo" style="color:var(--warn);font-weight:1200">Eşleştir veya Stok Aç</span></td>`;
        }
        return `<td class="left nameCell">${cellName(txt,r._seo||'')}</td>`;
      }

      const seq=idx===0,sd=c==="Stok Durumu";
      const ean=(c==="EAN (Compel)"||c==="EAN (T-Soft)");
      const eanBad=(c==="EAN (T-Soft)"&&r?._m&&r?._eanBad===true);
      const bad=(sd&&String(v||'')==='Hatalı')||eanBad;

      const cls=[
        T1_SEP_LEFT.has(c)?'sepL':'',
        seq?'seqCell':'',
        sd?'statusBold':'',
        ean?'eanCell':'',
        bad?'flagBad':'',
        NARROW_SCROLL.has(c)?'tightCol scrollCell':''
      ].filter(Boolean).join(' ');

      const title=(c==="Stok (Depo)"&&depotReady)?`${v} (Depo Toplam: ${r._draw??'0'})`:v;
      return `<td class="${cls}" title="${esc(title)}"><span class="cellTxt">${esc(v)}</span></td>`
    }).join('')}</tr>`).join('');

    $('t1').innerHTML=colGrp(W1)+`<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;

    const sec=$('unmatchedSection'),ut=$('unmatchedTitle');
    ut&&(ut.textContent='Compel, T-Soft ve Aide Eşleşmeyen Ürünler Listesi');
    const U=Array.isArray(Ux)?Ux:[];
    if(!U.length){sec&&(sec.style.display='none')}
    else{
      sec&&(sec.style.display='');
      const UCOLS=["Sıra","Marka","Compel Ürün Adı","T-Soft Ürün Adı","Aide Ürün Adı"],W2=[6,12,26,28,28];

      const head2=UCOLS.map(c=>{
        const sep=(c==="T-Soft Ürün Adı"||c==="Aide Ürün Adı")?' sepL':'';
        return `<th class="${sep.trim()}" title="${esc(c)}"><span class="hTxt">${fmtHdr(c)}</span></th>`
      }).join('');

      const body2=U.map((r,i)=>{
        const seq=r["Sıra"]??String(i+1),brand=r["Marka"]??'';
        const cNm=r["Compel Ürün Adı"]??'',cLn=r._clink||'',cPulse=!!r._pulseC;
        const tNm=r["T-Soft Ürün Adı"]??'',tLn=r._seo||'';
        const aNm=r["Aide Ürün Adı"]??r["Depo Ürün Adı"]??'',aPulse=!!r._pulseD;

        const cNum=stockToNumber(r._cstokraw??'',{source:'compel'});
        const cTag=cNm?(cNum<=0?'(Stok Yok)':'(Stok Var)'):'';

        const tAct=r._taktif,tStock=Number(r._tstok??0);
        const tTag=tNm?(tAct===true?`(Aktif: ${fmtNum(tStock)} Stok)`:(tAct===false?'(Pasif)':'')):'';

        const aNum=Number(r._dstok??0);
        const aTag=aNm?(aNum<=0?'(Stok Yok)':`(Stok: ${fmtNum(aNum)})`):'';

        const compel=cNm?`<div class="tagFlex"><span class="tagLeft">${cellName(cNm,cLn,cPulse)}</span><span class="tagRight">${esc(cTag)}</span></div>`:`<span class="cellTxt">—</span>`;
        const tsoft=tNm?`<div class="tagFlex"><span class="tagLeft">${cellName(tNm,tLn,false)}</span><span class="tagRight">${esc(tTag)}</span></div>`:`<span class="cellTxt">—</span>`;
        const aide=aNm?`<div class="tagFlex" title="${esc(aNm)}"><span class="cellTxt tagLeft${aPulse?' namePulse':''}">${esc(aNm)}</span><span class="tagRight">${esc(aTag)}</span></div>`:`<span class="cellTxt">—</span>`;

        return `<tr id="u_${i}"><td class="seqCell" title="${esc(seq)}"><span class="cellTxt">${esc(seq)}</span></td><td title="${esc(brand)}"><span class="cellTxt">${esc(brand)}</span></td><td class="left nameCell">${compel}</td><td class="left nameCell sepL">${tsoft}</td><td class="left sepL">${aide}</td></tr>`
      }).join('');

      $('t2').innerHTML=colGrp(W2)+`<thead><tr>${head2}</tr></thead><tbody>${body2}</tbody>`
    }

    const matched=(R||[]).filter(x=>x._m).length;
    ui?.setChip?.('sum',`✓${matched} • ✕${(R||[]).length-matched}`,'muted');
    const dl1=$('dl1');dl1&&(dl1.disabled=!(R||[]).length);
    enforceSticky();sched()
  }}
}
