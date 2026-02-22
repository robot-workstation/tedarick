import { TR,esc,parseDelimited,pickColumn,downloadBlob,toCSV,readFileText,T,stockToNumber } from './utils.js';
import { loadBrands,scanCompel,dailyMeta,dailyGet,dailySave } from './api.js';
import { createMatcher,normBrand,COLS } from './match.js';
import { createDepot } from './depot.js';
import { createRenderer } from './render.js';

const $=id=>document.getElementById(id);
const API_BASE="https://robot-workstation.tvkapora.workers.dev";
const SUPPLIERS={COMPEL:'Compel',AKALIN:'Akalın'};
let ACTIVE_SUPPLIER=SUPPLIERS.COMPEL,COMPEL_BRANDS_CACHE=null;
let COMPEL_BRANDS_NORM=new Set();

const AKALIN_BRAND_NAMES=[/* (liste aynı) */"Acoustic Energy","AIAIAI","AMS-Neve","Antelope Audio","Apple","ART","Artiphon","Artnovion","Asparion","ATC-Loudspeakers","Audient","Audio-Technica","Audix","Auratone","Avid","Barefoot","Bricasti-Design","Celemony","Centrance","CME","Dangerous-Music","DD-HiFi","Digital-Audio-Denmark","Dj-techtools","Direct-Sound","Doto-Design","Drawmer","DreamWave","Earthworks-Audio","Elektron-Music-Machines","Elysia","Embodme","Empirical-Labs","Erica-Synths","ESI-Audio","Eve-Audio","Eventide-Audio","Fatman-by-TL-Audio","Flock-Audio","Focusrite","Freqport","Gainlab-Audio","Gator-Frameworks","Grace-Design","Hifiman","Hori","Icon-Pro-Audio","IK-Multimedia","IsoAcoustics","Konig-Meyer","Koss","Lake-People","Lynx-Studio-Technology","M-Live","Magma","Manley-Laboratories","Melbourne-Instruments","Microtech-Gefell","Midiplus","Millennia-Music-Media","Modal-Electronics","Mogami","Mojave-Audio","Monster-Audio","Monster-Cable","Moondrop","MOTU","MXL-Microphones","Mytek-Audio","Native-Instruments","Neo-Created-by-OYAIDE-Elec","Neumann","Neutrik","Noble-Audio","Odisei-Music","Phase","Polyend","Primacoustic","ProCab","PSI-Audio","Radial-Engineering","Relacart","Reloop","Reloop-HiFi","Rhodes","Royer-Labs","Sendy-Audio","Signex","Sivga-Audio","Slate-Digital","Smithson-Martin","Soma-Synths","Sonnet","Specialwaves","Spectrasonics","Steven-Slate-Audio","Studiologic-by-Fatar","Synchro-Arts","Tantrum-Audio","Teenage-Engineering","Telefunken-Elektroakustik","Thermionic-Culture","Topping-Audio","Topping-Professional","Triton-Audio","Truthear","Tube-Tech","Udo-Audio","Ultimate-Support","Waldorf","Waves"];

/* guided pulse */
let guideStep='brand';
const GUIDE_DUR={brand:1500,tsoft:1250,aide:1050,list:900};
const clearGuidePulse=()=>['brandHintBtn','sescBox','depoBtn','go','tsoftDailyBtn','aideDailyBtn'].forEach(id=>{
  const el=$(id);el&&(el.classList.remove('guidePulse'),el.style.removeProperty('--guideDur'))
});
const setGuideStep=s=>(guideStep=s||'done',updateGuideUI());
const updateGuideUI=()=>{
  clearGuidePulse();
  if(ACTIVE_SUPPLIER===SUPPLIERS.AKALIN||guideStep==='done')return;
  const dur=GUIDE_DUR[guideStep]||1200;
  const apply=el=>el&&(el.style.setProperty('--guideDur',`${dur}ms`),el.classList.add('guidePulse'));

  if(guideStep==='brand') apply($('brandHintBtn'));
  else if(guideStep==='tsoft') apply($('sescBox'));
  else if(guideStep==='aide') apply($('depoBtn'));
  else if(guideStep==='list') apply($('go'));
};

/* ui */
const setChip=(id,t,cls='')=>{const e=$(id);if(!e)return;const txt=String(t??'');e.textContent=txt;e.title=txt;e.className='chip'+(cls?` ${cls}`:'')};
const setStatus=(t,k='ok')=>{
  const st=$('stChip');if(!st)return;
  const msg=String(t??'').trim();
  if(!msg||msg.toLocaleLowerCase(TR)==='hazır'){st.style.display='none';st.textContent='';st.title='';st.className='chip ok';return}
  st.style.display='';setChip('stChip',msg,k)
};
const ui={setChip,setStatus};
const INFO_HIDE_IDS=['brandStatus','l1Chip','l2Chip','l4Chip','sum'];

/* ✅ daily state */
let DAILY_META=null;

/**
 * Seçimler date (ymd)
 */
let DAILY_SELECTED={tsoft:'',aide:''};

let DAILY_READ_CACHE={date:'',pass:''};
let DAILY_SAVE_CRED=null;
const setBtnSel=(btn,sel)=>{if(!btn)return;sel?btn.classList.add('sel'):btn.classList.remove('sel')};

/* brands */
let BRANDS=[],SELECTED=new Set(),brandPrefix='Hazır';
let TSOFT_OK_SUP_BY_BRAND=new Map();

