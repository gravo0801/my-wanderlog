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
const safeStr   = v => typeof v === "string" ? v : "";

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
  {id:"travel", label:"🪪 트래블카드"},
];
const TRANSPORT_MODES = [
  {id:"transit",  label:"대중교통", icon:"🚇", maps:"transit"},
  {id:"subway",   label:"전철",     icon:"🚃", maps:"transit"},
  {id:"bus",      label:"버스",     icon:"🚌", maps:"transit"},
  {id:"taxi",     label:"택시",     icon:"🚕", maps:"driving"},
  {id:"walking",  label:"도보",     icon:"🚶", maps:"walking"},
  {id:"driving",  label:"자동차",   icon:"🚗", maps:"driving"},
  {id:"rental",   label:"렌트카",   icon:"🚙", maps:"driving"},
  {id:"bicycle",  label:"자전거",   icon:"🚲", maps:"bicycling"},
  {id:"train",    label:"기차",     icon:"🚄", maps:"transit"},
  {id:"flight",   label:"항공",     icon:"✈️", maps:null},
  {id:"boat",     label:"선박",     icon:"⛴️", maps:"transit"},
];
const DURATION_OPTIONS = [
  {value:"",      label:"소요시간 선택"},
  {value:"0.5h",  label:"0.5h  (30분)"},
  {value:"1h",    label:"1h    (1시간)"},
  {value:"1.5h",  label:"1.5h"},
  {value:"2h",    label:"2h"},
  {value:"2.5h",  label:"2.5h"},
  {value:"3h",    label:"3h"},
  {value:"3.5h",  label:"3.5h"},
  {value:"4h",    label:"4h"},
  {value:"4.5h",  label:"4.5h"},
  {value:"5h",    label:"5h"},
  {value:"6h",    label:"6h"},
  {value:"7h",    label:"7h"},
  {value:"8h",    label:"8h"},
  {value:"10h",   label:"10h"},
  {value:"12h+",  label:"12h+"},
];
const GRADIENTS = [
  "linear-gradient(135deg,#e0c3fc,#8ec5fc)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
  "linear-gradient(135deg,#84fab0,#8fd3f4)",
  "linear-gradient(135deg,#ff9a9e,#fecfef)",
  "linear-gradient(135deg,#cfd9df,#e2ebf0)",
];
const FLAG_MAP = {
  "한국":"🇰🇷","대한민국":"🇰🇷","korea":"🇰🇷","south korea":"🇰🇷",
  "일본":"🇯🇵","japan":"🇯🇵",
  "중국":"🇨🇳","china":"🇨🇳",
  "미국":"🇺🇸","usa":"🇺🇸","united states":"🇺🇸","america":"🇺🇸",
  "영국":"🇬🇧","uk":"🇬🇧","united kingdom":"🇬🇧",
  "프랑스":"🇫🇷","france":"🇫🇷",
  "독일":"🇩🇪","germany":"🇩🇪",
  "이탈리아":"🇮🇹","italy":"🇮🇹",
  "스페인":"🇪🇸","spain":"🇪🇸",
  "태국":"🇹🇭","thailand":"🇹🇭",
  "베트남":"🇻🇳","vietnam":"🇻🇳",
  "대만":"🇹🇼","taiwan":"🇹🇼",
  "싱가포르":"🇸🇬","singapore":"🇸🇬",
  "홍콩":"🇭🇰","hong kong":"🇭🇰",
  "호주":"🇦🇺","australia":"🇦🇺",
  "캐나다":"🇨🇦","canada":"🇨🇦",
  "인도":"🇮🇳","india":"🇮🇳",
  "터키":"🇹🇷","turkey":"🇹🇷",
  "그리스":"🇬🇷","greece":"🇬🇷",
  "포르투갈":"🇵🇹","portugal":"🇵🇹",
  "네덜란드":"🇳🇱","netherlands":"🇳🇱",
  "스위스":"🇨🇭","switzerland":"🇨🇭",
  "오스트리아":"🇦🇹","austria":"🇦🇹",
  "체코":"🇨🇿","czech":"🇨🇿",
  "헝가리":"🇭🇺","hungary":"🇭🇺",
  "크로아티아":"🇭🇷","croatia":"🇭🇷",
  "모로코":"🇲🇦","morocco":"🇲🇦",
  "이집트":"🇪🇬","egypt":"🇪🇬",
  "아랍에미리트":"🇦🇪","uae":"🇦🇪","dubai":"🇦🇪",
  "말레이시아":"🇲🇾","malaysia":"🇲🇾",
  "인도네시아":"🇮🇩","indonesia":"🇮🇩",
  "필리핀":"🇵🇭","philippines":"🇵🇭",
  "멕시코":"🇲🇽","mexico":"🇲🇽",
};
const guessFlag = c => c ? (FLAG_MAP[c.toLowerCase().trim()] || null) : null;

/* ── Data helpers ────────────────────────────────────────────────────────── */
const newWaypoint = () => ({
  id:uid(), name:"", lat:null, lon:null,
  time:"", icon:"",
  transport:"transit", duration:"",
  voucher:{ file:null, fileName:"", url:"" },
});
const getWaypoints  = d => safeArr(d?.waypoints).length ? d.waypoints : [newWaypoint()];
const getPlaceNames = d => getWaypoints(d).map(w=>w.name).filter(Boolean);

