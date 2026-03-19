import { useState, useEffect, useRef, useCallback } from "react";

/* ── Storage ─────────────────────────────────────────────────────────────── */
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
  {id:"food",       label:"식비",   icon:"🍜"},
  {id:"transport",  label:"교통",   icon:"🚌"},
  {id:"lodging",    label:"숙박",   icon:"🏨"},
  {id:"sightseeing",label:"관광",   icon:"🎭"},
  {id:"shopping",   label:"쇼핑",   icon:"🛍️"},
  {id:"other",      label:"기타",   icon:"💳"},
];
const PAYMENT_METHODS = [
  {id:"card",   label:"💳 신용카드"},
  {id:"cash",   label:"💵 현금"},
  {id:"travel", label:"🪪 트래블카드"}
];

const GRADIENTS = [
  "linear-gradient(135deg,#e0c3fc,#8ec5fc)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
  "linear-gradient(135deg,#84fab0,#8fd3f4)",
  "linear-gradient(135deg,#ff9a9e,#fecfef)",
  "linear-gradient(135deg,#cfd9df,#e2ebf0)",
];

const FLAG_MAP = {"한국":"🇰🇷","korea":"🇰🇷","일본":"🇯🇵","japan":"🇯🇵","미국":"🇺🇸","usa":"🇺🇸","태국":"🇹🇭","베트남":"🇻🇳","대만":"🇹🇼","프랑스":"🇫🇷","영국":"🇬🇧"};
const guessFlag = c => c ? (FLAG_MAP[c.toLowerCase().trim()] || null) : null;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const newWaypoint = () => ({id:uid(), name:"", lat:null, lon:null, time:"", icon:""});
const getWaypoints = d => safeArr(d?.waypoints).length ? d.waypoints : [newWaypoint()];
const getPlaceNames = d => getWaypoints(d).map(w=>w.name).filter(Boolean);

