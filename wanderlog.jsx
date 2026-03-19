import { useState, useEffect, useRef, useCallback } from "react";

/* ── Storage & Utilities ────────────────────────────────────────────────── */
const STORAGE_KEY = "wl_trips_final";
const storageSave = (trips) => localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
const storageLoad = () => {
  const r = localStorage.getItem(STORAGE_KEY);
  return r ? JSON.parse(r) : [];
};
const uid = () => Math.random().toString(36).slice(2, 10);
const dateRange = (s, e) => {
  const r = [], c = new Date(s), end = new Date(e);
  while (c <= end) { r.push(c.toISOString().slice(0, 10)); c.setDate(c.getDate() + 1); }
  return r;
};

/* ── Constants ───────────────────────────────────────────────────────────── */
const FONTS = ["'Pretendard', sans-serif", "'Nanum Myeongjo', serif", "'Gowun Batang', serif"];
const CURRENCIES = { THB: 38.5, JPY: 8.9, USD: 1350, EUR: 1450, CNY: 185, KRW: 1 };
const TRANSPORT = [
  { id: "subway", label: "지하철", icon: "🚇" },
  { id: "bus", label: "버스", icon: "🚌" },
  { id: "taxi", label: "택시", icon: "🚕" },
  { id: "car", label: "자동차", icon: "🚗" },
  { id: "flight", label: "항공", icon: "✈️" }
];

