import { useState, useEffect, useRef, useCallback } from "react";

/* ── Storage (window.storage for artifact env or LocalStorage for Vercel) ── */
const STORAGE_KEY = "wl_trips";
async function storageSave(trips) {
  try {
    if (window.storage) await window.storage.set(STORAGE_KEY, JSON.stringify(trips));
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch (e) { console.warn("save:", e); }
}
async function storageLoad() {
  try {
    if (window.storage) {
      const r = await window.storage.get(STORAGE_KEY);
      return r ? JSON.parse(r.value) : [];
    } else {
      const r = localStorage.getItem(STORAGE_KEY);
      return r ? JSON.parse(r) : [];
    }
  } catch { return []; }
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
  {id:"flight",   label:"항공",    icon:"✈️"},
  {id:"train",    label:"기차",    icon:"🚄"},
];
const GRADIENTS = [
  "linear-gradient(135deg,#e0c3fc,#8ec5fc)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
  "linear-gradient(135deg,#84fab0,#8fd3f4)",
  "linear-gradient(135deg,#ff9a9e,#fecfef)",
  "linear-gradient(135deg,#cfd9df,#e2ebf0)",
];

const FLAG_MAP = {"한국":"🇰🇷","대한민국":"🇰🇷","korea":"🇰🇷","south korea":"🇰🇷","일본":"🇯🇵","japan":"🇯🇵","미국":"🇺🇸","usa":"🇺🇸"};
const guessFlag = c => c ? (FLAG_MAP[c.toLowerCase().trim()] || null) : null;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const newWaypoint = () => ({id:uid(), name:"", lat:null, lon:null, transport:"transit", time:"", travelTime:"", icon:""});
const getWaypoints = d => {
  if (safeArr(d?.waypoints).length) return d.waypoints;
  if (d?.city) return [{...newWaypoint(), id:"lg", name:d.city}];
  return [newWaypoint()];
};
const getPlaceNames = d => getWaypoints(d).map(w=>w.name).filter(Boolean);

/* ── Place Search (Fixed with Nominatim OSM API) ─────────────────────────── */
async function fetchPlaces(query) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
    const data = await res.json();
    return data.map(item => ({
      name: item.name || item.display_name.split(",")[0],
      sub: item.display_name,
      lat: item.lat,
      lon: item.lon,
      icon: "📍"
    }));
  } catch (e) { return []; }
}

/* ── Exchange Rates (Mocked for Vercel without Backend) ──────────────────── */
const FALLBACK_RATES = {KRW:1,USD:1380,EUR:1510,JPY:9.2,GBP:1750,CNY:192,THB:39,VND:0.054,SGD:1020,AUD:900,TWD:43,HKD:177};
async function getExchangeRates() { return FALLBACK_RATES; } // 복잡한 API 대신 기본 환율 제공

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
    ctx.fillStyle = "#F0F4F8"; ctx.fillRect(0,0,W,H); // Light background for map
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
        ctx.beginPath(); ctx.strokeStyle="#8A6B3E"; ctx.lineWidth=3; // Premium Gold Line
        ctx.setLineDash([8,8]);
        ctx.moveTo(pts[0].x,pts[0].y); pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.stroke();
        ctx.setLineDash([]);
      }
      pts.forEach((p,i)=>{
        ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fillStyle="#8A6B3E"; ctx.fill();
        ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle="#FFF"; ctx.font="bold 12px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(i+1,p.x,p.y);
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
    <div style={{borderRadius:16,overflow:"hidden",border:"1px solid rgba(0,0,0,.08)",boxShadow:"0 10px 30px rgba(0,0,0,.05)",position:"relative"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:250,display:"block",background:"#F0F4F8"}}/>
      {mapStatus==="loading"&&(
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:8,background:"rgba(255,255,255,0.8)",backdropFilter:"blur(4px)",padding:"10px 20px",borderRadius:20}}>
          <span style={{fontSize:12,color:"#4A5568",fontWeight:600}}>지도 로딩중...</span>
        </div>
      )}
    </div>
  );
}

