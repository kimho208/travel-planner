// 외부 API 연결을 위한 어댑터 자리입니다.
// 브라우저 코드에 비밀 API 키를 넣지 마세요.
// 실제 AI·지도·항공·숙소 API는 추후 안전한 서버리스 프록시를 통해 연결해야 합니다.
export const integrationStatus={ai:"미연동",maps:"미연동",flights:"미연동",hotels:"미연동",restaurants:"미연동",currency:"미연동"};
export function getDataMode(){return "sample-or-local";}