const codeNorm=s=>(s??'').toString().replace(/\u00A0/g,' ').trim().replace(/\s+/g,' ').toLocaleUpperCase(TR);
const codeAlt=n=>{const k=codeNorm(n);if(!k||!/^[0-9]+$/.test(k))return '';return k.replace(/^0+(?=\d)/,'')};

const updateBrandChip=()=>{
  const el=$('brandStatus');if(!el||ACTIVE_SUPPLIER===SUPPLIERS.AKALIN)return;
  const total=BRANDS?.length??0,sel=SELECTED?.size??0;
  el.textContent=`${brandPrefix} • Marka: ${total}/${sel}`;el.title=el.textContent
};

/* list title */
let listTitleEl=null,listSepEl=null,lastListedTitle='',hasEverListed=false;
const joinTrList=arr=>{const a=(arr||[]).filter(Boolean);if(!a.length)return '';if(a.length===1)return a[0];if(a.length===2)return `${a[0]} ve ${a[1]}`;return `${a.slice(0,-1).join(', ')} ve ${a[a.length-1]}`};
const getSupplierName=()=>{const t=(($('supplierLabel')?.textContent||$('supplierBtn')?.textContent)||'').trim();const m=t.match(/:\s*(.+)\s*$/);return (m?(m[1]||''):t.replace(/^1\)\s*/i,'').replace(/^Tedarikçi\s*/i,'')).trim()||'—'};
const getSelectedBrandNames=()=>{const out=[];for(const id of SELECTED){const b=BRANDS.find(x=>x.id===id);b?.name&&out.push(String(b.name))}out.sort((a,b)=>a.localeCompare(b,'tr',{sensitivity:'base'}));return out};
const buildListTitle=()=>{const sup=getSupplierName(),brands=getSelectedBrandNames();if(!brands.length)return `Tedarikçi ${sup} için marka seçilmedi.`;const brTxt=joinTrList(brands);return `Tedarikçi ${sup} için ${brTxt} ${(brands.length===1?'markasında':'markalarında')} yapılan T-Soft ve Aide karşılaştırma listesi`};
const ensureListHeader=()=>{
  const main=document.querySelector('section.maincol');if(!main||listTitleEl)return;
  const sep=document.createElement('div');sep.className='rowSep';sep.setAttribute('aria-hidden','true');
  listTitleEl=document.createElement('div');listTitleEl.id='listTitle';listTitleEl.className='listTitleBar';
  const first=main.firstElementChild;main.insertBefore(sep,first);main.insertBefore(listTitleEl,first);
  listSepEl=sep;listTitleEl.style.display='none';listSepEl.style.display='none'
};
const setListTitleVisible=show=>{ensureListHeader();listTitleEl&&(listTitleEl.style.display=show?'':'none');listSepEl&&(listSepEl.style.display=show?'':'none')};
const lockListTitleFromCurrentSelection=()=>{ensureListHeader();lastListedTitle=buildListTitle();listTitleEl&&(listTitleEl.textContent=lastListedTitle)};

/* go + supplier ui */
let goMode='list';
const setGoMode=mode=>{goMode=mode;const b=$('go');if(!b)return;b.textContent=(mode==='clear'?'Temizle':'Listele');b.title=b.textContent};
const clearOnlyLists=()=>{
  const t1=$('t1'),t2=$('t2');t1&&(t1.innerHTML='');t2&&(t2.innerHTML='');
  const sec=$('unmatchedSection');sec&&(sec.style.display='none');
  setListTitleVisible(false);
  const dl1=$('dl1');dl1&&(dl1.disabled=true);
  setChip('sum','✓0 • ✕0','muted')
};
const applySupplierUi=()=>{
  const go=$('go');if(go){
    ACTIVE_SUPPLIER===SUPPLIERS.AKALIN?(go.classList.add('wip'),go.title='Yapım Aşamasında'):(go.classList.remove('wip'),go.title='Listele')
  }
  if(ACTIVE_SUPPLIER===SUPPLIERS.AKALIN){
    INFO_HIDE_IDS.forEach(id=>{const el=$(id);el&&(el.style.display='none')});
    setStatus('Tedarikçi Akalın entegre edilmedi. Lütfen farklı bir tedarikçi seçin.','bad')
  }else{
    INFO_HIDE_IDS.forEach(id=>{const el=$(id);el&&(el.style.display='')});
    setStatus('Hazır','ok');updateBrandChip()
  }
  updateGuideUI()
};

/* ✅ META'DAN SAAT ÇEKME (Aide/Tsoft için) */
function pickHMFrom(obj){
  if(!obj) return '';
  const direct = String(obj.hm||obj.HM||obj.time||obj.saat||obj.hour||obj.hhmm||'').trim();
  if(direct) return direct;

  const iso = String(obj.iso||obj.ISO||obj.createdAt||obj.updatedAt||obj.at||obj.ts||obj.timestamp||'').trim();
  if(iso){
    const m = iso.match(/T(\d{2}:\d{2})/);
    if(m) return m[1];
    const m2 = iso.match(/\b(\d{2}:\d{2})\b/);
    if(m2) return m2[1];
  }
  return '';
}

/* ✅ ymd/dmy çekmek için ufak yardımcı */
function pickDateFrom(obj){
  if(!obj) return { ymd:'', dmy:'' };
  const ymd = String(obj.ymd || obj.YMD || obj.date || obj.day || obj.gun || '').trim();
  const dmy = String(obj.dmy || obj.DMY || obj.dateText || obj.display || obj.tarih || '').trim();
  return { ymd, dmy };
}

