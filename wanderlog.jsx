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
    }
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? JSON.parse(r) : [];
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
  {id:"food",       label:"식비",   icon:"🍜", color:"#F6AD55"},
  {id:"transport",  label:"교통",   icon:"🚌", color:"#76E4F7"},
  {id:"lodging",    label:"숙박",   icon:"🏨", color:"#90CDF4"},
  {id:"sightseeing",label:"관광",   icon:"🎭", color:"#9AE6B4"},
  {id:"shopping",   label:"쇼핑",   icon:"🛍️", color:"#FBD38D"},
  {id:"other",      label:"기타",   icon:"💳", color:"#D6BCFA"},
];
const PAYMENT_METHODS = [
  {id:"card",   label:"💳 신용카드"},
  {id:"cash",   label:"💵 현금"},
  {id:"travel", label:"🪪 트래블체크카드"},
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
  {value:"",      label:"소요시간"},
  {value:"0.5h",  label:"0.5h"},
  {value:"1h",    label:"1h"},
  {value:"1.5h",  label:"1.5h"},
  {value:"2h",    label:"2h"},
  {value:"2.5h",  label:"2.5h"},
  {value:"3h",    label:"3h"},
  {value:"3.5h",  label:"3.5h"},
  {value:"4h",    label:"4h"},
  {value:"5h",    label:"5h"},
  {value:"6h",    label:"6h"},
  {value:"7h",    label:"7h"},
  {value:"8h",    label:"8h"},
  {value:"10h",   label:"10h"},
  {value:"12h+",  label:"12h+"},
];
const GRADIENTS = [
  "linear-gradient(135deg,#667eea 0%,#764ba2 100%)",
  "linear-gradient(135deg,#f6d365 0%,#fda085 100%)",
  "linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)",
  "linear-gradient(135deg,#fa709a 0%,#fee140 100%)",
  "linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)",
  "linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%)",
];
const FLAG_MAP = {
  "한국":"🇰🇷","대한민국":"🇰🇷","korea":"🇰🇷","south korea":"🇰🇷",
  "일본":"🇯🇵","japan":"🇯🇵","중국":"🇨🇳","china":"🇨🇳",
  "미국":"🇺🇸","usa":"🇺🇸","united states":"🇺🇸","america":"🇺🇸",
  "영국":"🇬🇧","uk":"🇬🇧","united kingdom":"🇬🇧",
  "프랑스":"🇫🇷","france":"🇫🇷","독일":"🇩🇪","germany":"🇩🇪",
  "이탈리아":"🇮🇹","italy":"🇮🇹","스페인":"🇪🇸","spain":"🇪🇸",
  "태국":"🇹🇭","thailand":"🇹🇭","베트남":"🇻🇳","vietnam":"🇻🇳",
  "대만":"🇹🇼","taiwan":"🇹🇼","싱가포르":"🇸🇬","singapore":"🇸🇬",
  "홍콩":"🇭🇰","hong kong":"🇭🇰","호주":"🇦🇺","australia":"🇦🇺",
  "캐나다":"🇨🇦","canada":"🇨🇦","인도":"🇮🇳","india":"🇮🇳",
  "포르투갈":"🇵🇹","portugal":"🇵🇹","네덜란드":"🇳🇱","netherlands":"🇳🇱",
  "스위스":"🇨🇭","switzerland":"🇨🇭","오스트리아":"🇦🇹","austria":"🇦🇹",
  "그리스":"🇬🇷","greece":"🇬🇷","터키":"🇹🇷","turkey":"🇹🇷",
  "체코":"🇨🇿","czech":"🇨🇿","헝가리":"🇭🇺","hungary":"🇭🇺",
  "크로아티아":"🇭🇷","croatia":"🇭🇷","모로코":"🇲🇦","morocco":"🇲🇦",
  "이집트":"🇪🇬","egypt":"🇪🇬","아랍에미리트":"🇦🇪","uae":"🇦🇪","dubai":"🇦🇪",
  "말레이시아":"🇲🇾","malaysia":"🇲🇾","인도네시아":"🇮🇩","indonesia":"🇮🇩",
  "필리핀":"🇵🇭","philippines":"🇵🇭","멕시코":"🇲🇽","mexico":"🇲🇽",
};
const guessFlag = c => c ? (FLAG_MAP[c.toLowerCase().trim()] || null) : null;

/* ── Data helpers ────────────────────────────────────────────────────────── */
const newWaypoint = () => ({id:uid(),name:"",lat:null,lon:null,time:"",icon:"",transport:"transit",duration:"",voucher:{file:null,fileName:"",url:""}});
const getWaypoints  = d => safeArr(d?.waypoints).length ? d.waypoints : [newWaypoint()];
const getPlaceNames = d => getWaypoints(d).map(w=>w.name).filter(Boolean);

/* ── Place icon helper (for fallback API results) ────────────────────────── */
function placeIcon(type="") {
  const t = type.toLowerCase();
  if (["hotel","hostel","guest_house","motel","resort","ryokan","inn","lodge","accommodation"].some(x=>t.includes(x))) return "🏨";
  if (["restaurant","cafe","fast_food","bar","pub","izakaya","ramen","sushi","food","eatery","bistro","diner"].some(x=>t.includes(x))) return "🍽️";
  if (["museum","attraction","viewpoint","monument","castle","temple","shrine","cathedral","church","ruins","gallery"].some(x=>t.includes(x))) return "🏛️";
  if (["station","subway","tram","bus_stop","bus_station","airport","aerodrome","terminal"].some(x=>t.includes(x))) return "🚉";
  if (["park","garden","forest","nature"].some(x=>t.includes(x))) return "🌿";
  if (["beach","bay","coast","sea"].some(x=>t.includes(x))) return "🏖️";
  if (["mall","shop","market","shopping"].some(x=>t.includes(x))) return "🛍️";
  if (["hospital","clinic","pharmacy"].some(x=>t.includes(x))) return "🏥";
  return "📍";
}

/* ── API Key management ──────────────────────────────────────────────────── */
const API_KEY_STORE = "wl_anthropic_key";
const getApiKey  = ()    => { try { return localStorage.getItem(API_KEY_STORE) || ""; } catch { return ""; } };
const saveApiKey = (key) => { try { localStorage.setItem(API_KEY_STORE, key); } catch {} };

