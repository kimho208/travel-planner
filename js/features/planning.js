(function(global){
"use strict";
const distanceKm=(a,b)=>{const rad=n=>n*Math.PI/180,R=6371,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude),x=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
function optimizeByNearestNeighbor(items){
 const remaining=items.map((item,index)=>({item,index})),ordered=[];if(!remaining.length)return ordered;
 let current=remaining.shift();ordered.push(current.item);
 while(remaining.length){const loc=current.item.location||current.item;let best=-1,bestDistance=Infinity;
 if(Number.isFinite(Number(loc.latitude))&&Number.isFinite(Number(loc.longitude)))for(let i=0;i<remaining.length;i++){const p=remaining[i].item.location||remaining[i].item;if(!Number.isFinite(Number(p.latitude))||!Number.isFinite(Number(p.longitude)))continue;const d=distanceKm({latitude:Number(loc.latitude),longitude:Number(loc.longitude)},{latitude:Number(p.latitude),longitude:Number(p.longitude)});if(d<bestDistance){best=i;bestDistance=d}}
 if(best<0)best=0;current=remaining.splice(best,1)[0];ordered.push(current.item)}return ordered;
}
function findScheduleConflicts(items){
 const parse=v=>{if(!/^\d{2}:\d{2}$/.test(v||""))return null;const p=v.split(":").map(Number);return p[0]*60+p[1]};
 const out=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j],as=parse(a.time),ae=parse(a.endTime)||(as===null?null:as+60),bs=parse(b.time),be=parse(b.endTime)||(bs===null?null:bs+60);if(as!==null&&ae!==null&&bs!==null&&be!==null&&Math.max(as,bs)<Math.min(ae,be))out.push({first:a,second:b,kind:"overlap",message:(a.name||"첫 일정")+"과 "+(b.name||"다음 일정")+"의 시간이 겹칩니다."})}return out;
}
function calculateSettlement(expenses,travelerNames){
 const names=[...new Set((travelerNames||[]).map(x=>String(x||"").trim()).filter(Boolean))];for(const x of expenses||[])if(x.paidBy&&!names.includes(x.paidBy))names.push(x.paidBy);if(!names.length)names.push("여행자 1","여행자 2");
 const paid=Object.fromEntries(names.map(n=>[n,0])),owed=Object.fromEntries(names.map(n=>[n,0]));
 for(const x of expenses||[]){const amount=Math.max(0,Math.round(Number(x.amountKrw)||0)),payer=names.includes(x.paidBy)?x.paidBy:names[0];paid[payer]+=amount;if(x.splitType==="payer")owed[payer]+=amount;else{const base=Math.floor(amount/names.length),extra=amount-base*names.length;names.forEach((n,i)=>owed[n]+=base+(i<extra?1:0))}}
 const creditors=names.map(name=>({name,amount:paid[name]-owed[name]})).filter(x=>x.amount>0),debtors=names.map(name=>({name,amount:owed[name]-paid[name]})).filter(x=>x.amount>0),transfers=[];let i=0,j=0;
 while(i<debtors.length&&j<creditors.length){const amount=Math.min(debtors[i].amount,creditors[j].amount);if(amount>0)transfers.push({from:debtors[i].name,to:creditors[j].name,amount});debtors[i].amount-=amount;creditors[j].amount-=amount;if(!debtors[i].amount)i++;if(!creditors[j].amount)j++}
 return {paid,owed,balances:names.map(name=>({name,amount:paid[name]-owed[name]})),transfers};
}
function makeICS(trip){
 const esc=s=>String(s||"").replace(/\\/g,"\\\\").replace(/,/g,"\\,").replace(/;/g,"\\;").replace(/\r?\n/g,"\\n"),stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//WAYPOINT//Travel Planner//KO","CALSCALE:GREGORIAN"];
 (trip.itinerary||[]).forEach(day=>(day.items||[]).forEach((item,index)=>{const start=String(item.time||"09:00").replace(":","")+"00",end=String(item.endTime||"").replace(":","")+"00";lines.push("BEGIN:VEVENT","UID:"+(item.id||trip.id+"-"+day.date+"-"+index)+"@waypoint","DTSTAMP:"+stamp,"DTSTART;TZID=Asia/Seoul:"+String(day.date).replace(/-/g,"")+"T"+start);if(end)lines.push("DTEND;TZID=Asia/Seoul:"+String(day.date).replace(/-/g,"")+"T"+end);lines.push("SUMMARY:"+esc(item.name),"LOCATION:"+esc(item.address||""),"DESCRIPTION:"+esc(item.note||item.reason||""),"END:VEVENT")}));
 lines.push("END:VCALENDAR");return lines.join("\r\n");
}
global.WaypointPlanning=Object.freeze({distanceKm,optimizeByNearestNeighbor,findScheduleConflicts,calculateSettlement,makeICS});
})(window);
