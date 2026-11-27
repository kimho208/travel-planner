# WAYPOINT 공급자 API 연결

## 1. AI 일정 생성
Gemini는 Supabase Edge Function에서 호출합니다. 브라우저에 Gemini 키를 넣지 않습니다.

Supabase Dashboard → Project Settings → Edge Functions → Secrets:
- `GEMINI_API_KEY`: Google AI Studio에서 발급한 Gemini API 키

현재 모델은 `gemini-3.8-flash`이며, 구조화 JSON 응답을 사용합니다. 실제 API 사용량과 요금은 Google AI Studio 프로젝트의 한도·요금제에 따릅니다.

## 2. 항공편 및 숙소 검색 (Amadeus)
현재 WAYPOINT의 실시간 항공편·숙소 검색 어댑터는 Amadeus Self-Service API를 사용합니다.

필요한 Secrets:
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`
- `AMADEUS_ENV`: `test` 또는 `production` (미설정 시 test)

Amadeus for Developers에서 앱을 생성하고 Self-Service API 접근 권한을 받아 Client ID/Secret을 발급받은 뒤 위 Secrets에 등록합니다. 처음에는 `test` 환경에서 테스트하세요. Test 환경의 항공·숙소 데이터는 제한되며 실제 판매 재고나 실제 가격을 대표하지 않을 수 있습니다. 실제 고객에게 검색 결과를 제공하려면 Amadeus Production 접근 승인이 필요합니다.

연결된 API:
- Flight Offers Search: 출발·도착 IATA 코드, 날짜, 인원, 좌석 등급으로 항공편 검색
- Hotel List by City: 도시별 검색 가능한 숙소 식별자 조회
- Hotel Offers Search: 체크인·체크아웃, 인원, 객실 수, 통화별 객실 요금 조회

검색 결과를 WAYPOINT 예약 목록에 저장할 수 있지만, 현재 이 기능은 **예약 후보 저장**입니다. 항공권 발권·숙소 예약·결제는 처리하지 않습니다. 실제 예약을 만들려면 공급자별 가격 재확인, 주문 생성, 결제, 취소/환불, 개인정보·결제 보안, 법적·상업적 계약이 별도로 필요합니다.

공식 문서:
- Amadeus API 튜토리얼: https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/
- Amadeus Flight Offers Search: https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search
- Amadeus Hotel Search: https://developers.amadeus.com/self-service/category/hotels/api-doc/hotel-search

## 3. Agoda 및 Trip.com
Agoda와 Trip.com의 재고·요금·예약 API는 일반 공개 키만 발급받아 바로 사용할 수 있는 공개 검색 API가 아닙니다. 파트너 신청, 계약, 인증 및 공급자 자격이 필요합니다.

- Agoda Demand API: https://developer.agoda.com/demand/docs/getting-started
- Trip.com Connectivity: https://connect.trip.com/
- Trip.com Affiliate Program: https://www.trip.com/partners/index

Agoda의 Online Affiliates/MSE 모델은 검색 API 파트너 자격이 필요하고, Book API까지 연결하려면 해당 fulfillment 모델의 승인·인증이 필요합니다. Trip.com Connectivity는 호텔 공급자/채널 매니저 등 파트너 통합 절차를 안내합니다. Affiliate 도구는 제휴 링크와 검색 위젯을 제공하지만, 임의의 프런트엔드 URL을 제휴 추적 링크로 꾸며서는 안 됩니다.

따라서 현재 WAYPOINT는 실제 Amadeus 검색을 구현하고, Agoda·Trip.com은 파트너 계정이 승인되기 전까지 직접 재고·가격을 제공한다고 표시하지 않습니다. 파트너 자격이 발급되면 별도 어댑터를 추가할 수 있습니다.

## 4. 보안
- 공급자 Secret은 Supabase Edge Function에만 저장합니다.
- 브라우저에는 Supabase publishable key만 둡니다.
- 검색 요청은 로그인 세션을 검증한 후 처리합니다.
- 예약 후보와 실제 확정 예약을 구분합니다.
- 공급자 테스트 환경 결과를 실거래 가격으로 표시하지 않습니다.
