(function(){
 const $=s=>document.querySelector(s),today=()=>new Date().toISOString().slice(0,10),add=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
 function open(){
  const start=add(30),end=add(34),content=$("#modalContent"),back=$("#modalBackdrop");if(!content||!back)return;
  let step=0;
  content.innerHTML=`
   <div class="wp-wizard-head"><span class="eyebrow">WAYPOINT TRIP BUILDER</span><h2>여행을 설계해 보겠습니다.</h2><p class="muted">기본 정보부터 항공·숙소 조건까지 입력하면 AI가 조건을 반영해 여행 초안을 만듭니다.</p><div class="wp-wizard-progress"><i id="wp-wizard-progress" style="width:33%"></i></div><div class="wp-wizard-steps"><span data-wstep-label="0" class="active">01 여행 기본</span><span data-wstep-label="1">02 항공·숙소·예산</span><span data-wstep-label="2">03 취향·세부 조건</span></div></div>
   <form id="createTripForm" class="wp-wizard-form">
    <section data-wstep="0">
     <h3>어디로, 언제 떠나시나요?</h3><div class="modal-grid">
      <label class="field">여행 국가·도시<input name="destination" placeholder="예: 일본 오사카, 프랑스 파리" required></label>
      <input type="hidden" name="travelers" value="2"><label class="field">성인<select name="adults"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></label><label class="field">어린이<select name="children"><option selected>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option></select></label><label class="field">유아<select name="infants"><option selected>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
      <label class="field">출발일<input name="startDate" type="date" value="${start}" required></label><label class="field">귀국·여행 종료일<input name="endDate" type="date" value="${end}" required></label>
      <label class="field">출발 공항 (IATA 코드)<input name="departureAirport" list="wp-airport-options" value="ICN" placeholder="공항명 또는 ICN"></label><label class="field">도착 공항 (IATA 코드)<input name="arrivalAirport" list="wp-airport-options" placeholder="공항명 또는 KIX"></label><datalist id="wp-airport-options"></datalist>
     </div><p class="notice">공항 코드는 국제 항공권 검색에 사용하는 3자리 IATA 코드입니다. 예: 인천 ICN, 간사이 KIX, 나리타 NRT. 목적지 공항을 모르면 비워두고 나중에 항공 검색에서 입력할 수 있습니다.</p>
    </section>
    <section data-wstep="1" hidden>
     <h3>항공·숙소와 예산 조건</h3><div class="modal-grid">
      <label class="field">총 여행 예산 (원)<input name="budget" id="wp-budget" type="text" inputmode="numeric" placeholder="예: 2,000,000"></label>
      <label class="field">예산 성향<select name="budgetLevel"><option value="value">가성비 중심</option><option value="balanced" selected>균형형</option><option value="premium">여유로운 프리미엄</option></select></label>
      <label class="field">숙소 유형<select name="accommodation"><option value="hotel" selected>호텔</option><option value="resort">리조트</option><option value="apartment">레지던스·아파트</option><option value="hostel">호스텔</option><option value="ryokan">료칸·전통 숙소</option><option value="any">상관없음</option></select></label>
      <label class="field">숙소 희망 지역<input name="hotelArea" placeholder="예: 오사카 우메다역 도보 10분 이내"></label>
      <label class="field">객실 수<select name="rooms"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
      <label class="field">희망 숙소 등급<select name="hotelRating"><option value="any">상관없음</option><option value="3">3성급 이상</option><option value="4" selected>4성급 이상</option><option value="5">5성급</option></select></label>
      <label class="field">항공 좌석 등급<select name="cabin"><option value="ECONOMY">이코노미</option><option value="PREMIUM_ECONOMY">프리미엄 이코노미</option><option value="BUSINESS">비즈니스</option><option value="FIRST">퍼스트</option></select></label>
      <label class="field">항공편 선호<select name="flightPreference"><option value="cheapest">최저가 우선</option><option value="balanced" selected>가격·시간 균형</option><option value="nonstop">직항 우선</option><option value="shortest">최단 소요시간</option></select></label>
      <label class="field">숙소 중요 조건<select name="hotelPreference"><option value="value">가격 우선</option><option value="location" selected>위치 우선</option><option value="comfort">시설·후기 우선</option><option value="breakfast">조식 포함</option><option value="refundable">무료 취소</option></select></label>
      <label class="field">숙박 인원<select name="hotelGuests"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></label>
     </div><p class="notice">숙소와 항공권은 실제 공급자 검색 기능을 통해 별도로 조회합니다. AI가 만든 추천 가격을 실제 판매 가격처럼 표시하지 않습니다.</p>
    </section>
    <section data-wstep="2" hidden>
     <h3>어떤 여행을 원하시나요?</h3>
     <fieldset class="field style-checks"><legend>관심 여행 스타일 (복수 선택)</legend><div class="style-check-grid">
      <label><input type="checkbox" name="styles" value="맛집·미식" checked> 맛집·미식</label><label><input type="checkbox" name="styles" value="관광·명소" checked> 관광·명소</label><label><input type="checkbox" name="styles" value="카페"> 카페</label><label><input type="checkbox" name="styles" value="쇼핑"> 쇼핑</label><label><input type="checkbox" name="styles" value="자연·산책"> 자연·산책</label><label><input type="checkbox" name="styles" value="문화·역사"> 문화·역사</label><label><input type="checkbox" name="styles" value="휴식"> 휴식</label><label><input type="checkbox" name="styles" value="테마파크"> 테마파크</label><label><input type="checkbox" name="styles" value="사진·전망"> 사진·전망</label>
     </div></fieldset>
     <div class="modal-grid">
      <label class="field">여행 속도<select name="pace"><option value="relaxed">여유롭게 · 하루 2~3곳</option><option value="balanced" selected>균형 있게 · 하루 3~4곳</option><option value="active">알차게 · 하루 5곳 이상</option></select></label>
      <label class="field">주요 이동 방식<select name="transport"><option>대중교통</option><option>도보 중심</option><option>렌터카</option><option>혼합</option></select></label>
      <label class="field">식사 예산 수준<select name="mealBudget"><option value="budget">합리적인 식사</option><option value="mixed" selected>현지 맛집과 일반 식사 혼합</option><option value="premium">미식·파인다이닝 포함</option></select></label>
      <label class="field">여행 시작 방식<select name="arrivalPlan"><option value="morning">오전 도착</option><option value="afternoon" selected>오후 도착</option><option value="evening">저녁 도착</option><option value="flexible">아직 미정</option></select></label>
     </div>
     <label class="field">꼭 하고 싶은 것·피하고 싶은 것<textarea name="notes" rows="4" placeholder="예: 유명 맛집을 포함하고, 전망대는 한 곳만 방문. 이동 시간이 긴 일정은 피하고 싶습니다."></textarea></label>
    </section>
    <div class="wp-wizard-actions"><button type="button" class="button outline" id="wp-wizard-back" hidden>이전</button><span class="muted" id="wp-wizard-hint">1 / 3 단계</span><button type="button" class="button primary" id="wp-wizard-next">다음 단계 →</button><button type="submit" class="button primary" id="submitCreate" hidden>AI로 여행 초안 만들기 ✦</button></div>
   </form>`;
  back.classList.add("open");
  const form=$("#createTripForm"),steps=[...form.querySelectorAll("[data-wstep]")],labels=[...content.querySelectorAll("[data-wstep-label]")],progress=$("#wp-wizard-progress");
  const syncPax=()=>{const adults=Number(form.elements.adults.value)||1,children=Number(form.elements.children.value)||0,infants=Number(form.elements.infants.value)||0;if(infants>adults)form.elements.infants.value=String(adults);form.elements.travelers.value=String(adults+children+Number(form.elements.infants.value||0))};["adults","children","infants"].forEach(n=>form.elements[n].addEventListener("change",syncPax));syncPax();
  const airportList=$("#wp-airport-options");let airportTimer=null;["departureAirport","arrivalAirport"].forEach(name=>{const input=form.elements[name];input.addEventListener("input",()=>{clearTimeout(airportTimer);const keyword=input.value.trim();if(keyword.length<2||!window.WaypointAPI?.request)return;airportTimer=setTimeout(async()=>{try{const result=await window.WaypointAPI.request("airport-search",{keyword});airportList.innerHTML=(result.airports||[]).map(a=>`<option value="${a.iataCode}" label="${a.name} · ${a.cityName||""}"></option>`).join("")}catch(_){/* Suggestions require a configured Amadeus connection. */}},350)})});
  function show(n){step=n;steps.forEach((x,i)=>x.hidden=i!==n);labels.forEach((x,i)=>x.classList.toggle("active",i===n));progress.style.width=((n+1)/3*100)+"%";$("#wp-wizard-back").hidden=n===0;$("#wp-wizard-next").hidden=n===2;$("#submitCreate").hidden=n!==2;$("#wp-wizard-hint").textContent=(n+1)+" / 3 단계";const first=steps[n].querySelector("input:not([type=checkbox]),select,textarea");first?.focus()}
  $("#wp-wizard-back").onclick=()=>show(Math.max(0,step-1));
  $("#wp-wizard-next").onclick=()=>{const required=[...steps[step].querySelectorAll("[required]")];for(const el of required)if(!el.reportValidity())return;if(step===0&&form.elements.endDate.value<form.elements.startDate.value){alert("여행 종료일은 출발일 이후여야 합니다.");return}show(Math.min(2,step+1))};
  form.elements.budget.addEventListener("input",e=>{const n=e.target.value.replace(/[^0-9]/g,"");e.target.value=n?Number(n).toLocaleString("ko-KR"):""});
  form.onsubmit=e=>{if(form.elements.endDate.value<form.elements.startDate.value){e.preventDefault();show(0);alert("여행 종료일은 출발일 이후여야 합니다.");return}for(const name of ["departureAirport","arrivalAirport"]){const code=form.elements[name].value.trim();if(code&&!/^[A-Z]{3}$/.test(code)){e.preventDefault();show(0);alert("공항은 자동완성 목록에서 선택하거나 3자리 IATA 코드로 입력해 주세요.");return}}if(typeof window.createTrip==="function")window.createTrip(e);else{e.preventDefault();alert("여행 생성 모듈을 불러오지 못했습니다. 새로고침해 주세요.")}};
  show(0);
 }
 function init(){["#createHero","#heroCreate","#emptyCreate","#newTripTop","#createTrips"].forEach(sel=>{const el=$(sel);if(el)el.onclick=open})}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
 window.WaypointTripWizard={open};
})();