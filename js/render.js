import { esc,stockToNumber } from './utils.js';
import { COLS } from './match.js';
const $=id=>document.getElementById(id);

const colGrp=w=>`<colgroup>${w.map(x=>`<col style="width:${x}%">`).join('')}</colgroup>`;

const alphaTR=(a,b)=>
  String(a||"").localeCompare(String(b||""),"tr",{sensitivity:"base"});

const compelWeight=row=>{
  const raw=row?._cstokraw ?? "";
  return stockToNumber(raw,{source:"compel"})>0?0:1;
};

export function createRenderer({ui}={}){

  return{
    render(R,Ux,depotReady){

      /* =======================
         ÜST TABLO
      ======================== */

      const sortedTop=[...(R||[])].sort((a,b)=>{
        const w=compelWeight(a)-compelWeight(b);
        if(w!==0)return w;
        const ab=alphaTR(a["Marka"],b["Marka"]);
        if(ab)return ab;
        return alphaTR(a["Ürün Adı (Compel)"],b["Ürün Adı (Compel)"]);
      });

      const head=COLS.map(c=>`<th>${esc(c)}</th>`).join('');

      const body=sortedTop.map((r,i)=>`
        <tr>
          ${COLS.map(c=>`<td>${esc(r[c]??"")}</td>`).join('')}
        </tr>
      `).join('');

      $('t1').innerHTML=
        colGrp([4,8,8,20,8,20,8,8,8,8,8])+
        `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;

      /* =======================
         ALT TABLO
      ======================== */

      const sortedBottom=[...(Ux||[])].sort((a,b)=>{
        const w=compelWeight(a)-compelWeight(b);
        if(w!==0)return w;
        const ab=alphaTR(a["Marka"],b["Marka"]);
        if(ab)return ab;
        return alphaTR(a["Compel Ürün Adı"],b["Compel Ürün Adı"]);
      });

      const UCOLS=[
        "Sıra",
        "Marka",
        "Compel Ürün Kodu",
        "Compel Ürün Adı",
        "T-Soft Ürün Kodu",
        "T-Soft Ürün Adı",
        "Aide Ürün Kodu",
        "Aide Ürün Adı"
      ];

      const head2=UCOLS.map((c,i)=>{
        let cls="";
        if(c==="Compel Ürün Kodu") cls="sepL";
        if(c==="T-Soft Ürün Kodu") cls="sepL";
        if(c==="Aide Ürün Kodu") cls="sepL";
        return `<th class="${cls}">${esc(c)}</th>`;
      }).join('');

      const body2=sortedBottom.map((r,i)=>`
        <tr>
          <td>${i+1}</td>
          <td>${esc(r["Marka"]||"")}</td>
          <td class="sepL">${esc(r["Compel Ürün Kodu"]||"")}</td>
          <td>${esc(r["Compel Ürün Adı"]||"")}</td>
          <td class="sepL">${esc(r["T-Soft Ürün Kodu"]||"")}</td>
          <td>${esc(r["T-Soft Ürün Adı"]||"")}</td>
          <td class="sepL">${esc(r["Aide Ürün Kodu"]||"")}</td>
          <td>${esc(r["Aide Ürün Adı"]||"")}</td>
        </tr>
      `).join('');

      $('t2').innerHTML=
        colGrp([5,10,10,20,10,20,10,15])+
        `<thead><tr>${head2}</tr></thead><tbody>${body2}</tbody>`;

      ui?.setChip?.("sum",`✓${sortedTop.length} • ✕${sortedBottom.length}`,"muted");
    }
  }
}
