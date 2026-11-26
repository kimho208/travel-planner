export function buildDraft(trip) {
  const raw = (trip.places || "")
    .split(/[,，\n]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const items = raw.length
    ? raw.map((name, index) => ({
        id: `stop-${Date.now()}-${index}`,
        time: ["09:30", "11:30", "14:00", "16:30"][index % 4],
        name,
        kind: "관광",
        note: "방문 전 운영시간과 휴무일을 확인하세요."
      }))
    : [{
        id: `stop-${Date.now()}-1`,
        time: "10:00",
        name: "가고 싶은 장소를 추가해 주세요",
        kind: "안내",
        note: "관광지 이름을 입력해 일정을 구성할 수 있습니다."
      }];

  // 여행 시작일과 종료일을 모두 포함합니다.
  // UTC 기준으로 계산해 시간대/DST 차이로 날짜가 빠지는 문제를 방지합니다.
  const start = Date.parse(`${trip.startDate}T00:00:00Z`);
  const end = Date.parse(`${trip.endDate}T00:00:00Z`);
  const validDates = Number.isFinite(start) && Number.isFinite(end) && end >= start;
  const dayCount = validDates
    ? Math.min(14, Math.floor((end - start) / 86400000) + 1)
    : 1;

  return Array.from({ length: dayCount }, (_, index) => ({
    date: validDates
      ? new Date(start + index * 86400000).toISOString().slice(0, 10)
      : trip.startDate || new Date().toISOString().slice(0, 10),
    items: index === 0 ? items.map((item) => ({ ...item })) : []
  }));
}
