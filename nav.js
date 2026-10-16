// 顶部菜单 + 双飞翼布局：桌面端左栏输入、中栏当前页、右栏说明；手机端右上角 ☰ 下拉切页
(function(){
  const $=s=>document.querySelector(s), el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
  const PAGES=[["wall","24 小时照片墙"],["rank","今日中文 X 爆帖 Top 10"],["ledger","互评账本"]];
  const hd=$("header"), howto=$(".howto"), wallSec=$("#wallSec"), pq=$("#pq");
  // 菜单
  const nav=el("nav","topnav"); PAGES.forEach(([k,t])=>{const a=el("button",null,t);a.type="button";a.dataset.p=k;nav.appendChild(a)});
  const mb=el("button","menuBtn","☰");mb.type="button";mb.setAttribute("aria-label","菜单");
  const dd=el("div","menuDd");PAGES.forEach(([k,t])=>{const a=el("button",null,t);a.type="button";a.dataset.p=k;dd.appendChild(a)});
  hd.insertBefore(nav,hd.querySelector(".upd"));hd.appendChild(mb);hd.appendChild(dd);
  // 三栏
  const lay=el("div","layout"), L=el("aside","colL"), C=el("div","colC"), R=el("aside","colR");
  lay.append(L,C,R); hd.after(lay);
  L.appendChild(pq); L.appendChild(el("p","m lhint","输入后，照片墙和互评账本都会切换到这个人的数据"));
  const pW=el("section","page");pW.dataset.p="wall";
  ["#wallTitle","#wallSort","#wall","#pqOut"].forEach(s=>pW.appendChild($(s)));
  const cta=wallSec.querySelector(".cta");
  const pR=el("section","page");pR.dataset.p="rank";
  ["#pinned","#topic",".rk-hd","#tabs","main"].forEach(s=>pR.appendChild($(s)));
  const pL=el("section","page");pL.dataset.p="ledger";
  pL.appendChild(el("div","lgEmpty",'<h3>互评账本</h3><p class="m">在输入框填你的 X 用户名，点「查看我的互评账本」，就能看到谁和你互动过、互动了多少次</p>'));
  pL.appendChild($("#ledgerOut"));
  C.append(pW,pR,pL); if(cta) C.appendChild(cta); wallSec.remove();
  // 右栏：数据说明 + 使用方法
  const info=$("#dmodal .dbox ul");
  R.appendChild(el("div","rbox",'<b>数据说明</b>'+(info?info.outerHTML:"")));
  const placeHowto=()=>{ if(window.innerWidth>=1024){ if(howto.parentNode!==R) R.appendChild(howto) } else if(howto.nextSibling!==lay){ lay.before(howto) } };
  placeHowto(); addEventListener("resize",placeHowto);
  // 切页
  function go(p,push){document.body.dataset.page=p;
    document.querySelectorAll(".topnav button,.menuDd button").forEach(b=>b.classList.toggle("on",b.dataset.p===p));
    document.querySelectorAll(".page").forEach(s=>s.style.display=s.dataset.p===p?"":"none");
    dd.classList.remove("open"); if(push!==false) history.replaceState(null,"",location.pathname+location.search+"#"+p);
    if(window.innerWidth<1024) window.scrollTo(0,0);}
  window.__go=go;
  document.addEventListener("click",e=>{const b=e.target.closest(".topnav button,.menuDd button");if(b){go(b.dataset.p);return}
    if(e.target===mb){dd.classList.toggle("open");return} if(!e.target.closest(".menuDd")) dd.classList.remove("open")});
  // 联动：生成照片墙/海报 → 照片墙页；查看账本 → 账本页
  pq.addEventListener("submit",()=>go("wall"),true);
  $("#pqPost").addEventListener("click",()=>go("wall"),true);
  $("#pqLedger").addEventListener("click",()=>go("ledger"),true);
  new MutationObserver(()=>{pL.querySelector(".lgEmpty").style.display=$("#ledgerOut").children.length?"none":""}).observe($("#ledgerOut"),{childList:true});
  const h=location.hash.slice(1); go(PAGES.some(x=>x[0]===h)?h:"wall",false);
})();