/* ✅ Aide için: bugün varsa "Bugün HH:MM Tarihli Veri", yoksa dünkü "<tarih> Tarihli Veri" */
function getAideDailyPick(){
  const todayAide =
    DAILY_META?.today?.aide ||
    DAILY_META?.aide?.today ||
    DAILY_META?.todayAide ||
    DAILY_META?.aideToday ||
    null;

  const yesterdayAide =
    DAILY_META?.yesterday?.aide ||
    DAILY_META?.aide?.yesterday ||
    DAILY_META?.yesterdayAide ||
    DAILY_META?.aideYesterday ||
    null;

  const todayExists = !!(todayAide?.exists || DAILY_META?.today?.aideExists || DAILY_META?.today?.aide?.exists);
  const yestExists  = !!(yesterdayAide?.exists || DAILY_META?.yesterday?.aideExists || DAILY_META?.yesterday?.aide?.exists);

  const todayDate = pickDateFrom(DAILY_META?.today);
  const yestDate  = pickDateFrom(DAILY_META?.yesterday);

  if(todayExists){
    const hm = pickHMFrom(todayAide) || pickHMFrom(DAILY_META?.today) || '';
    return { exists:true, isToday:true, ymd:todayDate.ymd, dmy:todayDate.dmy, hm };
  }
  if(yestExists){
    return { exists:true, isToday:false, ymd:yestDate.ymd, dmy:yestDate.dmy, hm:'' };
  }
  return { exists:false, isToday:false, ymd:'', dmy:'', hm:'' };
}

/* ✅ T-Soft için: Aide ile aynı mantık */
function getTsoftDailyPick(){
  const todayTsoft =
    DAILY_META?.today?.tsoft ||
    DAILY_META?.tsoft?.today ||
    DAILY_META?.todayTsoft ||
    DAILY_META?.tsoftToday ||
    null;

  const yesterdayTsoft =
    DAILY_META?.yesterday?.tsoft ||
    DAILY_META?.tsoft?.yesterday ||
    DAILY_META?.yesterdayTsoft ||
    DAILY_META?.tsoftYesterday ||
    null;

  const todayExists = !!(todayTsoft?.exists || DAILY_META?.today?.tsoftExists || DAILY_META?.today?.tsoft?.exists);
  const yestExists  = !!(yesterdayTsoft?.exists || DAILY_META?.yesterday?.tsoftExists || DAILY_META?.yesterday?.tsoft?.exists);

  const todayDate = pickDateFrom(DAILY_META?.today);
  const yestDate  = pickDateFrom(DAILY_META?.yesterday);

  if(todayExists){
    const hm = pickHMFrom(todayTsoft) || pickHMFrom(DAILY_META?.today) || '';
    return { exists:true, isToday:true, ymd:todayDate.ymd, dmy:todayDate.dmy, hm };
  }
  if(yestExists){
    return { exists:true, isToday:false, ymd:yestDate.ymd, dmy:yestDate.dmy, hm:'' };
  }
  return { exists:false, isToday:false, ymd:'', dmy:'', hm:'' };
}

/* ✅ BUTON METİNLERİ:
   - Eski veri: "<tarih> Tarihli Veri"
   - Aynı gün: "Bugün <saat> Tarihli Veri"
*/
function paintDailyUI(){
  const tBtn=$('tsoftDailyBtn'),aBtn=$('aideDailyBtn');
  const tPrev=$('tsoftPrev'),aPrev=$('aidePrev');

  // ✅ T-Soft pick artık today varsa today, yoksa yesterday
  const tPick = getTsoftDailyPick();
  const tLabel = tPick.exists
    ? (tPick.isToday
        ? (tPick.hm ? `Bugün ${tPick.hm} Tarihli Veri` : 'Bugün — Tarihli Veri')
        : (tPick.dmy ? `${tPick.dmy} Tarihli Veri` : '—'))
    : '—';
  const tSel = !!(tPick.ymd && DAILY_SELECTED.tsoft && DAILY_SELECTED.tsoft===tPick.ymd);

  if(tBtn){
    tBtn.disabled=!tPick.exists;
    tBtn.title=tPick.exists?tLabel:'—';
    tBtn.textContent=tSel?'Seçildi':tLabel;
    setBtnSel(tBtn,tSel);
  }

  // ✅ Aide pick (mevcut)
  const aidePick = getAideDailyPick();
  const aLabel = aidePick.exists
    ? (aidePick.isToday
        ? (aidePick.hm ? `Bugün ${aidePick.hm} Tarihli Veri` : 'Bugün — Tarihli Veri')
        : (aidePick.dmy ? `${aidePick.dmy} Tarihli Veri` : '—'))
    : '—';
  const aSel = !!(aidePick.ymd && DAILY_SELECTED.aide && DAILY_SELECTED.aide===aidePick.ymd);

  if(aBtn){
    aBtn.disabled=!aidePick.exists;
    aBtn.title=aidePick.exists?aLabel:'—';
    aBtn.textContent=aSel?'Seçildi':aLabel;
    setBtnSel(aBtn,aSel);
  }

  // pill gizli
  if(tPrev){tPrev.style.display='none';tPrev.textContent='';tPrev.title=''}
  if(aPrev){aPrev.style.display='none';aPrev.textContent='';aPrev.title=''}
}

async function refreshDailyMeta(){
  try{ DAILY_META=await dailyMeta(API_BASE); }
  catch(e){ console.warn('daily meta fail',e); DAILY_META=null; }
  paintDailyUI();
}

function closeModalByButton(btnId){
  const b=$(btnId);
  b && b.click();
}

