const {PrismaClient}=require('@prisma/client');
const {PrismaStore}=require('../apps/api/dist/prisma-store.js');
const {demoSnapshot,tableNames}=require('../packages/core/dist/index.js');
(async()=>{
 if(process.env.DEMO_SEED!=='true'||process.env.NODE_ENV==='production')throw Error('Set DEMO_SEED=true for an empty development database only.');
 const client=new PrismaClient();try{const store=new PrismaStore(client);const data=await demoSnapshot();await store.transaction(async db=>{
  if((await db.list('user',{take:1})).length||(await db.list('campus',{take:1})).length)throw Error('Seed refuses nonempty databases. No data was changed.');
  for(const table of tableNames)for(const row of data[table])await db.create(table,row);
 });console.log('Fictional demo accounts created. Read START_HERE.md for sign-in details.');}finally{await client.$disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
