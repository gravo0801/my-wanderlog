import { useState, useEffect, useRef, useCallback } from "react";

/* ── Storage (Browser LocalStorage) ──────────────────────────────────────── */
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
  {id:"taxi",     label:"택시",    icon:"🚕"},
  {id:"walking",  label:"도보",    icon:"🚶"},
  {id:"flight",   label:"항공",    icon:"✈️"},
  {id:"train",    label:"기차",    icon:"🚄"},
];
const GRADIENTS = [
  "linear-gradient(135deg,#0c2340,#1a3a5c)",
  "linear-gradient(135deg,#1b3a2e,#2d5a46)",
  "linear-gradient(135deg,#2d1b4e,#4a2d7a)",
  "linear-gradient(135deg,#4a1c00,#7a3010)",
];

const FLAG_MAP = {"태국":"🇹🇭","일본":"🇯🇵","한국":"🇰🇷","미국":"🇺🇸","베트남":"🇻🇳"};
const guessFlag = c => (FLAG_MAP[c] || "🌏");

/* ── Components ─────────────────────────────────────────────────────────── */

function WaypointsEditor({ waypoints, onChange }) {
  const addWp = () => onChange([...waypoints, {id:uid(), name:"", time:"", transport:"transit"}]);
  const updateWp = (id, patch) => onChange(waypoints.map(w => w.id===id ? {...w,...patch} : w));

  return (
    <div style={S.sec}>
      <div style={S.secLbl}>📍 오늘의 동선</div>
      {waypoints.map((wp, i) => (
        <div key={wp.id} style={{display:"flex", gap:8, marginBottom:10, alignItems:"center"}}>
          <div style={S.numBadge}>{i+1}</div>
          <input value={wp.name} onChange={e=>updateWp(wp.id, {name:e.target.value})} placeholder="출발지 / 장소 입력..." style={{flex:1}}/>
          <input type="time" value={wp.time} onChange={e=>updateWp(wp.id, {time:e.target.value})} style={{width:100}}/>
        </div>
      ))}
      <button onClick={addWp} style={C.btnAddSmall}>+ 장소 추가</button>
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

  // 통계 계산
  const stats = {
    countries: new Set(trips.map(t=>t.country)).size,
    places: trips.reduce((a,t)=> a + safeArr(t.days).reduce((da, d)=> da + safeArr(d.waypoints).filter(w=>w.name).length, 0), 0),
    days: trips.reduce((a,t)=> a + safeArr(t.days).length, 0)
  };

  if (!loaded) return <div style={S.loading}>불러오는 중...</div>;

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
        * { box-sizing: border-box; font-family: 'DM Sans', sans-serif; }
        input, textarea, select { background: #1A2637; border: 1px solid #323F52; color: #F5ECD7; padding: 12px; border-radius: 10px; outline: none; }
        input:focus { border-color: #D4A853; }
        button { cursor: pointer; border: none; transition: 0.2s; }
        button:active { transform: scale(0.98); }
      `}</style>

      {screen === "home" && (
        <div style={S.screen}>
          <div style={S.header}>
            <div style={S.logoMark}>★</div>
            <div>
              <h1 style={S.logoText}>WANDERLOG</h1>
              <p style={S.logoSub}>나만의 여행 아카이브</p>
            </div>
          </div>

          <div style={S.statsRow}>
            <div style={S.statCard}><span>🌍</span><h3>{stats.countries}</h3><p>방문 국가</p></div>
            <div style={S.statCard}><span>📍</span><h3>{stats.places}</h3><p>방문 장소</p></div>
            <div style={S.statCard}><span>📅</span><h3>{stats.days}</h3><p>여행 일수</p></div>
          </div>

          <div style={S.row}>
            <h2 style={S.secTitle}>여행 기록</h2>
            <button style={S.goldBtn} onClick={()=>setModal(true)}>+ 새 여행</button>
          </div>

          {trips.map(t => (
            <div key={t.id} onClick={()=>{setST(t); setScreen("trip");}} style={{...S.tripCard, background: t.gradient}}>
              <div style={S.cardBadge}>{t.country === "태국" ? "TH" : "JP"}</div>
              <h3 style={S.cardTitle}>{t.startDate.split('-')[0]} {t.title}</h3>
              <p style={S.cardDate}>{fmtShort(t.startDate)} — {fmtShort(t.endDate)}</p>
              <div style={S.cardFooter}>📅 {safeArr(t.days).length}일</div>
            </div>
          ))}
        </div>
      )}

      {screen === "trip" && selTrip && (
        <div style={S.screen}>
          <button onClick={()=>setScreen("home")} style={S.backBtn}>←</button>
          <h2 style={{margin: "20px 0"}}>{selTrip.title}</h2>
          {selTrip.days.map((d, i) => (
            <div key={d.date} onClick={()=>{setSD(d); setScreen("day");}} style={S.dayRow}>
              <span>DAY {i+1}</span>
              <span>{fmtDate(d.date)}</span>
              <span>→</span>
            </div>
          ))}
        </div>
      )}

      {screen === "day" && selDay && (
        <div style={S.screen}>
          <div style={S.topBar}>
            <button onClick={()=>setScreen("trip")} style={S.backBtn}>←</button>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:10, color:"#D4A853"}}>DAY {selTrip.days.findIndex(d=>d.date===selDay.date)+1}</p>
              <p>{fmtDate(selDay.date)}</p>
            </div>
            <button style={S.goldBtnSmall} onClick={()=>{
              const newTrip = {...selTrip, days: selTrip.days.map(d=>d.date===selDay.date ? selDay : d)};
              updateTrip(newTrip);
              alert("저장되었습니다.");
            }}>저장</button>
          </div>

          <WaypointsEditor waypoints={safeArr(selDay.waypoints)} onChange={wps => setSD({...selDay, waypoints:wps})} />

          <div style={S.sec}>
            <div style={S.secLbl}>✍️ 여행 일기</div>
            <textarea value={selDay.diary} onChange={e=>setSD({...selDay, diary:e.target.value})} style={{width:"100%", height:120}} placeholder="오늘의 추억을 기록해보세요..."/>
          </div>

          <div style={S.sec}>
            <div style={S.secLbl}>💰 지출</div>
            <div style={{display:"flex", gap:5, marginBottom:10}}>
                <select style={{flex:1}}><option>🍜 식비</option></select>
                <select style={{flex:1}}><option>{selTrip.currency || "THB"}</option></select>
            </div>
            <div style={{display:"flex", gap:5}}>
              <input placeholder="금액" type="number" style={{flex:1}} id="amt"/>
              <input placeholder="메모(선택)" style={{flex:2}} id="memo"/>
              <button style={S.goldBtnSmall} onClick={()=>{
                const a = document.getElementById('amt').value;
                const m = document.getElementById('memo').value;
                if(!a) return;
                setSD({...selDay, expenses: [...safeArr(selDay.expenses), {id:uid(), amount:a, memo:m}]});
              }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <h2>새 여행 등록</h2>
            <input placeholder="여행 제목" id="m-t" style={{width:"100%", marginBottom:10}}/>
            <input placeholder="국가 (태국, 일본 등)" id="m-c" style={{width:"100%", marginBottom:10}}/>
            <div style={{display:"flex", gap:10}}>
                <input type="date" id="m-s" style={{flex:1}}/>
                <input type="date" id="m-e" style={{flex:1}}/>
            </div>
            <div style={{display:"flex", gap:10, marginTop:20}}>
              <button onClick={()=>setModal(false)} style={{flex:1, background:"#323F52", color:"white", borderRadius:10}}>취소</button>
              <button onClick={()=>{
                const title = document.getElementById('m-t').value;
                const country = document.getElementById('m-c').value;
                const start = document.getElementById('m-s').value;
                const end = document.getElementById('m-e').value;
                const dates = dateRange(start, end);
                const newT = {
                  id: uid(), title, country, startDate: start, endDate: end, 
                  gradient: GRADIENTS[Math.floor(Math.random()*GRADIENTS.length)],
                  days: dates.map(d=>({date:d, waypoints:[{id:uid(), name:"", time:""}], expenses:[], diary:""}))
                };
                setTrips([newT, ...trips]); setModal(false);
              }} style={{...S.goldBtn, flex:1}}>생성</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  app: { background: "#080F1C", minHeight: "100vh", color: "#F5ECD7", paddingBottom: 50 },
  screen: { maxWidth: 500, margin: "0 auto", padding: "20px 15px" },
  header: { display: "flex", alignItems: "center", gap: 15, marginBottom: 30 },
  logoMark: { background: "#D4A853", color: "#080F1C", width: 40, height: 40, borderRadius: 10, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold" },
  logoText: { fontSize: 22, letterSpacing: 3 },
  logoSub: { fontSize: 10, color: "#D4A85380", letterSpacing: 1 },
  statsRow: { display: "flex", gap: 10, marginBottom: 30 },
  statCard: { flex: 1, background: "#111D2E", padding: 15, borderRadius: 15, textAlign: "center", border: "1px solid #ffffff05" },
  secTitle: { fontSize: 18, fontWeight: "bold" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  goldBtn: { background: "#D4A853", color: "#080F1C", padding: "10px 20px", borderRadius: 10, fontWeight: "bold" },
  goldBtnSmall: { background: "#D4A853", color: "#080F1C", padding: "5px 15px", borderRadius: 8, fontWeight: "bold" },
  tripCard: { padding: 25, borderRadius: 20, marginBottom: 15, position: "relative", cursor: "pointer", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" },
  cardBadge: { position: "absolute", top: 20, right: 20, fontSize: 18, fontWeight: "bold", opacity: 0.7 },
  cardTitle: { fontSize: 20, marginBottom: 5 },
  cardDate: { fontSize: 12, opacity: 0.6 },
  cardFooter: { marginTop: 15, fontSize: 12, background: "#00000033", display: "inline-block", padding: "4px 10px", borderRadius: 8 },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 },
  backBtn: { background: "#1A2637", color: "white", width: 35, height: 35, borderRadius: 10 },
  sec: { marginBottom: 30 },
  secLbl: { color: "#D4A853", fontSize: 12, fontWeight: "bold", marginBottom: 15, letterSpacing: 1 },
  numBadge: { background: "#D4A85322", color: "#D4A853", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems:"center", justifyContent:"center", fontSize:12 },
  dayRow: { background: "#111D2E", padding: 15, borderRadius: 12, marginBottom: 10, display: "flex", justifyContent: "space-between", cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#0F1B2D", padding: 30, borderRadius: 20, width: "90%", maxWidth: 400 }
};

const C = {
  btnAddSmall: { background: "none", border: "1px solid #D4A85344", color: "#D4A853", padding: "5px 12px", borderRadius: 8, fontSize: 12 }
};
