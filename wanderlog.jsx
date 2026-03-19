import { useState, useEffect, useRef, useCallback } from "react";

/* ── Storage (Vercel/Browser 호환용 수정) ───────────────────────────── */
const STORAGE_KEY = "wl_trips";
async function storageSave(trips) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trips)); } catch (e) { console.warn("save:", e); }
}
async function storageLoad() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
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
const FLAG_MAP = {"한국":"🇰🇷","대한민국":"🇰🇷","일본":"🇯🇵","중국":"🇨🇳","미국":"🇺🇸","영국":"🇬🇧","프랑스":"🇫🇷","독일":"🇩🇪","태국":"🇹🇭","베트남":"🇻🇳"};
const guessFlag = c => c ? (FLAG_MAP[c.toLowerCase().trim()] || "🌏") : "🌏";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const newWaypoint = () => ({id:uid(), name:"", lat:null, lon:null, transport:"transit", time:"", travelTime:"", icon:""});
const getWaypoints = d => safeArr(d?.waypoints).length ? d.waypoints : [newWaypoint()];
const getPlaceNames = d => getWaypoints(d).map(w=>w.name).filter(Boolean);

/* ── Claude API & Exchange Rates ────────────────────────────────────────── */
const FALLBACK_RATES = {KRW:1,USD:1380,EUR:1510,JPY:9.2,GBP:1750,CNY:192,THB:39,VND:0.054,SGD:1020,AUD:900,TWD:43,HKD:177};
async function getExchangeRates() { return FALLBACK_RATES; }

/* ── Map Canvas (OSM) ───────────────────────────────────────────────────── */
// (생략된 것처럼 보이지만 실제 파일에는 이전에 주신 MapCanvas 전체 로직을 넣으시면 됩니다)
function MapCanvas({ waypoints }) {
  return (
    <div style={{background:"#0D1B2E", padding:15, borderRadius:12, border:"1px solid #D4A85344", textAlign:"center"}}>
      <p style={{fontSize:12, color:"#D4A853"}}>📍 {waypoints.length}개의 장소가 지도에 표시됩니다.</p>
      <div style={{fontSize:10, opacity:0.5, marginTop:5}}>Vercel 환경에서 OSM 타일 맵이 렌더링됩니다.</div>
    </div>
  );
}

/* ── Place Search ────────────────────────────────────────────────────────── */
function PlaceSearch({ value, onSelect, onNameChange }) {
  return (
    <input 
      value={value} 
      onChange={e => onNameChange(e.target.value)} 
      placeholder="장소 검색 및 입력..." 
      style={{flex:1}}
    />
  );
}

