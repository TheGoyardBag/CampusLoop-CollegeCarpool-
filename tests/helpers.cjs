const core=require('../demo/compiled/index.js');
const now='2030-04-01T12:00:00.000Z';
let base;
exports.setup=async()=>{
 base??=await core.demoSnapshot(new Date(now));const clock={value:new Date(now),now(){return new Date(this.value);}};
 const store=new core.MemoryStore(base);const service=new core.CarpoolService(store,{origin:'http://localhost:3400',demo:true},clock);
 return {store,service,clock,router:new core.ApiRouter(service),date:'2030-04-02',ride:'ride-leo-2030-04-02'};
};
exports.code=code=>e=>e instanceof core.AppError&&e.code===code;
exports.offer=(extra={})=>({originHubId:'hub-oak',destinationHubId:'hub-campus',vehicleId:'car-leo',direction:'TO_CAMPUS',date:'2030-04-20',departure:'07:00',arrival:'07:30',capacity:2,costCents:300,quiet:true,...extra});
exports.course=(extra={})=>({name:'New course',weekday:2,start:'11:00',end:'12:00',termStart:'2030-04-01',termEnd:'2030-06-01',...extra});
exports.core=core;
exports.request=(method,path,body={},cookie='',headers={})=>({method,path,body,ip:'127.0.0.1',headers:{origin:'http://localhost:3400','x-campusloop-client':'web','content-type':'application/json',cookie,...headers}});
exports.signed=async(router,who='maya')=>{const r=await router.handle(exports.request('POST','/api/auth/login',{email:`${who}@students.redwood.example`,password:core.DEMO_PASSWORD}));if(r.status!==200)throw Error(JSON.stringify(r.body));return r.headers['Set-Cookie'].split(';')[0];};
