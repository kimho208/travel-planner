import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";

const SUPABASE_URL="https://ukpywdzvewvsvuirujnr.supabase.co";
const SUPABASE_KEY="sb_publishable_sSrnespomiRYE0P3wfkX_w_ardc0wun";
const db=createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>"₩"+Math.round(Number(n)||0).toLocaleString("ko-KR");
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid=()=>crypto.randomUUID();
const dateText=d=>d?new Date(d+"T00:00:00").toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"}):"";
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>{const x=new Date(d+"T00:00:00");x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const state={user:null,session:null,trips:[],activeId:null,view:"home",tab:"overview",day:0,filter:"all",map:null,markers:[],routeLayers:[],saved:JSON.parse(localStorage.getItem("waypoint-v2-saved")||"[]"),rates:{},rateDate:null,loading:false,dragId:null};
let mapResizeObserver=null;
function toast(message){const el=document.createElement("div");el.className="toast";el.textContent=message;$("#toasts").append(el);setTimeout(()=>el.remove(),3800)}
function setSync(label,kind="ok"){$("#syncState").innerHTML='<i style="background:'+(kind==="busy"?"#d79a56":kind==="bad"?"#c56b61":"#71a88b")+'"></i>'+esc(label)}
function current(){return state.trips.find(t=>t.id===state.activeId)||null}
function tripDays(t){return Array.isArray(t.itinerary)?t.itinerary:[]}
function stopId(s){if(!s.id)s.id=uid();return s.id}
function dayStops(d){return Array.isArray(d.items)?d.items:[]}
function formatDateRange(t){return dateText(t.startDate)+" — "+dateText(t.endDate)}
function daysCount(t){return Math.max(1,Math.round((new Date(t.endDate)-new Date(t.startDate))/86400000)+1)}
function tripExpenses(t){return Array.isArray(t.expenseItems)?t.expenseItems:[]}
function reservations(t){return Array.isArray(t.reservations)?t.reservations:[]}
function checklist(t){return Array.isArray(t.checklist)?t.checklist:[]}
function notes(t){return Array.isArray(t.notes)?t.notes:[]}
function totalExpenses(t){return tripExpenses(t).reduce((a,x)=>a+(Number(x.amountKrw)||0),0)}
function donePercent(t){const a=checklist(t);return a.length?Math.round(a.filter(x=>x.done).length/a.length*100):0}
function normalizeTrip(row){
 const itinerary=Array.isArray(row.itinerary)?row.itinerary:[];
 for(const d of itinerary)for(const s of dayStops(d))stopId(s);
 return {id:row.id,destination:row.destination,startDate:row.start_date,endDate:row.end_date,travelers:row.travelers||1,targetBudget:Number(row.target_budget)||0,style:row.travel_style||"균형 잡힌 여행",transport:row.transport||"대중교통",preferences:row.preferences||{},itinerary,expenses:row.expenses||{},expenseItems:Array.isArray(row.expenses?.items)?row.expenses.items:[],checklist:Array.isArray(row.checklist)?row.checklist:[],reservations:Array.isArray(row.preferences?.reservations)?row.preferences.reservations:[],notes:Array.isArray(row.preferences?.notes)?row.preferences.notes:[],savedPlaces:Array.isArray(row.preferences?.savedPlaces)?row.preferences.savedPlaces:[],recommendations:Array.isArray(row.preferences?.recommendations)?row.preferences.recommendations:[],status:row.status||"upcoming",overview:row.preferences?.overview||"",tips:row.preferences?.tips||[],createdAt:row.created_at};
}
function localCache(){try{localStorage.setItem("waypoint-v2-cache",JSON.stringify({trips:state.trips,activeId:state.activeId,saved:state.saved}))}catch{}}
function restoreLocal(){try{const x=JSON.parse(localStorage.getItem("waypoint-v2-cache")||"null");if(x){state.trips=x.trips||[];state.activeId=x.activeId||null;state.saved=x.saved||state.saved}}catch{}}
async function refreshAuth(){
 const {data}=await db.auth.getSession();state.session=data.session;state.user=data.session?.user||null;
 updateAccountUI();
 if(state.user)await loadCloudTrips();else{restoreLocal();renderAll()}
}
function updateAccountUI(){
 const logged=!!state.user;
 $("#userLabel").textContent=state.user?.user_metadata?.display_name||state.user?.email?.split("@")[0]||"로그인 전";
 $("#userSub").textContent=logged?state.user.email:"계정에 여행 저장";
 $("#userAvatar").textContent=(state.user?.user_metadata?.display_name||state.user?.email||"W").slice(0,1).toUpperCase();
 $("#signOut").hidden=!logged;$("#authLogout").hidden=!logged;$("#authForm").hidden=logged;
 $("#accountInfo").textContent=logged?state.user.email+" 계정으로 동기화 중입니다.":"로그인하면 여행 데이터가 계정에 동기화됩니다.";
 $("#connectionBadge")?.remove();
}
async function loadCloudTrips(){
 setSync("동기화 중","busy");
 const {data,error}=await db.from("trips").select("*").order("updated_at",{ascending:false});
 if(error){setSync("동기화 오류","bad");toast("여행 목록을 불러오지 못했습니다: "+error.message);return}
 const cloud=(data||[]).map(normalizeTrip);
 // Keep local-only drafts when signed in; cloud rows are authoritative for matching IDs.
 const local=state.trips.filter(t=>!cloud.some(c=>c.id===t.id));
 state.trips=[...cloud,...local];if(!state.activeId||!state.trips.some(t=>t.id===state.activeId))state.activeId=state.trips[0]?.id||null;
 for(const t of state.trips.filter(x=>cloud.some(c=>c.id===x.id)))await loadNormalized(t);
 localCache();setSync("모든 변경 저장됨");renderAll();
}
async function loadNormalized(t){
 const [r,e,c,n]=await Promise.all([
 db.from("trip_reservations").select("*").eq("trip_id",t.id).order("departure_at",{ascending:true}),
 db.from("trip_expenses").select("*").eq("trip_id",t.id).order("spent_at",{ascending:false}),
 db.from("trip_checklist_items").select("*").eq("trip_id",t.id).order("position"),
 db.from("trip_notes").select("*").eq("trip_id",t.id).order("updated_at",{ascending:false})
 ]);
 if(!r.error&&r.data?.length)t.reservations=r.data.map(x=>({...x,id:x.id,type:x.reservation_type,title:x.title,departureAt:x.departure_at,arrivalAt:x.arrival_at,checkInAt:x.check_in_at,checkOutAt:x.check_out_at}));
 if(!e.error&&e.data?.length)t.expenseItems=e.data.map(x=>({id:x.id,title:x.title,category:x.category,amount:x.amount,currency:x.currency,amountKrw:x.amount_krw,rate:x.exchange_rate,rateDate:x.rate_date,paidBy:x.paid_by,splitType:x.split_type,date:x.spent_at,note:x.note}));
 if(!c.error&&c.data?.length)t.checklist=c.data.map(x=>({id:x.id,title:x.title,category:x.category,done:x.is_done,priority:x.priority,dueDate:x.due_at,assignee:x.assigned_to,note:x.note,source:x.source}));
 if(!n.error&&n.data?.length)t.notes=n.data.map(x=>({id:x.id,title:x.title,content:x.content,stopId:x.stop_id,createdAt:x.created_at}));
}
async function callAssistant(action,payload={},timeout=45000){
 const {data}=await db.auth.getSession();const token=data.session?.access_token;
 if(!token)throw new Error("AI 기능을 이용하려면 먼저 로그인해 주세요.");
 const response=await fetch(SUPABASE_URL+"/functions/v1/travel-assistant",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(timeout)});
 const dataJson=await response.json().catch(()=>({error:"서버 응답을 읽지 못했습니다."}));
 if(!response.ok||dataJson.ok===false)throw new Error(dataJson.error||"요청에 실패했습니다. ("+response.status+")");
 return dataJson;
}
async function persistTrip(t,{quiet=false}={}){
 if(!t)return;localCache();
 if(!state.user){setSync("이 기기에 저장됨");if(!quiet)toast("이 기기에 저장했습니다. 계정에 로그인하면 다른 기기에서도 이용할 수 있습니다.");return}
 setSync("저장 중","busy");
 const row={id:t.id,user_id:state.user.id,destination:t.destination,start_date:t.startDate,end_date:t.endDate,travelers:Number(t.travelers)||1,target_budget:Number(t.targetBudget)||0,travel_style:t.style||"균형 잡힌 여행",transport:t.transport||"대중교통",preferences:{...(t.preferences||{}),overview:t.overview||"",tips:t.tips||[],reservations:t.reservations||[],notes:t.notes||[],savedPlaces:t.savedPlaces||[],recommendations:t.recommendations||[]},itinerary:t.itinerary||[],expenses:{...(t.expenses||{}),items:t.expenseItems||[]},checklist:t.checklist||[],status:t.status||"upcoming",updated_at:new Date().toISOString()};
 let result=t.createdAt?await db.from("trips").update(row).eq("id",t.id).select().single():await db.from("trips").insert(row).select().single();
 if(result.error&&result.error.code==="23505")result=await db.from("trips").update(row).eq("id",t.id).select().single();
 if(result.error){setSync("저장 실패","bad");toast("저장 실패: "+result.error.message);return}
 t.createdAt=result.data.created_at;await syncNormalized(t);localCache();setSync("모든 변경 저장됨");if(!quiet)toast("여행 정보를 저장했습니다.");
}
async function syncNormalized(t){
 const days=tripDays(t);const dayRows=days.map((d,i)=>({trip_id:t.id,day_date:d.date,position:i,theme:d.theme||""}));
 if(dayRows.length){const {data,error}=await db.from("trip_days").upsert(dayRows,{onConflict:"trip_id,day_date"}).select("id,day_date");if(!error){const byDate=Object.fromEntries(data.map(x=>[x.day_date,x.id]));const stops=days.flatMap(d=>dayStops(d).map((s,i)=>({id:stopId(s),trip_id:t.id,day_id:byDate[d.date],position:i,place_id:s.placeId||null,name:s.name,category:s.category||"place",address:s.address||null,latitude:s.location?.latitude??s.latitude??null,longitude:s.location?.longitude??s.longitude??null,start_time:s.time||null,end_time:s.endTime||null,note:s.note||"",planned_cost:Number(s.cost)||0,currency:s.currency||"KRW",source:s.source||"ai"})).filter(x=>x.day_id));if(stops.length)await db.from("trip_stops").upsert(stops,{onConflict:"id"});const keep=stops.map(x=>x.id);let cleanup=db.from("trip_stops").delete().eq("trip_id",t.id);if(keep.length)cleanup=cleanup.not("id","in","("+keep.join(",")+")");await cleanup}}
 const rs=reservations(t).map(x=>({id:x.id||uid(),trip_id:t.id,reservation_type:x.type||"other",provider:x.provider||"",confirmation_code:x.confirmationCode||"",title:x.title||"",origin:x.origin||null,destination:x.destination||null,flight_number:x.flightNumber||null,departure_at:x.departureAt||null,arrival_at:x.arrivalAt||null,check_in_at:x.checkInAt||null,check_out_at:x.checkOutAt||null,status:x.status||"planned",price:x.price===""?null:Number(x.price)||null,currency:x.currency||"KRW",details:x.details||{}}));
 if(rs.length)await db.from("trip_reservations").upsert(rs,{onConflict:"id"});
 const es=tripExpenses(t).map(x=>({id:x.id||uid(),trip_id:t.id,title:x.title,category:x.category||"other",amount:Number(x.amount)||0,currency:x.currency||"KRW",amount_krw:Number(x.amountKrw)||0,exchange_rate:Number(x.rate)||1,rate_date:x.rateDate||null,paid_by:x.paidBy||"",split_type:x.splitType||"equal",spent_at:x.date||today(),note:x.note||""}));
 if(es.length)await db.from("trip_expenses").upsert(es,{onConflict:"id"});
 const cs=checklist(t).map((x,i)=>({id:x.id||uid(),trip_id:t.id,category:x.category||"tasks",title:x.title,is_done:!!x.done,priority:x.priority||"normal",due_at:x.dueDate||null,assigned_to:x.assignee||"",note:x.note||"",source:x.source||"manual",position:i}));
 if(cs.length)await db.from("trip_checklist_items").upsert(cs,{onConflict:"id"});
 const ns=notes(t).map(x=>({id:x.id||uid(),trip_id:t.id,stop_id:x.stopId||null,title:x.title||"",content:x.content||""}));
 if(ns.length)await db.from("trip_notes").upsert(ns,{onConflict:"id"});
}
function renderAll(){renderHome();renderTrips();renderSaved();if(state.view==="trip")renderTrip()}
function switchView(view){
 state.view=view;$$(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+view));$$(".rail-link[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
 const titles={home:"여행의 시작",trips:"내 여행",saved:"저장한 장소",settings:"설정",trip:current()?.destination||"여행 공간"};$("#topTitle").textContent=titles[view]||"여행 공간";
 $("#rail").classList.remove("open");$("#scrim").classList.remove("open");
 if(view==="trip")renderTrip();if(view==="home")renderHome();if(view==="trips")renderTrips();if(view==="saved")renderSaved();
}
function openTrip(id){state.activeId=id;state.tab="overview";state.day=0;switchView("trip");localCache()}
function renderHome(){
 const upcoming=state.trips.filter(t=>t.status!=="completed");$("#homeTrips").innerHTML=upcoming.slice(0,3).map(tripCard).join("");$("#homeEmpty").classList.toggle("show",!state.trips.length);
}
function tripCard(t){const cover=["#d9e9df","#e8e1d5","#dce6ed","#eee3d9"][Math.abs(t.destination.length)%4];return `<article class="trip-card" data-open-trip="${t.id}"><div class="trip-cover" style="background:linear-gradient(135deg,${cover},#b9d3c4)"><span>${esc(t.destination.toUpperCase())}</span><small class="cover-date">${esc(t.startDate)} — ${esc(t.endDate)}</small></div><div class="trip-card-body"><h3>${esc(t.destination)}</h3><div class="trip-meta">${daysCount(t)}일 · ${t.travelers}명 · ${esc(t.transport)}</div><div class="trip-card-bottom"><span>준비 ${donePercent(t)}% 완료</span><b>${money(t.targetBudget)}</b></div></div></article>`}
function renderTrips(){
 const q=($("#tripSearch")?.value||"").toLowerCase();const list=state.trips.filter(t=>(state.filter==="all"||t.status===state.filter)&&t.destination.toLowerCase().includes(q));
 $("#allTrips").innerHTML=list.map(tripCard).join("")||'<div class="empty-small">조건에 맞는 여행이 없습니다.</div>';
}
function openModal(content){$("#modalContent").innerHTML=content;$("#modalBackdrop").classList.add("open")}
function closeModal(){$("#modalBackdrop").classList.remove("open");$("#modalContent").innerHTML=""}
function createTripModal(){
 const start=addDays(today(),30),end=addDays(today(),34);
 openModal(`<p class="eyebrow">CREATE A JOURNEY</p><h2>어디로 떠나시나요?</h2><p class="muted">여행의 기본 정보를 입력하면 AI가 첫 일정 초안을 만듭니다.</p><form id="createTripForm"><div class="modal-grid"><label class="field">여행지<input name="destination" placeholder="예: 일본 오사카" required></label><label class="field">여행 인원<select name="travelers"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option></select></label><label class="field">출발일<input name="startDate" type="date" value="${start}" required></label><label class="field">도착일<input name="endDate" type="date" value="${end}" required></label><label class="field">총 예산 (KRW)<input name="budget" type="number" min="0" placeholder="1500000"></label><label class="field">이동 방식<select name="transport"><option>대중교통</option><option>도보 중심</option><option>렌터카</option><option>혼합</option></select></label><label class="field">여행 스타일<select name="style"><option>균형 잡힌 여행</option><option>맛집·미식</option><option>관광·명소</option><option>여유로운 휴식</option><option>쇼핑</option></select></label><label class="field">여행 요청사항<input name="notes" placeholder="예: 하루 3곳 정도, 대중교통 중심"></label></div><div class="notice">AI가 제안한 장소는 실제 장소 검색으로 확인한 뒤 일정에 표시합니다. 생성 후 모든 항목을 수정할 수 있습니다.</div><div class="modal-actions"><button type="button" class="button outline" id="cancelCreate">취소</button><button class="button primary" id="submitCreate">AI 일정 만들기 →</button></div></form>`);
 $("#cancelCreate").onclick=closeModal;
 $("#createTripForm").onsubmit=createTrip;
}
async function createTrip(e){
 e.preventDefault();if(state.loading)return;if(!state.user){toast("먼저 설정에서 로그인해 주세요.");closeModal();switchView("settings");return}
 const f=new FormData(e.currentTarget),t={id:uid(),destination:String(f.get("destination")).trim(),startDate:f.get("startDate"),endDate:f.get("endDate"),travelers:Number(f.get("travelers")),targetBudget:Number(f.get("budget"))||0,transport:f.get("transport"),style:f.get("style"),status:"upcoming",itinerary:[],expenseItems:[],expenses:{},reservations:[],checklist:[],notes:[],recommendations:[],savedPlaces:[],preferences:{},tips:[]};
 if(t.endDate<t.startDate){toast("도착일은 출발일 이후여야 합니다.");return}
 state.loading=true;$("#submitCreate").disabled=true;$("#submitCreate").textContent="일정 구성 중…";setSync("AI 일정 생성 중","busy");
 try{
 const ai=await callAssistant("generate",{trip:{destination:t.destination,startDate:t.startDate,endDate:t.endDate,travelers:t.travelers,targetBudget:t.targetBudget,transport:t.transport,style:t.style,notes:f.get("notes")||""}},55000);
 if(ai.itinerary.suggestedDestination)t.destination=ai.itinerary.suggestedDestination;
 t.overview=ai.itinerary.overview||"";t.tips=ai.itinerary.tips||[];
 t.recommendations=ai.itinerary.recommendations||[];
 t.itinerary=(ai.itinerary.days||[]).map(d=>({date:d.date,theme:d.theme||"",items:(d.items||[]).map(x=>({...x,id:uid(),time:x.time||"09:00",source:"ai"}))}));
 t.checklist=makeStarterChecklist(t);
 state.trips.unshift(t);state.activeId=t.id;await persistTrip(t,{quiet:true});
 closeModal();state.tab="plan";switchView("trip");toast("여행 초안이 만들어졌습니다. 실제 장소를 확인하고 동선을 다듬어 보세요.");
 enrichTripPlaces(t).then(()=>{persistTrip(t,{quiet:true});if(state.view==="trip")renderTrip()});
 }catch(err){toast(err.message||"일정 생성에 실패했습니다.");setSync("생성 실패","bad")}
 finally{state.loading=false}
}
function makeStarterChecklist(t){
 const international=!/대한민국|한국|korea/i.test(t.destination);const a=[
 ["booking","항공권 예약 정보 확인","high"],["booking","숙소 예약 및 체크인 시간 확인","high"],["finance","여행 예산과 결제 수단 점검","normal"],["documents","여권·신분증 유효기간 확인",international?"high":"normal"],["documents","예약 확인서와 여행 서류 저장","normal"],["tasks","휴대전화 로밍 또는 eSIM 준비","normal"],["tasks","여행지 날씨와 교통 정보 확인","normal"],["packing","충전기·보조배터리 챙기기","normal"],["packing","상비용품과 개인 물품 준비","normal"],["tasks","출발 전 집·교통편 확인","normal"]
 ];
 if(international)a.push(["documents","입국 요건과 필요한 서류 확인","high"],["finance","해외 결제 카드와 현지 통화 준비","normal"]);
 if(daysCount(t)>=5)a.push(["packing","여행 기간에 맞는 옷과 세탁 계획","low"]);
 return a.map(([category,title,priority])=>({id:uid(),category,title,priority,done:false,source:"auto"}));
}
async function enrichTripPlaces(t){
 const list=[];for(const d of tripDays(t))for(const s of dayStops(d))if(s.query||s.name)list.push(s);
 for(const s of list.slice(0,10)){try{const r=await callAssistant("places",{query:s.query||s.name},16000);const p=r.places?.find(x=>x.location?.latitude&&x.location?.longitude)||r.places?.[0];if(p){s.placeId=p.id;s.address=p.address;s.location=p.location;s.rating=p.rating;s.ratingCount=p.ratingCount;s.mapsUrl=p.mapsUrl;s.verified=true}}catch{}}
}
function renderTrip(){
 const t=current();if(!t){switchView("trips");return}
 $("#topTitle").textContent=t.destination;
 $("#tripHead").innerHTML=`<div><p class="eyebrow">YOUR TRIP WORKSPACE</p><h1>${esc(t.destination)}</h1><p>${formatDateRange(t)} · ${daysCount(t)}일 · ${t.travelers}명 · ${esc(t.transport)}</p></div><div class="trip-head-actions"><button class="button outline" id="editTrip">여행 정보 수정</button><button class="button outline" id="completeTrip">여행 완료 처리</button><button class="button primary" id="backTrips">내 여행으로</button><button class="tiny-btn" id="deleteTrip">삭제</button></div>`;
 $("#editTrip").onclick=()=>editTripModal(t);$("#backTrips").onclick=()=>switchView("trips");$("#completeTrip").onclick=async()=>{t.status=t.status==="completed"?"upcoming":"completed";await persistTrip(t,{quiet:true});renderTrip();toast(t.status==="completed"?"여행을 완료 처리했습니다.":"예정 상태로 변경했습니다.")};$("#completeTrip").textContent=t.status==="completed"?"예정으로 변경":"여행 완료 처리";$("#deleteTrip").onclick=()=>deleteTrip(t.id);
 $$(".trip-tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===state.tab));$$(".trip-panel").forEach(x=>x.classList.toggle("active",x.id==="panel-"+state.tab));
 renderOverview(t);
 if(state.tab==="plan")renderPlan(t);if(state.tab==="discover")renderDiscover(t);if(state.tab==="reservations")renderReservations(t);if(state.tab==="budget")renderBudget(t);if(state.tab==="prep")renderPrep(t);if(state.tab==="notes")renderNotes(t);
}
function setTab(tab){state.tab=tab;renderTrip()}
function renderOverview(t){
 const count=tripDays(t).reduce((a,d)=>a+dayStops(d).length,0),expense=totalExpenses(t),done=donePercent(t);
 $("#panel-overview").innerHTML=`<div class="kpi-grid"><div class="kpi"><span>여행 일정</span><b>${count}개 장소</b></div><div class="kpi"><span>예산 사용</span><b>${money(expense)}</b></div><div class="kpi"><span>준비 진행률</span><b>${done}%</b></div></div><div class="overview-grid"><div class="surface"><h3>여행 개요</h3><p class="muted">${esc(t.overview||"아직 여행 설명이 없습니다. 일정 탭에서 장소를 추가하고 여행을 완성해 보세요.")}</p><div class="progress-track"><i style="width:${done}%"></i></div><p class="muted">${checklist(t).filter(x=>x.done).length} / ${checklist(t).length}개 준비 완료</p><div class="section-title"><h3>날짜별 일정</h3><button class="text-button" data-open-tab="plan">일정 편집 →</button></div><div class="task-list">${tripDays(t).map((d,i)=>`<div class="task"><div class="stop-index">${String(i+1).padStart(2,"0")}</div><div class="task-copy"><b>${dateText(d.date)} · ${esc(d.theme||"여행 일정")}</b><small>${dayStops(d).length}개 장소</small></div></div>`).join("")||'<div class="empty-small">아직 일정이 없습니다.</div>'}</div></div><div class="surface"><h3>빠른 작업</h3><div class="quick-actions"><button class="quick-action" data-open-tab="plan"><span>⌖</span>일정과 지도</button><button class="quick-action" data-open-tab="discover"><span>⌕</span>장소 찾기</button><button class="quick-action" data-open-tab="reservations"><span>✈</span>항공·숙소</button><button class="quick-action" data-open-tab="budget"><span>₩</span>지출 추가</button><button class="quick-action" data-open-tab="prep"><span>☑</span>준비 체크</button><button class="quick-action" data-open-tab="notes"><span>✎</span>메모 작성</button></div><h3 style="margin-top:24px">여행 팁</h3><ul class="muted">${(t.tips||[]).map(x=>"<li>"+esc(x)+"</li>").join("")||"<li>여행 전 교통과 영업시간을 확인하세요.</li>"}</ul></div></div>`;
 $$("[data-open-tab]").forEach(b=>b.onclick=()=>setTab(b.dataset.openTab));
}
function renderPlan(t){
 const days=tripDays(t);if(!days.length){$("#panel-plan").innerHTML='<div class="empty-small">일정이 없습니다. 장소 탐색에서 방문지를 추가해 보세요.</div>';return}
 state.day=Math.min(state.day,days.length-1);const d=days[state.day];
 $("#panel-plan").innerHTML=`<div class="plan-layout"><div class="plan-left"><div class="plan-toolbar"><div><span class="eyebrow">DAY BY DAY</span><h3 style="margin:4px 0">하루의 동선</h3></div><button class="button outline small" id="addStop">＋ 장소 추가</button></div><div class="day-switcher">${days.map((x,i)=>`<button class="day-chip ${i===state.day?"active":""}" data-day="${i}">DAY ${i+1}<br>${x.date.slice(5).replace("-","/")}</button>`).join("")}</div><p class="day-summary">${dateText(d.date)} · ${esc(d.theme||"나만의 여행 코스")} · ${dayStops(d).length}곳</p><div class="stop-list" id="stopList">${dayStops(d).map((s,i)=>stopCard(s,i)).join("")||'<div class="empty-small">이 날짜에 등록된 장소가 없습니다.</div>'}</div><div class="surface" style="margin-top:12px"><div class="plan-toolbar"><b style="font-size:12px">이동 경로 계산</b><div class="route-controls"><select id="routeMode"><option value="TRANSIT">대중교통</option><option value="WALK">도보</option><option value="DRIVE">자동차</option></select><button class="button primary small" id="calcRoute">경로 계산</button></div></div><p class="muted" id="routeSummary">선택한 날짜의 장소 순서대로 실제 경로와 이동시간을 계산합니다.</p><div id="routeLegs"></div></div></div><div class="surface map-panel"><div class="map-head"><b>DAY ${state.day+1} 지도</b><span>${dayStops(d).filter(s=>s.location).length}개 위치 확인</span></div><div id="tripMap"></div><div class="map-legend">지도 데이터 © OpenStreetMap contributors · 경로는 Google Routes 결과를 사용합니다.</div></div></div>`;
 $$("[data-day]").forEach(b=>b.onclick=()=>{state.day=Number(b.dataset.day);renderPlan(t)});
 $("#addStop").onclick=()=>addStopModal(t,state.day);
 $$(".stop-card").forEach(card=>{card.addEventListener("dragstart",()=>{state.dragId=card.dataset.stopId;card.classList.add("dragging")});card.addEventListener("dragend",()=>card.classList.remove("dragging"));card.addEventListener("dragover",e=>e.preventDefault());card.addEventListener("drop",e=>{e.preventDefault();reorderStops(t,state.day,state.dragId,card.dataset.stopId)})});
 $$("[data-stop-edit]").forEach(b=>b.onclick=()=>editStopModal(t,state.day,b.dataset.stopEdit));
 $$("[data-stop-remove]").forEach(b=>b.onclick=()=>removeStop(t,state.day,b.dataset.stopRemove));
 $("#calcRoute").onclick=()=>calculateDayRoute(t,d);
 setTimeout(()=>renderMap(t,d),80);
}
function stopCard(s,i){return `<article class="stop-card" draggable="true" data-stop-id="${s.id}"><div class="stop-index">${String(i+1).padStart(2,"0")}</div><div><span class="stop-time">${esc(s.time||"시간 미정")} ${s.endTime?"— "+esc(s.endTime):""}</span><h4>${esc(s.name)}</h4><p>${esc(s.address||s.area||s.reason||"장소 정보를 확인해 주세요.")}</p>${s.note?'<p>메모 · '+esc(s.note)+'</p>':""}${s.verified?'<p style="color:#39775b">✓ 실제 장소 확인됨</p>':""}</div><div class="stop-actions"><button class="tiny-btn" data-stop-edit="${s.id}">편집</button><button class="tiny-btn" data-stop-remove="${s.id}">삭제</button></div></article>`}
function renderMap(t,d){
 if(!window.L)return;const el=$("#tripMap");if(!el)return;
 if(state.map){state.map.remove();state.map=null}
 const points=dayStops(d).filter(s=>s.location?.latitude&&s.location?.longitude);
 const center=points.length?[points[0].location.latitude,points[0].location.longitude]:[35.68,139.76];
 state.map=L.map(el,{scrollWheelZoom:false}).setView(center,points.length?12:4);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(state.map);
 state.markers=[];points.forEach((s,i)=>{const marker=L.marker([s.location.latitude,s.location.longitude]).addTo(state.map).bindPopup("<b>"+esc(s.name)+"</b><br>"+esc(s.time||""));state.markers.push(marker)});
 if(points.length>1){const bounds=L.latLngBounds(points.map(s=>[s.location.latitude,s.location.longitude]));state.map.fitBounds(bounds.pad(.18))}
 setTimeout(()=>state.map?.invalidateSize(),120);
}
function decodePolyline(encoded){
 let index=0,lat=0,lng=0,coords=[];while(index<encoded.length){let b,shift=0,result=0;do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5}while(b>=0x20);const dlat=result&1?~(result>>1):(result>>1);lat+=dlat;shift=0;result=0;do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5}while(b>=0x20);const dlng=result&1?~(result>>1):(result>>1);lng+=dlng;coords.push([lat/1e5,lng/1e5])}return coords;
}
async function calculateDayRoute(t,d){
 const stops=dayStops(d).filter(s=>s.location?.latitude&&s.location?.longitude);
 if(stops.length<2){toast("실제 위치가 확인된 장소가 두 곳 이상 필요합니다.");return}
 const mode=$("#routeMode").value;$("#routeSummary").textContent="실제 이동 경로를 계산하고 있습니다…";$("#calcRoute").disabled=true;
 try{
 const legs=[];for(let i=0;i<stops.length-1;i++){const r=await callAssistant("route",{origin:{name:stops[i].name,address:stops[i].address,location:stops[i].location},destination:{name:stops[i+1].name,address:stops[i+1].address,location:stops[i+1].location},travelMode:mode},25000);legs.push(r)}
 const lines=legs.map(x=>x.encodedPolyline?decodePolyline(x.encodedPolyline):[]);
 state.routeLayers.forEach(x=>x.remove());state.routeLayers=[];
 lines.filter(x=>x.length).forEach(coords=>{const line=L.polyline(coords,{color:"#1b795c",weight:5,opacity:.8}).addTo(state.map);state.routeLayers.push(line)});
 const totalMeters=legs.reduce((a,x)=>a+(Number(x.distanceMeters)||0),0);const totalSecs=legs.reduce((a,x)=>a+(parseInt(x.duration)||0),0);
 $("#routeSummary").textContent="총 "+(totalMeters/1000).toFixed(1)+" km · 약 "+Math.round(totalSecs/60)+"분 · "+(mode==="WALK"?"도보":mode==="DRIVE"?"자동차":"대중교통")+" 기준";
 $("#routeLegs").innerHTML=legs.map((x,i)=>`<div class="expense-item"><div><b>${esc(stops[i].name)} → ${esc(stops[i+1].name)}</b><small>${(Number(x.distanceMeters)/1000).toFixed(1)} km</small></div><strong>${Math.round(parseInt(x.duration)/60)}분</strong></div>`).join("");
 }catch(err){$("#routeSummary").textContent=err.message;toast("경로 계산 실패: "+err.message)}
 finally{$("#calcRoute").disabled=false}
}
function reorderStops(t,dayIndex,from,to){
 const a=dayStops(tripDays(t)[dayIndex]);const i=a.findIndex(x=>x.id===from),j=a.findIndex(x=>x.id===to);if(i<0||j<0||i===j)return;const [x]=a.splice(i,1);a.splice(j,0,x);persistTrip(t,{quiet:true});renderPlan(t);toast("일정 순서를 변경했습니다. 이동 경로를 다시 계산해 주세요.");
}
function addStopModal(t,dayIndex){
 openModal(`<p class="eyebrow">ADD TO ITINERARY</p><h2>일정에 장소 추가</h2><form id="stopForm"><div class="modal-grid"><label class="field">장소 이름<input name="name" required placeholder="예: 오사카성"></label><label class="field">방문 시간<input name="time" type="time" value="10:00"></label><label class="field">주소<input name="address" placeholder="주소 또는 지역"></label><label class="field">예상 비용<input name="cost" type="number" min="0" placeholder="0"></label><label class="field">분류<select name="category"><option>명소</option><option>식당</option><option>카페</option><option>쇼핑</option><option>숙소</option><option>기타</option></select></label><label class="field">메모<input name="note" placeholder="예약 여부, 방문 팁 등"></label></div><div class="modal-actions"><button type="button" class="button outline" id="cancelStop">취소</button><button class="button primary">일정에 추가</button></div></form>`);
 $("#cancelStop").onclick=closeModal;$("#stopForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),s={id:uid(),name:f.get("name"),time:f.get("time"),address:f.get("address"),cost:Number(f.get("cost"))||0,category:f.get("category"),note:f.get("note"),source:"manual",query:f.get("name")+" "+t.destination};tripDays(t)[dayIndex].items.push(s);closeModal();await persistTrip(t,{quiet:true});try{const r=await callAssistant("places",{query:s.query});const p=r.places?.[0];if(p){s.address=p.address;s.location=p.location;s.placeId=p.id;s.rating=p.rating;s.mapsUrl=p.mapsUrl;s.verified=true;await persistTrip(t,{quiet:true})}}catch{}renderTrip();toast("일정에 장소를 추가했습니다.")};
}
function editStopModal(t,dayIndex,id){
 const s=dayStops(tripDays(t)[dayIndex]).find(x=>x.id===id);if(!s)return;
 openModal(`<p class="eyebrow">EDIT STOP</p><h2>장소 정보 수정</h2><form id="editStopForm"><div class="modal-grid"><label class="field">장소 이름<input name="name" value="${esc(s.name)}" required></label><label class="field">방문 시간<input name="time" type="time" value="${esc(s.time||"")}"></label><label class="field">주소<input name="address" value="${esc(s.address||"")}"></label><label class="field">예상 비용<input name="cost" type="number" value="${Number(s.cost)||0}"></label><label class="field">메모<input name="note" value="${esc(s.note||"")}"></label></div><div class="modal-actions"><button type="button" class="button outline" id="cancelEditStop">취소</button><button class="button primary">저장</button></div></form>`);
 $("#cancelEditStop").onclick=closeModal;$("#editStopForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);Object.assign(s,{name:f.get("name"),time:f.get("time"),address:f.get("address"),cost:Number(f.get("cost"))||0,note:f.get("note")});closeModal();await persistTrip(t,{quiet:true});renderTrip();toast("장소 정보를 저장했습니다.")};
}
async function removeStop(t,dayIndex,id){if(!confirm("이 장소를 일정에서 삭제할까요?"))return;tripDays(t)[dayIndex].items=dayStops(tripDays(t)[dayIndex]).filter(x=>x.id!==id);await db.from("trip_stops").delete().eq("id",id);await persistTrip(t,{quiet:true});renderPlan(t);toast("일정에서 삭제했습니다.")}
function renderDiscover(t){
 $("#panel-discover").innerHTML=`<div class="discover-layout"><div class="surface"><span class="eyebrow">DISCOVER PLACES</span><h3 style="margin:5px 0 13px">어디를 가볼까요?</h3><form id="placeSearchForm" class="search-box"><input id="placeQuery" placeholder="${esc(t.destination)} 맛집, 미술관, 카페…" required><button class="button primary">검색</button></form><p class="muted">Google Places에서 실제 장소를 검색합니다. 검색 결과에는 장소명·주소·평점이 표시됩니다.</p><div id="placeSearchResults" class="place-results"></div></div><div class="surface"><span class="eyebrow">AI SHORTLIST</span><h3 style="margin:5px 0 13px">이번 여행 추천 장소</h3><div class="place-results">${(t.recommendations||[]).map(p=>placeCard(p)).join("")||'<div class="empty-small">추천 장소가 없습니다. AI 일정 생성 후 표시됩니다.</div>'}</div></div></div>`;
 $("#placeSearchForm").onsubmit=searchPlaces;
 $$("[data-add-recommend]").forEach(b=>b.onclick=()=>addRecommendation(t,b.dataset.addRecommend));
}
function placeCard(p){return `<article class="place-card"><div><h4>${esc(p.name)}</h4><p>${esc(p.address||p.area||p.reason||p.category||"추천 장소")}</p><span class="rating">${p.rating?"★ "+p.rating+" ("+(p.ratingCount||0)+")":""}</span></div><div class="place-actions"><button class="tiny-btn" data-add-recommend="${esc(p.name)}">일정에 추가</button><button class="tiny-btn" data-save-place="${esc(p.name)}">저장</button>${p.mapsUrl?'<a class="tiny-btn" href="'+esc(p.mapsUrl)+'" target="_blank" rel="noopener">지도 보기</a>':""}</div></article>`}
async function searchPlaces(e){
 e.preventDefault();const q=$("#placeQuery").value.trim();$("#placeSearchResults").innerHTML='<div class="empty-small">장소를 검색하고 있습니다…</div>';
 try{const r=await callAssistant("places",{query:q},18000);state.lastSearch=r.places||[];$("#placeSearchResults").innerHTML=state.lastSearch.map(p=>placeCard({...p,reason:p.address})).join("")||'<div class="empty-small">검색 결과가 없습니다.</div>';$$("[data-add-recommend]").forEach(b=>b.onclick=()=>addPlaceFromSearch(b.dataset.addRecommend))}catch(err){$("#placeSearchResults").innerHTML='<div class="notice">'+esc(err.message)+'</div>'}
}
function addPlaceFromSearch(name){const t=current();const d=tripDays(t)[state.day]||tripDays(t)[0];if(!d){toast("먼저 일정을 만들어 주세요.");return}const p=(state.lastSearch||[]).find(x=>x.name===name);d.items.push({id:uid(),name,time:"",address:p?.address||"",location:p?.location,placeId:p?.id,rating:p?.rating,mapsUrl:p?.mapsUrl,category:"장소",source:"places",verified:!!p});persistTrip(t,{quiet:true});setTab("plan");toast("일정에 추가했습니다.")}
function addRecommendation(t,name){
 const p=(t.recommendations||[]).find(x=>x.name===name);const d=tripDays(t)[state.day]||tripDays(t)[0];if(!d){toast("먼저 날짜별 일정을 만들어 주세요.");return}
 d.items.push({id:uid(),name:p.name,time:"",category:p.category,reason:p.reason,query:p.query,source:"recommendation"});persistTrip(t,{quiet:true});setTab("plan");enrichTripPlaces(t).then(()=>persistTrip(t,{quiet:true}));
}
function renderReservations(t){
 const items=reservations(t);
 $("#panel-reservations").innerHTML=`<div class="section-title"><div><span class="eyebrow">BOOKING DETAILS</span><h2>예약 정보</h2></div><button class="button primary" id="addReservation">＋ 예약 추가</button></div><div class="notice">항공권·숙소 확인서 PDF 또는 이미지에서 정보를 읽어 초안을 만들 수 있습니다. 저장 전에 추출 결과를 확인하고 수정할 수 있습니다. 항공편 실시간 운항 상태 조회는 별도 항공 데이터 제공업체 연동이 필요합니다.</div><div class="reservation-grid">${items.map(reservationCard).join("")||'<div class="empty-small">등록된 예약이 없습니다. 항공권이나 숙소 정보를 추가해 보세요.</div>'}</div><div class="surface" style="margin-top:16px"><h3>예약 확인서에서 정보 가져오기</h3><p class="muted">PDF, JPG, PNG 파일을 선택하면 항공편·숙소 정보를 추출해 입력 양식에 채웁니다.</p><input id="reservationFile" type="file" accept=".pdf,image/png,image/jpeg,image/webp"><div id="extractStatus" class="muted"></div></div>`;
 $("#addReservation").onclick=()=>reservationModal(t);
 $("#reservationFile").onchange=e=>extractReservation(e.target.files?.[0],t);
 $$("[data-res-edit]").forEach(b=>b.onclick=()=>reservationModal(t,b.dataset.resEdit));
 $$("[data-res-delete]").forEach(b=>b.onclick=()=>deleteReservation(t,b.dataset.resDelete));
}
function reservationCard(r){const typ={flight:"항공권",hotel:"숙소",rail:"기차",bus:"버스",car:"렌터카",activity:"체험",other:"기타"}[r.type||r.reservation_type]||"예약";return `<article class="reservation-card"><div class="reservation-top"><span class="reservation-type">${typ}</span><span class="muted">${esc(r.status||"예약 예정")}</span></div><h4>${esc(r.title||r.provider||typ)}</h4><p>${esc(r.origin||"")} ${r.destination?"→ "+esc(r.destination):""}</p><p>${r.departureAt?new Date(r.departureAt).toLocaleString("ko-KR"):r.checkInAt?"체크인 "+new Date(r.checkInAt).toLocaleString("ko-KR"):"날짜 미입력"}</p><p>예약번호 · ${esc(r.confirmationCode||"미입력")}</p><div class="reservation-actions"><button class="tiny-btn" data-res-edit="${r.id}">수정</button><button class="tiny-btn" data-res-delete="${r.id}">삭제</button></div></article>`}
function reservationModal(t,id=null,extracted={}){
 const old=reservations(t).find(x=>x.id===id)||{};const v={...old,...extracted};
 openModal(`<p class="eyebrow">TRAVEL RESERVATION</p><h2>${id?"예약 정보 수정":"예약 정보 추가"}</h2><form id="reservationForm"><div class="modal-grid"><label class="field">예약 종류<select name="type"><option value="flight" ${v.type==="flight"?"selected":""}>항공권</option><option value="hotel" ${v.type==="hotel"?"selected":""}>숙소</option><option value="rail" ${v.type==="rail"?"selected":""}>기차</option><option value="bus">버스</option><option value="car">렌터카</option><option value="activity">체험</option><option value="other">기타</option></select></label><label class="field">항공사·업체<input name="provider" value="${esc(v.provider||"")}"></label><label class="field">예약명<input name="title" value="${esc(v.title||"")}" required></label><label class="field">예약번호<input name="confirmationCode" value="${esc(v.confirmationCode||"")}"></label><label class="field">출발지<input name="origin" value="${esc(v.origin||"")}"></label><label class="field">도착지<input name="destination" value="${esc(v.destination||"")}"></label><label class="field">항공편 번호<input name="flightNumber" value="${esc(v.flightNumber||"")}" placeholder="예: KE721"></label><label class="field">출발 일시<input name="departureAt" type="datetime-local" value="${inputDate(v.departureAt)}"></label><label class="field">도착 일시<input name="arrivalAt" type="datetime-local" value="${inputDate(v.arrivalAt)}"></label><label class="field">체크인<input name="checkInAt" type="datetime-local" value="${inputDate(v.checkInAt)}"></label><label class="field">체크아웃<input name="checkOutAt" type="datetime-local" value="${inputDate(v.checkOutAt)}"></label><label class="field">금액<input name="price" type="number" min="0" value="${v.price||""}"></label><label class="field">통화<select name="currency"><option>KRW</option><option>JPY</option><option>USD</option><option>EUR</option><option>SGD</option></select></label></div><div class="modal-actions"><button type="button" class="button outline" id="cancelReservation">취소</button><button class="button primary">예약 저장</button></div></form>`);
 $("#cancelReservation").onclick=closeModal;$("#reservationForm").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),x=Object.fromEntries(f.entries());x.id=id||uid();x.price=x.price?Number(x.price):null;const list=reservations(t),idx=list.findIndex(a=>a.id===id);if(idx>=0)list[idx]=x;else list.push(x);t.reservations=list;closeModal();await persistTrip(t,{quiet:true});renderReservations(t);toast("예약 정보를 저장했습니다.")};
}
function inputDate(v){if(!v)return"";const d=new Date(v);return isNaN(d)?"":new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
async function deleteReservation(t,id){if(!confirm("예약 정보를 삭제할까요?"))return;t.reservations=reservations(t).filter(x=>x.id!==id);await db.from("trip_reservations").delete().eq("id",id);await persistTrip(t,{quiet:true});renderReservations(t)}
async function extractReservation(file,t){
 if(!file)return;$("#extractStatus").textContent="파일을 읽고 예약 정보를 분석하고 있습니다…";
 try{
 let text="",image=null;
 if(file.type==="application/pdf"){
  const pdfjs=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;for(let i=1;i<=Math.min(pdf.numPages,8);i++){const page=await pdf.getPage(i),content=await page.getTextContent();text+=content.items.map(x=>x.str).join(" ")+"\n"}
 }else{const buf=new Uint8Array(await file.arrayBuffer());let binary="";for(let i=0;i<buf.length;i+=0x8000)binary+=String.fromCharCode(...buf.subarray(i,i+0x8000));image={mimeType:file.type,data:btoa(binary)}}
 const result=await callAssistant("parse-reservation",{text,image},50000);$("#extractStatus").textContent="정보를 추출했습니다. 내용을 확인하고 저장해 주세요.";reservationModal(t,null,result.reservation||{});
 }catch(err){$("#extractStatus").textContent="정보 추출 실패: "+err.message;toast(err.message)}
}
function renderBudget(t){
 const expenses=tripExpenses(t),sum=totalExpenses(t),remaining=Math.max(0,(Number(t.targetBudget)||0)-sum);
 $("#panel-budget").innerHTML=`<div class="budget-top"><div class="kpi"><span>전체 예산</span><b>${money(t.targetBudget)}</b></div><div class="kpi"><span>실제 지출</span><b>${money(sum)}</b></div><div class="kpi"><span>남은 예산</span><b>${money(remaining)}</b></div><div class="kpi"><span>지출 건수</span><b>${expenses.length}건</b></div></div><div class="surface" style="margin-bottom:15px"><div class="section-title"><div><h3>예산 목표</h3><p class="muted">총 예산을 수정할 수 있습니다.</p></div><button class="button outline small" id="editBudgetTarget">예산 수정</button></div><div class="progress-track"><i style="width:${Math.min(100,t.targetBudget?sum/t.targetBudget*100:0)}%"></i></div><p class="muted">${t.targetBudget?Math.round(sum/t.targetBudget*100):0}% 사용</p></div><div class="budget-layout"><div class="surface"><div class="section-title"><div><h3>지출 내역</h3><p class="muted">한 건씩 기록하고 여행지 통화와 원화 금액을 함께 보관합니다.</p></div><button class="button primary small" id="addExpense">＋ 지출 추가</button></div><div class="expense-list">${expenses.map(expenseCard).join("")||'<div class="empty-small">아직 지출 내역이 없습니다.</div>'}</div></div><div class="surface"><h3>통화 변환기</h3><p class="muted">최신 ECB 기준 환율을 조회합니다. 시장 실시간 호가가 아닌 최신 공개 기준 환율입니다.</p><div class="form-row"><label class="field">금액<input id="fxAmount" type="number" value="1000"></label><label class="field">통화<select id="fxCurrency"><option>JPY</option><option>USD</option><option>EUR</option><option>SGD</option><option>GBP</option><option>KRW</option></select></label></div><div class="kpi" style="margin-top:8px"><span>원화 환산 금액</span><b id="fxResult">조회 중…</b><small class="muted" id="fxDate"></small></div><button class="button outline small" id="refreshFx" style="margin-top:12px">환율 새로고침</button><div class="notice">기존 지출은 입력 당시 환율을 보존합니다. 환율이 바뀌어도 과거 원화 금액을 자동 변경하지 않습니다.</div><h3 style="margin-top:20px">카테고리별 지출</h3><div id="categoryBreakdown"></div></div></div>`;
 $("#addExpense").onclick=()=>expenseModal(t);$("#editBudgetTarget").onclick=()=>budgetTargetModal(t);$("#refreshFx").onclick=()=>loadFx($("#fxCurrency").value,true);
 $("#fxCurrency").onchange=()=>loadFx($("#fxCurrency").value);$("#fxAmount").oninput=()=>updateFxResult();
 $$("[data-expense-edit]").forEach(b=>b.onclick=()=>expenseModal(t,b.dataset.expenseEdit));$$("[data-expense-delete]").forEach(b=>b.onclick=()=>deleteExpense(t,b.dataset.expenseDelete));
 renderCategoryBreakdown(t);loadFx($("#fxCurrency").value);
}
function expenseCard(x){return `<div class="expense-item"><div><b>${esc(x.title)}</b><small>${esc(x.category)} · ${esc(x.date||"")} · ${x.amount} ${esc(x.currency)}</small></div><div style="text-align:right"><strong>${money(x.amountKrw)}</strong><div><button class="tiny-btn" data-expense-edit="${x.id}">편집</button><button class="tiny-btn" data-expense-delete="${x.id}">삭제</button></div></div></div>`}
function expenseModal(t,id=null){
 const x=tripExpenses(t).find(a=>a.id===id)||{};
 openModal(`<p class="eyebrow">EXPENSE TRACKER</p><h2>${id?"지출 수정":"지출 추가"}</h2><form id="expenseForm"><div class="modal-grid"><label class="field">항목<input name="title" value="${esc(x.title||"")}" required placeholder="예: 장어덮밥 점심"></label><label class="field">카테고리<select name="category"><option value="food">식비</option><option value="transport">교통</option><option value="stay">숙박</option><option value="activity">관광·체험</option><option value="shopping">쇼핑</option><option value="other">기타</option></select></label><label class="field">금액<input name="amount" type="number" min="0" value="${x.amount||""}" required></label><label class="field">통화<select name="currency"><option>KRW</option><option>JPY</option><option>USD</option><option>EUR</option><option>SGD</option><option>GBP</option></select></label><label class="field">결제자<input name="paidBy" value="${esc(x.paidBy||"")}" placeholder="예: 진호"></label><label class="field">분담 방식<select name="splitType"><option value="equal">균등 분담</option><option value="payer">결제자 부담</option></select></label><label class="field">날짜<input name="date" type="date" value="${x.date||today()}"></label><label class="field">메모<input name="note" value="${esc(x.note||"")}"></label></div><p class="muted" id="expenseFxPreview"></p><div class="modal-actions"><button type="button" class="button outline" id="cancelExpense">취소</button><button class="button primary">지출 저장</button></div></form>`);
 const form=$("#expenseForm");form.elements.currency.value=x.currency||"KRW";form.elements.category.value=x.category||"food";form.elements.splitType.value=x.splitType||"equal";$("#cancelExpense").onclick=closeModal;
 const preview=async()=>{const cur=form.elements.currency.value,amt=Number(form.elements.amount.value)||0;if(cur==="KRW"){$("#expenseFxPreview").textContent="원화 "+money(amt);return}try{const rate=await getRate(cur);$("#expenseFxPreview").textContent="환율 "+rate.rate.toFixed(4)+" KRW / "+cur+" · 환산 "+money(amt*rate.rate)+" · "+rate.date}catch(e){$("#expenseFxPreview").textContent=e.message}};
 form.elements.currency.onchange=preview;form.elements.amount.oninput=preview;preview();
 form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),cur=f.get("currency"),amount=Number(f.get("amount"))||0,fx=cur==="KRW"?{rate:1,date:today()}:await getRate(cur);const item={id:id||uid(),title:f.get("title"),category:f.get("category"),amount,currency:cur,amountKrw:Math.round(amount*fx.rate),rate:fx.rate,rateDate:fx.date,paidBy:f.get("paidBy"),splitType:f.get("splitType"),date:f.get("date"),note:f.get("note")};const a=tripExpenses(t),i=a.findIndex(z=>z.id===id);if(i>=0)a[i]=item;else a.unshift(item);t.expenseItems=a;closeModal();await persistTrip(t,{quiet:true});renderBudget(t);toast("지출 내역을 저장했습니다.")};
}
function budgetTargetModal(t){openModal(`<h2>여행 예산 수정</h2><form id="targetForm"><label class="field">총 예산 (KRW)<input type="number" name="target" min="0" value="${t.targetBudget}"></label><div class="modal-actions"><button type="button" class="button outline" id="targetCancel">취소</button><button class="button primary">저장</button></div></form>`);$("#targetCancel").onclick=closeModal;$("#targetForm").onsubmit=async e=>{e.preventDefault();t.targetBudget=Number(new FormData(e.currentTarget).get("target"))||0;closeModal();await persistTrip(t,{quiet:true});renderBudget(t)}}
async function deleteExpense(t,id){if(!confirm("이 지출 내역을 삭제할까요?"))return;t.expenseItems=tripExpenses(t).filter(x=>x.id!==id);await db.from("trip_expenses").delete().eq("id",id);await persistTrip(t,{quiet:true});renderBudget(t)}
async function getRate(currency){
 if(currency==="KRW")return{rate:1,date:today()};
 const cached=state.rates[currency];if(cached&&Date.now()-cached.fetched<3600000)return cached;
 const r=await fetch("https://api.frankfurter.dev/v1/latest?base="+encodeURIComponent(currency)+"&symbols=KRW");if(!r.ok)throw new Error("환율 정보를 가져오지 못했습니다.");const d=await r.json();const rate=Number(d.rates?.KRW);if(!rate)throw new Error("해당 통화의 원화 환율이 없습니다.");state.rates[currency]={rate,date:d.date,fetched:Date.now()};return state.rates[currency];
}
async function loadFx(currency,force=false){$("#fxResult").textContent="조회 중…";try{if(force)delete state.rates[currency];const r=await getRate(currency);state.rateDate=r.date;$("#fxDate").textContent="기준일 "+r.date+" · Frankfurter / ECB";updateFxResult()}catch(e){$("#fxResult").textContent="조회 실패";$("#fxDate").textContent=e.message}}
function updateFxResult(){const cur=$("#fxCurrency")?.value,amount=Number($("#fxAmount")?.value)||0,rate=state.rates[cur]?.rate;if(rate)$("#fxResult").textContent=money(amount*rate)+" ("+rate.toFixed(4)+" KRW / "+cur+")"}
function renderCategoryBreakdown(t){const a=tripExpenses(t),groups={};for(const x of a)groups[x.category]=(groups[x.category]||0)+Number(x.amountKrw||0);const labels={food:"식비",transport:"교통",stay:"숙박",activity:"관광·체험",shopping:"쇼핑",other:"기타"};$("#categoryBreakdown").innerHTML=Object.entries(groups).map(([k,v])=>`<div class="expense-item"><b>${labels[k]||k}</b><strong>${money(v)}</strong></div>`).join("")||'<p class="muted">지출을 추가하면 카테고리별로 집계됩니다.</p>'}
function renderPrep(t){
 const items=checklist(t),done=items.filter(x=>x.done).length,cats=[["documents","서류"],["booking","예약"],["finance","결제"],["packing","준비물"],["tasks","할 일"]];
 $("#panel-prep").innerHTML=`<div class="section-title"><div><span class="eyebrow">READY FOR DEPARTURE</span><h2>여행 준비 현황</h2><p class="muted">${done} / ${items.length}개 완료 · ${items.length?Math.round(done/items.length*100):0}%</p></div><button class="button primary" id="addTask">＋ 할 일 추가</button></div><div class="checklist-layout"><div class="surface"><div class="progress-track"><i style="width:${items.length?done/items.length*100:0}%"></i></div><div class="task-list" style="margin-top:14px">${items.map(taskCard).join("")||'<div class="empty-small">준비 항목이 없습니다.</div>'}</div></div><div class="surface"><h3>자동 추천 준비 항목</h3><p class="muted">여행지·기간에 따라 기본 항목을 구성했습니다. 필요한 항목은 자유롭게 수정할 수 있습니다.</p><div class="task-list">${cats.map(([k,l])=>`<div class="expense-item"><b>${l}</b><small>${items.filter(x=>x.category===k).length}개</small></div>`).join("")}</div><button class="button outline small" id="addChecklistPreset" style="margin-top:15px">추천 항목 더 추가</button></div></div>`;
 $$("[data-task-toggle]").forEach(x=>x.onchange=()=>toggleTask(t,x.dataset.taskToggle,x.checked));$$("[data-task-delete]").forEach(x=>x.onclick=()=>deleteTask(t,x.dataset.taskDelete));$("#addTask").onclick=()=>taskModal(t);$("#addChecklistPreset").onclick=()=>addPresetTasks(t);
}
function taskCard(x){return `<div class="task ${x.done?"done":""}"><input type="checkbox" data-task-toggle="${x.id}" ${x.done?"checked":""}><div class="task-copy"><b>${esc(x.title)}</b><small>${esc(x.category)} ${x.dueDate?"· 기한 "+x.dueDate:""} ${x.assignee?"· "+esc(x.assignee):""}</small></div><span class="priority">${x.priority==="high"?"중요":x.priority==="low"?"여유":"일반"}</span><button class="tiny-btn" data-task-delete="${x.id}">삭제</button></div>`}
async function toggleTask(t,id,done){const x=checklist(t).find(x=>x.id===id);if(x)x.done=done;await persistTrip(t,{quiet:true});renderPrep(t)}
async function deleteTask(t,id){t.checklist=checklist(t).filter(x=>x.id!==id);await db.from("trip_checklist_items").delete().eq("id",id);await persistTrip(t,{quiet:true});renderPrep(t)}
function taskModal(t){openModal(`<p class="eyebrow">PREPARATION</p><h2>준비 항목 추가</h2><form id="taskForm"><div class="modal-grid"><label class="field">할 일<input name="title" required placeholder="예: 공항 이동 수단 확인"></label><label class="field">분류<select name="category"><option value="tasks">할 일</option><option value="documents">서류</option><option value="booking">예약</option><option value="finance">결제</option><option value="packing">준비물</option></select></label><label class="field">우선순위<select name="priority"><option value="normal">일반</option><option value="high">중요</option><option value="low">여유</option></select></label><label class="field">기한<input name="dueDate" type="date"></label><label class="field">담당자<input name="assignee" placeholder="이름"></label><label class="field">메모<input name="note"></label></div><div class="modal-actions"><button type="button" class="button outline" id="taskCancel">취소</button><button class="button primary">추가</button></div></form>`);$("#taskCancel").onclick=closeModal;$("#taskForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.currentTarget));t.checklist.push({id:uid(),...x,done:false,source:"manual"});closeModal();await persistTrip(t,{quiet:true});renderPrep(t)}}
async function addPresetTasks(t){const presets=["여행지 대중교통 앱 설치","오프라인 지도 저장","여행자 보험 확인","숙소까지 이동 방법 확인","여행 일정과 예약 시간 재확인"];const exists=checklist(t).map(x=>x.title);for(const title of presets)if(!exists.includes(title))t.checklist.push({id:uid(),title,category:"tasks",priority:"normal",done:false,source:"template"});await persistTrip(t,{quiet:true});renderPrep(t);toast("추천 준비 항목을 추가했습니다.")}
function renderNotes(t){$("#panel-notes").innerHTML=`<div class="section-title"><div><span class="eyebrow">TRIP JOURNAL</span><h2>여행 메모</h2><p class="muted">예약 메모, 방문 팁, 떠오른 아이디어를 기록하세요.</p></div><button class="button primary" id="addNote">＋ 메모 작성</button></div><div class="note-grid">${notes(t).map(n=>`<article class="note-card"><small>${n.createdAt?dateText(n.createdAt.slice(0,10)):"여행 메모"}</small><h4>${esc(n.title||"제목 없음")}</h4><p>${esc(n.content)}</p><div class="reservation-actions"><button class="tiny-btn" data-note-edit="${n.id}">편집</button><button class="tiny-btn" data-note-delete="${n.id}">삭제</button></div></article>`).join("")||'<div class="empty-small">아직 메모가 없습니다.</div>'}</div>`;$("#addNote").onclick=()=>noteModal(t);$$("[data-note-edit]").forEach(b=>b.onclick=()=>noteModal(t,b.dataset.noteEdit));$$("[data-note-delete]").forEach(b=>b.onclick=()=>deleteNote(t,b.dataset.noteDelete))}
function noteModal(t,id=null){const old=notes(t).find(x=>x.id===id)||{};openModal(`<p class="eyebrow">TRIP NOTES</p><h2>${id?"메모 수정":"새 메모"}</h2><form id="noteForm"><label class="field">제목<input name="title" value="${esc(old.title||"")}" placeholder="예: 교토에서 꼭 먹을 것"></label><label class="field">내용<textarea name="content" rows="6" required placeholder="기억할 내용이나 방문 팁을 적어두세요.">${esc(old.content||"")}</textarea></label><div class="modal-actions"><button type="button" class="button outline" id="noteCancel">취소</button><button class="button primary">저장</button></div></form>`);$("#noteCancel").onclick=closeModal;$("#noteForm").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));if(id)Object.assign(old,v);else t.notes.unshift({id:uid(),...v,createdAt:new Date().toISOString()});closeModal();await persistTrip(t,{quiet:true});renderNotes(t)}}
async function deleteNote(t,id){t.notes=notes(t).filter(x=>x.id!==id);await db.from("trip_notes").delete().eq("id",id);await persistTrip(t,{quiet:true});renderNotes(t)}
function editTripModal(t){openModal(`<p class="eyebrow">TRIP SETTINGS</p><h2>여행 정보 수정</h2><form id="editTripForm"><div class="modal-grid"><label class="field">여행지<input name="destination" value="${esc(t.destination)}"></label><label class="field">인원<input name="travelers" type="number" min="1" value="${t.travelers}"></label><label class="field">출발일<input name="startDate" type="date" value="${t.startDate}"></label><label class="field">도착일<input name="endDate" type="date" value="${t.endDate}"></label><label class="field">예산<input name="targetBudget" type="number" value="${t.targetBudget}"></label><label class="field">이동 방식<input name="transport" value="${esc(t.transport)}"></label></div><div class="modal-actions"><button type="button" class="button outline" id="editTripCancel">취소</button><button class="button primary">저장</button></div></form>`);$("#editTripCancel").onclick=closeModal;$("#editTripForm").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));Object.assign(t,f,{travelers:Number(f.travelers),targetBudget:Number(f.targetBudget)});closeModal();await persistTrip(t,{quiet:true});renderTrip()}}
function renderSaved(){$("#savedPlaces").innerHTML=state.saved.map(p=>placeCard(p)).join("")||'<div class="empty-small">저장한 장소가 없습니다. 장소 탐색에서 관심 있는 곳을 추가해 보세요.</div>'}
async function authSubmit(){
 const email=$("#authEmail").value.trim(),password=$("#authPassword").value,mode=$(".auth-tab.active")?.dataset.authMode||"login";
 if(!email||!password){toast("이메일과 비밀번호를 입력해 주세요.");return}
 $("#authSubmit").disabled=true;
 try{
 let r;if(mode==="signup")r=await db.auth.signUp({email,password,options:{data:{display_name:$("#authName").value.trim()||email.split("@")[0]},emailRedirectTo:location.origin+location.pathname}});else r=await db.auth.signInWithPassword({email,password});
 if(r.error)throw r.error;if(mode==="signup"&&!r.data.session){toast("가입 확인 이메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.");return}
 state.session=r.data.session;state.user=r.data.user;updateAccountUI();await loadCloudTrips();toast(mode==="signup"?"회원가입이 완료되었습니다.":"로그인했습니다.");
 }catch(e){toast("계정 처리 실패: "+e.message)}finally{$("#authSubmit").disabled=false}
}
async function forgotPassword(){const email=$("#authEmail").value.trim();if(!email){toast("비밀번호 재설정 메일을 받을 이메일을 입력해 주세요.");return}const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+"?reset=1"});toast(error?"요청 실패: "+error.message:"비밀번호 재설정 이메일을 보냈습니다.")}
function setAuthMode(mode){$$("[data-auth-mode]").forEach(x=>x.classList.toggle("active",x.dataset.authMode===mode));$("#authNameWrap").hidden=mode!=="signup";$("#authSubmit").textContent=mode==="signup"?"회원가입":"로그인"}
async function saveBackup(){const blob=new Blob([JSON.stringify({version:2,trips:state.trips,saved:state.saved},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="waypoint-backup-"+today()+".json";a.click();URL.revokeObjectURL(a.href)}
async function restoreBackup(file){try{const x=JSON.parse(await file.text());if(!Array.isArray(x.trips))throw new Error("백업 파일 형식이 올바르지 않습니다.");state.trips=x.trips;state.saved=x.saved||[];localCache();renderAll();toast("백업을 복원했습니다. 로그인 상태라면 여행별로 저장해 주세요.")}catch(e){toast("복원 실패: "+e.message)}}
async function deleteTrip(id){if(!confirm("이 여행을 삭제할까요? 관련 일정·지출·예약·메모도 함께 삭제됩니다."))return;const t=state.trips.find(x=>x.id===id);if(state.user){const {error}=await db.from("trips").delete().eq("id",id);if(error){toast("삭제 실패: "+error.message);return}}state.trips=state.trips.filter(x=>x.id!==id);if(state.activeId===id)state.activeId=state.trips[0]?.id||null;localCache();renderTrips();renderHome();switchView("trips");toast("여행을 삭제했습니다.")}
function bind(){
 $$("[data-view]").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
 $$("[data-tab]").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
 ["#createHero","#heroCreate","#emptyCreate","#newTripTop","#createTrips"].forEach(s=>$(s).onclick=createTripModal);
 $("#menuOpen").onclick=()=>{$("#rail").classList.add("open");$("#scrim").classList.add("open")};$("#scrim").onclick=()=>{$("#rail").classList.remove("open");$("#scrim").classList.remove("open")};
 $("#modalClose").onclick=closeModal;$("#modalBackdrop").onclick=e=>{if(e.target.id==="modalBackdrop")closeModal()};document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();$("#rail").classList.remove("open");$("#scrim").classList.remove("open")}});
 document.body.addEventListener("click",e=>{const card=e.target.closest("[data-open-trip]");if(card)openTrip(card.dataset.openTrip);const save=e.target.closest("[data-save-place]");if(save){const name=save.dataset.savePlace;const p=[...(state.lastSearch||[]),...(current()?.recommendations||[])].find(x=>x.name===name);if(p&&!state.saved.some(x=>x.name===name)){state.saved.push(p);localStorage.setItem("waypoint-v2-saved",JSON.stringify(state.saved));toast("저장한 장소에 추가했습니다.")}else if(p)toast("이미 저장한 장소입니다.")}});
 $$("[data-trip-filter]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.tripFilter;$$("[data-trip-filter]").forEach(x=>x.classList.toggle("active",x===b));renderTrips()});
 $("#tripSearch").oninput=renderTrips;$("#themeToggle").onclick=()=>{document.body.dataset.theme=document.body.dataset.theme==="dark"?"light":"dark";localStorage.setItem("waypoint-theme",document.body.dataset.theme)};$$("[data-theme-choice]").forEach(b=>b.onclick=()=>{document.body.dataset.theme=b.dataset.themeChoice;localStorage.setItem("waypoint-theme",b.dataset.themeChoice)});
 $$("[data-auth-mode]").forEach(b=>b.onclick=()=>setAuthMode(b.dataset.authMode));$("#authSubmit").onclick=authSubmit;$("#forgotPassword").onclick=forgotPassword;$("#signOut").onclick=async()=>{await db.auth.signOut();state.user=null;state.session=null;updateAccountUI();setSync("기기 저장");toast("로그아웃했습니다.")};$("#authLogout").onclick=$("#signOut").onclick;
 $("#exportData").onclick=saveBackup;$("#importData").onchange=e=>restoreBackup(e.target.files?.[0]);$("#tripSearch").oninput=renderTrips;
}
function bindResetPassword(){
 if(new URLSearchParams(location.search).get("reset")==="1")openModal('<h2>새 비밀번호 설정</h2><form id="resetForm"><label class="field">새 비밀번호<input type="password" name="password" minlength="8" required></label><div class="modal-actions"><button class="button primary">비밀번호 변경</button></div></form>');
 $("#resetForm")?.addEventListener("submit",async e=>{e.preventDefault();const password=new FormData(e.currentTarget).get("password");const {error}=await db.auth.updateUser({password});if(error)toast(error.message);else{toast("비밀번호를 변경했습니다.");closeModal();history.replaceState({},"",location.pathname)}});
}
function addRecommendation(t,name){const p=(t.recommendations||[]).find(x=>x.name===name);if(!p)return;const d=tripDays(t)[state.day]||tripDays(t)[0];if(!d){toast("먼저 일정을 생성해 주세요.");return}d.items.push({id:uid(),name:p.name,time:"",category:p.category,reason:p.reason,query:p.query,source:"recommendation"});persistTrip(t,{quiet:true});setTab("plan");enrichTripPlaces(t).then(()=>persistTrip(t,{quiet:true}))}
function addPlaceFromSearch(name){const t=current(),p=state.lastSearch?.find(x=>x.name===name);if(!t)return;const d=tripDays(t)[state.day]||tripDays(t)[0];if(!d){toast("먼저 일정을 생성해 주세요.");return}d.items.push({id:uid(),name,address:p?.address||"",location:p?.location,placeId:p?.id,rating:p?.rating,mapsUrl:p?.mapsUrl,category:"장소",source:"places",verified:!!p});persistTrip(t,{quiet:true});setTab("plan");toast("일정에 추가했습니다.")}
const originalSearchPlaces=searchPlaces;
async function searchPlaces(e){e.preventDefault();const q=$("#placeQuery").value.trim();$("#placeSearchResults").innerHTML='<div class="empty-small">검색 중…</div>';try{const r=await callAssistant("places",{query:q},18000);state.lastSearch=r.places||[];$("#placeSearchResults").innerHTML=state.lastSearch.map(placeCard).join("")||'<div class="empty-small">검색 결과가 없습니다.</div>';$$("[data-add-recommend]").forEach(b=>b.onclick=()=>addPlaceFromSearch(b.dataset.addRecommend))}catch(err){$("#placeSearchResults").innerHTML='<div class="notice">'+esc(err.message)+'</div>'}}
function wireDelegated(){
 document.addEventListener("click",e=>{const tab=e.target.closest("[data-open-tab]");if(tab){setTab(tab.dataset.openTab)}});
}
bind();wireDelegated();restoreLocal();const savedTheme=localStorage.getItem("waypoint-theme");if(savedTheme)document.body.dataset.theme=savedTheme;refreshAuth();bindResetPassword();db.auth.onAuthStateChange((_event,session)=>{state.session=session;state.user=session?.user||null;updateAccountUI();if(session)loadCloudTrips()});
