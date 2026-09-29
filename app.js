import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ================= 帳號設定 =================
   真正的權限由 Firestore 安全規則（firestore.rules）決定；
   這裡的名單只用來決定畫面要顯示什麼。兩邊請保持一致。 */
const BOSS_EMAIL  = "chungabb4@gmail.com";
const STAFF_EMAIL = "its.saturday.2021@gmail.com";
const DESK_LABEL  = { boss:"老闆版", staff:"員工版" };

let state = [];          // 目前顯示的捷徑
let desk = "boss";       // 目前開啟的版本
let canEdit = false;     // 只有老闆可以編輯（兩個版本都可以）
let userEmail = "";
let unsub = null, saveT = null, pendingRemote = null;


/* ================= 品牌色 ================= */
const HUES = {
  sage:["#A6B8A3","#DCE4DA"], khaki:["#CFCA8E","#F0EDD2"], olive:["#B3AD66","#E2DEB4"], linen:["#D8C8B9","#F5EFE9"],
  salmon:["#EBA08B","#F8D6CB"], meadow:["#B7C5B5","#E4E1B8"], peach:["#EEB1A0","#EEE7BF"], moss:["#BDB876","#CCD6CA"],
  sand:["#DDCDB6","#E8E5C4"], rose:["#E9A99C","#F1E6DE"]
};

let uid = 0; const nid = p => p + Date.now().toString(36) + (uid++).toString(36);
const QUOTES = [
  ["好的設計，是盡可能少的設計。","Dieter Rams"],
  ["細節不只是細節，細節成就了設計。","Charles Eames"],
  ["簡單比複雜更難。你得努力讓思緒變得清晰，才能讓事情變簡單。","Steve Jobs"],
  ["設計不只是看起來如何、感覺如何，而是它如何運作。","Steve Jobs"],
  ["專注，就是懂得說不。","Steve Jobs"],
  ["創意，就是把事物連結起來。","Steve Jobs"],
  ["少即是多。","Mies van der Rohe"],
  ["靈感確實存在，但它得在你工作的時候找到你。","Pablo Picasso"],
  ["創造力需要勇氣。","Henri Matisse"],
  ["品牌，是你不在場時，別人談論你的方式。","Jeff Bezos"],
  ["人們會忘記你說過的話，但不會忘記你帶給他們的感受。","Maya Angelou"],
  ["你不必很厲害才能開始，但你必須開始，才能變得很厲害。","Zig Ziglar"],
  ["我們反覆做的事，造就了我們。卓越不是一種行為，而是一種習慣。","Will Durant"],
  ["完成，比完美更重要。","Silicon Valley motto"],
  ["千里之行，始於足下。","老子"],
  ["不積跬步，無以至千里；不積小流，無以成江海。","荀子"],
  ["知之者不如好之者，好之者不如樂之者。","孔子"],
  ["業精於勤，荒於嬉；行成於思，毀於隨。","韓愈"],
  ["路漫漫其修遠兮，吾將上下而求索。","屈原"],
  ["每一個不曾起舞的日子，都是對生命的辜負。","Friedrich Nietzsche"],
  ["生活不是等待暴風雨過去，而是學會在雨中跳舞。","Vivian Greene"],
  ["慢慢來，比較快。","台灣俗諺"],
  ["風格，是一種不用開口就能說出你是誰的方式。","Rachel Zoe"],
  ["成功不是終點，失敗也不致命，重要的是繼續前進的勇氣。","often attributed to Churchill"],
  ["如果你無法簡單地解釋它，代表你理解得還不夠透徹。","often attributed to Einstein"],
  ["顏色是一種力量，能直接影響靈魂。","Wassily Kandinsky"],
  ["別等待機會，去創造它。","George Bernard Shaw"],
  ["今天的小事做好了，就是明天的大事。","It’s Saturday"]
];

