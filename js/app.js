import{TR,esc,T,D,nowISO,parseDelimited,pickColumn,downloadBlob,toCSV,readFileText,inStock}from'./utils.js';
const $=id=>document.getElementById(id);

const ALIAS=new Map([['ALLEN & HEATH','ALLEN HEATH'],['MARANTZ PROFESSIONAL','MARANTZ'],['RUPERT NEVE DESIGNS','RUPERT NEVE'],['RØDE','RODE'],['RØDE X','RODE']]);
const bRaw=s=>(s??'').toString().trim().toLocaleUpperCase(TR).replace(/\s+/g,' ');
const B=s=>ALIAS.get(bRaw(s))||bRaw(s),Bx=s=>bRaw(s);

let L1=[],L2=[],L2all=[],map={meta:{version:1,createdAt:nowISO(),updatedAt:nowISO()},mappings:{}};
let C1={},C2={},idxB=new Map(),idxW=new Map(),idxS=new Map(),R=[],U=[];
const COLS=["Sıra No","Marka","Ürün Adı (Compel)","Ürün Adı (Sescibaba)","Ürün Kodu (Compel)","Ürün Kodu (Sescibaba)","Stok (Compel)","Stok (Sescibaba)","Stok Durumu","EAN (Compel)","EAN (Sescibaba)","EAN Durumu"];

const setChip=(id,t,cls='')=>{const e=$(id);if(!e)return;e.textContent=t;e.title=t;e.className='chip'+(cls?` ${cls}`:'')};
const chipVis=(id,v)=>{const e=$(id);if(e)e.style.display=v?'':'none'};
const setStatus=(t,k='ok')=>setChip('stChip',t,k);

