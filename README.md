# WAYPOINT — 여행 계획과 기록을 한곳에서

WAYPOINT는 여행지 탐색부터 일정·지도·예약·예산·준비물·여행 메모까지 한곳에서 관리하는 바닐라 JavaScript 기반 여행 플래너입니다.

**서비스:** https://kimho208.github.io/travel-planner/

## 현재 기능
- 이메일·비밀번호 회원가입, 로그인, 비밀번호 재설정 (Supabase Auth)
- 3단계 여행 생성 마법사: 여행지·날짜·성인/어린이/유아·출발/도착 공항·예산·숙소·좌석 등급·여행 스타일·속도·식사 예산 입력
- 공항 IATA 코드 자동완성 및 실제 항공편 검색·숙소 요금 검색 (Amadeus Self-Service API, Secrets 설정 필요)
- Gemini 구조화 JSON Schema 기반 날짜별 일정 생성 및 서버 측 날짜·장소 검증
- AI 생성 실패 시 날짜별 기본 일정 템플릿 제공
- Google Places 우선 검색, 연결이 불가능할 때 Photon/OpenStreetMap 장소 검색
- 일정 카드와 Leaflet 지도 연결, 장소 마커 선택 시 해당 일정 강조
- 일정 순서 변경, 날짜 간 이동, 모바일용 위/아래 이동 버튼
- 좌표 기반 최근접 이웃 동선 정렬, 변경 실행 취소, 시간 겹침 및 이동 간격 경고
- Google Routes 경로 계산 및 자동차 이동에 한해 OSRM 공개 경로 API 대체 사용
- 여행지 7일 날씨 예보와 현지 시각 표시 (Open-Meteo)
- 예약 시간순 정렬, 예약 정보 추출, 예약 확인 파일의 기기 내 IndexedDB 보관
- 다중 통화 지출 기록, 환율 기준일 보존, 여행자별 최소 송금 정산
- 준비 체크리스트, 메모, 여행 D-day와 다음 예약 요약
- iCalendar(.ics) 내보내기, 일정 인쇄/PDF, JSON 백업·검증 복원
- PWA 서비스 워커, 오프라인 기기 저장, 실패한 클라우드 저장 재시도
- 키보드 포커스 표시, 모달 포커스 관리, 모바일 터치 영역 개선

## 기술 구성
- 정적 프런트엔드: HTML / CSS / Vanilla JavaScript
- 배포: GitHub Pages
- 계정 및 클라우드 데이터: Supabase Auth / Postgres / RLS
- AI 및 지도 서버 프록시: Supabase Edge Function `travel-assistant`
- 지도: Leaflet / OpenStreetMap
- 장소 검색 대체 경로: Photon
- 자동차 경로 대체 경로: OSRM 공개 데모 서버
- 날씨: Open-Meteo
- 환율: Frankfurter (ECB 기준 환율)

## 서버 설정
Supabase Edge Function Secrets에 `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`를 등록합니다. 비밀 API 키를 브라우저 코드나 GitHub 저장소에 넣지 않습니다. Supabase의 브라우저 키는 publishable key만 사용합니다.

## 데이터와 개인정보
- 여행 일정과 설정은 로그인 전에도 현재 기기에 저장할 수 있습니다.
- 로그인 후 여행 데이터는 Supabase 계정에 저장되며, 클라우드 저장 실패 시 기기 저장 후 재시도 대기열에 남습니다.
- 예약 확인 PDF/이미지는 현재 브라우저 IndexedDB에만 보관합니다. 기기 간 파일 동기화는 아직 지원하지 않습니다.
- 공개 지도·장소·날씨 API는 서비스 정책과 요청 한도에 따라 일시적으로 실패할 수 있습니다.
- AI가 생성한 장소와 정보는 실제 영업 여부·가격·운영시간을 보장하지 않습니다. 방문 전에 확인해야 합니다.

## 아직 구현되지 않은 항목
실시간 항공편 운항 상태, 실시간 대중교통 경로 대체 API, 서버 기반 읽기 전용 공유, 여러 기기 간 오프라인 충돌 병합, 예약 파일 클라우드 동기화, 완전한 협업 기능은 아직 구현되지 않았습니다.
