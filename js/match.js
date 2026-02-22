import { TR,T,D,nowISO,inStock } from './utils.js';
const $=id=>document.getElementById(id);

export const COLS=[
  "Sıra No","Marka",
  "Ürün Kodu (Compel)","Ürün Adı (Compel)",
  "Ürün Kodu (T-Soft)","Ürün Adı (T-Soft)",
  "Stok (Compel)","Stok (Depo)","Stok (T-Soft)",
  "EAN (Compel)","EAN (T-Soft)"
];

/* ---------------- SORT HELPERS ---------------- */

const alphaTR=(a,b)=>
  String(a||"").localeCompare(String(b||""),"tr",{sensitivity:"base"});

const compelStockWeight=row=>{
  const raw=row?._s1raw ?? row?.["Stok (Compel)"] ?? "";
  const ok=inStock(raw,{source:"compel"});
  return ok?0:1; // VAR=0 (üstte), YOK=1 (altta)
};

/* ------------------------------------------------ */

export function createMatcher({getDepotAgg,isDepotReady}={}){
  let L1=[],L2=[],L2all=[],C1={},C2={};
  let R=[],U=[],UT=[];

  const sortRowsWithCompelPriority=arr=>{
    return [...arr].sort((a,b)=>{
      const w=compelStockWeight(a)-compelStockWeight(b);
      if(w!==0)return w;

      const ab=alphaTR(a["Marka"],b["Marka"]);
      if(ab)return ab;

      const an=alphaTR(a["Ürün Adı (Compel)"],b["Ürün Adı (Compel)"]);
      if(an)return an;

      return 0;
    });
  };

  const runMatch=()=>{
    R=[];
    U=[];
    UT=[];

    for(const r1 of L1){
      const row={
        "Sıra No":r1[C1.siraNo],
        "Marka":r1[C1.marka],
        "Ürün Kodu (Compel)":r1[C1.urunKodu],
        "Ürün Adı (Compel)":r1[C1.urunAdi],
        "Ürün Kodu (T-Soft)":"",
        "Ürün Adı (T-Soft)":"",
        "Stok (Compel)":r1[C1.stok],
        "Stok (Depo)":"—",
        "Stok (T-Soft)":"",
        "EAN (Compel)":r1[C1.ean],
        "EAN (T-Soft)":"",
        _s1raw:r1[C1.stok],
        _m:false
      };

      R.push(row);
      U.push(row);
    }

    R=sortRowsWithCompelPriority(R);
    U=sortRowsWithCompelPriority(U);

    return {R,U,UT};
  };

  const loadData=({l1,c1,l2,c2,l2All})=>{
    L1=l1||[];
    L2=l2||[];
    L2all=l2All||[];
    C1=c1||{};
    C2=c2||{};
  };

  const getResults=()=>({R,U,UT});
  const hasData=()=>!!(L1?.length);

  const resetAll=()=>{
    L1=[];
    L2=[];
    L2all=[];
    R=[];
    U=[];
    UT=[];
  };

  return{
    loadData,
    runMatch,
    getResults,
    hasData,
    resetAll
  }
}
