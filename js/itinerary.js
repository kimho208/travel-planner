export function buildDraft(trip){
 const raw=(trip.places||"").split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);
 const items=raw.length?raw.map((name,i)=>({id:`stop-${Date.now()}-${i}`,time:["09:30","11:30","14:00","16:30"][i%4],name,kind:"관광",note:"방문 전 운영시간과 휴무일을 확인하세요."})): [{id:`stop-${Date.now()}-1`,time:"10:00",name:"가고 싶은 장소를 추가해 주세요",kind:"안내",note:"관광지 이름을 입력해 일정을 구성할 수 있습니다."}];
 const days=Math.max(1,Math.min(14,Math.round((new Date(trip.endDate)-new Date(trip.startDate))/86400000)||1));
 return Array.from({length:days},(_,i)=>({date:new Date(new Date(trip.startDate).getTime()+i*86400000).toISOString().slice(0,10),items:i===0?items.map(x=>({...x})):[]}));
}
