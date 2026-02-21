import { TR,T,parseDelimited,pickColumn } from './utils.js';
const $=id=>document.getElementById(id);

export function createDepot({ui,onDepotLoaded,normBrand}={}){
  let L4=[],C4={},idxD=new Map(),depotReady=false;
  let idxBR=new Map(),brandLabelByNorm=new Map();
  let lastRawText='';

  const depoBtn=$('depoBtn'),depoModal=$('depoModal'),depoInner=$('depoInner'),depoPaste=$('depoPaste'),
    depoLoad=$('depoLoad'),depoPasteBtn=$('depoPasteBtn'),depoClose=$('depoClose'),depoClear=$('depoClear'),depoSpin=$('depoSpin'),
    aideSaveLine=$('aideSaveLine'),aideSaveToday=$('aideSaveToday');

  const depotCodeNorm=s=>(s??'').toString().replace(/\u00A0/g,' ').trim().replace(/\s+/g,' ').toLocaleUpperCase(TR);
  const depotCodeAlt=n=>{if(!n||!/^[0-9]+$/.test(n))return '';return n.replace(/^0+(?=\d)/,'')};

  const isBadBrand=raw=>{const s=T(raw);return !s||s==='-'||s==='—'||s.toLocaleUpperCase(TR)==='N/A'};
  const brandNormFn=raw=>{
    const s=T(raw);if(!s||isBadBrand(s))return '';
    return (typeof normBrand==='function'?normBrand(s):s.toLocaleUpperCase(TR).replace(/\s+/g,' ').trim())
  };

  const depotStockNum=raw=>{
    let s=(raw??'').toString().trim();if(!s)return 0;
    if(s.includes('.')&&s.includes(','))s=s.replace(/\./g,'').replace(/,/g,'.'); else s=s.replace(/,/g,'.');
    s=s.replace(/[^0-9.\-]/g,'');const n=parseFloat(s);
    return Number.isFinite(n)?n:0
  };

  const pickAideName=r=>{
    const model=C4.model?T(r[C4.model]??''):'';
    if(model)return model;
    const urunAdi=C4.urunAdi?T(r[C4.urunAdi]??''):'';
    if(urunAdi)return urunAdi;
    const ac=C4.aciklama?T(r[C4.aciklama]??''):'';
    return ac||''
  };

  function buildBrandRecordsIdx(){
    idxBR=new Map();brandLabelByNorm=new Map();
    if(!depotReady||!L4.length||!C4.stokKodu)return;
    const seen=new Map();
    for(const r of L4){
      const brRaw=T(C4.marka?(r[C4.marka]??''):(r["Marka"]??''));
      if(isBadBrand(brRaw))continue;
      const brNorm=brandNormFn(brRaw);if(!brNorm)continue;
      brandLabelByNorm.has(brNorm)||brandLabelByNorm.set(brNorm,brRaw||brNorm);
      const code=depotCodeNorm(r[C4.stokKodu]??'');if(!code)continue;
      const alt=depotCodeAlt(code),name=pickAideName(r);if(!name)continue;
      seen.has(brNorm)||seen.set(brNorm,new Set());
      const s=seen.get(brNorm),k=(code+'||'+name).toLocaleLowerCase(TR).replace(/\s+/g,' ').trim();
      if(k&&s.has(k))continue;k&&s.add(k);
      idxBR.has(brNorm)||idxBR.set(brNorm,[]);
      idxBR.get(brNorm).push({code,alt,name})
    }
    for(const [br,arr] of idxBR.entries())arr.sort((a,b)=>String(a.name).localeCompare(String(b.name),'tr',{sensitivity:'base'}))
  }

  function buildDepotIdx(){
    idxD=new Map();
    if(!depotReady||!L4.length||!C4.stokKodu)return;
    for(const r of L4){
      const k=depotCodeNorm(r[C4.stokKodu]??'');if(!k)continue;
      idxD.has(k)||idxD.set(k,[]);idxD.get(k).push(r);
      const alt=depotCodeAlt(k);
      if(alt&&alt!==k){idxD.has(alt)||idxD.set(alt,[]);idxD.get(alt).push(r)}
    }
    buildBrandRecordsIdx()
  }

  const depotAgg=code=>{
    if(!depotReady)return {num:0,raw:''};
    const k=depotCodeNorm(code||'');if(!k)return {num:0,raw:'0'};
    const alt=depotCodeAlt(k),arr=idxD.get(k)||(alt?idxD.get(alt):null);
    if(!arr?.length)return {num:0,raw:'0'};
    let sum=0;for(const r of arr)sum+=depotStockNum(r[C4.stok]??'');
    return {num:sum,raw:String(sum)}
  };

  function unmatchedRows({brandsNormSet,tsoftSupByBrand}={}){
    if(!depotReady)return [];
    const bnSet=(brandsNormSet instanceof Set)?brandsNormSet:null;
    const out=[],seen=new Set();
    for(const [brNorm,arr] of idxBR.entries()){
      if(bnSet&&!bnSet.has(brNorm))continue;
      const supSet=tsoftSupByBrand?.get?.(brNorm);
      const sset=(supSet instanceof Set)?supSet:null;

      for(const it of arr){
        const hit=sset?(sset.has(it.code)||(it.alt?sset.has(it.alt):false)):false;
        if(hit)continue;
        const nm=it.name||'';if(!nm)continue;
        const k=(brNorm+'||'+nm).toLocaleLowerCase(TR).replace(/\s+/g,' ').trim();
        if(!k||seen.has(k))continue;seen.add(k);
        const ag=depotAgg(it.code);
        out.push({_type:'depo',_bn:brNorm,"Marka":brandLabelByNorm.get(brNorm)||brNorm,"Depo Ürün Adı":nm,_dnum:ag?.num??0})
      }
    }
    out.sort((a,b)=>{
      const ab=String(a["Marka"]||'').localeCompare(String(b["Marka"]||''),'tr',{sensitivity:'base'});
      return ab||String(a["Depo Ürün Adı"]||'').localeCompare(String(b["Depo Ürün Adı"]||''),'tr',{sensitivity:'base'})
    });
    return out
  }

  const syncDepoSpin=()=>{if(!depoSpin)return;depoSpin.style.display=((depoPaste?.value||'').trim().length>0)?'none':'block'};
  const syncAideSaveLine=()=>{
    const has=((depoPaste?.value||'').trim().length>0);
    if(aideSaveLine) aideSaveLine.style.display=has?'':'none';
    if(!has && aideSaveToday && aideSaveToday.checked){
      aideSaveToday.checked=false;
      aideSaveToday.dispatchEvent(new Event('change',{bubbles:true}));
    }
  };

  const setDepoUi=loaded=>{
    const n4=$('n4');if(n4){n4.textContent=loaded?'Yüklendi':'Yükle';n4.title=loaded?`Depo yüklü (${L4.length})`:'Yükle'}
    ui?.setChip?.('l4Chip',loaded?`Aide:${L4.length}`:'Aide:-')
  };

  const placePopover=()=>{
    if(!depoBtn||!depoInner)return;
    depoInner.style.position='fixed';depoInner.style.left='12px';depoInner.style.top='12px';depoInner.style.visibility='hidden';
    requestAnimationFrame(()=>{
      const a=depoBtn.getBoundingClientRect(),r=depoInner.getBoundingClientRect(),root=getComputedStyle(document.documentElement);
      const M=parseFloat(root.getPropertyValue('--popM'))||12,G=parseFloat(root.getPropertyValue('--popGap'))||10;
      let left=a.left;left=Math.max(M,Math.min(left,window.innerWidth-r.width-M));
      let top=a.top-r.height-G;if(top<M)top=a.bottom+G;top=Math.max(M,Math.min(top,window.innerHeight-r.height-M));
      depoInner.style.left=left+'px';depoInner.style.top=top+'px';depoInner.style.visibility='visible'
    })
  };

  const showDepo=()=>{if(!depoModal)return;depoModal.style.display='block';depoModal.setAttribute('aria-hidden','false');placePopover();syncDepoSpin();syncAideSaveLine();setTimeout(()=>depoPaste?.focus(),0)};
  const hideDepo=()=>{if(!depoModal)return;depoModal.style.display='none';depoModal.setAttribute('aria-hidden','true');
    if(depoInner){depoInner.style.position='';depoInner.style.left='';depoInner.style.top='';depoInner.style.visibility=''}
  };

  function depotFromNoisyPaste(text){
    const FirmaDefault="Sescibaba";
    const N=s=>!s||/^(Tümü|Sesçibaba Logo|Şirketler|Siparişler|Onay Bekleyen|Sipariş Listesi|İade Listesi|Sesçibaba Stokları|Stok Listesi|Ara|Previous|Next|E-Commerce Management.*|Showing\b.*|Marka\s+Model\s+Stok\s+Kodu.*|\d+)$/.test(s);
    const out=[],lines=(text||'').split(/\r\n|\r|\n/);
    for(let l of lines){
      l=(l||'').replace(/\u00A0/g," ").trim();
      if(N(l)||!l.includes("\t"))continue;
      const a=l.split("\t").map(x=>x.trim()).filter(Boolean);
      if(a.length<6)continue;
      let m='',mo='',k='',ac='',s='',w='',f=FirmaDefault;
      if(a.length===6){m=a[0];mo=a[1];k=a[2];ac=a[3];s=a[4];w=a[5]}
      else{
        m=a[0];f=a.at(-1)||FirmaDefault;w=a.at(-2)||'';s=a.at(-3)||'';
        const mid=a.slice(1,-3);if(mid.length<3)continue;
        mo=mid.slice(0,-2).join(" ");k=mid.at(-2)||'';ac=mid.at(-1)||''
      }
      const stokStr=String(s??'').trim();
      if(!stokStr||!/^-?\d+(?:[.,]\d+)?$/.test(stokStr))continue;
      out.push({"Marka":m,"Model":mo,"Stok Kodu":k,"Açıklama":ac,"Stok":stokStr,"Ambar":w,"Firma":f})
    }
    return out
  }

  function loadDepotFromText(text){
    const raw=(text??'').toString();if(!raw.trim())return alert('Depo verisi boş.');
    lastRawText=raw;

    let ok=false;
    try{
      const p=parseDelimited(raw),rows=p?.rows||[];
      if(rows.length){
        const sample=rows[0];
        const stokKodu=pickColumn(sample,['Stok Kodu','StokKodu','STOK KODU','Stock Code']);
        const stok=pickColumn(sample,['Stok','Miktar','Qty','Quantity']);
        if(stokKodu&&stok){
          L4=rows;
          C4={stokKodu,stok,
            ambar:pickColumn(sample,['Ambar','Depo','Warehouse']),
            firma:pickColumn(sample,['Firma','Şirket','Company']),
            marka:pickColumn(sample,['Marka','MARKA','Brand','BRAND']),
            model:pickColumn(sample,['Model','MODEL']),
            urunAdi:pickColumn(sample,['Ürün Adı','Urun Adi','Ürün Adi','Product Name','Product']),
            aciklama:pickColumn(sample,['Açıklama','Aciklama','Description'])
          };
          ok=true
        }
      }
    }catch{ok=false}

    if(!ok){
      const r2=depotFromNoisyPaste(raw);
      if(!r2.length)return alert('Depo verisi çözümlenemedi. (Tablolu kopya bekleniyordu.)');
      L4=r2;C4={stokKodu:'Stok Kodu',stok:'Stok',ambar:'Ambar',firma:'Firma',marka:'Marka',model:'Model',aciklama:'Açıklama'};
      ok=true
    }

    depotReady=true;buildDepotIdx();setDepoUi(true);ui?.setStatus?.('Depo yüklendi','ok');onDepotLoaded?.()
  }

  const reset=()=>{
    depotReady=false;L4=[];C4={};idxD=new Map();idxBR=new Map();brandLabelByNorm=new Map();
    lastRawText='';
    depoPaste&&(depoPaste.value='');syncDepoSpin();syncAideSaveLine();setDepoUi(false)
  };

  depoBtn&&(depoBtn.onclick=showDepo);
  depoClose&&(depoClose.onclick=hideDepo);

  depoPasteBtn&&(depoPasteBtn.onclick=async()=>{
    try{
      if(!navigator.clipboard?.readText){alert('Panoya erişilemiyor. Sayfayı HTTPS üzerinden açın ve izin verin.');return}
      depoPasteBtn.disabled=true;
      const txt=await navigator.clipboard.readText();
      if(!txt?.trim()){alert('Panoda yapıştırılacak metin yok.');return}
      depoPaste&&(depoPaste.value=txt);syncDepoSpin();syncAideSaveLine();depoPaste?.focus()
    }catch(e){console.error(e);alert('Pano okunamadı. Tarayıcı izinlerini kontrol edin.')}
    finally{depoPasteBtn&&(depoPasteBtn.disabled=false)}
  });

  if(depoPaste){
    depoPaste.addEventListener('input',()=>{syncDepoSpin();syncAideSaveLine()});
    depoPaste.addEventListener('paste',()=>setTimeout(()=>{syncDepoSpin();syncAideSaveLine()},0))
  }
  depoClear&&(depoClear.onclick=()=>{depoPaste&&(depoPaste.value='');syncDepoSpin();syncAideSaveLine();depoPaste?.focus()});
  depoLoad&&(depoLoad.onclick=()=>{loadDepotFromText(depoPaste?.value||'');hideDepo()});

  addEventListener('keydown',e=>{if(e.key==='Escape'&&depoModal?.style.display!=='none')hideDepo()});
  addEventListener('resize',()=>{depoModal?.style.display==='block'&&placePopover()});
  addEventListener('scroll',()=>{depoModal?.style.display==='block'&&placePopover()},true);

  setDepoUi(false);syncDepoSpin();syncAideSaveLine();

  return{
    reset,
    isReady:()=>depotReady,
    agg:depotAgg,
    count:()=>L4.length,
    unmatchedRows,
    loadText:(text)=>loadDepotFromText(text),
    getLastRaw:()=>lastRawText
  }
}
