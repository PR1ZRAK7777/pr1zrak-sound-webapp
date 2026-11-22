import {appendWaveBatch, shuffleUpcoming} from "./wave-engine.js";
import {makeVisualizer} from "./visualizer.js";
const el = id => document.getElementById(id);
const tg = window.Telegram?.WebApp;
const uid = tg?.initDataUnsafe?.user?.id;
const audio = el("audio");
const visualize = makeVisualizer(audio, el("spectrum"), el("sleeve"));
let tracks=[], liked=new Set(), index=0, list="wave", revision=0, song=0, objectURL, refilling=false;
const current=()=>tracks[index];
const clock=s=>Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
async function api(path, options={}) {
  const r=await fetch("/api/"+path,{...options,headers:{"X-Telegram-Init-Data":tg.initData,"Content-Type":"application/json"}});
  if (!r.ok) throw Error(r.status===401?"Открой плеер заново через Telegram.":"Сервис временно недоступен.");
  return r;
}
function showError(e){el("status").textContent=e.message;}
function render(){
  const t=current();
  el("like").disabled=!t;
  el("title").textContent=t?.title || "Моя Волна"; el("artist").textContent=t?.artist || "";
  const cover=el("cover");
  const art=t?.cover_url || "/webapp/assets/default-cover.png";
  if(cover.getAttribute("src")!==art){cover.hidden=true;cover.src=art;}
  el("like").textContent=liked.has(t?.id)?"♥":"♡";
  el("like").setAttribute("aria-pressed",String(liked.has(t?.id)));
  el("queue").replaceChildren(...tracks.map((t,i)=>{
    const li=document.createElement("li"), b=document.createElement("button");
    b.textContent=(i===index?"♪  ":"")+t.artist+" — "+t.title;
    b.setAttribute("aria-current",String(i===index)); b.onclick=()=>play(i).catch(showError); li.append(b);return li;
  }));
}
el("cover").onerror=()=>{const img=el("cover");if(img.getAttribute("src")!=="/webapp/assets/default-cover.png")img.src="/webapp/assets/default-cover.png";};
el("cover").onload=()=>el("cover").hidden=false;
async function refill(){
  if(list!=="wave" || tracks.length-index>3 || refilling)return;
  const r=revision;refilling=true;
  try{const extra=await (await api("wave/"+uid+"?limit=5")).json();
    if(r===revision){appendWaveBatch(tracks,index,extra);render();}
  }finally{if(r===revision)refilling=false;}
}
async function play(i){
  if(!tracks[i])return;
  const id=++song, selected=tracks[i];index=i;audio.pause();render();el("status").textContent="Загрузка…";
  await visualize();
  const blob=await (await api("audio/"+selected.id)).blob();
  if(id!==song)return;
  if(objectURL)URL.revokeObjectURL(objectURL);
  audio.src=objectURL=URL.createObjectURL(blob);
  await audio.play();if(id!==song)return;
  el("status").textContent="";
  await Promise.all([api("listen",{method:"POST",body:JSON.stringify({id:selected.id})}), refill()]);
}
async function select(name){
  const r=++revision;++song;audio.pause();audio.removeAttribute("src");audio.load();
  tracks=[];index=0;list=name;refilling=false;render();
  const tabSearch = el("tab-search");
  if (name !== "search" && tabSearch) tabSearch.style.display = "none";
  for(const b of document.querySelectorAll("[data-list]"))b.setAttribute("aria-pressed",String(b.dataset.list===name));
  const lt = el("list-title");
  if (lt) lt.textContent = name === "favorites" ? "Мои сохранённые треки" : name === "top" ? "🔥 Топ хитов" : "Очередь воспроизведения";
  const result=await (await api(name==="top"?"top":name+"/"+uid)).json();
  if(r!==revision)return;tracks=result;render();el("status").textContent=tracks.length?"":"Пока нет треков.";
}
for(const b of document.querySelectorAll("[data-list]"))b.onclick=()=>select(b.dataset.list).catch(showError);
el("play").onclick=()=>{if(!audio.paused)audio.pause();else if(audio.getAttribute("src"))audio.play().catch(showError);else play(index).catch(showError);};
audio.onplay=()=>{el("play").textContent="Ⅱ";el("play").ariaLabel="Пауза";};
audio.onpause=()=>{el("play").textContent="▶";el("play").ariaLabel="Воспроизвести";};
el("next").onclick=()=>play(index+1).catch(showError);el("prev").onclick=()=>play(Math.max(index-1,0)).catch(showError);
audio.onended=()=>el("next").click();
audio.ontimeupdate=()=>{
  const d=audio.duration || 0;
  el("time").textContent=clock(audio.currentTime);
  const total=el("time-total");
  if(total) total.textContent=clock(d);
  el("seek").value=d?100*audio.currentTime/d:0;
  el("sleeve").style.setProperty("--progress",(d?360*audio.currentTime/d:0)+"deg");
};
el("seek").oninput=e=>{if(audio.duration)audio.currentTime=audio.duration*e.target.value/100;};
el("volume").oninput=e=>{const v=audio.volume=e.target.value/100;el("volumeLabel").textContent=(v===0?"🔇":v<.34?"🔈":v<.67?"🔉":"🔊")+" "+Math.round(v*100)+"%";};
audio.volume=.85;
el("shuffle").onclick=()=>{shuffleUpcoming(tracks,index);render();};
const searchInput = el("search-input");
const searchBtn = el("search-btn");
async function doSearch() {
  const query = (searchInput?.value || "").trim();
  if (!query) return;
  const r = ++revision; ++song; audio.pause(); audio.removeAttribute("src"); audio.load();
  tracks = []; index = 0; list = "search"; refilling = false; render();
  el("status").textContent = "Ищу треки…";
  const tabSearch = el("tab-search");
  if (tabSearch) { tabSearch.style.display = ""; tabSearch.setAttribute("aria-pressed", "true"); }
  for (const b of document.querySelectorAll("[data-list]")) {
    if (b !== tabSearch) b.setAttribute("aria-pressed", "false");
  }
  try {
    const res = await (await api("search?q=" + encodeURIComponent(query))).json();
    if (r !== revision) return;
    tracks = res;
    render();
    el("status").textContent = tracks.length ? "" : "Ничего не найдено.";
    const lt = el("list-title");
    if (lt) lt.textContent = `Результаты поиска (${tracks.length})`;
  } catch (err) {
    showError(err);
  }
}
searchBtn?.addEventListener("click", doSearch);
searchInput?.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
el("like").onclick=async()=>{const t=current();if(!t)return;el("like").disabled=true;
  try{const was=liked.has(t.id);await api("like",{method:was?"DELETE":"POST",body:JSON.stringify({id:t.id})});if(was)liked.delete(t.id);else liked.add(t.id);
    if(was && list==="favorites"){
      const playing=current()?.id;
      tracks=tracks.filter(track=>track.id!==t.id);
      if(playing===t.id){++song;audio.pause();audio.removeAttribute("src");audio.load();index=Math.max(0,Math.min(index,tracks.length-1));}
      else index=tracks.findIndex(track=>track.id===playing);
      if(!tracks.length)el("status").textContent="В избранном пока нет треков.";
    }
    render();}
  catch(e){showError(e);}finally{el("like").disabled=!current();}
};
let startX;el("sleeve").ontouchstart=e=>startX=e.changedTouches[0].clientX;
el("sleeve").ontouchend=e=>{const dx=e.changedTouches[0].clientX-startX;if(Math.abs(dx)>50)el(dx<0?"next":"prev").click();};
async function init(){if(!uid)throw Error("Открой Мою Волну из меню бота в Telegram.");tg.ready();tg.expand();
 liked=new Set((await (await api("favorites/"+uid)).json()).map(t=>t.id));await select("wave");
}
init().catch(showError);
