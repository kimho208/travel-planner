import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "https://kimho208.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
const itineraryResponseSchema = {
  type: "OBJECT",
  properties: {
    suggestedDestination: { type: "STRING" },
    overview: { type: "STRING" },
    recommendations: { type: "ARRAY", minItems: 8, maxItems: 14, items: {
      type: "OBJECT", properties: {
        name: { type: "STRING" }, category: { type: "STRING", enum: ["명소", "식당", "카페", "쇼핑", "숙소"] },
        reason: { type: "STRING" }, area: { type: "STRING" }, query: { type: "STRING" }
      }, required: ["name", "category", "reason", "area", "query"]
    }},
    days: { type: "ARRAY", minItems: 1, maxItems: 60, items: {
      type: "OBJECT", properties: {
        date: { type: "STRING" }, theme: { type: "STRING" },
        items: { type: "ARRAY", maxItems: 12, items: {
          type: "OBJECT", properties: {
            time: { type: "STRING" }, name: { type: "STRING" },
            category: { type: "STRING" }, reason: { type: "STRING" },
            area: { type: "STRING" }, query: { type: "STRING" }
          }, required: ["time", "name", "category", "reason", "area", "query"]
        }}
      }, required: ["date", "theme", "items"]
    }},
    tips: { type: "ARRAY", maxItems: 12, items: { type: "STRING" } }
  },
  required: ["overview", "recommendations", "days", "tips"]
};
function validateGeneratedItinerary(value: Record<string, any>, trip: Record<string, any>) {
  if (!value || typeof value !== "object" || !Array.isArray(value.days) || !Array.isArray(value.recommendations) || !Array.isArray(value.tips)) throw new Error("AI 일정 응답의 필수 항목이 누락되었습니다.");
  const start = Date.parse(String(trip.startDate) + "T00:00:00Z"), end = Date.parse(String(trip.endDate) + "T00:00:00Z");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("여행 날짜 범위가 올바르지 않습니다.");
  const expected = Math.floor((end - start) / 86400000) + 1;
  if (expected > 60 || value.days.length !== expected) throw new Error("AI 일정의 날짜 수가 여행 기간과 일치하지 않습니다.");
  const expectedDates = Array.from({ length: expected }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
  const seen = new Set();
  for (const day of value.days) {
    if (!day || typeof day.date !== "string" || !expectedDates.includes(day.date) || seen.has(day.date) || !Array.isArray(day.items) || day.items.length > 12) throw new Error("날짜별 일정 구조가 올바르지 않습니다.");
    seen.add(day.date);
    for (const item of day.items) {
      if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 160 || (item.time && !/^\\d{2}:\\d{2}$/.test(item.time))) throw new Error("일정에 올바르지 않은 장소 또는 시간이 포함되어 있습니다.");
    }
  }
  if (seen.size !== expectedDates.length || !value.recommendations.length || value.recommendations.length > 14) throw new Error("일정 날짜 또는 추천 장소 수가 올바르지 않습니다.");
  for (const place of value.recommendations) if (!place || typeof place.name !== "string" || !place.name.trim() || place.name.length > 160 || typeof place.query !== "string") throw new Error("추천 장소 데이터가 올바르지 않습니다.");
  return value;
}
function jsonFromText(text: string) {
  const clean = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = clean.indexOf("{"), end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 응답에서 JSON 일정을 찾지 못했습니다.");
  return JSON.parse(clean.slice(start, end + 1));
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const origin = req.headers.get("origin") || "";
  if (origin && origin !== "https://kimho208.github.io" && !origin.startsWith("http://localhost")) return reply({ error: "허용되지 않은 요청 주소입니다." }, 403);
  if (req.method === "GET") return reply({ ok: true, geminiConfigured: !!Deno.env.get("GEMINI_API_KEY"), mapsConfigured: !!Deno.env.get("GOOGLE_MAPS_API_KEY") });
  if (req.method !== "POST") return reply({ error: "POST 요청만 지원합니다." }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "요청 형식이 올바르지 않습니다." }, 400); }
  const action = String(body.action || "");
  console.info("[travel-assistant] action:", action);
  // A status response contains only booleans, never key values. It is intentionally available before sign-in.
  if (action === "status") return reply({ ok: true, geminiConfigured: !!Deno.env.get("GEMINI_API_KEY"), mapsConfigured: !!Deno.env.get("GOOGLE_MAPS_API_KEY") });
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "로그인이 필요합니다." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return reply({ error: "Supabase 인증 설정을 확인할 수 없습니다." }, 500);
  let userCheck: Response;
  try { userCheck = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } }); }
  catch { return reply({ error: "로그인 세션 확인 서버에 연결하지 못했습니다." }, 502); }
  if (!userCheck.ok) return reply({ error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요." }, 401);

  if (action === "generate") {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return reply({ error: "Gemini API 키가 등록되지 않았습니다. Supabase Edge Function Secrets에 GEMINI_API_KEY를 등록해야 합니다.", setupRequired: "GEMINI_API_KEY" }, 424);
    const trip = body.trip as Record<string, unknown>;
    if (!trip || !trip.startDate || !trip.endDate) return reply({ error: "여행 날짜가 필요합니다." }, 400);
    const prompt = `당신은 실제 여행 데이터를 엄격히 다루는 전문 여행 설계 엔진입니다. 반드시 JSON 객체 하나만 반환합니다.
여행 조건: ${JSON.stringify(trip)}
목적지가 비어 있으면 기간, 예산, 출발지(제공된 경우), 선호 스타일을 바탕으로 현실적인 여행지 한 곳을 선택하고 suggestedDestination에 국가와 도시를 명시하세요.
일정 규칙:
- startDate와 endDate를 모두 포함해 하루도 빠짐없이 날짜별 일정을 만드세요.
- 하루 3~5개 방문지를 시간순으로 배치하고 이동 부담이 큰 지역 간 왕복을 피하세요.
- 식사, 휴식, 이동을 위한 여유 시간을 포함하세요. 실제 확인하지 않은 영업시간·가격·휴무일을 단정하지 마세요.
- 각 장소는 실제 존재할 가능성이 높은 구체적인 장소명으로 작성하고, query에는 Google Places 검색에 적합한 "정확한 장소명, 도시"를 작성하세요.
- 숙소는 추천 후보로만 제시하고 예약된 것처럼 표현하지 마세요.
- 사용자의 예산과 여행 스타일을 반영하고 불필요하게 비싼 선택을 피하세요.
- 추천 후보는 최소 8개, 최대 14개로 명소·식당·카페·쇼핑·숙소를 다양하게 포함하세요.
- 날짜별 items도 최소 3개를 목표로 하되 장소가 적절하지 않으면 허위 장소를 만들지 말고 적은 수를 반환하세요.
응답 스키마:
{"suggestedDestination":"국가 도시","overview":"구체적인 여행 컨셉과 선정 이유","recommendations":[{"name":"실제 장소명","category":"명소|식당|카페|쇼핑|숙소","reason":"여행 조건과 연결된 추천 이유","area":"동네","query":"실제 지도 검색용 장소명, 도시"}],"days":[{"date":"YYYY-MM-DD","theme":"하루의 지역별 테마","items":[{"time":"09:30","name":"실제 장소명","category":"명소|식당|카페|쇼핑","reason":"이 장소를 이 시간에 방문할 이유","area":"동네","query":"장소명, 도시"}]}],"tips":["현실적인 여행 팁"]}
JSON 외의 텍스트나 마크다운은 반환하지 마세요.`;
    let response: Response;
    try {
      let attempt = 0;
      do {
        response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "당신은 근거 없는 여행 정보를 만들지 않는 일정 설계 전문가입니다. 구조화된 JSON만 출력합니다." }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: itineraryResponseSchema, temperature: 0.35, maxOutputTokens: 8000, thinkingConfig: { thinkingLevel: "LOW" } }
        })
        , signal: AbortSignal.timeout(35000)
      });
      if ((response.status === 503 || response.status === 502) && attempt === 0) {
        attempt++;
        console.warn("[travel-assistant] Gemini transient status:", response.status, "retrying once");
        await new Promise((resolve) => setTimeout(resolve, 1200));
      } else break;
      } while (attempt < 2);
    } catch (error) {
      console.error("[travel-assistant] Gemini transport/timeout:", error instanceof Error ? error.name : "unknown");
      return reply({ error: "Gemini 응답 시간이 초과되었거나 연결에 실패했습니다. 잠시 후 다시 시도해 주세요." }, 504);
    }
    const result = await response.json();
    if (!response.ok) { console.error("[travel-assistant] Gemini upstream status:", response.status, result?.error?.status || "unknown"); return reply({ error: result?.error?.message || "Gemini 요청에 실패했습니다.", upstreamStatus: response.status }, response.status === 429 ? 429 : response.status === 503 ? 503 : 502); }
    try {
      const text = result?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
      const itinerary = validateGeneratedItinerary(jsonFromText(text), trip);
      return reply({ ok: true, itinerary, model: "gemini-3.8-flash" });
    } catch (error) { return reply({ error: error instanceof Error ? error.message : "AI 응답을 처리하지 못했습니다." }, 502); }
  }
  if (action === "places") {
    const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!key) return reply({ error: "Google Maps API 키가 등록되지 않았습니다. Supabase Secrets에 GOOGLE_MAPS_API_KEY를 등록해야 합니다.", setupRequired: "GOOGLE_MAPS_API_KEY" }, 424);
    const query = String(body.query || "").trim();
    if (!query) return reply({ error: "검색어를 입력해 주세요." }, 400);
    let res: Response;
    try {
      res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.googleMapsUri" },
        body: JSON.stringify({ textQuery: query, languageCode: "ko", maxResultCount: 5 }),
        signal: AbortSignal.timeout(12000)
      });
    } catch { return reply({ error: "Google 장소 검색 서버에 연결하지 못했습니다." }, 502); }
    const data = await res.json();
    if (!res.ok) return reply({ error: data?.error?.message || "장소 검색에 실패했습니다." }, res.status === 429 ? 429 : 502);
    return reply({ ok: true, places: (data.places || []).map((p: Record<string, any>) => ({ id: p.id, name: p.displayName?.text, address: p.formattedAddress, location: p.location, rating: p.rating, ratingCount: p.userRatingCount, types: p.types, mapsUrl: p.googleMapsUri })) });
  }
  if (action === "parse-reservation") {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return reply({ error: "Gemini API 키가 등록되지 않았습니다.", setupRequired: "GEMINI_API_KEY" }, 424);
    const text = String(body.text || "").slice(0, 30000);
    const image = body.image as { mimeType?: string; data?: string } | undefined;
    if (!text && !image?.data) return reply({ error: "예약 확인서에서 읽을 수 있는 텍스트나 이미지가 필요합니다." }, 400);
    const parts: Record<string, unknown>[] = [{
      text: `아래 여행 예약 확인서에서 실제로 확인할 수 있는 정보만 추출해 JSON 객체 하나로 반환하세요. 모르는 값은 빈 문자열로 둡니다. 항공권, 호텔, 철도, 버스, 렌터카 중 종류를 판단하세요. 날짜와 시간은 원문 시간대가 불분명하면 임의 변환하지 말고 원문 값을 가능한 ISO 형식으로 옮깁니다. 가격 통화도 원문 그대로 추출합니다. 개인정보는 예약 입력에 필요한 이름/예약번호 이외에는 반환하지 마세요.
응답 스키마: {"reservation":{"type":"flight|hotel|rail|bus|car|activity|other","provider":"","title":"","confirmationCode":"","origin":"","destination":"","flightNumber":"","departureAt":"","arrivalAt":"","checkInAt":"","checkOutAt":"","price":"","currency":"KRW","status":"planned"}}
문서 텍스트:
${text}`
    }];
    if (image?.data && image?.mimeType) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    let res: Response;
    try {
      res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 2000 } }),
        signal: AbortSignal.timeout(35000)
      });
    } catch { return reply({ error: "예약 정보 분석 요청 시간이 초과되었습니다." }, 504); }
    const result = await res.json();
    if (!res.ok) return reply({ error: result?.error?.message || "예약 정보 분석에 실패했습니다." }, 502);
    try {
      const raw = result?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
      const parsed = jsonFromText(raw);
      if (!parsed.reservation || typeof parsed.reservation !== "object") throw new Error("예약 정보를 찾지 못했습니다.");
      return reply({ ok: true, reservation: parsed.reservation });
    } catch (error) { return reply({ error: error instanceof Error ? error.message : "예약 정보를 처리하지 못했습니다." }, 502); }
  }
  if (action === "route") {
    const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!key) return reply({ error: "Google Maps API 키가 등록되지 않았습니다.", setupRequired: "GOOGLE_MAPS_API_KEY" }, 424);
    const o = body.origin as Record<string, unknown>, d = body.destination as Record<string, unknown>;
    if (!o || !d) return reply({ error: "출발지와 도착지가 필요합니다." }, 400);
    const travelMode = ["DRIVE","WALK","TRANSIT","BICYCLE"].includes(String(body.travelMode)) ? String(body.travelMode) : "TRANSIT";
    let res: Response;
    try {
      res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction.instructions" },
        body: JSON.stringify({ origin: o.location?.latitude != null && o.location?.longitude != null ? { location: { latLng: { latitude: Number(o.location.latitude), longitude: Number(o.location.longitude) } } } : { address: String(o.address || o.name || "") }, destination: d.location?.latitude != null && d.location?.longitude != null ? { location: { latLng: { latitude: Number(d.location.latitude), longitude: Number(d.location.longitude) } } } : { address: String(d.address || d.name || "") }, travelMode, languageCode: "ko-KR", units: "METRIC" }),
        signal: AbortSignal.timeout(20000)
      });
    } catch { return reply({ error: "Google 경로 계산 서버에 연결하지 못했습니다." }, 502); }
    const data = await res.json();
    if (!res.ok) return reply({ error: data?.error?.message || "경로 계산에 실패했습니다." }, res.status === 429 ? 429 : 502);
    const route = data.routes?.[0];
    if (!route) return reply({ error: "해당 이동수단의 경로를 찾지 못했습니다." }, 404);
    return reply({ ok: true, duration: route.duration, distanceMeters: route.distanceMeters, encodedPolyline: route.polyline?.encodedPolyline || "", steps: route.legs?.[0]?.steps || [] });
  }
  return reply({ error: "지원하지 않는 작업입니다." }, 400);
});