/* ================= 圖示 ================= */
const P = {
  doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  sheet:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  tool:'<path d="m15 4 5 5-10 10H5v-5z"/><path d="m13 6 5 5"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.4-1-2.5 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4-4-7.5-9-7.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
  store:'<path d="M4 9 5.5 4h13L20 9M4 9h16v11H4zM4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M10 20v-5h4v5"/>',
  dash:'<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  gift:'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zm0 0s2-5 4.5-3.5S15 8 12 8z"/>',
  camera:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/>',
  pin:'<path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  mega:'<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6"/>',
  book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  cup:'<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M9 3v2M13 3v2"/>',
  flask:'<path d="M9 3h6M10 3v6L5 18a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7.5 14h9"/>',
  flower:'<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C10 6 12 3 12 3s2 3 0 6.5zM14.5 12c3.5-2 6.5 0 6.5 0s-3 2-6.5 0zM12 14.5c2 3.5 0 6.5 0 6.5s-2-3 0-6.5zM9.5 12C6 14 3 12 3 12s3-2 6.5 0z"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3 6"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  truck:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  box:'<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  chart:'<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
  sparkle:'<path d="M12 3c.8 4.5 2.5 6.2 7 7-4.5.8-6.2 2.5-7 7-.8-4.5-2.5-6.2-7-7 4.5-.8 6.2-2.5 7-7zM19 16c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5z"/>',
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};
const ICON_LABEL = {doc:"文件",sheet:"表格",folder:"資料夾",tool:"工具",image:"圖片",palette:"設計",store:"商店",dash:"後台",card:"金流",gift:"禮物",camera:"IG",pin:"靈感",mega:"廣告",book:"筆記",calc:"會計",globe:"網站",cup:"水泥杯",flask:"香氣",flower:"婚禮",heart:"愛心",users:"客戶",calendar:"行程",mail:"信件",receipt:"發票",truck:"物流",box:"庫存",chart:"報表",sparkle:"靈光",star:"收藏",link:"連結"};
const iconOf = it => (it.icon && P[it.icon]) ? it.icon : kindOf(it.url)[0];
function kindOf(url){
  let h="",p="";
  try{ const u=new URL(url); h=u.hostname; p=u.pathname; }catch(e){ return ["globe","Link"]; }
  if(h==="docs.google.com"){
    if(p.startsWith("/spreadsheets")) return ["sheet","Google Sheets"];
    if(p.startsWith("/document")) return ["doc","Google Docs"];
    if(p.startsWith("/presentation")) return ["dash","Google Slides"];
    if(p.startsWith("/forms")) return ["doc","Google Forms"];
  }
  if(h==="drive.google.com") return ["folder","Google Drive"];
  if(h.endsWith("github.io")) return ["tool","自製工具"];
  if(h.includes("imagekit")) return ["image","ImageKit"];
  if(h.includes("canva")) return ["palette","Canva"];
  if(h.includes("notion")) return ["book","Notion"];
  if(h.includes("instagram")) return ["camera","Instagram"];
  if(h.includes("pinterest")) return ["pin","Pinterest"];
  if(h.includes("facebook")) return ["mega","Meta Ads"];
  if(h.includes("line.")) return [h.startsWith("seller")?"dash":"gift","LINE GIFT"];
  if(h.includes("pinkoi")) return [p.startsWith("/panel")?"dash":"store","Pinkoi"];
  if(h.includes("bvshop")) return ["dash","BVSHOP"];
  if(h.includes("payuni")) return ["card","PAYUNi"];
  if(h.includes("simpany")) return ["calc","Simpany"];
  if(h.includes("its-saturday")) return ["store","its-saturday.com"];
  return ["globe",h.replace(/^www\./,"")];
}
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[k]||P.globe}</svg>`;
const ic = d => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  arrow:ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  edit:ic('<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  star:'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  plus:ic('<path d="M12 5v14M5 12h14"/>'),
  up:ic('<path d="m6 15 6-6 6 6"/>'), down:ic('<path d="m6 9 6 6 6-6"/>'),
  left:ic('<path d="m15 6-6 6 6 6"/>'), right:ic('<path d="m9 6 6 6-6 6"/>')
};

/* ================= 工具 ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hueVars = h => { const c = HUES[h]||HUES.sand; return `--c1:${c[0]};--c2:${c[1]}`; };
const findItem = id => { for(const g of state){ const i=g.items.findIndex(x=>x.id===id); if(i>-1) return {g,i,item:g.items[i]}; } return null; };
let toastT;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1800); }
async function copyText(text){ try{ await navigator.clipboard.writeText(text); return true; }catch(e){ return false; } }
function normUrl(u){ u=u.trim(); if(u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u="https://"+u; return u; }
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
/* 用 View Transition 讓排序、置頂、新增、刪除時卡片平滑移動 */
function vt(fn){ if(document.startViewTransition && !REDUCED){ try{ document.startViewTransition(fn); return; }catch(_){} } fn(); }
function sortedPins(){
  const out=[]; state.forEach(g=>g.items.forEach(it=>{ if(it.pinned) out.push([it,g]); }));
  return out.map((x,n)=>[x,n]).sort((a,b)=>((a[0][0].pinRank??1e6)-(b[0][0].pinRank??1e6))||(a[1]-b[1])).map(x=>x[0]);
}
function setPinOrder(items){ items.forEach((it,n)=>{ it.pinned=true; it.pinRank=n; }); }
function nextPinRank(){ return sortedPins().reduce((m,[it])=>Math.max(m,it.pinRank??-1),-1)+1; }

/* ================= 日期 ================= */
const WEEK = ["日","一","二","三","四","五","六"];
const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function renderDate(){
  const d = new Date(), h = d.getHours(), wd = d.getDay();
  const today = new Date(d.getFullYear(),d.getMonth(),d.getDate());
  $("#dNum").textContent = d.getDate();
  $("#dMonth").textContent = MON[d.getMonth()] + " " + d.getFullYear();
  $("#dWeek").textContent = "星期" + WEEK[wd];
  const doy = Math.round((today - new Date(d.getFullYear(),0,1))/864e5)+1;
  const tmp = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dn = tmp.getUTCDay()||7; tmp.setUTCDate(tmp.getUTCDate()+4-dn);
  const wk = Math.ceil(((tmp - Date.UTC(tmp.getUTCFullYear(),0,1))/864e5+1)/7);
  const toSat = (6 - wd + 7) % 7;
  const left = Math.round((new Date(d.getFullYear(),11,31) - today)/864e5);
  const total = state.reduce((n,g)=>n+g.items.length,0);
  $("#stats").innerHTML = [
    [toSat, toSat===0?"今天就是 Saturday":"天後 Saturday"],
    [wk, "Week"],
    [left, "天到年底"],
    [total, "個捷徑"]
  ].map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");
  const order=[1,2,3,4,5,6,0], cur = wd===0?6:wd-1;
  const pos = i => `calc(6px + (100% - 12px) * ${i/6})`;
  $("#track").innerHTML = `<div class="fill" style="width:calc((100% - 12px) * ${cur/6})"></div>` +
    order.map((w,i)=>`<div class="tk ${i<cur?"done":""} ${i===cur?"now":""} ${w===6&&i!==cur?"sat":""}" style="left:${pos(i)}"><i></i>${WEEK[w]}</div>`).join("");
  $("#dFoot").textContent = `民國 ${d.getFullYear()-1911} 年 · 今年第 ${doy} 天`;
  const greet = h<5?"Good night.":h<12?"Good morning.":h<18?"Good afternoon.":"Good evening.";
  $("#greet").textContent = greet;
  const who = canEdit ? "老闆" : "夥伴";
  $("#hiLabel").textContent = `嗨${who}`;
  $("#greetSub").textContent = toSat===0 ? `${who}，今天就是 Saturday，記得也留點時間給自己。`
    : canEdit ? "老闆好，今天也好好做品牌。" : "夥伴好，今天也一起把事情做好。";
}

/* ================= 每日雞湯 ================= */
let qi;
function dayIndex(){ const d=new Date(); return Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate())/864e5); }
function renderQuote(){ const [t,by] = QUOTES[qi % QUOTES.length]; $("#qText").textContent = "「" + t + "」"; $("#qBy").textContent = by; }
qi = dayIndex() % QUOTES.length;
$("#qNext").onclick = () => {
  const q=$("#quote"); if(REDUCED){ qi++; renderQuote(); return; }
  q.classList.add("qswap"); setTimeout(()=>{ qi++; renderQuote(); q.classList.remove("qswap"); },320);
};
$("#qCopy").onclick = async () => { const [t,by]=QUOTES[qi%QUOTES.length]; toast(await copyText(`${t} — ${by}`)?"已複製":"無法存取剪貼簿，請手動選取文字"); };

/* ================= 捷徑渲染 ================= */
let editing = false, query = "";
function tileHTML(it, g, pinned, n){
  const k = iconOf(it), label = kindOf(it.url)[1];
  const vtn = `view-transition-name:${pinned?"p":"t"}-${it.id};--i:${n||0}`;
  const tag = editing ? "div" : "a";
  const attrs = editing ? `tabindex="0" role="button" aria-label="編輯 ${esc(it.name)}"` : `href="${esc(it.url)}" target="_blank" rel="noopener"`;
  const tools = `<span class="edit-tools">
      <button class="et ${it.pinned?"on":""}" data-act="pin" type="button" aria-label="${it.pinned?"取消置頂":"置頂"}" title="${it.pinned?"取消置頂":"置頂"}">${I.star}</button>
      <button class="et" data-act="left" type="button" aria-label="往前移" title="往前移">${I.left}</button><button class="et" data-act="right" type="button" aria-label="往後移" title="往後移">${I.right}</button>
    </span>`;
  if(pinned){
    return `<${tag} class="tile" ${attrs} data-id="${it.id}" data-pin="1" ${editing?'draggable="true"':""} style="${hueVars(g.hue)};${vtn}">
      <span class="go">${I.arrow}</span>${tools}
      <span class="orb">${svg(k)}</span>
      <span><span class="t-name" style="display:block">${esc(it.name)}</span></span>
      <span class="t-group">${esc(g.name)}</span>
    </${tag}>`;
  }
  return `<${tag} class="tile" ${attrs} data-id="${it.id}" ${editing?'draggable="true"':""} style="${hueVars(g.hue)};${vtn}">
    ${it.pinned && !editing ? '<span class="t-pin" title="已置頂"></span>':''}
    <span class="t-top"><span class="orb">${svg(k)}</span><span class="go">${I.arrow}</span>${tools}</span>
    <span><span class="t-name" style="display:block">${esc(it.name)}</span><span class="t-kind" style="display:block">${esc(label)}</span></span>
  </${tag}>`;
}
function match(it,g){ if(!query) return true; const s=(it.name+" "+g.name+" "+kindOf(it.url)[1]+" "+(ICON_LABEL[it.icon]||"")+" "+it.url).toLowerCase(); return query.split(/\s+/).every(w=>s.includes(w)); }

function render(){
  if(!canEdit) editing=false;
  document.body.classList.toggle("editing", editing);
  document.body.classList.toggle("readonly", !canEdit);
  $("#editBtn span").textContent = editing ? "完成" : "編輯";
  $("#nav").innerHTML = state.map(g => `<a href="#${g.id}" data-nav="${g.id}" style="${hueVars(g.hue)}"><span class="dot"></span>${esc(g.name)}<span class="count">${g.items.length}</span></a>`).join("");
  const pins = sortedPins().filter(([it,g])=>match(it,g));
  let html = "";
  if(pins.length || (editing && !query)){
    html += `<section class="sec pins" id="pinned">
      <div class="sec-head"><div class="sec-title"><h2>置頂捷徑</h2><p style="margin-left:0">${editing?"拖曳卡片調整順序，也可以把下方捷徑拖進來置頂。":"最常開的幾個，一鍵直達。"}</p></div></div>
      <div class="grid" data-pingrid="1">${pins.length ? pins.map(([it,g],n)=>tileHTML(it,g,true,n)).join("") : `<div class="empty">在任一捷徑上按星號，就會出現在這裡</div>`}</div></section>`;
  }
  let shown = 0;
  state.forEach(g => {
    const items = g.items.filter(it=>match(it,g));
    if(query && !items.length) return;
    shown += items.length;
    html += `<section class="sec" id="${g.id}" style="${hueVars(g.hue)}">
      <div class="sec-head">
        <div class="sec-title"><h2><i></i>${esc(g.name)}</h2><p>${g.items.length} 個捷徑</p></div>
        <div class="sec-tools"><button class="sbtn" data-gact="edit" data-gid="${g.id}" type="button">${I.edit}分類設定</button><button class="sbtn add" data-gact="add" data-gid="${g.id}" type="button">${I.plus}新增捷徑</button></div>
      </div>
      <div class="grid" data-grid="${g.id}">${items.length ? items.map((it,n)=>tileHTML(it,g,false,n)).join("") : `<div class="empty">這個分類還沒有捷徑${editing?"，按右上「新增捷徑」加入":""}</div>`}</div>
    </section>`;
  });
  if(query && !shown && !pins.length) html += `<div class="noresult">找不到「${esc(query)}」相關的捷徑</div>`;
  if(editing && !query) html += `<button class="pill newgroup" data-gact="newgroup" type="button">${I.plus}新增分類</button>`;
  if(!state.length){
    html = canEdit
      ? `<div class="setup panel"><span class="chip">第一次使用</span><h2>這個版本還沒有捷徑</h2>
          <p>選擇電腦裡的初始資料檔（${desk==="boss"?"boss.json":"staff.json"}），或之前「複製備份」的內容，匯入後就會同步到所有登入的裝置。</p>
          <div class="row"><label class="btn dark" for="seedFile">${I.plus} 選擇檔案匯入</label><input id="seedFile" type="file" accept=".json,application/json" hidden>
          <button type="button" class="btn" data-gact="newgroup">從空白開始</button></div></div>`
      : `<div class="setup panel"><h2>還沒有捷徑</h2><p>老闆還沒設定員工版的捷徑，請稍後再回來看看。</p></div>`;
  }
  $("#sections").innerHTML = html;
  $("#seedFile")?.addEventListener("change", async e => {
    const f=e.target.files[0]; if(!f) return;
    try{ applyImport(await f.text()); toast("已匯入並同步"); }catch(_){ toast("這個檔案不是有效的捷徑資料"); }
  });
  spy();
}

/* ================= 互動 ================= */
$("#sections").addEventListener("click", e => {
  const gbtn = e.target.closest("[data-gact]");
  if(gbtn){
    const a=gbtn.dataset.gact;
    if(a==="add") openItem(null, gbtn.dataset.gid);
    if(a==="edit") openGroup(gbtn.dataset.gid);
    if(a==="newgroup") openGroup(null);
    return;
  }
  const tile = e.target.closest(".tile"); if(!tile || !editing) return;
  e.preventDefault();
  const act = e.target.closest("[data-act]")?.dataset.act;
  const f = findItem(tile.dataset.id); if(!f) return;
  if(act==="pin"){
    const on=!f.item.pinned;
    vt(()=>{ if(on){ f.item.pinRank=nextPinRank(); f.item.pinned=true; } else { f.item.pinned=false; delete f.item.pinRank; } save(); render(); });
    toast(on?"已置頂":"已取消置頂"); return;
  }
  if(act==="left"||act==="right"){
    const d = act==="left"?-1:1, inPins = !!tile.dataset.pin;
    if(inPins){
      const list=sortedPins().map(x=>x[0]), i=list.indexOf(f.item), j=i+d; if(j<0||j>=list.length) return;
      list.splice(j,0,list.splice(i,1)[0]); vt(()=>{ setPinOrder(list); save(); render(); });
    } else {
      const j = f.i + d; if(j<0||j>=f.g.items.length) return;
      vt(()=>{ f.g.items.splice(j,0,f.g.items.splice(f.i,1)[0]); save(); render(); });
    }
    setTimeout(()=>document.querySelector(`${inPins?"[data-pingrid]":"[data-grid]"} .tile[data-id="${f.item.id}"] [data-act="${act}"]`)?.focus(),50);
    return;
  }
  openItem(f.item.id);
});
$("#sections").addEventListener("keydown", e => {
  if(!editing || e.key!=="Enter") return;
  const tile=e.target.closest(".tile"); if(tile && e.target===tile) openItem(tile.dataset.id);
});

/* 拖曳排序 */
let dragId=null, dragPin=false;
const S = $("#sections");
S.addEventListener("dragstart", e => {
  const t=e.target.closest(".tile[draggable]"); if(!t) return;
  dragId=t.dataset.id; dragPin=!!t.dataset.pin; t.classList.add("dragging");
  e.dataTransfer.effectAllowed="move"; try{ e.dataTransfer.setData("text/plain",dragId); }catch(_){}
});
S.addEventListener("dragend", () => { dragId=null; clearDrop(); document.querySelectorAll(".dragging").forEach(x=>x.classList.remove("dragging")); });
function clearDrop(){ document.querySelectorAll(".over-before,.over-after,.grid.drop").forEach(x=>x.classList.remove("over-before","over-after","drop")); }
const dropGrid = e => { const g=e.target.closest("[data-grid],[data-pingrid]"); if(!g) return null; if(dragPin && !g.dataset.pingrid) return null; return g; };
S.addEventListener("dragover", e => {
  if(!dragId) return;
  const grid=dropGrid(e); if(!grid) return;
  e.preventDefault(); clearDrop();
  const t=e.target.closest(".tile");
  if(t && t.dataset.id!==dragId){ const r=t.getBoundingClientRect(); t.classList.add(e.clientX < r.left+r.width/2 ? "over-before":"over-after"); }
  else if(!t) grid.classList.add("drop");
});
S.addEventListener("drop", e => {
  if(!dragId) return;
  const grid=dropGrid(e); if(!grid) return;
  e.preventDefault();
  const src=findItem(dragId); if(!src) return;
  const t0=e.target.closest(".tile");
  if(grid.dataset.pingrid){
    const list=sortedPins().map(x=>x[0]).filter(x=>x!==src.item);
    let idx=list.length;
    if(t0 && t0.dataset.id!==dragId){ const r=t0.getBoundingClientRect(); idx=list.findIndex(x=>x.id===t0.dataset.id); if(e.clientX >= r.left+r.width/2) idx++; }
    list.splice(idx,0,src.item);
    const was=src.item.pinned; dragId=null;
    vt(()=>{ setPinOrder(list); save(); render(); });
    if(!was) toast("已置頂");
    return;
  }
  const tg=state.find(g=>g.id===grid.dataset.grid);
  const t=e.target.closest(".tile");
  const [moved]=src.g.items.splice(src.i,1);
  let idx=tg.items.length;
  if(t && t.dataset.id!==dragId){ const r=t.getBoundingClientRect(); idx=tg.items.findIndex(x=>x.id===t.dataset.id); if(e.clientX >= r.left+r.width/2) idx++; }
  tg.items.splice(idx,0,moved);
  dragId=null; vt(()=>{ save(); render(); }); if(src.g!==tg) toast(`已移到「${tg.name}」`);
});

/* 導覽高亮 */
function spy(){
  const secs=[...document.querySelectorAll(".sec[id]:not(#pinned)")]; let cur=null;
  for(const s of secs){ if(s.getBoundingClientRect().top < 160) cur=s.id; }
  document.querySelectorAll("[data-nav]").forEach(a=>a.classList.toggle("on",a.dataset.nav===cur));
}
addEventListener("scroll", spy, {passive:true});
$("#nav").addEventListener("click", e => {
  const a=e.target.closest("[data-nav]"); if(!a) return; e.preventDefault();
  document.getElementById(a.dataset.nav)?.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth", block:"start"});
});

/* 搜尋 & 快捷鍵 */
$("#q").addEventListener("input", e => { query=e.target.value.trim().toLowerCase(); render(); });
$("#q").addEventListener("keydown", e => {
  if(e.key==="Enter"){ const first=document.querySelector("#sections a.tile"); if(first) first.click(); }
  if(e.key==="Escape"){ e.target.value=""; query=""; render(); e.target.blur(); }
});
document.addEventListener("keydown", e => {
  if($("#scrim").classList.contains("show")){ if(e.key==="Escape") closeModal(); return; }
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if($("#app").hidden) return;
  if(e.key==="/"){ e.preventDefault(); $("#q").focus(); }
  if((e.key==="e"||e.key==="E") && canEdit){ editing=!editing; vt(render); }
});
$("#editBtn").onclick = () => { if(!canEdit) return; editing=!editing; vt(render); toast(editing?"編輯模式：拖曳排序、點卡片修改":"已儲存"); };

/* ================= 彈窗 ================= */
let closeT;
function openModal(html){
  clearTimeout(closeT);
  const sc=$("#scrim"); $("#modal").innerHTML=html; $("#modal").scrollTop=0;
  if(sc.hidden){ sc.hidden=false; void sc.offsetWidth; }
  sc.classList.add("show");
  setTimeout(()=>$("#modal").querySelector("input,button")?.focus({preventScroll:true}),60);
}
function closeModal(){
  const sc=$("#scrim"); sc.classList.remove("show");
  closeT=setTimeout(()=>{ sc.hidden=true; $("#modal").innerHTML=""; }, REDUCED?0:320);
}
$("#scrim").addEventListener("click", e => { if(e.target.id==="scrim") closeModal(); });
function armDelete(btn, onSure){
  btn.addEventListener("click", () => {
    if(btn.classList.contains("sure")){ onSure(); return; }
    btn.classList.add("sure"); btn.dataset.orig=btn.textContent; btn.textContent="確定刪除？";
    setTimeout(()=>{ if(btn.isConnected){ btn.classList.remove("sure"); btn.textContent=btn.dataset.orig; } },3000);
  });
}

function openItem(id, gid){
  const f = id ? findItem(id) : null;
  const it = f ? f.item : { name:"", url:"", pinned:false };
  const curG = f ? f.g.id : gid;
  let icon = it.icon && P[it.icon] ? it.icon : "";
  openModal(`<h3>${f?"編輯捷徑":"新增捷徑"}</h3>
    <form id="itemForm" class="form">
      <div class="field"><label for="fName">名稱</label><input id="fName" value="${esc(it.name)}" placeholder="例如：庫存系統" required></div>
      <div class="field"><label for="fUrl">網址</label><input id="fUrl" value="${esc(it.url)}" placeholder="https://" inputmode="url" required></div>
      <div class="field"><label for="fGroup">分類</label><select id="fGroup">${state.map(g=>`<option value="${g.id}" ${g.id===curG?"selected":""}>${esc(g.name)}</option>`).join("")}</select></div>
      <div class="field"><label>圖示</label><div class="icons" id="fIcons">
        <button type="button" class="ipick auto ${icon?"":"on"}" data-ic="" title="依網址自動選擇" aria-label="自動">自動</button>
        ${Object.keys(P).map(k=>`<button type="button" class="ipick ${icon===k?"on":""}" data-ic="${k}" title="${ICON_LABEL[k]||k}" aria-label="${ICON_LABEL[k]||k}">${svg(k)}</button>`).join("")}
      </div></div>
      <label class="check"><input id="fPin" type="checkbox" ${it.pinned?"checked":""}> 置頂到最上方</label>
      <div class="err" id="fErr"></div>
      <div class="row">${f?`<button type="button" class="btn danger" id="fDel">刪除</button>`:""}<span class="sp"></span>
        <button type="button" class="btn" id="fCancel">取消</button><button type="submit" class="btn dark">${f?"儲存":"新增"}</button></div>
    </form>`);
  $("#fCancel").onclick=closeModal;
  const tint = () => { const g=state.find(x=>x.id===$("#fGroup").value); $("#fIcons").setAttribute("style",hueVars(g?g.hue:"sand")); };
  const autoGlyph = () => { $("#fIcons .auto").innerHTML = svg(kindOf(normUrl($("#fUrl").value)||"x")[0]) + "自動"; };
  tint(); autoGlyph();
  $("#fGroup").addEventListener("change", tint);
  $("#fUrl").addEventListener("input", autoGlyph);
  $("#fIcons").addEventListener("click", e=>{ const b=e.target.closest(".ipick"); if(!b) return; icon=b.dataset.ic; document.querySelectorAll("#fIcons .ipick").forEach(x=>x.classList.toggle("on",x===b)); autoGlyph(); });
  if(f) armDelete($("#fDel"), ()=>{ closeModal(); vt(()=>{ f.g.items.splice(f.g.items.indexOf(f.item),1); save(); render(); renderDate(); }); toast("已刪除"); });
  $("#itemForm").addEventListener("submit", e => {
    e.preventDefault();
    const name=$("#fName").value.trim(), url=normUrl($("#fUrl").value);
    if(!name){ $("#fErr").textContent="請填寫名稱"; return; }
    try{ new URL(url); }catch(_){ $("#fErr").textContent="網址格式不對，請貼上完整網址（例如 https://…）"; return; }
    const tg=state.find(g=>g.id===$("#fGroup").value), pin=$("#fPin").checked;
    closeModal();
    vt(()=>{
      const target = f ? f.item : { id:nid("i") };
      if(pin && !target.pinned) target.pinRank=nextPinRank();
      if(!pin) delete target.pinRank;
      Object.assign(target,{name,url,pinned:pin});
      if(icon) target.icon=icon; else delete target.icon;
      if(f){ if(tg!==f.g){ f.g.items.splice(f.g.items.indexOf(f.item),1); tg.items.push(f.item); } }
      else tg.items.push(target);
      save(); render(); renderDate();
    });
    toast(f?"已儲存":"已新增");
  });
}

function openGroup(gid){
  const g = gid ? state.find(x=>x.id===gid) : null;
  let hue = g ? g.hue : Object.keys(HUES)[state.length % 10];
  openModal(`<h3>${g?"分類設定":"新增分類"}</h3>
    <form id="gForm" class="form">
      <div class="field"><label for="gName">分類名稱</label><input id="gName" value="${g?esc(g.name):""}" placeholder="例如：批發通路" required></div>
      <div class="field"><label>顏色</label><div class="swatches" id="sws">${Object.keys(HUES).map(h=>`<button type="button" class="sw ${h===hue?"on":""}" data-h="${h}" style="${hueVars(h)}" aria-label="${h}"></button>`).join("")}</div></div>
      ${g?`<div class="field"><label>位置</label><div class="row"><button type="button" class="btn" id="gUp">${I.up} 往上</button><button type="button" class="btn" id="gDown">${I.down} 往下</button></div></div>`:""}
      <div class="err" id="gErr"></div>
      <div class="row">${g?`<button type="button" class="btn danger" id="gDel">刪除分類</button>`:""}<span class="sp"></span>
        <button type="button" class="btn" id="gCancel">取消</button><button type="submit" class="btn dark">${g?"儲存":"新增"}</button></div>
      ${g&&g.items.length?`<p class="hint">刪除分類會一併刪除裡面的 ${g.items.length} 個捷徑。</p>`:""}
    </form>`);
  $("#gCancel").onclick=closeModal;
  $("#sws").addEventListener("click", e=>{ const b=e.target.closest(".sw"); if(!b) return; hue=b.dataset.h; document.querySelectorAll(".sw").forEach(x=>x.classList.toggle("on",x===b)); });
  if(g){
    const mv = d => { const i=state.indexOf(g), j=i+d; if(j<0||j>=state.length) return; state.splice(j,0,state.splice(i,1)[0]); save(); render(); toast(d<0?"已往上移":"已往下移"); };
    $("#gUp").onclick=()=>mv(-1); $("#gDown").onclick=()=>mv(1);
    armDelete($("#gDel"), ()=>{ state.splice(state.indexOf(g),1); save(); closeModal(); render(); renderDate(); toast("已刪除分類"); });
  }
  $("#gForm").addEventListener("submit", e=>{
    e.preventDefault(); const name=$("#gName").value.trim();
    if(!name){ $("#gErr").textContent="請填寫分類名稱"; return; }
    if(g){ g.name=name; g.hue=hue; } else state.push({ id:nid("g"), name, hue, items:[] });
    save(); closeModal(); render(); toast(g?"已儲存":"已新增分類");
    if(!g) document.getElementById(state[state.length-1].id)?.scrollIntoView({block:"start"});
  });
}

function openSettings(){
  openModal(`<h3>分類與備份</h3>
    <div class="field"><label>分類順序</label><div class="glist" id="glist"></div></div>
    <button type="button" class="btn" id="sNew" style="align-self:flex-start">${I.plus} 新增分類</button>
    <hr class="soft">
    <div class="field"><label for="sJson">備份資料</label>
      <textarea id="sJson" spellcheck="false"></textarea>
      <p class="hint">捷徑會自動同步到雲端。這段備份是保險用：可以複製存起來，需要時貼上後按「匯入」。匯入會取代「${desk==="boss"?"老闆版":"員工版"}」目前全部的捷徑。</p></div>
    <div class="err" id="sErr"></div>
    <div class="row"><label class="btn" for="sFile">從檔案匯入</label><input id="sFile" type="file" accept=".json,application/json" hidden><span class="sp"></span>
      <button type="button" class="btn" id="sCopy">複製備份</button><button type="button" class="btn dark" id="sImport">匯入</button></div>`);
  const drawList = () => {
    $("#glist").innerHTML = state.map((g,i)=>`<div class="gitem" style="${hueVars(g.hue)}"><i></i><span>${esc(g.name)}</span>
      <button class="et" data-mv="-1" data-i="${i}" type="button" aria-label="往上" ${i===0?"disabled":""}>${I.up}</button>
      <button class="et" data-mv="1" data-i="${i}" type="button" aria-label="往下" ${i===state.length-1?"disabled":""}>${I.down}</button>
      <button class="et" data-ed="${g.id}" type="button" aria-label="編輯">${I.edit}</button></div>`).join("");
    $("#sJson").value = JSON.stringify({ v:2, desk, groups:state }, null, 2);
  };
  drawList();
  $("#glist").addEventListener("click", e=>{
    const m=e.target.closest("[data-mv]"); const ed=e.target.closest("[data-ed]");
    if(m){ const i=+m.dataset.i, j=i+ +m.dataset.mv; state.splice(j,0,state.splice(i,1)[0]); save(); render(); drawList(); }
    if(ed) openGroup(ed.dataset.ed);
  });
  $("#sNew").onclick=()=>openGroup(null);
  $("#sCopy").onclick=async()=>{ const ok=await copyText($("#sJson").value); if(!ok){ $("#sJson").select(); } toast(ok?"已複製備份":"請手動複製已選取的文字"); };
  $("#sImport").onclick=()=>{
    try{ applyImport($("#sJson").value); closeModal(); toast("已匯入並同步"); }
    catch(_){ $("#sErr").textContent="這段內容不是有效的備份資料，請確認貼上的是完整的內容。"; }
  };
  $("#sFile").addEventListener("change", async e=>{
    const f=e.target.files[0]; if(!f) return;
    try{ applyImport(await f.text()); closeModal(); toast("已匯入並同步"); }
    catch(_){ $("#sErr").textContent="這個檔案不是有效的捷徑資料。"; }
  });
}
$("#settingsBtn").onclick=()=>{ if(canEdit) openSettings(); };

/* ================= 啟動 ================= */
renderQuote();
setInterval(()=>{ if(!$("#app").hidden) renderDate(); }, 60*1000);


/* ================= 匯入 ================= */
function applyImport(text){
  const d=JSON.parse(text); const gs=Array.isArray(d)?d:d.groups;
  if(!Array.isArray(gs) || !gs.every(g=>g && typeof g.name==="string" && Array.isArray(g.items))) throw new Error("bad");
  state = gs.map(g=>({ id:String(g.id||nid("g")), name:String(g.name).slice(0,60), hue:HUES[g.hue]?g.hue:"sand",
    items:g.items.filter(i=>i&&i.name&&i.url&&/^https?:\/\//i.test(String(i.url))).map(i=>({ id:String(i.id||nid("i")), name:String(i.name).slice(0,80), url:String(i.url),
      ...(i.pinned?{pinned:true}:{}), ...(i.icon&&P[i.icon]?{icon:i.icon}:{}), ...(typeof i.pinRank==="number"?{pinRank:i.pinRank}:{}) })) }));
  save(true); render(); renderDate();
}

/* ================= 雲端同步 ================= */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
auth.languageCode = "zh-TW";

function setSync(t, cls){ const el=$("#sync"); el.textContent=t; el.className="sync "+(cls||""); }
function save(now){
  if(!canEdit) return;
  clearTimeout(saveT); setSync("同步中…","busy");
  const run = async () => {
    try{
      const clean = JSON.parse(JSON.stringify(state));
      await setDoc(doc(db,"desks",desk), { groups:clean, updatedAt:serverTimestamp(), updatedBy:userEmail });
      setSync("已同步","ok");
    }catch(err){ console.error(err); setSync("同步失敗，請重新整理","bad"); toast("儲存失敗：可能沒有權限或網路中斷"); }
  };
  if(now) run(); else saveT=setTimeout(run, 500);
}
function applyRemote(groups){
  state = Array.isArray(groups) ? groups : [];
  render(); renderDate();
}
function openDesk(which){
  if(unsub){ unsub(); unsub=null; }
  desk = which; editing=false; state=[]; query=""; $("#q").value="";
  $("#deskName").textContent = DESK_LABEL[desk];
  document.querySelectorAll("[data-desk]").forEach(b=>{ const on=b.dataset.desk===desk; b.classList.toggle("on",on); b.setAttribute("aria-pressed",on); });
  setSync("讀取中…","busy");
  $("#sections").innerHTML = `<div class="loading">讀取捷徑中…</div>`;
  unsub = onSnapshot(doc(db,"desks",desk), snap => {
    if(snap.metadata.hasPendingWrites) return;              // 自己剛存的，不用重畫
    const groups = snap.exists() ? snap.data().groups : [];
    setSync(snap.exists() ? "已同步" : "尚未建立", snap.exists()?"ok":"");
    if(!$("#scrim").hidden || dragId){ pendingRemote = groups; return; }  // 編輯中先暫存，關閉後再套用
    applyRemote(groups);
  }, err => {
    console.error(err);
    showLogin(err.code==="permission-denied" ? `這個帳號沒有「${DESK_LABEL[desk]}」的權限。` : "讀取資料失敗，請確認網路後重新整理。");
    signOut(auth);
  });
}
/* 視窗關閉後，套用期間收到的雲端更新 */
new MutationObserver(()=>{ if($("#scrim").hidden && pendingRemote){ const g=pendingRemote; pendingRemote=null; applyRemote(g); } })
  .observe($("#scrim"), { attributes:true, attributeFilter:["hidden"] });

/* ================= 登入 ================= */
let chosenRole = (()=>{ try{ return sessionStorage.getItem("desk-role")||"boss"; }catch(_){ return "boss"; } })();
function pickRole(r){
  chosenRole=r; try{ sessionStorage.setItem("desk-role",r); }catch(_){}
  document.querySelectorAll("[data-role]").forEach(b=>{ const on=b.dataset.role===r; b.classList.toggle("on",on); b.setAttribute("aria-checked",on); });
}
pickRole(chosenRole);
$("#roles").addEventListener("click", e=>{ const b=e.target.closest("[data-role]"); if(b) pickRole(b.dataset.role); });

function showLogin(msg){
  if(unsub){ unsub(); unsub=null; }
  state=[]; $("#sections").innerHTML="";
  $("#boot").hidden=true; $("#app").hidden=true; $("#login").hidden=false;
  $("#loginErr").textContent = msg||"";
  $("#loginBtn").disabled=false; $("#loginBtn span").textContent="使用 Google 帳號登入";
}
function showApp(){
  $("#boot").hidden=true; $("#login").hidden=true; $("#app").hidden=false;
  document.body.classList.add("intro"); setTimeout(()=>document.body.classList.remove("intro"),1600);
}

$("#loginBtn").onclick = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt:"select_account", login_hint: chosenRole==="boss"?BOSS_EMAIL:STAFF_EMAIL });
  $("#loginBtn").disabled=true; $("#loginBtn span").textContent="登入中…"; $("#loginErr").textContent="";
  try{ await signInWithPopup(auth, provider); }
  catch(err){
    if(err.code==="auth/popup-blocked" || err.code==="auth/operation-not-supported-in-this-environment"){ await signInWithRedirect(auth, provider); return; }
    const m = {"auth/popup-closed-by-user":"登入視窗已關閉，請再試一次。","auth/cancelled-popup-request":"","auth/unauthorized-domain":"這個網址還沒加入 Firebase 的授權網域，請照上線說明第 3 步設定。","auth/network-request-failed":"網路連線失敗，請稍後再試。"}[err.code];
    showLogin(m ?? "登入失敗，請再試一次。"); console.error(err);
  }
};
getRedirectResult(auth).catch(err=>console.error(err));

function openAccount(){
  openModal(`<h3>帳號</h3>
    <div class="account" style="display:flex;padding:0;background:none">
      <div class="acc-row"><span class="acc-dot"></span><div class="acc-meta"><b>${canEdit?"老闆":"員工"}</b><span>${esc(userEmail)}</span></div></div>
      ${canEdit?`<div class="desk-switch" id="mDesk"><button type="button" data-desk="boss" class="${desk==="boss"?"on":""}">老闆版</button><button type="button" data-desk="staff" class="${desk==="staff"?"on":""}">員工版</button></div>`:""}
    </div>
    <div class="row"><span class="sp"></span><button type="button" class="btn" id="mClose">關閉</button><button type="button" class="btn dark" id="mOut">登出</button></div>`);
  $("#mClose").onclick=closeModal;
  $("#mOut").onclick=async()=>{ closeModal(); await signOut(auth); showLogin(""); toast("已登出"); };
  $("#mDesk")?.addEventListener("click", e=>{ const b=e.target.closest("[data-desk]"); if(!b) return; closeModal(); if(b.dataset.desk!==desk) openDesk(b.dataset.desk); });
}
$("#accBtn").onclick=openAccount;
$("#logoutBtn").onclick = async () => { await signOut(auth); showLogin(""); toast("已登出"); };
$("#deskSwitch").addEventListener("click", e=>{ const b=e.target.closest("[data-desk]"); if(b && b.dataset.desk!==desk) openDesk(b.dataset.desk); });

onAuthStateChanged(auth, user => {
  if(!user){ showLogin(""); return; }
  userEmail = (user.email||"").toLowerCase();
  const isBoss = userEmail===BOSS_EMAIL && user.emailVerified;
  const isStaff = userEmail===STAFF_EMAIL && user.emailVerified;
  if(chosenRole==="boss" && !isBoss){
    signOut(auth);
    showLogin(isStaff ? "這是員工帳號，請改選「員工」再登入。" : `${userEmail} 沒有老闆版的權限。`);
    return;
  }
  if(chosenRole==="staff" && !isStaff && !isBoss){
    signOut(auth); showLogin(`${userEmail} 沒有員工版的權限。`); return;
  }
  canEdit = isBoss;
  $("#who").textContent = isBoss ? "老闆" : "員工";
  $("#whoMail").textContent = userEmail;
  $("#deskSwitch").hidden = !isBoss;
  showApp();
  openDesk(chosenRole==="staff" ? "staff" : "boss");
});
