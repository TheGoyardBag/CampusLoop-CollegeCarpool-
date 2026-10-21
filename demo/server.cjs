/** Dependency-free local preview. Uses the exact compiled TypeScript application core.
 * It does NOT run NestJS, Next.js, Prisma, or PostgreSQL. Loopback + fictional data only.
 */
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {MemoryStore,CarpoolService,ApiRouter,demoSnapshot}=require('./compiled/index.js');
async function createPreview({port=3400,persistPath=path.join(__dirname,'../.local/demo.json'),reset=false}={}){
 const origin=`http://localhost:${port}`;let data;
 if(!reset&&persistPath){try{data=JSON.parse(await fs.readFile(persistPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
 data??=await demoSnapshot();
 const persist=persistPath?async value=>{await fs.mkdir(path.dirname(persistPath),{recursive:true});await fs.writeFile(persistPath+'.tmp',JSON.stringify(value),{mode:0o600});await fs.rename(persistPath+'.tmp',persistPath);}:undefined;
 const store=new MemoryStore(data,persist),service=new CarpoolService(store,{origin,demo:true}),router=new ApiRouter(service);
 const files={'/':['index.html','text/html; charset=utf-8'],'/preview.js':['preview.js','text/javascript; charset=utf-8'],'/style.css':['../apps/web/app/globals.css','text/css; charset=utf-8']};
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url??'/',origin);
   // No remote binding, arbitrary filesystem paths, or shared-demo mode.
   if(url.pathname.startsWith('/api/')){
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32768){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'BODY_TOO_LARGE',message:'Request body exceeds 32 KB.'}}));return;}}
    let body={};if(raw){try{body=JSON.parse(raw);}catch{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'INVALID_JSON',message:'Malformed JSON.'}}));return;}}
    const headers={};for(const [k,v] of Object.entries(req.headers))headers[k]=Array.isArray(v)?v[0]:v;
    const result=await router.handle({method:req.method??'GET',path:req.url,headers,body,ip:req.socket.remoteAddress??'loopback'});
    res.writeHead(result.status,result.headers);res.end(typeof result.body==='string'?result.body:JSON.stringify(result.body));return;
   }
   const asset=files[url.pathname];if(!asset){res.writeHead(404);res.end('Not found');return;}
   res.writeHead(200,{'Content-Type':asset[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});
   res.end(await fs.readFile(path.join(__dirname,asset[0])));
  }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'INTERNAL_ERROR',message:'The preview request failed.'}}));}
 });
 return {server,service,store,origin,listen:()=>new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server))),close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={createPreview};
if(require.main===module){const port=Number(process.env.PREVIEW_PORT??3400);createPreview({port,reset:process.argv.includes('--reset')}).then(async app=>{await app.listen();console.log(`CampusLoop LOCAL PREVIEW: ${app.origin}\nFictional users; JSON storage. Not the Next.js/NestJS/PostgreSQL runtime.\nUse the demo account buttons. --reset starts a fresh fictional dataset.`);}).catch(e=>{console.error(e.message);process.exitCode=1;});}