function toggleDaily(kind){
  if(kind==='tsoft'){
    const pick = getTsoftDailyPick();
    if(!pick?.exists || !pick?.ymd){ return; }

    const was = (DAILY_SELECTED.tsoft===pick.ymd);
    DAILY_SELECTED.tsoft = was ? '' : pick.ymd;
    paintDailyUI();

    if(!was){
      closeModalByButton('tsoftDismiss');
      if(!hasEverListed && SELECTED.size>0) setGuideStep('aide');
    }else{
      if(!hasEverListed && SELECTED.size>0) setGuideStep('tsoft');
    }
  }else if(kind==='aide'){
    const pick = getAideDailyPick();
    if(!pick?.exists || !pick?.ymd){ return; }

    const was = (DAILY_SELECTED.aide===pick.ymd);
    DAILY_SELECTED.aide = was ? '' : pick.ymd;
    paintDailyUI();

    if(!was){
      closeModalByButton('depoClose');
      if(!hasEverListed && SELECTED.size>0) setGuideStep('list');
    }else{
      if(!hasEverListed && SELECTED.size>0) setGuideStep('aide');
    }
  }
}

/* ✅ one-time save creds */
function ensureSaveCredOrCancel(){
  if(DAILY_SAVE_CRED?.adminPassword && DAILY_SAVE_CRED?.readPassword) return true;
  const admin=prompt('Yetkili Şifre:');
  if(!admin) return false;
  const read=prompt('Bugün için okuma şifresi:');
  if(!read?.trim()) return false;
  DAILY_SAVE_CRED={adminPassword:String(admin).trim(),readPassword:String(read).trim()};
  return true;
}

/* ✅ one-time read pass cache */
async function getReadPassOrPrompt(dateYmd){
  const ymd=String(dateYmd||'').trim();
  if(!ymd) throw new Error('Tarih bulunamadı');
  if(DAILY_READ_CACHE.pass && DAILY_READ_CACHE.date===ymd) return DAILY_READ_CACHE.pass;
  const p=prompt('Seçilen günün verisini kullanmak için okuma şifresi:')||'';
  if(!p.trim()) throw new Error('Şifre girilmedi');
  return p.trim();
}

/* ✅ T-Soft popover */
(()=>{const box=$('sescBox'),inp=$('f2'),modal=$('tsoftModal'),inner=$('tsoftInner'),pick=$('tsoftClose'),dismiss=$('tsoftDismiss');
  if(!box||!inp||!modal||!inner||!pick||!dismiss)return;
  let allow=false;const isOpen=()=>modal.style.display==='block';
  const place=()=>{
    inner.style.position='fixed';inner.style.left='12px';inner.style.top='12px';inner.style.visibility='hidden';
    requestAnimationFrame(()=>{
      const a=box.getBoundingClientRect(),r=inner.getBoundingClientRect(),root=getComputedStyle(document.documentElement);
      const M=parseFloat(root.getPropertyValue('--popM'))||12,G=parseFloat(root.getPropertyValue('--popGap'))||10;
      let left=a.left;left=Math.max(M,Math.min(left,window.innerWidth-r.width-M));
      let top=a.top-r.height-G;if(top<M)top=a.bottom+G;top=Math.max(M,Math.min(top,window.innerHeight-r.height-M));
      inner.style.left=left+'px';inner.style.top=top+'px';inner.style.visibility='visible'
    })
  };
  const show=()=>{modal.style.display='block';modal.setAttribute('aria-hidden','false');place();setTimeout(()=>pick.focus(),0)};
  const hide=()=>{modal.style.display='none';modal.setAttribute('aria-hidden','true');inner.style.position='';inner.style.left='';inner.style.top='';inner.style.visibility=''};
  const openPicker=()=>{allow=true;hide();requestAnimationFrame(()=>{try{inp.click()}finally{setTimeout(()=>{allow=false},0)}})};
  box.addEventListener('click',e=>{if(inp.disabled)return;if(allow){allow=false;return}e.preventDefault();e.stopPropagation();show()},true);
  pick.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openPicker()});
  dismiss.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();hide()});
  addEventListener('keydown',e=>{if(e.key!=='Escape'||!isOpen())return;e.preventDefault();e.stopPropagation();openPicker()});
  addEventListener('resize',()=>isOpen()&&place());addEventListener('scroll',()=>isOpen()&&place(),true);

  const cb=$('tsoftSaveToday');
  cb&&cb.addEventListener('change',()=>{
    if(cb.checked){
      if(!ensureSaveCredOrCancel()) cb.checked=false;
    }
  });
})();