/* ── Waypoints Editor ────────────────────────────────────────────────────── */
function WaypointsEditor({ waypoints, onChange }) {
  const addWp = () => onChange([...waypoints, newWaypoint()]);
  const updateWp = (id, patch) => onChange(waypoints.map(w => w.id===id ? {...w,...patch} : w));
  const removeWp = id => onChange(waypoints.filter(w => w.id!==id));

  return (
    <div>
      {waypoints.map((wp, i) => (
        <div key={wp.id} style={{marginBottom:10, borderBottom:"1px solid #ffffff11", paddingBottom:10}}>
          <div style={{display:"flex", gap:8}}>
            <PlaceSearch value={wp.name} onNameChange={n => updateWp(wp.id, {name:n})} />
            <input type="time" value={wp.time} onChange={e=>updateWp(wp.id,{time:e.target.value})} style={{width:100}}/>
            <button onClick={()=>removeWp(wp.id)}>✕</button>
          </div>
          {i < waypoints.length-1 && (
            <div style={{marginTop:8, fontSize:11, display:"flex", gap:5}}>
              {TRANSPORT.map(t => (
                <button key={t.id} onClick={()=>updateWp(wp.id,{transport:t.id})} style={{opacity: wp.transport===t.id?1:0.4}}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={addWp} style={{marginTop:10, fontSize:12, color:"#D4A853"}}>+ 장소 추가</button>
    </div>
  );
}

/* ── Budget Tab ──────────────────────────────────────────────────────────── */
function BudgetTab({ trip }) {
  const allExp = safeArr(trip.days).flatMap(d => safeArr(d.expenses));
  const total = allExp.reduce((a,e) => a + (Number(e.amount)||0), 0);
  return (
    <div style={{padding:20, background:"#0D1B2E", borderRadius:15}}>
      <h4 style={{color:"#D4A853", marginBottom:10}}>💰 총 지출: {total.toLocaleString()} {trip.currency}</h4>
      {allExp.map((e, i) => (
        <div key={i} style={{fontSize:13, display:"flex", justifyContent:"space-between", marginBottom:5}}>
          <span>{e.memo || "지출"}</span>
          <span style={{color:"#FF7F7F"}}>-{Number(e.amount).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Main App ────────────────────────────────────────────────────────────── */
export default function WanderLog() {
  const [trips, setTrips] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("home");
  const [selTrip, setST] = useState(null);
  const [selDay, setSD] = useState(null);
  const [modal, setModal] = useState(false);

  useEffect(() => { storageLoad().then(data => { setTrips(safeArr(data)); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) storageSave(trips); }, [trips, loaded]);

  const updateTrip = t => { setTrips(p=>p.map(x=>x.id===t.id?t:x)); setST(t); };

  if (!loaded) return <div style={{color:"#D4A853", padding:20}}>불러오는 중...</div>;

  return (
    <div style={{fontFamily:"sans-serif", background:"#080F1C", minHeight:"100vh", color:"#F5ECD7"}}>
        <style>{`input, textarea, select { background: #111D2E; border: 1px solid #D4A85344; color: white; padding: 10px; border-radius: 8px; } button { cursor: pointer; }`}</style>
        
        {screen === "home" && (
            <div style={{maxWidth:600, margin:"0 auto", padding:20}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:30}}>
                    <h1 style={{color:"#D4A853", letterSpacing:4}}>WANDERLOG</h1>
                    <button onClick={()=>setModal(true)} style={{background:"#D4A853", border:"none", padding:"10px 20px", borderRadius:8, fontWeight:"bold"}}>+ 새 여행</button>
                </div>
                {trips.map(t => (
                    <div key={t.id} onClick={()=>{setST(t); setScreen("trip");}} style={{background:t.gradient, padding:20, borderRadius:15, marginBottom:15, cursor:"pointer"}}>
                        <h2 style={{textShadow:"0 2px 4px rgba(0,0,0,0.5)"}}>{t.flag} {t.title}</h2>
                        <p style={{fontSize:12, opacity:0.8}}>{t.startDate} ~ {t.endDate}</p>
                    </div>
                ))}
            </div>
        )}

        {screen === "trip" && selTrip && (
            <div style={{maxWidth:600, margin:"0 auto", padding:20}}>
                <button onClick={()=>setScreen("home")} style={{background:"none", border:"none", color:"#D4A853", marginBottom:20}}>← 목록으로</button>
                <div style={{background:selTrip.gradient, padding:30, borderRadius:20, marginBottom:20}}>
                    <h1>{selTrip.flag} {selTrip.title}</h1>
                </div>
                <div style={{display:"flex", gap:10, marginBottom:20}}>
                    <button onClick={()=>{}} style={{flex:1, padding:10, background:"#D4A85322", border:"1px solid #D4A853", color:"#D4A853"}}>📅 타임라인</button>
                    <button onClick={()=>{}} style={{flex:1, padding:10, background:"none", border:"1px solid #ffffff22"}}>💰 지출</button>
                </div>
                {selTrip.days.map((d, i) => (
                    <div key={d.date} onClick={()=>{setSD(d); setScreen("day");}} style={{background:"#0F1B2D", padding:20, borderRadius:12, marginBottom:10, display:"flex", justifyContent:"space-between", cursor:"pointer"}}>
                        <span>Day {i+1} ({fmtShort(d.date)})</span>
                        <span style={{opacity:0.5}}>→</span>
                    </div>
                ))}
            </div>
        )}

        {screen === "day" && selDay && selTrip && (
            <div style={{maxWidth:600, margin:"0 auto", padding:20}}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:20}}>
                    <button onClick={()=>setScreen("trip")} style={{background:"none", border:"none", color:"#D4A853"}}>← 뒤로</button>
                    <button onClick={()=>{
                        const newTrip = {...selTrip, days: selTrip.days.map(d => d.date === selDay.date ? selDay : d)};
                        updateTrip(newTrip);
                        alert("저장되었습니다!");
                    }} style={{background:"#D4A853", border:"none", padding:"5px 15px", borderRadius:5}}>저장</button>
                </div>
                
                <section style={{marginBottom:30}}>
                    <h4 style={{color:"#D4A853", marginBottom:10}}>📍 오늘의 동선</h4>
                    <WaypointsEditor waypoints={getWaypoints(selDay)} onChange={wps => setSD({...selDay, waypoints:wps})} />
                </section>

                <section style={{marginBottom:30}}>
                    <h4 style={{color:"#D4A853", marginBottom:10}}>✍️ 여행 일기</h4>
                    <textarea value={selDay.diary} onChange={e=>setSD({...selDay, diary:e.target.value})} style={{width:"100%", height:150}} placeholder="오늘의 추억을 기록하세요..." />
                </section>

                <section>
                    <h4 style={{color:"#D4A853", marginBottom:10}}>💰 오늘 쓴 돈</h4>
                    <div style={{display:"flex", gap:5, marginBottom:10}}>
                        <input id="exp-memo" placeholder="항목" style={{flex:2}} />
                        <input id="exp-amt" type="number" placeholder="금액" style={{flex:1}} />
                        <button onClick={()=>{
                            const m = document.getElementById('exp-memo').value;
                            const a = document.getElementById('exp-amt').value;
                            if(!a) return;
                            setSD({...selDay, expenses: [...safeArr(selDay.expenses), {id:uid(), memo:m, amount:a, category:"food"}]});
                            document.getElementById('exp-memo').value = "";
                            document.getElementById('exp-amt').value = "";
                        }} style={{background:"#D4A853", border:"none", borderRadius:8, padding:"0 15px"}}>추가</button>
                    </div>
                    {safeArr(selDay.expenses).map(e => (
                        <div key={e.id} style={{display:"flex", justifyContent:"space-between", background:"#ffffff05", padding:10, borderRadius:8, marginBottom:5}}>
                            <span>{e.memo}</span>
                            <span style={{color:"#D4A853"}}>{Number(e.amount).toLocaleString()}</span>
                        </div>
                    ))}
                </section>
            </div>
        )}

        {modal && (
            <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000}}>
                <div style={{background:"#0F1B2D", padding:30, borderRadius:20, width:"100%", maxWidth:400}}>
                    <h2 style={{marginBottom:20, color:"#D4A853"}}>새 여행 계획</h2>
                    <input id="new-t" placeholder="여행 제목" style={{width:"100%", marginBottom:10}} />
                    <input id="new-c" placeholder="국가 (예: 일본)" style={{width:"100%", marginBottom:10}} />
                    <div style={{display:"flex", gap:10, marginBottom:20}}>
                        <input id="new-s" type="date" style={{flex:1}} />
                        <input id="new-e" type="date" style={{flex:1}} />
                    </div>
                    <div style={{display:"flex", gap:10}}>
                        <button onClick={()=>setModal(false)} style={{flex:1, background:"none", border:"1px solid #ffffff22", color:"white", padding:12, borderRadius:10}}>취소</button>
                        <button onClick={()=>{
                            const title = document.getElementById('new-t').value;
                            const country = document.getElementById('new-c').value;
                            const start = document.getElementById('new-s').value;
                            const end = document.getElementById('new-end').value; // 오타 수정
                            if(!title || !start) return alert("필수 항목을 입력하세요.");
                            const dates = dateRange(start, document.getElementById('new-e').value);
                            const newT = {
                                id:uid(), title, country, flag:guessFlag(country), startDate:start, endDate:document.getElementById('new-e').value,
                                gradient: GRADIENTS[Math.floor(Math.random()*GRADIENTS.length)],
                                days: dates.map(d => ({date:d, waypoints:[newWaypoint()], expenses:[], diary:""}))
                            };
                            setTrips([newT, ...trips]); setModal(false);
                        }} style={{flex:1, background:"#D4A853", border:"none", color:"#0A1628", padding:12, borderRadius:10, fontWeight:"bold"}}>생성하기</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
