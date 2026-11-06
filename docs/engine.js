// Deterministic 2D wave solver and WebGL2 diagnostic passes.
const VS=`#version 300 es
out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
function prog(gl,fs,vs=VS){const mk=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
  if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
  const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,vs));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i);const k=a.name.replace('[0]','');u[k]=gl.getUniformLocation(p,a.name)}
  return{p,u}}
function texParams(gl,fil,wrap){for(const[k,v]of[[gl.TEXTURE_MIN_FILTER,fil],[gl.TEXTURE_MAG_FILTER,fil],[gl.TEXTURE_WRAP_S,wrap],[gl.TEXTURE_WRAP_T,wrap]])gl.texParameteri(gl.TEXTURE_2D,k,v)}
function target(gl,w,h,fmt=gl.RGBA16F,base=gl.RGBA,filter=gl.LINEAR){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,fmt,w,h,0,base,gl.HALF_FLOAT,null);texParams(gl,filter,gl.CLAMP_TO_EDGE);
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Floating-point framebuffer is incomplete.');return{t,f,w,h}}
function pass(gl,dst,W,H){gl.bindFramebuffer(gl.FRAMEBUFFER,dst?dst.f:null);gl.viewport(0,0,dst?dst.w:W,dst?dst.h:H);gl.drawArrays(gl.TRIANGLES,0,3)}
function bind(gl,unit,tex,loc){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(loc,unit)}
function grainTex(gl,n){const a=new Uint8Array(n*n);let s=20261104;const r=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
  for(let i=0;i<n*n;i++){const g=Math.sqrt(-2*Math.log(r()+1e-9))*Math.cos(6.2831853*r());a[i]=Math.max(0,Math.min(255,128+g*42))}
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,n,n,0,gl.RED,gl.UNSIGNED_BYTE,a);texParams(gl,gl.LINEAR,gl.REPEAT);return t}
function inkLayer(gl,W,H){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),t=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,null);texParams(gl,gl.LINEAR,gl.CLAMP_TO_EDGE);
  return{c,x,t,push(){gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false)}}}
const BLUR=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D s;uniform vec2 d;
void main(){vec4 c=texture(s,uv)*.227;c+=(texture(s,uv+d*1.385)+texture(s,uv-d*1.385))*.316;c+=(texture(s,uv+d*3.231)+texture(s,uv-d*3.231))*.0703;o=c;}`;
function glInit(canvas){const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true,alpha:false});
 if(!gl)throw new Error('WebGL2 is unavailable.');
 if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('Floating-point rendering is unavailable.');
 gl.getExtension('OES_texture_float_linear');gl.bindVertexArray(gl.createVertexArray());return gl}
