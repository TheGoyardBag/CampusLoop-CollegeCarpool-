const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),target=path.join(root,'.env');
if(fs.existsSync(target)){console.log('.env already exists; left unchanged.');process.exit(0);}
const password=crypto.randomBytes(24).toString('base64url');
let env=fs.readFileSync(path.join(root,'.env.example'),'utf8').replaceAll('CHANGE_ME_LOCAL_DATABASE_PASSWORD',password);fs.writeFileSync(target,env,{mode:0o600});console.log('Created local .env with a random database password. Do not commit this file.');