const safeUrl=u=>{u=T(u);if(!u||/^\s*javascript:/i.test(u))return'';return u};
const SEO='https://www.sescibaba.com/';
const normSeo=raw=>{let u=T(raw);if(!u||/^\s*javascript:/i.test(u))return'';if(/^https?:\/\//i.test(u))return u;if(/^www\./i.test(u))return'https://'+u;if(/^sescibaba\.com/i.test(u))return'https://'+u;return SEO+u.replace(/^\/+/,'')};

const key=(r,fn)=>{const b=fn(r[C1.marka]||'');const code=T(r[C1.urunKodu]||'');const name=T(r[C1.urunAdi]||'');return b+'||'+(code||('NAME:'+name))};
const kNew=r=>key(r,B),kOld=r=>key(r,Bx);
const eans=v=>{v=(v??'').toString().trim();if(!v)return[];return v.split(/[^0-9]+/g).map(D).filter(x=>x.length>=8)};

const colGrp=w=>`<colgroup>${w.map(x=>`<col style="width:${x}%">`).join('')}</colgroup>`;
const disp=c=>c==="Sıra No"?"Sıra":c;
const fmtHdr=s=>{
  s=(s??'').toString();
  const m=s.match(/^(.*?)(\s*\([^)]*\))\s*$/);
  if(!m)return esc(s);
  return `<span class="hMain">${esc(m[1].trimEnd())}</span> <span class="hParen">${esc(m[2].trim())}</span>`
};

function buildIdx(){
  idxB=new Map();idxW=new Map();idxS=new Map();
  for(const r of L2){
    const bark=D(r[C2.barkod]||''),ws=T(r[C2.ws]||''),sup=T(r[C2.sup]||'');
    if(bark){if(!idxB.has(bark))idxB.set(bark,[]);idxB.get(bark).push(r)}
    if(ws)idxW.set(ws,r);if(sup)idxS.set(sup,r)
  }
  const wsDl=$('wsCodes'),supDl=$('supCodes');wsDl.innerHTML='';supDl.innerHTML='';
  let a=0,b=0,MAX=2e4;
  for(const r of L2){
    const w=T(r[C2.ws]||''),p=T(r[C2.sup]||''),br=T(r[C2.marka]||''),nm=T(r[C2.urunAdi]||'');
    if(w&&a<MAX){const o=document.createElement('option');o.value=w;o.label=(br+' - '+nm).slice(0,140);wsDl.appendChild(o);a++}
    if(p&&b<MAX){const o=document.createElement('option');o.value=p;o.label=(br+' - '+nm).slice(0,140);supDl.appendChild(o);b++}
  }
}

function byEan(r1){
  const br1=B(r1[C1.marka]||'');
  for(const e of eans(r1[C1.ean]||'')){
    const arr=idxB.get(e);
    if(arr?.length)return arr.find(r2=>B(r2[C2.marka]||'')===br1)||arr[0]
  }
  return null
}
function byCompelCodeWs(r1){
  const code=T(r1[C1.urunKodu]||'');if(!code)return null;
  const r2=idxW.get(code)||null;if(!r2)return null;
  const b1=B(r1[C1.marka]||''),b2=B(r2[C2.marka]||'');if(b1&&b2&&b1!==b2)return null;
  return r2
}
function byMap(r1){
  const m=map.mappings||{},ent=m[kNew(r1)]??m[kOld(r1)];
  if(!ent)return null;
  if(typeof ent==='string')return idxW.get(ent)||idxS.get(ent)||null;
  const ws=T(ent.webServisKodu||ent.ws||''),sup=T(ent.tedarikciUrunKodu||ent.supplier||'');
  return(ws&&idxW.get(ws))||(sup&&idxS.get(sup))||null
}

/* ✅ Yeni stok label’ları */
const compelLbl=raw=>{
  const s=(raw??'').toString().trim();
  if(!s)return'';
  return inStock(s,{source:'compel'})?'Compelde Var':'Compelde Yok'
};
const sesciLbl=(raw,ok)=>ok?(inStock(raw,{source:'products'})?'Sescibabada Var':'Sescibabada Yok'):'';

const stokDur=(aRaw,bRaw,ok)=>{if(!ok)return'—';const a=inStock(aRaw,{source:'compel'}),b=inStock(bRaw,{source:'products'});return a===b?'Doğru':'Hatalı'};
const eanDur=(aRaw,bRaw,ok)=>{
  if(!ok)return'—';
  const a=new Set(eans(aRaw||'')),b=eans(bRaw||'');
  if(!a.size||!b.length)return'Eşleşmedi';
  for(const x of b)if(a.has(x))return'Eşleşti';
  return'Eşleşmedi'
};

function outRow(r1,r2,how){
  const s1raw=T(r1[C1.stok]||''),s2raw=r2?T(r2[C2.stok]||''):'';
  const sup=r2?T(r2[C2.sup]||''):'',bark=r2?T(r2[C2.barkod]||''):'';
  const seoAbs=r2?safeUrl(normSeo(r2[C2.seo]||'')):'',clink=safeUrl(r1[C1.link]||'');
  return{
    "Sıra No":T(r1[C1.siraNo]||''),"Marka":T(r1[C1.marka]||''),
    "Ürün Adı (Compel)":T(r1[C1.urunAdi]||''),"Ürün Adı (Sescibaba)":r2?T(r2[C2.urunAdi]||''):'',
    "Ürün Kodu (Compel)":T(r1[C1.urunKodu]||''),"Ürün Kodu (Sescibaba)":sup,

    /* ✅ İstenen metinler */
    "Stok (Compel)":compelLbl(s1raw),
    "Stok (Sescibaba)":sesciLbl(s2raw,!!r2),
    "Stok Durumu":stokDur(s1raw,s2raw,!!r2),

    "EAN (Compel)":T(r1[C1.ean]||''),"EAN (Sescibaba)":bark,"EAN Durumu":eanDur(r1[C1.ean]||'',bark,!!r2),
    _m:!!r2,_how:r2?how:'',_k:kNew(r1),_bn:B(r1[C1.marka]||''),_seo:seoAbs,_clink:clink
  }
}

function runMatch(){
  R=[];U=[];
  for(const r1 of L1){
    let r2=byEan(r1),how=r2?'EAN':'';
    if(!r2){r2=byCompelCodeWs(r1);if(r2)how='KOD'}
    if(!r2){r2=byMap(r1);if(r2)how='JSON'}
    const row=outRow(r1,r2,how);R.push(row);if(!row._m)U.push(row)
  }
  render()
}

const cellName=(txt,href)=>{const v=(txt??'').toString(),u=href||'';return u?`<a class="nm" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(v)}">${esc(v)}</a>`:`<span class="nm" title="${esc(v)}">${esc(v)}</span>`};

let _raf=0,_bound=false;
const sched=()=>{if(_raf)cancelAnimationFrame(_raf);_raf=requestAnimationFrame(adjustLayout)};
const firstEl=td=>td?.querySelector('.cellTxt,.nm,input,button')||null;

/* ✅ Başlıkları tek satır + kesmeden + çakışmadan sığdır */
function fitHeaderText(tableId){
  const t=$(tableId);if(!t)return;
  const ths=t.querySelectorAll('thead th');
  for(const th of ths){
    const sp=th.querySelector('.hTxt');if(!sp)continue;
    sp.style.transform='scaleX(1)';
    const avail=Math.max(10,th.clientWidth-2);
    const need=sp.scrollWidth||0;
    const s=need>avail?(avail/need):1;
    sp.style.transform=`scaleX(${s})`;
  }
}

function adjustLayout(){
  _raf=0;
  fitHeaderText('t1');fitHeaderText('t2');

  const t=$('t1');if(!t)return;
  const rows=t.querySelectorAll('tbody tr'),G=6;
  for(const tr of rows){
    const nameTds=tr.querySelectorAll('td.nameCell');if(!nameTds.length)continue;
    for(let i=nameTds.length-1;i>=0;i--){
      const td=nameTds[i],nm=td.querySelector('.nm');if(!nm)continue;
      const next=td.nextElementSibling;
      const tdR=td.getBoundingClientRect(),nmR=nm.getBoundingClientRect();
      let maxRight=tdR.right-G;
      if(next){
        const el=firstEl(next);
        if(el){const r=el.getBoundingClientRect();maxRight=Math.min(tdR.right+next.getBoundingClientRect().width,r.left-G)}
        else maxRight=next.getBoundingClientRect().right-G
      }
      nm.style.maxWidth=Math.max(40,maxRight-nmR.left)+'px'
    }
  }
  if(!_bound){_bound=true;addEventListener('resize',sched)}
}

function render(){
  const W1=[4,9,15,15,7,7,6,6,6,9,9,7];
  const head=COLS.map(c=>{const l=disp(c);return`<th title="${esc(l)}"><span class="hTxt">${fmtHdr(l)}</span></th>`}).join('');
  const body=R.map(r=>`<tr>${COLS.map((c,idx)=>{
    const v=r[c]??'';
    if(c==="Ürün Adı (Compel)")return`<td class="left nameCell">${cellName(v,r._clink||'')}</td>`;
    if(c==="Ürün Adı (Sescibaba)")return`<td class="left nameCell">${cellName(v,r._seo||'')}</td>`;
    const seq=idx===0,sd=c==="Stok Durumu",ed=c==="EAN Durumu",ean=c==="EAN (Compel)"||c==="EAN (Sescibaba)";
    const cls=[seq?'seqCell':'',sd||ed?'statusBold':'',ean?'eanCell':''].filter(Boolean).join(' ');
    return`<td class="${cls}" title="${esc(v)}"><span class="cellTxt">${esc(v)}</span></td>`
  }).join('')}</tr>`).join('');
  $('t1').innerHTML=colGrp(W1)+`<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;

  const sec=$('unmatchedSection'),btn2=$('dl2');
  if(!U.length){sec.style.display='none';btn2.style.display='none'}else{sec.style.display='';btn2.style.display=''}
  if(U.length){
    const W2=[6,10,28,12,18,10,10,6];
    $('t2').innerHTML=colGrp(W2)+`<thead><tr>
      <th><span class="hTxt">Sıra</span></th><th><span class="hTxt">Marka</span></th><th><span class="hTxt">Ürün Adı</span></th>
      <th><span class="hTxt">Ürün Kodu</span></th><th><span class="hTxt">EAN</span></th><th><span class="hTxt">Web Servis</span></th>
      <th><span class="hTxt">Tedarikçi</span></th><th></th>
    </tr></thead><tbody>`+
      U.map((r,i)=>`<tr id="u_${i}">
        <td class="seqCell" title="${esc(r["Sıra No"])}"><span class="cellTxt">${esc(r["Sıra No"])}</span></td>
        <td title="${esc(r["Marka"])}"><span class="cellTxt">${esc(r["Marka"])}</span></td>
        <td class="left" title="${esc(r["Ürün Adı (Compel)"])}"><span class="cellTxt">${esc(r["Ürün Adı (Compel)"]||'')}</span></td>
        <td title="${esc(r["Ürün Kodu (Compel)"])}"><span class="cellTxt">${esc(r["Ürün Kodu (Compel)"])}</span></td>
        <td class="eanCell" title="${esc(r["EAN (Compel)"])}"><span class="cellTxt">${esc(r["EAN (Compel)"])}</span></td>
        <td><input type="text" list="wsCodes" data-i="${i}" data-f="ws" placeholder="ws"></td>
        <td><input type="text" list="supCodes" data-i="${i}" data-f="sup" placeholder="sup"></td>
        <td><button class="mx" data-i="${i}">Eşleştir</button></td>
      </tr>`).join('')+`</tbody>`;
    $('t2').querySelectorAll('.mx').forEach(b=>b.onclick=()=>manual(+b.dataset.i))
  }

  const matched=R.filter(x=>x._m).length;
  setChip('sum',`Toplam ${R.length} • ✓${matched} • ✕${R.length-matched}`,'muted');
  $('dl1').disabled=!R.length;$('dl3').disabled=false;if(btn2)btn2.disabled=!U.length;

  sched()
}

function manual(i){
  const r=U[i];if(!r)return;
  const tr=$('t2').querySelector('#u_'+i);
  const ws=tr.querySelector('input[data-f="ws"]').value.trim();
  const sup=tr.querySelector('input[data-f="sup"]').value.trim();
  const r2=(ws&&idxW.get(ws))||(sup&&idxS.get(sup))||null;
  if(!r2)return alert('Ürün bulunamadı (marka filtresi sebebiyle de olabilir).');
  const b1=r._bn,b2=B(r2[C2.marka]||'');
  if(b1&&b2&&b1!==b2&&!confirm(`Marka farklı:\n1) ${b1}\n2) ${b2}\nYine de eşleştirilsin mi?`))return;

  map.mappings=map.mappings||{};
  map.mappings[r._k]={webServisKodu:T(r2[C2.ws]||''),tedarikciUrunKodu:T(r2[C2.sup]||''),barkod:T(r2[C2.barkod]||''),updatedAt:nowISO()};
  map.meta=map.meta||{};map.meta.updatedAt=nowISO();

  const idx=R.findIndex(x=>x._k===r._k);
  if(idx>=0){
    const stub={[C1.siraNo]:r["Sıra No"],[C1.marka]:r["Marka"],[C1.urunAdi]:r["Ürün Adı (Compel)"],[C1.urunKodu]:r["Ürün Kodu (Compel)"],[C1.stok]:r["Stok (Compel)"],[C1.ean]:r["EAN (Compel)"],[C1.link]:r._clink||''};
    R[idx]=outRow(stub,r2,'MANUAL');R[idx]._k=r._k;R[idx]._bn=b1
  }
  U.splice(i,1);render()
}

async function generate(){
  const a=$('f1').files[0],b=$('f2').files[0],j=$('f3').files[0];
  if(!a||!b)return alert('Lütfen 1) ve 2) CSV dosyalarını seç.');
  setStatus('Okunuyor…','unk');setChip('l1Chip','L1:—');setChip('l2Chip','L2:—');chipVis('jsonChip',false);
  let jsonLoaded=false;

  try{
    const[t1,t2,t3]=await Promise.all([readFileText(a),readFileText(b),j?readFileText(j):Promise.resolve(null)]);
    if(t3){
      try{
        const p=JSON.parse(t3);
        map=(p?.mappings)?p:{meta:{version:1,createdAt:nowISO(),updatedAt:nowISO()},mappings:(p||{})};
        map.meta=map.meta||{version:1,createdAt:nowISO(),updatedAt:nowISO()};map.meta.updatedAt=nowISO();jsonLoaded=true
      }catch{
        alert('JSON okunamadı, mapping kullanılmadan devam.');
        map={meta:{version:1,createdAt:nowISO(),updatedAt:nowISO()},mappings:{}};jsonLoaded=false
      }
    }else map={meta:{version:1,createdAt:nowISO(),updatedAt:nowISO()},mappings:{}};

    const p1=parseDelimited(t1),p2=parseDelimited(t2);
    if(!p1.rows.length||!p2.rows.length)return alert('CSV boş görünüyor.');
    const s1=p1.rows[0],s2=p2.rows[0];

    C1={siraNo:pickColumn(s1,['Sıra No','Sira No','SIRA NO']),marka:pickColumn(s1,['Marka']),urunAdi:pickColumn(s1,['Ürün Adı','Urun Adi','Ürün Adi']),urunKodu:pickColumn(s1,['Ürün Kodu','Urun Kodu']),stok:pickColumn(s1,['Stok']),ean:pickColumn(s1,['EAN','Ean']),link:pickColumn(s1,['Link','LINK','Ürün Linki','Urun Linki'])};
    C2={ws:pickColumn(s2,['Web Servis Kodu','WebServis Kodu','WebServisKodu']),urunAdi:pickColumn(s2,['Ürün Adı','Urun Adi','Ürün Adi']),sup:pickColumn(s2,['Tedarikçi Ürün Kodu','Tedarikci Urun Kodu','Tedarikçi Urun Kodu']),barkod:pickColumn(s2,['Barkod','BARKOD']),stok:pickColumn(s2,['Stok']),marka:pickColumn(s2,['Marka']),seo:pickColumn(s2,['SEO Link','Seo Link','SEO','Seo'])};

    const need=(o,a)=>a.filter(k=>!o[k]);
    const m1=need(C1,['siraNo','marka','urunAdi','urunKodu','stok','ean','link']),m2=need(C2,['ws','sup','barkod','stok','marka','urunAdi','seo']);
    if(m1.length||m2.length){setStatus('Sütun eksik','bad');console.warn('L1',m1,'L2',m2);return}

    L1=p1.rows;L2all=p2.rows;
    const brands=new Set(L1.map(r=>B(r[C1.marka]||'')).filter(Boolean));
    L2=L2all.filter(r=>brands.has(B(r[C2.marka]||'')));

    buildIdx();runMatch();
    setStatus('Hazır','ok');setChip('l1Chip',`L1:${L1.length}`);setChip('l2Chip',`L2:${L2.length}/${L2all.length}`);

    if(jsonLoaded){const n=Object.keys(map.mappings||{}).length;setChip('jsonChip',`JSON:${n}`,'muted');chipVis('jsonChip',true)}else chipVis('jsonChip',false)
  }catch(e){console.error(e);setStatus('Hata (konsol)','bad')}
}

$('dl1').onclick=()=>{const clean=R.map(r=>Object.fromEntries(COLS.map(c=>[c,r[c]])));downloadBlob('sonuc-eslestirme.csv',new Blob([toCSV(clean,COLS)],{type:'text/csv;charset=utf-8'}))};
$('dl2').onclick=()=>{const cols=["Sıra No","Marka","Ürün Adı (Compel)","Ürün Kodu (Compel)","Stok (Compel)","EAN (Compel)"];const clean=U.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]])));downloadBlob('eslesmeyenler.csv',new Blob([toCSV(clean,cols)],{type:'text/csv;charset=utf-8'}))};
$('dl3').onclick=()=>{map.meta=map.meta||{};map.meta.updatedAt=nowISO();downloadBlob('mapping.json',new Blob([JSON.stringify(map,null,2)],{type:'application/json;charset=utf-8'}))};

$('go').onclick=generate;
$('reset').onclick=()=>location.reload();

/* ✅ Yükleme kutularında “Yükle” yazsın */
const bind=(inId,outId,empty)=>{
  const inp=$(inId),out=$(outId);if(!inp||!out)return;
  const upd=()=>{const f=inp.files?.[0];if(!f){out.textContent=empty;out.title=empty}else{out.textContent='Seçildi';out.title=f.name}};
  inp.addEventListener('change',upd);upd()
};
bind('f1','n1','Yükle');
bind('f2','n2','Yükle');
bind('f4','n4','Yükle'); /* ✅ yeni depo stok (fonksiyonsuz) */
bind('f3','n3','Yükle');
