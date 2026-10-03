const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
let w=0,h=0,dpr=1;
const DESIGN_W=960,DESIGN_H=540;
const player={x:120,y:0,size:34,vy:0,onGround:false,rotation:0};
const gravity=1700,jump=-650,speed=260;
const groundHeight=90;
const baseSpikes=[
  {x:650,w:38,h:42},{x:850,w:38,h:42},
  {x:1080,w:38,h:42},{x:1125,w:38,h:42},
  {x:1370,w:38,h:42},{x:1580,w:38,h:42},
  {x:1810,w:38,h:42},{x:1855,w:38,h:42},{x:1900,w:38,h:42},
  {x:2180,w:38,h:42},{x:2440,w:38,h:42},
  {x:2680,w:38,h:42},{x:2725,w:38,h:42}
];
const baseBlocks=[
  {x:470,y:0,w:80,h:45},
  {x:1220,y:0,w:100,h:35},
  {x:1470,y:0,w:70,h:45},
  {x:2020,y:0,w:110,h:35},
  {x:2320,y:0,w:80,h:45},
  {x:2850,y:0,w:120,h:40}
];
let spikes=baseSpikes.map(o=>({...o}));
let blocks=baseBlocks.map(o=>({...o}));
let camera=0,dead=false,deathReason="",holding=false,playing=false;
let levelStartX=120;
const SAVE_KEY="nexusProgress_v1";
let progress={best:0};
function loadProgress(){
  try{
    const saved=localStorage.getItem(SAVE_KEY);
    if(saved){
      const data=JSON.parse(saved);
      if(Number.isFinite(data.best)) progress.best=Math.max(0,Math.min(100,Math.round(data.best)));
    }
  }catch(e){}
}
function saveProgress(){
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(progress));}catch(e){}
}
function updateBestProgress(){
  const endX=3000;
  const percent=Math.max(0,Math.min(100,Math.round(((player.x-levelStartX)/(endX-levelStartX))*100)));
  if(percent>progress.best){
    progress.best=percent;
    saveProgress();
    updateBestLabel();
  }
}
function updateBestLabel(){
  const el=document.getElementById("level1Best");
  if(el)el.textContent="BEST: "+progress.best+"% · FIRST FLIGHT";
}

function resize(){
  // 1.5x is a good mobile-friendly quality/performance ceiling.
  // The game is rendered at a fixed logical 960x540 resolution.
  dpr=Math.min(devicePixelRatio||1,1.5);
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
  // Start the selected level explicitly and remove every menu overlay.
  playing=true;
  editorMode=false;
  const menu=document.getElementById("menu");
  const levelMenu=document.getElementById("levelMenu");
  const password=document.getElementById("passwordMenu");
  const editor=document.getElementById("editorMenu");
  [menu,levelMenu,password,editor].forEach(el=>{
    if(el){
      el.classList.add("hidden");
      el.style.display="none";
    }
  });
  spikes=spikes.map(o=>({...o}));
  blocks=blocks.map(o=>({...o}));
  reset();
  last=performance.now();
  draw();
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
canvas.addEventListener("pointerdown",e=>{
  if(editorMode){return;}
  e.preventDefault();holding=true;doJump();
});
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
  const dt=Math.min((now-last)/1000,0.033);
  last=now;

  // Do not spend frames rendering the game underneath the menus.
  if(editorMode){
    drawEditor();
  }else if(playing){
    update(dt);
    draw();
  }

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
  updateBestProgress();

  // Cheap broad-phase first: only run the SAT collision test when shapes are nearby.
  const playerRight=player.x+player.size;
  const playerBottom=player.y+player.size;
  const baseY=h-groundHeight;

  for(const s of spikes){
    if(s.x>playerRight||s.x+s.w<player.x)continue;
    if(baseY-s.h>playerBottom||baseY<player.y)continue;
    if(accurateSpikeHit(s)){dead=true;deathReason="spike";break}
  }

  if(!dead){
    for(const b of blocks){
      const r=blockRect(b);
      if(r.x>playerRight||r.x+r.w<player.x||r.y>playerBottom||r.y+r.h<player.y)continue;
      if(accurateBlockHit(b)){dead=true;deathReason="block";break}
    }
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
  button.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();
    if(button.dataset.level==="1"){
      startGame();
    }
  });
});
loadProgress();
updateBestLabel();
reset();requestAnimationFrame(loop);


/* ===== Creator level maker =====
   This is a creator lock, not real security: the password is part of the
   browser game code. It is intended to keep normal players out of the editor.
*/
const CREATOR_PASSWORD="NEXUS-MAKER";
let editorMode=false;
let editorTool="block";
let editorCamera=0;
let editorObjects={blocks:[],spikes:[]};
let editorLevelLoaded=false;

const passwordMenu=document.getElementById("passwordMenu");
const editorMenu=document.getElementById("editorMenu");
const creatorPassword=document.getElementById("creatorPassword");
const passwordError=document.getElementById("passwordError");
const editorCanvas=document.getElementById("editorCanvas");
const ectx=editorCanvas.getContext("2d");

