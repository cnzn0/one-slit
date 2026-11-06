import {createEngine} from './engine.js';
// Eight views of one existing renderer, arranged in the order it is built.
// Neutral explanatory geometry; the underlying renderer is unchanged.
const W=1600,H=900,FPS=24,FR=120,INK='#e0e0e0',MID='#999999',DIM='#454545',BG='#090909';
const names=['GRID + STATE','SOURCE PULSES','WALL + DIFFRACTION','DISPLAY GAIN','RAKING LIGHT','CAST SHADOWS','FIXED GRAIN','COMPLETE'];
const equations=[
  'LAP(U) = U_L + U_R + U_T + U_B - 4U_C',
  'S(T) = (1 - 2A²) EXP(-A²)     A = πF₀(T - Tᵢ)',
  'SLIT = 6 CELLS     λ ≈ 11 CELLS     SPONGE = 26 CELLS',
  'G(R) = MIN(26, 7.5√(1 + R/5))',
  'N = NORMALIZE(-∂ₓH, -∂ᵧH, 1)',
  'LIGHT = MAX(0, N · L) × VISIBILITY',
  'G = 0.6G₁ + 0.4G₂     MASK = THRESHOLD(G, LIGHT)',
  '120 HEIGHT MAPS / 24 FPS = 5 SECONDS'
];
const notes=[
  '750 × 250 CELLS / ZERO INITIAL HEIGHT / FOUR NEIGHBORS PER UPDATE',
  '17 EVENTS / THREE WEIGHTS / SAME SOLVER, WALL DISABLED FOR THIS VIEW',
  'REFLECTIVE WALL / ONE OPENING / HEIGHT MAGNITUDE VIEW',
  'RAW HEIGHT VS DISPLAY HEIGHT / GAIN APPLIED AFTER THE SOLVE',
  'NORMALS FROM THE HEIGHT GRADIENT / LOW DIRECTIONAL LIGHT / NO GRAIN',
  'SAME FRAME AND CROP / 12 HEIGHT SAMPLES TOWARD THE LIGHT',
  'SAME CROP AT 4× / FIXED THRESHOLD / MOVING LIGHT RESPONSE',
  'SOLVE → EXPOSURE → NORMALS → SHADOWS → GRAIN'
];
export function createStudy(canvas, sharedEngine){
  canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{alpha:false});
  const surface=sharedEngine ? sharedEngine.canvas : document.createElement('canvas');
  if(!sharedEngine){surface.width=1500;surface.height=500;}
  const engine=sharedEngine || createEngine(surface);
  const other=document.createElement('canvas');other.width=1500;other.height=500;const oc=other.getContext('2d');
  const text=(s,x,y,size=24,c=INK,align='left')=>{ctx.font=`400 ${size}px 'Geist Mono',monospace`;ctx.fillStyle=c;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(s,x,y)};
  const line=(x,y,X,Y,c=DIM)=>{ctx.strokeStyle=c;ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke()};
  const box=(x,y,w,h,c=DIM)=>{ctx.strokeStyle=c;ctx.lineWidth=1.25;ctx.strokeRect(x,y,w,h)};
  const bracket=(x,y,w,h,c=MID)=>{line(x+12,y,x,y,c);line(x,y,x,y+h,c);line(x,y+h,x+12,y+h,c);line(x+w-12,y,x+w,y,c);line(x+w,y,x+w,y+h,c);line(x+w,y+h,x+w-12,y+h,c)};
  function shell(stage,frame){
    ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
    text(`[ ${String(stage).padStart(2,'0')} / ${names[stage-1]} ]`,64,79,30);
    text('ONE SLIT / BUILD NOTES',1536,78,19,MID,'right');line(64,111,1536,111);
    text(equations[stage-1],64,755,28);
    text(notes[stage-1],64,801,19,MID);
    for(let i=0;i<8;i++){ctx.fillStyle=i<stage?INK:'#292929';ctx.fillRect(64+i*36,865,23,2)}
    text(`${String(frame).padStart(3,'0')} / 119`,1536,868,17,MID,'right');
  }
  function full(view,frame){engine.renderView(frame,view);ctx.drawImage(surface,50,214)}
  function grid(frame){
    const gx=64,gy=270,gw=1000,gh=1000/3;
    // Coarse display of the domain, plus a clearly labelled cell-level stencil.
    for(let x=0;x<=30;x++)line(gx+x*gw/30,gy,gx+x*gw/30,gy+gh,'#262626');
    for(let y=0;y<=10;y++)line(gx,gy+y*gh/10,gx+gw,gy+y*gh/10,'#262626');
    bracket(gx-10,gy-10,gw+20,gh+20);
    text('[ U = 0 ]',gx+gw/2,gy+gh/2+8,30,INK,'center');
    text('750 COLUMNS',gx+gw/2,gy-35,22,MID,'center');
    text('250 ROWS',gx,gy+gh+49,22,MID);
    text('DOMAIN SHOWN WITH A COARSE GUIDE GRID',gx,gy+gh+84,17,MID);
    const cx=1325,cy=425,step=84,sz=76;
    const cells=[[-1,0,'L'],[1,0,'R'],[0,-1,'T'],[0,1,'B'],[0,0,'C']];
    const active=Math.floor(frame/12)%5;
    cells.forEach(([x,y,key],i)=>{const X=cx+x*step,Y=cy+y*step;
      ctx.fillStyle=i===active?'#282828':'#111111';ctx.fillRect(X-sz/2,Y-sz/2,sz,sz);box(X-sz/2,Y-sz/2,sz,sz,i===active?INK:DIM);text('U_'+key,X,Y+8,24,i===active?INK:MID,'center');
    });
    text('[ 5-POINT STENCIL ]',cx,218,22,INK,'center');
    text('FOUR NEIGHBORS',cx,615,20,MID,'center');text('+ THE CURRENT CELL',cx,648,20,MID,'center');
  }
  function arrivals(frame){
    full('free',frame);const step=frame*4;
    engine.arrivals.forEach((a,i)=>{
      let d=((step-a.t+720)%480)-240;const energy=Math.min(1,Math.abs(engine.ricker(d,engine.F0))*a.w);
      const x=50+a.x*2,y=214+(250-a.y)*2; // WebGL's display Y is reversed from simulation indexing.
      const c=energy>.1?INK:'#585858';line(x-7,y,x+7,y,c);line(x,y-7,x,y+7,c);
      if(energy>.12){box(x-13,y-13,26,26,INK);text(String(i+1).padStart(2,'0'),x+19,y+6,18,INK)}
    });
    text('FORCING SCHEDULE / ONE PERIOD',64,161,20,MID);
    line(64,187,1536,187);
    engine.arrivals.forEach(a=>{const x=64+a.t/480*1472;line(x,187-a.w*15,x,196,MID)});
    const x=64+frame/120*1472;line(x,150,x,198,INK);
  }
  function slit(frame){
    full('raw',frame);
    text('INCIDENT FIELD',64,172,22,MID);text('TRANSMITTED FIELD',1510,172,22,MID,'right');
    // Orthogonal leader terminates at the actual aperture without covering the wavefronts.
    const x=50+411,y=214+250;line(x+12,y,x+86,y,INK);line(x+86,y,x+86,y-61,INK);line(x+86,y-61,x+222,y-61,INK);text('[ 6 CELLS ]',x+101,y-76,21);
  }
  function exposure(frame){
    text('[ RAW HEIGHT ]',64,201,23);text('[ DISPLAY HEIGHT ]',832,201,23);
    engine.renderView(frame,'raw');ctx.drawImage(surface,64,239,704,235);
    engine.renderView(frame,'gained');ctx.drawImage(surface,832,239,704,235);
    bracket(56,230,720,254);bracket(824,230,720,254);
    text('RIGHT-SIDE GAIN',64,559,20,MID);
    const x0=80,x1=1515,y0=700,top=580;
    line(x0,y0,x1,y0);line(x0,top,x0,y0);
    const capY=y0-26/28*(y0-top);ctx.setLineDash([3,7]);line(x0,capY,x1,capY);ctx.setLineDash([]);
    ctx.strokeStyle=INK;ctx.lineWidth=1.25;ctx.beginPath();
    for(let i=0;i<=400;i++){const r=i/400*550,g=Math.min(26,7.5*Math.sqrt(1+r/5)),x=x0+i/400*(x1-x0),y=y0-g/28*(y0-top);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
    text('26× CAP',x1,top-10,19,MID,'right');text('DISTANCE FROM APERTURE →',x1,733,18,MID,'right');
  }
  function lighting(frame){
    full('light',frame);text('CONTINUOUS SHADE / BEFORE GRAIN',64,170,21,MID);
    text('LIGHT ELEVATION ≈ 17°',1536,170,21,MID,'right');
  }
  function shadows(frame){
    text('[ OCCLUSION / 1 - S ]',64,193,23);text('[ LIGHT × S ]',832,193,23);
    engine.renderView(frame,'blocked');ctx.drawImage(surface,360,0,800,500,64,232,704,440);
    engine.renderView(frame,'shadowed');ctx.drawImage(surface,360,0,800,500,832,232,704,440);
    bracket(56,224,720,456);bracket(824,224,720,456);
    text('MATCHED CROP / BRIGHT MASK = BLOCKED LIGHT',64,720,20,MID);
  }
  function grains(frame){
    text('[ FIXED THRESHOLD / 4× ]',64,193,23);text('[ LIT GRAINS / 4× ]',832,193,23);
    engine.renderView(frame,'texture');ctx.drawImage(surface,450,180,176,110,64,232,704,440);
    engine.renderView(frame,'grain');ctx.drawImage(surface,450,180,176,110,832,232,704,440);
    bracket(56,224,720,456);bracket(824,224,720,456);
    text('TEXTURE DOES NOT MOVE',64,720,20,MID);text('LIGHT CROSSES THE THRESHOLD',832,720,20,MID);
  }
  function complete(frame){full('final',frame);text('ALL PASSES COMBINED',64,171,21,MID)}
  const views=[grid,arrivals,slit,exposure,lighting,shadows,grains,complete];
  function renderStage(stage,frame){frame=((frame%FR)+FR)%FR;stage=Math.max(1,Math.min(8,stage));shell(stage,frame);views[stage-1](frame)}
  return {frames:FR*8,fps:FPS,stageFrames:FR,names,renderStage,render(frame){const f=((frame%(FR*8))+FR*8)%(FR*8);renderStage(Math.floor(f/FR)+1,f%FR)},engine};
}
