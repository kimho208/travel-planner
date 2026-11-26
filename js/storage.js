const KEY = "voyage-planner-data-v1";
const VERSION = 1;
export function loadState(){
  try { const raw=localStorage.getItem(KEY); if(!raw) return {version:VERSION,trips:[],activeTripId:null,theme:"light"}; const parsed=JSON.parse(raw); if(!parsed || !Array.isArray(parsed.trips)) throw new Error("저장 데이터 형식이 올바르지 않습니다."); return {...parsed,version:VERSION}; }
  catch(error){ console.error(error); return {version:VERSION,trips:[],activeTripId:null,theme:"light"}; }
}
export function saveState(state){ localStorage.setItem(KEY,JSON.stringify({...state,version:VERSION,updatedAt:new Date().toISOString()})); }
export function exportState(state){ const blob=new Blob([JSON.stringify({...state,version:VERSION,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"}); downloadBlob(blob,`voyage-backup-${new Date().toISOString().slice(0,10)}.json`); }
export function importState(file){ return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data||!Array.isArray(data.trips))throw new Error("여행 데이터가 포함된 백업 파일이 아닙니다.");resolve({...data,version:VERSION});}catch(e){reject(e)}};reader.onerror=()=>reject(new Error("파일을 읽지 못했습니다."));reader.readAsText(file);});}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
export function makeId(){return globalThis.crypto?.randomUUID?.() || `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
