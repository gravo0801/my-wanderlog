import { useState, useEffect, useRef, useCallback } from "react";

/* ── Storage (window.storage for artifact env) ───────────────────────────── */
const STORAGE_KEY = "wl_trips";
async function storageSave(trips) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(trips)); } catch (e) { console.warn("save:", e); }
}
async function storageLoad() {
  try { const r = await window.storage.get(STORAGE_KEY); return r ? JSON.parse(r.value) : []; } catch { return []; }
}

/* ── Utilities ───────────────────────────────────────────────────────────── */
const uid       = () => Math.random().toString(36).slice(2,10);
const fmtDate   = d => d ? new Date(d).toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"}) : "";
const fmtShort  = d => d ? new Date(d).toLocaleDateString("ko-KR",{month:"short",day:"numeric"}) : "";
const dateRange = (s,e) => { const r=[],c=new Date(s),end=new Date(e); while(c<=end){r.push(c.toISOString().slice(0,10));c.setDate(c.getDate()+1);} return r; };
const safeArr   = v => Array.isArray(v) ? v : [];
const safeStr   = v => (typeof v === "string" ? v : "");

/* ── Constants ───────────────────────────────────────────────────────────── */
const CURRENCIES = ["KRW","USD","EUR","JPY","GBP","CNY","THB","VND","SGD","AUD","TWD","HKD"];
const EXP_CATS = [
  {id:"food",    label:"식비",   icon:"🍜", color:"#FF7F7F"},
  {id:"transport",label:"교통",  icon:"🚌", color:"#7ECECA"},
  {id:"lodging", label:"숙박",   icon:"🏨", color:"#7AB8D4"},
  {id:"sightseeing",label:"관광",icon:"🎭", color:"#A8D8A8"},
  {id:"shopping",label:"쇼핑",   icon:"🛍️", color:"#F7DC6F"},
  {id:"other",   label:"기타",   icon:"💳", color:"#C9A0DC"},
];
const TRANSPORT = [
  {id:"subway",   label:"전철",    icon:"🚃"},
  {id:"bus",      label:"버스",    icon:"🚌"},
  {id:"transit",  label:"대중교통",icon:"🚇"},
  {id:"taxi",     label:"택시",    icon:"🚕"},
  {id:"walking",  label:"도보",    icon:"🚶"},
  {id:"driving",  label:"자동차",  icon:"🚗"},
  {id:"rental",   label:"렌트카",  icon:"🚙"},
  {id:"bicycling",label:"자전거",  icon:"🚲"},
  {id:"train",    label:"기차",    icon:"🚄"},
  {id:"flight",   label:"항공",    icon:"✈️"},
  {id:"boat",     label:"선박",    icon:"⛴️"},
];
const GRADIENTS = [
  "linear-gradient(135deg,#0c2340,#1a3a5c)",
  "linear-gradient(135deg,#1b3a2e,#2d5a46)",
  "linear-gradient(135deg,#2d1b4e,#4a2d7a)",
  "linear-gradient(135deg,#4a1c00,#7a3010)",
  "linear-gradient(135deg,#1a1a3e,#2e2e6e)",
  "linear-gradient(135deg,#3a1a2e,#6e2e52)",
];
const FLAG_MAP = {"한국":"🇰🇷","대한민국":"🇰🇷","korea":"🇰🇷","south korea":"🇰🇷","일본":"🇯🇵","japan":"🇯🇵","중국":"🇨🇳","china":"🇨🇳","미국":"🇺🇸","usa":"🇺🇸","united states":"🇺🇸","america":"🇺🇸","영국":"🇬🇧","uk":"🇬🇧","united kingdom":"🇬🇧","프랑스":"🇫🇷","france":"🇫🇷","독일":"🇩🇪","germany":"🇩🇪","이탈리아":"🇮🇹","italy":"🇮🇹","스페인":"🇪🇸","spain":"🇪🇸","포르투갈":"🇵🇹","portugal":"🇵🇹","네덜란드":"🇳🇱","netherlands":"🇳🇱","벨기에":"🇧🇪","belgium":"🇧🇪","스위스":"🇨🇭","switzerland":"🇨🇭","오스트리아":"🇦🇹","austria":"🇦🇹","그리스":"🇬🇷","greece":"🇬🇷","터키":"🇹🇷","turkey":"🇹🇷","태국":"🇹🇭","thailand":"🇹🇭","베트남":"🇻🇳","vietnam":"🇻🇳","싱가포르":"🇸🇬","singapore":"🇸🇬","말레이시아":"🇲🇾","malaysia":"🇲🇾","인도네시아":"🇮🇩","indonesia":"🇮🇩","필리핀":"🇵🇭","philippines":"🇵🇭","홍콩":"🇭🇰","hong kong":"🇭🇰","대만":"🇹🇼","taiwan":"🇹🇼","캐나다":"🇨🇦","canada":"🇨🇦","호주":"🇦🇺","australia":"🇦🇺","뉴질랜드":"🇳🇿","new zealand":"🇳🇿","인도":"🇮🇳","india":"🇮🇳","러시아":"🇷🇺","russia":"🇷🇺","브라질":"🇧🇷","brazil":"🇧🇷","멕시코":"🇲🇽","mexico":"🇲🇽","이집트":"🇪🇬","egypt":"🇪🇬","체코":"🇨🇿","czech":"🇨🇿","헝가리":"🇭🇺","hungary":"🇭🇺","폴란드":"🇵🇱","poland":"🇵🇱","크로아티아":"🇭🇷","croatia":"🇭🇷","노르웨이":"🇳🇴","norway":"🇳🇴","스웨덴":"🇸🇪","sweden":"🇸🇪","덴마크":"🇩🇰","denmark":"🇩🇰","핀란드":"🇫🇮","finland":"🇫🇮","아이슬란드":"🇮🇸","iceland":"🇮🇸","아랍에미리트":"🇦🇪","uae":"🇦🇪","dubai":"🇦🇪","모로코":"🇲🇦","morocco":"🇲🇦","남아프리카":"🇿🇦","south africa":"🇿🇦","캄보디아":"🇰🇭","cambodia":"🇰🇭","미얀마":"🇲🇲","myanmar":"🇲🇲","몽골":"🇲🇳","mongolia":"🇲🇳","조지아":"🇬🇪","georgia":"🇬🇪","페루":"🇵🇪","peru":"🇵🇪","칠레":"🇨🇱","chile":"🇨🇱","아르헨티나":"🇦🇷","argentina":"🇦🇷","쿠바":"🇨🇺","cuba":"🇨🇺"};
const guessFlag = c => c ? (FLAG_MAP[c.toLowerCase().trim()] || null) : null;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const newWaypoint = () => ({id:uid(), name:"", lat:null, lon:null, transport:"transit", time:"", travelTime:"", icon:""});
const getWaypoints = d => {
  if (safeArr(d?.waypoints).length) return d.waypoints;
  if (d?.city) return [{...newWaypoint(), id:"lg", name:d.city}];
  return [newWaypoint()];
};
const getPlaceNames = d => getWaypoints(d).map(w=>w.name).filter(Boolean);