const hash=n=>{const x=Math.sin(n*127.1+3.3)*43758.5453;return x-Math.floor(x)};
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// Leapfrog update, reflective walls, and absorbing outer margins.
// Periodic forcing and three warm-up cycles approximate a repeating steady state.
function waveSolve({nx,ny,active,c2,damp,N,sub,warm,force,record}){
 const n=nx*ny,u=new Float32Array(n),v=new Float32Array(n),ids=[];for(let i=0;i<n;i++)if(active(i%nx,(i/nx)|0))ids.push(i);
 const I=Int32Array.from(ids),m=I.length,nb=new Int32Array(m*4),isA=new Uint8Array(n);for(const i of I)isA[i]=1;
 for(let k=0;k<m;k++){const i=I[k],x=i%nx,y=(i/nx)|0;nb[k*4]=x>0&&isA[i-1]?i-1:i;nb[k*4+1]=x<nx-1&&isA[i+1]?i+1:i;nb[k*4+2]=y>0&&isA[i-nx]?i-nx:i;nb[k*4+3]=y<ny-1&&isA[i+nx]?i+nx:i}
 const C=new Float32Array(m),D=new Float32Array(m);for(let k=0;k<m;k++){const i=I[k];C[k]=typeof c2==='function'?c2(i%nx,(i/nx)|0):c2;D[k]=damp(i%nx,(i/nx)|0)}
 let a=u,b=v;const total=N*sub;let s=0;
 for(let lp=0;lp<=warm;lp++)for(let fr=0;fr<N;fr++){
  if(lp===warm)record(fr,a);
  for(let q=0;q<sub;q++,s++){
   for(let k=0;k<m;k++){const i=I[k],z=a[i],q4=k*4,lap=a[nb[q4]]+a[nb[q4+1]]+a[nb[q4+2]]+a[nb[q4+3]]-4*z,d=D[k];b[i]=(2*z-b[i]*(1-d)+C[k]*lap)/(1+d)}
   const t=a;a=b;b=t;force(s%total,total,a)}}
}
function ricker(tau,f){const x=Math.PI*f*tau,y=x*x;return(1-2*y)*Math.exp(-y)}
function layerTex(gl,w,h,d){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,t);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.R16F,w,h,d);
 for(const[k,v]of[[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D_ARRAY,k,v);return t}
const W=1500,H=500,FPS=24,FRAMES=120,SUB=4,nx=750,ny=250,CC=.25;      // c²; c=.5 cell/step
const WX=205,WT=2,GAP=[122,127];                                    // wall column, half thickness, inclusive opening (6 cells)
const LAM=11,F0=.5/LAM,INK='rgba(237,237,239,.86)',DIM='rgba(237,237,239,.52)';
const ICE=[.682,.714,1.];
const Lx=Math.PI*2;
// the arrivals are hand placed and irregular: step in the loop, position, weight
const ARR=(()=>{const r=mulberry(7102026),a=[];let t=0;const T=FRAMES*SUB;const gaps=[1,.6,2.3,.8,.5,1.7,.9,2.8,.7,1.2,.55,2.1,1,.65,1.6,.9,.6];const sum=gaps.reduce((x,y)=>x+y,0);
 gaps.forEach((g,i)=>{const hit=r();a.push({t:(t|0),x:40+(WX-70)*Math.pow(r(),.8),y:34+(ny-68)*r(),w:(hit<.2?1.7:hit<.6?1.:.6)});t+=g/sum*T});return a})();
const HF=`#version 300 es
precision highp float;precision highp sampler2DArray;in vec2 uv;out vec4 o;uniform sampler2DArray h;uniform float l;uniform int raw;void main(){float z=texture(h,vec3(uv,l)).r;o=vec4(raw==1?z:z/(1.+abs(z)*.22));}`;
const SF=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D h;uniform vec3 L;
void main(){float z=texture(h,uv).r,s=1.;vec2 st=L.xy/length(L.xy);float tn=L.z/length(L.xy);float d=2.;
 for(int i=0;i<12;i++){float zz=texture(h,uv+st*d/vec2(${nx}.,${ny}.)).r;float over=zz-(z+d*tn);s=min(s,1.-clamp(over/1.2+.5,0.,1.));d*=1.28;d+=.8;}o=vec4(s);}`;
const FF=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D h,sh,gr,tx;uniform vec3 L;uniform int debug;uniform float inkOn;
void main(){vec2 e=vec2(1./${nx}.,1./${ny}.);float xm=texture(h,uv-vec2(e.x,0.)).r,xp=texture(h,uv+vec2(e.x,0.)).r,ym=texture(h,uv-vec2(0.,e.y)).r,yp=texture(h,uv+vec2(0.,e.y)).r;
 vec3 n=normalize(vec3(-(xp-xm)*.5,-(yp-ym)*.5,1.));float s=texture(sh,uv).r;float r=max(0.,dot(n,L))/L.z*s;
 vec2 a=vec2(${W}./540.,${H}./540.);float g=clamp((texture(gr,uv*a).r-.22)/.56,0.,1.),g1=clamp((texture(gr,uv*a*1.87+.37).r-.22)/.56,0.,1.);
 float up=max(0.,r-1.),dn=max(0.,1.-r),t0=mix(g,g1,.4);
 float cat=smoothstep(t0-.06,t0+.06,up*.62)*smoothstep(.02,.1,up);
 if(debug>0){float v=0.;
 if(debug==1)v=.035+.86*(1.-exp(-abs(texture(h,uv).r)*4.));
 if(debug==2){float q=max(0.,dot(n,L))/L.z;v=.0431+.7*smoothstep(0.,1.3,max(0.,q-1.));}
 if(debug==3)v=.0431+.7*smoothstep(0.,1.3,up);
 if(debug==4)v=s;
 if(debug==5)v=t0;
 if(debug==6)v=cat;
 if(debug==7)v=1.-s;
 vec4 t=texture(tx,vec2(uv.x,1.-uv.y))*inkOn;o=vec4(vec3(v)*(1.-t.a)+t.rgb,1.);return;}
 vec3 c=vec3(.0431,.0431,.0471)*(1.-.5*smoothstep(0.,1.,dn));
 c+=vec3(.46,.49,.64)*.17*smoothstep(.0,1.3,up);                     // the body of the crest, in the ice of the low light
 c=mix(c,vec3(.93,.94,.97),cat);
 vec4 t=texture(tx,vec2(uv.x,1.-uv.y));o=vec4(c*(1.-t.a)+t.rgb,1.);}`;
const az=-.5,el=.3,L3=[Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)];
export function createEngine(canvas){
 const gl=glInit(canvas),hp=prog(gl,HF),sp=prog(gl,SF),fp=prog(gl,FF),Ht=target(gl,nx,ny,gl.R16F,gl.RED),St=target(gl,nx,ny,gl.R16F,gl.RED),gr=grainTex(gl,540),ink=inkLayer(gl,W,H);
 const rawArr=layerTex(gl,nx,ny,FRAMES),freeArr=layerTex(gl,nx,ny,FRAMES),arr=layerTex(gl,nx,ny,FRAMES),buf=new Float32Array(nx*ny),isWall=(x,y)=>Math.abs(x-WX)<=WT&&!(y>=GAP[0]&&y<=GAP[1]);
 const M=26,sp2=(x,y)=>{const m=Math.min(x,y,nx-1-x,ny-1-y);return m<M?.12*Math.pow(1-m/M,2):0};
 const gain=new Float32Array(nx*ny);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const r=Math.hypot(x-WX,y-124.5);gain[y*nx+x]=x<WX?2.6:Math.min(26,7.5*Math.sqrt(1+r/5))}
 gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
 const srcCells=ARR.map(a=>({...a,i:(a.y|0)*nx+(a.x|0)}));
 waveSolve({nx,ny,active:(x,y)=>!isWall(x,y),c2:CC,damp:sp2,N:FRAMES,sub:SUB,warm:3,
  force:(s,T,u)=>{for(const a of srcCells){let d=s-a.t;d=((d%T)+T+T/2)%T-T/2;if(Math.abs(d)<46){const q=ricker(d,F0)*a.w*.5;u[a.i]+=q;u[a.i+1]+=q*.5;u[a.i-1]+=q*.5;u[a.i+nx]+=q*.5;u[a.i-nx]+=q*.5}}},
  record:(fr,u)=>{gl.bindTexture(gl.TEXTURE_2D_ARRAY,rawArr);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,fr,nx,ny,1,gl.RED,gl.FLOAT,u);for(let i=0;i<buf.length;i++)buf[i]=u[i]*gain[i];gl.bindTexture(gl.TEXTURE_2D_ARRAY,arr);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,fr,nx,ny,1,gl.RED,gl.FLOAT,buf)}});
 // Same source schedule in a wall-free domain isolates source generation for stage 02.
 waveSolve({nx,ny,active:()=>true,c2:CC,damp:sp2,N:FRAMES,sub:SUB,warm:3,
  force:(s,T,u)=>{for(const a of srcCells){let d=s-a.t;d=((d%T)+T+T/2)%T-T/2;if(Math.abs(d)<46){const q=ricker(d,F0)*a.w*.5;u[a.i]+=q;u[a.i+1]+=q*.5;u[a.i-1]+=q*.5;u[a.i+nx]+=q*.5;u[a.i-nx]+=q*.5}}},
  record:(fr,u)=>{gl.bindTexture(gl.TEXTURE_2D_ARRAY,freeArr);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,fr,nx,ny,1,gl.RED,gl.FLOAT,u)}});
 const x=ink.x;const mono="400 12px 'Geist Mono',monospace";
 function paintInk(){x.clearRect(0,0,W,H);const wx=(WX+.5)*2,g0=GAP[0]*2,g1=(GAP[1]+1)*2;x.fillStyle='#C6C7C1';x.fillRect(wx-1,0,1.5,g0);x.fillRect(wx-1,g1,1.5,H-g1);x.fillStyle='rgba(0,0,0,.0)';
  ink.push()}
 let painted=false;
 function renderView(frame,view='final'){const f=((frame%FRAMES)+FRAMES)%FRAMES;if(!painted){paintInk();painted=true}gl.disable(gl.BLEND);
  gl.useProgram(hp.p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,view==='free'?freeArr:view==='raw'?rawArr:arr);gl.uniform1i(hp.u.h,0);gl.uniform1i(hp.u.raw,(view==='raw'||view==='free')?1:0);gl.uniform1f(hp.u.l,f);pass(gl,Ht);
  gl.useProgram(sp.p);bind(gl,0,Ht.t,sp.u.h);gl.uniform3f(sp.u.L,...L3);pass(gl,St);
  gl.useProgram(fp.p);gl.uniform1i(fp.u.debug,({free:1,raw:1,gained:1,light:2,shadowed:3,shadow:4,texture:5,grain:6,blocked:7,final:0})[view]);gl.uniform1f(fp.u.inkOn,['free','texture','grain'].includes(view)?0:1);bind(gl,0,Ht.t,fp.u.h);bind(gl,1,St.t,fp.u.sh);bind(gl,2,gr,fp.u.gr);bind(gl,3,ink.t,fp.u.tx);gl.uniform3f(fp.u.L,...L3);pass(gl,null,W,H)}
 return{frames:FRAMES,fps:FPS,renderView,arrivals:ARR,ricker,F0,nx,ny,canvas}}