/* supplier dropdown */
(()=>{const wrap=$('supplierWrap'),btn=$('supplierBtn'),menu=$('supplierMenu'),addBtn=$('supplierAddBtn'),itC=$('supplierCompelItem'),itA=$('supplierAkalinItem');
  if(!wrap||!btn||!menu||!itC||!itA)return;
  const open=()=>{menu.classList.add('show');menu.setAttribute('aria-hidden','false');btn.setAttribute('aria-expanded','true')};
  const close=()=>{menu.classList.remove('show');menu.setAttribute('aria-hidden','true');btn.setAttribute('aria-expanded','false')};
  const toggle=()=>menu.classList.contains('show')?close():open();
  const paint=()=>{const mk=(el,name)=>{const sel=(ACTIVE_SUPPLIER===name);el.setAttribute('aria-disabled',sel?'true':'false');el.textContent=sel?`${name} (seçili)`:name};mk(itC,SUPPLIERS.COMPEL);mk(itA,SUPPLIERS.AKALIN)};
  const setSupplier=async name=>{
    if(!name||name===ACTIVE_SUPPLIER){close();return}
    ACTIVE_SUPPLIER=name;
    const lab=$('supplierLabel');lab&&(lab.textContent=`1) Tedarikçi: ${name}`);
    if(name===SUPPLIERS.AKALIN){
      brandPrefix='Akalın';
      BRANDS=AKALIN_BRAND_NAMES.map((nm,i)=>({id:i+1,slug:String(nm).toLocaleLowerCase(TR).replace(/\s+/g,'-'),name:nm,count:'—'}))
    }else{
      brandPrefix='Hazır';
      if(COMPEL_BRANDS_CACHE?.length)BRANDS=COMPEL_BRANDS_CACHE; else await initBrands()
    }
    resetAll();paint();close()
  };
  btn.addEventListener('click',e=>{e.preventDefault();paint();toggle()});
  itC.addEventListener('click',e=>{e.preventDefault();if(itC.getAttribute('aria-disabled')==='true')return;void setSupplier(SUPPLIERS.COMPEL)});
  itA.addEventListener('click',e=>{e.preventDefault();if(itA.getAttribute('aria-disabled')==='true')return;void setSupplier(SUPPLIERS.AKALIN)});
  addBtn?.addEventListener('click',e=>{e.preventDefault();close()});
  document.addEventListener('click',e=>!wrap.contains(e.target)&&close());
  addEventListener('keydown',e=>e.key==='Escape'&&close());
  paint();
})();

/* brand UI */
const renderBrands=()=>{
  const list=$('brandList');if(!list)return;list.innerHTML='';
  [...BRANDS].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr',{sensitivity:'base'})).forEach(b=>{
    const d=document.createElement('div');
    d.className='brand'+(SELECTED.has(b.id)?' sel':'');d.tabIndex=0;d.dataset.id=String(b.id);
    d.innerHTML=`<div class="bRow"><span class="bNm" title="${esc(b.name)}">${esc(b.name)}</span><span class="bCt">(${esc(b.count)})</span></div>`;
    list.appendChild(d)
  });
  updateBrandChip();
  if(!hasEverListed)setGuideStep(SELECTED.size>0?'tsoft':'brand');
  applySupplierUi()
};
const toggleBrand=(id,el)=>{
  SELECTED.has(id)?(SELECTED.delete(id),el.classList.remove('sel')):(SELECTED.add(id),el.classList.add('sel'));
  updateBrandChip();
  if(!hasEverListed)setGuideStep(SELECTED.size>0?'tsoft':'brand');
  applySupplierUi()
};
$('brandList')?.addEventListener('click',e=>{const el=e.target.closest('.brand');if(!el)return;const id=Number(el.dataset.id);Number.isFinite(id)&&toggleBrand(id,el)});
$('brandList')?.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const el=e.target.closest('.brand');if(!el)return;e.preventDefault();const id=Number(el.dataset.id);Number.isFinite(id)&&toggleBrand(id,el)});
const pulseBrands=()=>{const list=$('brandList');if(!list)return;list.classList.remove('glow');void list.offsetWidth;list.classList.add('glow');setTimeout(()=>list.classList.remove('glow'),950)};
$('brandHintBtn')?.addEventListener('click',pulseBrands);

async function initBrands(){
  brandPrefix='Hazır';
  const el=$('brandStatus');el&&(el.textContent='Markalar yükleniyor…',el.title=el.textContent);
  try{
    const data=await loadBrands(API_BASE);
    COMPEL_BRANDS_CACHE=data;
    if(ACTIVE_SUPPLIER===SUPPLIERS.COMPEL)BRANDS=data
  }catch(e){
    console.error(e);
    if(ACTIVE_SUPPLIER===SUPPLIERS.COMPEL){const el2=$('brandStatus');el2&&(el2.textContent='Markalar yüklenemedi (API).',el2.title=el2.textContent)}
  }finally{renderBrands();applySupplierUi()}
}

/* daily buttons */
$('tsoftDailyBtn')?.addEventListener('click',e=>{e.preventDefault();toggleDaily('tsoft')});
$('aideDailyBtn')?.addEventListener('click',e=>{e.preventDefault();toggleDaily('aide')});

/* depot + matcher + renderer */
const depot=createDepot({
  ui,normBrand,
  onDepotLoaded:async()=>{
    DAILY_SELECTED.aide='';paintDailyUI();

    matcher.hasData()&&(matcher.runMatch(),refresh());
    (!hasEverListed&&guideStep==='aide'&&depot.isReady())&&setGuideStep('list');
    applySupplierUi();

    try{
      const cb=$('aideSaveToday');
      if(cb?.checked){
        if(!ensureSaveCredOrCancel()){ cb.checked=false; return; }
        const raw=depot.getLastRaw()||'';
        if(raw.trim()){
          setStatus('Aide kaydediliyor…','unk');
          await dailySave(API_BASE,{kind:'aide',adminPassword:DAILY_SAVE_CRED.adminPassword,readPassword:DAILY_SAVE_CRED.readPassword,data:raw});
          setStatus('Aide kaydedildi','ok');
          cb.checked=false;
          await refreshDailyMeta();
        }
      }
    }catch(err){
      console.error(err);
      setStatus(String(err?.message||err),'bad');
      alert(String(err?.message||err));
    }
  }
});
const matcher=createMatcher({getDepotAgg:()=>depot.agg,isDepotReady:()=>depot.isReady()});
const renderer=createRenderer({ui});