function showOverlay(el){
  el.classList.remove("hidden");
  el.style.display="flex";
}
function hideOverlay(el){
  el.classList.add("hidden");
  el.style.display="none";
}
function cloneObjects(){
  return {
    blocks:blocks.map(o=>({...o})),
    spikes:spikes.map(o=>({...o}))
  };
}
function loadCreatorLevel(){
  try{
    const saved=localStorage.getItem("nexusCreatorLevel");
    if(saved){
      const data=JSON.parse(saved);
      if(Array.isArray(data.blocks)&&Array.isArray(data.spikes)){
        editorObjects={
          blocks:data.blocks.filter(validBlock).map(o=>({...o})),
          spikes:data.spikes.filter(validSpike).map(o=>({...o}))
        };
        return;
      }
    }
  }catch(e){}
  editorObjects=cloneObjects();
}
function validBlock(o){
  return o&&Number.isFinite(o.x)&&Number.isFinite(o.y)&&Number.isFinite(o.w)&&Number.isFinite(o.h)
    &&o.w>0&&o.h>0&&o.w<=300&&o.h<=200&&o.x>=0&&o.x<=20000;
}
function validSpike(o){
  return o&&Number.isFinite(o.x)&&Number.isFinite(o.w)&&Number.isFinite(o.h)
    &&o.w>0&&o.h>0&&o.w<=120&&o.h<=150&&o.x>=0&&o.x<=20000;
}
function enterCreator(){
  creatorPassword.value="";
  passwordError.textContent="";
  hideOverlay(document.getElementById("menu"));
  hideOverlay(document.getElementById("levelMenu"));
  showOverlay(passwordMenu);
  setTimeout(()=>creatorPassword.focus(),50);
}
function unlockCreator(){
  if(creatorPassword.value===CREATOR_PASSWORD){
    hideOverlay(passwordMenu);
    openEditor();
  }else{
    passwordError.textContent="ACCESS DENIED";
    creatorPassword.value="";
    creatorPassword.focus();
  }
}
function openEditor(){
  playing=false;
  editorMode=true;
  editorCamera=0;
  loadCreatorLevel();
  showOverlay(editorMenu);
  resizeEditor();
  drawEditor();
}
function closeEditor(){
  editorMode=false;
  hideOverlay(editorMenu);
  showOverlay(document.getElementById("menu"));
}
function resizeEditor(){
  const rect=editorCanvas.getBoundingClientRect();
  const scale=Math.min(devicePixelRatio||1,1.5);
  editorCanvas.width=Math.max(1,Math.floor(rect.width*scale));
  editorCanvas.height=Math.max(1,Math.floor((rect.width*DESIGN_H/DESIGN_W)*scale));
  ectx.setTransform(scale,0,0,scale,0,0);
}
function editorSize(){
  const rect=editorCanvas.getBoundingClientRect();
  return {width:rect.width,height:rect.width*DESIGN_H/DESIGN_W};
}
function editorPoint(e){
  const rect=editorCanvas.getBoundingClientRect();
  const scaleX=DESIGN_W/rect.width;
  const scaleY=DESIGN_H/(rect.width*DESIGN_H/DESIGN_W);
  return {
    x:(e.clientX-rect.left)*scaleX+editorCamera,
    y:(e.clientY-rect.top)*scaleY
  };
}
function snap(n){return Math.round(n/20)*20}
function placeEditorObject(e){
  const p=editorPoint(e);
  const x=Math.max(0,snap(p.x));
  const floor=DESIGN_H-groundHeight;
  if(editorTool==="spike"){
    const existing=editorObjects.spikes.findIndex(s=>Math.abs(s.x-x)<24);
    if(existing>=0)editorObjects.spikes.splice(existing,1);
    else editorObjects.spikes.push({x,w:38,h:42});
  }else if(editorTool==="block"){
    const w=80,h=45;
    const top=Math.min(floor-h,Math.max(40,snap(p.y)));
    const y=Math.max(0,Math.round((floor-h-top)/20)*20);
    editorObjects.blocks.push({x,y,w,h});
  }else{
    const si=editorObjects.spikes.findIndex(s=>Math.abs(s.x-x)<30);
    if(si>=0){editorObjects.spikes.splice(si,1);return}
    const bi=editorObjects.blocks.findIndex(b=>{
      const r={x:b.x,y:floor-b.h-b.y,w:b.w,h:b.h};
      return x>=r.x-20&&x<=r.x+r.w+20&&p.y>=r.y-20&&p.y<=r.y+r.h+20;
    });
    if(bi>=0)editorObjects.blocks.splice(bi,1);
  }
  drawEditor();
}
function drawEditor(){
  const size=editorSize();
  const scale=size.width/DESIGN_W;
  ectx.setTransform(scale,0,0,scale,0,0);
  ectx.clearRect(0,0,DESIGN_W,DESIGN_H);
  ectx.fillStyle="#10131c";ectx.fillRect(0,0,DESIGN_W,DESIGN_H);
  ectx.fillStyle="#252b38";ectx.fillRect(0,DESIGN_H-groundHeight,DESIGN_W,groundHeight);
  ectx.strokeStyle="#303b4d";ectx.lineWidth=1;
  for(let x=Math.floor(editorCamera/20)*20;x<editorCamera+DESIGN_W+20;x+=20){
    ectx.beginPath();ectx.moveTo(x-editorCamera,0);ectx.lineTo(x-editorCamera,DESIGN_H);ectx.stroke();
  }
  for(let y=0;y<DESIGN_H;y+=20){
    ectx.beginPath();ectx.moveTo(0,y);ectx.lineTo(DESIGN_W,y);ectx.stroke();
  }
  ectx.strokeStyle="#4dd7ff";ectx.lineWidth=3;
  ectx.beginPath();ectx.moveTo(0,DESIGN_H-groundHeight);ectx.lineTo(DESIGN_W,DESIGN_H-groundHeight);ectx.stroke();

  const floor=DESIGN_H-groundHeight;
  for(const b of editorObjects.blocks){
    const r={x:b.x,y:floor-b.h-b.y,w:b.w,h:b.h};
    const x=r.x-editorCamera;
    if(x+r.w<0||x>DESIGN_W)continue;
    ectx.fillStyle="#59616d";ectx.fillRect(x,r.y,r.w,r.h);
    ectx.strokeStyle="#7be4ff";ectx.lineWidth=2;ectx.strokeRect(x,r.y,r.w,r.h);
  }
  for(const s of editorObjects.spikes){
    const x=s.x-editorCamera;
    if(x<-s.w||x>DESIGN_W)continue;
    ectx.beginPath();ectx.moveTo(x,floor);ectx.lineTo(x+s.w/2,floor-s.h);ectx.lineTo(x+s.w,floor);ectx.closePath();
    ectx.fillStyle="#e94b5f";ectx.fill();
  }
  ectx.fillStyle="#f2f6ff";ectx.font="bold 14px system-ui";ectx.textAlign="left";
  ectx.fillText("X: "+Math.round(editorCamera)+"   TOOL: "+editorTool.toUpperCase(),12,24);
}
function saveCreatorLevel(){
  localStorage.setItem("nexusCreatorLevel",JSON.stringify(editorObjects));
  editorLevelLoaded=true;
  document.getElementById("editorStatus").textContent="LEVEL SAVED · "+editorObjects.blocks.length+" blocks · "+editorObjects.spikes.length+" spikes";
}
function clearCreatorLevel(){
  editorObjects={blocks:[],spikes:[]};
  drawEditor();
  document.getElementById("editorStatus").textContent="EMPTY LEVEL · choose a tool and place objects";
}
function testCreatorLevel(){
  spikes=editorObjects.spikes.map(o=>({...o}));
  blocks=editorObjects.blocks.map(o=>({...o}));
  if(!spikes.length&&!blocks.length){
    document.getElementById("editorStatus").textContent="ADD AT LEAST ONE BLOCK OR SPIKE FIRST";
    return;
  }
  hideOverlay(editorMenu);
  editorMode=false;
  startGame();
}
function setEditorTool(tool){
  editorTool=tool;
  document.querySelectorAll(".editorTools .tool").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));
  document.getElementById("editorStatus").textContent=tool.toUpperCase()+" selected · tap the grid to place";
}

