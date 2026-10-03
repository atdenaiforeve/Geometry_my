const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
let w=0,h=0,dpr=1;
const DESIGN_W=960,DESIGN_H=540;
const player={x:120,y:0,size:34,vy:0,onGround:false,rotation:0};
const gravity=1700,jump=-650,speed=260;
const groundHeight=90;
const spikes=[
  {x:650,w:38,h:42},{x:850,w:38,h:42},
  {x:1080,w:38,h:42},{x:1125,w:38,h:42},
  {x:1370,w:38,h:42},{x:1580,w:38,h:42},
  {x:1810,w:38,h:42},{x:1855,w:38,h:42},{x:1900,w:38,h:42},
  {x:2180,w:38,h:42},{x:2440,w:38,h:42},
  {x:2680,w:38,h:42},{x:2725,w:38,h:42}
];
const blocks=[
  {x:470,y:0,w:80,h:45},
  {x:1220,y:0,w:100,h:35},
  {x:1470,y:0,w:70,h:45},
  {x:2020,y:0,w:110,h:35},
  {x:2320,y:0,w:80,h:45},
  {x:2850,y:0,w:120,h:40}
];
let camera=0,dead=false,deathReason="",holding=false,playing=false;

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  w=DESIGN_W;h=DESIGN_H;
  canvas.width=w*dpr;canvas.height=h*dpr;
  const scale=Math.min(innerWidth/DESIGN_W,innerHeight/DESIGN_H);
  canvas.style.width=`${DESIGN_W*scale}px`;
  canvas.style.height=`${DESIGN_H*scale}px`;
  canvas.style.position="absolute";
  canvas.style.left="50%";
  canvas.style.top="50%";
  canvas.style.transform="translate(-50%,-50%)";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize",resize);resize();

function startGame(){
  playing=true;
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("menu").style.display="none";
  document.getElementById("levelMenu").classList.add("hidden");
  document.getElementById("levelMenu").style.display="none";
  reset();
}
function reset(){
  player.x=120;player.y=h-groundHeight-player.size;player.vy=0;player.onGround=true;player.rotation=0;
  camera=0;dead=false;deathReason="";
}
function doJump(){
  if(dead){reset();return}
  if(player.onGround){player.vy=jump;player.onGround=false}
}
addEventListener("keydown",e=>{
  if(e.code==="Space"||e.code==="ArrowUp"){
    e.preventDefault();
    holding=true;
    doJump();
  }
});
addEventListener("keyup",e=>{
  if(e.code==="Space"||e.code==="ArrowUp")holding=false;
});
canvas.addEventListener("pointerdown",e=>{e.preventDefault();holding=true;doJump()});
addEventListener("pointerup",()=>holding=false);
addEventListener("pointercancel",()=>holding=false);

function project(poly,axis){
  let min=Infinity,max=-Infinity;
  for(const p of poly){
    const v=p.x*axis.x+p.y*axis.y;
    if(v<min)min=v;if(v>max)max=v;
  }
  return {min,max};
}
function polygonsOverlap(a,b){
  for(const poly of [a,b]){
    for(let i=0;i<poly.length;i++){
      const p1=poly[i],p2=poly[(i+1)%poly.length];
      const edge={x:p2.x-p1.x,y:p2.y-p1.y};
      const axis={x:-edge.y,y:edge.x};
      const len=Math.hypot(axis.x,axis.y);
      axis.x/=len;axis.y/=len;
      const pa=project(a,axis),pb=project(b,axis);
      if(pa.max<pb.min||pb.max<pa.min)return false;
    }
  }
  return true;
}
function playerPolygon(){
  return [
    {x:player.x,y:player.y},
    {x:player.x+player.size,y:player.y},
    {x:player.x+player.size,y:player.y+player.size},
    {x:player.x,y:player.y+player.size}
  ];
}
function spikePolygon(s){
  const baseY=h-groundHeight;
  return [
    {x:s.x,y:baseY},
    {x:s.x+s.w/2,y:baseY-s.h},
    {x:s.x+s.w,y:baseY}
  ];
}
function accurateSpikeHit(s){return polygonsOverlap(playerPolygon(),spikePolygon(s));}
function blockRect(b){
  const floor=h-groundHeight;
  return {x:b.x,y:floor-b.h-b.y,w:b.w,h:b.h};
}
function accurateBlockHit(b){
  const r=blockRect(b);
  const p=playerPolygon();
  const q=[
    {x:r.x,y:r.y},{x:r.x+r.w,y:r.y},
    {x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}
  ];
  return polygonsOverlap(p,q);
}