function rebuildTsoftOkSupByBrand(){
  TSOFT_OK_SUP_BY_BRAND=new Map();
  const {R}=matcher.getResults();
  for(const row of (R||[])){
    if(!row?._m)continue;
    if(row._how!=='EAN'&&row._how!=='KOD')continue;
    const br=row._bn||normBrand(row["Marka"]||''),sup=T(row["Ürün Kodu (T-Soft)"]||''); if(!br||!sup)continue;
    TSOFT_OK_SUP_BY_BRAND.has(br)||TSOFT_OK_SUP_BY_BRAND.set(br,new Set());
    const set=TSOFT_OK_SUP_BY_BRAND.get(br),k=codeNorm(sup),a=codeAlt(k);
    k&&set.add(k);a&&a!==k&&set.add(a)
  }
}

function buildUnifiedUnmatched({Uc,Ut,Ud}){
  const g=new Map();
  const getGrp=(brNorm,brandDisp)=>{
    const k=String(brNorm||'').trim();if(!k)return null;
    g.has(k)||g.set(k,{brNorm:k,brandDisp:brandDisp||k,c:[],t:[],d:[]});
    const grp=g.get(k);
    if(brandDisp&&(!grp.brandDisp||grp.brandDisp===grp.brNorm))grp.brandDisp=brandDisp;
    return grp
  };

  for(const r of (Uc||[])){
    const bDisp=String(r["Marka"]||'').trim(),bNorm=normBrand(bDisp||r._bn||'');
    const grp=getGrp(bNorm,bDisp);if(!grp)continue;
    const nm=String(r["Ürün Adı (Compel)"]||'').trim();if(!nm)continue;
    grp.c.push({name:nm,link:r._clink||'',stokRaw:r._s1raw??''})
  }

  for(const r of (Ut||[])){
    const bDisp=String(r["Marka"]||'').trim(),bNorm=normBrand(r._bn||bDisp||'');
    const grp=getGrp(bNorm,bDisp);if(!grp)continue;
    const nm=String(r["T-Soft Ürün Adı"]||'').trim();if(!nm)continue;
    const stokRaw=String(r._stokraw??'').trim(),stokNum=stockToNumber(stokRaw,{source:'products'});
    grp.t.push({name:nm,link:r._seo||'',aktif:(r._aktif===true?true:(r._aktif===false?false:null)),stokNum})
  }

  for(const r of (Ud||[])){
    const bDisp=String(r["Marka"]||'').trim(),bNorm=normBrand(r._bn||bDisp||'');
    const grp=getGrp(bNorm,bDisp);if(!grp)continue;
    const nm=String(r["Depo Ürün Adı"]||'').trim();if(!nm)continue;
    grp.d.push({name:nm,num:Number(r._dnum??0)})
  }

  const brandArr=[...g.values()].sort((a,b)=>String(a.brandDisp||'').localeCompare(String(b.brandDisp||''),'tr',{sensitivity:'base'}));
  const wC=it=>stockToNumber(it?.stokRaw??'',{source:'compel'})<=0?1:0;
  const wD=it=>Number(it?.num??0)<=0?1:0;
  const wT=it=>it?.aktif===false?2:(it?.aktif===true?0:1);

  for(const grp of brandArr){
    grp.c.sort((a,b)=>(wC(a)-wC(b))||String(a.name).localeCompare(String(b.name),'tr',{sensitivity:'base'}));
    grp.t.sort((a,b)=>(wT(a)-wT(b))||String(a.name).localeCompare(String(b.name),'tr',{sensitivity:'base'}));
    grp.d.sort((a,b)=>(wD(a)-wD(b))||String(a.name).localeCompare(String(b.name),'tr',{sensitivity:'base'}))
  }

  const out=[];
  for(const grp of brandArr){
    const n=Math.max(grp.c.length,grp.t.length,grp.d.length);
    for(let i=0;i<n;i++){
      const c=grp.c[i]||null,t=grp.t[i]||null,d=grp.d[i]||null;
      const aideName=d?d.name:"";
      out.push({
        "Sıra":"",
        "Marka":grp.brandDisp||grp.brNorm,
        "Compel Ürün Adı":c?c.name:"",
        "T-Soft Ürün Adı":t?t.name:"",
        "Aide Ürün Adı":aideName,
        "Depo Ürün Adı":aideName,
        _clink:c?.link||"",
        _seo:t?.link||"",
        _cstokraw:c?.stokRaw??"",
        _taktif:t?t.aktif:null,
        _tstok:t?(Number.isFinite(t.stokNum)?t.stokNum:0):null,
        _dstok:d?(Number.isFinite(d.num)?d.num:0):null
      })
    }
  }
  for(let i=0;i<out.length;i++)out[i]["Sıra"]=String(i+1);
  return out
}

function refresh(){
  rebuildTsoftOkSupByBrand();
  const {R,U,UT}=matcher.getResults();
  const Ud=depot.isReady()?depot.unmatchedRows({brandsNormSet:COMPEL_BRANDS_NORM,tsoftSupByBrand:TSOFT_OK_SUP_BY_BRAND}):[];
  const Ux=buildUnifiedUnmatched({Uc:U,Ut:UT,Ud});
  renderer.render(R,Ux,depot.isReady());
  applySupplierUi()
}