/* ── Photon Place Search (호텔/다국어 지원) ─────────────────────────────── */
async function fetchPlaces(query) {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=7`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return safeArr(data.features).map(f => {
      const p = f.properties || {};
      const name = p.name || p.street || "";
      if (!name) return null;

      const city    = p.city || p.town || p.village || p.county || "";
      const country = p.country || "";
      const sub     = [city, country].filter(Boolean).join(", ");
      const t       = (p.osm_value || p.type || "").toLowerCase();

      let icon = "📍";
      if (["hotel","hostel","guest_house","motel","resort","ryokan","love_hotel"].some(x=>t.includes(x))) icon = "🏨";
      else if (["restaurant","cafe","fast_food","bar","pub","izakaya","food_court","ramen"].some(x=>t.includes(x))) icon = "🍽️";
      else if (["museum","attraction","viewpoint","monument","castle","temple","shrine","cathedral","church","ruins","artwork"].some(x=>t.includes(x))) icon = "🏛️";
      else if (["station","subway","tram","bus_stop","bus_station","airport","aerodrome"].some(x=>t.includes(x))) icon = "🚉";
      else if (["park","garden","nature_reserve","forest","wood"].some(x=>t.includes(x))) icon = "🌿";
      else if (["beach","bay","coast"].some(x=>t.includes(x))) icon = "🏖️";
      else if (["mall","supermarket","shop","marketplace","department_store"].some(x=>t.includes(x))) icon = "🛍️";
      else if (["hospital","clinic","pharmacy"].some(x=>t.includes(x))) icon = "🏥";

      return {
        name, sub, icon,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      };
    }).filter(Boolean).slice(0, 5);
  } catch (e) {
    console.warn("Photon search error:", e);
    return [];
  }
}

/* ── Google Maps URL builder ─────────────────────────────────────────────── */
function buildGmapsUrl(waypoints) {
  const v = waypoints.filter(w => w.lat && w.lon);
  if (!v.length) return null;
  if (v.length === 1) return `https://www.google.com/maps/search/?api=1&query=${v[0].lat},${v[0].lon}`;
  const origin = `${v[0].lat},${v[0].lon}`;
  const dest   = `${v[v.length-1].lat},${v[v.length-1].lon}`;
  const mid    = v.slice(1,-1).map(w=>`${w.lat},${w.lon}`).join("|");
  const mode   = TRANSPORT_MODES.find(m=>m.id===v[0].transport)?.maps || "driving";
  if (mode === null) {
    return `https://www.google.com/maps/dir/${encodeURIComponent(v[0].name)}/${encodeURIComponent(v[v.length-1].name)}`;
  }
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${mode}`;
  if (mid) url += `&waypoints=${mid}`;
  return url;
}

/* ── PlaceSearch Component ───────────────────────────────────────────────── */
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
    onSelect({ name:item.name, lat:String(item.lat), lon:String(item.lon), icon:item.icon });
  };

  useEffect(() => {
    const close = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={wrapRef} style={{position:"relative",flex:1,minWidth:0}}>
      <div style={{position:"relative"}}>
        <input value={q} onChange={handleChange}
          placeholder={placeholder || "호텔, 식당, 지명 검색 (한국어/영어/현지어)..."}
          onFocus={() => results.length > 0 && setOpen(true)}
          style={{paddingRight: loading ? 80 : 13}} />
        {loading && (
          <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,border:"2px solid #E2E8F0",borderTopColor:"#8A6B3E",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>
            <span style={{fontSize:11,color:"#A0AEC0"}}>검색중...</span>
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,right:0,background:"#FFF",border:"1px solid rgba(0,0,0,.08)",borderRadius:16,zIndex:2000,overflow:"hidden",boxShadow:"0 20px 40px rgba(0,0,0,.15)"}}>
          <div style={{padding:"6px 14px 5px",fontSize:10,color:"#A0AEC0",letterSpacing:.5,background:"#F8FAFC",borderBottom:"1px solid #EDF2F7"}}>
            장소 검색 결과 · 호텔·식당·관광지 포함
          </div>
          {results.map((item, i) => (
            <div key={i}
              style={{padding:"11px 14px",cursor:"pointer",borderBottom:i<results.length-1?"1px solid #EDF2F7":"none",display:"flex",gap:10,alignItems:"flex-start",transition:"background .1s"}}
              onMouseDown={() => handlePick(item)}
              onMouseEnter={e=>e.currentTarget.style.background="#FFFBF5"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{item.icon}</span>
              <div style={{overflow:"hidden",flex:1}}>
                <div style={{color:"#2D3748",fontSize:14,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                {item.sub && <div style={{color:"#A0AEC0",fontSize:11,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── WaypointsEditor ─────────────────────────────────────────────────────── */
function WaypointsEditor({ waypoints, onChange }) {
  const valid = waypoints.filter(w => w.lat && w.lon);
  const gmUrl = buildGmapsUrl(waypoints);
  const [openVoucher, setOpenVoucher] = useState({});

  const addWp    = () => onChange([...waypoints, newWaypoint()]);
  const updateWp = (id, patch) => onChange(waypoints.map(w => w.id===id ? {...w,...patch} : w));
  const removeWp = id => onChange(waypoints.filter(w => w.id !== id));
  const toggleV  = id => setOpenVoucher(p => ({...p, [id]: !p[id]}));

  const handleVoucherFile = (id, e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const wp = waypoints.find(w=>w.id===id);
      updateWp(id, { voucher: {...(wp?.voucher||{}), file:ev.target.result, fileName:f.name } });
    };
    r.readAsDataURL(f);
  };

  return (
    <div>
      {waypoints.map((wp, i) => {
        const hasVoucher = wp.voucher?.fileName || wp.voucher?.url;
        const vOpen = openVoucher[wp.id];

        return (
          <div key={wp.id}>
            {/* ── Waypoint Card ── */}
            <div style={{background:"#F7FAFC",padding:"14px",borderRadius:16,border:"1px solid #E2E8F0",marginBottom:0}}>
              {/* Main row: number + search + time + clip + remove */}
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:wp.lat?15:13,fontWeight:700,color:"#FFF",background:wp.lat?"#8A6B3E":"#CBD5E0",boxShadow:wp.lat?"0 4px 10px rgba(138,107,62,0.3)":"none",transition:"all .2s"}}>
                  {wp.lat ? (wp.icon||"📍") : i+1}
                </div>
                <PlaceSearch
                  value={safeStr(wp.name)}
                  placeholder={i===0 ? "출발 장소 (호텔/공항 등)..." : "다음 목적지 검색..."}
                  onSelect={p => updateWp(wp.id, {name:p.name,lat:p.lat,lon:p.lon,icon:p.icon})}
                  onNameChange={n => updateWp(wp.id, {name:n,lat:null,lon:null,icon:""})}
                />
                {/* Arrival time */}
                <input type="time" value={safeStr(wp.time)} onChange={e=>updateWp(wp.id,{time:e.target.value})}
                  title="도착 시간" style={{width:82,flexShrink:0,padding:"9px 5px",fontSize:13,textAlign:"center",borderRadius:10}}/>
                {/* Voucher toggle */}
                <button onClick={()=>toggleV(wp.id)} title="바우처/링크 첨부"
                  style={{width:34,height:34,borderRadius:10,flexShrink:0,cursor:"pointer",fontSize:15,border:`1px solid ${hasVoucher?"#FBD38D":"#E2E8F0"}`,background:hasVoucher?"#FFF5EB":vOpen?"#EDF2F7":"#FFF",color:hasVoucher?"#8A6B3E":"#A0AEC0",transition:"all .15s"}}>
                  📎
                </button>
                {waypoints.length>1 && (
                  <button onClick={()=>removeWp(wp.id)} style={{width:34,height:34,borderRadius:10,flexShrink:0,background:"#FFF5F5",color:"#E53E3E",border:"none",cursor:"pointer",fontSize:14}}>✕</button>
                )}
              </div>

              {/* ── Voucher Panel ── */}
              {vOpen && (
                <div style={{marginTop:12,padding:"14px",background:"#FFFBF5",borderRadius:12,border:"1px solid #FBD38D"}}>
                  <div style={{fontSize:12,color:"#8A6B3E",fontWeight:700,marginBottom:10}}>📎 바우처 / 예약확인서</div>
                  <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
                    <label style={{...C.btnAdd,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
                      📄 파일 첨부
                      <input type="file" accept="image/*,.pdf" hidden onChange={e=>handleVoucherFile(wp.id,e)}/>
                    </label>
                    {wp.voucher?.file && (
                      <a href={wp.voucher.file} download={wp.voucher.fileName}
                        style={{...C.btnAdd,display:"inline-flex",alignItems:"center",gap:5,fontSize:12,color:"#48BB78",border:"1px solid #C6F6D5",background:"#F0FFF4",textDecoration:"none"}}>
                        ✅ {(wp.voucher.fileName||"").slice(0,20)}
                      </a>
                    )}
                  </div>
                  <div style={{position:"relative"}}>
                    <input type="url" value={safeStr(wp.voucher?.url)}
                      onChange={e=>updateWp(wp.id,{voucher:{...(wp.voucher||{}),url:e.target.value}})}
                      placeholder="예약 링크 또는 바우처 URL (https://...)"
                      style={{fontSize:13,padding:"10px 14px",paddingRight:wp.voucher?.url?"70px":"14px"}}/>
                    {wp.voucher?.url && (
                      <a href={wp.voucher.url} target="_blank" rel="noopener noreferrer"
                        style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#8A6B3E",fontWeight:600,textDecoration:"none",background:"#FFF5EB",padding:"4px 8px",borderRadius:6}}>
                        열기 ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Connector: transport + duration ── */}
            {i < waypoints.length-1 && (
              <div style={{display:"flex",gap:0,marginLeft:14,marginBottom:0}}>
                <div style={{width:3,background:"linear-gradient(to bottom,#CBD5E0,#8A6B3E40)",borderRadius:2,margin:"0 12px 0 11px",flexShrink:0}}/>
                <div style={{flex:1,padding:"10px 0 10px 0"}}>
                  <div style={{fontSize:10,color:"#A0AEC0",fontWeight:600,letterSpacing:.5,marginBottom:7}}>이동수단 · 소요시간</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    {TRANSPORT_MODES.map(m => {
                      const on = (wp.transport||"transit") === m.id;
                      return (
                        <button key={m.id} onClick={()=>updateWp(wp.id,{transport:m.id})}
                          style={{display:"flex",alignItems:"center",gap:3,padding:"5px 9px",borderRadius:18,cursor:"pointer",border:`1px solid ${on?"#8A6B3E":"#E2E8F0"}`,background:on?"#FFF5EB":"#FFF",color:on?"#8A6B3E":"#718096",fontSize:11,fontWeight:on?700:400,transition:"all .12s",boxShadow:on?"0 2px 8px rgba(138,107,62,0.2)":"none"}}>
                          <span style={{fontSize:13}}>{m.icon}</span>
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <select value={safeStr(wp.duration)} onChange={e=>updateWp(wp.id,{duration:e.target.value})}
                    style={{fontSize:13,padding:"8px 10px",borderRadius:10,width:"auto",minWidth:160,color:wp.duration?"#2D3748":"#A0AEC0"}}>
                    {DURATION_OPTIONS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {i < waypoints.length-1 && <div style={{height:4}}/>}
          </div>
        );
      })}

      {/* Action buttons */}
      <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
        <button onClick={addWp} style={C.btnAdd}>+ 장소 추가</button>
        {valid.length >= 1 && gmUrl && (
          <a href={gmUrl} target="_blank" rel="noopener noreferrer"
            style={{...C.btnMap,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}}>
            🗺️ 구글맵에서 동선 보기
          </a>
        )}
      </div>
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

  if (!loaded) return <div style={{background:"#F9F9F8",minHeight:"100vh"}}/>;

  return (
    <div className="app-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Pretendard:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
        body { background:#F9F9F8; font-family:'Pretendard',sans-serif; color:#2D3748; letter-spacing:-0.3px; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:10px; }
        input, textarea, select {
          background:#FFFFFF!important; border:1px solid #E2E8F0!important; color:#2D3748!important;
          border-radius:12px; padding:14px 16px; font-family:inherit; font-size:15px;
          outline:none; width:100%; box-shadow:0 2px 6px rgba(0,0,0,0.02); transition:all 0.2s;
        }
        input:focus, textarea:focus, select:focus {
          border-color:#8A6B3E!important; box-shadow:0 0 0 3px rgba(138,107,62,0.15)!important;
        }
        input::placeholder, textarea::placeholder { color:#A0AEC0!important; font-weight:400; }
        input[type=time] { font-variant-numeric:tabular-nums; }
        input[type=date]::-webkit-calendar-picker-indicator,
        input[type=time]::-webkit-calendar-picker-indicator { cursor:pointer; opacity:.5; }
        .tbtn { transition:all .15s ease-out; cursor:pointer; }
        .tbtn:active { transform:scale(.97); opacity:.8; }
        .app-wrapper { display:flex; min-height:100vh; background:#F9F9F8; }
        .left-panel, .right-panel { width:100%; height:100vh; overflow-y:auto; overflow-x:hidden; background:#F9F9F8; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes slideDown { from { transform:translate(-50%,-20px); opacity:0; } to { transform:translate(-50%,0); opacity:1; } }
        .toast-msg { animation:slideDown 0.3s ease-out forwards; }
        @media (max-width:1023px) {
          .app-wrapper { max-width:600px; margin:0 auto; box-shadow:0 0 30px rgba(0,0,0,0.05); background:#FFF; }
          .left-panel, .right-panel { background:#FFF; }
          .hidden-mobile { display:none !important; }
          .active-mobile { display:block !important; }
        }
        @media (min-width:1024px) {
          .app-wrapper { padding:32px; gap:32px; height:100vh; overflow:hidden; max-width:1400px; margin:0 auto; }
          .left-panel { width:400px; flex-shrink:0; border-radius:28px; background:#FFFFFF; border:1px solid #E2E8F0; box-shadow:0 20px 40px rgba(0,0,0,.04); }
          .right-panel { flex:1; border-radius:28px; background:#FFFFFF; border:1px solid #E2E8F0; box-shadow:0 20px 40px rgba(0,0,0,.04); position:relative; }
          .mobile-back-btn { display:none !important; }
        }
      `}</style>

      <div className={`left-panel ${screen==="home"?"active-mobile":"hidden-mobile"}`}>
        <HomeScreen trips={trips} stats={stats} onSelect={t=>{setST(t);setScreen("trip");}} onNew={()=>setModal(true)}/>
      </div>
      <div className={`right-panel ${screen!=="home"?"active-mobile":"hidden-mobile"}`}>
        {screen==="trip" && selTrip && (
          <TripScreen trip={selTrip} onBack={()=>setScreen("home")}
            onSelectDay={d=>{setSD(d);setScreen("day");}}
            onUpdate={updateTrip} onDelete={deleteTrip}/>
        )}
        {screen==="day" && selDay && selTrip && (
          <DayScreen day={selDay} trip={selTrip} onBack={()=>setScreen("trip")}
            onUpdate={u=>{const t={...selTrip,days:selTrip.days.map(d=>d.date===u.date?u:d)};updateTrip(t);setSD(u);}}/>
        )}
        {screen==="home" && (
          <div className="hidden-mobile" style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#A0AEC0",gap:16}}>
            <span style={{fontSize:50,opacity:.4}}>✈️</span>
            <span style={{fontSize:18,fontWeight:500}}>왼쪽 목록에서 여행을 선택하거나 추가해주세요</span>
          </div>
        )}
      </div>

      {modal && <NewTripModal onClose={()=>setModal(false)} onCreate={t=>{setTrips(p=>[t,...p]);setModal(false);setST(t);setScreen("trip");}}/>}
    </div>
  );
}

