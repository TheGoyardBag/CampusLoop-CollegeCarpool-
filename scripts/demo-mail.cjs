// Developer-only inspection of the local preview's fictional mailbox. Never an HTTP endpoint.
const fs=require('node:fs'),path=require('node:path');const file=path.join(__dirname,'../.local/demo.json');
if(!fs.existsSync(file)){console.log('No local preview data. Run npm run preview and register a fictional account.');process.exit(0);}
const data=JSON.parse(fs.readFileSync(file,'utf8'));for(const m of data.outbox.filter(x=>!x.sentAt).slice(-10)){console.log(`\nTO: ${m.to}\nSUBJECT: ${m.subject}\n${m.body}\n`);}
