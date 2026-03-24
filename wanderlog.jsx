import { useState, useEffect, useRef, useCallback } from "react";

/* ?? Storage ??????????????????????????????????????????????????????????????? */
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

/* ?? Utilities ????????????????????????????????????????????????????????????? */
const uid       = () => Math.random().toString(36).slice(2,10);
const fmtDate   = d => d ? new Date(d).toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"}) : "";
const fmtShort  = d => d ? new Date(d).toLocaleDateString("ko-KR",{month:"short",day:"numeric"}) : "";
const dateRange = (s,e) => { const r=[],c=new Date(s),end=new Date(e); while(c<=end){r.push(c.toISOString().slice(0,10));c.setDate(c.getDate()+1);} return r; };
const safeArr   = v => Array.isArray(v) ? v : [];
const safeStr   = v => typeof v === "string" ? v : "";

/* ?? Constants ????????????????????????????????????????????????????????????? */
const CURRENCIES = ["KRW","USD","EUR","JPY","GBP","CNY","THB","VND","SGD","AUD","TWD","HKD"];
const EXP_CATS = [
  {id:"food",       label:"?앸퉬",   icon:"\uD83C\uDF5C", color:"#F6AD55"},
  {id:"transport",  label:"援먰넻",   icon:"\uD83D\uDE8C", color:"#76E4F7"},
  {id:"lodging",    label:"?숇컯",   icon:"\uD83C\uDFE8", color:"#90CDF4"},
  {id:"sightseeing",label:"愿愿?,   icon:"\uD83C\uDFAD", color:"#9AE6B4"},
  {id:"shopping",   label:"?쇳븨",   icon:"\uD83D\uDECD", color:"#FBD38D"},
  {id:"other",      label:"湲고?",   icon:"\uD83D\uDCB3", color:"#D6BCFA"},
];
const PAYMENT_METHODS = [
  {id:"card",   label:"?좎슜移대뱶"},
  {id:"cash",   label:"?꾧툑"},
  {id:"travel", label:"?몃옒釉붿껜?ъ뭅??},
];
const TRANSPORT_MODES = [
  {id:"transit",  label:"?以묎탳??, icon:"\uD83D\uDE87", maps:"transit"},
  {id:"subway",   label:"?꾩쿋",     icon:"\uD83D\uDE83", maps:"transit"},
  {id:"bus",      label:"踰꾩뒪",     icon:"\uD83D\uDE8C", maps:"transit"},
  {id:"taxi",     label:"?앹떆",     icon:"\uD83D\uDE95", maps:"driving"},
  {id:"walking",  label:"?꾨낫",     icon:"\uD83D\uDEB6", maps:"walking"},
  {id:"driving",  label:"?먮룞李?,   icon:"\uD83D\uDE97", maps:"driving"},
  {id:"rental",   label:"?뚰듃移?,   icon:"\uD83D\uDE99", maps:"driving"},
  {id:"bicycle",  label:"?먯쟾嫄?,   icon:"\uD83D\uDEB2", maps:"bicycling"},
  {id:"train",    label:"湲곗감",     icon:"\uD83D\uDE84", maps:"transit"},
  {id:"flight",   label:"??났",     icon:"\u2708",       maps:null},
  {id:"boat",     label:"?좊컯",     icon:"\u26F4",       maps:"transit"},
];
const DURATION_OPTIONS = [
  {value:"",      label:"?뚯슂?쒓컙"},
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
  "?쒓뎅":"?눖?눟","??쒕?援?:"?눖?눟","korea":"?눖?눟","south korea":"?눖?눟",
  "?쇰낯":"?눓?눝","japan":"?눓?눝","以묎뎅":"?눊?눛","china":"?눊?눛",
  "誘멸뎅":"?눣?눡","usa":"?눣?눡","united states":"?눣?눡","america":"?눣?눡",
  "?곴뎅":"?눐?눉","uk":"?눐?눉","united kingdom":"?눐?눉",
  "?꾨옉??:"?눏?눟","france":"?눏?눟","?낆씪":"?눍?눎","germany":"?눍?눎",
  "?댄깉由ъ븘":"?눒?눢","italy":"?눒?눢","?ㅽ럹??:"?눎?눡","spain":"?눎?눡",
  "?쒓뎅":"?눢?눑","thailand":"?눢?눑","踰좏듃??:"?눤?눛","vietnam":"?눤?눛",
  "?留?:"?눢?눥","taiwan":"?눢?눥","?깃??щⅤ":"?눡?눐","singapore":"?눡?눐",
  "?띿쉘":"?눑?눖","hong kong":"?눑?눖","?몄＜":"?눇?눣","australia":"?눇?눣",
  "罹먮굹??:"?눊?눇","canada":"?눊?눇","?몃룄":"?눒?눛","india":"?눒?눛",
  "?щⅤ?ш컝":"?눝?눢","portugal":"?눝?눢","?ㅻ뜙???:"?눛?눘","netherlands":"?눛?눘",
  "?ㅼ쐞??:"?눊?눑","switzerland":"?눊?눑","?ㅼ뒪?몃━??:"?눇?눢","austria":"?눇?눢",
  "洹몃━??:"?눐?눟","greece":"?눐?눟","?고궎":"?눢?눟","turkey":"?눢?눟",
  "泥댁퐫":"?눊?눨","czech":"?눊?눨","?앷?由?:"?눑?눣","hungary":"?눑?눣",
  "?щ줈?꾪떚??:"?눑?눟","croatia":"?눑?눟","紐⑤줈肄?:"?눚?눇","morocco":"?눚?눇",
  "?댁쭛??:"?눎?눐","egypt":"?눎?눐","?꾨엻?먮?由ы듃":"?눇?눎","uae":"?눇?눎","dubai":"?눇?눎",
  "留먮젅?댁떆??:"?눚?눧","malaysia":"?눚?눧","?몃룄?ㅼ떆??:"?눒?눍","indonesia":"?눒?눍",
  "?꾨━?":"?눝?눑","philippines":"?눝?눑","硫뺤떆肄?:"?눚?눦","mexico":"?눚?눦",
};
const guessFlag = c => c ? (FLAG_MAP[c.toLowerCase().trim()] || null) : null;

/* ?? Data helpers ?????????????????????????????????????????????????????????? */
const newWaypoint = () => ({id:uid(),name:"",lat:null,lon:null,time:"",icon:"",transport:"transit",duration:"",voucher:{file:null,fileName:"",url:""}});
const getWaypoints  = d => safeArr(d?.waypoints).length ? d.waypoints : [newWaypoint()];
const getPlaceNames = d => getWaypoints(d).map(w=>w.name).filter(Boolean);

/* ?? Place icon helper (for fallback API results) ?????????????????????????? */
function placeIcon(type="") {
  const t = type.toLowerCase();
  if (["hotel","hostel","guest_house","motel","resort","ryokan","inn","lodge","accommodation"].some(x=>t.includes(x))) return "\uD83C\uDFE8";
  if (["restaurant","cafe","fast_food","bar","pub","izakaya","ramen","sushi","food","eatery","bistro","diner"].some(x=>t.includes(x))) return "\uD83C\uDF7D";
  if (["museum","attraction","viewpoint","monument","castle","temple","shrine","cathedral","church","ruins","gallery"].some(x=>t.includes(x))) return "\uD83C\uDFDB";
  if (["station","subway","tram","bus_stop","bus_station","airport","aerodrome","terminal"].some(x=>t.includes(x))) return "\uD83D\uDE49";
  if (["park","garden","forest","nature"].some(x=>t.includes(x))) return "\uD83C\uDF3F";
  if (["beach","bay","coast","sea"].some(x=>t.includes(x))) return "\uD83C\uDFD6";
  if (["mall","shop","market","shopping"].some(x=>t.includes(x))) return "\uD83D\uDECD";
  if (["hospital","clinic","pharmacy"].some(x=>t.includes(x))) return "\uD83C\uDFE5";
  return "\uD83D\uDCCD";
}

/* ?? fetchPlaces: /api/places ?쒕쾭由ъ뒪 ?⑥닔 ?몄텧 ??????????????????????????? */
async function fetchPlaces(query) {
  if (!query || query.trim().length < 1) return [];
  try {
    const res = await fetch(`/api/places?q=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

/* ?? Google Maps URL ??????????????????????????????????????????????????????? */
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

/* ?? PlaceSearch ??????????????????????????????????????????????????????????? */
function PlaceSearch({ value, placeholder, onSelect, onNameChange }) {
  const [q,   setQ]   = useState(value || "");
  const [res, setRes] = useState([]);
  const [ld,  setLd]  = useState(false);
  const [open,setOpen]= useState(false);
  const debRef = useRef(), wrapRef = useRef();

  useEffect(() => { setQ(value || ""); }, [value]);

  const doSearch = useCallback(v => {
    clearTimeout(debRef.current);
    if (!v || v.trim().length < 1) { setRes([]); setOpen(false); return; }
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
          placeholder={placeholder || "?μ냼 寃??(?쒓뎅?는룹쁺?는룹떇?밸챸...)"}
          onFocus={() => res.length > 0 && setOpen(true)}
          className="place-input"
          style={{paddingRight: ld ? 76 : 12}}/>
        {ld && (
          <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:5}}>
            <div className="spinner"/>
            <span style={{fontSize:11,color:"#A0AEC0"}}>寃?됱쨷</span>
          </div>
        )}
      </div>
      {open && res.length > 0 && (
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#FFF",border:"1px solid #E8ECF0",borderRadius:16,zIndex:2000,overflow:"hidden",boxShadow:"0 24px 48px rgba(0,0,0,.12)"}}>
          <div style={{padding:"7px 14px 5px",fontSize:10,color:"#B0BEC5",letterSpacing:.8,fontWeight:600,background:"#FAFAFA",borderBottom:"1px solid #F0F0F0",display:"flex",justifyContent:"space-between"}}>
            <span>AI ?μ냼 寃??/span>
            <span style={{color:"#D0D8E0"}}>?쒓뎅??쨌 ?곸뼱 쨌 ?앸떦紐?吏??/span>
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

/* ?? WaypointsEditor ??????????????????????????????????????????????????????? */
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
            {/* ?? Waypoint card ?? */}
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
                  {wp.lat ? (wp.icon||"?뱧") : i+1}
                </div>
                <PlaceSearch
                  value={safeStr(wp.name)}
                  placeholder={i===0 ? "異쒕컻吏 寃??(?명뀛, 怨듯빆, ??..)" : "?ㅼ쓬 ?μ냼 寃??.."}
                  onSelect={p=>updateWp(wp.id,{name:p.name,lat:p.lat,lon:p.lon,icon:p.icon})}
                  onNameChange={n=>updateWp(wp.id,{name:n,lat:null,lon:null,icon:""})}
                />
                {waypoints.length>1 && (
                  <button onClick={()=>removeWp(wp.id)} style={{width:30,height:30,borderRadius:9,flexShrink:0,background:"#FFF5F5",color:"#FC8181",border:"none",cursor:"pointer",fontSize:13}}>??/button>
                )}
              </div>
              {/* Row 2: time + voucher */}
              <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:39}}>
                <div style={{display:"flex",alignItems:"center",gap:6,background:"#FFF",border:"1px solid #E2E8F0",borderRadius:10,padding:"0 10px",height:38}}>
                  <span style={{fontSize:12,color:"#A0AEC0",userSelect:"none"}}>?븧</span>
                  <input type="time" value={safeStr(wp.time)} onChange={e=>updateWp(wp.id,{time:e.target.value})}
                    className="time-input"
                    title="?꾩갑 ?쒓컙"/>
                </div>
                <button onClick={()=>toggleV(wp.id)} title="諛붿슦泥?留곹겕 泥⑤?"
                  style={{height:38,padding:"0 12px",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,border:`1px solid ${hasV?"#FBD38D":"#E2E8F0"}`,background:hasV?"#FFFBF0":openV[wp.id]?"#F7FAFC":"#FFF",color:hasV?"#8A6B3E":"#718096",transition:"all .15s"}}>
                  ?뱨 {hasV?"諛붿슦泥??덉쓬":"諛붿슦泥?}
                </button>
              </div>
              {/* Voucher panel */}
              {openV[wp.id] && (
                <div style={{marginTop:12,marginLeft:39,padding:"14px",background:"#FFFDF5",borderRadius:12,border:"1px solid #FBD38D"}}>
                  <div style={{fontSize:12,color:"#8A6B3E",fontWeight:700,marginBottom:10}}>?뱨 諛붿슦泥?/ ?덉빟?뺤씤??/div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                    <label style={{...W.btn,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
                      ?뱞 ?뚯씪 泥⑤? (PDF/?대?吏)
                      <input type="file" accept="image/*,.pdf" hidden onChange={e=>handleFile(wp.id,e)}/>
                    </label>
                    {wp.voucher?.file && (
                      <a href={wp.voucher.file} download={wp.voucher.fileName}
                        style={{...W.btn,color:"#38A169",border:"1px solid #C6F6D5",background:"#F0FFF4",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
                        ??{(wp.voucher.fileName||"").slice(0,22)}
                      </a>
                    )}
                  </div>
                  <div style={{position:"relative"}}>
                    <input type="url" value={safeStr(wp.voucher?.url)}
                      onChange={e=>updateWp(wp.id,{voucher:{...(wp.voucher||{}),url:e.target.value}})}
                      placeholder="?덉빟 ?뺤씤 留곹겕 (https://...)"
                      style={{paddingRight:wp.voucher?.url?"68px":"16px"}}/>
                    {wp.voucher?.url && (
                      <a href={wp.voucher.url} target="_blank" rel="noopener noreferrer"
                        style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#8A6B3E",fontWeight:700,textDecoration:"none",background:"#FFF5EB",padding:"4px 8px",borderRadius:7}}>
                        ?닿린 ??                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ?? Transport connector ?? */}
            {i < waypoints.length-1 && (
              <div style={{display:"flex",marginLeft:15}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:14,flexShrink:0}}>
                  <div style={{width:2,flex:1,background:"linear-gradient(to bottom,#E2E8F0,#C8A97E)",minHeight:10}}/>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#C8A97E",margin:"3px 0",flexShrink:0}}/>
                  <div style={{width:2,flex:1,background:"linear-gradient(to bottom,#C8A97E,#E2E8F0)",minHeight:10}}/>
                </div>
                <div style={{flex:1,padding:"8px 0 8px 10px"}}>
                  <div style={{fontSize:10,color:"#B0BEC5",fontWeight:600,letterSpacing:.5,marginBottom:7,textTransform:"uppercase"}}>?대룞?섎떒 쨌 ?뚯슂?쒓컙</div>
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
        <button onClick={addWp} style={W.btn}>+ ?μ냼 異붽?</button>
        {valid.length>=1 && gmUrl && (
          <a href={gmUrl} target="_blank" rel="noopener noreferrer"
            style={{...W.mapBtn,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}}>
            ?뿺 援ш?留듭쑝濡?蹂닿린
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

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??   MAIN APP
?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??*/
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

        /* Time input ??compact, no global padding overflow */
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
            <div style={{fontSize:52,opacity:.35}}>??/div>
            <div style={{fontSize:16,fontWeight:500}}>?쇱そ 紐⑸줉?먯꽌 ?ы뻾???좏깮?섍굅??異붽??댁＜?몄슂</div>
          </div>
        )}
      </div>
      {modal && <NewTripModal onClose={()=>setModal(false)} onCreate={t=>{setTrips(p=>[t,...p]);setModal(false);setST(t);setScreen("trip");}}/>}
    </div>
  );
}

/* ?? HOME ?????????????????????????????????????????????????????????????????? */
function HomeScreen({ trips, stats, onSelect, onNew }) {
  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      {/* Hero header */}
      <div style={{background:"linear-gradient(160deg,#2D1B0E 0%,#6B4C2A 60%,#A88653 100%)",padding:"40px 24px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",bottom:-20,left:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:700,color:"#FFF",letterSpacing:.5,lineHeight:1.1}}>Wanderlog</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:5,letterSpacing:.5}}>?섎쭔???꾨━誘몄뾼 ?ы뻾 湲곕줉</div>
          <button style={{marginTop:20,background:"rgba(255,255,255,.15)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.3)",color:"#FFF",borderRadius:12,padding:"10px 20px",fontWeight:600,fontSize:14,cursor:"pointer"}} className="tbtn" onClick={onNew}>
            + ???ы뻾 ?쒖옉
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats.days > 0 && (
        <div style={{display:"flex",gap:0,borderBottom:"1px solid #F0EDE8",background:"#FFF"}}>
          {[{v:trips.length,l:"?ы뻾",i:"??},{v:stats.days,l:"湲곕줉??,i:"?뱟"},{v:stats.places,l:"諛⑸Ц吏",i:"?뱧"}].map((x,idx)=>(
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
            <div style={{fontSize:40,marginBottom:14,opacity:.7}}>?㎡</div>
            <div style={{fontSize:17,fontWeight:600,color:"#2D3748",marginBottom:6}}>泥??ы뻾??湲곕줉?대낫?몄슂</div>
            <div style={{fontSize:13,color:"#A0AEC0",lineHeight:1.6}}>?뚯쨷??異붿뼲???꾨쫫?듦쾶 蹂닿????쒕┰?덈떎</div>
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
                    <div style={{position:"absolute",top:12,right:12,fontSize:28,filter:"drop-shadow(0 2px 6px rgba(0,0,0,.4))"}}>{t.flag||"??}</div>
                    <div style={{position:"absolute",bottom:14,left:18,right:18}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:700,color:"#FFF",lineHeight:1.2,textShadow:"0 1px 8px rgba(0,0,0,.5)"}}>{t.title}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,.8)",marginTop:4,display:"flex",gap:12,alignItems:"center"}}>
                        <span>{fmtShort(t.startDate)} ??{fmtShort(t.endDate)}</span>
                        <span style={{opacity:.6}}>쨌</span>
                        <span>{days}??/span>
                        {places.length>0 && <><span style={{opacity:.6}}>쨌</span><span>{places.length}怨?/span></>}
                      </div>
                    </div>
                  </div>
                  {places.length>0 && (
                    <div style={{padding:"10px 16px 12px",display:"flex",flexWrap:"wrap",gap:5}}>
                      {places.slice(0,4).map(p=><span key={p} style={{fontSize:11,color:"#718096",background:"#F7F5F2",padding:"3px 9px",borderRadius:8,border:"1px solid #EDE9E3"}}>{p}</span>)}
                      {places.length>4 && <span style={{fontSize:11,color:"#A0AEC0",padding:"3px 6px"}}>+{places.length-4}怨?/span>}
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

/* ?? TRIP SCREEN ??????????????????????????????????????????????????????????? */
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
          <button style={S.glassBtn} className="tbtn mobile-back-btn" onClick={onBack}>???ㅻ줈</button>
          <div style={{display:"flex",gap:8}}>
            <label style={S.glassBtn} className="tbtn">
              ?벜 而ㅻ쾭
              <input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>onUpdate({...trip,coverImage:ev.target.result});r.readAsDataURL(f);}}/>
            </label>
            <button style={{...S.glassBtn,color:"#FCA5A5"}} className="tbtn" onClick={()=>{if(confirm("??젣?좉퉴??"))onDelete(trip.id)}}>??젣</button>
          </div>
        </div>
        <div style={{position:"absolute",bottom:20,left:22,right:22,zIndex:5}}>
          <div style={{fontSize:44,marginBottom:6,filter:"drop-shadow(0 3px 8px rgba(0,0,0,.4))"}}>{trip.flag||"??}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"#FFF",textShadow:"0 2px 12px rgba(0,0,0,.6)",lineHeight:1.2}}>{trip.title}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.8)",marginTop:5,fontWeight:400}}>{trip.country} 쨌 {fmtDate(trip.startDate)} ??{fmtDate(trip.endDate)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid #F0EDE8",padding:"0 8px",position:"sticky",top:0,background:"rgba(255,255,255,.97)",backdropFilter:"blur(14px)",zIndex:20,overflowX:"auto"}}>
        {[["timeline","??꾨씪??],["map","?꾩껜 吏??],["photos","?ъ쭊"]].map(([id,lbl])=>(
          <button key={id} style={{padding:"15px 16px",fontSize:13.5,fontWeight:600,color:tab===id?"#8A6B3E":"#B0BEC5",background:"none",border:"none",cursor:"pointer",borderBottom:`2.5px solid ${tab===id?"#8A6B3E":"transparent"}`,transition:"all .18s",whiteSpace:"nowrap"}} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={{padding:"20px 20px 0"}}>
        {tab==="timeline" && <div className="fade-up">{safeArr(trip.days).map((d,i)=><DayRow key={d.date} day={d} index={i} total={trip.days.length} onClick={()=>onSelectDay(d)}/>)}</div>}

        {tab==="map" && (
          <div className="fade-up" style={{textAlign:"center",padding:"40px 16px"}}>
            <div style={{fontSize:52,marginBottom:14}}>?뿺</div>
            <div style={{fontSize:18,fontWeight:700,color:"#2D3748",marginBottom:8,fontFamily:"'Cormorant Garamond',serif"}}>?꾩껜 ?ы뻾 ?숈꽑</div>
            <div style={{fontSize:13,color:"#A0AEC0",lineHeight:1.7,marginBottom:24}}>?낅젰???μ냼 {allWps.length}怨녹쓣 援ш?留듭뿉???뺤씤?섏꽭??<br/>?좎쭨蹂??쇱??먯꽌 ?μ냼瑜?異붽??????덉뒿?덈떎.</div>
            {gmUrl ? (
              <a href={gmUrl} target="_blank" rel="noopener noreferrer" style={{...S.btnPrimary,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8}}>
                ?뿺 援ш?留듭뿉??蹂닿린
              </a>
            ) : <div style={{color:"#C0C8D0",fontSize:13}}>?좎쭨蹂??쇱??먯꽌 ?μ냼瑜?異붽??섎㈃<br/>?꾩껜 ?숈꽑??援ш?留듭쑝濡?蹂????덉뒿?덈떎.</div>}
            {allWps.length>0 && (
              <div style={{marginTop:24,display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center"}}>
                {allWps.map((w,i)=><span key={i} style={{fontSize:12,color:"#6B7A8D",background:"#F7F5F2",padding:"5px 11px",borderRadius:10,border:"1px solid #EDE9E3"}}>{w.icon||"?뱧"} {w.name}</span>)}
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
                      {w.icon||"?뱧"} {w.name}
                      {w.time && <span style={{color:"#B0BEC5",fontSize:10}}> {w.time}</span>}
                      {(w.voucher?.fileName||w.voucher?.url) && <span style={{color:"#C8A97E",fontSize:10}}>?뱨</span>}
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
          {day.diary && <div style={{fontSize:13,color:"#8A9BB0",lineHeight:1.6,background:"#FAFAFA",padding:"9px 11px",borderRadius:10,fontStyle:"italic",marginTop:4}}>&ldquo;{day.diary.slice(0,65)}{day.diary.length>65?"??:""}&rdquo;</div>}
          {safeArr(day.photos).length>0 && (
            <div style={{display:"flex",gap:5,marginTop:10}}>
              {day.photos.slice(0,4).map((p,i)=><div key={i} style={{width:44,height:44,borderRadius:10,backgroundSize:"cover",backgroundPosition:"center",backgroundImage:`url(${p})`,border:"1px solid #EDE9E3"}}/>)}
              {day.photos.length>4 && <div style={{width:44,height:44,borderRadius:10,background:"#F7F5F2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#A0AEC0",border:"1px solid #EDE9E3"}}>+{day.photos.length-4}</div>}
            </div>
          )}
        </div>
        {!day.diary && !wps.length && !safeArr(day.photos).length && (
          <div style={{padding:"0 16px 14px",fontSize:12,color:"#C0C8D0",fontStyle:"italic"}}>??빐??湲곕줉 異붽??섍린...</div>
        )}
      </div>
    </div>
  );
}

function PhotosTab({ photos }) {
  const [prev, setPrev] = useState(null);
  if (!safeArr(photos).length) return <div style={{textAlign:"center",padding:"56px 0",color:"#C0C8D0",fontSize:14}}>?깅줉???ъ쭊???놁뒿?덈떎.</div>;
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:10}}>
        {photos.map((p,i)=><div key={i} style={{aspectRatio:"1",borderRadius:14,backgroundSize:"cover",backgroundPosition:"center",backgroundImage:`url(${p})`,cursor:"pointer",boxShadow:"0 3px 10px rgba(0,0,0,.07)"}} onClick={()=>setPrev(p)}/>)}
      </div>
      {prev && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,cursor:"pointer"}} onClick={()=>setPrev(null)}><img src={prev} style={{maxWidth:"92vw",maxHeight:"86vh",borderRadius:16,boxShadow:"0 28px 60px rgba(0,0,0,.7)"}} alt=""/></div>}
    </div>
  );
}

/* ?? DAY SCREEN ???????????????????????????????????????????????????????????? */
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
        <button style={S.iconBtn} className="tbtn" onClick={onBack}>??/button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,color:"#B0BEC5",fontWeight:600,letterSpacing:.8}}>DAY {idx+1}</div>
          <div style={{fontSize:15,fontWeight:700,color:"#1A202C"}}>{fmtDate(day.date)}</div>
        </div>
        <button style={{...S.btnPrimary,padding:"10px 20px",fontSize:14,...(saved?{background:"#48BB78",boxShadow:"0 4px 12px rgba(72,187,120,.3)"}:{})}} className="tbtn" onClick={save}>
          {saved?"???꾨즺":"???}
        </button>
      </div>

      <div style={{padding:"20px 20px 0"}}>

        {/* Waypoints */}
        <div style={S.secBox}>
          <div style={S.secTitle}>?뱧 ?쇱젙 & ?숈꽑</div>
          <WaypointsEditor waypoints={wps} onChange={setWps}/>
        </div>

        {/* Expenses */}
        <div style={S.secBox}>
          <div style={S.secTitle}>?뮥 吏異??댁뿭</div>
          <div style={{background:"#FAFAF8",padding:"16px",borderRadius:16,marginBottom:14,border:"1px solid #F0EDE8"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={S.label}>移댄뀒怨좊━</label>
                <select value={newExp.category} onChange={e=>setNewExp({...newExp,category:e.target.value})}>
                  {EXP_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>寃곗젣 ?섎떒</label>
                <select value={newExp.method} onChange={e=>setNewExp({...newExp,method:e.target.value})}>
                  {PAYMENT_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <select value={newExp.currency} onChange={e=>setNewExp({...newExp,currency:e.target.value})} style={{width:88,padding:"12px 6px"}}>
                {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="湲덉븸" value={newExp.amount} onChange={e=>setNewExp({...newExp,amount:e.target.value})} style={{flex:1}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <input type="text" placeholder="硫붾え (?? ?쇰찘吏? 吏?섏쿋)" value={newExp.memo} onChange={e=>setNewExp({...newExp,memo:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addExp()} style={{flex:1}}/>
              <button onClick={addExp} style={{...S.btnPrimary,padding:"0 20px",height:50,flexShrink:0}}>異붽?</button>
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
                    <button onClick={()=>setExps(exps.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",color:"#FC8181",cursor:"pointer",fontSize:16,padding:"2px"}}>??/button>
                  </div>
                );
              })}
            </div>
          ) : <div style={{textAlign:"center",padding:"16px",color:"#C0C8D0",fontSize:13}}>吏異??댁뿭???놁뒿?덈떎.</div>}
        </div>

        {/* Diary */}
        <div style={S.secBox}>
          <div style={S.secTitle}>???ы뻾 ?명듃</div>
          <textarea value={diary} onChange={e=>setDiary(e.target.value)} placeholder="?ㅻ뒛 ?대뼡 硫뗭쭊 ?쒓컙?ㅼ씠 ?덉뿀?섏슂?" style={{minHeight:140,lineHeight:1.7,fontSize:14,resize:"vertical"}}/>
          {diary.length>0 && <div style={{textAlign:"right",fontSize:11,color:"#C0C8D0",marginTop:4}}>{diary.length}??/div>}
        </div>

        {/* Photos */}
        <div style={S.secBox}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={S.secTitle} style={{margin:0}}>?벜 ?ъ쭊</div>
            <label style={{...W.btn,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}} className="tbtn">
              + ?ъ쭊 異붽?
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
            </label>
          </div>
          {photos.length>0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {photos.map((p,i)=>(
                <div key={i} style={{position:"relative",aspectRatio:"1",borderRadius:14,backgroundImage:`url(${p})`,backgroundSize:"cover",backgroundPosition:"center",boxShadow:"0 3px 10px rgba(0,0,0,.08)"}}>
                  <button style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.55)",color:"#FFF",border:"none",width:22,height:22,borderRadius:"50%",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))}>??/button>
                </div>
              ))}
            </div>
          ) : (
            <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"28px",background:"#FAFAF8",borderRadius:16,border:"1.5px dashed #D4C4A8",cursor:"pointer"}}>
              <span style={{fontSize:28,opacity:.35}}>?벜</span>
              <span style={{fontSize:13,color:"#C0C8D0"}}>??빐???ъ쭊 異붽?</span>
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
            </label>
          )}
        </div>
      </div>

      {/* Floating save */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:560,padding:"10px 20px 22px",background:"linear-gradient(to top,rgba(255,255,255,1) 60%,transparent)",zIndex:30,pointerEvents:"none"}}>
        <button style={{...S.btnPrimary,width:"100%",padding:"16px",fontSize:16,borderRadius:16,pointerEvents:"all",...(saved?{background:"#48BB78",boxShadow:"0 6px 20px rgba(72,187,120,.3)"}:{})}} className="tbtn" onClick={save}>
          {saved?"????μ셿猷?:"??ν븯湲?}
        </button>
      </div>
    </div>
  );
}

/* ?? NEW TRIP MODAL ???????????????????????????????????????????????????????? */
function NewTripModal({ onClose, onCreate }) {
  const [form, setForm] = useState({title:"",country:"",flag:"",startDate:"",endDate:"",currency:"KRW",gradient:GRADIENTS[0]});
  const valid = form.title && form.startDate && form.endDate && new Date(form.endDate)>=new Date(form.startDate);
  const dc = valid ? dateRange(form.startDate,form.endDate).length : 0;

  const handleCountry = v => { const af=guessFlag(v); setForm({...form,country:v,flag:af||form.flag}); };
  const create = () => {
    if (!valid) return;
    onCreate({id:uid(),...form,flag:form.flag||"??,days:dateRange(form.startDate,form.endDate).map(date=>({date,waypoints:[newWaypoint()],diary:"",photos:[],expenses:[]}))});
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,padding:0}}>
      <div style={{background:"#FFF",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:560,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 -16px 60px rgba(0,0,0,.15)"}} className="fade-up">
        {/* Handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0"}}>
          <div style={{width:40,height:4,borderRadius:2,background:"#E2E8F0"}}/>
        </div>
        <div style={{padding:"14px 22px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#1A202C"}}>???ы뻾 ?쒖옉?섍린</div>
          <button style={{...S.iconBtn,background:"transparent",border:"none"}} onClick={onClose}>??/button>
        </div>
        <div style={{padding:"8px 22px 0",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={S.label}>?ы뻾 ?쒕ぉ *</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="?꾩퓙 踰싰퐙 ?ы뻾 2025"/>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <label style={S.label}>
                援??
                {guessFlag(form.country) && <span style={{color:"#48BB78",fontSize:10,marginLeft:5}}>?먮룞 {guessFlag(form.country)}</span>}
              </label>
              <input value={form.country} onChange={e=>handleCountry(e.target.value)} placeholder="?쇰낯, Japan, Thailand..."/>
            </div>
            <div style={{width:76}}>
              <label style={S.label}>援?린</label>
              <input value={form.flag} onChange={e=>setForm({...form,flag:e.target.value})} style={{textAlign:"center",fontSize:22,padding:"8px 4px"}} placeholder="?눓?눝"/>
            </div>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}><label style={S.label}>?쒖옉??*</label><input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></div>
            <div style={{flex:1}}><label style={S.label}>醫낅즺??*</label><input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></div>
          </div>
          {dc>0 && <div style={{fontSize:12,color:"#8A6B3E",fontWeight:600,textAlign:"right",marginTop:-6}}>??{dc}???ы뻾</div>}
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{flex:1}}><label style={S.label}>湲곕낯 ?듯솕</label><select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}>{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div style={{flex:2}}>
              <label style={S.label}>?뚮쭏 ?됱긽</label>
              <div style={{display:"flex",gap:8,marginTop:6}}>{GRADIENTS.map((g,i)=><div key={i} style={{width:36,height:36,borderRadius:10,background:g,cursor:"pointer",border:form.gradient===g?"3px solid #8A6B3E":"3px solid transparent",transition:"border .12s"}} onClick={()=>setForm({...form,gradient:g})}/>)}</div>
            </div>
          </div>
        </div>
        <div style={{padding:"16px 22px 28px",display:"flex",gap:10,borderTop:"1px solid #F0EDE8",marginTop:14}}>
          <button style={{flex:1,padding:"14px",borderRadius:13,border:"none",background:"#F3F0EB",color:"#6B7280",fontWeight:600,fontSize:15,cursor:"pointer"}} onClick={onClose}>痍⑥냼</button>
          <button style={{flex:2,...S.btnPrimary,padding:"14px",borderRadius:13,fontSize:15,opacity:valid?1:.45,cursor:valid?"pointer":"not-allowed"}} className={valid?"tbtn":""} onClick={create}>?ы뻾 留뚮뱾湲???/button>
        </div>
      </div>
    </div>
  );
}

/* ?? Styles ???????????????????????????????????????????????????????????????? */
const S = {
  btnPrimary: {background:"linear-gradient(135deg,#B8935A,#8A6B3E)",color:"#FFF",border:"none",borderRadius:13,padding:"12px 22px",fontWeight:700,fontSize:15,boxShadow:"0 6px 18px rgba(138,107,62,.28)",cursor:"pointer"},
  glassBtn:   {background:"rgba(255,255,255,.22)",backdropFilter:"blur(14px)",border:"1px solid rgba(255,255,255,.38)",color:"#FFF",borderRadius:11,padding:"8px 15px",fontWeight:600,fontSize:13,cursor:"pointer"},
  iconBtn:    {background:"#F7F5F2",border:"1px solid #EDE9E3",width:38,height:38,borderRadius:11,color:"#4A5568",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  secBox:     {marginBottom:18,background:"#FFF",padding:"20px",borderRadius:20,border:"1px solid #F0EDE8",boxShadow:"0 2px 16px rgba(0,0,0,.03)"},
  secTitle:   {fontSize:14,fontWeight:700,color:"#1A202C",marginBottom:14,display:"block"},
  label:      {fontSize:11.5,fontWeight:600,color:"#8A9BB0",marginBottom:5,display:"block",letterSpacing:.2},
};