/* ── Place Search (Autocomplete Component) ───────────────────────────────── */
function PlaceSearch({ value, placeholder, onSelect, onNameChange }) {
  const [q, setQ]         = useState(value || "");
  const [results, setRes] = useState([]);
  const [loading, setLd]  = useState(false);
  const [open, setOpen]   = useState(false);
  const debRef = useRef(), wrapRef = useRef();

  useEffect(() => { setQ(value || ""); }, [value]);

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
    const v = e.target.value; setQ(v); onNameChange?.(v); doSearch(v);
  };

  const handlePick = item => {
    setQ(item.name); setOpen(false); setRes([]);
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
        <input value={q} onChange={handleChange} placeholder={placeholder||"장소 검색..."}
          onFocus={()=>results.length>0 && setOpen(true)}
          style={{paddingRight: loading ? 42 : 13}} />
        {loading && <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#A0AEC0"}}>검색중</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,right:0,background:"#FFFFFF",border:"1px solid rgba(0,0,0,.08)",borderRadius:12,zIndex:1000,overflow:"hidden",boxShadow:"0 18px 40px rgba(0,0,0,.1)"}}>
          {results.map((item,i) => (
            <div key={i} style={{padding:"12px 14px",cursor:"pointer",borderBottom:"1px solid #EDF2F7"}}
              onMouseDown={()=>handlePick(item)}>
              <div style={{color:"#2D3748",fontSize:14,fontWeight:600}}>{item.name}</div>
              {item.sub && <div style={{color:"#A0AEC0",fontSize:11,marginTop:3}}>{item.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Waypoints Editor ────────────────────────────────────────────────────── */
function WaypointsEditor({ waypoints, onChange }) {
  const [showMap, setShowMap] = useState(false);
  const valid = waypoints.filter(w=>w.lat && w.lon);

  const addWp    = () => onChange([...waypoints, newWaypoint()]);
  const updateWp = (id, patch) => onChange(waypoints.map(w => w.id===id ? {...w,...patch} : w));
  const removeWp = id => onChange(waypoints.filter(w => w.id!==id));

  return (
    <div>
      {waypoints.map((wp, i) => (
        <div key={wp.id} style={{marginBottom:10, background:"#FFF", padding:"14px", borderRadius:16, border:"1px solid #E2E8F0", boxShadow:"0 2px 10px rgba(0,0,0,0.02)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#FFF",background:wp.lat?"#8A6B3E":"#CBD5E0",boxShadow:"0 4px 10px rgba(138,107,62,0.3)"}}>
              {i+1}
            </div>
            <PlaceSearch
              value={safeStr(wp.name)} placeholder={i===0 ? "출발 장소 검색..." : "경유/도착 장소 검색..."}
              onSelect={p => updateWp(wp.id, {name:p.name, lat:p.lat, lon:p.lon, icon:p.icon})}
              onNameChange={n => updateWp(wp.id, {name:n, lat:null, lon:null, icon:""})}
            />
            {waypoints.length>1 && (
              <button onClick={()=>removeWp(wp.id)} style={{background:"#FFF5F5",color:"#E53E3E",border:"none",width:32,height:32,borderRadius:10,cursor:"pointer"}}>✕</button>
            )}
          </div>
        </div>
      ))}

      <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
        <button onClick={addWp} style={C.btnAdd}>+ 장소 추가</button>
        {valid.length>=1 && <button onClick={()=>setShowMap(p=>!p)} style={C.btnMap}>{showMap?"지도 닫기":"전체 지도 보기"}</button>}
      </div>
      {showMap && valid.length>=1 && <div style={{marginTop:16}}><MapCanvas waypoints={valid}/></div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function WanderLog() {
  const [trips,   setTrips]  = useState([]);
  const [loaded,  setLoaded] = useState(false);
  const [screen,  setScreen] = useState("home");
  const [selTrip, setST]     = useState(null);
  const [selDay,  setSD]     = useState(null);
  const [modal,   setModal]  = useState(false);

  useEffect(() => { storageLoad().then(data => { setTrips(safeArr(data)); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) storageSave(trips); }, [trips, loaded]);

  const updateTrip = t => { setTrips(p=>p.map(x=>x.id===t.id?t:x)); setST(t); };
  const deleteTrip = id => { setTrips(p=>p.filter(x=>x.id!==id)); setScreen("home"); setST(null); };

  const stats = {
    places: trips.reduce((a,t)=>a+new Set(safeArr(t.days).flatMap(d=>getPlaceNames(d))).size,0),
    days:   trips.reduce((a,t)=>a+safeArr(t.days).length,0),
  };

  if (!loaded) return <div style={{background:"#F9F9F8", minHeight:"100vh"}} />

  return (
    <div className="app-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Pretendard:wght@400;500;600;700&display=swap');
        
        * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
        body { background: #F9F9F8; font-family:'Pretendard', 'Apple SD Gothic Neo', sans-serif; color: #2D3748; letter-spacing: -0.3px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
        
        /* 폼 요소 디자인 (Light Premium) */
        input, textarea, select { 
          background: #FFFFFF!important; 
          border: 1px solid #E2E8F0!important; 
          color: #2D3748!important; 
          border-radius: 12px; 
          padding: 14px 16px; 
          font-family: inherit; 
          font-size: 15px; 
          outline: none; 
          width: 100%; 
          box-shadow: 0 2px 6px rgba(0,0,0,0.02);
          transition: all 0.2s;
        }
        input:focus, textarea:focus, select:focus { 
          border-color: #8A6B3E!important; 
          box-shadow: 0 0 0 3px rgba(138,107,62,0.15)!important; 
        }
        input::placeholder, textarea::placeholder { color: #A0AEC0!important; font-weight: 400; }
        
        /* 공통 유틸리티 */
        .tbtn { transition:all .15s ease-out; cursor:pointer; }
        .tbtn:active { transform:scale(.97); opacity:.8; }
        
        /* 레이아웃 (반응형 스플릿 뷰) */
        .app-wrapper { display: flex; min-height: 100vh; background: #F9F9F8; }
        .left-panel, .right-panel { width: 100%; height: 100vh; overflow-y: auto; overflow-x: hidden; background: #F9F9F8; }

        @media (max-width: 1023px) {
          .app-wrapper { max-width: 600px; margin: 0 auto; box-shadow: 0 0 30px rgba(0,0,0,0.05); background:#FFF; }
          .left-panel, .right-panel { background: #FFF; }
          .hidden-mobile { display: none !important; }
          .active-mobile { display: block !important; }
        }
        @media (min-width: 1024px) {
          .app-wrapper { padding: 32px; gap: 32px; height: 100vh; overflow: hidden; max-width: 1400px; margin: 0 auto; }
          .left-panel { width: 400px; flex-shrink: 0; border-radius: 28px; background: #FFFFFF; border: 1px solid #E2E8F0; box-shadow: 0 20px 40px rgba(0,0,0,.04); }
          .right-panel { flex: 1; border-radius: 28px; background: #FFFFFF; border: 1px solid #E2E8F0; box-shadow: 0 20px 40px rgba(0,0,0,.04); position: relative; }
          .mobile-back-btn { display: none !important; }
        }
      `}</style>

      {/* 좌측 패널: 홈 */}
      <div className={`left-panel ${screen === 'home' ? 'active-mobile' : 'hidden-mobile'}`}>
        <HomeScreen trips={trips} stats={stats} onSelect={t=>{setST(t); setScreen("trip");}} onNew={()=>setModal(true)} />
      </div>

      {/* 우측 패널: 상세 */}
      <div className={`right-panel ${screen !== 'home' ? 'active-mobile' : 'hidden-mobile'}`}>
        {screen === "trip" && selTrip && <TripScreen trip={selTrip} onBack={()=>setScreen("home")} onSelectDay={d=>{setSD(d); setScreen("day");}} onUpdate={updateTrip} onDelete={deleteTrip} />}
        {screen === "day" && selDay && selTrip && <DayScreen day={selDay} trip={selTrip} onBack={() => setScreen("trip")} onUpdate={u => { const t = {...selTrip, days: selTrip.days.map(d=>d.date===u.date?u:d)}; updateTrip(t); setSD(u); }} />}
        {screen === "home" && (
          <div className="hidden-mobile" style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#A0AEC0",gap:16}}>
            <span style={{fontSize:50,opacity:0.5}}>✈️</span>
            <span style={{fontSize:18,fontWeight:500}}>왼쪽 목록에서 여행을 선택하거나 추가해주세요</span>
          </div>
        )}
      </div>

      {modal && <NewTripModal onClose={()=>setModal(false)} onCreate={t=>{setTrips(p=>[t,...p]); setModal(false); setST(t); setScreen("trip");}} />}
    </div>
  );
}

/* ── HOME SCREEN ─────────────────────────────────────────────────────────── */
function HomeScreen({ trips, stats, onSelect, onNew }) {
  return (
    <div style={{position:"relative", height:"100%"}}>
      <div style={{padding:"40px 24px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:30}}>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:"#1A202C",letterSpacing:1}}>Wanderlog</div>
            <div style={{fontSize:13,color:"#718096",marginTop:2}}>나만의 프리미엄 여행 일지</div>
          </div>
          <button style={S.btnPrimary} className="tbtn" onClick={onNew}>새 여행</button>
        </div>
        
        <div style={{display:"flex",gap:12,marginBottom:32}}>
          {[{v:trips.length,l:"Trips"},{v:stats.places,l:"Places"},{v:stats.days,l:"Days"}].map(x=>(
            <div key={x.l} style={{flex:1,background:"#F7FAFC",borderRadius:16,padding:"16px 12px",textAlign:"center",border:"1px solid #EDF2F7"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"#8A6B3E",lineHeight:1}}>{x.v}</div>
              <div style={{fontSize:11,color:"#A0AEC0",marginTop:6,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>{x.l}</div>
            </div>
          ))}
        </div>

        {trips.length===0 ? (
          <div style={{textAlign:"center",padding:"60px 20px",background:"#F8FAFC",borderRadius:24,border:"1px dashed #CBD5E0"}}>
            <div style={{fontSize:40,marginBottom:16}}>🧳</div>
            <div style={{fontSize:18,fontWeight:600,color:"#2D3748",marginBottom:8}}>첫 여행을 기록해보세요</div>
            <div style={{fontSize:14,color:"#718096"}}>소중한 추억을 아름답게 보관해 드립니다.</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {trips.map(t=>(
              <div key={t.id} className="tbtn" style={{background:"#FFF",borderRadius:24,overflow:"hidden",boxShadow:"0 12px 30px rgba(0,0,0,0.06)",border:"1px solid #EDF2F7"}} onClick={()=>onSelect(t)}>
                <div style={{height:160,position:"relative",background:t.coverImage?`url(${t.coverImage}) center/cover`:t.gradient}}>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.6),transparent 60%)"}}/>
                  <div style={{position:"absolute",top:16,right:16,fontSize:32,filter:"drop-shadow(0 4px 6px rgba(0,0,0,0.3))"}}>{t.flag||"✈️"}</div>
                  <div style={{position:"absolute",bottom:16,left:20,right:20}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,color:"#FFF",textShadow:"0 2px 8px rgba(0,0,0,0.4)"}}>{t.title}</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.9)",marginTop:4,fontWeight:500}}>{fmtShort(t.startDate)} - {fmtShort(t.endDate)}</div>
                  </div>
                </div>
              </div>
            ))}
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

  return (
    <div style={{height:"100%", overflowY:"auto", paddingBottom:80}}>
      <div style={{height:280,position:"relative",background:trip.coverImage?`url(${trip.coverImage}) center/cover`:trip.gradient}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.7),transparent 70%)"}}/>
        
        {/* 상단 액션 바 */}
        <div style={{position:"absolute",top:20,left:20,right:20,display:"flex",justifyContent:"space-between",zIndex:10}}>
          <button style={S.glassBtn} className="tbtn mobile-back-btn" onClick={onBack}>← 뒤로</button>
          <div style={{marginLeft:"auto", display:"flex",gap:10}}>
            <label style={S.glassBtn} className="tbtn">
              📷 커버 변경
              <input type="file" accept="image/*" hidden onChange={e=>{
                const f=e.target.files[0]; if(!f) return;
                const r=new FileReader(); r.onload=ev=>onUpdate({...trip,coverImage:ev.target.result}); r.readAsDataURL(f);
              }}/>
            </label>
            <button style={{...S.glassBtn,color:"#FFB3B3"}} className="tbtn" onClick={()=>{if(confirm("정말 삭제할까요?"))onDelete(trip.id)}}>삭제</button>
          </div>
        </div>

        {/* 타이틀 영역 */}
        <div style={{position:"absolute",bottom:24,left:24,right:24,zIndex:5}}>
          <div style={{fontSize:48,marginBottom:8,filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.4))"}}>{trip.flag||"✈️"}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:"#FFF",textShadow:"0 4px 12px rgba(0,0,0,0.6)"}}>{trip.title}</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.9)",marginTop:6,fontWeight:500}}>{trip.country} · {fmtDate(trip.startDate)} - {fmtDate(trip.endDate)}</div>
        </div>
      </div>

      <div style={{display:"flex",borderBottom:"1px solid #EDF2F7",padding:"0 12px",position:"sticky",top:0,background:"rgba(255,255,255,0.9)",backdropFilter:"blur(10px)",zIndex:20,overflowX:"auto"}}>
        {[["timeline","타임라인"],["map","전체지도"],["photos","사진갤러리"]].map(([id,lbl])=>(
          <button key={id} style={{padding:"16px 16px",fontSize:14,fontWeight:600,color:tab===id?"#8A6B3E":"#A0AEC0",background:"none",border:"none",cursor:"pointer",borderBottom:`3px solid ${tab===id?"#8A6B3E":"transparent"}`,transition:"all .2s",whiteSpace:"nowrap"}} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={{padding:"24px"}}>
        {tab==="timeline" && safeArr(trip.days).map((d,i)=><DayRow key={d.date} day={d} index={i} onClick={()=>onSelectDay(d)}/>)}
        {tab==="map"      && <MapCanvas waypoints={safeArr(trip.days).flatMap(d=>getWaypoints(d).filter(w=>w.lat))}/>}
        {tab==="photos"   && <PhotosTab photos={safeArr(trip.days).flatMap(d=>safeArr(d.photos))}/>}
      </div>
    </div>
  );
}

function DayRow({ day, index, onClick }) {
  const wps = getWaypoints(day).filter(w=>w.name);
  const photos = safeArr(day.photos);
  return (
    <div className="tbtn" style={{display:"flex",gap:16,padding:"20px",marginBottom:16,background:"#FFF",borderRadius:20,border:"1px solid #EDF2F7",boxShadow:"0 8px 20px rgba(0,0,0,0.03)"}} onClick={onClick}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:700,color:"#FFF",background:"#8A6B3E",padding:"6px 10px",borderRadius:10}}>Day {index+1}</div>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:16,fontWeight:700,color:"#2D3748",marginBottom:6}}>{fmtDate(day.date)}</div>
        {wps.length>0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {wps.slice(0,3).map((w,i)=><span key={i} style={{fontSize:12,color:"#4A5568",background:"#F7FAFC",padding:"4px 10px",borderRadius:8,border:"1px solid #E2E8F0"}}>{w.name}</span>)}
          </div>
        )}
        {day.diary && <div style={{fontSize:14,color:"#718096",lineHeight:1.6,background:"#F8FAFC",padding:"12px",borderRadius:12}}>"{day.diary.slice(0,60)}..."</div>}
      </div>
    </div>
  );
}

function PhotosTab({ photos }) {
  if (!safeArr(photos).length) return <div style={{textAlign:"center",padding:"60px 0",color:"#A0AEC0"}}>등록된 사진이 없습니다.</div>;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(110px, 1fr))",gap:12}}>
      {photos.map((p,i)=><div key={i} style={{aspectRatio:"1",borderRadius:16,backgroundSize:"cover",backgroundPosition:"center",boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}} style={{backgroundImage:`url(${p})`,aspectRatio:"1",borderRadius:16,backgroundSize:"cover",backgroundPosition:"center"}}/>)}
    </div>
  );
}

/* ── DAY SCREEN (상세 입력 화면) ─────────────────────────────────────────── */
function DayScreen({ day, trip, onBack, onUpdate }) {
  const [wps,    setWps]    = useState(() => getWaypoints(day));
  const [diary,  setDiary]  = useState(() => safeStr(day.diary));
  const [photos, setPhotos] = useState(() => safeArr(day.photos));
  const [saved,  setSaved]  = useState(false);

  const save = () => {
    onUpdate({...day, waypoints:wps, city:wps[0]?.name||"", diary, photos});
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  const addPhotos = e => Array.from(e.target.files).forEach(f=>{
    const r=new FileReader(); r.onload=ev=>setPhotos(p=>[...p,ev.target.result]); r.readAsDataURL(f);
  });

  return (
    <div style={{height:"100%", overflowY:"auto", paddingBottom:100, position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",background:"rgba(255,255,255,0.9)",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:30,borderBottom:"1px solid #EDF2F7"}}>
        <button style={S.iconBtn} onClick={onBack}>←</button>
        <div style={{fontSize:16,fontWeight:700,color:"#2D3748"}}>{fmtDate(day.date)}</div>
        <button style={saved?S.btnSuccess:S.btnPrimary} onClick={save}>{saved?"저장완료":"저장"}</button>
      </div>

      <div style={{padding:"24px"}}>
        {/* 장소 섹션 */}
        <div style={S.secBox}>
          <div style={S.secTitle}>📍 일정 & 동선 검색</div>
          <WaypointsEditor waypoints={wps} onChange={setWps}/>
        </div>

        {/* 일기 섹션 */}
        <div style={S.secBox}>
          <div style={S.secTitle}>✍️ 나만의 여행 노트</div>
          <textarea value={diary} onChange={e=>setDiary(e.target.value)} placeholder="오늘 어떤 멋진 일들이 있었나요?" style={{minHeight:150}}/>
        </div>

        {/* 사진 섹션 (label 태그 사용하여 모바일 업로드 버그 해결) */}
        <div style={S.secBox}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={S.secTitle} style={{margin:0, fontWeight:700, fontSize:15, color:"#2D3748"}}>📷 사진 갤러리</div>
            <label style={C.btnAdd} className="tbtn">
              + 기기 사진 추가
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
            </label>
          </div>
          
          {/* 네이버 마이박스 연동 준비 버튼 */}
          <div style={{background:"#03C75A", color:"#FFF", padding:"12px 16px", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:16, cursor:"pointer", boxShadow:"0 4px 12px rgba(3,199,90,0.3)"}} onClick={() => alert("현재 프론트엔드 환경에서는 지원되지 않습니다. 추후 OAuth 기반 백엔드 연동이 필요합니다.")}>
            <span style={{fontWeight:800}}>N</span> <span>MYBOX 연동하여 가져오기</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {photos.map((p,i)=>(
              <div key={i} style={{position:"relative",aspectRatio:"1",borderRadius:16,backgroundImage:`url(${p})`,backgroundSize:"cover",backgroundPosition:"center",boxShadow:"0 4px 10px rgba(0,0,0,0.08)"}}>
                <button style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.6)",color:"#FFF",border:"none",width:24,height:24,borderRadius:"50%",cursor:"pointer"}} onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── NEW TRIP MODAL ──────────────────────────────────────────────────────── */
function NewTripModal({ onClose, onCreate }) {
  const [form, setForm] = useState({title:"",country:"",flag:"",startDate:"",endDate:"",gradient:GRADIENTS[0]});
  const valid = form.title && form.startDate && form.endDate;

  const create = () => {
    if (!valid) return;
    const dates = dateRange(form.startDate, form.endDate);
    onCreate({
      id:uid(), ...form, flag:form.flag||"✈️",
      days: dates.map(date=>({date, waypoints:[newWaypoint()], diary:"", photos:[]}))
    });
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
      <div style={{background:"#FFF",borderRadius:28,width:"90%",maxWidth:480,boxShadow:"0 24px 60px rgba(0,0,0,.15)",overflow:"hidden"}}>
        <div style={{padding:"24px",borderBottom:"1px solid #EDF2F7",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:20,fontWeight:700,color:"#2D3748"}}>새 여행 시작하기</div>
          <button style={S.iconBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"24px",display:"flex",flexDirection:"column",gap:16}}>
          <div><label style={S.label}>여행 제목</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="도쿄 벚꽃 여행"/></div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}><label style={S.label}>국가</label><input value={form.country} onChange={e=>setForm({...form,country:e.target.value,flag:guessFlag(e.target.value)||form.flag})} placeholder="일본"/></div>
            <div style={{width:80}}><label style={S.label}>국기</label><input value={form.flag} onChange={e=>setForm({...form,flag:e.target.value})} style={{textAlign:"center"}} placeholder="🇯🇵"/></div>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}><label style={S.label}>시작일</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></div>
            <div style={{flex:1}}><label style={S.label}>종료일</label><input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></div>
          </div>
          <div>
            <label style={S.label}>테마 색상</label>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              {GRADIENTS.map((g,i)=><div key={i} style={{width:40,height:40,borderRadius:12,background:g,cursor:"pointer",border:form.gradient===g?"3px solid #8A6B3E":"3px solid transparent"}} onClick={()=>setForm({...form,gradient:g})}/>)}
            </div>
          </div>
        </div>
        <div style={{padding:"20px 24px",background:"#F8FAFC",display:"flex",justifyContent:"flex-end",gap:12}}>
          <button style={{padding:"12px 20px",borderRadius:12,border:"none",background:"#E2E8F0",color:"#4A5568",fontWeight:600}} onClick={onClose}>취소</button>
          <button style={{...S.btnPrimary, opacity:valid?1:0.5}} onClick={create}>여행 만들기</button>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────────────── */
const C = {
  btnAdd: {background:"#F7FAFC",border:"1px solid #E2E8F0",color:"#4A5568",padding:"8px 16px",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer"},
  btnMap: {background:"#FFF5EB",border:"1px solid #FBD38D",color:"#DD6B20",padding:"8px 16px",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer"},
};

const S = {
  btnPrimary: {background:"linear-gradient(135deg, #A88653, #8A6B3E)",color:"#FFF",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:600,fontSize:15,boxShadow:"0 6px 16px rgba(138,107,62,0.3)",cursor:"pointer"},
  btnSuccess: {background:"#48BB78",color:"#FFF",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:600,fontSize:15,boxShadow:"0 6px 16px rgba(72,187,120,0.3)",cursor:"pointer"},
  glassBtn: {background:"rgba(255,255,255,0.25)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.4)",color:"#FFF",borderRadius:12,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"},
  iconBtn: {background:"#F7FAFC",border:"1px solid #E2E8F0",width:36,height:36,borderRadius:10,color:"#4A5568",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  secBox: {marginBottom:24, background:"#FFF", padding:"24px", borderRadius:24, border:"1px solid #EDF2F7", boxShadow:"0 10px 30px rgba(0,0,0,0.03)"},
  secTitle: {fontSize:15, fontWeight:700, color:"#2D3748", marginBottom:16},
  label: {fontSize:12, fontWeight:600, color:"#718096", marginBottom:6, display:"block"}
};
