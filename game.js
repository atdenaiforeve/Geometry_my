const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
let w=0,h=0,dpr=1;
const player={x:120,y:0,size:34,vy:0,onGround:false};
const gravity=1700,jump=-650,speed=260;
const groundHeight=90;
const spikes=[{x:650,w:38,h:42},{x:850,w:38,h:42},{x:1080,w:38,h:42}];
let camera=0,dead=false;

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  w=innerWidth;h=innerHeight;
  canvas.width=w*dpr;canvas.height=h*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize",resize);resize();

function reset(){
  player.x=120;player.y=h-groundHeight-player.size;player.vy=0;player.onGround=true;
  camera=0;dead=false;
}
function doJump(){
  if(dead){reset();return}
  if(player.onGround){player.vy=jump;player.onGround=false}
}
addEventListener("keydown",e=>{if(e.code==="Space"||e.code==="ArrowUp"){e.preventDefault();doJump()}});
canvas.addEventListener("pointerdown",e=>{e.preventDefault();doJump()});

let last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,0.033);last=now;
  update(dt);draw();requestAnimationFrame(loop);
}
function update(dt){
  if(dead)return;
  player.x+=speed*dt;
  player.vy+=gravity*dt;
  player.y+=player.vy*dt;

  const floor=h-groundHeight-player.size;
  if(player.y>=floor){player.y=floor;player.vy=0;player.onGround=true}
  else player.onGround=false;

  camera=Math.max(0,player.x-180);

  for(const s of spikes){
    const sx=s.x;
    const hit=player.x+player.size>sx+5&&player.x<sx+s.w-5&&
      player.y+player.size>h-groundHeight-s.h+5;
    if(hit){dead=true;break}
  }
}
function draw(){
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#171a22";ctx.fillRect(0,0,w,h);

  // ground
  ctx.fillStyle="#303640";ctx.fillRect(0,h-groundHeight,w,groundHeight);
  ctx.fillStyle="#59616d";ctx.fillRect(0,h-groundHeight,w,6);

  // repeating blocks
  ctx.strokeStyle="#3d4550";ctx.lineWidth=2;
  const start=Math.floor(camera/50)*50;
  for(let x=start;x<camera+w+50;x+=50){
    ctx.strokeRect(x-camera,h-groundHeight+6,50,50);
  }

  // spikes
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

  // player
  const px=player.x-camera;
  ctx.fillStyle="#4dd7ff";
  ctx.fillRect(px,player.y,player.size,player.size);
  ctx.strokeStyle="#b8f2ff";ctx.lineWidth=3;
  ctx.strokeRect(px+1.5,player.y+1.5,player.size-3,player.size-3);

  if(dead){
    ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#fff";ctx.textAlign="center";
    ctx.font="bold 30px system-ui";ctx.fillText("You hit a spike!",w/2,h/2-10);
    ctx.font="18px system-ui";ctx.fillText("Tap or press Space to restart",w/2,h/2+28);
  }
}
reset();requestAnimationFrame(loop);
