// Vercel Serverless Function: /api/places
// 환경변수 ANTHROPIC_API_KEY 를 Vercel 대시보드에 설정해야 합니다.

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const query = (req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "query required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
    const prompt = `You are a travel place search assistant. The user typed: "${query}"

Return EXACTLY 6 real place suggestions as a JSON array.
Rules:
- Detect the input language and return place names in the SAME language
  • Korean input  → Korean names (e.g. "에펠탑", "하카타 잇푸도")
  • Japanese input → Japanese names
  • English input  → English names
- Support ALL place types: hotels, restaurants, cafes, bars, attractions, stations, airports, parks, shops, etc.
- For restaurant/cafe names: search by the EXACT name the user typed, even if it is a specific chain or local restaurant
- Use accurate real-world coordinates (latitude/longitude)
- Choose one icon from: 🏨 🍽️ 🏛️ 🚉 ✈️ 🌿 🏖️ 🛍️ 🏥 🎓 🎪 🏟️ 🗼 🏯 ⛩️ 🗺️ 📍

JSON format (array only, no markdown, no explanation):
[
  {
    "name": "place name in input language",
    "sub": "city or district, country",
    "icon": "emoji",
    "lat": 35.6762,
    "lon": 139.6503
  }
]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return res.status(502).json({ error: "upstream error", detail: err });
    }

    const data = await response.json();
    const text = (data.content?.[0]?.text || "").trim();

    // JSON 파싱 — 마크다운 펜스 제거 후 시도
    const cleaned = text.replace(/```json|```/g, "").trim();
    let places;
    try {
      places = JSON.parse(cleaned);
    } catch {
      // 배열만 추출 시도
      const match = cleaned.match(/\[[\s\S]*\]/);
      places = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(places)) places = [];

    // 좌표 유효성 검사
    const valid = places.filter(p =>
      p.name &&
      typeof p.lat === "number" && !isNaN(p.lat) &&
      typeof p.lon === "number" && !isNaN(p.lon)
    ).slice(0, 6);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(valid);

  } catch (e) {
    console.error("places handler error:", e);
    return res.status(500).json({ error: e.message });
  }
}
