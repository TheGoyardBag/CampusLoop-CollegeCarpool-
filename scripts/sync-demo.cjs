const fs=require('node:fs');const path=require('node:path');
const source=path.join(__dirname,'../packages/core/dist'),target=path.join(__dirname,'../demo/compiled');
if(!fs.existsSync(source))throw Error('Build the TypeScript core first.');
fs.mkdirSync(target,{recursive:true});
for(const name of fs.readdirSync(source)){if(name.endsWith('.js'))fs.copyFileSync(path.join(source,name),path.join(target,name));}
console.log('Updated dependency-free demo from the compiled TypeScript core.');
