export async function loadBrands(API_BASE){
  const r=await fetch(`${API_BASE}/api/brands`,{cache:'no-store'});
  if(!r.ok)throw new Error(`API /api/brands hata: ${r.status}`);
  return await r.json()
}

export async function scanCompel(API_BASE,brands,{signal,onMessage}={}){
  const r=await fetch(`${API_BASE}/api/scan`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({brands}),signal
  });
  if(!r.ok){const t=await r.text().catch(()=> '');throw new Error(`API /api/scan hata: ${r.status}\n${t}`)}
  const rd=r.body?.getReader?.();if(!rd)throw new Error('Stream yok (reader alınamadı).');
  const dec=new TextDecoder();let buf='';
  for(;;){
    const {value,done}=await rd.read();if(done)break;
    buf+=dec.decode(value,{stream:true});
    let i;while((i=buf.indexOf('\n'))>=0){
      const line=buf.slice(0,i).trim();buf=buf.slice(i+1);
      if(!line)continue;let msg=null;try{msg=JSON.parse(line)}catch{continue}
      onMessage&&onMessage(msg)
    }
  }
}

/* ✅ daily store */
export async function dailyMeta(API_BASE){
  const r=await fetch(`${API_BASE}/api/daily/meta`,{cache:'no-store'});
  if(!r.ok)throw new Error(`API /api/daily/meta hata: ${r.status}`);
  return await r.json();
}

export async function dailyGet(API_BASE,{date,password,want}={}){
  const r=await fetch(`${API_BASE}/api/daily/get`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({date,password,want})
  });
  const t=await r.text().catch(()=> '');
  let j=null;try{j=JSON.parse(t)}catch{j=null}
  if(!r.ok)throw new Error(j?.error?String(j.error):`API /api/daily/get hata: ${r.status}`);
  return j;
}

export async function dailySave(API_BASE,{kind,adminPassword,readPassword,data}={}){
  const r=await fetch(`${API_BASE}/api/daily/save`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({kind,adminPassword,readPassword,data})
  });
  const t=await r.text().catch(()=> '');
  let j=null;try{j=JSON.parse(t)}catch{j=null}
  if(!r.ok)throw new Error(j?.error?String(j.error):`API /api/daily/save hata: ${r.status}`);
  return j;
}
