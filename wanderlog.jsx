import { useState, useEffect, useRef } from "react";

/* ── Storage & 데이터 구조 ────────────────────────────────────────────────── */
const STORAGE_KEY = "wl_trips_v3";
const storageSave = (trips) => localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
const storageLoad = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

/* ── 상수 및 설정 ────────────────────────────────────────────────────────── */
const FONTS = ["'Pretendard', sans-serif", "'Nanum Myeongjo', serif", "'Gowun Batang', serif"];
const CURRENCIES = { THB: 38.5, JPY: 8.9, USD: 1350, EUR: 1450, CNY: 185, KRW: 1 };
const EXP_CATS = [
  { id: "food", label: "식비", icon: "🍜" },
  { id: "trans", label: "교통", icon: "🚌" },
  { id: "hotel", label: "숙박", icon: "🏨" },
  { id: "play", label: "관광", icon: "🎭" },
  { id: "shop", label: "쇼핑", icon: "🛍️" }
];
const TRANSPORT = ["🚇 지하철", "🚌 버스", "🚕 택시", "🚗 자동차", "🚙 렌트카", "🚲 자전거", "✈️ 항공", "🚶 도보"];

export default function WanderLog() {
  const [trips, setTrips] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("home");
  const [selTrip, setST] = useState(null);
  const [selDay, setSD] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  const [font, setFont] = useState(FONTS[0]);
  const [bgImage, setBgImage] = useState(null);

  useEffect(() => { setTrips(storageLoad()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) storageSave(trips); }, [trips, loaded]);

  /* ── 기능 함수들 ────────────────────────────────────────────────────────── */
  const addTrip = (e) => {
    e.preventDefault();
    const title = e.target.title.value;
    const start = e.target.start.value;
    const end = e.target.end.value;
    const dates = [];
    let cur = new Date(start);
    while (cur <= new Date(end)) {
      dates.push({ 
        date: cur.toISOString().slice(0, 10), 
        waypoints: [{ id: Date.now(), name: "", time: "", trans: "도보" }], 
        expenses: [], 
        diary: "",
        photos: [] 
      });
      cur.setDate(cur.getDate() + 1);
    }
    const newT = { id: Date.now(), title, startDate: start, endDate: end, days: dates, currency: "THB" };
    setTrips([newT, ...trips]);
    setShowModal(false);
  };

  const updateDay = (patch) => {
    const newDay = { ...selDay, ...patch };
    const newTrip = { ...selTrip, days: selTrip.days.map(d => d.date === selDay.date ? newDay : d) };
    setST(newTrip);
    setSD(newDay);
    setTrips(trips.map(t => t.id === selTrip.id ? newTrip : t));
  };

  // 구글맵 경로 자동 생성 (입력된 모든 장소 연결)
  const openGoogleMaps = () => {
    const names = selDay.waypoints.map(w => w.name).filter(n => n.length > 0);
    if (names.length === 0) return alert("동선에 장소를 입력해주세요.");
    const url = names.length === 1 
      ? `https://www.google.com/maps/search/${encodeURIComponent(names[0])}`
      : `https://www.google.com/maps/dir/${names.map(n => encodeURIComponent(n)).join("/")}`;
    window.open(url, "_blank");
  };

  if (!loaded) return null;

  return (
    <div style={{ fontFamily: font, backgroundColor: "#F9FAFB", minHeight: "100vh", color: "#333" }}>
      {bgImage && <div style={{ position: "fixed", inset: 0, backgroundImage: `url(${bgImage})`, backgroundSize: "cover", opacity: 0.1, pointerEvents: "none" }} />}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto", padding: "30px 20px" }}>
        
        {/* 상단 설정 */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}>
          <select onChange={(e) => setFont(e.target.value)} style={S.miniSelect}>
            {FONTS.map(f => <option key={f} value={f}>{f.split("'")[1]}</option>)}
          </select>
          <label style={S.miniBtn}>🖼️ 배경 사진 <input type="file" hidden onChange={(e) => {
            const reader = new FileReader();
            reader.onload = (ev) => setBgImage(ev.target.result);
            reader.readAsDataURL(e.target.files[0]);
          }} /></label>
        </div>

        {screen === "home" && (
          <div>
            <h1 style={{ color: "#D4A853", marginBottom: 20 }}>WANDERLOG</h1>
            <button style={S.mainBtn} onClick={() => setShowModal(true)}>+ 새 여행 계획하기</button>
            {trips.map(t => (
              <div key={t.id} onClick={() => { setST(t); setScreen("trip"); }} style={S.card}>
                <h3>{t.title}</h3>
                <p style={{ fontSize: 13, opacity: 0.5 }}>{t.startDate} ~ {t.endDate}</p>
              </div>
            ))}
          </div>
        )}

        {screen === "trip" && (
          <div>
            <button onClick={() => setScreen("home")} style={S.backBtn}>← 목록</button>
            <h2 style={{ margin: "20px 0" }}>{selTrip.title}</h2>
            {selTrip.days.map((d, i) => (
              <div key={d.date} onClick={() => { setSD(d); setScreen("day"); }} style={S.dayRow}>
                <span>DAY {i + 1}</span> <span>{d.date}</span>
              </div>
            ))}
          </div>
        )}

        {screen === "day" && (
          <div className="fade-in">
            <div style={S.topBar}>
              <button onClick={() => setScreen("trip")} style={S.backBtn}>←</button>
              <h3 style={{ fontSize: 16 }}>{selDay.date} 기록</h3>
              <button style={S.saveBtn} onClick={() => alert("자동 저장되었습니다.")}>저장</button>
            </div>

            {/* 오늘의 동선 (구글맵 연동) */}
            <section style={S.section}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
                <h4 style={S.secLabel}>📍 오늘의 동선</h4>
                <button style={S.mapLinkBtn} onClick={openGoogleMaps}>🗺️ 구글맵 경로보기</button>
              </div>
              {selDay.waypoints.map((wp, i) => (
                <div key={wp.id} style={{ marginBottom: 15 }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                    <div style={S.numBadge}>{i + 1}</div>
                    <input 
                      value={wp.name} 
                      onChange={(e) => {
                        const newWps = selDay.waypoints.map(w => w.id === wp.id ? { ...w, name: e.target.value } : w);
                        updateDay({ waypoints: newWps });
                      }} 
                      placeholder="장소를 입력하세요..." style={S.input}
                    />
                    <input type="time" value={wp.time} onChange={(e) => {
                      const newWps = selDay.waypoints.map(w => w.id === wp.id ? { ...w, time: e.target.value } : w);
                      updateDay({ waypoints: newWps });
                    }} style={{ width: 90 }} />
                  </div>
                  <select value={wp.trans} onChange={(e) => {
                    const newWps = selDay.waypoints.map(w => w.id === wp.id ? { ...w, trans: e.target.value } : w);
                    updateDay({ waypoints: newWps });
                  }} style={S.transSelect}>
                    {TRANSPORT.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ))}
              <button style={S.addBtn} onClick={() => updateDay({ waypoints: [...selDay.waypoints, { id: Date.now(), name: "", time: "", trans: "도보" }] })}>+ 장소 추가</button>
            </section>

            {/* 지출 내역 (환율 계산) */}
            <section style={S.section}>
              <h4 style={S.secLabel}>💰 지출 관리</h4>
              <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                <select id="e-cat" style={{ flex: 1 }}>{EXP_CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select>
                <select id="e-cur" style={{ flex: 1 }}><option value="THB">THB</option><option value="USD">USD</option><option value="KRW">KRW</option><option value="JPY">JPY</option></select>
                <input id="e-amt" type="number" placeholder="금액" style={{ flex: 1.5 }} />
                <button style={S.goldBtnSmall} onClick={() => {
                  const cat = document.getElementById('e-cat').value;
                  const cur = document.getElementById('e-cur').value;
                  const amt = document.getElementById('e-amt').value;
                  if (!amt) return;
                  const newExp = { id: Date.now(), cat, cur, amt: Number(amt), krw: amt * CURRENCIES[cur] };
                  updateDay({ expenses: [...selDay.expenses, newExp] });
                }}>추가</button>
              </div>
              {selDay.expenses.map(e => (
                <div key={e.id} style={S.expRow}>
                  <span>{EXP_CATS.find(c => c.id === e.cat).icon} {e.amt}{e.cur}</span>
                  <span style={{ fontSize: 11, opacity: 0.5 }}>≈ {Math.round(e.krw).toLocaleString()}원</span>
                </div>
              ))}
            </section>

            {/* 일기장 */}
            <section style={S.section}>
              <h4 style={S.secLabel}>✍️ 여행 일기</h4>
              <textarea 
                value={selDay.diary} 
                onChange={(e) => updateDay({ diary: e.target.value })} 
                placeholder="오늘의 기억을 기록하세요..." style={S.textarea} 
              />
            </section>

            {/* 사진 추가 */}
            <section style={S.section}>
              <h4 style={S.secLabel}>📷 사진 기록</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {selDay.photos?.map((p, i) => <img key={i} src={p} style={S.photoImg} alt="trip" />)}
                <label style={S.photoAddBtn}>+<input type="file" hidden onChange={(e) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => updateDay({ photos: [...(selDay.photos || []), ev.target.result] });
                  reader.readAsDataURL(e.target.files[0]);
                }} /></label>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* 여행 생성 모달 */}
      {showModal && (
        <div style={S.modalOverlay}>
          <form style={S.modal} onSubmit={addTrip}>
            <h3 style={{ marginBottom: 20 }}>새 여행 계획</h3>
            <input name="title" placeholder="여행 제목" style={S.input} required />
            <div style={{ display: "flex", gap: 10 }}>
              <input name="start" type="date" style={S.input} required />
              <input name="end" type="date" style={S.input} required />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
              <button type="button" onClick={() => setShowModal(false)} style={S.subBtn}>취소</button>
              <button type="submit" style={S.goldBtn}>시작하기</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ── UI Styles ───────────────────────────────────────────────────────────── */
const S = {
  mainBtn: { width: "100%", padding: 18, background: "#D4A853", color: "#fff", borderRadius: 15, fontWeight: "bold", marginBottom: 30 },
  card: { background: "#fff", padding: 25, borderRadius: 20, marginBottom: 15, border: "1px solid #eee", cursor: "pointer" },
  dayRow: { background: "#fff", padding: 18, borderRadius: 15, marginBottom: 10, display: "flex", justifyContent: "space-between", border: "1px solid #eee", cursor: "pointer" },
  section: { background: "#fff", padding: 20, borderRadius: 20, marginBottom: 20, border: "1px solid #eee" },
  secLabel: { fontSize: 12, fontWeight: "bold", color: "#D4A853", letterSpacing: 1 },
  input: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #eee", fontSize: 14 },
  textarea: { width: "100%", height: 120, padding: 12, borderRadius: 10, border: "1px solid #eee", marginTop: 10 },
  numBadge: { background: "#D4A853", color: "#fff", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 },
  addBtn: { width: "100%", padding: 10, background: "none", border: "1px dashed #D4A853", color: "#D4A853", borderRadius: 10, marginTop: 10 },
  goldBtnSmall: { background: "#D4A853", color: "#fff", padding: "0 15px", borderRadius: 10, fontWeight: "bold" },
  mapLinkBtn: { background: "#4285F4", color: "#fff", padding: "4px 12px", borderRadius: 8, fontSize: 11, border: "none" },
  expRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f5" },
  photoImg: { width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10 },
  photoAddBtn: { width: "100%", aspectRatio: "1", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#ccc", borderRadius: 10, cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", padding: 30, borderRadius: 25, width: "90%", maxWidth: 400 },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { background: "#eee", padding: "8px 15px", borderRadius: 10, border: "none" },
  saveBtn: { background: "#333", color: "#fff", padding: "8px 15px", borderRadius: 10 },
  miniSelect: { padding: "5px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12 },
  miniBtn: { background: "#eee", padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" },
  transSelect: { width: "100%", marginTop: 5, padding: "4px", fontSize: 11, background: "#f9f9f9", border: "none", borderRadius: 5 }
};
