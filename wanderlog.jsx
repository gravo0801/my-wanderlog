import { useState, useEffect, useRef, useCallback } from "react";

/* ── Storage & Essentials ────────────────────────────────────────────────── */
const STORAGE_KEY = "wl_trips_v2";
const storageSave = (trips) => localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
const storageLoad = () => {
  const r = localStorage.getItem(STORAGE_KEY);
  return r ? JSON.parse(r) : [];
};

/* ── Constants ───────────────────────────────────────────────────────────── */
const FONTS = ["'Pretendard', sans-serif", "'Nanum Myeongjo', serif", "'Gowun Batang', serif", "'IBM Plex Sans KR', sans-serif"];
const CURRENCIES = {
  THB: 38.5, JPY: 8.9, USD: 1350, EUR: 1450, CNY: 185, KRW: 1
};
const TRANSPORT = [
  {id:"subway", label:"전철/지하철", icon:"🚇"},
  {id:"bus", label:"버스", icon:"🚌"},
  {id:"taxi", label:"택시", icon:"🚕"},
  {id:"car", label:"자동차", icon:"🚗"},
  {id:"rental", label:"렌트카", icon:"🚙"},
  {id:"bike", label:"자전거", icon:"🚲"},
  {id:"flight", label:"항공", icon:"✈️"},
  {id:"walk", label:"도보", icon:"🚶"}
];

/* ── Main App Component ──────────────────────────────────────────────────── */
export default function WanderLog() {
  const [trips, setTrips] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState("home");
  const [selTrip, setST] = useState(null);
  const [selDay, setSD] = useState(null);
  
  // 사용자 설정 상태
  const [font, setFont] = useState(FONTS[0]);
  const [bgImage, setBgImage] = useState(null);

  useEffect(() => {
    const data = storageLoad();
    setTrips(data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) storageSave(trips);
  }, [trips, loaded]);

  // 배경 사진 불러오기 (내 컴퓨터)
  const handleBgUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setBgImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // 장소 자동완성 시뮬레이션 (실제 구현 시 Google Places API 연결 권장)
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const mockPlaces = ["에펠탑", "에펠탑 전망대", "루브르 박물관", "개선문", "샹젤리제 거리"];

  const handleSearch = (val) => {
    setSearchQuery(val);
    if (val.length > 0) {
      setSuggestions(mockPlaces.filter(p => p.includes(val)));
    } else {
      setSuggestions([]);
    }
  };

  if (!loaded) return <div style={{padding: 50}}>준비 중...</div>;

  return (
    <div style={{ 
      fontFamily: font, 
      backgroundColor: "#F8F9FA", // 밝은 계통 배경
      minHeight: "100vh",
      color: "#212529",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* 옅게 깔리는 배경 사진 */}
      {bgImage && (
        <div style={{
          position: "fixed", inset: 0, 
          backgroundImage: `url(${bgImage})`, 
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.1, zIndex: 0, pointerEvents: "none"
        }} />
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto", padding: 20 }}>
        
        {/* 설정 바 */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, fontSize: 12 }}>
          <select onChange={(e) => setFont(e.target.value)} style={S.miniSelect}>
            {FONTS.map(f => <option key={f} value={f}>{f.split("'")[1]}</option>)}
          </select>
          <label style={S.miniBtn}>
            🖼️ 배경 변경
            <input type="file" hidden onChange={handleBgUpload} />
          </label>
        </div>

        {screen === "home" && (
          <div className="fade-in">
            <header style={{ marginBottom: 30 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#D4A853" }}>WANDERLOG</h1>
              <p style={{ opacity: 0.6 }}>밝고 깨끗한 여행의 기록</p>
            </header>

            <button style={S.mainBtn} onClick={() => {/* 새 여행 생성 로직 */}}>+ 새 여행 계획하기</button>

            {trips.map(t => (
              <div key={t.id} onClick={() => { setST(t); setScreen("trip"); }} style={S.tripCard}>
                <div style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 20 }}>{t.title}</h3>
                  <p style={{ fontSize: 13, opacity: 0.5 }}>{t.startDate} ~ {t.endDate}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {screen === "day" && selDay && (
          <div className="fade-in">
            <button onClick={() => setScreen("trip")} style={S.backBtn}>←</button>
            <h2 style={{ marginBottom: 20 }}>{selDay.date} 기록</h2>

            {/* 오늘의 동선 & 자동완성 */}
            <section style={S.section}>
              <h4 style={S.secLabel}>📍 오늘의 동선</h4>
              <div style={{ position: "relative" }}>
                <input 
                  value={searchQuery} 
                  onChange={(e) => handleSearch(e.target.value)} 
                  placeholder="장소를 입력하세요 (예: 에펠...)"
                  style={S.input}
                />
                {suggestions.length > 0 && (
                  <div style={S.suggestBox}>
                    {suggestions.map(s => (
                      <div key={s} onClick={() => { setSearchQuery(s); setSuggestions([]); }} style={S.suggestItem}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 이동 수단 선택 */}
              <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
                {TRANSPORT.map(t => (
                  <button key={t.id} style={S.chip}>{t.icon} {t.label}</button>
                ))}
              </div>
            </section>

            {/* 환율 계산 지출 섹션 */}
            <section style={S.section}>
              <h4 style={S.secLabel}>💰 지출 기록 (원화 자동 환산)</h4>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <select style={{ flex: 1 }} id="cur">
                  {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input id="amt" type="number" placeholder="금액" style={{ flex: 2 }} />
              </div>
              <button style={S.subBtn} onClick={() => {
                const cur = document.getElementById('cur').value;
                const val = document.getElementById('amt').value;
                const inKRW = val * CURRENCIES[cur];
                alert(`입력하신 금액은 약 ${inKRW.toLocaleString()}원입니다.`);
              }}>지출 추가 및 환산</button>
            </section>

            {/* 구글맵 연동 버튼 (외부 링크 연동) */}
            <section style={S.section}>
              <button style={S.mapBtn} onClick={() => window.open(`https://www.google.com/maps/dir/${searchQuery}`, "_blank")}>
                🗺️ 구글맵에서 경로 보기
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const S = {
  miniSelect: { padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 11 },
  miniBtn: { cursor: "pointer", padding: "4px 8px", background: "#eee", borderRadius: 6, fontSize: 11 },
  mainBtn: { width: "100%", padding: 16, background: "#D4A853", color: "#fff", borderRadius: 12, fontWeight: "bold", marginBottom: 20 },
  subBtn: { width: "100%", padding: 12, background: "#343A40", color: "#fff", borderRadius: 10 },
  mapBtn: { width: "100%", padding: 12, background: "#4285F4", color: "#fff", borderRadius: 10, fontWeight: "bold" },
  tripCard: { background: "#fff", borderRadius: 16, marginBottom: 15, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", cursor: "pointer" },
  section: { background: "rgba(255,255,255,0.7)", padding: 20, borderRadius: 15, marginBottom: 20, border: "1px solid #eee" },
  secLabel: { fontSize: 12, fontWeight: "bold", color: "#D4A853", marginBottom: 10 },
  input: { width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ddd" },
  suggestBox: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", zIndex: 10, borderRadius: 8, marginTop: 5 },
  suggestItem: { padding: 10, borderBottom: "1px solid #eee", cursor: "pointer" },
  chip: { padding: "6px 10px", background: "#fff", border: "1px solid #ddd", borderRadius: 20, fontSize: 11 },
  backBtn: { background: "none", border: "none", fontSize: 20, cursor: "pointer", marginBottom: 10 }
};
