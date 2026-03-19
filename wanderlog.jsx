import { useState, useEffect } from "react";

/* ── 환율 및 설정 ────────────────────────────────────────────────────────── */
const CURRENCIES = { THB: 38.5, JPY: 8.9, USD: 1350, EUR: 1450, KRW: 1 };
const TRANSPORT = ["🚇 지하철", "🚌 버스", "🚕 택시", "🚗 자동차", "✈️ 항공", "🚶 도보"];

export default function WanderLog() {
  const [trips, setTrips] = useState([]);
  const [selDay, setSD] = useState(null);
  const [bgImage, setBgImage] = useState(null);

  // 장소 검색 시뮬레이션 데이터 (실제 연동 시 Google Autocomplete 사용)
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const mockDB = ["에펠탑", "에펠탑 전망대", "루브르 박물관", "개선문", "방콕 왕궁", "카오산로드"];

  const handleSearch = (val) => {
    setSearchQuery(val);
    if (val.length > 0) {
      setSuggestions(mockDB.filter(item => item.includes(val)));
    } else {
      setSuggestions([]);
    }
  };

  return (
    <div style={S.container}>
      {/* 옅게 배경 사진 입히기 */}
      {bgImage && <div style={{...S.bgOverlay, backgroundImage: `url(${bgImage})` }} />}

      <div style={S.content}>
        <header style={S.header}>
          <h1 style={S.title}>WANDERLOG</h1>
          <input type="file" onChange={(e) => {
            const reader = new FileReader();
            reader.onload = (ev) => setBgImage(ev.target.result);
            reader.readAsDataURL(e.target.files[0]);
          }} style={S.fileInput} id="bg-up" />
          <label htmlFor="bg-up" style={S.bgBtn}>🖼️ 배경 사진 설정</label>
        </header>

        {/* 오늘의 동선 섹션 */}
        <section style={S.section}>
          <h3 style={S.secTitle}>📍 오늘의 동선 (자동 검색)</h3>
          <div style={{ position: "relative" }}>
            <input 
              style={S.input} 
              value={searchQuery} 
              onChange={(e) => handleSearch(e.target.value)} 
              placeholder="장소명을 입력하면 추천 지명이 뜹니다..." 
            />
            {suggestions.length > 0 && (
              <div style={S.suggestionBox}>
                {suggestions.map(s => (
                  <div key={s} onClick={() => { setSearchQuery(s); setSuggestions([]); }} style={S.sugItem}>{s}</div>
                ))}
              </div>
            )}
          </div>
          
          <div style={S.transGrid}>
            {TRANSPORT.map(t => <button key={t} style={S.transBtn}>{t}</button>)}
          </div>
        </section>

        {/* 지출 관리 섹션 */}
        <section style={S.section}>
          <h3 style={S.secTitle}>💰 스마트 지출 (환율 자동 계산)</h3>
          <div style={S.flexRow}>
            <select style={S.select} id="cur"><option>THB</option><option>JPY</option><option>USD</option></select>
            <input type="number" placeholder="금액 입력" style={S.input} id="amt" />
            <button style={S.addBtn} onClick={() => {
              const cur = document.getElementById('cur').value;
              const amt = document.getElementById('amt').value;
              alert(`원화 환산 금액: 약 ${(amt * CURRENCIES[cur]).toLocaleString()}원`);
            }}>계산</button>
          </div>
        </section>

        {/* 일기장 섹션 */}
        <section style={S.section}>
          <h3 style={S.secTitle}>✍️ 오늘의 일기</h3>
          <textarea style={S.textarea} placeholder="오늘의 특별한 순간을 기록하세요..."></textarea>
        </section>
      </div>
    </div>
  );
}

const S = {
  container: { background: "#fff", minHeight: "100vh", position: "relative", color: "#333" },
  bgOverlay: { position: "fixed", inset: 0, backgroundSize: "cover", opacity: 0.15, pointerEvents: "none", zIndex: 0 },
  content: { position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto", padding: "40px 20px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" },
  title: { color: "#D4A853", fontSize: "24px", fontWeight: "800" },
  section: { background: "rgba(255,255,255,0.8)", padding: "20px", borderRadius: "15px", marginBottom: "20px", border: "1px solid #eee" },
  secTitle: { fontSize: "14px", fontWeight: "bold", color: "#D4A853", marginBottom: "15px" },
  input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px" },
  suggestionBox: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #ddd", borderRadius: "8px", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
  sugItem: { padding: "10px", cursor: "pointer", borderBottom: "1px solid #eee" },
  transGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "15px" },
  transBtn: { padding: "8px", fontSize: "11px", background: "#f9f9f9", border: "1px solid #eee", borderRadius: "6px" },
  flexRow: { display: "flex", gap: "10px" },
  addBtn: { background: "#D4A853", color: "#fff", border: "none", padding: "0 20px", borderRadius: "8px", fontWeight: "bold" },
  textarea: { width: "100%", height: "100px", borderRadius: "8px", border: "1px solid #ddd", padding: "12px", marginTop: "10px" },
  bgBtn: { fontSize: "12px", color: "#666", cursor: "pointer", background: "#eee", padding: "5px 10px", borderRadius: "5px" },
  fileInput: { display: "none" }
};