/* file label */
const bind=(inId,outId,empty)=>{
  const inp=$(inId),out=$(outId);if(!inp||!out)return;
  const upd=()=>{
    const f=inp.files?.[0];
    if(!f){out.textContent=empty;out.title=empty}else{out.textContent='Seçildi';out.title=f.name}
    if(f){DAILY_SELECTED.tsoft='';paintDailyUI();}
    if(!hasEverListed){
      if(SELECTED.size===0)setGuideStep('brand');
      else if(!f)setGuideStep('tsoft');
      else if(guideStep==='tsoft')setGuideStep('aide');
      else if(guideStep==='brand')setGuideStep('tsoft')
    }
    applySupplierUi()
  };
  inp.addEventListener('change',upd);upd()
};
bind('f2','n2','Yükle');

/* scan state */
let abortCtrl=null;
const goBtn=$('go');
const setScanState=on=>{
  goBtn&&(goBtn.disabled=on);
  $('f2')&&($('f2').disabled=on);
  $('depoBtn')&&($('depoBtn').disabled=on);
  $('tsoftDailyBtn')&&($('tsoftDailyBtn').disabled = on || $('tsoftDailyBtn').disabled);
  $('aideDailyBtn')&&($('aideDailyBtn').disabled = on || $('aideDailyBtn').disabled);
};

/* ✅ compact T-Soft */
function compactTsoftCSV(L2all,C2){
  const cols=["Web Servis Kodu","Ürün Adı","Tedarikçi Ürün Kodu","Barkod","Stok","Marka","SEO Link","Aktif"];
  const rows=(L2all||[]).map(r=>({
    "Web Servis Kodu":T(r[C2.ws]||''),
    "Ürün Adı":T(r[C2.urunAdi]||''),
    "Tedarikçi Ürün Kodu":T(r[C2.sup]||''),
    "Barkod":T(r[C2.barkod]||''),
    "Stok":T(r[C2.stok]||''),
    "Marka":T(r[C2.marka]||''),
    "SEO Link":T(r[C2.seo]||''),
    "Aktif":C2.aktif?T(r[C2.aktif]||''):''
  }));
  return toCSV(rows,cols,',');
}

/* generate */
async function generate(){
  const needDaily = !!(DAILY_SELECTED.tsoft || DAILY_SELECTED.aide);

  const file=$('f2')?.files?.[0];
  if(!file && !DAILY_SELECTED.tsoft){alert('Lütfen T-Soft Stok CSV seç veya dünkü veriyi seç.');return false}

  setStatus('Okunuyor…','unk');
  setChip('l1Chip','Compel:—');setChip('l2Chip','T-Soft:—');

  abortCtrl=new AbortController();setScanState(true);
  try{
    clearOnlyLists();matcher.resetAll();
    TSOFT_OK_SUP_BY_BRAND=new Map();COMPEL_BRANDS_NORM=new Set();

    const selected=BRANDS.filter(x=>SELECTED.has(x.id));
    if(selected.length===BRANDS.length&&!confirm('Tüm markaları taramak üzeresiniz. Emin misiniz?'))throw new Error('İptal edildi.');

    let t2txt='';
    if(needDaily){
      const ymdSel = String(DAILY_SELECTED.tsoft || DAILY_SELECTED.aide || '').trim();
      if(!ymdSel) throw new Error('Seçilen tarih bulunamadı.');

      const pass = await getReadPassOrPrompt(ymdSel);
      const want=[];
      DAILY_SELECTED.tsoft && want.push('tsoft');
      DAILY_SELECTED.aide && want.push('aide');

      setStatus('Seçilen gün verisi alınıyor…','unk');
      const got=await dailyGet(API_BASE,{date:ymdSel,password:pass,want});

      DAILY_READ_CACHE={date:ymdSel,pass};

      if(DAILY_SELECTED.tsoft){
        const d=got?.tsoft;
        if(!d?.exists||!d?.data)throw new Error('Seçilen günün T-Soft verisi bulunamadı.');
        t2txt=String(d.data||'');
      }
      if(DAILY_SELECTED.aide){
        const d=got?.aide;
        if(!d?.exists||!d?.data)throw new Error('Seçilen günün Aide verisi bulunamadı.');
        depot.reset();
        depot.loadText(String(d.data||''));
        setChip('l4Chip',`Aide:${depot.count()}`);
      }
    }

    const t2Promise = t2txt ? Promise.resolve(t2txt) : readFileText(file);

    let seq=0;
    const chosen=selected.map(b=>({id:b.id,slug:b.slug,name:b.name,count:b.count}));

    const scanPromise=(async()=>{
      const rows=[];
      await scanCompel(API_BASE,chosen,{
        signal:abortCtrl.signal,
        onMessage:m=>{
          if(!m)return;
          if(m.type==='brandStart'||m.type==='page')setStatus(`Taranıyor: ${m.brand||''} (${m.page||0}/${m.pages||0})`,'unk');
          else if(m.type==='product'){
            const p=m.data||{};seq++;
            rows.push({"Sıra No":String(seq),"Marka":String(p.brand||''),"Ürün Adı":String(p.title||'Ürün'),"Ürün Kodu":String(p.productCode||''),"Stok":String(p.stock||''),"EAN":String(p.ean||''),"Link":String(p.url||'')});
            seq%250===0&&setChip('l1Chip',`Compel:${rows.length}`)
          }
        }
      });
      return rows
    })();

    const [t2txtFinal,L1]=await Promise.all([t2Promise,scanPromise]);
    setChip('l1Chip',`Compel:${L1.length}`);

    const p2=parseDelimited(t2txtFinal);
    if(!p2.rows.length){alert('T-Soft CSV boş görünüyor.');return false}
    const s2=p2.rows[0];

    const C1={siraNo:"Sıra No",marka:"Marka",urunAdi:"Ürün Adı",urunKodu:"Ürün Kodu",stok:"Stok",ean:"EAN",link:"Link"};
    const C2={
      ws:pickColumn(s2,['Web Servis Kodu','WebServis Kodu','WebServisKodu']),
      urunAdi:pickColumn(s2,['Ürün Adı','Urun Adi','Ürün Adi']),
      sup:pickColumn(s2,['Tedarikçi Ürün Kodu','Tedarikci Urun Kodu','Tedarikçi Urun Kodu']),
      barkod:pickColumn(s2,['Barkod','BARKOD']),
      stok:pickColumn(s2,['Stok']),
      marka:pickColumn(s2,['Marka']),
      seo:pickColumn(s2,['SEO Link','Seo Link','SEO','Seo']),
      aktif:pickColumn(s2,['Aktif','AKTIF','Active','ACTIVE'])
    };

    const miss=['ws','sup','barkod','stok','marka','urunAdi','seo'].filter(k=>!C2[k]);
    if(miss.length){setStatus('Sütun eksik','bad');console.warn('L2 missing',miss);alert('T-Soft CSV sütunları eksik. Konsola bak.');return false}

    const L2all=p2.rows;

    try{
      const cb=$('tsoftSaveToday');
      if(cb?.checked){
        if(!ensureSaveCredOrCancel()){ cb.checked=false; }
        else{
          setStatus('T-Soft kaydediliyor…','unk');
          const compact=compactTsoftCSV(L2all,C2);
          await dailySave(API_BASE,{kind:'tsoft',adminPassword:DAILY_SAVE_CRED.adminPassword,readPassword:DAILY_SAVE_CRED.readPassword,data:compact});
          setStatus('T-Soft kaydedildi','ok');
          cb.checked=false;
          await refreshDailyMeta();
        }
      }
    }catch(err){
      console.error(err);
      setStatus(String(err?.message||err),'bad');
      alert(String(err?.message||err));
    }

    COMPEL_BRANDS_NORM=new Set(L1.map(r=>normBrand(r[C1.marka]||'')).filter(Boolean));
    const L2=L2all.filter(r=>COMPEL_BRANDS_NORM.has(normBrand(r[C2.marka]||'')));

    matcher.loadData({l1:L1,c1:C1,l2:L2,c2:C2,l2All:L2all});
    matcher.runMatch();refresh();

    setStatus('Hazır','ok');
    setChip('l2Chip',`T-Soft:${L2.length}/${L2all.length}`);
    lockListTitleFromCurrentSelection();setListTitleVisible(true);
    return true
  }catch(e){
    if(String(e?.message||'').toLowerCase().includes('unauthorized')) DAILY_READ_CACHE={date:'',pass:''};
    console.error(e);
    setStatus(String(e?.message||'Hata (konsol)'),'bad');
    alert(e?.message||String(e));
    return false
  }finally{
    abortCtrl=null;setScanState(false);applySupplierUi();paintDailyUI()
  }
}