/* ── fetchPlaces: Claude AI 직접 호출 (한국어·영어·식당명 완전 지원) ──────── */
async function fetchPlaces(query) {
  if (!query || query.trim().length < 1) return [];

  const apiKey = getApiKey();
  if (!apiKey) return [];   // 키 없으면 빈 결과 (홈 화면에서 키 입력 유도)

  const prompt = `You are a travel place autocomplete assistant.
User typed: "${query}"

Return EXACTLY 6 real place suggestions as a JSON array.
IMPORTANT language rule:
- Korean input  → return Korean names  (예: "하카타 잇푸도", "에펠탑", "도쿄역")
- Japanese input → return Japanese names
- English input  → return English names
- Mixed input   → match majority language

Include ALL types: hotels, restaurants, cafes, bars, tourist spots, stations, airports, parks, shops.
For restaurant/shop names: search by the exact name typed, even small local places.
Use accurate real-world GPS coordinates.

Icon rules (pick one emoji):
🏨 hotel/hostel/ryokan  🍽️ restaurant/cafe/bar  🏛️ museum/temple/castle/attraction
🚉 station/airport  🌿 park/nature  🏖️ beach  🛍️ shopping  🏥 hospital  📍 other

Return ONLY a JSON array, no markdown, no explanation:
[{"name":"...","sub":"city, country","icon":"emoji","lat":0.0,"lon":0.0}]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role:"user", content:prompt }],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = (data.content?.[0]?.text || "").replace(/```json|```/g,"").trim();
    const match = text.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : [];
    return safeArr(parsed).filter(p =>
      p.name && typeof p.lat === "number" && typeof p.lon === "number"
    ).slice(0, 6);
  } catch { return []; }
}

/* ── Google Maps URL ─────────────────────────────────────────────────────── */
function buildGmapsUrl(waypoints) {
  const v = waypoints.filter(w => w.lat && w.lon);
  if (!v.length) return null;
  if (v.length === 1) return `https://www.google.com/maps/search/?api=1&query=${v[0].lat},${v[0].lon}`;
  const mode = TRANSPORT_MODES.find(m=>m.id===v[0].transport)?.maps;
  if (!mode) return `https://www.google.com/maps/dir/${encodeURIComponent(v[0].name)}/${encodeURIComponent(v[v.length-1].name)}`;
  const origin = `${v[0].lat},${v[0].lon}`;
  const dest   = `${v[v.length-1].lat},${v[v.length-1].lon}`;
  const mid    = v.slice(1,-1).map(w=>`${w.lat},${w.lon}`).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${mode}`+(mid?`&waypoints=${mid}`:"");
}

/* ── PlaceSearch ─────────────────────────────────────────────────────────── */
function PlaceSearch({ value, placeholder, onSelect, onNameChange }) {
  const [q,   setQ]   = useState(value || "");
  const [res, setRes] = useState([]);
  const [ld,  setLd]  = useState(false);
  const [open,setOpen]= useState(false);
  const [noKey, setNoKey] = useState(false);
  const debRef = useRef(), wrapRef = useRef();

  useEffect(() => { setQ(value || ""); }, [value]);

  const doSearch = useCallback(v => {
    clearTimeout(debRef.current);
    if (!v || v.trim().length < 1) { setRes([]); setOpen(false); setNoKey(false); return; }
    if (!getApiKey()) { setNoKey(true); setOpen(false); setRes([]); return; }
    setNoKey(false);
    debRef.current = setTimeout(async () => {
      setLd(true);
      const list = await fetchPlaces(v);
      setRes(list); setOpen(list.length > 0); setLd(false);
    }, 380);
  }, []);

  const handleChange = e => { const v=e.target.value; setQ(v); onNameChange?.(v); doSearch(v); };
  const pick = item => {
    setQ(item.name); setOpen(false); setRes([]);
    onSelect({name:item.name, lat:String(item.lat), lon:String(item.lon), icon:item.icon});
  };

  useEffect(() => {
    const fn = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={wrapRef} style={{position:"relative",flex:1,minWidth:0}}>
      <div style={{position:"relative"}}>
        <input value={q} onChange={handleChange}
          placeholder={getApiKey() ? (placeholder || "장소 검색 (한국어·영어·식당명...)") : "⚙️ 설정에서 API 키를 먼저 입력해주세요"}
          onFocus={() => res.length > 0 && setOpen(true)}
          className="place-input"
          style={{paddingRight: ld ? 76 : 12, borderColor: noKey ? "#FBD38D" : undefined}}/>
        {ld && (
          <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:5}}>
            <div className="spinner"/>
            <span style={{fontSize:11,color:"#A0AEC0"}}>검색중</span>
          </div>
        )}
      </div>
      {noKey && (
        <div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,background:"#FFFBEB",border:"1px solid #FBD38D",borderRadius:10,padding:"9px 13px",zIndex:2000,fontSize:12.5,color:"#8A6B3E",fontWeight:500}}>
          ⚙️ 홈 화면 상단의 <strong>설정</strong> 버튼에서 Anthropic API 키를 먼저 입력해주세요.
        </div>
      )}
      {open && res.length > 0 && (
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#FFF",border:"1px solid #E8ECF0",borderRadius:16,zIndex:2000,overflow:"hidden",boxShadow:"0 24px 48px rgba(0,0,0,.12)"}}>
          <div style={{padding:"7px 14px 5px",fontSize:10,color:"#B0BEC5",letterSpacing:.8,fontWeight:600,background:"#FAFAFA",borderBottom:"1px solid #F0F0F0",display:"flex",justifyContent:"space-between"}}>
            <span>AI 장소 검색</span>
            <span style={{color:"#D0D8E0"}}>한국어 · 영어 · 식당명 지원</span>
          </div>
          {res.map((item, i) => (
            <div key={i}
              style={{padding:"10px 14px",cursor:"pointer",borderBottom:i<res.length-1?"1px solid #F7F7F7":"none",display:"flex",gap:10,alignItems:"flex-start"}}
              onMouseDown={() => pick(item)}
              onMouseEnter={e=>e.currentTarget.style.background="#FFFBF2"}
              onMouseLeave={e=>e.currentTarget.style.background=""}>
              <span style={{fontSize:17,flexShrink:0,marginTop:2}}>{item.icon}</span>
              <div style={{overflow:"hidden",flex:1}}>
                <div style={{color:"#1A202C",fontSize:13.5,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                {item.sub && <div style={{color:"#A0AEC0",fontSize:11,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.sub}</div>}
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
  const [openV, setOpenV] = useState({});
  const valid = waypoints.filter(w=>w.lat&&w.lon);
  const gmUrl = buildGmapsUrl(waypoints);

  const addWp    = () => onChange([...waypoints, newWaypoint()]);
  const updateWp = (id, patch) => onChange(waypoints.map(w => w.id===id ? {...w,...patch} : w));
  const removeWp = id => onChange(waypoints.filter(w => w.id!==id));
  const toggleV  = id => setOpenV(p => ({...p,[id]:!p[id]}));

  const handleFile = (id, e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { const wp=waypoints.find(w=>w.id===id); updateWp(id,{voucher:{...(wp?.voucher||{}),file:ev.target.result,fileName:f.name}}); };
    r.readAsDataURL(f);
  };

  return (
    <div>
      {waypoints.map((wp, i) => {
        const hasV = wp.voucher?.fileName || wp.voucher?.url;
        return (
          <div key={wp.id}>
            {/* ── Waypoint card ── */}
            <div style={{background:"#FAFBFC",borderRadius:16,border:"1px solid #EDF0F3",padding:"14px 14px 10px",boxShadow:"0 2px 8px rgba(0,0,0,.03)"}}>
              {/* Row 1: badge + search + remove */}
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
                <div style={{
                  width:30,height:30,borderRadius:"50%",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:wp.lat?15:12,fontWeight:700,color:"#FFF",
                  background:wp.lat?"linear-gradient(135deg,#A88653,#8A6B3E)":"#CBD5E0",
                  boxShadow:wp.lat?"0 4px 12px rgba(138,107,62,.35)":"none",
                  transition:"all .2s",
                }}>
                  {wp.lat ? (wp.icon||"📍") : i+1}
                </div>
                <PlaceSearch
                  value={safeStr(wp.name)}
                  placeholder={i===0 ? "출발지 검색 (호텔, 공항, 역...)" : "다음 장소 검색..."}
                  onSelect={p=>updateWp(wp.id,{name:p.name,lat:p.lat,lon:p.lon,icon:p.icon})}
                  onNameChange={n=>updateWp(wp.id,{name:n,lat:null,lon:null,icon:""})}
                />
                {waypoints.length>1 && (
                  <button onClick={()=>removeWp(wp.id)} style={{width:30,height:30,borderRadius:9,flexShrink:0,background:"#FFF5F5",color:"#FC8181",border:"none",cursor:"pointer",fontSize:13}}>✕</button>
                )}
              </div>
              {/* Row 2: time + voucher */}
              <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:39}}>
                <div style={{display:"flex",alignItems:"center",gap:6,background:"#FFF",border:"1px solid #E2E8F0",borderRadius:10,padding:"0 10px",height:38}}>
                  <span style={{fontSize:12,color:"#A0AEC0",userSelect:"none"}}>🕐</span>
                  <input type="time" value={safeStr(wp.time)} onChange={e=>updateWp(wp.id,{time:e.target.value})}
                    className="time-input"
                    title="도착 시간"/>
                </div>
                <button onClick={()=>toggleV(wp.id)} title="바우처/링크 첨부"
                  style={{height:38,padding:"0 12px",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,border:`1px solid ${hasV?"#FBD38D":"#E2E8F0"}`,background:hasV?"#FFFBF0":openV[wp.id]?"#F7FAFC":"#FFF",color:hasV?"#8A6B3E":"#718096",transition:"all .15s"}}>
                  📎 {hasV?"바우처 있음":"바우처"}
                </button>
              </div>
              {/* Voucher panel */}
              {openV[wp.id] && (
                <div style={{marginTop:12,marginLeft:39,padding:"14px",background:"#FFFDF5",borderRadius:12,border:"1px solid #FBD38D"}}>
                  <div style={{fontSize:12,color:"#8A6B3E",fontWeight:700,marginBottom:10}}>📎 바우처 / 예약확인서</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                    <label style={{...W.btn,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
                      📄 파일 첨부 (PDF/이미지)
                      <input type="file" accept="image/*,.pdf" hidden onChange={e=>handleFile(wp.id,e)}/>
                    </label>
                    {wp.voucher?.file && (
                      <a href={wp.voucher.file} download={wp.voucher.fileName}
                        style={{...W.btn,color:"#38A169",border:"1px solid #C6F6D5",background:"#F0FFF4",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
                        ✅ {(wp.voucher.fileName||"").slice(0,22)}
                      </a>
                    )}
                  </div>
                  <div style={{position:"relative"}}>
                    <input type="url" value={safeStr(wp.voucher?.url)}
                      onChange={e=>updateWp(wp.id,{voucher:{...(wp.voucher||{}),url:e.target.value}})}
                      placeholder="예약 확인 링크 (https://...)"
                      style={{paddingRight:wp.voucher?.url?"68px":"16px"}}/>
                    {wp.voucher?.url && (
                      <a href={wp.voucher.url} target="_blank" rel="noopener noreferrer"
                        style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#8A6B3E",fontWeight:700,textDecoration:"none",background:"#FFF5EB",padding:"4px 8px",borderRadius:7}}>
                        열기 ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Transport connector ── */}
            {i < waypoints.length-1 && (
              <div style={{display:"flex",marginLeft:15}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:14,flexShrink:0}}>
                  <div style={{width:2,flex:1,background:"linear-gradient(to bottom,#E2E8F0,#C8A97E)",minHeight:10}}/>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#C8A97E",margin:"3px 0",flexShrink:0}}/>
                  <div style={{width:2,flex:1,background:"linear-gradient(to bottom,#C8A97E,#E2E8F0)",minHeight:10}}/>
                </div>
                <div style={{flex:1,padding:"8px 0 8px 10px"}}>
                  <div style={{fontSize:10,color:"#B0BEC5",fontWeight:600,letterSpacing:.5,marginBottom:7,textTransform:"uppercase"}}>이동수단 · 소요시간</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                    {TRANSPORT_MODES.map(m => {
                      const on = (wp.transport||"transit") === m.id;
                      return (
                        <button key={m.id} onClick={()=>updateWp(wp.id,{transport:m.id})}
                          style={{display:"flex",alignItems:"center",gap:3,padding:"4px 9px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:on?700:400,transition:"all .1s",
                            border:`1.5px solid ${on?"#8A6B3E":"#E2E8F0"}`,background:on?"#FFF5EB":"#FFF",color:on?"#8A6B3E":"#718096",
                            boxShadow:on?"0 2px 8px rgba(138,107,62,.2)":"none"}}>
                          <span style={{fontSize:13}}>{m.icon}</span>{m.label}
                        </button>
                      );
                    })}
                  </div>
                  <select value={safeStr(wp.duration)} onChange={e=>updateWp(wp.id,{duration:e.target.value})}
                    style={{fontSize:13,padding:"7px 10px",borderRadius:10,width:"auto",minWidth:130,height:38,color:wp.duration?"#2D3748":"#A0AEC0"}}>
                    {DURATION_OPTIONS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
            )}
            {i < waypoints.length-1 && <div style={{height:2}}/>}
          </div>
        );
      })}

      <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
        <button onClick={addWp} style={W.btn}>+ 장소 추가</button>
        {valid.length>=1 && gmUrl && (
          <a href={gmUrl} target="_blank" rel="noopener noreferrer"
            style={{...W.mapBtn,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}}>
            🗺️ 구글맵으로 보기
          </a>
        )}
      </div>
    </div>
  );
}
const W = {
  btn:    {background:"#F7FAFC",border:"1px solid #E2E8F0",color:"#4A5568",padding:"8px 14px",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer"},
  mapBtn: {background:"#FFFBF0",border:"1px solid #F6C84B",color:"#8A6B3E",padding:"8px 14px",borderRadius:10,fontWeight:600,fontSize:13,cursor:"pointer"},
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function WanderLog() {
  const [trips,  setTrips] = useState([]);
  const [loaded, setLoaded]= useState(false);
  const [screen, setScreen]= useState("home");
  const [selTrip,setST]    = useState(null);
  const [selDay, setSD]    = useState(null);
  const [modal,  setModal] = useState(false);

  useEffect(()=>{storageLoad().then(d=>{setTrips(safeArr(d));setLoaded(true);});},[]);
  useEffect(()=>{if(loaded)storageSave(trips);},[trips,loaded]);

  const updateTrip = t => {setTrips(p=>p.map(x=>x.id===t.id?t:x));setST(t);};
  const deleteTrip = id => {setTrips(p=>p.filter(x=>x.id!==id));setScreen("home");setST(null);};

  const stats = {
    places: trips.reduce((a,t)=>a+new Set(safeArr(t.days).flatMap(d=>getPlaceNames(d))).size,0),
    days:   trips.reduce((a,t)=>a+safeArr(t.days).length,0),
  };

  if (!loaded) return <div style={{background:"#F8F6F2",minHeight:"100vh"}}/>;

  return (
    <div className="app-wrapper">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Pretendard:wght@300;400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
        html,body { background:#F8F6F2; font-family:'Pretendard',system-ui,sans-serif; color:#1A202C; -webkit-font-smoothing:antialiased; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:rgba(138,107,62,.2); border-radius:10px; }

        /* Base inputs */
        input, textarea, select {
          background:#FFF!important; border:1.5px solid #E8ECF0!important; color:#1A202C!important;
          border-radius:12px; padding:13px 14px; font-family:inherit; font-size:15px;
          outline:none; width:100%; transition:border .15s,box-shadow .15s;
        }
        input:focus, textarea:focus, select:focus {
          border-color:#C8A97E!important; box-shadow:0 0 0 3px rgba(200,169,126,.18)!important;
        }
        input::placeholder, textarea::placeholder { color:#C0C8D0!important; font-weight:400; }

        /* Time input — compact, no global padding overflow */
        .time-input {
          background:transparent!important; border:none!important; box-shadow:none!important;
          padding:0!important; width:auto!important; font-size:13px!important;
          color:#2D3748!important; font-variant-numeric:tabular-nums;
          min-width:72px; max-width:78px;
        }
        .time-input:focus { border:none!important; box-shadow:none!important; }
        .time-input::-webkit-calendar-picker-indicator { opacity:.4; cursor:pointer; }

        /* Place input */
        .place-input { font-size:14px!important; padding:12px 14px!important; }

        .tbtn { transition:all .15s ease-out; cursor:pointer; }
        .tbtn:active { transform:scale(.97); }

        .app-wrapper { display:flex; min-height:100vh; background:#F8F6F2; }
        .left-panel,.right-panel { width:100%; height:100vh; overflow-y:auto; overflow-x:hidden; }

        .spinner { width:13px; height:13px; border:2px solid #E8ECF0; border-top-color:#C8A97E; border-radius:50%; animation:spin .6s linear infinite; flex-shrink:0; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .fade-up { animation:fadeUp .3s ease forwards; }

        @media (max-width:1023px) {
          .app-wrapper { max-width:560px; margin:0 auto; background:#FFF; box-shadow:0 0 40px rgba(0,0,0,.06); }
          .left-panel,.right-panel { background:#FFF; }
          .hidden-mobile { display:none!important; }
          .active-mobile { display:block!important; }
        }
        @media (min-width:1024px) {
          .app-wrapper { padding:28px; gap:24px; height:100vh; overflow:hidden; max-width:1440px; margin:0 auto; }
          .left-panel { width:380px; flex-shrink:0; border-radius:24px; background:#FFF; border:1px solid rgba(0,0,0,.06); box-shadow:0 4px 24px rgba(0,0,0,.04); }
          .right-panel { flex:1; border-radius:24px; background:#FFF; border:1px solid rgba(0,0,0,.06); box-shadow:0 4px 24px rgba(0,0,0,.04); }
          .mobile-back-btn { display:none!important; }
        }
      `}</style>

      <div className={`left-panel ${screen==="home"?"active-mobile":"hidden-mobile"}`}>
        <HomeScreen trips={trips} stats={stats} onSelect={t=>{setST(t);setScreen("trip");}} onNew={()=>setModal(true)}/>
      </div>
      <div className={`right-panel ${screen!=="home"?"active-mobile":"hidden-mobile"}`}>
        {screen==="trip" && selTrip && <TripScreen trip={selTrip} onBack={()=>setScreen("home")} onSelectDay={d=>{setSD(d);setScreen("day");}} onUpdate={updateTrip} onDelete={deleteTrip}/>}
        {screen==="day"  && selDay && selTrip && <DayScreen day={selDay} trip={selTrip} onBack={()=>setScreen("trip")} onUpdate={u=>{const t={...selTrip,days:selTrip.days.map(d=>d.date===u.date?u:d)};updateTrip(t);setSD(u);}}/>}
        {screen==="home" && (
          <div className="hidden-mobile" style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,color:"#B0BEC5"}}>
            <div style={{fontSize:52,opacity:.35}}>✈️</div>
            <div style={{fontSize:16,fontWeight:500}}>왼쪽 목록에서 여행을 선택하거나 추가해주세요</div>
          </div>
        )}
      </div>
      {modal && <NewTripModal onClose={()=>setModal(false)} onCreate={t=>{setTrips(p=>[t,...p]);setModal(false);setST(t);setScreen("trip");}}/>}
    </div>
  );
}

