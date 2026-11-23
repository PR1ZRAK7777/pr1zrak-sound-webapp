// Local visual preferences never affect playback, volume or access permissions.
const PALETTE = {white:[255,255,255],purple:[182,120,255],blue:[90,180,255],red:[255,90,115]};
const DEFAULTS = {color:"white",background:"black",intensity:"bright"};
const KEY = "pr1zrak_appearance_v1";
export function createAppearance(visualizer) {
  let saved={};
  try { saved=JSON.parse(localStorage.getItem(KEY)||"{}"); } catch (_) {}
  const valid=(value,options,fallback)=>options.includes(value)?value:fallback;
  const settings={
    color:valid(saved?.color,[...Object.keys(PALETTE),"auto"],"white"),
    background:valid(saved?.background,["black","cover"],"black"),
    intensity:valid(saved?.intensity,["bright","calm"],"bright")
  };
  let cover="", sampled=null, generation=0;
  const backdrop=document.getElementById("cover-backdrop");
  const controls={color:document.getElementById("aura-color"),background:document.getElementById("player-background"),intensity:document.getElementById("aura-intensity")};
  function apply() {
    const rgb=PALETTE[settings.color] || sampled || PALETTE.purple;
    visualizer.setAppearance(rgb,settings.intensity);
    document.documentElement.style.setProperty("--aura-rgb",rgb.join(", "));
    backdrop.style.backgroundImage=cover ? `url(${JSON.stringify(cover)})` : "none";
    backdrop.classList.toggle("visible",settings.background==="cover" && Boolean(cover));
    for(const [name,control] of Object.entries(controls)) control.value=settings[name];
  }
  async function sample(url,version) {
    try {
      const image=new Image(); image.crossOrigin="anonymous";
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
      if(version!==generation) return;
      const c=document.createElement("canvas");c.width=c.height=24;
      const ctx=c.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,0,0,24,24);
      const pixels=ctx.getImageData(0,0,24,24).data;
      let sum=[0,0,0],weight=0;
      for(let i=0;i<pixels.length;i+=4){
        const rgb=[pixels[i],pixels[i+1],pixels[i+2]],max=Math.max(...rgb),min=Math.min(...rgb);
        const w=(max-min)/255;
        if(max<45 || w<0.12 || pixels[i+3]<128) continue;
        rgb.forEach((n,j)=>sum[j]+=n*w);weight+=w;
      }
      if(weight){sampled=sum.map(n=>Math.round(n/weight));const max=Math.max(...sampled);sampled=sampled.map(n=>Math.min(255,Math.round(n*235/max)));}
      if(settings.color==="auto") apply();
    } catch (_) { /* Covers without CORS use the purple fallback; playback is unaffected. */ }
  }
  for(const [name,control] of Object.entries(controls)) control.addEventListener("change",()=>{
    settings[name]=control.value;
    try {localStorage.setItem(KEY,JSON.stringify(settings));}catch(_){}
    apply();if(name==="color" && settings.color==="auto" && cover && !sampled) sample(cover,generation);
  });
  document.getElementById("appearance-reset").onclick=()=>{
    Object.assign(settings,DEFAULTS);try{localStorage.removeItem(KEY);}catch(_){}apply();
  };
  apply();
  return {setCover(value){
    let next="";
    try {const url=new URL(value,location.href);if(url.protocol==="https:" || url.origin===location.origin)next=url.href;}catch(_){}
    if(next===cover)return;
    cover=next;sampled=null;generation++;apply();
    if(settings.color==="auto" && cover)sample(cover,generation);
  }};
}
