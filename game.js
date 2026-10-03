const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
let w=0,h=0,dpr=1;
const DESIGN_W=960,DESIGN_H=540;
const player={x:120,y:0,size:34,vy:0,onGround:false,rotation:0};
const CHARACTER_COLOR_KEY="nexusCharacterColor_v1";
const CHARACTER_PAINT_KEY="nexusCharacterPaint_v1";
const PAINT_SIZE=12;
let characterColor="#4dd7ff";
let paintGrid=Array(PAINT_SIZE*PAINT_SIZE).fill(null);
let paintHistory=[];
let paintEraser=false;
let useProPaint=false;
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
let creatorTestMode=false;
let creatorTestEndX=3000;
const SAVE_KEY="nexusProgress_v1";
let progress={best:0};
function loadCharacterColor(){
  try{
    const saved=localStorage.getItem(CHARACTER_COLOR_KEY);
    if(/^#[0-9a-fA-F]{6}$/.test(saved||"")) characterColor=saved;
  }catch(e){}
}
function saveCharacterColor(){
  try{localStorage.setItem(CHARACTER_COLOR_KEY,characterColor)}catch(e){}
}
function loadCharacterPaint(){
  try{
    const saved=JSON.parse(localStorage.getItem(CHARACTER_PAINT_KEY)||"null");
    if(Array.isArray(saved)&&saved.length===PAINT_SIZE*PAINT_SIZE){
      paintGrid=saved.map(v=>/^#[0-9A-Fa-f]{6}$/.test(v||"")?v:null);
    }
  }catch(e){}
}
function saveCharacterPaint(){
  try{localStorage.setItem(CHARACTER_PAINT_KEY,JSON.stringify(paintGrid))}catch(e){}
}
function paintHasAny(){return useProPaint&&paintGrid.some(Boolean)}
function drawPaintedCharacter(target,size){
  const p=target;
  const cell=size/PAINT_SIZE;
  for(let y=0;y<PAINT_SIZE;y++)for(let x=0;x<PAINT_SIZE;x++){
    const color=paintGrid[y*PAINT_SIZE+x];
    if(color){p.fillStyle=color;p.fillRect(x*cell,y*cell,cell+.5,cell+.5)}
  }
}
function drawCharacterPreview(){
  const c=document.getElementById("characterPreviewCanvas");
  if(!c)return;
  const p=c.getContext("2d");
  p.clearRect(0,0,c.width,c.height);
  p.fillStyle="rgba(5,3,10,.45)";p.fillRect(0,0,c.width,c.height);
  p.save();
  p.translate(c.width/2,c.height/2);
  p.rotate(-0.18);
  const size=110;
  p.fillStyle="#10131d";p.fillRect(-size/2,-size/2,size,size);
  p.save();p.translate(-size/2,-size/2);
  if(paintHasAny())drawPaintedCharacter(p,size);
  else{p.fillStyle=characterColor;p.fillRect(0,0,size,size)}
  p.restore();
  p.strokeStyle="#ffffff";p.lineWidth=5;p.strokeRect(-size/2+2.5,-size/2+2.5,size-5,size-5);
  p.restore();
}
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
  if(editorMode===false && creatorTestMode) updateCreatorCompletion();
  const progressEndX=creatorTestMode?creatorTestEndX:3000;
  const percent=Math.max(0,Math.min(100,Math.round(((player.x-levelStartX)/(progressEndX-levelStartX))*100)));
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
function updateCreatorCompletion(){
  if(creatorTestMode && player.x>=creatorTestEndX){
    creatorTestBeat=true;
    creatorTestMode=false;
    const status=document.getElementById("editorStatus");
    if(status)status.textContent="✓ LEVEL BEAT · READY TO PUBLISH";
  }
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
  updateCreatorCompletion();

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
  if(paintHasAny()){
    ctx.save();ctx.translate(-player.size/2,-player.size/2);drawPaintedCharacter(ctx,player.size);ctx.restore();
  }else{
    ctx.fillStyle=characterColor;
    ctx.fillRect(-player.size/2,-player.size/2,player.size,player.size);
  }
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
loadCharacterColor();
loadCharacterPaint();

function drawPaintEditor(){
  const c=document.getElementById("paintCanvas"); if(!c)return;
  const p=c.getContext("2d"),size=c.width,cell=size/PAINT_SIZE;
  p.clearRect(0,0,size,size);
  p.fillStyle="#0b0814";p.fillRect(0,0,size,size);
  for(let y=0;y<PAINT_SIZE;y++)for(let x=0;x<PAINT_SIZE;x++){
    const color=paintGrid[y*PAINT_SIZE+x];
    p.fillStyle=color||((x+y)%2?"#11101b":"#0d0c15");
    p.fillRect(x*cell,y*cell,cell,cell);
    p.strokeStyle="rgba(255,255,255,.13)";p.lineWidth=1;p.strokeRect(x*cell+.5,y*cell+.5,cell-1,cell-1);
  }
  p.strokeStyle="#00e5ff";p.lineWidth=4;p.strokeRect(2,2,size-4,size-4);
}
function paintAtEvent(e){
  const c=document.getElementById("paintCanvas");if(!c)return;
  const r=c.getBoundingClientRect();
  const x=Math.max(0,Math.min(PAINT_SIZE-1,Math.floor((e.clientX-r.left)/r.width*PAINT_SIZE)));
  const y=Math.max(0,Math.min(PAINT_SIZE-1,Math.floor((e.clientY-r.top)/r.height*PAINT_SIZE)));
  const i=y*PAINT_SIZE+x;
  const next=paintEraser?null:document.getElementById("paintColor").value.toUpperCase();
  if(paintGrid[i]===next)return;
  paintGrid[i]=next;saveCharacterPaint();drawPaintEditor();drawCharacterPreview();
}
function paintSnapshot(){return paintGrid.slice()}
function paintUndo(){
  const old=paintHistory.pop();if(!old)return;
  paintGrid=old;saveCharacterPaint();drawPaintEditor();drawCharacterPreview();
}
function switchCustomizeMode(mode){
  const pro=mode==="pro";
  useProPaint=pro;
  document.getElementById("autoColorPanel").classList.toggle("hidden",pro);
  document.getElementById("proCreatePanel").classList.toggle("hidden",!pro);
  document.getElementById("autoColorMode").classList.toggle("active",!pro);
  document.getElementById("proCreateMode").classList.toggle("active",pro);
  if(pro)drawPaintEditor();else drawCharacterPreview();
}

document.getElementById("customize").addEventListener("click",()=>{
  playing=false;
  hideOverlay(document.getElementById("menu"));
  showOverlay(document.getElementById("customizeMenu"));
  const input=document.getElementById("characterColor");
  const value=document.getElementById("characterColorValue");
  if(input)input.value=characterColor;
  if(value)value.textContent=characterColor.toUpperCase();
  switchCustomizeMode("auto");
  drawCharacterPreview();
});
document.getElementById("customizeBack").addEventListener("click",()=>{
  hideOverlay(document.getElementById("customizeMenu"));
  showOverlay(document.getElementById("menu"));
});
document.getElementById("autoColorMode").addEventListener("click",()=>switchCustomizeMode("auto"));
document.getElementById("proCreateMode").addEventListener("click",()=>switchCustomizeMode("pro"));
document.getElementById("paintColor").addEventListener("input",e=>{
  document.getElementById("paintColorValue").textContent=e.target.value.toUpperCase();
  paintEraser=false;document.getElementById("paintEraser").classList.remove("active");
});
document.getElementById("paintEraser").addEventListener("click",()=>{
  paintEraser=!paintEraser;document.getElementById("paintEraser").classList.toggle("active",paintEraser);
});
document.getElementById("paintClear").addEventListener("click",()=>{
  paintHistory.push(paintSnapshot());paintGrid=Array(PAINT_SIZE*PAINT_SIZE).fill(null);saveCharacterPaint();drawPaintEditor();drawCharacterPreview();
});
document.getElementById("paintUndo").addEventListener("click",paintUndo);
document.getElementById("paintDone").addEventListener("click",()=>switchCustomizeMode("auto"));
const paintCanvas=document.getElementById("paintCanvas");
let painting=false;
paintCanvas.addEventListener("pointerdown",e=>{e.preventDefault();paintHistory.push(paintSnapshot());painting=true;paintAtEvent(e);paintCanvas.setPointerCapture?.(e.pointerId)});
paintCanvas.addEventListener("pointermove",e=>{if(painting){e.preventDefault();paintAtEvent(e)}});
paintCanvas.addEventListener("pointerup",()=>painting=false);
paintCanvas.addEventListener("pointercancel",()=>painting=false);

document.getElementById("characterColor").addEventListener("input",e=>{
  characterColor=e.target.value.toUpperCase();
  document.getElementById("characterColorValue").textContent=characterColor;
  saveCharacterColor();
  drawCharacterPreview();
});

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
let editorModeTab="build";
let editorCamera=0;
let editorZoom=1;
let editorGridOn=true;
let editorSnapOn=true;
let editorObjects={blocks:[],spikes:[]};
let editorHistory=[];
let editorRedoStack=[];
let editorSelected=null;
let editorDragging=false;
let editorLastPointer=null;
let editorLevelLoaded=false;
let editorClipboard=null;
let creatorTestBeat=false;
const CREATOR_SAVE_KEY="nexusCreatorLevel";
const OFFICIAL_LEVELS_KEY="nexusOfficialLevels_v1";

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
    const saved=localStorage.getItem(CREATOR_SAVE_KEY);
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
  editorZoom=1;
  editorModeTab="build";
  editorSelected=null;
  creatorTestBeat=false;
  creatorTestMode=false;
  editorHistory=[];
  editorRedoStack=[];
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
function editorSnapshot(){return JSON.stringify(editorObjects)}
function restoreEditorSnapshot(s){
  try{
    const d=JSON.parse(s);
    editorObjects={
      blocks:Array.isArray(d.blocks)?d.blocks.map(o=>({...o})):[],
      spikes:Array.isArray(d.spikes)?d.spikes.map(o=>({...o})):[]
    };
    editorSelected=null;
  }catch(e){}
}
function pushEditorHistory(){
  editorHistory.push(editorSnapshot());
  if(editorHistory.length>60)editorHistory.shift();
  editorRedoStack=[];
}
function undoEditor(){
  if(!editorHistory.length)return;
  editorRedoStack.push(editorSnapshot());
  restoreEditorSnapshot(editorHistory.pop());
  drawEditor();
}
function redoEditor(){
  if(!editorRedoStack.length)return;
  editorHistory.push(editorSnapshot());
  restoreEditorSnapshot(editorRedoStack.pop());
  drawEditor();
}
function editorWorldPoint(e){
  const rect=editorCanvas.getBoundingClientRect();
  const viewW=rect.width;
  const viewH=viewW*DESIGN_H/DESIGN_W;
  return {
    x:(e.clientX-rect.left)*(DESIGN_W/rect.width)/editorZoom+editorCamera,
    y:(e.clientY-rect.top)*(DESIGN_H/viewH)/editorZoom
  };
}
function editorHitObject(p){
  const floor=DESIGN_H-groundHeight;
  for(let i=editorObjects.spikes.length-1;i>=0;i--){
    const s=editorObjects.spikes[i];
    if(p.x>=s.x-12&&p.x<=s.x+s.w+12&&p.y>=floor-s.h-12&&p.y<=floor+12)return {type:"spike",index:i};
  }
  for(let i=editorObjects.blocks.length-1;i>=0;i--){
    const b=editorObjects.blocks[i],r={x:b.x,y:floor-b.h-b.y,w:b.w,h:b.h};
    if(p.x>=r.x-8&&p.x<=r.x+r.w+8&&p.y>=r.y-8&&p.y<=r.y+r.h+8)return {type:"block",index:i};
  }
  return null;
}
function editorDeleteHit(hit){
  if(!hit)return;
  pushEditorHistory();
  if(hit.type==="spike")editorObjects.spikes.splice(hit.index,1);
  else editorObjects.blocks.splice(hit.index,1);
  editorSelected=null;
}
function placeEditorObject(e){
  const p=editorWorldPoint(e);
  const grid=editorSnapOn?20:4;
  const x=Math.max(0,Math.round(p.x/grid)*grid);
  const floor=DESIGN_H-groundHeight;

  if(editorModeTab==="edit"||editorModeTab==="delete"){
    const hit=editorHitObject(p);
    if(editorModeTab==="delete"){editorDeleteHit(hit);drawEditor();return}
    editorSelected=hit;
    editorDragging=!!hit;
    editorLastPointer=p;
    drawEditor();
    return;
  }

  pushEditorHistory();
  if(editorTool==="erase"){
    editorDeleteHit(editorHitObject(p));
  }else if(editorTool==="spike"){
    editorObjects.spikes.push({x,w:38,h:42});
  }else{
    const presets={
      block:{w:80,h:45,style:"core"},
      platform:{w:120,h:28,style:"edge"},
      energy:{w:80,h:45,style:"energy"},
      reality:{w:100,h:55,style:"reality"}
    };
    const q=presets[editorTool]||presets.block;
    const top=Math.max(20,Math.min(floor-q.h,Math.round(p.y/grid)*grid));
    editorObjects.blocks.push({x,y:Math.max(0,Math.round((floor-q.h-top)/grid)*grid),w:q.w,h:q.h,style:q.style});
  }
  drawEditor();
}
function moveSelectedEditor(e){
  if(!editorDragging||!editorSelected)return;
  const p=editorWorldPoint(e);
  const dx=p.x-editorLastPointer.x,dy=p.y-editorLastPointer.y;
  const grid=editorSnapOn?20:4;
  if(editorSelected.type==="spike"){
    const s=editorObjects.spikes[editorSelected.index];
    if(s){s.x=Math.max(0,Math.round((s.x+dx)/grid)*grid)}
  }else{
    const b=editorObjects.blocks[editorSelected.index];
    if(b){
      b.x=Math.max(0,Math.round((b.x+dx)/grid)*grid);
      b.y=Math.max(0,Math.round((b.y-dy)/grid)*grid);
    }
  }
  editorLastPointer=p;
  drawEditor();
}
function finishEditorDrag(){editorDragging=false}
function drawEditor(){
  const size=editorSize();
  const scale=size.width/DESIGN_W;
  ectx.setTransform(scale,0,0,scale,0,0);
  ectx.clearRect(0,0,DESIGN_W,DESIGN_H);
  ectx.fillStyle="#07050e";ectx.fillRect(0,0,DESIGN_W,DESIGN_H);
  ectx.save();
  ectx.scale(editorZoom,editorZoom);
  ectx.translate(-editorCamera/editorZoom,0);
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
  if(editorSelected){
    const floor=DESIGN_H-groundHeight;
    let r=null;
    if(editorSelected.type==="block"){
      const b=editorObjects.blocks[editorSelected.index];
      if(b)r={x:b.x,y:floor-b.h-b.y,w:b.w,h:b.h};
    }else{
      const s=editorObjects.spikes[editorSelected.index];
      if(s)r={x:s.x,y:floor-s.h,w:s.w,h:s.h};
    }
    if(r){
      ectx.strokeStyle="#ffffff";ectx.lineWidth=3/editorZoom;
      ectx.strokeRect(r.x-editorCamera-4,r.y-4,r.w+8,r.h+8);
    }
  }
  ectx.restore();
  ectx.setTransform(scale,0,0,scale,0,0);
  ectx.fillStyle="#f2f6ff";ectx.font="bold 14px system-ui";ectx.textAlign="left";
  ectx.fillText("X: "+Math.round(editorCamera)+"  "+editorModeTab.toUpperCase()+"  "+editorTool.toUpperCase(),12,24);
}
function saveCreatorLevel(){
  localStorage.setItem(CREATOR_SAVE_KEY,JSON.stringify(editorObjects));
  editorLevelLoaded=true;
  document.getElementById("editorStatus").textContent="LEVEL SAVED · "+editorObjects.blocks.length+" blocks · "+editorObjects.spikes.length+" spikes";
}
function clearCreatorLevel(){
  editorObjects={blocks:[],spikes:[]};
  drawEditor();
  document.getElementById("editorStatus").textContent="EMPTY LEVEL · choose a tool and place objects";
}
function testCreatorLevel(){
  if(!editorObjects.spikes.length&&!editorObjects.blocks.length){
    document.getElementById("editorStatus").textContent="ADD AT LEAST ONE BLOCK OR SPIKE FIRST";
    return;
  }
  spikes=editorObjects.spikes.map(o=>({...o}));
  blocks=editorObjects.blocks.map(o=>({...o}));
  creatorTestBeat=false;
  creatorTestMode=true;
  const furthest=Math.max(120,...editorObjects.blocks.map(o=>o.x+o.w),...editorObjects.spikes.map(o=>o.x+o.w));
  creatorTestEndX=Math.max(1000,furthest+300);
  hideOverlay(editorMenu);
  editorMode=false;
  startGame();
}
function selectedObjectClone(){
  if(!editorSelected)return null;
  if(editorSelected.type==="block"){
    const b=editorObjects.blocks[editorSelected.index];
    return b?{type:"block",data:{...b}}:null;
  }
  const s=editorObjects.spikes[editorSelected.index];
  return s?{type:"spike",data:{...s}}:null;
}
function copyEditorObject(){
  const copy=selectedObjectClone();
  if(!copy){document.getElementById("editorStatus").textContent="COPY · select an object first";return;}
  editorClipboard=copy;
  document.getElementById("editorStatus").textContent="COPIED · "+copy.type.toUpperCase();
}
function pasteEditorObject(){
  if(!editorClipboard){document.getElementById("editorStatus").textContent="PASTE · nothing copied yet";return;}
  pushEditorHistory();
  const d={...editorClipboard.data,x:editorClipboard.data.x+40};
  if(editorClipboard.type==="spike"){
    editorObjects.spikes.push(d);
    editorSelected={type:"spike",index:editorObjects.spikes.length-1};
  }else{
    editorObjects.blocks.push(d);
    editorSelected={type:"block",index:editorObjects.blocks.length-1};
  }
  editorModeTab="edit";
  document.querySelectorAll(".modeTab").forEach(x=>x.classList.toggle("active",x.dataset.mode==="edit"));
  document.getElementById("editorStatus").textContent="PASTED · drag the copy into place";
  drawEditor();
}
function moveTool(){
  editorModeTab="edit";
  document.querySelectorAll(".modeTab").forEach(x=>x.classList.toggle("active",x.dataset.mode==="edit"));
  document.getElementById("editorStatus").textContent="MOVE · tap a block, then drag it";
}
function loadOfficialLevels(){
  try{
    const data=JSON.parse(localStorage.getItem(OFFICIAL_LEVELS_KEY)||"[]");
    return Array.isArray(data)?data.filter(x=>x&&Array.isArray(x.blocks)&&Array.isArray(x.spikes)):[];
  }catch(e){return []}
}
function saveOfficialLevel(){
  if(!creatorTestBeat){
    document.getElementById("editorStatus").textContent="PUBLISH LOCKED · BEAT YOUR LEVEL IN TEST MODE FIRST";
    return;
  }
  const name=(document.getElementById("levelName")?.value||"NEXUS CREATION").trim().slice(0,28)||"NEXUS CREATION";
  const blocksCopy=editorObjects.blocks.map(o=>({...o}));
  const spikesCopy=editorObjects.spikes.map(o=>({...o}));
  if(!blocksCopy.length&&!spikesCopy.length){
    document.getElementById("editorStatus").textContent="PUBLISH FAILED · ADD SOME OBJECTS FIRST";
    return;
  }
  const levels=loadOfficialLevels();
  const id=Date.now();
  levels.push({id,name,blocks:blocksCopy,spikes:spikesCopy,publishedAt:new Date().toISOString()});
  localStorage.setItem(OFFICIAL_LEVELS_KEY,JSON.stringify(levels));
  localStorage.setItem(CREATOR_SAVE_KEY,JSON.stringify(editorObjects));
  refreshOfficialLevelMenu();
  document.getElementById("editorStatus").textContent="✓ OFFICIAL LEVEL PUBLISHED · "+name;
}
function playOfficialLevel(id){
  const level=loadOfficialLevels().find(x=>String(x.id)===String(id));
  if(!level)return;
  blocks=level.blocks.map(o=>({...o}));
  spikes=level.spikes.map(o=>({...o}));
  startGame();
}
function refreshOfficialLevelMenu(){
  const container=document.getElementById("officialLevels");
  if(!container)return;
  container.innerHTML="";
  for(const level of loadOfficialLevels()){
    const button=document.createElement("button");
    button.className="level officialLevel";button.type="button";button.dataset.officialId=level.id;
    button.innerHTML="OFFICIAL · "+escapeHtml(level.name)+' <span>CREATOR LEVEL</span>';
    button.addEventListener("click",()=>playOfficialLevel(level.id));
    container.appendChild(button);
  }
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function setEditorTool(tool){
  editorTool=tool;
  document.querySelectorAll(".editorTools .tool").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));
  document.getElementById("editorStatus").textContent=tool.toUpperCase()+" selected · tap the grid to place";
}

document.getElementById("creator").addEventListener("click",enterCreator);
document.getElementById("editorMove").addEventListener("click",moveTool);
document.getElementById("editorCopy").addEventListener("click",copyEditorObject);
document.getElementById("editorPaste").addEventListener("click",pasteEditorObject);
document.getElementById("publishLevel").addEventListener("click",saveOfficialLevel);
refreshOfficialLevelMenu();
document.getElementById("unlockCreator").addEventListener("click",unlockCreator);
document.getElementById("cancelCreator").addEventListener("click",()=>{
  hideOverlay(passwordMenu);showOverlay(document.getElementById("menu"));
});
creatorPassword.addEventListener("keydown",e=>{if(e.key==="Enter")unlockCreator()});
document.getElementById("closeEditor").addEventListener("click",closeEditor);
document.querySelectorAll(".editorTools .tool").forEach(b=>b.addEventListener("click",()=>{
  setEditorTool(b.dataset.tool);
  editorModeTab="build";
  document.querySelectorAll(".modeTab").forEach(x=>x.classList.toggle("active",x.dataset.mode==="build"));
}));
document.querySelectorAll(".modeTab").forEach(b=>b.addEventListener("click",()=>{
  editorModeTab=b.dataset.mode;
  document.querySelectorAll(".modeTab").forEach(x=>x.classList.toggle("active",x===b));
  document.getElementById("editorStatus").textContent=editorModeTab==="build"?"BUILD · choose an object, then tap the grid":editorModeTab==="edit"?"EDIT · tap an object to select and drag it":"DELETE · tap an object to remove it";
}));
document.getElementById("editorUndo").addEventListener("click",undoEditor);
document.getElementById("editorRedo").addEventListener("click",redoEditor);
document.getElementById("editorGrid").addEventListener("click",e=>{
  editorGridOn=!editorGridOn;e.target.textContent="GRID: "+(editorGridOn?"ON":"OFF");drawEditor();
});
document.getElementById("editorSnap").addEventListener("click",e=>{
  editorSnapOn=!editorSnapOn;e.target.textContent="SNAP: "+(editorSnapOn?"ON":"OFF");
});
document.getElementById("editorZoomOut").addEventListener("click",()=>{editorZoom=Math.max(.65,editorZoom-.15);drawEditor()});
document.getElementById("editorZoomIn").addEventListener("click",()=>{editorZoom=Math.min(1.8,editorZoom+.15);drawEditor()});
document.getElementById("editorLeft").addEventListener("click",()=>{editorCamera=Math.max(0,editorCamera-100);drawEditor()});
document.getElementById("editorRight").addEventListener("click",()=>{editorCamera=Math.min(19000,editorCamera+100);drawEditor()});
document.getElementById("saveLevel").addEventListener("click",saveCreatorLevel);
document.getElementById("testLevel").addEventListener("click",testCreatorLevel);
document.getElementById("clearLevel").addEventListener("click",clearCreatorLevel);
editorCanvas.addEventListener("pointerdown",e=>{
  e.preventDefault();
  editorLastPointer=editorWorldPoint(e);
  placeEditorObject(e);
  editorCanvas.setPointerCapture?.(e.pointerId);
});
editorCanvas.addEventListener("pointermove",e=>{if(editorModeTab==="edit"&&editorDragging){e.preventDefault();moveSelectedEditor(e)}});
editorCanvas.addEventListener("pointerup",finishEditorDrag);
editorCanvas.addEventListener("pointercancel",finishEditorDrag);
addEventListener("resize",()=>{if(editorMode){resizeEditor();drawEditor()}});

// Keep the normal level select working with the current saved creator level.
document.querySelector('.level[data-level="1"]').addEventListener("click",()=>{
  const saved=localStorage.getItem(CREATOR_SAVE_KEY);
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