/* ── HOME SCREEN ─────────────────────────────────────────────────────────── */
function HomeScreen({ trips, stats, onSelect, onNew }) {
  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{padding:"40px 24px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:30}}>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"#1A202C",letterSpacing:1}}>Wanderlog</div>
            <div style={{fontSize:13,color:"#718096",marginTop:2}}>나만의 프리미엄 여행 일지</div>
          </div>
          <button style={S.btnPrimary} className="tbtn" onClick={onNew}>새 여행</button>
        </div>

        {stats.days > 0 && (
          <div style={{display:"flex",gap:12,marginBottom:28}}>
            {[{v:trips.length,l:"여행",i:"✈️"},{v:stats.days,l:"일",i:"📅"},{v:stats.places,l:"장소",i:"📍"}].map(x=>(
              <div key={x.l} style={{flex:1,background:"#FFFBF5",border:"1px solid #FBD38D",borderRadius:16,padding:"14px 8px",textAlign:"center"}}>
                <div style={{fontSize:18,marginBottom:4}}>{x.i}</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:"#8A6B3E"}}>{x.v}</div>
                <div style={{fontSize:11,color:"#A0AEC0",marginTop:2}}>{x.l}</div>
              </div>
            ))}
          </div>
        )}

        {trips.length===0 ? (
          <div style={{textAlign:"center",padding:"60px 20px",background:"#F8FAFC",borderRadius:24,border:"1px dashed #CBD5E0"}}>
            <div style={{fontSize:42,marginBottom:16}}>🧳</div>
            <div style={{fontSize:18,fontWeight:600,color:"#2D3748",marginBottom:8}}>첫 여행을 기록해보세요</div>
            <div style={{fontSize:14,color:"#718096"}}>소중한 추억을 아름답게 보관해 드립니다.</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {trips.map(t => {
              const days = safeArr(t.days).length;
              const places = [...new Set(safeArr(t.days).flatMap(d=>getPlaceNames(d)))];
              return (
                <div key={t.id} className="tbtn"
                  style={{background:"#FFF",borderRadius:24,overflow:"hidden",boxShadow:"0 12px 30px rgba(0,0,0,0.06)",border:"1px solid #EDF2F7"}}
                  onClick={()=>onSelect(t)}>
                  <div style={{height:160,position:"relative",background:t.coverImage?`url(${t.coverImage}) center/cover`:t.gradient}}>
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.6),transparent 60%)"}}/>
                    <div style={{position:"absolute",top:14,right:14,fontSize:30,filter:"drop-shadow(0 3px 6px rgba(0,0,0,.3))"}}>{t.flag||"✈️"}</div>
                    <div style={{position:"absolute",bottom:16,left:20,right:20}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:"#FFF",textShadow:"0 2px 8px rgba(0,0,0,.4)"}}>{t.title}</div>
                      <div style={{fontSize:13,color:"rgba(255,255,255,.9)",marginTop:4,fontWeight:500}}>{fmtShort(t.startDate)} — {fmtShort(t.endDate)}</div>
                    </div>
                  </div>
                  <div style={{padding:"12px 18px 14px",display:"flex",gap:14,fontSize:12,color:"#718096"}}>
                    <span>📅 {days}일</span>
                    {places.length>0 && <span>📍 {places.length}개 장소</span>}
                    {t.country && <span>🌍 {t.country}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── TRIP SCREEN ─────────────────────────────────────────────────────────── */
function TripScreen({ trip, onBack, onSelectDay, onUpdate, onDelete }) {
  const [tab, setTab] = useState("timeline");

  // 전체 여행 동선 URL (구글맵)
  const allWps = safeArr(trip.days).flatMap(d => getWaypoints(d).filter(w=>w.lat&&w.lon));
  const allGmUrl = buildGmapsUrl(allWps);

  return (
    <div style={{height:"100%",overflowY:"auto",paddingBottom:80}}>
      <div style={{height:280,position:"relative",background:trip.coverImage?`url(${trip.coverImage}) center/cover`:trip.gradient}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.7),transparent 70%)"}}/>
        <div style={{position:"absolute",top:20,left:20,right:20,display:"flex",justifyContent:"space-between",zIndex:10}}>
          <button style={S.glassBtn} className="tbtn mobile-back-btn" onClick={onBack}>← 뒤로</button>
          <div style={{marginLeft:"auto",display:"flex",gap:10}}>
            <label style={S.glassBtn} className="tbtn">
              📷 커버
              <input type="file" accept="image/*" hidden onChange={e=>{
                const f=e.target.files[0]; if(!f) return;
                const r=new FileReader(); r.onload=ev=>onUpdate({...trip,coverImage:ev.target.result}); r.readAsDataURL(f);
              }}/>
            </label>
            <button style={{...S.glassBtn,color:"#FFB3B3"}} className="tbtn" onClick={()=>{if(confirm("정말 삭제할까요?"))onDelete(trip.id)}}>삭제</button>
          </div>
        </div>
        <div style={{position:"absolute",bottom:24,left:24,right:24,zIndex:5}}>
          <div style={{fontSize:48,marginBottom:8,filter:"drop-shadow(0 4px 12px rgba(0,0,0,.4))"}}>{trip.flag||"✈️"}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:700,color:"#FFF",textShadow:"0 4px 12px rgba(0,0,0,.6)"}}>{trip.title}</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.9)",marginTop:6,fontWeight:500}}>{trip.country} · {fmtDate(trip.startDate)} — {fmtDate(trip.endDate)}</div>
        </div>
      </div>

      <div style={{display:"flex",borderBottom:"1px solid #EDF2F7",padding:"0 12px",position:"sticky",top:0,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(12px)",zIndex:20,overflowX:"auto"}}>
        {[["timeline","타임라인"],["map","전체 지도"],["photos","사진갤러리"]].map(([id,lbl])=>(
          <button key={id} style={{padding:"16px",fontSize:14,fontWeight:600,color:tab===id?"#8A6B3E":"#A0AEC0",background:"none",border:"none",cursor:"pointer",borderBottom:`3px solid ${tab===id?"#8A6B3E":"transparent"}`,transition:"all .2s",whiteSpace:"nowrap"}} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={{padding:"24px"}}>
        {tab==="timeline" && safeArr(trip.days).map((d,i)=><DayRow key={d.date} day={d} index={i} onClick={()=>onSelectDay(d)}/>)}

        {tab==="map" && (
          <div style={{textAlign:"center",padding:"40px 20px"}}>
            <div style={{fontSize:48,marginBottom:16}}>🗺️</div>
            <div style={{fontSize:17,fontWeight:600,color:"#2D3748",marginBottom:8}}>구글맵에서 전체 동선 보기</div>
            <div style={{fontSize:14,color:"#718096",marginBottom:24}}>
              입력된 {allWps.length}개 장소를 구글맵으로 확인하세요.<br/>
              각 날짜 일지에서 장소를 검색해 추가할 수 있습니다.
            </div>
            {allGmUrl ? (
              <a href={allGmUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnPrimary,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8,fontSize:15}}>
                🗺️ 구글맵에서 열기
              </a>
            ) : (
              <div style={{color:"#A0AEC0",fontSize:14}}>날짜별 일지에서 장소를 검색해 추가하면<br/>전체 동선을 구글맵으로 확인할 수 있습니다.</div>
            )}
            {allWps.length > 0 && (
              <div style={{marginTop:28,display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
                {allWps.map((w,i)=>(
                  <span key={i} style={{fontSize:12,color:"#4A5568",background:"#F7FAFC",padding:"6px 12px",borderRadius:10,border:"1px solid #E2E8F0"}}>
                    {w.icon||"📍"} {w.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==="photos" && <PhotosTab photos={safeArr(trip.days).flatMap(d=>safeArr(d.photos))}/>}
      </div>
    </div>
  );
}

function DayRow({ day, index, onClick }) {
  const wps  = getWaypoints(day).filter(w=>w.name);
  const exps = safeArr(day.expenses);
  return (
    <div className="tbtn" style={{display:"flex",gap:16,padding:"20px",marginBottom:16,background:"#FFF",borderRadius:20,border:"1px solid #EDF2F7",boxShadow:"0 8px 20px rgba(0,0,0,.03)"}} onClick={onClick}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:700,color:"#FFF",background:"#8A6B3E",padding:"6px 10px",borderRadius:10}}>Day {index+1}</div>
      </div>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontSize:16,fontWeight:700,color:"#2D3748"}}>{fmtDate(day.date)}</div>
          {exps.length>0 && <span style={{fontSize:12,fontWeight:600,color:"#8A6B3E",background:"#FFF5EB",padding:"4px 8px",borderRadius:6}}>지출 {exps.length}건</span>}
        </div>
        {wps.length>0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
            {wps.slice(0,3).map((w,i)=>(
              <span key={i} style={{fontSize:12,color:"#4A5568",background:"#F7FAFC",padding:"3px 9px",borderRadius:8,border:"1px solid #E2E8F0",display:"flex",alignItems:"center",gap:3}}>
                {w.icon||"📍"} {w.name}
                {w.time && <span style={{color:"#A0AEC0",fontSize:10}}>@{w.time}</span>}
                {(w.voucher?.fileName||w.voucher?.url) && <span style={{color:"#8A6B3E",fontSize:10}}>📎</span>}
              </span>
            ))}
            {wps.length>3 && <span style={{fontSize:12,color:"#A0AEC0"}}>+{wps.length-3}곳</span>}
          </div>
        )}
        {/* Transport summary */}
        {wps.length > 1 && (() => {
          const moves = wps.slice(0,-1).filter(w=>w.transport||w.duration).map(w=>{
            const t = TRANSPORT_MODES.find(m=>m.id===w.transport);
            return [t?.icon, w.duration].filter(Boolean).join(" ");
          }).filter(Boolean);
          return moves.length > 0 ? (
            <div style={{fontSize:11,color:"#A0AEC0",marginBottom:6,display:"flex",gap:8,flexWrap:"wrap"}}>
              {moves.map((m,i)=><span key={i} style={{background:"#F7FAFC",padding:"2px 7px",borderRadius:6,border:"1px solid #E2E8F0"}}>{m}</span>)}
            </div>
          ) : null;
        })()}
        {day.diary && <div style={{fontSize:14,color:"#718096",lineHeight:1.6,background:"#F8FAFC",padding:"10px 12px",borderRadius:10}}>&ldquo;{day.diary.slice(0,60)}{day.diary.length>60?"...":""}&rdquo;</div>}
      </div>
    </div>
  );
}

function PhotosTab({ photos }) {
  const [preview, setPrev] = useState(null);
  if (!safeArr(photos).length) return <div style={{textAlign:"center",padding:"60px 0",color:"#A0AEC0"}}>등록된 사진이 없습니다.</div>;
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:12}}>
        {photos.map((p,i)=>(
          <div key={i} style={{aspectRatio:"1",borderRadius:16,backgroundSize:"cover",backgroundPosition:"center",backgroundImage:`url(${p})`,cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,.08)"}} onClick={()=>setPrev(p)}/>
        ))}
      </div>
      {preview && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,cursor:"pointer"}} onClick={()=>setPrev(null)}>
          <img src={preview} style={{maxWidth:"92vw",maxHeight:"85vh",borderRadius:16,boxShadow:"0 30px 80px rgba(0,0,0,.8)"}} alt="preview"/>
        </div>
      )}
    </div>
  );
}

/* ── DAY SCREEN ──────────────────────────────────────────────────────────── */
function DayScreen({ day, trip, onBack, onUpdate }) {
  const [wps,    setWps]    = useState(() => getWaypoints(day));
  const [diary,  setDiary]  = useState(() => safeStr(day.diary));
  const [photos, setPhotos] = useState(() => safeArr(day.photos));
  const [exps,   setExps]   = useState(() => safeArr(day.expenses));
  const [saved,  setSaved]  = useState(false);
  const [newExp, setNewExp] = useState({amount:"",category:"food",method:"card",currency:trip.currency||"KRW",memo:""});

  const save = () => {
    onUpdate({...day,waypoints:wps,city:wps[0]?.name||"",diary,photos,expenses:exps});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };
  const addPhotos = e => Array.from(e.target.files).forEach(f=>{
    const r=new FileReader(); r.onload=ev=>setPhotos(p=>[...p,ev.target.result]); r.readAsDataURL(f);
  });
  const handleAddExp = () => {
    if (!newExp.amount) return;
    setExps([...exps,{id:uid(),...newExp}]);
    setNewExp({...newExp,amount:"",memo:""});
  };

  return (
    <div style={{height:"100%",overflowY:"auto",paddingBottom:100,position:"relative"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",background:"rgba(255,255,255,0.95)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:30,borderBottom:"1px solid #EDF2F7"}}>
        <button style={S.iconBtn} onClick={onBack}>←</button>
        <div style={{fontSize:16,fontWeight:700,color:"#2D3748"}}>{fmtDate(day.date)}</div>
        <button style={saved?S.btnSuccess:S.btnPrimary} className="tbtn" onClick={save}>{saved?"✅ 저장완료":"저장"}</button>
      </div>

      <div style={{padding:"24px"}}>
        {/* Waypoints */}
        <div style={S.secBox}>
          <div style={S.secTitle}>📍 일정 & 동선 기록</div>
          <WaypointsEditor waypoints={wps} onChange={setWps}/>
        </div>

        {/* Expenses */}
        <div style={S.secBox}>
          <div style={S.secTitle}>💰 일일 지출 내역</div>
          <div style={{background:"#F7FAFC",padding:"16px",borderRadius:16,marginBottom:16,border:"1px solid #E2E8F0"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div>
                <label style={S.label}>카테고리</label>
                <select value={newExp.category} onChange={e=>setNewExp({...newExp,category:e.target.value})}>
                  {EXP_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>결제 수단</label>
                <select value={newExp.method} onChange={e=>setNewExp({...newExp,method:e.target.value})}>
                  {PAYMENT_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:12,marginBottom:12}}>
              <div style={{flex:1}}>
                <label style={S.label}>금액</label>
                <div style={{display:"flex",gap:8}}>
                  <select value={newExp.currency} onChange={e=>setNewExp({...newExp,currency:e.target.value})} style={{width:90,padding:"12px 8px"}}>
                    {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" placeholder="금액" value={newExp.amount} onChange={e=>setNewExp({...newExp,amount:e.target.value})} style={{flex:1}}/>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
              <div style={{flex:1}}>
                <label style={S.label}>사용처 / 메모</label>
                <input type="text" placeholder="예: 스타벅스 커피" value={newExp.memo} onChange={e=>setNewExp({...newExp,memo:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleAddExp()}/>
              </div>
              <button onClick={handleAddExp} style={{...S.btnPrimary,padding:"14px 24px",height:50,whiteSpace:"nowrap"}}>추가</button>
            </div>
          </div>
          {exps.length>0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {exps.map(e=>{
                const cat=EXP_CATS.find(c=>c.id===e.category);
                return (
                  <div key={e.id} style={{display:"flex",alignItems:"center",padding:"12px 16px",background:"#FFF",border:"1px solid #EDF2F7",borderRadius:12,gap:12}}>
                    <div style={{fontSize:20}}>{cat?.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:"#2D3748"}}>{e.memo||cat?.label}</div>
                      <div style={{fontSize:11,color:"#A0AEC0",marginTop:2}}>{PAYMENT_METHODS.find(m=>m.id===e.method)?.label}</div>
                    </div>
                    <div style={{textAlign:"right",marginRight:8}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#8A6B3E"}}>{Number(e.amount).toLocaleString()}</div>
                      <div style={{fontSize:11,color:"#A0AEC0"}}>{e.currency}</div>
                    </div>
                    <button onClick={()=>setExps(exps.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",color:"#E53E3E",cursor:"pointer",fontSize:16}}>✕</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{textAlign:"center",padding:"20px",color:"#A0AEC0",fontSize:13}}>지출 내역이 없습니다.</div>
          )}
        </div>

        {/* Diary */}
        <div style={S.secBox}>
          <div style={S.secTitle}>✍️ 나만의 여행 노트</div>
          <textarea value={diary} onChange={e=>setDiary(e.target.value)} placeholder="오늘 어떤 멋진 일들이 있었나요?" style={{minHeight:150}}/>
        </div>

        {/* Photos */}
        <div style={S.secBox}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:15,color:"#2D3748"}}>📷 사진 갤러리</div>
            <label style={{...C.btnAdd,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}} className="tbtn">
              + 사진 추가
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
            </label>
          </div>
          {photos.length>0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {photos.map((p,i)=>(
                <div key={i} style={{position:"relative",aspectRatio:"1",borderRadius:16,backgroundImage:`url(${p})`,backgroundSize:"cover",backgroundPosition:"center",boxShadow:"0 4px 10px rgba(0,0,0,.08)"}}>
                  <button style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.6)",color:"#FFF",border:"none",width:24,height:24,borderRadius:"50%",cursor:"pointer"}} onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"32px",background:"#F8FAFC",borderRadius:16,border:"1.5px dashed #CBD5E0",cursor:"pointer"}}>
              <span style={{fontSize:30,opacity:.4}}>📷</span>
              <span style={{fontSize:13,color:"#A0AEC0"}}>탭해서 사진 추가</span>
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
            </label>
          )}
        </div>
      </div>

      {/* Floating save button */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:600,padding:"12px 24px 24px",background:"linear-gradient(to top,rgba(255,255,255,1) 65%,transparent)",zIndex:30,pointerEvents:"none"}}>
        <button style={{...S.btnPrimary,width:"100%",padding:"16px",fontSize:16,borderRadius:16,pointerEvents:"all",...(saved?{background:"#48BB78"}:{})}} className="tbtn" onClick={save}>
          {saved?"✅ 저장완료":"저장하기"}
        </button>
      </div>
    </div>
  );
}

/* ── NEW TRIP MODAL ──────────────────────────────────────────────────────── */
function NewTripModal({ onClose, onCreate }) {
  const [form, setForm] = useState({title:"",country:"",flag:"",startDate:"",endDate:"",currency:"KRW",gradient:GRADIENTS[0]});
  const valid = form.title && form.startDate && form.endDate && new Date(form.endDate)>=new Date(form.startDate);
  const dc = valid ? dateRange(form.startDate,form.endDate).length : 0;

  const handleCountry = v => {
    const af = guessFlag(v);
    setForm({...form, country:v, flag:af||form.flag});
  };

  const create = () => {
    if (!valid) return;
    const dates = dateRange(form.startDate, form.endDate);
    onCreate({
      id:uid(), ...form, flag:form.flag||"✈️",
      days: dates.map(date=>({date,waypoints:[newWaypoint()],diary:"",photos:[],expenses:[]}))
    });
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}}>
      <div style={{background:"#FFF",borderRadius:28,width:"100%",maxWidth:480,boxShadow:"0 24px 60px rgba(0,0,0,.15)",overflow:"hidden",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{padding:"24px",borderBottom:"1px solid #EDF2F7",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:20,fontWeight:700,color:"#2D3748"}}>새 여행 시작하기</div>
          <button style={S.iconBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"24px",display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <label style={S.label}>여행 제목 *</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="도쿄 벚꽃 여행 2025"/>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <label style={S.label}>
                국가
                {guessFlag(form.country) && <span style={{color:"#48BB78",fontSize:10,marginLeft:6}}>국기 자동입력됨 {guessFlag(form.country)}</span>}
              </label>
              <input value={form.country} onChange={e=>handleCountry(e.target.value)} placeholder="일본, Japan, France..."/>
            </div>
            <div style={{width:80}}>
              <label style={S.label}>국기</label>
              <input value={form.flag} onChange={e=>setForm({...form,flag:e.target.value})} style={{textAlign:"center",fontSize:22,padding:"8px"}} placeholder="🇯🇵"/>
            </div>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <label style={S.label}>시작일 *</label>
              <input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/>
            </div>
            <div style={{flex:1}}>
              <label style={S.label}>종료일 *</label>
              <input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/>
            </div>
          </div>
          {dc > 0 && <div style={{fontSize:12,color:"#8A6B3E",textAlign:"right",marginTop:-8}}>✦ {dc}일 여행</div>}
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <label style={S.label}>기본 통화</label>
              <select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>
                {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{flex:2}}>
              <label style={S.label}>테마 색상</label>
              <div style={{display:"flex",gap:8,marginTop:6}}>
                {GRADIENTS.map((g,i)=><div key={i} style={{width:36,height:36,borderRadius:10,background:g,cursor:"pointer",border:form.gradient===g?"3px solid #8A6B3E":"3px solid transparent",transition:"border .12s"}} onClick={()=>setForm({...form,gradient:g})}/>)}
              </div>
            </div>
          </div>
        </div>
        <div style={{padding:"20px 24px",background:"#F8FAFC",display:"flex",justifyContent:"flex-end",gap:12}}>
          <button style={{padding:"12px 20px",borderRadius:12,border:"none",background:"#E2E8F0",color:"#4A5568",fontWeight:600,cursor:"pointer"}} onClick={onClose}>취소</button>
          <button style={{...S.btnPrimary,opacity:valid?1:.5,cursor:valid?"pointer":"not-allowed"}} className={valid?"tbtn":""} onClick={create}>여행 만들기</button>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const C = {
  btnAdd: {background:"#F7FAFC",border:"1px solid #E2E8F0",color:"#4A5568",padding:"9px 16px",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer"},
  btnMap: {background:"#FFF5EB",border:"1px solid #FBD38D",color:"#8A6B3E",padding:"9px 16px",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer"},
};
const S = {
  btnPrimary: {background:"linear-gradient(135deg,#A88653,#8A6B3E)",color:"#FFF",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:600,fontSize:15,boxShadow:"0 6px 16px rgba(138,107,62,0.3)",cursor:"pointer"},
  btnSuccess: {background:"#48BB78",color:"#FFF",border:"none",borderRadius:12,padding:"12px 24px",fontWeight:600,fontSize:15,cursor:"pointer"},
  glassBtn:   {background:"rgba(255,255,255,0.25)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.4)",color:"#FFF",borderRadius:12,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"},
  iconBtn:    {background:"#F7FAFC",border:"1px solid #E2E8F0",width:36,height:36,borderRadius:10,color:"#4A5568",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  secBox:     {marginBottom:24,background:"#FFF",padding:"24px",borderRadius:24,border:"1px solid #EDF2F7",boxShadow:"0 10px 30px rgba(0,0,0,0.03)"},
  secTitle:   {fontSize:15,fontWeight:700,color:"#2D3748",marginBottom:16},
  label:      {fontSize:12,fontWeight:600,color:"#718096",marginBottom:6,display:"block"},
};