document.getElementById("creator").addEventListener("click",enterCreator);
document.getElementById("unlockCreator").addEventListener("click",unlockCreator);
document.getElementById("cancelCreator").addEventListener("click",()=>{
  hideOverlay(passwordMenu);showOverlay(document.getElementById("menu"));
});
creatorPassword.addEventListener("keydown",e=>{if(e.key==="Enter")unlockCreator()});
document.getElementById("closeEditor").addEventListener("click",closeEditor);
document.querySelectorAll(".editorTools .tool").forEach(b=>b.addEventListener("click",()=>setEditorTool(b.dataset.tool)));
document.getElementById("editorLeft").addEventListener("click",()=>{editorCamera=Math.max(0,editorCamera-100);drawEditor()});
document.getElementById("editorRight").addEventListener("click",()=>{editorCamera=Math.min(19000,editorCamera+100);drawEditor()});
document.getElementById("saveLevel").addEventListener("click",saveCreatorLevel);
document.getElementById("testLevel").addEventListener("click",testCreatorLevel);
document.getElementById("clearLevel").addEventListener("click",clearCreatorLevel);
editorCanvas.addEventListener("pointerdown",e=>{e.preventDefault();placeEditorObject(e)});
addEventListener("resize",()=>{if(editorMode){resizeEditor();drawEditor()}});

// Keep the normal level select working with the current saved creator level.
document.querySelector('.level[data-level="1"]').addEventListener("click",()=>{
  const saved=localStorage.getItem("nexusCreatorLevel");
  if(saved){
    try{
      const data=JSON.parse(saved);
      if(Array.isArray(data.blocks)&&Array.isArray(data.spikes)){
        blocks=data.blocks.filter(validBlock).map(o=>({...o}));
        spikes=data.spikes.filter(validSpike).map(o=>({...o}));
      }
    }catch(e){}
  }
});