const gmapsUrl = wps => {
  const v = safeArr(wps).filter(w=>w.lat&&w.lon);
  if (!v.length) return null;
  if (v.length===1) return `https://www.google.com/maps/search/?api=1&query=${v[0].lat},${v[0].lon}`;
  const mode = (TRANSPORT.find(m=>m.id===v[0].transport)||{maps:"transit"}).maps || "transit";
  const origin = `${v[0].lat},${v[0].lon}`, dest = `${v[v.length-1].lat},${v[v.length-1].lon}`;
  const mid = v.slice(1,-1).map(w=>`${w.lat},${w.lon}`).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${mode}`+(mid?`&waypoints=${mid}`:"");
};

/* ── Claude API ──────────────────────────────────────────────────────────── */
async function callClaude(prompt, maxTokens=700) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:maxTokens, messages:[{role:"user",content:prompt}] })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content?.[0]?.text || "").replace(/```json|```/g,"").trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch { return null; }
}

/* ── Exchange Rates ──────────────────────────────────────────────────────── */
const FALLBACK_RATES = {KRW:1,USD:1380,EUR:1510,JPY:9.2,GBP:1750,CNY:192,THB:39,VND:0.054,SGD:1020,AUD:900,TWD:43,HKD:177};
const RATE_RANGES = {USD:[1100,1700],EUR:[1200,1900],JPY:[6,13],GBP:[1400,2200],CNY:[140,230],THB:[25,55],VND:[0.03,0.08],SGD:[850,1200],AUD:[700,1100],TWD:[35,55],HKD:[140,210]};

function sanitizeRates(raw) {
  const out = {KRW:1};
  for (const [cur, fallback] of Object.entries(FALLBACK_RATES)) {
    if (cur === "KRW") continue;
    const val = Number(raw?.[cur]);
    if (!isFinite(val) || val <= 0) { out[cur] = fallback; continue; }
    const [lo, hi] = RATE_RANGES[cur] || [0, Infinity];
    if (val >= lo && val <= hi) { out[cur] = val; continue; }
    const inv = 1 / val;
    if (inv >= lo && inv <= hi) { out[cur] = inv; continue; }
    out[cur] = fallback;
  }
  return out;
}

let _rateCache = null, _rateFetchedAt = 0;
async function getExchangeRates() {
  const now = Date.now();
  if (_rateCache && now - _rateFetchedAt < 10*60*1000) return _rateCache;

  const data = await callClaude(
    `I need currency → KRW conversion rates.
RULE: each value = how many Korean Won (KRW) you get for spending ONE unit of that currency.
Return a JSON object with today's approximate rates for these keys:
KRW USD EUR JPY GBP CNY THB VND SGD AUD TWD HKD
KRW must be 1. Return ONLY the JSON object.`, 350
  );

  const rates = sanitizeRates(data);
  _rateCache = rates; _rateFetchedAt = now;
  return _rateCache;
}

/* ── Place Suggestions ───────────────────────────────────────────────────── */
async function fetchPlaces(query) {
  const data = await callClaude(
    `Travel autocomplete. User typed: "${query}"
Return a JSON array of exactly 5 real places. Match the input language.
Format: [{"name":"place name","sub":"city, country","lat":0.0,"lon":0.0,"icon":"emoji"}]
Use accurate real-world coordinates. Return ONLY the JSON array.`, 600
  );
  if (Array.isArray(data)) return data;
  return [];
}

/* ── Canvas Map (OSM tiles) ──────────────────────────────────────────────── */
const lon2tile = (lon,z) => Math.floor((lon+180)/360 * (1<<z));
const lat2tile = (lat,z) => Math.floor((1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 * (1<<z));
const tile2lon = (x,z) => x/(1<<z)*360 - 180;
const tile2lat = (y,z) => { const n = Math.PI - 2*Math.PI*y/(1<<z); return 180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n))); };

function MapCanvas({ waypoints }) {
  const canvasRef = useRef();
  const [mapStatus, setMapStatus] = useState("idle");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waypoints.length) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth || 620, H = 250;
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#0A1628"; ctx.fillRect(0,0,W,H);
    setMapStatus("loading");

    const lats = waypoints.map(w=>parseFloat(w.lat)).filter(n=>!isNaN(n));
    const lons = waypoints.map(w=>parseFloat(w.lon)).filter(n=>!isNaN(n));
    if (!lats.length) { setMapStatus("idle"); return; }

    const minLat=Math.min(...lats), maxLat=Math.max(...lats);
    const minLon=Math.min(...lons), maxLon=Math.max(...lons);
    const cLat=(minLat+maxLat)/2, cLon=(minLon+maxLon)/2;

    let zoom = 13;
    const span = Math.max(maxLat-minLat, maxLon-minLon);
    if (span>40) zoom=4; else if (span>20) zoom=5; else if (span>10) zoom=6;
    else if (span>5) zoom=7; else if (span>2) zoom=9; else if (span>0.5) zoom=11;

    const TILE=256, cTX=lon2tile(cLon,zoom), cTY=lat2tile(cLat,zoom);
    const nX=Math.ceil(W/TILE)+2, nY=Math.ceil(H/TILE)+2;
    const sX=cTX-Math.floor(nX/2), sY=cTY-Math.floor(nY/2);

    const oLon=tile2lon(sX,zoom), oLat=tile2lat(sY,zoom);
    const eLon=tile2lon(sX+nX,zoom), eLat=tile2lat(sY+nY,zoom);
    const px = lon => (lon-oLon)/(eLon-oLon)*W;
    const py = lat => (lat-oLat)/(eLat-oLat)*H;

    let done=0; const total=nX*nY;
    const drawPins = () => {
      const pts = waypoints.map(w=>({x:px(parseFloat(w.lon)),y:py(parseFloat(w.lat)),w}));
      if (pts.length>1) {
        ctx.beginPath(); ctx.strokeStyle="#D4A853"; ctx.lineWidth=2.5;
        ctx.setLineDash([9,6]); ctx.shadowColor="rgba(212,168,83,.5)"; ctx.shadowBlur=5;
        ctx.moveTo(pts[0].x,pts[0].y); pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur=0;
        for (let i=0;i<pts.length-1;i++) {
          const mx=(pts[i].x+pts[i+1].x)/2, my=(pts[i].y+pts[i+1].y)/2;
          const a=Math.atan2(pts[i+1].y-pts[i].y,pts[i+1].x-pts[i].x);
          ctx.save(); ctx.translate(mx,my); ctx.rotate(a);
          ctx.fillStyle="#D4A853"; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4,4); ctx.lineTo(-4,-4); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      pts.forEach((p,i)=>{
        ctx.beginPath(); ctx.arc(p.x,p.y+2,10,0,Math.PI*2); ctx.fillStyle="rgba(0,0,0,.3)"; ctx.fill();
        const g=ctx.createRadialGradient(p.x-2,p.y-2,1,p.x,p.y,10);
        g.addColorStop(0,"#F5C842"); g.addColorStop(1,"#C89020");
        ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
        ctx.strokeStyle="#fff"; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle="#0A1628"; ctx.font="bold 11px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(i+1,p.x,p.y);
        const lbl=(p.w.name||"").slice(0,13);
        ctx.font="11px sans-serif"; ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillText(lbl,p.x+1,p.y-19); ctx.fillStyle="#F5ECD7"; ctx.fillText(lbl,p.x,p.y-20);
      });
      setMapStatus("ok");
    };

    const check=()=>{ done++; if(done>=total) drawPins(); };
    setTimeout(()=>{ if(done<total) drawPins(); },3000);

    for (let tx=0;tx<nX;tx++) for (let ty=0;ty<nY;ty++) {
      const s=["a","b","c"][(tx+ty)%3];
      const img=new Image(); img.crossOrigin="anonymous";
      const offX = tx*TILE - (Math.floor(nX/2)-(cTX-sX))*TILE + W/2 - TILE/2;
      const offY = ty*TILE - (Math.floor(nY/2)-(cTY-sY))*TILE + H/2 - TILE/2;
      img.onload=()=>{ ctx.drawImage(img,offX,offY,TILE,TILE); check(); };
      img.onerror=check;
      img.src=`https://${s}.tile.openstreetmap.org/${zoom}/${sX+tx}/${sY+ty}.png`;
    }
  }, [waypoints]);

  return (
    <div style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(212,168,83,.2)",boxShadow:"0 6px 28px rgba(0,0,0,.4)",position:"relative"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:250,display:"block",background:"#0A1628"}}/>
      {mapStatus==="loading"&&(
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:8,pointerEvents:"none"}}>
          <div style={{width:18,height:18,border:"2px solid rgba(212,168,83,.2)",borderTopColor:"#D4A853",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
          <span style={{fontSize:10,color:"#D4A85380"}}>지도 로딩중...</span>
        </div>
      )}
      <div style={{background:"#0D1B2E",padding:"7px 11px",display:"flex",gap:5,flexWrap:"wrap",borderTop:"1px solid rgba(212,168,83,.12)"}}>
        {waypoints.map((w,i)=>(
          <span key={i} style={{fontSize:11,color:"#D4A853",background:"rgba(212,168,83,.1)",padding:"2px 8px",borderRadius:7,border:"1px solid rgba(212,168,83,.18)"}}>
            {w.icon||"📍"} {i+1}. {w.name}{w.time?` @${w.time}`:""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Place Search ────────────────────────────────────────────────────────── */
function PlaceSearch({ value, placeholder, onSelect, onNameChange }) {
  const [q, setQ]         = useState(value || "");
  const [results, setRes] = useState([]);
  const [loading, setLd]  = useState(false);
  const [open, setOpen]   = useState(false);
  const [pinned, setPinned] = useState(false);
  const debRef = useRef(), wrapRef = useRef();

  useEffect(() => { if (!pinned) setQ(value || ""); }, [value]);

  const doSearch = useCallback(v => {
    clearTimeout(debRef.current);
    if (!v || v.length < 1) { setRes([]); setOpen(false); return; }
    debRef.current = setTimeout(async () => {
      setLd(true);
      const list = await fetchPlaces(v);
      setRes(list); setOpen(list.length > 0); setLd(false);
    }, 450);
  }, []);

  const handleChange = e => {
    const v = e.target.value;
    setQ(v); setPinned(false);
    onNameChange?.(v);
    doSearch(v);
  };

  const handlePick = item => {
    setQ(item.name); setPinned(true); setOpen(false); setRes([]);
    onSelect({ name: item.name, lat: String(item.lat), lon: String(item.lon), icon: item.icon || "📍" });
  };

  useEffect(() => {
    const close = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={wrapRef} style={{position:"relative",flex:1,minWidth:0}}>
      <div style={{position:"relative"}}>
        <input value={q} onChange={handleChange} placeholder={placeholder||"장소 검색 / Search…"}
          onFocus={()=>results.length>0 && setOpen(true)}
          style={{paddingRight: loading ? 42 : pinned ? 34 : 13}} />
        {loading && (
          <div style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:3}}>
            <div style={{width:12,height:12,border:"2px solid rgba(212,168,83,.2)",borderTopColor:"#D4A853",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
            <span style={{fontSize:9,color:"#D4A85360"}}>검색중</span>
          </div>
        )}
        {pinned && !loading && <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#4CAF7E",fontSize:13}}>✓</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#0D1B2E",border:"1px solid rgba(212,168,83,.28)",borderRadius:12,zIndex:1000,overflow:"hidden",boxShadow:"0 18px 56px rgba(0,0,0,.85)"}}>
          <div style={{padding:"4px 11px 3px",borderBottom:"1px solid rgba(212,168,83,.09)",display:"flex",gap:5,alignItems:"center"}}>
            <span style={{fontSize:9,color:"#D4A85350",letterSpacing:.8}}>AI 장소 추천</span>
            <div style={{flex:1,height:1,background:"rgba(212,168,83,.07)"}}/>
            <span style={{fontSize:9,color:"#D4A85330"}}>tap</span>
          </div>
          {results.map((item,i) => <PlaceRow key={i} item={item} isLast={i===results.length-1} onPick={()=>handlePick(item)}/>)}
        </div>
      )}
    </div>
  );
}

function PlaceRow({ item, isLast, onPick }) {
  const [hov, setH] = useState(false);
  return (
    <div style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",cursor:"pointer",background:hov?"rgba(212,168,83,.08)":"transparent",transition:"background .1s",borderBottom:isLast?"none":"1px solid rgba(255,255,255,.04)"}}
      onMouseDown={onPick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      onTouchStart={()=>setH(true)} onTouchEnd={()=>{setH(false);onPick();}}>
      <span style={{fontSize:18,flexShrink:0}}>{item.icon||"📍"}</span>
      <div style={{flex:1,overflow:"hidden"}}>
        <div style={{color:"#F5ECD7",fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
        {item.sub && <div style={{color:"#F5ECD748",fontSize:11,marginTop:1}}>{item.sub}</div>}
      </div>
    </div>
  );
}

/* ── Waypoints Editor ────────────────────────────────────────────────────── */
function WaypointsEditor({ waypoints, onChange }) {
  const [showMap, setShowMap] = useState(false);
  const valid = waypoints.filter(w=>w.lat && w.lon);
  const mUrl  = gmapsUrl(waypoints);

  const addWp    = () => onChange([...waypoints, newWaypoint()]);
  const updateWp = (id, patch) => onChange(waypoints.map(w => w.id===id ? {...w,...patch} : w));
  const removeWp = id => onChange(waypoints.filter(w => w.id!==id));

  return (
    <div>
      {waypoints.map((wp, i) => (
        <div key={wp.id} style={{marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
            <div style={{width:24,height:24,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:wp.lat?15:10,fontWeight:700,color:"#D4A853",background:wp.lat?"rgba(212,168,83,.2)":"rgba(212,168,83,.09)",border:`1px solid ${wp.lat?"rgba(212,168,83,.5)":"rgba(212,168,83,.25)"}`,transition:"all .2s"}}>
              {wp.lat ? (wp.icon||"📍") : i+1}
            </div>
            <PlaceSearch
              value={safeStr(wp.name)}
              placeholder={i===0 ? "출발지 / Start place…" : "다음 장소 / Next place…"}
              onSelect={p => updateWp(wp.id, {name:p.name, lat:p.lat, lon:p.lon, icon:p.icon})}
              onNameChange={n => updateWp(wp.id, {name:n, lat:null, lon:null, icon:""})}
            />
            <input type="time" value={safeStr(wp.time)} onChange={e=>updateWp(wp.id,{time:e.target.value})}
              title="도착 시간" style={{width:80,flexShrink:0,padding:"9px 5px",fontSize:13,textAlign:"center"}}/>
            {waypoints.length>1 && (
              <button onClick={()=>removeWp(wp.id)}
                style={{background:"rgba(255,70,70,.09)",border:"1px solid rgba(255,70,70,.18)",color:"#ff9090",width:30,height:30,borderRadius:8,cursor:"pointer",flexShrink:0,fontSize:11}}>✕</button>
            )}
          </div>

          {i < waypoints.length-1 && (
            <div style={{display:"flex",gap:9,padding:"4px 0 4px 10px"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,paddingTop:3}}>
                <div style={{width:1,height:6,background:"rgba(212,168,83,.18)"}}/>
                <div style={{width:4,height:4,borderRadius:"50%",background:"rgba(212,168,83,.3)"}}/>
                <div style={{width:1,height:6,background:"rgba(212,168,83,.18)"}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9.5,color:"#F5ECD738",marginBottom:5,letterSpacing:.5}}>이동수단</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {TRANSPORT.map(m => {
                    const on = wp.transport===m.id;
                    return (
                      <button key={m.id} onClick={()=>updateWp(wp.id,{transport:m.id})}
                        style={{display:"flex",alignItems:"center",gap:3,padding:"4px 8px",borderRadius:18,cursor:"pointer",border:`1px solid ${on?"rgba(212,168,83,.5)":"rgba(255,255,255,.08)"}`,background:on?"rgba(212,168,83,.14)":"rgba(255,255,255,.025)",color:on?"#D4A853":"#F5ECD755",fontSize:11,fontWeight:on?600:400,transition:"all .13s"}}>
                        <span>{m.icon}</span><span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7,marginTop:7}}>
                  <span style={{fontSize:10,color:"#F5ECD738",whiteSpace:"nowrap"}}>⏱ 이동시간</span>
                  <input type="text" value={safeStr(wp.travelTime)} onChange={e=>updateWp(wp.id,{travelTime:e.target.value})}
                    placeholder="예: 25분, 1시간 30분" style={{flex:1,padding:"6px 9px",fontSize:12}}/>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}>
        <button onClick={addWp} style={C.btnAdd}>+ 장소 추가</button>
        {valid.length>=1 && <button onClick={()=>setShowMap(p=>!p)} style={C.btnMap}>{showMap?"🗺️ 닫기":"🗺️ 지도 보기"}</button>}
        {valid.length>=2 && mUrl && <a href={mUrl} target="_blank" rel="noopener noreferrer" style={C.btnGMaps}>↗ 구글맵</a>}
      </div>
      {showMap && valid.length>=1 && <div style={{marginTop:11}}><MapCanvas waypoints={valid}/></div>}
    </div>
  );
}

/* ── Budget Tab ──────────────────────────────────────────────────────────── */
function BudgetTab({ trip }) {
  const [rates, setRates]   = useState(null);
  const [loading, setLoad]  = useState(false);
  const [fetchTime, setFT]  = useState(null);

  const loadRates = async () => {
    setLoad(true);
    const r = await getExchangeRates();
    setRates(r); setLoad(false);
    setFT(new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}));
  };
  useEffect(() => { loadRates(); }, []);

  const allExp = safeArr(trip.days).flatMap(d => safeArr(d.expenses).map(e=>({...e, date:d.date})));
  const byCur  = {};
  allExp.forEach(e => {
    const c = e.currency || trip.currency || "KRW";
    byCur[c] = (byCur[c]||0) + (+e.amount||0);
  });
  let krwTotal = 0;
  if (rates) Object.entries(byCur).forEach(([c,a]) => { krwTotal += a*(rates[c]||1); });

  const byCat = EXP_CATS.map(c => ({...c, total:allExp.filter(e=>e.category===c.id).reduce((a,e)=>a+(+e.amount||0),0)})).filter(c=>c.total>0);

  return (
    <div style={{paddingBottom:40}}>
      <div style={{background:"rgba(212,168,83,.06)",border:"1px solid rgba(212,168,83,.18)",borderRadius:18,padding:"20px 18px 16px",marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:10,color:"#D4A85370",letterSpacing:2,marginBottom:4}}>총 여행 경비 (원화 환산)</div>
        {rates ? (
          <>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:44,fontWeight:600,color:"#D4A853",lineHeight:1}}>{Math.round(krwTotal).toLocaleString()}</div>
            <div style={{fontSize:13,color:"#D4A85370",marginTop:2}}>KRW</div>
          </>
        ) : (
          <div style={{fontSize:13,color:"#F5ECD748",padding:"8px 0"}}>{loading?"환율 조회중...":"—"}</div>
        )}

        {Object.keys(byCur).length>0 && (
          <div style={{display:"flex",gap:7,flexWrap:"wrap",justifyContent:"center",marginTop:11}}>
            {Object.entries(byCur).map(([cur,amt])=>(
              <div key={cur} style={{background:"rgba(0,0,0,.18)",border:"1px solid rgba(212,168,83,.13)",borderRadius:9,padding:"4px 10px",textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:600,color:"#F5ECD7"}}>{amt.toLocaleString()}</div>
                <div style={{fontSize:9.5,color:"#D4A853",letterSpacing:.8}}>{cur}</div>
                {rates&&cur!=="KRW"&&<div style={{fontSize:9.5,color:"#F5ECD738"}}>≈{Math.round(amt*(rates[cur]||1)).toLocaleString()}₩</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,marginTop:10}}>
          <button onClick={loadRates} disabled={loading}
            style={{background:"rgba(212,168,83,.1)",border:"1px solid rgba(212,168,83,.25)",color:"#D4A853",padding:"4px 12px",borderRadius:7,cursor:"pointer",fontSize:11,opacity:loading?.5:1}}>
            {loading?"조회중...":"🔄 환율 새로고침"}
          </button>
          {fetchTime && <span style={{fontSize:10,color:"#F5ECD738"}}>기준: {fetchTime}</span>}
        </div>
      </div>

      {rates && (
        <div style={{padding:"10px 13px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.055)",borderRadius:12,marginBottom:16}}>
          <div style={{fontSize:9.5,color:"#D4A85355",letterSpacing:1.5,marginBottom:7}}>현재 환율 (1단위 → 원화)</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {[
              {c:"USD", label:"$1"}, {c:"EUR", label:"€1"}, {c:"JPY", label:"¥100", mult:100},
              {c:"GBP", label:"£1"}, {c:"THB", label:"฿1"}, {c:"VND", label:"₫100", mult:100},
              {c:"SGD", label:"S$1"}, {c:"AUD", label:"A$1"}, {c:"TWD", label:"NT$1"},
              {c:"HKD", label:"HK$1"}, {c:"CNY", label:"¥1"},
            ].map(({c, label, mult=1})=>(
              <span key={c} style={{fontSize:10.5,color:"#F5ECD778",background:"rgba(255,255,255,.03)",padding:"2px 7px",borderRadius:6}}>
                {label}=<span style={{color:"#D4A853",fontWeight:600}}>{Math.round((rates[c]||0)*mult).toLocaleString()}</span>₩
              </span>
            ))}
          </div>
        </div>
      )}

      {byCat.length>0 && (
        <>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"#F5ECD7",marginBottom:11}}>카테고리별</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:20}}>
            {byCat.map(c=>(
              <div key={c.id} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.065)",borderRadius:13,padding:"12px 9px",textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:4}}>{c.icon}</div>
                <div style={{color:c.color,fontWeight:600,fontSize:13.5}}>{c.total.toLocaleString()}</div>
                <div style={{color:"#F5ECD768",fontSize:10.5,marginTop:1}}>{c.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"#F5ECD7",marginBottom:11}}>상세 내역</div>
      {allExp.length===0
        ? <div style={{color:"#F5ECD730",fontSize:13,textAlign:"center",padding:"18px 0"}}>지출 내역이 없습니다</div>
        : allExp.map((e,i)=>{
          const cat = EXP_CATS.find(x=>x.id===e.category);
          const cur = e.currency || trip.currency || "KRW";
          const krwEq = rates&&cur!=="KRW" ? Math.round((+e.amount)*(rates[cur]||1)) : null;
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:9,background:"rgba(255,255,255,.022)",border:"1px solid rgba(255,255,255,.05)",marginBottom:5}}>
              <span style={{fontSize:17}}>{cat?.icon||"💳"}</span>
              <div style={{flex:1}}>
                <div style={{color:"#F5ECD7",fontSize:13}}>{e.memo||cat?.label}</div>
                <div style={{color:"#F5ECD752",fontSize:10.5,marginTop:1}}>{fmtDate(e.date)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:cat?.color||"#D4A853",fontWeight:600,fontSize:13.5}}>{(+e.amount).toLocaleString()} <span style={{fontSize:10,fontWeight:400}}>{cur}</span></div>
                {krwEq&&<div style={{fontSize:10,color:"#F5ECD738"}}>≈{krwEq.toLocaleString()}₩</div>}
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function WanderLog() {
  const [trips,   setTrips]  = useState([]);
  const [loaded,  setLoaded] = useState(false);
  const [screen,  setScreen] = useState("home"); // "home" | "trip" | "day"
  const [selTrip, setST]     = useState(null);
  const [selDay,  setSD]     = useState(null);
  const [modal,   setModal]  = useState(false);

  useEffect(() => {
    storageLoad().then(data => { setTrips(safeArr(data)); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (loaded) storageSave(trips);
  }, [trips, loaded]);

  const updateTrip = t => { setTrips(p=>p.map(x=>x.id===t.id?t:x)); setST(t); };
  const deleteTrip = id => { setTrips(p=>p.filter(x=>x.id!==id)); setScreen("home"); setST(null); };

  const stats = {
    countries: new Set(trips.map(t=>t.country).filter(Boolean)).size,
    places:    trips.reduce((a,t)=>a+new Set(safeArr(t.days).flatMap(d=>getPlaceNames(d))).size,0),
    days:      trips.reduce((a,t)=>a+safeArr(t.days).length,0),
  };

  if (!loaded) return (
    <div style={{background:"#080F1C", display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{width:20,height:20,border:"2px solid rgba(212,168,83,.2)",borderTopColor:"#D4A853",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
        <span style={{fontSize:12,color:"#D4A85360"}}>불러오는 중...</span>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      {/* 반응형 뷰를 위한 전역 CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        
        * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
        body { background: #040811; font-family:'DM Sans', 'Pretendard', 'Apple SD Gothic Neo', sans-serif; color: #F5ECD7; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(212,168,83,0.3); border-radius: 4px; }
        
        /* 공통 유틸리티 클래스 */
        .tc { transition:all .22s cubic-bezier(.4,0,.2,1); }
        .tc:hover { transform:translateY(-2px); box-shadow:0 18px 48px rgba(0,0,0,.55)!important; }
        .tbtn { transition:all .18s; cursor:pointer; touch-action:manipulation; }
        .tbtn:active { transform:scale(.96); opacity:.82; }
        .hov:hover, .hov:active { background:rgba(212,168,83,.07)!important; }
        .hov { transition:background .12s; }
        
        input, textarea, select { background:rgba(255,255,255,.055)!important; border:1px solid rgba(212,168,83,.2)!important; color:#F5ECD7!important; border-radius:10px; padding:11px 13px; font-family:inherit; font-size:16px; outline:none; width:100%; -webkit-appearance:none; }
        input:focus, textarea:focus, select:focus { border-color:rgba(212,168,83,.5)!important; background:rgba(255,255,255,.08)!important; }
        input::placeholder, textarea::placeholder { color:rgba(245,236,215,.25)!important; }
        select option { background:#111D2E; color:#F5ECD7; }
        textarea { resize:vertical; min-height:108px; line-height:1.75; font-size:15px; }
        
        @keyframes fadeUp { from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:translateY(0)} }
        .fu { animation:fadeUp .3s ease forwards; }
        @keyframes spin { to{transform:rotate(360deg)} }
        
        input[type=date]::-webkit-calendar-picker-indicator, input[type=time]::-webkit-calendar-picker-indicator { filter:invert(.7) sepia(1) saturate(2) hue-rotate(5deg); cursor:pointer; }

        /* 화면 컴포넌트 내부 기본 영역 */
        .screen-container { width: 100%; height: 100%; position: relative; }

        /* -------------------------------------------------------------
           반응형 레이아웃 (Split View / Mobile Stack)
           ------------------------------------------------------------- */
        .app-wrapper {
          display: flex;
          min-height: 100vh;
          background: #040811;
        }

        .left-panel, .right-panel {
          width: 100%;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          background: #080F1C;
        }

        .desktop-empty { display: none; }
        .mobile-only { display: block; }

        /* 모바일 환경 (< 1024px) */
        @media (max-width: 1023px) {
          .app-wrapper {
             max-width: 680px; 
             margin: 0 auto;
             box-shadow: 0 0 50px rgba(0,0,0,0.5); /* 웹 브라우저 중앙에 띄울 때의 효과 */
          }
          .hidden-mobile { display: none !important; }
          .active-mobile { display: block !important; }
        }

        /* 데스크탑 환경 (>= 1024px) 스플릿 뷰 적용 */
        @media (min-width: 1024px) {
          .app-wrapper {
            padding: 24px;
            gap: 24px;
            height: 100vh;
            overflow: hidden;
            box-sizing: border-box;
            max-width: 1600px;
            margin: 0 auto;
          }
          .left-panel {
            width: 420px;
            flex-shrink: 0;
            border-radius: 24px;
            border: 1px solid rgba(212,168,83,.15);
            box-shadow: 0 10px 40px rgba(0,0,0,.4);
          }
          .right-panel {
            flex: 1;
            border-radius: 24px;
            border: 1px solid rgba(212,168,83,.15);
            box-shadow: 0 10px 40px rgba(0,0,0,.4);
            position: relative;
          }
          .desktop-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: rgba(245,236,215,.3);
            font-size: 20px;
            font-family: 'Cormorant Garamond', serif;
            gap: 16px;
          }
          /* 데스크탑에서는 오른쪽 화면의 뒤로가기 버튼(목록으로 가기)을 숨김 */
          .mobile-back-btn { display: none !important; }
        }
      `}</style>

      {/* 왼쪽 패널: 홈 화면 (모바일에서는 screen에 따라 숨김처리) */}
      <div className={`left-panel ${screen === 'home' ? 'active-mobile' : 'hidden-mobile'}`}>
        <HomeScreen trips={trips} stats={stats} 
          onSelect={t=>{setST(t); setScreen("trip");}} 
          onNew={()=>setModal(true)} />
      </div>

      {/* 오른쪽 패널: 상세 화면 (모바일에서는 screen에 따라 숨김처리) */}
      <div className={`right-panel ${screen !== 'home' ? 'active-mobile' : 'hidden-mobile'}`}>
        {screen === "trip" && selTrip && (
          <TripScreen trip={selTrip} onBack={()=>setScreen("home")}
            onSelectDay={d=>{setSD(d); setScreen("day");}}
            onUpdate={updateTrip} onDelete={deleteTrip} />
        )}
        {screen === "day" && selDay && selTrip && (
          <DayScreen day={selDay} trip={selTrip} 
            onBack={() => setScreen("trip")}
            onUpdate={u => {
              const t = {...selTrip, days: selTrip.days.map(d=>d.date===u.date?u:d)};
              updateTrip(t); setSD(u);
            }} />
        )}
        {/* 데스크탑 전용: 선택된 여행이 없을 때 보여주는 빈 화면 */}
        {screen === "home" && (
          <div className="desktop-empty fu">
            <span style={{fontSize:48, opacity:0.4}}>🧳</span>
            <span>왼쪽 목록에서 여행을 선택하거나 새로 만들어보세요</span>
          </div>
        )}
      </div>

      {modal && <NewTripModal onClose={()=>setModal(false)} onCreate={t=>{setTrips(p=>[t,...p]); setModal(false); setST(t); setScreen("trip");}} />}
    </div>
  );
}

/* ── HOME ────────────────────────────────────────────────────────────────── */
function HomeScreen({ trips, stats, onSelect, onNew }) {
  const [filter, setFilter] = useState("all");
  const countries = [...new Set(trips.map(t=>t.country).filter(Boolean))];
  const filtered  = filter==="all" ? trips : trips.filter(t=>t.country===filter);

  return (
    <div className="screen-container fu">
      <div style={{position:"relative",padding:"34px 20px 0",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 110% 75% at 50% -15%,rgba(212,168,83,.11),transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:13,marginBottom:22}}>
          <div style={S.logoMark}><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.5 9.5H22L16 14L18.5 21.5L12 17L5.5 21.5L8 14L2 9.5H9.5L12 2Z" fill="#0A1628"/></svg></div>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:23,fontWeight:700,letterSpacing:6,color:"#F5ECD7"}}>WANDERLOG</div>
            <div style={{fontSize:9.5,color:"#D4A85368",letterSpacing:2.5,marginTop:1}}>나만의 여행 아카이브</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:26}}>
          {[{v:stats.countries,l:"방문 국가",i:"🌍"},{v:stats.places,l:"방문 장소",i:"📍"},{v:stats.days,l:"여행 일수",i:"📅"}].map(x=>(
            <div key={x.l} style={S.statCard}>
              <div style={{fontSize:17,marginBottom:4}}>{x.i}</div>
              <div style={S.statVal}>{x.v}</div>
              <div style={S.statLbl}>{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.body}>
        <div style={S.row}><div style={S.secTitle}>여행 기록</div><button style={S.gold} className="tbtn" onClick={onNew}>+ 새 여행</button></div>

        {countries.length>0 && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16,marginTop:-6}}>
            {["all",...countries].map(c=>(
              <button key={c} style={{...S.filterBtn,...(filter===c?S.filterOn:{})}} className="tbtn" onClick={()=>setFilter(c)}>
                {c==="all"?"전체":c}
              </button>
            ))}
          </div>
        )}

        {trips.length===0 ? (
          <div style={{textAlign:"center",padding:"52px 16px"}}>
            <div style={{fontSize:60,marginBottom:14}}>🧳</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:23,color:"#F5ECD7",marginBottom:7}}>첫 여행을 기록해보세요</div>
            <div style={{fontSize:13.5,lineHeight:1.7,color:"#F5ECD778"}}>지나간 여행도, 앞으로의 여행도 모두 담아두세요</div>
            <button style={{...S.gold,marginTop:22,padding:"13px 30px",fontSize:14}} className="tbtn" onClick={onNew}>여행 추가하기</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:13}}>
            {filtered.map(t=><TripCard key={t.id} trip={t} onClick={()=>onSelect(t)}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

function TripCard({ trip, onClick }) {
  const places = [...new Set(safeArr(trip.days).flatMap(d=>getPlaceNames(d)))];
  const photos = safeArr(trip.days).flatMap(d=>safeArr(d.photos));
  const allExp = safeArr(trip.days).flatMap(d=>safeArr(d.expenses));
  const krwApprox = allExp.reduce((a,e)=>{
    const c=e.currency||trip.currency||"KRW";
    return a+(+e.amount||0)*(FALLBACK_RATES[c]||1);
  }, 0);

  return (
    <div className="tc" style={S.card} onClick={onClick}>
      <div style={{height:162,position:"relative",background:photos[0]?`url(${photos[0]}) center/cover`:trip.gradient}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(4,8,18,.93),transparent 55%)"}}/>
        <div style={{position:"absolute",top:11,right:12,fontSize:28}}>{trip.flag||"🌏"}</div>
        {photos.length>0 && <div style={S.photoBadge}>📷 {photos.length}</div>}
        <div style={{position:"absolute",bottom:11,left:13,right:13}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#fff",textShadow:"0 2px 10px rgba(0,0,0,.8)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{trip.title}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.58)",marginTop:2}}>{fmtShort(trip.startDate)} — {fmtShort(trip.endDate)}</div>
        </div>
      </div>
      <div style={{padding:"11px 13px 13px"}}>
        <div style={{display:"flex",gap:11,flexWrap:"wrap",fontSize:11.5,color:"#F5ECD778",marginBottom:7}}>
          <span>📅 {safeArr(trip.days).length}일</span>
          {places.length>0&&<span>📍 {places.length}개 장소</span>}
          {krwApprox>0&&<span>💰 {Math.round(krwApprox).toLocaleString()}₩</span>}
        </div>
        {places.length>0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {places.slice(0,3).map(c=><span key={c} style={S.chip}>{c}</span>)}
            {places.length>3&&<span style={S.chip}>+{places.length-3}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── TRIP SCREEN ─────────────────────────────────────────────────────────── */
function TripScreen({ trip, onBack, onSelectDay, onUpdate, onDelete }) {
  const [tab, setTab] = useState("timeline");
  const fileRef = useRef();
  const allWps = safeArr(trip.days).flatMap(d=>getWaypoints(d).filter(w=>w.lat&&w.lon));

  return (
    <div className="screen-container fu">
      <div style={{height:232,position:"relative",background:trip.coverImage?`url(${trip.coverImage}) center/cover`:trip.gradient}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(8,15,28,1),rgba(8,15,28,.22) 55%,transparent)"}}/>
        <div style={{position:"absolute",top:13,left:13,right:13,display:"flex",justifyContent:"space-between",zIndex:10}}>
          <button style={S.ghost} className="tbtn mobile-back-btn" onClick={onBack}>← 목록</button>
          <div style={{marginLeft:"auto", display:"flex",gap:7}}>
            <button style={S.ghost} className="tbtn" onClick={()=>fileRef.current?.click()}>📷 커버수정</button>
            <button style={{...S.ghost,color:"#ff9090"}} className="tbtn" onClick={()=>{if(confirm("삭제할까요?"))onDelete(trip.id)}}>🗑️</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
            const f=e.target.files[0]; if(!f) return;
            const r=new FileReader(); r.onload=ev=>onUpdate({...trip,coverImage:ev.target.result}); r.readAsDataURL(f);
          }}/>
        </div>
        <div style={{position:"absolute",bottom:14,left:18,right:18,zIndex:5}}>
          <div style={{fontSize:42,marginBottom:5,filter:"drop-shadow(0 3px 10px rgba(0,0,0,.55))"}}>{trip.flag||"🌏"}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:25,fontWeight:700,color:"#fff",textShadow:"0 2px 14px rgba(0,0,0,.7)"}}>{trip.title}</div>
          <div style={{fontSize:11.5,color:"rgba(255,255,255,.58)",marginTop:3}}>{trip.country} · {fmtDate(trip.startDate)} — {fmtDate(trip.endDate)}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
            <span style={S.heroPill}>✈️ {safeArr(trip.days).length}일</span>
          </div>
        </div>
      </div>

      <div style={S.tabBar}>
        {[["timeline","📅 타임라인"],["budget","💰 지출"],["map","🗺️ 전체지도"],["photos","🖼️ 사진"]].map(([id,lbl])=>(
          <button key={id} style={{...S.tab,...(tab===id?S.tabOn:{})}} className="tbtn" onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={S.body}>
        {tab==="timeline" && safeArr(trip.days).map((d,i)=>(
          <DayRow key={d.date} day={d} index={i} total={trip.days.length} onClick={()=>onSelectDay(d)}/>
        ))}
        {tab==="budget"   && <BudgetTab trip={trip}/>}
        {tab==="map"      && (
          <div style={{paddingBottom:40}}>
            {allWps.length>=1 ? <MapCanvas waypoints={allWps}/> :
              <div style={{textAlign:"center",padding:"44px 0",color:"#F5ECD72a",lineHeight:1.9,fontSize:13}}>날짜별 일지에서 장소를 검색해 추가하면<br/>전체 여행 동선이 여기에 표시됩니다</div>}
          </div>
        )}
        {tab==="photos"   && <PhotosTab photos={safeArr(trip.days).flatMap(d=>safeArr(d.photos))}/>}
      </div>
    </div>
  );
}

function DayRow({ day, index, total, onClick }) {
  const wps    = getWaypoints(day).filter(w=>w.name);
  const dayExp = safeArr(day.expenses).reduce((a,e)=>a+(+e.amount||0),0);
  const isLast = index === total-1;
  return (
    <div className="hov" style={{display:"flex",gap:13,padding:"15px 18px",borderBottom:isLast?"none":"1px solid rgba(212,168,83,.07)",cursor:"pointer"}} onClick={onClick}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:36,flexShrink:0}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:10,fontWeight:700,color:"#D4A853",letterSpacing:1,background:"rgba(212,168,83,.09)",padding:"3px",borderRadius:6,width:"100%",textAlign:"center"}}>D{index+1}</div>
        {!isLast&&<div style={{flex:1,width:1,background:"rgba(212,168,83,.15)",marginTop:5,minHeight:10}}/>}
      </div>
      <div style={{flex:1,paddingBottom:isLast?0:8}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#F5ECD7"}}>{fmtDate(day.date)}</div>
            {wps.length>0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
                {wps.slice(0,3).map((w,i)=>(
                  <span key={i} style={{fontSize:10.5,color:"#D4A853",background:"rgba(212,168,83,.07)",padding:"2px 7px",borderRadius:5}}>
                    {w.icon||"📍"} {w.name}{w.time?` @${w.time}`:""}
                  </span>
                ))}
                {wps.length>3&&<span style={{fontSize:10.5,color:"#D4A85368"}}>+{wps.length-3}</span>}
              </div>
            )}
          </div>
          {dayExp>0&&<div style={S.expBadge}>{dayExp.toLocaleString()}</div>}
        </div>
        {day.diary && <div style={{fontSize:12,color:"#F5ECD782",marginTop:6,lineHeight:1.6,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>"{day.diary.slice(0,75)}{day.diary.length>75?"…":""}"</div>}
        {safeArr(day.photos).length>0 && (
          <div style={{display:"flex",gap:4,marginTop:7}}>
            {day.photos.slice(0,4).map((p,i)=><div key={i} style={{width:40,height:40,borderRadius:7,backgroundSize:"cover",backgroundPosition:"center",border:"1px solid rgba(212,168,83,.15)",backgroundImage:`url(${p})`}}/>)}
            {day.photos.length>4&&<div style={{width:40,height:40,borderRadius:7,background:"rgba(212,168,83,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10.5,color:"#D4A853"}}>+{day.photos.length-4}</div>}
          </div>
        )}
        {!day.diary&&!wps.length&&!safeArr(day.photos).length&&<div style={{fontSize:11.5,color:"#F5ECD722",marginTop:4,fontStyle:"italic"}}>탭해서 기록 추가...</div>}
      </div>
    </div>
  );
}

function PhotosTab({ photos }) {
  const [prev, setPrev] = useState(null);
  if (!safeArr(photos).length) return (
    <div style={{textAlign:"center",padding:"44px 0",color:"#F5ECD72a",lineHeight:1.9,fontSize:13}}>사진이 없습니다<br/>날짜별 일지에서 사진을 추가하세요</div>
  );
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(100px, 1fr))",gap:6,marginBottom:14}}>
        {photos.map((p,i)=><div key={i} style={{aspectRatio:"1",borderRadius:9,backgroundSize:"cover",backgroundPosition:"center",border:"1px solid rgba(212,168,83,.13)",cursor:"pointer",backgroundImage:`url(${p})`}} onClick={()=>setPrev(p)}/>)}
      </div>
      {prev&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,cursor:"pointer"}} onClick={()=>setPrev(null)}>
        <img src={prev} style={{maxWidth:"92vw",maxHeight:"80vh",borderRadius:14,boxShadow:"0 28px 70px rgba(0,0,0,.8)"}} alt=""/>
      </div>}
    </div>
  );
}

/* ── DAY SCREEN ──────────────────────────────────────────────────────────── */
function DayScreen({ day, trip, onBack, onUpdate }) {
  const [wps,    setWps]    = useState(() => getWaypoints(day));
  const [diary,  setDiary]  = useState(() => safeStr(day.diary));
  const [acts,   setActs]   = useState(() => safeArr(day.activities));
  const [exps,   setExps]   = useState(() => safeArr(day.expenses));
  const [photos, setPhotos] = useState(() => safeArr(day.photos));
  const [newAct, setNewAct] = useState("");
  const [newExp, setNewExp] = useState({amount:"", category:"food", memo:"", currency:trip.currency||"KRW"});
  const [saved,  setSaved]  = useState(false);
  const [prev,   setPrev]   = useState(null);
  const fileRef = useRef();
  const idx = safeArr(trip.days).findIndex(d=>d.date===day.date);

  const save = () => {
    onUpdate({...day, waypoints:wps, city:wps[0]?.name||"", diary, activities:acts, expenses:exps, photos});
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  const addAct = () => {
    if (!newAct.trim()) return;
    setActs(p=>[...p,{id:uid(),name:newAct.trim()}]); setNewAct("");
  };

  const addExp = () => {
    if (!newExp.amount) return;
    setExps(p=>[...p,{id:uid(),...newExp}]); setNewExp(p=>({...p,amount:"",memo:""}));
  };

  const addPhotos = e => Array.from(e.target.files).forEach(f=>{
    const r=new FileReader(); r.onload=ev=>setPhotos(p=>[...p,ev.target.result]); r.readAsDataURL(f);
  });

  const dayExp = exps.reduce((a,e)=>a+(+e.amount||0),0);

  return (
    <div className="screen-container fu" style={{position: 'relative'}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:11,padding:"13px 15px 11px",borderBottom:"1px solid rgba(212,168,83,.1)",position:"sticky",top:0,zIndex:20,background:"#080F1C"}}>
        <button style={S.backRound} className="tbtn" onClick={onBack}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:10.5,letterSpacing:2.2,color:"#D4A85368",fontWeight:600,marginBottom:1}}>DAY {idx+1}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,color:"#F5ECD7",fontWeight:600,lineHeight:1.2}}>{fmtDate(day.date)}</div>
        </div>
        <button style={{...S.gold,padding:"9px 18px",fontSize:13,...(saved?{background:"#4CAF7E",color:"#fff"}:{})}} className="tbtn" onClick={save}>
          {saved?"✓ 저장됨":"저장"}
        </button>
      </div>

      <div style={{...S.body,paddingBottom:88}}>
        {/* Waypoints */}
        <div style={S.sec}>
          <div style={S.secLbl}>📍 오늘의 동선</div>
          <WaypointsEditor waypoints={wps} onChange={setWps}/>
        </div>

        {/* Photos */}
        <div style={S.sec}>
          <div style={{...S.row,marginBottom:9}}>
            <div style={S.secLbl}>📷 사진</div>
            <button style={C.addChip} className="tbtn" onClick={()=>fileRef.current?.click()}>+ 추가</button>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={addPhotos}/>
          </div>
          {photos.length>0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>
              {photos.map((p,i)=>(
                <div key={i} style={{position:"relative"}}>
                  <div style={{aspectRatio:"1",borderRadius:10,backgroundSize:"cover",backgroundPosition:"center",border:"1px solid rgba(212,168,83,.16)",cursor:"pointer",backgroundImage:`url(${p})`}} onClick={()=>setPrev(p)}/>
                  <button style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.62)",border:"none",color:"#fff",width:20,height:20,borderRadius:"50%",cursor:"pointer",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{border:"1.5px dashed rgba(212,168,83,.18)",borderRadius:11,padding:"24px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>
              <span style={{fontSize:26,opacity:.35}}>📷</span>
              <span style={{color:"#F5ECD728",fontSize:12,marginTop:3}}>탭해서 사진 추가</span>
            </div>
          )}
        </div>

        {/* Diary */}
        <div style={S.sec}>
          <div style={S.secLbl}>✍️ 여행 일기</div>
          <textarea value={diary} onChange={e=>setDiary(e.target.value)}
            placeholder={"오늘의 여행을 기록해보세요\n어떤 곳을 갔는지, 무엇을 먹었는지, 어떤 감정이었는지..."}/>
          {diary.length>0&&<div style={{textAlign:"right",fontSize:10.5,color:"#F5ECD728",marginTop:4}}>{diary.length}자</div>}
        </div>

        {/* Activities */}
        <div style={S.sec}>
          <div style={S.secLbl}>🗺️ 활동 & 메모</div>
          <div style={{display:"flex",gap:7,marginBottom:9}}>
            <input value={newAct} onChange={e=>setNewAct(e.target.value)} placeholder="간 곳, 먹은 것, 한 일..."
              onKeyDown={e=>e.key==="Enter"&&addAct()}/>
            <button style={S.goldSm} className="tbtn" onClick={addAct}>추가</button>
          </div>
          {acts.map(a=>(
            <div key={a.id} style={S.listItem}>
              <span style={{color:"#D4A853",fontSize:14}}>📌</span>
              <span style={{flex:1,color:"#F5ECD7",fontSize:13}}>{a.name}</span>
              <button style={C.delBtn} onClick={()=>setActs(p=>p.filter(x=>x.id!==a.id))}>✕</button>
            </div>
          ))}
        </div>

        {/* Expenses */}
        <div style={S.sec}>
          <div style={{...S.row,marginBottom:9}}>
            <div style={S.secLbl}>💰 지출</div>
            {dayExp>0&&<div style={{fontSize:11.5,color:"#D4A853",background:"rgba(212,168,83,.09)",padding:"3px 9px",borderRadius:7,border:"1px solid rgba(212,168,83,.18)"}}>합계 {dayExp.toLocaleString()}</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
            <select value={newExp.category} onChange={e=>setNewExp(p=>({...p,category:e.target.value}))}>
              {EXP_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
            <select value={newExp.currency} onChange={e=>setNewExp(p=>({...p,currency:e.target.value}))}>
              {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:7,marginBottom:9}}>
            <input type="number" value={newExp.amount} onChange={e=>setNewExp(p=>({...p,amount:e.target.value}))} placeholder="금액" style={{flex:"0 0 105px"}}/>
            <input value={newExp.memo} onChange={e=>setNewExp(p=>({...p,memo:e.target.value}))} placeholder="메모 (선택)" style={{flex:1}}/>
            <button style={{...S.goldSm,padding:"0 13px"}} className="tbtn" onClick={addExp}>추가</button>
          </div>
          {exps.map(e=>{
            const cat=EXP_CATS.find(x=>x.id===e.category);
            const cur=e.currency||trip.currency||"KRW";
            return (
              <div key={e.id} style={S.listItem}>
                <span style={{fontSize:17}}>{cat?.icon||"💳"}</span>
                <span style={{flex:1,color:"#F5ECD7",fontSize:13}}>{e.memo||cat?.label}</span>
                <div style={{textAlign:"right",marginRight:5}}>
                  <div style={{color:cat?.color||"#D4A853",fontWeight:600,fontSize:13}}>{(+e.amount).toLocaleString()}</div>
                  <div style={{fontSize:9.5,color:"#D4A85375",letterSpacing:.5}}>{cur}</div>
                </div>
                <button style={C.delBtn} onClick={()=>setExps(p=>p.filter(x=>x.id!==e.id))}>✕</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating save */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"9px 18px 22px",background:"linear-gradient(to top,#080F1C 62%,transparent)",zIndex:30,pointerEvents:"none"}}>
        <button style={{...S.gold,width:"100%",padding:"14px",fontSize:15,borderRadius:13,pointerEvents:"all",...(saved?{background:"#4CAF7E",color:"#fff"}:{})}} className="tbtn" onClick={save}>
          {saved?"✓ 저장됨":"저장하기"}
        </button>
      </div>

      {prev&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,cursor:"pointer"}} onClick={()=>setPrev(null)}>
        <img src={prev} style={{maxWidth:"92vw",maxHeight:"80vh",borderRadius:13,boxShadow:"0 28px 70px rgba(0,0,0,.85)"}} alt=""/>
      </div>}
    </div>
  );
}

/* ── NEW TRIP MODAL ──────────────────────────────────────────────────────── */
function NewTripModal({ onClose, onCreate }) {
  const [form, setForm] = useState({title:"",country:"",flag:"",startDate:"",endDate:"",currency:"KRW",gradient:GRADIENTS[0]});
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const handleCountry = v => { const af=guessFlag(v); setForm(p=>({...p,country:v,flag:af||p.flag})); };
  const valid = form.title && form.startDate && form.endDate && new Date(form.endDate) >= new Date(form.startDate);
  const dc = valid ? dateRange(form.startDate,form.endDate).length : 0;

  const create = () => {
    if (!valid) return;
    const dates = dateRange(form.startDate, form.endDate);
    onCreate({
      id:uid(), ...form, flag:form.flag||"🌏",
      days: dates.map(date=>({date, waypoints:[newWaypoint()], city:"", diary:"", activities:[], expenses:[], photos:[]}))
    });
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:"#0E1B2E",border:"1px solid rgba(212,168,83,.16)",borderRadius:"20px",width:"100%",maxWidth:500,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,.6)"}} className="fu">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"17px 19px 13px",borderBottom:"1px solid rgba(212,168,83,.1)"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:700,color:"#F5ECD7"}}>새 여행 만들기</div>
          <button style={{background:"rgba(255,255,255,.055)",border:"none",color:"#F5ECD768",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:12}} className="tbtn" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"15px 19px",overflowY:"auto",flex:1}}>
          <Fld label="여행 제목 *"><input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="예: 도쿄 벚꽃 여행 2025"/></Fld>
          <div style={{display:"flex",gap:9,marginBottom:12}}>
            <Fld label="국가" style={{flex:1}}>
              <input value={form.country} onChange={e=>handleCountry(e.target.value)} placeholder="예: 일본, Japan"/>
            </Fld>
            <Fld label={<>국기{guessFlag(form.country)&&<span style={{color:"#4CAF7E",fontSize:9,marginLeft:4}}>자동</span>}</>} style={{width:84}}>
              <input value={form.flag} onChange={e=>set("flag",e.target.value)} placeholder="🌏" style={{textAlign:"center",fontSize:21,padding:"8px 4px"}}/>
            </Fld>
          </div>
          <div style={{display:"flex",gap:9,marginBottom:5}}>
            <Fld label="시작일 *" style={{flex:1}}><input type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)}/></Fld>
            <Fld label="종료일 *" style={{flex:1}}><input type="date" value={form.endDate} onChange={e=>set("endDate",e.target.value)}/></Fld>
          </div>
          {dc>0&&<div style={{fontSize:11.5,color:"#D4A853",marginBottom:12,textAlign:"right"}}>✦ {dc}일 여행</div>}
          <Fld label="기본 통화" style={{marginBottom:12}}>
            <select value={form.currency} onChange={e=>set("currency",e.target.value)} style={{maxWidth:130}}>
              {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </Fld>
          <Fld label="테마 색상">
            <div style={{display:"flex",gap:8,marginTop:2}}>
              {GRADIENTS.map((g,i)=><div key={i} style={{width:38,height:24,borderRadius:7,background:g,cursor:"pointer",border:form.gradient===g?"3px solid #D4A853":"3px solid transparent",transition:"border .13s"}} onClick={()=>set("gradient",g)}/>)}
            </div>
          </Fld>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 19px 26px",borderTop:"1px solid rgba(212,168,83,.09)"}}>
          <button style={{background:"transparent",color:"#F5ECD775",border:"1px solid rgba(245,236,215,.13)",borderRadius:10,padding:"10px 17px",fontSize:13,cursor:"pointer"}} className="tbtn" onClick={onClose}>취소</button>
          <button style={{...S.gold,opacity:valid?1:.38,cursor:valid?"pointer":"not-allowed",padding:"10px 21px"}} className={valid?"tbtn":""} onClick={create}>여행 만들기 ✦</button>
        </div>
      </div>
    </div>
  );
}

function Fld({ label, children, style }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12,...style}}>
      <label style={{fontSize:10,color:"#D4A85378",letterSpacing:1.4,fontWeight:600,textTransform:"uppercase"}}>{label}</label>
      {children}
    </div>
  );
}

/* ── Shared small constants ──────────────────────────────────────────────── */
const C = {
  btnAdd:  {background:"rgba(212,168,83,.09)",border:"1px solid rgba(212,168,83,.26)",color:"#D4A853",padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12.5,fontWeight:500},
  btnMap:  {background:"rgba(100,180,255,.06)",border:"1px solid rgba(100,180,255,.2)",color:"#88d4ff",padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12.5},
  btnGMaps:{background:"rgba(66,185,131,.07)",border:"1px solid rgba(66,185,131,.24)",color:"#42b983",padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:12.5,textDecoration:"none",display:"inline-flex",alignItems:"center"},
  addChip: {background:"rgba(212,168,83,.1)",border:"1px solid rgba(212,168,83,.26)",color:"#D4A853",padding:"5px 12px",borderRadius:7,cursor:"pointer",fontSize:12},
  delBtn:  {background:"none",border:"none",color:"#F5ECD728",cursor:"pointer",fontSize:12.5,padding:"4px 5px"},
};

/* ── Global styles (인라인 유지) ─────────────────────────────────────────── */
const S = {
  body:     {padding:"0 18px 22px"},
  row:      {display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14},
  secTitle: {fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:600,color:"#F5ECD7"},
  sec:      {marginBottom:24},
  secLbl:   {fontSize:10.5,fontWeight:600,color:"#D4A853",letterSpacing:2,marginBottom:8,textTransform:"uppercase"},
  gold:     {background:"linear-gradient(135deg,#D4A853,#F5C842)",color:"#0A1628",border:"none",borderRadius:10,padding:"10px 19px",fontWeight:700,fontSize:14,cursor:"pointer"},
  goldSm:   {background:"linear-gradient(135deg,#D4A853,#F5C842)",color:"#0A1628",border:"none",borderRadius:8,padding:"0 14px",fontWeight:700,cursor:"pointer",fontSize:13,height:43,flexShrink:0},
  ghost:    {background:"rgba(0,0,0,.38)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.12)",color:"#fff",borderRadius:20,padding:"6px 13px",cursor:"pointer",fontSize:11.5},
  backRound:{background:"rgba(212,168,83,.09)",border:"1px solid rgba(212,168,83,.2)",color:"#D4A853",width:35,height:35,borderRadius:9,cursor:"pointer",fontSize:15,flexShrink:0},
  logoMark: {width:42,height:42,background:"linear-gradient(135deg,#D4A853,#F5C842)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 3px 20px rgba(212,168,83,.4)",flexShrink:0},
  statCard: {flex:1,background:"rgba(212,168,83,.065)",border:"1px solid rgba(212,168,83,.16)",borderRadius:15,padding:"12px 7px",textAlign:"center"},
  statVal:  {fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:600,color:"#D4A853",lineHeight:1},
  statLbl:  {fontSize:9.5,color:"#F5ECD752",marginTop:3},
  filterBtn:{background:"rgba(255,255,255,.045)",border:"1px solid rgba(255,255,255,.09)",color:"#F5ECD775",padding:"6px 13px",borderRadius:18,cursor:"pointer",fontSize:12},
  filterOn: {background:"rgba(212,168,83,.13)",border:"1px solid rgba(212,168,83,.33)",color:"#D4A853"},
  card:     {background:"#0F1B2D",borderRadius:18,overflow:"hidden",border:"1px solid rgba(212,168,83,.1)",boxShadow:"0 5px 24px rgba(0,0,0,.32)"},
  photoBadge:{position:"absolute",top:11,left:12,background:"rgba(0,0,0,.42)",backdropFilter:"blur(6px)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.78)",fontSize:10.5,padding:"2px 8px",borderRadius:18},
  chip:     {background:"rgba(212,168,83,.09)",border:"1px solid rgba(212,168,83,.2)",color:"#D4A853",fontSize:10.5,padding:"2px 8px",borderRadius:18},
  tabBar:   {display:"flex",borderBottom:"1px solid rgba(212,168,83,.11)",padding:"0 5px",background:"rgba(8,15,28,.97)",position:"sticky",top:0,zIndex:20,overflowX:"auto"},
  tab:      {padding:"12px 11px",fontSize:11.5,fontWeight:500,color:"#F5ECD752",background:"none",border:"none",cursor:"pointer",borderBottom:"2px solid transparent",transition:"all .18s",whiteSpace:"nowrap",flexShrink:0},
  tabOn:    {color:"#D4A853",borderBottomColor:"#D4A853"},
  heroPill: {background:"rgba(0,0,0,.38)",backdropFilter:"blur(5px)",border:"1px solid rgba(255,255,255,.11)",color:"rgba(255,255,255,.72)",fontSize:11,padding:"3px 10px",borderRadius:18},
  expBadge: {background:"rgba(212,168,83,.09)",border:"1px solid rgba(212,168,83,.22)",color:"#D4A853",fontSize:10.5,padding:"2px 8px",borderRadius:6,flexShrink:0},
  listItem: {display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:8,background:"rgba(255,255,255,.022)",border:"1px solid rgba(255,255,255,.048)",marginBottom:5},
};
