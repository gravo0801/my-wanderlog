import { useState, useEffect, useRef, useCallback } from "react";

/* ── Storage (Vercel/Browser용 localStorage로 수정) ───────────────────────────── */
const STORAGE_KEY = "wl_trips";

async function storageSave(trips) {
  try { 
    // 브라우저의 로컬 스토리지를 사용하여 데이터를 저장합니다.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips)); 
  } catch (e) { 
    console.warn("저장 실패:", e); 
  }
}

async function storageLoad() {
  try { 
    // 브라우저의 로컬 스토리지에서 데이터를 불러옵니다.
    const r = localStorage.getItem(STORAGE_KEY); 
    return r ? JSON.parse(r) : []; 
  } catch (e) { 
    console.warn("불러오기 실패:", e);
    return []; 
  }
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
    // 주의: Vercel 배포 시 API Key 보안을 위해 서버리스 함수를 쓰는 것이 좋으나, 
    // 여기서는 기존 로직 유지를 위해 남겨둡니다. API Key가 없으면 작동하지 않습니다.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-3-sonnet-20240229", max_tokens:maxTokens, messages:[{role:"user",content:prompt}] })
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
  // API Key가 없으면 Fallback을 즉시 반환하도록 설정 가능
  return FALLBACK_RATES;
}

