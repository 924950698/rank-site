// 预期收益：一个输入框 → 一个大数字 + 奶茶换算 + 收益海报（娱乐估算）
(function(){
  const P=0.20, R_LO=0.6, R_MID=1.1, R_HI=1.3, USD_CNY=7.1, CUP=20, SITE="https://924950698.github.io/rank-site/";
  const pg=document.getElementById("incomePage"); if(!pg) return;
  const LS=k=>{try{return localStorage.getItem(k)||""}catch{return""}}, SS=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
  pg.innerHTML=`<div class="inc"><h3>💰 预期收益</h3>
    <label class="incL" for="incV">你两周的曝光量</label>
    <input id="incV" class="incIn" inputmode="numeric" placeholder="比如 200000" autocomplete="off">
    <div class="incOut"><div class="incBig">预计每两周约 <b id="incX">$0</b></div>
    <div class="incRg" id="incRg">区间 $0 ～ $0</div><div class="incFun" id="incFun">填上曝光量，看看能喝几杯奶茶 🧋</div></div>
    <button class="btn incBtn" type="button" id="incPost">生成海报，晒到 X</button>
    <p class="incFt">仅供娱乐，非官方数据</p></div>`;
  const $=s=>pg.querySelector(s), inp=$("#incV");
  const num=()=>Math.max(0,parseInt((inp.value||"").replace(/[^\d]/g,""))||0);
  function calc(v){const q=v*P/1000;return{v,mid:Math.round(q*R_MID),lo:Math.round(q*R_LO),hi:Math.round(q*R_HI)}}
  function quip(usd){const cups=Math.floor(usd*USD_CNY/CUP);
    if(usd<10) return "够买包辣条 🌶️，继续冲 💪"; if(usd<100) return `够喝 ${cups} 杯奶茶 🧋`;
    if(usd<500) return "够吃顿火锅 🍲"; return "房租有着落了 🏠";}
  const fmt=n=>n.toLocaleString("en-US");
  function upd(){const r=calc(num()); $("#incX").textContent="$"+fmt(r.mid); $("#incRg").textContent=`区间 $${fmt(r.lo)} ～ $${fmt(r.hi)}`;
    $("#incFun").textContent=r.v?quip(r.mid):"填上曝光量，看看能喝几杯奶茶 🧋"; SS("inc_v",inp.value); return r;}
  inp.value=LS("inc_v"); inp.addEventListener("input",upd); upd();
  // 右栏（桌面）：一行公式
  const R=document.querySelector(".colR"), rb=document.createElement("div"); rb.className="rbox incR";
  rb.innerHTML="<b>怎么算的</b><p class='m'>曝光 × 20% × 每千次约 $1.1（区间 $0.6～$1.3），仅供娱乐</p>";
  if(R){R.prepend(rb); const sync=()=>rb.style.display=document.body.dataset.page==="income"?"":"none"; sync();
    new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:["data-page"]});}
  function avatar(h){return new Promise(res=>{if(!h) return res(null); const im=new Image(); im.crossOrigin="anonymous";
    const t=setTimeout(()=>res(null),5000); im.onload=()=>{clearTimeout(t);try{const k=document.createElement("canvas");k.width=k.height=1;const x=k.getContext("2d");x.drawImage(im,0,0,1,1);x.getImageData(0,0,1,1);res(im)}catch{res(null)}};
    im.onerror=()=>{clearTimeout(t);res(null)}; im.src="https://unavatar.io/x/"+encodeURIComponent(h)+"?fallback=false";});}
  async function draw(r,h){const S=1080,H=1350,cv=document.createElement("canvas");cv.width=S;cv.height=H;const c=cv.getContext("2d"),cx=S/2;
    const gr=c.createRadialGradient(cx,0,50,cx,0,H);gr.addColorStop(0,"#5a4a08");gr.addColorStop(.75,"#050805");c.fillStyle=gr;c.fillRect(0,0,S,H);
    c.strokeStyle="#ffd23f";c.lineWidth=6;c.beginPath();c.roundRect(30,30,S-60,H-60,48);c.stroke();c.textAlign="center";
    const im=await avatar(h), ay=250, ar=130;
    c.save();c.beginPath();c.arc(cx,ay,ar,0,7);c.clip();
    if(im) c.drawImage(im,cx-ar,ay-ar,ar*2,ar*2); else {c.fillStyle="#ffd23f";c.fill();c.fillStyle="#000";c.font="800 130px sans-serif";c.textBaseline="middle";c.fillText((h||"X")[0].toUpperCase(),cx,ay+6);c.textBaseline="alphabetic";}
    c.restore();c.strokeStyle="#ffd23f";c.lineWidth=10;c.beginPath();c.arc(cx,ay,ar,0,7);c.stroke();
    c.fillStyle="#fff";c.font="600 50px sans-serif";c.fillText(h?"@"+h:"我的 X 收益",cx,ay+ar+80);
    c.fillStyle="#c8c8c8";c.font="500 46px sans-serif";c.fillText("预计每两周约",cx,610);
    c.fillStyle="#ffd23f";c.font="900 200px sans-serif";let big="$"+fmt(r.mid);c.fillText(big,cx,800);
    c.fillStyle="#fff";c.font="500 44px sans-serif";c.fillText(`区间 $${fmt(r.lo)} ～ $${fmt(r.hi)}  ·  两周曝光 ${fmt(r.v)}`,cx,880);
    c.font="800 52px sans-serif";const q=quip(r.mid),bw=c.measureText(q).width+100;c.fillStyle="#ffd23f";c.beginPath();c.roundRect(cx-bw/2,940,bw,100,50);c.fill();c.fillStyle="#000";c.fillText(q,cx,1008);
    c.fillStyle="#39ff14";c.font="800 48px sans-serif";c.fillText("X 中文创作者成长站",cx,1160);c.fillStyle="#c8c8c8";c.font="500 36px sans-serif";c.fillText("924950698.github.io/rank-site  ·  仅供娱乐",cx,1220);
    return cv;}
  async function open(){const r=calc(num()); if(!r.v){inp.focus();window.toast?.("先填上你两周的曝光量");return}
    const m=document.createElement("div");m.className="pm";document.body.appendChild(m);m.onclick=e=>{if(e.target===m)m.remove()};
    m.innerHTML=`<div class="pmb"><input id="incH" class="incIn" placeholder="你的 X 用户名（选填，不带 @）" value="${LS("inc_h").replace(/[^\w]/g,"")}"><div id="incImg" class="m" style="text-align:center;padding:30px">海报生成中…</div>
      <div class="pmh">先保存海报，发帖时把图片加上</div><div class="pmr"><button class="btn" id="incS">保存海报</button><a class="btn ghost" id="incXb" target="_blank" rel="noopener">发到 X</a><button class="btn ghost" id="incC">关闭</button></div></div>`;
    const xt=`我算了一下，两周能拿约 $${fmt(r.mid)} 分成 💰\n${quip(r.mid)}\n你也来算算 👉 ${SITE}#income`;
    m.querySelector("#incXb").href="https://x.com/intent/post?text="+encodeURIComponent(xt);
    let file,purl;
    const render=async()=>{const h=m.querySelector("#incH").value.replace(/[^\w]/g,"");SS("inc_h",h);const cv=await draw(r,h);
      const b=await new Promise(z=>cv.toBlob(z,"image/png"));if(purl)URL.revokeObjectURL(purl);purl=URL.createObjectURL(b);file=new File([b],`income-${h||"me"}.png`,{type:"image/png"});
      m.querySelector("#incImg").outerHTML=`<img id="incImg" src="${purl}" alt="收益海报">`;};
    let tm;m.querySelector("#incH").addEventListener("input",()=>{clearTimeout(tm);tm=setTimeout(render,500)});
    m.querySelector("#incC").onclick=()=>m.remove();
    m.querySelector("#incS").onclick=()=>{if(file){window.track?.("income:save");if(window.saveImage)saveImage(file,purl,m.querySelector(".pmb"));else{const a=document.createElement("a");a.href=purl;a.download=file.name;document.body.appendChild(a);a.click();a.remove();}}};
    render();}
  $("#incPost").onclick=open;
})();