/* ── HOME ────────────────────────────────────────────────────────────────── */
function HomeScreen({ trips, stats, onSelect, onNew }) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const hasKey = !!getApiKey();

  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      {/* Hero header */}
      <div style={{background:"linear-gradient(160deg,#2D1B0E 0%,#6B4C2A 60%,#A88653 100%)",padding:"40px 24px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",bottom:-20,left:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{position:"relative"}}>
          {/* Title row with settings button */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:700,color:"#FFF",letterSpacing:.5,lineHeight:1.1}}>Wanderlog</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:5,letterSpacing:.5}}>나만의 프리미엄 여행 기록</div>
            </div>
            <button onClick={()=>setShowKeyModal(true)} title="AI 검색 설정"
              style={{background: hasKey ? "rgba(100,200,100,.2)" : "rgba(255,200,50,.2)",
                backdropFilter:"blur(10px)", border:`1px solid ${hasKey?"rgba(100,255,100,.35)":"rgba(255,200,50,.5)"}`,
                color:"#FFF", borderRadius:10, padding:"7px 12px", fontSize:12, fontWeight:600, cursor:"pointer",
                display:"flex", alignItems:"center", gap:5}}>
              ⚙️ {hasKey ? "AI 검색 ✓" : "AI 검색 설정"}
            </button>
          </div>
          <button style={{marginTop:20,background:"rgba(255,255,255,.15)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.3)",color:"#FFF",borderRadius:12,padding:"10px 20px",fontWeight:600,fontSize:14,cursor:"pointer"}} className="tbtn" onClick={onNew}>
            + 새 여행 시작
          </button>
        </div>
      </div>

      {/* API key notice when no key */}
      {!hasKey && (
        <div style={{margin:"16px 20px 0",padding:"12px 16px",background:"#FFFBEB",border:"1px solid #FBD38D",borderRadius:14,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setShowKeyModal(true)}>
          <span style={{fontSize:20}}>🔑</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:"#8A6B3E"}}>AI 장소 검색을 사용하려면 API 키가 필요합니다</div>
            <div style={{fontSize:12,color:"#B7A07A",marginTop:2}}>Anthropic API 키를 입력하면 한국어·식당명 검색이 완벽하게 동작합니다 →</div>
          </div>
        </div>
      )}
      {showKeyModal && <ApiKeyModal onClose={()=>setShowKeyModal(false)}/>}

      {/* Stats strip */}
      {stats.days > 0 && (
        <div style={{display:"flex",gap:0,borderBottom:"1px solid #F0EDE8",background:"#FFF"}}>
          {[{v:trips.length,l:"여행",i:"✈️"},{v:stats.days,l:"기록일",i:"📅"},{v:stats.places,l:"방문지",i:"📍"}].map((x,idx)=>(
            <div key={x.l} style={{flex:1,padding:"16px 8px",textAlign:"center",borderRight:idx<2?"1px solid #F0EDE8":"none"}}>
              <div style={{fontSize:13,marginBottom:3}}>{x.i}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#8A6B3E"}}>{x.v}</div>
              <div style={{fontSize:10,color:"#B0B8C1",marginTop:1,fontWeight:500}}>{x.l}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{padding:"20px 20px 32px"}}>
        {trips.length===0 ? (
          <div style={{textAlign:"center",padding:"50px 20px",marginTop:8,background:"#FAFAF8",borderRadius:20,border:"1.5px dashed #D4C4A8"}}>
            <div style={{fontSize:40,marginBottom:14,opacity:.7}}>🧳</div>
            <div style={{fontSize:17,fontWeight:600,color:"#2D3748",marginBottom:6}}>첫 여행을 기록해보세요</div>
            <div style={{fontSize:13,color:"#A0AEC0",lineHeight:1.6}}>소중한 추억을 아름답게 보관해 드립니다</div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {trips.map(t => {
              const days  = safeArr(t.days).length;
              const places = [...new Set(safeArr(t.days).flatMap(d=>getPlaceNames(d)))];
              const expTotal = safeArr(t.days).flatMap(d=>safeArr(d.expenses)).reduce((a,e)=>a+(+e.amount||0),0);
              return (
                <div key={t.id} className="tbtn" style={{borderRadius:20,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.07)",border:"1px solid rgba(0,0,0,.04)",background:"#FFF"}} onClick={()=>onSelect(t)}>
                  <div style={{height:155,position:"relative",background:t.coverImage?`url(${t.coverImage}) center/cover`:t.gradient}}>
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.68) 0%,transparent 55%)"}}/>
                    <div style={{position:"absolute",top:12,right:12,fontSize:28,filter:"drop-shadow(0 2px 6px rgba(0,0,0,.4))"}}>{t.flag||"✈️"}</div>
                    <div style={{position:"absolute",bottom:14,left:18,right:18}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:700,color:"#FFF",lineHeight:1.2,textShadow:"0 1px 8px rgba(0,0,0,.5)"}}>{t.title}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,.8)",marginTop:4,display:"flex",gap:12,alignItems:"center"}}>
                        <span>{fmtShort(t.startDate)} — {fmtShort(t.endDate)}</span>
                        <span style={{opacity:.6}}>·</span>
                        <span>{days}일</span>
                        {places.length>0 && <><span style={{opacity:.6}}>·</span><span>{places.length}곳</span></>}
                      </div>
                    </div>
                  </div>
                  {places.length>0 && (
                    <div style={{padding:"10px 16px 12px",display:"flex",flexWrap:"wrap",gap:5}}>
                      {places.slice(0,4).map(p=><span key={p} style={{fontSize:11,color:"#718096",background:"#F7F5F2",padding:"3px 9px",borderRadius:8,border:"1px solid #EDE9E3"}}>{p}</span>)}
                      {places.length>4 && <span style={{fontSize:11,color:"#A0AEC0",padding:"3px 6px"}}>+{places.length-4}곳</span>}
                    </div>
                  )}
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
  const allWps = safeArr(trip.days).flatMap(d=>getWaypoints(d).filter(w=>w.lat&&w.lon));
  const gmUrl  = buildGmapsUrl(allWps);

  return (
    <div style={{height:"100%",overflowY:"auto",paddingBottom:80}}>
      {/* Hero */}
      <div style={{height:260,position:"relative",background:trip.coverImage?`url(${trip.coverImage}) center/cover`:trip.gradient}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.75) 0%,rgba(0,0,0,.15) 50%,transparent 100%)"}}/>
        <div style={{position:"absolute",top:16,left:16,right:16,display:"flex",justifyContent:"space-between",zIndex:10}}>
          <button style={S.glassBtn} className="tbtn mobile-back-btn" onClick={onBack}>← 뒤로</button>
          <div style={{display:"flex",gap:8}}>
            <label style={S.glassBtn} className="tbtn">
              📷 커버
              <input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>onUpdate({...trip,coverImage:ev.target.result});r.readAsDataURL(f);}}/>
            </label>
            <button style={{...S.glassBtn,color:"#FCA5A5"}} className="tbtn" onClick={()=>{if(confirm("삭제할까요?"))onDelete(trip.id)}}>삭제</button>
          </div>
        </div>
        <div style={{position:"absolute",bottom:20,left:22,right:22,zIndex:5}}>
          <div style={{fontSize:44,marginBottom:6,filter:"drop-shadow(0 3px 8px rgba(0,0,0,.4))"}}>{trip.flag||"✈️"}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"#FFF",textShadow:"0 2px 12px rgba(0,0,0,.6)",lineHeight:1.2}}>{trip.title}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.8)",marginTop:5,fontWeight:400}}>{trip.country} · {fmtDate(trip.startDate)} — {fmtDate(trip.endDate)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid #F0EDE8",padding:"0 8px",position:"sticky",top:0,background:"rgba(255,255,255,.97)",backdropFilter:"blur(14px)",zIndex:20,overflowX:"auto"}}>
        {[["timeline","타임라인"],["map","전체 지도"],["photos","사진"]].map(([id,lbl])=>(
          <button key={id} style={{padding:"15px 16px",fontSize:13.5,fontWeight:600,color:tab===id?"#8A6B3E":"#B0BEC5",background:"none",border:"none",cursor:"pointer",borderBottom:`2.5px solid ${tab===id?"#8A6B3E":"transparent"}`,transition:"all .18s",whiteSpace:"nowrap"}} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={{padding:"20px 20px 0"}}>
        {tab==="timeline" && <div className="fade-up">{safeArr(trip.days).map((d,i)=><DayRow key={d.date} day={d} index={i} total={trip.days.length} onClick={()=>onSelectDay(d)}/>)}</div>}

        {tab==="map" && (
          <div className="fade-up" style={{textAlign:"center",padding:"40px 16px"}}>
            <div style={{fontSize:52,marginBottom:14}}>🗺️</div>
            <div style={{fontSize:18,fontWeight:700,color:"#2D3748",marginBottom:8,fontFamily:"'Cormorant Garamond',serif"}}>전체 여행 동선</div>
            <div style={{fontSize:13,color:"#A0AEC0",lineHeight:1.7,marginBottom:24}}>입력된 장소 {allWps.length}곳을 구글맵에서 확인하세요.<br/>날짜별 일지에서 장소를 추가할 수 있습니다.</div>
            {gmUrl ? (
              <a href={gmUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnPrimary,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8}}>
                🗺️ 구글맵에서 보기
              </a>
            ) : <div style={{color:"#C0C8D0",fontSize:13}}>날짜별 일지에서 장소를 추가하면<br/>전체 동선을 구글맵으로 볼 수 있습니다.</div>}
            {allWps.length>0 && (
              <div style={{marginTop:24,display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center"}}>
                {allWps.map((w,i)=><span key={i} style={{fontSize:12,color:"#6B7A8D",background:"#F7F5F2",padding:"5px 11px",borderRadius:10,border:"1px solid #EDE9E3"}}>{w.icon||"📍"} {w.name}</span>)}
              </div>
            )}
          </div>
        )}

        {tab==="photos" && <div className="fade-up"><PhotosTab photos={safeArr(trip.days).flatMap(d=>safeArr(d.photos))}/></div>}
      </div>
    </div>
  );
}

function DayRow({ day, index, total, onClick }) {
  const wps  = getWaypoints(day).filter(w=>w.name);
  const exps = safeArr(day.expenses);
  const expTotal = exps.reduce((a,e)=>a+(+e.amount||0),0);
  const isLast = index === total-1;
  return (
    <div style={{display:"flex",gap:14,marginBottom:0}}>
      {/* Timeline spine */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:36,flexShrink:0,paddingTop:4}}>
        <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#A88653,#8A6B3E)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 12px rgba(138,107,62,.3)"}}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:12,fontWeight:700,color:"#FFF"}}>{index+1}</span>
        </div>
        {!isLast && <div style={{width:2,flex:1,background:"linear-gradient(to bottom,#C8A97E,#EDE9E3)",minHeight:20,marginTop:6,borderRadius:2}}/>}
      </div>
      {/* Card */}
      <div className="tbtn" style={{flex:1,marginBottom:14,background:"#FFF",borderRadius:18,border:"1px solid #F0EDE8",boxShadow:"0 3px 14px rgba(0,0,0,.04)",overflow:"hidden",cursor:"pointer"}} onClick={onClick}>
        <div style={{padding:"14px 16px 12px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#1A202C"}}>{fmtDate(day.date)}</div>
              {wps.length>0 && (
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                  {wps.slice(0,3).map((w,i)=>(
                    <span key={i} style={{fontSize:11.5,color:"#5A6572",background:"#F7F5F2",padding:"3px 9px",borderRadius:8,border:"1px solid #EDE9E3",display:"inline-flex",alignItems:"center",gap:3}}>
                      {w.icon||"📍"} {w.name}
                      {w.time && <span style={{color:"#B0BEC5",fontSize:10}}> {w.time}</span>}
                      {(w.voucher?.fileName||w.voucher?.url) && <span style={{color:"#C8A97E",fontSize:10}}>📎</span>}
                    </span>
                  ))}
                  {wps.length>3 && <span style={{fontSize:11,color:"#A0AEC0",padding:"3px 6px"}}>+{wps.length-3}</span>}
                </div>
              )}
            </div>
            {expTotal>0 && <div style={{flexShrink:0,marginLeft:8,background:"#FFFBF0",border:"1px solid #F6C84B",borderRadius:8,padding:"4px 9px",fontSize:12,fontWeight:700,color:"#8A6B3E"}}>{expTotal.toLocaleString()}</div>}
          </div>
          {/* Transport summary */}
          {wps.length>1 && (() => {
            const moves = wps.slice(0,-1).filter(w=>w.transport||w.duration).map(w=>{
              const t=TRANSPORT_MODES.find(m=>m.id===w.transport);
              return [t?.icon,w.duration].filter(Boolean).join(" ");
            }).filter(Boolean);
            return moves.length>0 ? (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {moves.map((m,i)=><span key={i} style={{fontSize:11,color:"#8A6B3E",background:"#FFF8EE",padding:"2px 8px",borderRadius:7,border:"1px solid #F6D48A"}}>{m}</span>)}
              </div>
            ) : null;
          })()}
          {day.diary && <div style={{fontSize:13,color:"#8A9BB0",lineHeight:1.6,background:"#FAFAFA",padding:"9px 11px",borderRadius:10,fontStyle:"italic",marginTop:4}}>&ldquo;{day.diary.slice(0,65)}{day.diary.length>65?"…":""}&rdquo;</div>}
          {safeArr(day.photos).length>0 && (
            <div style={{display:"flex",gap:5,marginTop:10}}>
              {day.photos.slice(0,4).map((p,i)=><div key={i} style={{width:44,height:44,borderRadius:10,backgroundSize:"cover",backgroundPosition:"center",backgroundImage:`url(${p})`,border:"1px solid #EDE9E3"}}/>)}
              {day.photos.length>4 && <div style={{width:44,height:44,borderRadius:10,background:"#F7F5F2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#A0AEC0",border:"1px solid #EDE9E3"}}>+{day.photos.length-4}</div>}
            </div>
          )}
        </div>
        {!day.diary && !wps.length && !safeArr(day.photos).length && (
          <div style={{padding:"0 16px 14px",fontSize:12,color:"#C0C8D0",fontStyle:"italic"}}>탭해서 기록 추가하기...</div>
        )}
      </div>
    </div>
  );
}

function PhotosTab({ photos }) {
  const [prev, setPrev] = useState(null);
  if (!safeArr(photos).length) return <div style={{textAlign:"center",padding:"56px 0",color:"#C0C8D0",fontSize:14}}>등록된 사진이 없습니다.</div>;
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:10}}>
        {photos.map((p,i)=><div key={i} style={{aspectRatio:"1",borderRadius:14,backgroundSize:"cover",backgroundPosition:"center",backgroundImage:`url(${p})`,cursor:"pointer",boxShadow:"0 3px 10px rgba(0,0,0,.07)"}} onClick={()=>setPrev(p)}/>)}
      </div>
      {prev && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,cursor:"pointer"}} onClick={()=>setPrev(null)}><img src={prev} style={{maxWidth:"92vw",maxHeight:"86vh",borderRadius:16,boxShadow:"0 28px 60px rgba(0,0,0,.7)"}} alt=""/></div>}
    </div>
  );
}

