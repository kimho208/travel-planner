import { chromium } from "playwright";
import assert from "node:assert/strict";

const baseURL = process.env.SITE_URL;
if (!baseURL) throw new Error("SITE_URL is not set");
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",e=>errors.push("PAGE: "+e.message));
page.on("console",m=>{if(m.type()==="error")errors.push("CONSOLE: "+m.text())});
page.on("requestfailed",r=>errors.push("REQUEST FAILED: "+r.url()+" "+(r.failure()?.errorText||"")));
try{
 await page.goto(baseURL,{waitUntil:"networkidle",timeout:60000});
 await page.locator("#view-home.active").waitFor({timeout:15000});
 const storeCheck=await page.evaluate(()=>{
  const store=window.WaypointStore.createStore({profile:{name:"before"},items:[]});
  let changes=0;store.subscribe(()=>changes++);
  const state=store.getState();state.profile.name="after";state.items.push("one");
  return {name:state.profile.name,count:state.items.length,changes};
 });
 assert.deepEqual(storeCheck,{name:"after",count:1,changes:2},"Central store must publish nested object and array changes");
 try{await page.waitForFunction(()=>document.documentElement.dataset.appReady==="true",null,{timeout:15000})}catch(e){console.log("BOOT DIAGNOSTICS",JSON.stringify(errors),JSON.stringify(await page.evaluate(()=>({scripts:[...document.scripts].map(x=>x.src),ready:document.documentElement.dataset.appReady,rail:!!document.querySelector("#rail")}))));throw e}
 assert.ok(await page.locator(".home-hero").isVisible(),"New homepage hero must render");
 assert.equal(await page.locator(".rail-link[data-view]").count(),4,"Primary navigation must be present");
 await page.setViewportSize({width:390,height:844});
 await page.locator("#menuOpen").click();
 await page.waitForFunction(()=>document.querySelector("#rail")?.classList.contains("open"),null,{timeout:5000});
 assert.ok(await page.locator("#rail").evaluate(x=>x.classList.contains("open")),"Mobile navigation opens");
 await page.locator("#scrim").click({position:{x:350,y:400}});
 assert.ok(!(await page.locator("#rail").evaluate(x=>x.classList.contains("open"))),"Mobile navigation closes from scrim");
 await page.setViewportSize({width:1440,height:1000});
 await page.locator("#createHero").click();
 assert.ok(await page.locator("#createTripForm").isVisible(),"Trip creation form opens");
 await page.locator("#modalClose").click();

 // Startup must remain usable if Supabase CDN is unavailable and local cache JSON is damaged.
 const offline=await browser.newPage({viewport:{width:390,height:844}});
 const offlineErrors=[];
 offline.on("pageerror",e=>offlineErrors.push(e.message));
 await offline.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",route=>route.abort());
 await offline.addInitScript(()=>{
  localStorage.setItem("waypoint-v2-cache","{broken-json");
  localStorage.setItem("waypoint-v2-saved","{also-broken");
 });
 await offline.goto(baseURL,{waitUntil:"domcontentloaded",timeout:60000});
 await offline.waitForFunction(()=>document.documentElement.dataset.appReady==="true",null,{timeout:15000});
 assert.ok(await offline.locator(".home-hero").isVisible(),"Offline-only startup must render homepage");
 assert.ok(await offline.locator("#createHero").isVisible(),"Offline-only mode must retain local trip creation");
 assert.ok(await offline.locator("#authForm").evaluate(el=>el.hidden),"Authentication form must be disabled without Supabase SDK");
 await offline.locator("#createHero").click();
 assert.ok(await offline.locator("#createTripForm").isVisible(),"Offline-only trip creation form opens");
 assert.equal(offlineErrors.length,0,"Missing Supabase and corrupt local cache must not throw: "+offlineErrors.join("; "));
 await offline.close();

 // Authenticated test session: external AI and database services are mocked, never billed.
 const ai=await browser.newPage({viewport:{width:1440,height:1000}});
 const aiErrors=[];
 const actions=[];
 ai.on("pageerror",e=>aiErrors.push(e.message));
 const origin=new URL(baseURL).origin;
 await ai.route("**/functions/v1/travel-assistant",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({status:200,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"authorization, apikey, content-type, x-client-info"} ,body:"ok"});
  const action=route.request().postDataJSON().action;actions.push(action);
  let body={ok:true};
  if(action==="generate")body={ok:true,itinerary:{suggestedDestination:"일본 오사카",overview:"실제 장소를 확인하는 여행",tips:["교통 패스를 미리 확인하세요."],recommendations:[{name:"Osaka Castle",category:"명소",reason:"대표 역사 명소",query:"Osaka Castle, Osaka"}],days:[{date:route.request().postDataJSON().trip.startDate,theme:"오사카 성 주변",items:[{time:"10:00",name:"Osaka Castle",category:"명소",query:"Osaka Castle, Osaka",reason:"역사 명소"}]}]}};
  if(action==="places")body={ok:true,places:[{id:"mock-osaka-castle",name:"Osaka Castle",address:"1-1 Osakajo, Chuo Ward, Osaka, Japan",location:{latitude:34.6873,longitude:135.5262},rating:4.5,ratingCount:1000,mapsUrl:"https://maps.google.com/?q=Osaka+Castle"}]};
  if(action==="route")body={ok:true,duration:"600s",distanceMeters:1200,encodedPolyline:"}_ilE}~qpX?gE"};
  return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(body)});
 });
 await ai.route("https://api.frankfurter.dev/**",async route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({amount:1,base:"JPY",date:"2026-11-25",rates:{KRW:9.3}})}));
 await ai.route("**/rest/v1/**",async route=>{
  if(route.request().method()==="OPTIONS")return route.fulfill({status:200,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"GET, POST, PATCH, DELETE, OPTIONS","access-control-allow-headers":"authorization, apikey, content-type, prefer, x-client-info"} ,body:"ok"});
  const url=new URL(route.request().url()),table=url.pathname.split("/").pop();
  if(table==="trips"&&route.request().method()==="GET")return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:"[]"});
  if(table==="trips"&&["POST","PATCH"].includes(route.request().method())){
   const payload=route.request().postDataJSON();return route.fulfill({status:route.request().method()==="POST"?201:200,contentType:"application/json",headers:{"access-control-allow-origin":origin,"content-range":"0-0/*"},body:JSON.stringify({...payload,created_at:new Date().toISOString()})});
  }
  if(table==="trip_days"&&route.request().method()==="POST"){
   const payload=route.request().postDataJSON(),rows=Array.isArray(payload)?payload:[payload];return route.fulfill({status:201,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:JSON.stringify(rows.map((x,i)=>({id:"11111111-1111-4111-8111-"+String(i+1).padStart(12,"0"),day_date:x.day_date})))});
  }
  if(route.request().method()==="GET")return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":origin},body:"[]"});
  return route.fulfill({status:204,headers:{"access-control-allow-origin":origin}});
 });
 await ai.addInitScript(()=>{
  const now=Math.floor(Date.now()/1000);
  const session={access_token:"mock-access-token",token_type:"bearer",expires_in:3600,expires_at:now+3600,refresh_token:"mock-refresh-token",user:{id:"882789dd-2fb8-4bb4-8c05-43570b085631",aud:"authenticated",role:"authenticated",email:"smoke@example.com",app_metadata:{provider:"email",providers:["email"]},user_metadata:{display_name:"Smoke"},created_at:new Date().toISOString()}};
  localStorage.setItem("sb-ukpywdzvewvsvuirujnr-auth-token",JSON.stringify(session));
  localStorage.setItem("waypoint-v2-cache",JSON.stringify({trips:[],activeId:null,saved:[]}));
 });
 await ai.goto(baseURL,{waitUntil:"networkidle",timeout:60000});
 await ai.waitForFunction(()=>document.querySelector("#userLabel")?.textContent==="Smoke",null,{timeout:15000});
 await ai.locator("#newTripTop").click();
 await ai.locator('input[name="destination"]').fill("일본 오사카");
 const start=await ai.locator('input[name="startDate"]').inputValue();
 await ai.locator('input[name="endDate"]').fill(start);
 await ai.locator("#submitCreate").click();
 await ai.locator("#panel-plan.active").waitFor({timeout:30000});
 await ai.locator(".stop-card").filter({hasText:"Osaka Castle"}).waitFor({timeout:15000});
 assert.ok(actions.includes("generate"),"AI create action must call the generation endpoint");
 assert.ok(actions.includes("places"),"AI recommendations must be checked against Places");
 await ai.locator("#tripTabs [data-tab=prep]").click();
 await ai.locator("#addTask").click();
 await ai.locator('input[name="title"]').fill("eSIM 설치 확인");
 await ai.locator("#taskForm button.button.primary").click();
 await ai.locator(".task").filter({hasText:"eSIM 설치 확인"}).waitFor();
 await ai.locator("#tripTabs [data-tab=budget]").click();
 await ai.locator("#addExpense").click();
 await ai.locator('input[name="title"]').fill("공항 리무진");
 await ai.locator('input[name="amount"]').fill("18000");
 await ai.locator("#expenseForm button.button.primary").click();
 await ai.locator(".expense-item").filter({hasText:"공항 리무진"}).waitFor();
 await ai.locator("#tripTabs [data-tab=notes]").click();
 await ai.locator("#addNote").click();
 await ai.locator('input[name="title"]').fill("여행 메모");
 await ai.locator('textarea[name="content"]').fill("방문 전 예약 시간 확인");
 await ai.locator("#noteForm button.button.primary").click();
 await ai.locator(".note-card").filter({hasText:"여행 메모"}).waitFor();
 await ai.locator("#tripTabs [data-tab=reservations]").click();
 await ai.locator("#addReservation").click();
 await ai.locator('input[name="title"]').fill("인천-간사이 왕복");
 await ai.locator("#reservationForm button.button.primary").click();
 await ai.locator(".reservation-card").filter({hasText:"인천-간사이 왕복"}).waitFor();
 assert.equal(aiErrors.length,0,"Authenticated trip workspace should not throw browser errors: "+aiErrors.join("; "));
 await ai.close();
 if(errors.length)throw new Error("Homepage browser errors: "+errors.join("\n"));
 console.log("WAYPOINT V2 SMOKE PASSED: redesigned homepage, mobile nav, trip creation, mocked AI and Places, itinerary, checklist, expenses, notes, and reservations.");
}finally{await browser.close()}
