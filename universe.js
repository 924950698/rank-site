// 互动照片墙「互动宇宙」：主人居中，四圈 8/20/32/40 = 100 人；心跳冲击波每 3 秒一次
// 数据顺序：照片墙互动（partners.json）→ 互评账本互动对（ledger.json）→ 头像池补位（pool.json，标「补位」）。不额外调 X 接口
(function(){
const W=1080,H=1350,CX=540,CY=720,R=480,TAU=Math.PI*2,SITE="https://markpump.com/";
const C={bg:"#05040d",pur:"#a855f7",cy:"#22d3ee",cy2:"#38bdf8",gold:"#ffd34d"};
const RING=[{n:8,rr:.27,ar:.072,w:.105,al:1,name:"核心圈"},{n:20,rr:.47,ar:.0576,w:-.07,al:.95,name:"铁粉圈"},{n:32,rr:.67,ar:.0432,w:.048,al:.85,name:"互动圈"},{n:40,rr:.87,ar:.0324,w:-.033,al:.72,name:"路人圈"}];
const metal={1:["#fff3b0","#d49b17","#7a5200","#ffd34d"],2:["#ffffff","#a9b4c2","#4b5563","#cfe8ff"],3:["#ffd0a8","#b8692f","#5c2c0c","#f0a36b"]};
const P=3,TW=.32,DW=1.7,r0=.1*R,RS=r0*1.4,RE=1.02*R;
const rnd=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const r1=rnd(7),STARS=[...Array(320)].map(()=>({x:r1()*W,y:r1()*H,s:r1()*1.6+.3,a:r1()*.6+.2,tw:r1()<.35?r1()*3+1:0,ph:r1()*TAU}));
const r2=rnd(11),PART=[...Array(170)].map(()=>({a:r2()*TAU,T:3+r2()*4,ph:r2(),s:r2()*1.8+.8,c:r2()<.55?C.cy:C.pur,sp:(r2()-.5)*.9}));
const beat=tau=>Math.exp(-(((tau-.08)/.05)**2))+.7*Math.exp(-(((tau-.3)/.05)**2));
const passT=rad=>{const p=Math.min(1,Math.max(0,(rad-RS)/(RE-RS)));return TW+DW*(1-Math.sqrt(1-p));};
const light=(rad,frac,t)=>{let L=0;for(const c of [0,P]){const dt=(t%P)+c-(passT(rad)+frac*.32);if(dt>=0)L=Math.max(L,Math.exp(-dt/.38)*Math.min(1,dt/.05));}return L;};
const hiAv=s=>s?String(s).replace(/_normal\.(jpe?g|png|webp)$/i,"_400x400.$1"):s;
const nh=s=>String(s||"").replace(/^@+/,"").toLowerCase();
// 图片：跨域加载（pbs.twimg.com 对本站放行 CORS），失败就画首字母；先裁成圆形小图，逐帧只贴图
const imgCache=new Map();
function loadImg(src){if(!src)return Promise.resolve(null);if(!imgCache.has(src))imgCache.set(src,new Promise(res=>{const im=new Image();im.crossOrigin="anonymous";im.referrerPolicy="no-referrer";
  const t=setTimeout(()=>res(null),6000);im.onload=()=>{clearTimeout(t);try{const k=document.createElement("canvas");k.width=k.height=2;const x=k.getContext("2d");x.drawImage(im,0,0,2,2);x.getImageData(0,0,1,1);res(im)}catch{res(null)}};im.onerror=()=>{clearTimeout(t);res(null)};im.src=src;}));return imgCache.get(src);}
function sprite(img,r,label){const s=Math.ceil(r*2*1.25),k=document.createElement("canvas");k.width=k.height=s;const c=k.getContext("2d"),m=s/2,rr=s/2;
  c.beginPath();c.arc(m,m,rr,0,TAU);c.clip();if(img)c.drawImage(img,0,0,s,s);else{c.fillStyle="#1d1b33";c.fillRect(0,0,s,s);c.fillStyle="#c4b5fd";c.font=`800 ${s*.45}px sans-serif`;c.textAlign="center";c.textBaseline="middle";c.fillText(label,m,m+s*.03);}return k;}
function build(Pj,Lj,pool,h){h=nh(h);const seen=new Set([h]),out=[];
  const wl=(Pj?.users?.[h]||[]).filter(u=>u.count>0).sort((a,b)=>b.count-a.count);
  for(const u of wl){const x=nh(u.handle);if(seen.has(x)||!u.avatar)continue;seen.add(x);out.push({handle:x,name:u.name||x,av:hiAv(u.avatar),count:u.count,src:"wall"});}
  const ll=(Lj?.users?.[h]||[]).map(x=>({...x,count:(x.me_to||0)+(x.to_me||0)})).sort((a,b)=>b.count-a.count||(b.to_me||0)-(a.to_me||0)||(a.handle<b.handle?-1:1));
  for(const u of ll){const x=nh(u.handle);if(seen.has(x)||!u.avatar)continue;seen.add(x);out.push({handle:x,name:u.name||x,av:hiAv(u.avatar),count:u.count,me_to:u.me_to||0,to_me:u.to_me||0,src:"ledger"});}
  const week=new Set([...wl.map(u=>nh(u.handle)),...(Lj?.users?.[h]||[]).map(u=>nh(u.handle))].filter(x=>x!==h)).size;
  const people=out.slice(0,100);for(const u of pool||[]){if(people.length>=100)break;if(seen.has(u.h)||!u.a)continue;seen.add(u.h);people.push({handle:u.h,name:u.n,av:u.a,count:0,src:"pool"});}
  const pr=Pj?.profiles?.[h];return{owner:{handle:h,av:hiAv(pr?.avatar)||`https://unavatar.io/x/${encodeURIComponent(h)}`},people,week,
    n:{wall:people.filter(p=>p.src==="wall").length,ledger:people.filter(p=>p.src==="ledger").length,pool:people.filter(p=>p.src==="pool").length}};}
function crown(c,x,y,w,cols){c.save();c.translate(x,y);const h=w*.62,g=c.createLinearGradient(0,-h,0,0);g.addColorStop(0,cols[0]);g.addColorStop(1,cols[1]);
  c.beginPath();c.moveTo(-w/2,0);c.lineTo(-w/2,-h*.55);c.lineTo(-w/4,-h*.2);c.lineTo(0,-h);c.lineTo(w/4,-h*.2);c.lineTo(w/2,-h*.55);c.lineTo(w/2,0);c.closePath();
  c.shadowColor=cols[0];c.shadowBlur=w*.35;c.fillStyle=g;c.fill();c.shadowBlur=0;c.lineWidth=Math.max(1,w*.05);c.strokeStyle=cols[2];c.stroke();
  c.fillStyle="#fff";[[-w/2,-h*.55],[0,-h],[w/2,-h*.55]].forEach(([a,b])=>{c.beginPath();c.arc(a,b,w*.07,0,TAU);c.fill();});c.restore();}
function spark(c,x,y,s,a){c.save();c.globalAlpha=a;c.fillStyle="#fff";c.shadowColor="#bfe9ff";c.shadowBlur=s*1.5;c.beginPath();c.moveTo(x,y-s);c.quadraticCurveTo(x,y,x+s,y);c.quadraticCurveTo(x,y,x,y+s);c.quadraticCurveTo(x,y,x-s,y);c.quadraticCurveTo(x,y,x,y-s);c.fill();c.restore();}
let QR=null;
function brand(c){const qs=118,pad=14,bx=W-24-qs-pad*2-250,by=H-24-qs-pad*2,bw=W-24-bx,bh=qs+pad*2;
  c.save();c.fillStyle="rgba(13,11,29,.78)";c.strokeStyle="rgba(139,92,246,.45)";c.lineWidth=1.5;c.beginPath();c.roundRect(bx,by,bw,bh,22);c.fill();c.stroke();
  const qx=W-24-pad-qs,qy=by+pad;c.fillStyle="#fff";c.beginPath();c.roundRect(qx,qy,qs,qs,10);c.fill();
  if(!QR&&window.qrcode){QR=qrcode(0,"M");QR.addData(SITE);QR.make();}
  if(QR){const n=QR.getModuleCount(),cs=(qs-8)/n;c.fillStyle="#0b0820";for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(QR.isDark(i,j))c.fillRect(qx+4+j*cs,qy+4+i*cs,cs+.3,cs+.3);}
  const ix=bx+pad+34,iy=by+pad+38;c.save();c.translate(ix,iy);c.rotate(-.35);c.strokeStyle=C.cy;c.lineWidth=3;c.shadowColor=C.cy;c.shadowBlur=10;c.beginPath();c.ellipse(0,0,31,11,0,0,TAU);c.stroke();c.restore();
  spark(c,ix,iy,17,1);c.fillStyle=C.pur;c.shadowColor=C.pur;c.shadowBlur=10;c.beginPath();c.arc(ix+27,iy-14,5,0,TAU);c.fill();c.shadowBlur=0;
  c.textAlign="left";c.textBaseline="alphabetic";const tg=c.createLinearGradient(ix+44,0,ix+210,0);tg.addColorStop(0,"#d8b4fe");tg.addColorStop(1,"#67e8f9");
  c.fillStyle=tg;c.font="900 40px sans-serif";c.fillText("互动宇宙",ix+46,iy+14);
  c.fillStyle="#a1a1aa";c.font="500 17px sans-serif";c.fillText("X 中文创作者成长站",bx+pad+6,by+pad+92);c.fillText("markpump.com",bx+pad+6,by+pad+116);c.restore();}
function bg(c,t){c.fillStyle=C.bg;c.fillRect(0,0,W,H);
  let g=c.createRadialGradient(300,420,0,300,420,560);g.addColorStop(0,"rgba(109,40,217,.28)");g.addColorStop(1,"rgba(109,40,217,0)");c.fillStyle=g;c.fillRect(0,0,W,H);
  g=c.createRadialGradient(820,980,0,820,980,600);g.addColorStop(0,"rgba(8,145,178,.22)");g.addColorStop(1,"rgba(8,145,178,0)");c.fillStyle=g;c.fillRect(0,0,W,H);
  c.fillStyle="#fff";for(const s of STARS){c.globalAlpha=s.tw?s.a*(.4+.6*Math.abs(Math.sin(t*s.tw+s.ph))):s.a;c.fillRect(s.x,s.y,s.s,s.s);}c.globalAlpha=1;
  RING.forEach((gq,i)=>{const rr=gq.rr*R,Lr=light(rr,0,t)*.8;c.strokeStyle=i%2?`rgba(34,211,238,${[.3,.22,.15,.1][i]+.4*Lr})`:`rgba(168,85,247,${[.3,.22,.15,.1][i]+.4*Lr})`;c.lineWidth=[2.2,1.6,1.1,.7][i]+2*Lr;c.beginPath();c.arc(CX,CY,rr,0,TAU);c.stroke();});
  c.save();c.globalCompositeOperation="lighter";for(const p of PART){const f=((t/p.T+p.ph)%1+1)%1,rr=R*1.08*(1-f)**.9+r0*1.1*f,ang=p.a+p.sp*f*2,x=CX+Math.cos(ang)*rr,y=CY+Math.sin(ang)*rr,al=Math.sin(f*Math.PI)*.85;
    const x2=CX+Math.cos(ang-p.sp*.06)*(rr+10+p.s*4),y2=CY+Math.sin(ang-p.sp*.06)*(rr+10+p.s*4);c.strokeStyle=p.c;c.globalAlpha=al*.5;c.lineWidth=p.s*.8;c.beginPath();c.moveTo(x2,y2);c.lineTo(x,y);c.stroke();
    c.globalAlpha=al;c.fillStyle=p.c;c.beginPath();c.arc(x,y,p.s,0,TAU);c.fill();}c.restore();c.globalAlpha=1;}
function drawWave(c,t){const u=((t%P)-TW)/DW;if(u<0||u>1)return;const rw=RS+(RE-RS)*(1-(1-u)**2),al=(1-u)**1.2;
  c.save();c.globalCompositeOperation="lighter";const lw=22*(1-u)+3;
  const gr=c.createRadialGradient(CX,CY,Math.max(0,rw-lw*2),CX,CY,rw+lw);gr.addColorStop(0,"rgba(34,211,238,0)");gr.addColorStop(.6,`rgba(34,211,238,${.35*al})`);gr.addColorStop(.85,`rgba(230,245,255,${.75*al})`);gr.addColorStop(1,"rgba(168,85,247,0)");
  c.fillStyle=gr;c.beginPath();c.arc(CX,CY,rw+lw,0,TAU);c.fill();
  c.strokeStyle=`rgba(200,240,255,${.9*al})`;c.lineWidth=2.5;c.shadowColor=C.cy;c.shadowBlur=20;c.beginPath();c.arc(CX,CY,rw,0,TAU);c.stroke();
  c.strokeStyle=`rgba(168,85,247,${.5*al})`;c.lineWidth=1.5;c.beginPath();c.arc(CX,CY,rw*.86,0,TAU);c.stroke();c.restore();}

async function create(data){
  const ppl=data.people,AV=[];let k=0;
  RING.forEach((g,ri)=>{for(let j=0;j<g.n;j++,k++){const p=ppl[k];if(!p)continue;AV.push({p,ri,j,rank:k+1,a0:j/g.n*TAU+(ri%2?Math.PI/g.n:ri===0?Math.PI/8:0)-Math.PI/2,jit:ri===3?(j%2?.035:-.03)+(j%3?0:.012):0,ph:rnd(k*97+3)()*TAU});}});
  const [imgs,selfImg]=await Promise.all([Promise.all(AV.map(a=>loadImg(a.p.av))),loadImg(data.owner.av)]);
  AV.forEach((a,i)=>{a.img=imgs[i];a.spr=sprite(imgs[i],RING[a.ri].ar*R*1.25,(a.p.handle[0]||"?").toUpperCase());});
  const selfSpr=sprite(selfImg,r0*1.12,(data.owner.handle[0]||"?").toUpperCase());
  const top3=AV.filter(a=>a.ri===0&&a.rank<=3&&a.p.count>0);
  const pos=(a,t)=>{const g=RING[a.ri],ang=a.a0+g.w*t,rr=(g.rr+a.jit)*R;return{x:CX+Math.cos(ang)*rr,y:CY+Math.sin(ang)*rr,r:g.ar*R,rr};};
  function drawAv(c,a,t,hov){const {x,y,r,rr}=pos(a,t),g=RING[a.ri],L=light(rr,a.j/g.n,t),pool=a.p.src==="pool",R2=r*(1+.16*L+(hov?.22:0));
    c.save();c.globalAlpha=g.al*(pool?.8:1);
    if(L>.02){const gg=c.createRadialGradient(x,y,R2*.6,x,y,R2*2.1);gg.addColorStop(0,`rgba(140,220,255,${.55*L})`);gg.addColorStop(1,"rgba(140,220,255,0)");c.fillStyle=gg;c.beginPath();c.arc(x,y,R2*2.1,0,TAU);c.fill();}
    c.drawImage(a.spr,x-R2,y-R2,R2*2,R2*2);
    const lw=Math.max(1,R2*(a.ri===0?.14:a.ri===1?.08:a.ri===2?.07:.06));
    if(a.ri===0&&a.rank<=3&&a.p.count>0){const m=metal[a.rank],gr=c.createLinearGradient(x-R2,y-R2,x+R2,y+R2);gr.addColorStop(0,m[0]);gr.addColorStop(.5,m[1]);gr.addColorStop(1,m[2]);
      let blur=R2*.35;if(a.rank===2)blur=R2*(.25+.55*(.5+.5*Math.sin(t*3.2)));if(a.rank===3)blur=R2*(.2+.4*(.5+.5*Math.sin(t*1.1)));
      c.shadowColor=m[3];c.shadowBlur=blur+R2*.6*L;c.strokeStyle=gr;c.lineWidth=lw*1.25;c.beginPath();c.arc(x,y,R2+lw*.4,0,TAU);c.stroke();
      if(a.rank===1){const s0=t*2.6;c.shadowColor="#fff";c.shadowBlur=R2*.5;c.strokeStyle="rgba(255,255,240,.95)";c.lineWidth=lw*.9;c.lineCap="round";c.beginPath();c.arc(x,y,R2+lw*.4,s0,s0+.85);c.stroke();}
      if(a.rank===2){c.shadowBlur=0;c.strokeStyle=`rgba(200,235,255,${.35+.4*(.5+.5*Math.sin(t*3.2))})`;c.lineWidth=lw*.5;c.beginPath();c.arc(x,y,R2+lw*1.6,0,TAU);c.stroke();}
      c.shadowBlur=0;crown(c,x,y-R2-lw*.6,R2*.95,[m[0],m[1],m[2]]);
      c.fillStyle=m[1];c.beginPath();c.arc(x+R2*.72,y+R2*.72,R2*.3,0,TAU);c.fill();c.fillStyle="#000";c.font=`800 ${R2*.36}px sans-serif`;c.textAlign="center";c.textBaseline="middle";c.fillText(a.rank,x+R2*.72,y+R2*.74);
    }else if(a.ri===0){const pu=.5+.5*Math.sin(t*2.6+a.j),cg=c.createConicGradient(t*1.2+a.j,x,y);["#a855f7","#22d3ee","#e879f9","#38bdf8","#a855f7"].forEach((cl,i)=>cg.addColorStop(i/4,cl));
      c.shadowColor=a.j%2?C.cy:C.pur;c.shadowBlur=R2*(.25+.4*pu)+R2*.6*L;c.strokeStyle=cg;c.lineWidth=lw*(.8+.35*pu);c.beginPath();c.arc(x,y,R2+lw*.4,0,TAU);c.stroke();
    }else if(a.ri===1){c.shadowColor=C.cy2;c.shadowBlur=R2*.25+R2*.6*L;c.strokeStyle=C.cy2;c.lineWidth=lw;c.beginPath();c.arc(x,y,R2+lw*.3,0,TAU);c.stroke();
      c.shadowBlur=0;c.setLineDash([R2*.22,R2*.16]);c.lineDashOffset=-t*R2*.5;c.strokeStyle="rgba(125,211,252,.6)";c.lineWidth=Math.max(.8,lw*.55);c.beginPath();c.arc(x,y,R2*1.28,0,TAU);c.stroke();c.setLineDash([]);
    }else if(a.ri===2){const br=.5+.5*Math.sin(t*1.5+a.ph);c.shadowColor=C.pur;c.shadowBlur=R2*.2*br+R2*.6*L;c.strokeStyle=`rgba(168,85,247,${.35+.35*br+.3*L})`;c.lineWidth=lw;c.beginPath();c.arc(x,y,R2+lw*.3,0,TAU);c.stroke();
    }else{c.strokeStyle=`rgba(200,210,255,${.22+.4*L})`;c.lineWidth=lw;c.beginPath();c.arc(x,y,R2+lw*.3,0,TAU);c.stroke();
      const tw=Math.max(0,Math.sin(t*2.1+a.ph))**6;if(tw>.03)spark(c,x+Math.cos(a.ph)*R2*.95,y+Math.sin(a.ph)*R2*.95,R2*.55,tw*.95);}
    if(L>.05){c.shadowBlur=0;c.strokeStyle=`rgba(230,250,255,${.7*L})`;c.lineWidth=Math.max(1,lw*.6);c.beginPath();c.arc(x,y,R2+lw*1.1,0,TAU);c.stroke();}
    if(hov){c.shadowBlur=12;c.shadowColor="#fff";c.strokeStyle="#fff";c.lineWidth=2;c.beginPath();c.arc(x,y,R2+lw+3,0,TAU);c.stroke();}
    c.restore();return{x,y,r:R2,a};}
  function drawOwner(c,t){const b=beat(t%P),r=r0*(1+.09*b);
    c.save();c.globalCompositeOperation="lighter";const gg=c.createRadialGradient(CX,CY,r*.5,CX,CY,r*(3.2+1.2*b));gg.addColorStop(0,`rgba(255,228,140,${.55+.35*b})`);gg.addColorStop(.35,`rgba(168,85,247,${.35+.25*b})`);gg.addColorStop(.7,`rgba(34,211,238,${.12+.12*b})`);gg.addColorStop(1,"rgba(34,211,238,0)");
    c.fillStyle=gg;c.beginPath();c.arc(CX,CY,r*(3.2+1.2*b),0,TAU);c.fill();c.restore();
    c.save();const cg=c.createConicGradient(t*1.6,CX,CY);["#a855f7","#22d3ee","#f0abfc","#22d3ee","#a855f7"].forEach((cl,i)=>cg.addColorStop(i/4,cl));
    c.shadowColor=C.cy;c.shadowBlur=24+20*b;c.strokeStyle=cg;c.lineWidth=7;c.beginPath();c.arc(CX,CY,r*1.2,0,TAU);c.stroke();
    c.shadowColor=C.gold;c.shadowBlur=22+18*b;c.strokeStyle=C.gold;c.lineWidth=5;c.lineCap="round";for(let i=0;i<3;i++){const s0=-t*1.1+i*TAU/3;c.beginPath();c.arc(CX,CY,r*1.46,s0,s0+1.45);c.stroke();}
    for(let i=0;i<12;i++){const an=t*.9+i*TAU/12,rr=r*1.72+Math.sin(t*2+i)*4;c.fillStyle=i%3?C.cy:C.gold;c.shadowColor=c.fillStyle;c.shadowBlur=12;c.beginPath();c.arc(CX+Math.cos(an)*rr,CY+Math.sin(an)*rr,i%3?3.2:4.4,0,TAU);c.fill();}
    c.shadowColor="#fff";c.shadowBlur=30+30*b;c.fillStyle="#fff";c.beginPath();c.arc(CX,CY,r+3,0,TAU);c.fill();c.shadowBlur=0;
    c.drawImage(selfSpr,CX-r,CY-r,2*r,2*r);c.strokeStyle="#fff7d6";c.lineWidth=4;c.beginPath();c.arc(CX,CY,r,0,TAU);c.stroke();
    crown(c,CX,CY-r*1.5,r*1.05,["#fff6c2","#ffc21a","#7a5200"]);
    c.font="800 26px sans-serif";const tw=c.measureText("主人").width+30;c.fillStyle=C.gold;c.shadowColor=C.gold;c.shadowBlur=14;c.beginPath();c.roundRect(CX-tw/2,CY+r*1.28,tw,38,19);c.fill();
    c.shadowBlur=0;c.fillStyle="#1a1000";c.textAlign="center";c.textBaseline="middle";c.fillText("主人",CX,CY+r*1.28+20);c.restore();}
  function texts(c){c.save();c.textAlign="left";c.textBaseline="alphabetic";const tg=c.createLinearGradient(48,0,700,0);tg.addColorStop(0,"#f5d0fe");tg.addColorStop(.5,"#c084fc");tg.addColorStop(1,"#22d3ee");
    c.fillStyle=tg;c.shadowColor=C.pur;c.shadowBlur=18;c.font="900 68px sans-serif";c.fillText(`我的互动宇宙 ${AV.length} 人`,48,118);c.shadowBlur=0;
    c.fillStyle="#d4d4d8";c.font="600 30px sans-serif";c.fillText("@"+data.owner.handle,50,168);
    const by=H-24-146;c.fillStyle="#a1a1aa";c.font="500 24px sans-serif";c.fillText("本周互动人数",50,by+30);
    c.fillStyle=C.cy;c.shadowColor=C.cy;c.shadowBlur=16;c.font="900 76px sans-serif";c.fillText(String(data.week),48,by+106);const nw=c.measureText(String(data.week)).width;c.shadowBlur=0;
    c.fillStyle="#d4d4d8";c.font="600 30px sans-serif";c.fillText("人",58+nw,by+104);
    if(top3.length){c.fillStyle="#c4b5fd";c.font="500 21px sans-serif";c.fillText("核心 TOP3 "+top3.map(a=>"@"+a.p.handle).join(" "),50,by+140);}c.restore();}
  let HIT=[];
  function frame(c,t,hov){bg(c,t);drawWave(c,t);HIT=[];for(let i=AV.length-1;i>=0;i--)HIT.push(drawAv(c,AV[i],t,hov===AV[i]));drawOwner(c,t);texts(c);brand(c);}
  const shareText=`我的互动宇宙 ${AV.length} 人出炉了 🌌\n本周和 ${data.week} 人有过互动\n${top3.length?"核心圈前三："+top3.map(a=>"@"+a.p.handle).join(" ")+"\n":""}测测你的互动宇宙 👉 ${SITE}?u=${encodeURIComponent(data.owner.handle)}`;
  const toBlob=(cv,type,q)=>new Promise(r=>cv.toBlob(r,type,q));
  return {AV,data,shareText,frame,hit:(x,y)=>HIT.slice().reverse().find(h=>Math.hypot(h.x-x,h.y-y)<h.r)||null,
    async poster(t=.9){const k=document.createElement("canvas");k.width=W;k.height=H;frame(k.getContext("2d"),t,null);return toBlob(k,"image/png");},
    // 动图：540×675，一个心跳周期 3 秒循环；末尾 0.75 秒与开头交叉淡化，星环旋转首尾无缝；多帧采样共用调色板
    async gif(prog){const {GIFEncoder,quantize,applyPalette}=await import("./vendor/gifenc.esm.js?v="+(window.ASSET_V||"1"));
      const GW=540,GH=675,N=43,DL=70,L=P,X=.75,k=document.createElement("canvas");k.width=W;k.height=H;const c=k.getContext("2d");
      const o=document.createElement("canvas");o.width=GW;o.height=GH;const oc=o.getContext("2d",{willReadFrequently:true});oc.imageSmoothingQuality="high";
      const shot=s=>{frame(c,s+X,null);oc.globalAlpha=1;oc.drawImage(k,0,0,GW,GH);if(s>L-X){frame(c,s+X-L,null);oc.globalAlpha=(s-(L-X))/X;oc.drawImage(k,0,0,GW,GH);oc.globalAlpha=1;}return oc.getImageData(0,0,GW,GH).data;};
      const smp=[0,.3,.6,1.2,2.4].map(s=>shot(s)),all=new Uint8Array(smp.length*GW*GH*4);smp.forEach((d,i)=>all.set(d,i*GW*GH*4));const pal=quantize(all,256);
      const enc=GIFEncoder();for(let f=0;f<N;f++){const px=shot(f*L/N);enc.writeFrame(applyPalette(px,pal),GW,GH,{palette:f?undefined:pal,delay:DL,repeat:0});prog?.((f+1)/N);await new Promise(r=>setTimeout(r));}
      enc.finish();return new Blob([enc.bytes()],{type:"image/gif"});}};
}
// 挂到页面：canvas + 悬停提示 + 点头像切到他的照片墙
let raf=0,cur=null;
async function mount(el,data,opt={}){cancelAnimationFrame(raf);const u=await create(data);if(opt.isStale?.())return null;cur=u;
  el.classList.add("uni");el.style.height="";el.innerHTML=`<canvas width="${W}" height="${H}" aria-label="@${data.owner.handle} 的互动宇宙"></canvas><div class="uTip"></div>`;
  const cv=el.querySelector("canvas"),g=cv.getContext("2d"),tip=el.querySelector(".uTip");let hov=null;
  const at=e=>{const b=cv.getBoundingClientRect();return u.hit((e.clientX-b.left)*W/b.width,(e.clientY-b.top)*H/b.height);};
  const show=(h)=>{const b=cv.getBoundingClientRect(),p=h.a.p;tip.style.left=(h.x*b.width/W)+"px";tip.style.top=((h.y-h.r)*b.height/H)+"px";tip.style.display="block";
    tip.innerHTML=p.src==="pool"?`@${p.handle}<small>补位 · 暂无互动数据</small>`:`@${p.handle} · <b>${p.count} 次互动</b><small>${RING[h.a.ri].name} · ${p.src==="wall"?"来自照片墙":`来自互评账本（我回 TA ${p.me_to} · TA 回我 ${p.to_me}）`}</small>`;};
  cv.onmousemove=e=>{const h=at(e);hov=h?.a||null;cv.style.cursor=h?"pointer":"default";if(h)show(h);else tip.style.display="none";};
  cv.onmouseleave=()=>{hov=null;tip.style.display="none";};
  cv.onclick=e=>{const h=at(e);if(!h)return;window.track?.("wall:uni_click");opt.onPick?.(h.a.p.handle,h.a.p);};
  const still=matchMedia("(prefers-reduced-motion: reduce)").matches,t0=performance.now();
  (function loop(now){if(!el.isConnected||cur!==u)return;raf=requestAnimationFrame(loop);if(document.hidden||!el.offsetParent)return;u.frame(g,still?.9:(now-t0)/1000,hov);})(t0);
  return u;}
window.Universe={build,create,mount,get current(){return cur}};
})();