let last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,0.033);last=now;
  if(playing)update(dt);
  draw();
  requestAnimationFrame(loop);
}
function update(dt){
  if(dead)return;
  player.x+=speed*dt;
  player.vy+=gravity*dt;
  player.y+=player.vy*dt;
  if(!player.onGround) player.rotation += (speed/player.size)*dt*Math.PI/2;

  const floor=h-groundHeight-player.size;
  if(player.y>=floor){
    player.y=floor;player.vy=0;player.onGround=true;
    player.rotation=Math.round(player.rotation/(Math.PI/2))*(Math.PI/2);
    if(holding)doJump();
  }else player.onGround=false;

  camera=Math.max(0,player.x-180);

  for(const s of spikes){
    if(accurateSpikeHit(s)){dead=true;deathReason="spike";break}
  }
  for(const b of blocks){
    if(accurateBlockHit(b)){dead=true;deathReason="block";break}
  }
}
function draw(){
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#171a22";ctx.fillRect(0,0,w,h);

  ctx.fillStyle="#303640";ctx.fillRect(0,h-groundHeight,w,groundHeight);
  ctx.fillStyle="#59616d";ctx.fillRect(0,h-groundHeight,w,6);

  ctx.strokeStyle="#3d4550";ctx.lineWidth=2;
  const start=Math.floor(camera/50)*50;
  for(let x=start;x<camera+w+50;x+=50){
    ctx.strokeRect(x-camera,h-groundHeight+6,50,50);
  }

  for(const b of blocks){
    const r=blockRect(b),x=r.x-camera;
    if(x+r.w<0||x>w)continue;
    ctx.fillStyle="#59616d";ctx.fillRect(x,r.y,r.w,r.h);
    ctx.strokeStyle="#7b8796";ctx.lineWidth=2;ctx.strokeRect(x,r.y,r.w,r.h);
  }

  for(const s of spikes){
    const x=s.x-camera;
    if(x<-s.w||x>w)continue;
    ctx.beginPath();
    ctx.moveTo(x,h-groundHeight);
    ctx.lineTo(x+s.w/2,h-groundHeight-s.h);
    ctx.lineTo(x+s.w,h-groundHeight);
    ctx.closePath();
    ctx.fillStyle="#e94b5f";ctx.fill();
  }

  const px=player.x-camera;
  ctx.save();
  ctx.translate(px+player.size/2,player.y+player.size/2);
  ctx.rotate(player.rotation);
  ctx.fillStyle="#4dd7ff";
  ctx.fillRect(-player.size/2,-player.size/2,player.size,player.size);
  ctx.strokeStyle="#b8f2ff";ctx.lineWidth=3;
  ctx.strokeRect(-player.size/2+1.5,-player.size/2+1.5,player.size-3,player.size-3);
  ctx.restore();

  if(dead){
    ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#fff";ctx.textAlign="center";
    ctx.font="bold 30px system-ui";ctx.fillText(deathReason==="block"?"You hit a block!":"You hit a spike!",w/2,h/2-10);
    ctx.font="18px system-ui";ctx.fillText("Tap or press Space to restart",w/2,h/2+28);
  }
}
document.getElementById("play").addEventListener("click",()=>{
  playing=false;
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("menu").style.display="none";
  document.getElementById("levelMenu").classList.remove("hidden");
  document.getElementById("levelMenu").style.display="flex";
});
document.getElementById("back").addEventListener("click",()=>{
  playing=false;
  document.getElementById("levelMenu").classList.add("hidden");
  document.getElementById("levelMenu").style.display="none";
  document.getElementById("menu").classList.remove("hidden");
  document.getElementById("menu").style.display="flex";
});
document.querySelectorAll(".level").forEach(button=>{
  button.addEventListener("click",()=>{
    if(button.dataset.level==="1")startGame();
  });
});
reset();requestAnimationFrame(loop);