/* ── DAY SCREEN ──────────────────────────────────────────────────────────── */
function DayScreen({ day, trip, onBack, onUpdate }) {
  const [wps,    setWps]    = useState(()=>getWaypoints(day));
  const [diary,  setDiary]  = useState(()=>safeStr(day.diary));
  const [photos, setPhotos] = useState(()=>safeArr(day.photos));
  const [exps,   setExps]   = useState(()=>safeArr(day.expenses));
  const [saved,  setSaved]  = useState(false);
  const [newExp, setNewExp] = useState({amount:"",category:"food",method:"card",currency:trip.currency||"KRW",memo:""});
  const idx = safeArr(trip.days).findIndex(d=>d.date===day.date);

  const save = () => {
    onUpdate({...day,waypoints:wps,city:wps[0]?.name||"",diary,photos,expenses:exps});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };
  const addPhotos = e => Array.from(e.target.files).forEach(f=>{const r=new FileReader();r.onload=ev=>setPhotos(p=>[...p,ev.target.result]);r.readAsDataURL(f);});
  const addExp = () => {if(!newExp.amount)return;setExps([...exps,{id:uid(),...newExp}]);setNewExp({...newExp,amount:"",memo:""});};

  return (
    <div style={{height:"100%",overflowY:"auto",paddingBottom:90}}>
      {/* Sticky header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",background:"rgba(255,255,255,.97)",backdropFilter:"blur(14px)",position:"sticky",top:0,zIndex:30,borderBottom:"1px solid #F0EDE8"}}>
        <button style={S.iconBtn} className="tbtn" onClick={onBack}>←</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,color:"#B0BEC5",fontWeight:600,letterSpacing:.8}}>DAY {idx+1}</div>
          <div style={{fontSize:15,fontWeight:700,color:"#1A202C"}}>{fmtDate(day.date)}</div>
        </div>
        <button style={{...S.btnPrimary,padding:"10px 20px",fontSize:14,...(saved?{background:"#48BB78",boxShadow:"0 4px 12px rgba(72,187,120,.3)"}:{})}} className="tbtn" onClick={save}>
          {saved?"✅ 완료":"저장"}
        </button>
      </div>

      <div style={{padding:"20px 20px 0"}}>

        {/* Waypoints */}
        <div style={S.secBox}>
          <div style={S.secTitle}>📍 일정 & 동선</div>
          <WaypointsEditor waypoints={wps} onChange={setWps}/>
        </div>

        {/* Expenses */}
        <div style={S.secBox}>
          <div style={S.secTitle}>💰 지출 내역</div>
          <div style={{background:"#FAFAF8",padding:"16px",borderRadius:16,marginBottom:14,border:"1px solid #F0EDE8"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
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
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <select value={newExp.currency} onChange={e=>setNewExp({...newExp,currency:e.target.value})} style={{width:88,padding:"12px 6px"}}>
                {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="금액" value={newExp.amount} onChange={e=>setNewExp({...newExp,amount:e.target.value})} style={{flex:1}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <input type="text" placeholder="메모 (예: 라멘집, 지하철)" value={newExp.memo} onChange={e=>setNewExp({...newExp,memo:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addExp()} style={{flex:1}}/>
              <button onClick={addExp} style={{...S.btnPrimary,padding:"0 20px",height:50,flexShrink:0}}>추가</button>
            </div>
          </div>
          {exps.length>0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {exps.map(e=>{
                const cat=EXP_CATS.find(c=>c.id===e.category);
                return (
                  <div key={e.id} style={{display:"flex",alignItems:"center",padding:"11px 14px",background:"#FFF",border:"1px solid #F0EDE8",borderRadius:13,gap:11}}>
                    <div style={{width:36,height:36,borderRadius:10,background:`${cat?.color||"#F0EDE8"}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cat?.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:"#1A202C"}}>{e.memo||cat?.label}</div>
                      <div style={{fontSize:11,color:"#B0BEC5",marginTop:1}}>{PAYMENT_METHODS.find(m=>m.id===e.method)?.label}</div>
                    </div>
                    <div style={{textAlign:"right",marginRight:8}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#8A6B3E"}}>{Number(e.amount).toLocaleString()}</div>
                      <div style={{fontSize:10,color:"#B0BEC5",letterSpacing:.5}}>{e.currency}</div>
                    </div>
                    <button onClick={()=>setExps(exps.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",color:"#FC8181",cursor:"pointer",fontSize:16,padding:"2px"}}>✕</button>
                  </div>
                );
              })}
            </div>
          ) : <div style={{textAlign:"center",padding:"16px",color:"#C0C8D0",fontSize:13}}>지출 내역이 없습니다.</div>}
        </div>

        {/* Diary */}
        <div style={S.secBox}>
          <div style={S.secTitle}>✍️ 여행 노트</div>
          <textarea value={diary} onChange={e=>setDiary(e.target.value)} placeholder="오늘 어떤 멋진 순간들이 있었나요?" style={{minHeight:140,lineHeight:1.7,fontSize:14,resize:"vertical"}}/>
          {diary.length>0 && <div style={{textAlign:"right",fontSize:11,color:"#C0C8D0",marginTop:4}}>{diary.length}자</div>}
        </div>

        {/* Photos */}
        <div style={S.secBox}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={S.secTitle} style={{margin:0}}>📷 사진</div>
            <label style={{...W.btn,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}} className="tbtn">
              + 사진 추가
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
            </label>
          </div>
          {photos.length>0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {photos.map((p,i)=>(
                <div key={i} style={{position:"relative",aspectRatio:"1",borderRadius:14,backgroundImage:`url(${p})`,backgroundSize:"cover",backgroundPosition:"center",boxShadow:"0 3px 10px rgba(0,0,0,.08)"}}>
                  <button style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.55)",color:"#FFF",border:"none",width:22,height:22,borderRadius:"50%",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"28px",background:"#FAFAF8",borderRadius:16,border:"1.5px dashed #D4C4A8",cursor:"pointer"}}>
              <span style={{fontSize:28,opacity:.35}}>📷</span>
              <span style={{fontSize:13,color:"#C0C8D0"}}>탭해서 사진 추가</span>
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
            </label>
          )}
        </div>
      </div>

      {/* Floating save */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:560,padding:"10px 20px 22px",background:"linear-gradient(to top,rgba(255,255,255,1) 60%,transparent)",zIndex:30,pointerEvents:"none"}}>
        <button style={{...S.btnPrimary,width:"100%",padding:"16px",fontSize:16,borderRadius:16,pointerEvents:"all",...(saved?{background:"#48BB78",boxShadow:"0 6px 20px rgba(72,187,120,.3)"}:{})}} className="tbtn" onClick={save}>
          {saved?"✅ 저장완료":"저장하기"}
        </button>
      </div>
    </div>
  );
}

/* ── API KEY MODAL ───────────────────────────────────────────────────────── */
function ApiKeyModal({ onClose }) {
  const [key, setKey]       = useState(getApiKey);
  const [testing, setTest]  = useState(false);
  const [status, setStatus] = useState(""); // "ok" | "fail" | ""

  const testAndSave = async () => {
    if (!key.trim()) return;
    setTest(true); setStatus("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":key.trim(),"anthropic-version":"2023-06-01"},
        body: JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:10,messages:[{role:"user",content:"hi"}]}),
      });
      if (res.ok) {
        saveApiKey(key.trim());
        setStatus("ok");
        setTimeout(onClose, 1200);
      } else {
        setStatus("fail");
      }
    } catch { setStatus("fail"); }
    setTest(false);
  };

  const remove = () => { saveApiKey(""); setKey(""); setStatus(""); };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200}}>
      <div style={{background:"#FFF",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:560,padding:"20px 24px 40px",boxShadow:"0 -16px 50px rgba(0,0,0,.15)"}} className="fade-up">
        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <div style={{width:40,height:4,borderRadius:2,background:"#E2E8F0"}}/>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontSize:18,fontWeight:700,color:"#1A202C"}}>🔑 AI 장소 검색 설정</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,color:"#A0AEC0",cursor:"pointer"}}>✕</button>
        </div>
        <div style={{fontSize:13,color:"#718096",marginBottom:20,lineHeight:1.6}}>
          Anthropic API 키를 입력하면 <strong>한국어·영어·식당명·호텔명</strong> 검색이 완벽하게 동작합니다.<br/>
          키는 이 기기의 브라우저에만 저장되며 외부로 전송되지 않습니다.
        </div>

        <label style={{fontSize:12,fontWeight:600,color:"#718096",display:"block",marginBottom:6}}>Anthropic API Key</label>
        <input
          type="password"
          value={key}
          onChange={e=>{setKey(e.target.value);setStatus("");}}
          placeholder="sk-ant-api03-..."
          style={{fontSize:14,letterSpacing:.5,marginBottom:12}}
        />

        {status==="ok"  && <div style={{fontSize:13,color:"#38A169",fontWeight:600,marginBottom:10}}>✅ 연결 성공! 이제 한국어 검색이 됩니다.</div>}
        {status==="fail"&& <div style={{fontSize:13,color:"#E53E3E",fontWeight:600,marginBottom:10}}>❌ 키가 유효하지 않습니다. 다시 확인해주세요.</div>}

        <div style={{display:"flex",gap:10}}>
          <button onClick={testAndSave} disabled={!key.trim()||testing}
            style={{flex:1,background:"linear-gradient(135deg,#A88653,#8A6B3E)",color:"#FFF",border:"none",borderRadius:12,padding:"13px",fontWeight:700,fontSize:15,cursor:"pointer",opacity:(!key.trim()||testing)?0.5:1}}>
            {testing ? "확인 중..." : "저장 및 테스트"}
          </button>
          {getApiKey() && (
            <button onClick={remove} style={{padding:"13px 18px",borderRadius:12,border:"1px solid #FED7D7",background:"#FFF5F5",color:"#E53E3E",fontWeight:600,fontSize:14,cursor:"pointer"}}>
              삭제
            </button>
          )}
        </div>

        <div style={{marginTop:16,padding:"12px 14px",background:"#F8FAFC",borderRadius:12,border:"1px solid #EDF2F7"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#4A5568",marginBottom:6}}>🔗 API 키 발급 방법</div>
          <div style={{fontSize:12,color:"#718096",lineHeight:1.7}}>
            1. <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{color:"#8A6B3E",fontWeight:600}}>console.anthropic.com</a> 접속<br/>
            2. 로그인 후 <strong>API Keys</strong> 메뉴 클릭<br/>
            3. <strong>Create Key</strong> → 키 복사 후 위에 붙여넣기
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── NEW TRIP MODAL ──────────────────────────────────────────────────────── */
function NewTripModal({ onClose, onCreate }) {
  const [form, setForm] = useState({title:"",country:"",flag:"",startDate:"",endDate:"",currency:"KRW",gradient:GRADIENTS[0]});
  const valid = form.title && form.startDate && form.endDate && new Date(form.endDate)>=new Date(form.startDate);
  const dc = valid ? dateRange(form.startDate,form.endDate).length : 0;

  const handleCountry = v => { const af=guessFlag(v); setForm({...form,country:v,flag:af||form.flag}); };
  const create = () => {
    if (!valid) return;
    onCreate({id:uid(),...form,flag:form.flag||"✈️",days:dateRange(form.startDate,form.endDate).map(date=>({date,waypoints:[newWaypoint()],diary:"",photos:[],expenses:[]}))});
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,padding:0}}>
      <div style={{background:"#FFF",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:560,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 -16px 60px rgba(0,0,0,.15)"}} className="fade-up">
        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0"}}>
          <div style={{width:40,height:4,borderRadius:2,background:"#E2E8F0"}}/>
        </div>
        <div style={{padding:"14px 22px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#1A202C"}}>새 여행 시작하기</div>
          <button style={{...S.iconBtn,background:"transparent",border:"none"}} onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"8px 22px 0",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={S.label}>여행 제목 *</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="도쿄 벚꽃 여행 2025"/>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <label style={S.label}>
                국가
                {guessFlag(form.country) && <span style={{color:"#48BB78",fontSize:10,marginLeft:5}}>자동 {guessFlag(form.country)}</span>}
              </label>
              <input value={form.country} onChange={e=>handleCountry(e.target.value)} placeholder="일본, Japan, Thailand..."/>
            </div>
            <div style={{width:76}}>
              <label style={S.label}>국기</label>
              <input value={form.flag} onChange={e=>setForm({...form,flag:e.target.value})} style={{textAlign:"center",fontSize:22,padding:"8px 4px"}} placeholder="🇯🇵"/>
            </div>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}><label style={S.label}>시작일 *</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></div>
            <div style={{flex:1}}><label style={S.label}>종료일 *</label><input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></div>
          </div>
          {dc>0 && <div style={{fontSize:12,color:"#8A6B3E",fontWeight:600,textAlign:"right",marginTop:-6}}>✦ {dc}일 여행</div>}
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{flex:1}}><label style={S.label}>기본 통화</label><select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div style={{flex:2}}>
              <label style={S.label}>테마 색상</label>
              <div style={{display:"flex",gap:8,marginTop:6}}>{GRADIENTS.map((g,i)=><div key={i} style={{width:36,height:36,borderRadius:10,background:g,cursor:"pointer",border:form.gradient===g?"3px solid #8A6B3E":"3px solid transparent",transition:"border .12s"}} onClick={()=>setForm({...form,gradient:g})}/>)}</div>
            </div>
          </div>
        </div>
        <div style={{padding:"16px 22px 28px",display:"flex",gap:10,borderTop:"1px solid #F0EDE8",marginTop:14}}>
          <button style={{flex:1,padding:"14px",borderRadius:13,border:"none",background:"#F3F0EB",color:"#6B7280",fontWeight:600,fontSize:15,cursor:"pointer"}} onClick={onClose}>취소</button>
          <button style={{flex:2,...S.btnPrimary,padding:"14px",borderRadius:13,fontSize:15,opacity:valid?1:.45,cursor:valid?"pointer":"not-allowed"}} className={valid?"tbtn":""} onClick={create}>여행 만들기 ✦</button>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const S = {
  btnPrimary: {background:"linear-gradient(135deg,#B8935A,#8A6B3E)",color:"#FFF",border:"none",borderRadius:13,padding:"12px 22px",fontWeight:700,fontSize:15,boxShadow:"0 6px 18px rgba(138,107,62,.28)",cursor:"pointer"},
  glassBtn:   {background:"rgba(255,255,255,.22)",backdropFilter:"blur(14px)",border:"1px solid rgba(255,255,255,.38)",color:"#FFF",borderRadius:11,padding:"8px 15px",fontWeight:600,fontSize:13,cursor:"pointer"},
  iconBtn:    {background:"#F7F5F2",border:"1px solid #EDE9E3",width:38,height:38,borderRadius:11,color:"#4A5568",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  secBox:     {marginBottom:18,background:"#FFF",padding:"20px",borderRadius:20,border:"1px solid #F0EDE8",boxShadow:"0 2px 16px rgba(0,0,0,.03)"},
  secTitle:   {fontSize:14,fontWeight:700,color:"#1A202C",marginBottom:14,display:"block"},
  label:      {fontSize:11.5,fontWeight:600,color:"#8A9BB0",marginBottom:5,display:"block",letterSpacing:.2},
};