/* ── Place Suggestions ───────────────────────────────────────────────────── */
async function fetchPlaces(query) {
  // 클로드 API 연결 전까지는 빈 배열을 반환하거나 목업 데이터를 쓸 수 있습니다.
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
      }
      pts.forEach((p,i)=>{
        ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fillStyle="#D4A853"; ctx.fill();
        ctx.strokeStyle="#fff"; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle="#0A1628"; ctx.font="bold 11px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(i+1,p.x,p.y);
      });
      setMapStatus("ok");
    };

    const check=()=>{ done++; if(done>=total) drawPins(); };
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
    <div style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(212,168,83,.2)",position:"relative"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:250,display:"block",background:"#0A1628"}}/>
      <div style={{background:"#0D1B2E",padding:"7px 11px",display:"flex",gap:5,flexWrap:"wrap",borderTop:"1px solid rgba(212,168,83,.12)"}}>
        {waypoints.map((w,i)=>(
          <span key={i} style={{fontSize:11,color:"#D4A853",background:"rgba(212,168,83,.1)",padding:"2px 8px",borderRadius:7}}>
            {w.icon||"📍"} {i+1}. {w.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Place Search ────────────────────────────────────────────────────────── */
function PlaceSearch({ value, placeholder, onSelect, onNameChange }) {
  const [q, setQ] = useState(value || "");
  const handleChange = e => {
    const v = e.target.value;
    setQ(v);
    onNameChange?.(v);
  };

  return (
    <div style={{position:"relative",flex:1,minWidth:0}}>
      <input value={q} onChange={handleChange} placeholder={placeholder||"장소 입력…"} />
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
            <PlaceSearch
              value={safeStr(wp.name)}
              onNameChange={n => updateWp(wp.id, {name:n})}
            />
            <input type="time" value={safeStr(wp.time)} onChange={e=>updateWp(wp.id,{time:e.target.value})}
              style={{width:80,flexShrink:0}}/>
            {waypoints.length>1 && (
              <button onClick={()=>removeWp(wp.id)} style={{width:30}}>✕</button>
            )}
          </div>
        </div>
      ))}
      <div style={{display:"flex",gap:7,marginTop:10}}>
        <button onClick={addWp} style={C.btnAdd}>+ 장소 추가</button>
      </div>
    </div>
  );
}

/* ── Budget Tab ──────────────────────────────────────────────────────────── */
function BudgetTab({ trip }) {
  const allExp = safeArr(trip.days).flatMap(d => safeArr(d.expenses).map(e=>({...e, date:d.date})));
  const total = allExp.reduce((a,e)=>(a + (+e.amount||0)), 0);

  return (
    <div style={{paddingBottom:40}}>
      <div style={{background:"rgba(212,168,83,.06)",border:"1px solid rgba(212,168,83,.18)",borderRadius:18,padding:20,textAlign:"center"}}>
        <div style={{fontSize:10,color:"#D4A85370"}}>총 지출 합계</div>
        <div style={{fontSize:44,fontWeight:600,color:"#D4A853"}}>{total.toLocaleString()}</div>
        <div style={{fontSize:13,color:"#D4A85370"}}>{trip.currency || "KRW"}</div>
      </div>
    </div>
  );
}

/* ── MAIN APP ────────────────────────────────────────────────────────────── */
export default function WanderLog() {
  const [trips,   setTrips]  = useState([]);
  const [loaded,  setLoaded] = useState(false);
  const [screen,  setScreen] = useState("home");
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
  const deleteTrip = id => { setTrips(p=>p.filter(x=>x.id!==id)); setScreen("home"); };

  if (!loaded) return <div style={{color:"#D4A853", padding:20}}>로딩 중...</div>;

  return (
    <div style={S.app}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        input,textarea,select{background:rgba(255,255,255,.055);border:1px solid rgba(212,168,83,.2);color:#F5ECD7;border-radius:10px;padding:11px 13px;outline:none;width:100%;}
        button{cursor:pointer; transition: opacity 0.2s;} button:active{opacity: 0.6;}
      `}</style>

      {screen==="home" && (
        <div style={S.screen}>
            <div style={{padding:20}}>
                <h1 style={{color:"#D4A853", marginBottom:20}}>WanderLog</h1>
                <button style={S.gold} onClick={()=>setModal(true)}>+ 새 여행 시작하기</button>
                <div style={{marginTop:30}}>
                    {trips.map(t => (
                        <div key={t.id} style={S.card} onClick={()=>{setST(t); setScreen("trip");}}>
                            <div style={{padding:15, background: t.gradient}}>
                                <h3>{t.flag} {t.title}</h3>
                                <p style={{fontSize:12, opacity:0.8}}>{t.startDate} ~ {t.endDate}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {screen==="trip" && selTrip && (
        <div style={S.screen}>
            <div style={{padding:20}}>
                <button onClick={()=>setScreen("home")} style={{background:"none", border:"none", color:"#D4A853", marginBottom:15}}>← 뒤로가기</button>
                <h2>{selTrip.flag} {selTrip.title}</h2>
                <div style={{marginTop:20}}>
                    {selTrip.days.map((d, i) => (
                        <div key={d.date} style={S.listItem} onClick={()=>{setSD(d); setScreen("day");}}>
                            Day {i+1} - {d.date}
                        </div>
                    ))}
                </div>
                <button onClick={()=>deleteTrip(selTrip.id)} style={{marginTop:40, color:"#ff7f7f", background:"none", border:"none"}}>여행 기록 삭제</button>
            </div>
        </div>
      )}

      {screen==="day" && selDay && selTrip && (
        <div style={S.screen}>
            <div style={{padding:20}}>
                <button onClick={()=>setScreen("trip")} style={{background:"none", border:"none", color:"#D4A853", marginBottom:15}}>← 날짜 선택으로</button>
                <h3>{selDay.date} 기록</h3>
                <div style={{marginTop:20}}>
                    <label style={S.secLbl}>메모/일기</label>
                    <textarea value={selDay.diary} onChange={e=>{
                        const newDay = {...selDay, diary: e.target.value};
                        const newTrip = {...selTrip, days: selTrip.days.map(day => day.date === selDay.date ? newDay : day)};
                        updateTrip(newTrip);
                        setSD(newDay);
                    }} />
                </div>
            </div>
        </div>
      )}

      {modal && (
        <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, zIndex:100}}>
            <div style={{background:"#0F1B2D", padding:20, borderRadius:15, width:"100%", maxWidth:400}}>
                <h2 style={{marginBottom:15}}>새 여행 등록</h2>
                <input placeholder="여행 제목" id="new-title" style={{marginBottom:10}} />
                <input type="date" id="new-start" style={{marginBottom:10}} />
                <input type="date" id="new-end" style={{marginBottom:10}} />
                <div style={{display:"flex", gap:10, marginTop:10}}>
                    <button style={{flex:1, padding:10}} onClick={()=>setModal(false)}>취소</button>
                    <button style={{...S.gold, flex:1}} onClick={()=>{
                        const title = document.getElementById('new-title').value;
                        const start = document.getElementById('new-start').value;
                        const end = document.getElementById('new-end').value;
                        if(!title || !start || !end) return alert("내용을 입력해주세요.");
                        const dates = dateRange(start, end);
                        const newT = {
                            id: uid(), title, startDate: start, endDate: end, gradient: GRADIENTS[Math.floor(Math.random()*GRADIENTS.length)],
                            days: dates.map(d => ({date: d, diary: "", waypoints: [], expenses: []}))
                        };
                        setTrips([newT, ...trips]);
                        setModal(false);
                    }}>만들기</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const S = {
  app:      {fontFamily:"sans-serif", background:"#080F1C", minHeight:"100vh", color:"#F5ECD7"},
  screen:   {maxWidth:600, margin:"0 auto"},
  card:     {background:"#0F1B2D", borderRadius:12, overflow:"hidden", marginBottom:15, border:"1px solid rgba(212,168,83,0.2)"},
  listItem: {padding:15, background:"rgba(255,255,255,0.05)", borderRadius:8, marginBottom:10, border:"1px solid rgba(255,255,255,0.1)"},
  secLbl:   {display:"block", fontSize:12, color:"#D4A853", marginBottom:8, marginTop:20},
  gold:     {background:"#D4A853", color:"#0A1628", border:"none", borderRadius:8, padding:"12px", fontWeight:"bold", width:"100%"}
};

const C = {
  btnAdd: {background:"rgba(212,168,83,0.1)", border:"1px solid #D4A853", color:"#D4A853", padding:"8px 15px", borderRadius:6}
};