export default function WanderLog() {
  const [trips, setTrips] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("home");
  const [selTrip, setST] = useState(null);
  const [selDay, setSD] = useState(null);
  const [showModal, setShowModal] = useState(false); // 모달 상태 추가
  const [font, setFont] = useState(FONTS[0]);
  const [bgImage, setBgImage] = useState(null);

  useEffect(() => { setTrips(storageLoad()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) storageSave(trips); }, [trips, loaded]);

  // 여행 생성 함수 (먹통 해결 핵심)
  const createTrip = (e) => {
    e.preventDefault();
    const title = e.target.title.value;
    const start = e.target.start.value;
    const end = e.target.end.value;
    const country = e.target.country.value;

    if (!title || !start || !end) return alert("필수 정보를 입력해주세요!");

    const dates = dateRange(start, end);
    const newT = {
      id: uid(), title, country, startDate: start, endDate: end,
      days: dates.map(d => ({ date: d, waypoints: [{ id: uid(), name: "", transport: "walk" }], expenses: [], diary: "" }))
    };

    setTrips([newT, ...trips]);
    setShowModal(false);
  };

  if (!loaded) return <div style={{ padding: 50 }}>Loading...</div>;

  return (
    <div style={{ fontFamily: font, backgroundColor: "#FDFDFD", minHeight: "100vh", color: "#333", position: "relative" }}>
      {/* 옅은 배경 이미지 */}
      {bgImage && <div style={{ position: "fixed", inset: 0, backgroundImage: `url(${bgImage})`, backgroundSize: "cover", opacity: 0.15, pointerEvents: "none" }} />}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
        
        {/* 상단 설정 영역 */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}>
          <select onChange={(e) => setFont(e.target.value)} style={S.miniSelect}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <label style={S.miniBtn}>🖼️ 배경 설정 <input type="file" hidden onChange={(e) => {
            const reader = new FileReader();
            reader.onload = (ev) => setBgImage(ev.target.result);
            reader.readAsDataURL(e.target.files[0]);
          }} /></label>
        </div>

        {screen === "home" && (
          <div>
            <h1 style={{ color: "#D4A853", letterSpacing: "-1px", marginBottom: 10 }}>WANDERLOG</h1>
            <p style={{ opacity: 0.5, marginBottom: 30 }}>당신의 여행을 밝고 선명하게 기록합니다.</p>
            
            <button style={S.mainBtn} onClick={() => setShowModal(true)}>+ 새 여행 계획하기</button>

            {trips.map(t => (
              <div key={t.id} onClick={() => { setST(t); setScreen("trip"); }} style={S.tripCard}>
                <h3 style={{ margin: 0 }}>{t.title}</h3>
                <p style={{ fontSize: 13, opacity: 0.5 }}>{t.startDate} ~ {t.endDate}</p>
              </div>
            ))}
          </div>
        )}

        {screen === "trip" && selTrip && (
          <div>
            <button onClick={() => setScreen("home")} style={S.backBtn}>← 목록</button>
            <h2 style={{ margin: "20px 0" }}>{selTrip.title}</h2>
            {selTrip.days.map((d, i) => (
              <div key={d.date} onClick={() => { setSD(d); setScreen("day"); }} style={S.dayRow}>
                <span>Day {i + 1}</span> <span>{d.date}</span>
              </div>
            ))}
          </div>
        )}

        {screen === "day" && selDay && (
          <div>
            <button onClick={() => setScreen("trip")} style={S.backBtn}>← 뒤로</button>
            <h2 style={{ margin: "20px 0" }}>{selDay.date} 기록</h2>
            
            {/* 구글맵 연동 버튼 */}
            <button style={S.mapBtn} onClick={() => window.open(`https://www.google.com/maps/search/${selDay.waypoints[0]?.name || selTrip.title}`, "_blank")}>
              🗺️ 구글맵에서 동선 보기
            </button>

            <div style={S.section}>
              <h4 style={S.secLabel}>📍 오늘의 동선</h4>
              {selDay.waypoints.map((wp, i) => (
                <input key={wp.id} value={wp.name} onChange={(e) => {
                  const newWps = selDay.waypoints.map(w => w.id === wp.id ? { ...w, name: e.target.value } : w);
                  setSD({ ...selDay, waypoints: newWps });
                }} placeholder="장소 입력 시 자동 연동..." style={S.input} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 새 여행 등록 모달 (먹통 해결) */}
      {showModal && (
        <div style={S.modalOverlay}>
          <form style={S.modal} onSubmit={createTrip}>
            <h3 style={{ marginBottom: 20 }}>새 여행 정보 입력</h3>
            <input name="title" placeholder="여행 제목" style={S.input} required />
            <input name="country" placeholder="국가 (예: 태국)" style={S.input} />
            <div style={{ display: "flex", gap: 10 }}>
              <input name="start" type="date" style={S.input} required />
              <input name="end" type="date" style={S.input} required />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setShowModal(false)} style={S.subBtn}>취소</button>
              <button type="submit" style={S.goldBtn}>여행 시작</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const S = {
  mainBtn: { width: "100%", padding: 18, background: "#D4A853", color: "#fff", borderRadius: 15, fontWeight: "bold", fontSize: 16, marginBottom: 30, boxShadow: "0 4px 15px rgba(212,168,83,0.3)" },
  tripCard: { background: "#fff", padding: 25, borderRadius: 20, marginBottom: 15, border: "1px solid #eee", cursor: "pointer", transition: "0.2s" },
  dayRow: { background: "#fff", padding: 18, borderRadius: 15, marginBottom: 10, border: "1px solid #eee", display: "flex", justifyContent: "space-between", cursor: "pointer" },
  input: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", marginBottom: 10, fontSize: 14 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", padding: 30, borderRadius: 25, width: "90%", maxWidth: 400 },
  goldBtn: { flex: 1, padding: 12, background: "#D4A853", color: "#fff", borderRadius: 12, fontWeight: "bold" },
  subBtn: { flex: 1, padding: 12, background: "#eee", color: "#666", borderRadius: 12 },
  backBtn: { background: "#eee", padding: "8px 15px", borderRadius: 10, border: "none" },
  mapBtn: { width: "100%", padding: 14, background: "#4285F4", color: "#fff", borderRadius: 12, fontWeight: "bold", marginBottom: 20 },
  section: { background: "#fff", padding: 20, borderRadius: 20, border: "1px solid #eee", marginBottom: 20 },
  secLabel: { fontSize: 12, fontWeight: "bold", color: "#D4A853", marginBottom: 15, letterSpacing: 1 },
  miniSelect: { border: "1px solid #ddd", borderRadius: 8, padding: "5px 10px", fontSize: 12 },
  miniBtn: { background: "#eee", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }
};