/* ── Place Search (Nominatim with Strict Multilingual Support) ───────────── */
async function fetchPlaces(query) {
  try {
    // accept-language를 ko-KR,ko,en 우선으로 주어 한글 검색결과를 최우선으로 가져옵니다.
    // 영어 지명, 현지어 지명 입력 시에도 정상 작동합니다.
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&accept-language=ko-KR,ko,en-US,en`;
    const res = await fetch(url);
    const data = await res.json();
    
    return data.map(item => {
      const name = item.name || item.display_name.split(",")[0];
      const sub = item.display_name;
      
      let icon = "📍";
      if(item.type === "hotel" || item.type === "guest_house") icon = "🏨";
      else if(item.type === "restaurant" || item.type === "cafe" || item.type === "fast_food") icon = "🍽️";
      else if(item.type === "museum" || item.type === "attraction" || item.type === "viewpoint") icon = "🏛️";
      
      return { name, sub, lat: item.lat, lon: item.lon, icon };
    }).filter((item, index, self) => 
      index === self.findIndex((t) => t.name === item.name && t.lat === item.lat)
    ).slice(0, 5);
  } catch (e) { return []; }
}

/* ── Canvas Map (Upgraded with Actual OSRM Road Routing) ─────────────────── */
const lon2tile = (lon,z) => Math.floor((lon+180)/360 * (1<<z));
const lat2tile = (lat,z) => Math.floor((1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 * (1<<z));
const tile2lon = (x,z) => x/(1<<z)*360 - 180;
const tile2lat = (y,z) => { const n = Math.PI - 2*Math.PI*y/(1<<z); return 180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n))); };

function MapCanvas({ waypoints }) {
  const canvasRef = useRef();
  const [mapStatus, setMapStatus] = useState("idle");
  const drewRef = useRef(false); // 중복 그리기 방지

  useEffect(() => {
    drewRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !waypoints.length) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth || 620, H = 250;
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#F0F4F8"; ctx.fillRect(0,0,W,H);
    setMapStatus("loading");

    const lats = waypoints.map(w=>parseFloat(w.lat)).filter(n=>!isNaN(n));
    const lons = waypoints.map(w=>parseFloat(w.lon)).filter(n=>!isNaN(n));
    if (!lats.length) { setMapStatus("idle"); return; }

    const minLat=Math.min(...lats), maxLat=Math.max(...lats);
    const minLon=Math.min(...lons), maxLon=Math.max(...lons);
    const cLat=(minLat+maxLat)/2, cLon=(minLon+maxLon)/2;

    let zoom = 14;
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

    const drawRouteAndPins = async () => {
      const pts = waypoints.filter(w=>w.lat&&w.lon).map(w=>({x:px(parseFloat(w.lon)),y:py(parseFloat(w.lat)), lon:w.lon, lat:w.lat}));
      
      if (pts.length > 1) {
        try {
          // OSRM API를 사용하여 실제 자동차 도로 기반 경로 요청
          const coords = pts.map(p => `${p.lon},${p.lat}`).join(';');
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
          const data = await res.json();

          ctx.beginPath();
          ctx.strokeStyle = "#8A6B3E";
          ctx.lineWidth = 4;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.shadowColor = "rgba(138,107,62,0.4)";
          ctx.shadowBlur = 8;

          if (data.routes && data.routes[0]) {
            // 실제 도로 동선 그리기
            const routeGeom = data.routes[0].geometry.coordinates;
            routeGeom.forEach((coord, idx) => {
              const rx = px(coord[0]), ry = py(coord[1]);
              if (idx === 0) ctx.moveTo(rx, ry);
              else ctx.lineTo(rx, ry);
            });
          } else {
            // 경로를 찾지 못할 경우 직선 폴백
            ctx.setLineDash([8,8]);
            ctx.moveTo(pts[0].x, pts[0].y);
            pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
        } catch (e) {
          // 에러 시 직선 폴백
          ctx.beginPath(); ctx.strokeStyle = "#8A6B3E"; ctx.lineWidth = 3; ctx.setLineDash([8,8]);
          ctx.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
        }
      }

      // 핀(숫자 마커) 그리기
      pts.forEach((p,i)=>{
        ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fillStyle="#8A6B3E"; ctx.fill();
        ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle="#FFF"; ctx.font="bold 12px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(i+1,p.x,p.y);
      });
      setMapStatus("ok");
    };

    const check = async () => { 
      done++; 
      if(done >= total && !drewRef.current) { drewRef.current = true; await drawRouteAndPins(); }
    };
    
    // 타일 로딩 지연 시 폴백 처리
    setTimeout(async () => { 
      if(!drewRef.current) { drewRef.current = true; await drawRouteAndPins(); }
    }, 3500);

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
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.85)",backdropFilter:"blur(6px)",padding:"10px 20px",borderRadius:20,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
          <span style={{fontSize:12,color:"#4A5568",fontWeight:600}}>지도 경로를 그리는 중...</span>
        </div>
      )}
    </div>
  );
}

/* ── Place Search Autocomplete ───────────────────────────────────────────── */
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
    }, 500);
  }, []);

  const handleChange = e => {
    const v = e.target.value; setQ(v); onNameChange?.(v); doSearch(v);
  };

  const handlePick = item => {
    setQ(item.name); setOpen(false); setRes([]);
    onSelect({ name: item.name, lat: String(item.lat), lon: String(item.lon), icon: item.icon });
  };

  useEffect(() => {
    const close = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={wrapRef} style={{position:"relative",flex:1,minWidth:0}}>
      <div style={{position:"relative"}}>
        <input value={q} onChange={handleChange} placeholder={placeholder||"호텔, 식당, 지명 검색..."}
          onFocus={()=>results.length>0 && setOpen(true)}
          style={{paddingRight: loading ? 42 : 13}} />
        {loading && <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#A0AEC0"}}>검색중</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,right:0,background:"#FFFFFF",border:"1px solid rgba(0,0,0,.08)",borderRadius:12,zIndex:1000,overflow:"hidden",boxShadow:"0 18px 40px rgba(0,0,0,.15)",maxHeight:250,overflowY:"auto"}}>
          {results.map((item,i) => (
            <div key={i} style={{padding:"12px 14px",cursor:"pointer",borderBottom:"1px solid #EDF2F7",display:"flex",gap:10,alignItems:"center"}}
              onMouseDown={()=>handlePick(item)}>
              <span style={{fontSize:18}}>{item.icon}</span>
              <div>
                <div style={{color:"#2D3748",fontSize:14,fontWeight:600}}>{item.name}</div>
                {item.sub && <div style={{color:"#A0AEC0",fontSize:11,marginTop:2}}>{item.sub}</div>}
              </div>
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
        <div key={wp.id} style={{marginBottom:10, background:"#F7FAFC", padding:"14px", borderRadius:16, border:"1px solid #E2E8F0"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#FFF",background:wp.lat?"#8A6B3E":"#CBD5E0",boxShadow:"0 4px 10px rgba(138,107,62,0.3)"}}>
              {i+1}
            </div>
            <PlaceSearch
              value={safeStr(wp.name)} placeholder={i===0 ? "출발 장소 (호텔/공항 등)..." : "다음 목적지 검색..."}
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
        {valid.length>=1 && <button onClick={()=>setShowMap(p=>!p)} style={C.btnMap}>{showMap?"지도 닫기":"실제 동선 지도 보기"}</button>}
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
        body { background: #F9F9F8; font-family:'Pretendard', sans-serif; color: #2D3748; letter-spacing: -0.3px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
        
        input, textarea, select { 
          background: #FFFFFF!important; border: 1px solid #E2E8F0!important; color: #2D3748!important; 
          border-radius: 12px; padding: 14px 16px; font-family: inherit; font-size: 15px; outline: none; 
          width: 100%; box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: all 0.2s;
        }
        input:focus, textarea:focus, select:focus { border-color: #8A6B3E!important; box-shadow: 0 0 0 3px rgba(138,107,62,0.15)!important; }
        input::placeholder, textarea::placeholder { color: #A0AEC0!important; font-weight: 400; }
        
        .tbtn { transition:all .15s ease-out; cursor:pointer; }
        .tbtn:active { transform:scale(.97); opacity:.8; }
        
        .app-wrapper { display: flex; min-height: 100vh; background: #F9F9F8; }
        .left-panel, .right-panel { width: 100%; height: 100vh; overflow-y: auto; overflow-x: hidden; background: #F9F9F8; }

        /* Custom Toast Animation */
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .toast-msg { animation: slideDown 0.3s ease-out forwards; }

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

      <div className={`left-panel ${screen === 'home' ? 'active-mobile' : 'hidden-mobile'}`}>
        <HomeScreen trips={trips} stats={stats} onSelect={t=>{setST(t); setScreen("trip");}} onNew={()=>setModal(true)} />
      </div>

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
  const exps = safeArr(day.expenses);

  return (
    <div className="tbtn" style={{display:"flex",gap:16,padding:"20px",marginBottom:16,background:"#FFF",borderRadius:20,border:"1px solid #EDF2F7",boxShadow:"0 8px 20px rgba(0,0,0,0.03)"}} onClick={onClick}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:700,color:"#FFF",background:"#8A6B3E",padding:"6px 10px",borderRadius:10}}>Day {index+1}</div>
      </div>
      <div style={{flex:1}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
          <div style={{fontSize:16,fontWeight:700,color:"#2D3748"}}>{fmtDate(day.date)}</div>
          {exps.length > 0 && <span style={{fontSize:12, fontWeight:600, color:"#8A6B3E", background:"#FFF5EB", padding:"4px 8px", borderRadius:6}}>지출 {exps.length}건</span>}
        </div>
        
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

/* ── DAY SCREEN (일정 & 지출 내역 입력) ────────────────────────────────── */
function DayScreen({ day, trip, onBack, onUpdate }) {
  const [wps,    setWps]    = useState(() => getWaypoints(day));
  const [diary,  setDiary]  = useState(() => safeStr(day.diary));
  const [photos, setPhotos] = useState(() => safeArr(day.photos));
  const [exps,   setExps]   = useState(() => safeArr(day.expenses));
  const [saved,  setSaved]  = useState(false);
  const [toast,  setToast]  = useState(""); // 부드러운 알림창을 위한 상태

  const [newExp, setNewExp] = useState({amount:"", category:"food", method:"card", currency:trip.currency||"KRW", memo:""});

  const save = () => {
    onUpdate({...day, waypoints:wps, city:wps[0]?.name||"", diary, photos, expenses:exps});
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  const addPhotos = e => Array.from(e.target.files).forEach(f=>{
    const r=new FileReader(); r.onload=ev=>setPhotos(p=>[...p,ev.target.result]); r.readAsDataURL(f);
  });

  // 네이버 마이박스 클릭 핸들러 (에러창 대신 토스트 알림)
  const handleNaverMyBox = () => {
    setToast("현재 웹 환경에서는 네이버 연동이 제한되어 임시로 기기 앨범을 엽니다.");
    setTimeout(() => setToast(""), 3500);
  };

  const handleAddExp = () => {
    if (!newExp.amount) return;
    setExps([...exps, { id: uid(), ...newExp }]);
    setNewExp({ ...newExp, amount:"", memo:"" });
  };

  const deleteExp = (id) => setExps(exps.filter(e => e.id !== id));

  return (
    <div style={{height:"100%", overflowY:"auto", paddingBottom:100, position:"relative"}}>
      
      {/* Toast 알림 UI */}
      {toast && (
        <div className="toast-msg" style={{position:"fixed", top:20, left:"50%", zIndex:999, background:"#2D3748", color:"#FFF", padding:"12px 20px", borderRadius:12, fontSize:14, fontWeight:600, boxShadow:"0 8px 20px rgba(0,0,0,0.2)", width:"90%", maxWidth:400, textAlign:"center"}}>
          {toast}
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",background:"rgba(255,255,255,0.9)",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:30,borderBottom:"1px solid #EDF2F7"}}>
        <button style={S.iconBtn} onClick={onBack}>←</button>
        <div style={{fontSize:16,fontWeight:700,color:"#2D3748"}}>{fmtDate(day.date)}</div>
        <button style={saved?S.btnSuccess:S.btnPrimary} onClick={save}>{saved?"저장완료":"저장"}</button>
      </div>

      <div style={{padding:"24px"}}>
        <div style={S.secBox}>
          <div style={S.secTitle}>📍 일정 & 동선 기록</div>
          <WaypointsEditor waypoints={wps} onChange={setWps}/>
        </div>

        <div style={S.secBox}>
          <div style={S.secTitle}>💰 일일 지출 내역</div>
          
          <div style={{background:"#F7FAFC", padding:"16px", borderRadius:16, marginBottom:16, border:"1px solid #E2E8F0"}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
              <div>
                <label style={S.label}>카테고리</label>
                <select value={newExp.category} onChange={e=>setNewExp({...newExp, category:e.target.value})}>
                  {EXP_CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>결제 수단</label>
                <select value={newExp.method} onChange={e=>setNewExp({...newExp, method:e.target.value})}>
                  {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>
            
            <div style={{display:"flex", gap:12, marginBottom:12}}>
              <div style={{flex:1}}>
                <label style={S.label}>금액</label>
                <div style={{display:"flex", gap:8}}>
                  <select value={newExp.currency} onChange={e=>setNewExp({...newExp, currency:e.target.value})} style={{width:90, padding:"12px 8px"}}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" placeholder="금액" value={newExp.amount} onChange={e=>setNewExp({...newExp, amount:e.target.value})} style={{flex:1}} />
                </div>
              </div>
            </div>

            <div style={{display:"flex", gap:12, alignItems:"flex-end"}}>
              <div style={{flex:1}}>
                <label style={S.label}>사용처 / 메모</label>
                <input type="text" placeholder="예: 스타벅스 커피" value={newExp.memo} onChange={e=>setNewExp({...newExp, memo:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleAddExp()} />
              </div>
              <button onClick={handleAddExp} style={{...S.btnPrimary, padding:"14px 24px", height:"50px"}}>추가</button>
            </div>
          </div>

          {exps.length > 0 ? (
            <div style={{display:"flex", flexDirection:"column", gap:10}}>
              {exps.map(e => {
                const cat = EXP_CATS.find(c => c.id === e.category);
                return (
                  <div key={e.id} style={{display:"flex", alignItems:"center", padding:"12px 16px", background:"#FFF", border:"1px solid #EDF2F7", borderRadius:12, gap:12}}>
                    <div style={{fontSize:20}}>{cat?.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14, fontWeight:600, color:"#2D3748"}}>{e.memo || cat?.label}</div>
                      <div style={{fontSize:11, color:"#A0AEC0", marginTop:2}}>{PAYMENT_METHODS.find(m=>m.id===e.method)?.label}</div>
                    </div>
                    <div style={{textAlign:"right", marginRight:8}}>
                      <div style={{fontSize:15, fontWeight:700, color:"#8A6B3E"}}>{Number(e.amount).toLocaleString()}</div>
                      <div style={{fontSize:11, color:"#A0AEC0"}}>{e.currency}</div>
                    </div>
                    <button onClick={()=>deleteExp(e.id)} style={{background:"none", border:"none", color:"#E53E3E", cursor:"pointer", fontSize:16}}>✕</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{textAlign:"center", padding:"20px", color:"#A0AEC0", fontSize:13}}>지출 내역이 없습니다.</div>
          )}
        </div>

        <div style={S.secBox}>
          <div style={S.secTitle}>✍️ 나만의 여행 노트</div>
          <textarea value={diary} onChange={e=>setDiary(e.target.value)} placeholder="오늘 어떤 멋진 일들이 있었나요?" style={{minHeight:150}}/>
        </div>

        <div style={S.secBox}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={S.secTitle} style={{margin:0, fontWeight:700, fontSize:15, color:"#2D3748"}}>📷 사진 갤러리</div>
            <label style={C.btnAdd} className="tbtn">
              + 기기 사진 추가
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
            </label>
          </div>
          
          {/* 네이버 마이박스: 에러창(alert) 대신 기기 갤러리로 연동되면서 Toast 알림 띄움 */}
          <label 
            style={{background:"#03C75A", color:"#FFF", padding:"12px 16px", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:16, cursor:"pointer", boxShadow:"0 4px 12px rgba(3,199,90,0.3)"}} 
            onClick={handleNaverMyBox}
          >
            <span style={{fontWeight:800}}>N</span> <span>MYBOX 연동하여 가져오기</span>
            <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
          </label>

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
  const [form, setForm] = useState({title:"",country:"",flag:"",startDate:"",endDate:"",currency:"KRW",gradient:GRADIENTS[0]});
  const valid = form.title && form.startDate && form.endDate;

  const create = () => {
    if (!valid) return;
    const dates = dateRange(form.startDate, form.endDate);
    onCreate({
      id:uid(), ...form, flag:form.flag||"✈️",
      days: dates.map(date=>({date, waypoints:[newWaypoint()], diary:"", photos:[], expenses:[]}))
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
          <div style={{display:"flex",gap:12}}>
             <div style={{flex:1}}>
               <label style={S.label}>기본 통화</label>
               <select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>
                 {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
               </select>
             </div>
             <div style={{flex:2}}>
              <label style={S.label}>테마 색상</label>
              <div style={{display:"flex",gap:10,marginTop:6}}>
                {GRADIENTS.slice(0,4).map((g,i)=><div key={i} style={{width:32,height:32,borderRadius:8,background:g,cursor:"pointer",border:form.gradient===g?"3px solid #8A6B3E":"3px solid transparent"}} onClick={()=>setForm({...form,gradient:g})}/>)}
              </div>
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