/* csv output */
$('dl1')?.addEventListener('click',()=>{
  const {R}=matcher.getResults();
  const clean=(R||[]).map(r=>Object.fromEntries(COLS.map(c=>[c,r[c]])));
  downloadBlob('sonuc-eslestirme.csv',new Blob([toCSV(clean,COLS)],{type:'text/csv;charset=utf-8'}))
});

/* reset all */
function resetAll(){
  try{abortCtrl?.abort?.()}catch{}
  abortCtrl=null;setScanState(false);
  hasEverListed=false;setGoMode('list');
  lastListedTitle='';setListTitleVisible(false);
  SELECTED.clear();renderBrands();
  const f2=$('f2');f2&&(f2.value='');
  const n2=$('n2');n2&&(n2.textContent='Yükle',n2.title='Yükle');

  TSOFT_OK_SUP_BY_BRAND=new Map();COMPEL_BRANDS_NORM=new Set();

  DAILY_SELECTED={tsoft:'',aide:''};
  DAILY_READ_CACHE={date:'',pass:''};
  DAILY_SAVE_CRED=null;

  $('tsoftSaveToday')&&($('tsoftSaveToday').checked=false);
  $('aideSaveToday')&&($('aideSaveToday').checked=false);
  paintDailyUI();

  depot.reset();matcher.resetAll();
  clearOnlyLists();
  setChip('l1Chip','Compel:-');setChip('l2Chip','T-Soft:-');setChip('l4Chip','Aide:-');setChip('sum','✓0 • ✕0','muted');
  setGuideStep('brand');applySupplierUi()
}

/* handle go */
async function handleGo(){
  if(ACTIVE_SUPPLIER===SUPPLIERS.AKALIN){applySupplierUi();return}
  if(goMode==='clear'){resetAll();return}
  if(!hasEverListed&&guideStep==='list')setGuideStep('done');
  if(!hasEverListed&&!SELECTED.size){alert('Lütfen bir marka seçin');return}
  if(!SELECTED.size){clearOnlyLists();setGoMode('clear');return}

  const ok=await generate();
  if(ok){hasEverListed=true;setGoMode('list');setGuideStep('done')}
}
goBtn&&(goBtn.onclick=handleGo);

/* aide save checkbox */
$('aideSaveToday')?.addEventListener('change',e=>{
  const cb=e.target;
  if(cb.checked){
    if(!ensureSaveCredOrCancel()) cb.checked=false;
  }
});

/* init */
ensureListHeader();setGoMode('list');setGuideStep('brand');
initBrands();applySupplierUi();
refreshDailyMeta();
