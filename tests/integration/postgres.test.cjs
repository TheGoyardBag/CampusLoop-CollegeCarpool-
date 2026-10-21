/** Destructive only to an explicitly named disposable database. Run after migrations. */
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');
const enabled=process.env.RUN_POSTGRES_TESTS==='true';let client,store,service,ride;
before(async()=>{
 if(!enabled)return;
 if(new URL(process.env.DATABASE_URL).pathname!=='/campusloop_test')throw Error('Integration tests require a disposable database named campusloop_test.');
 const {PrismaClient}=require('@prisma/client');const {PrismaStore}=require('../../apps/api/dist/prisma-store.js');const core=require('../../packages/core/dist/index.js');client=new PrismaClient();store=new PrismaStore(client);
 const data=await core.demoSnapshot(new Date('2030-04-01T12:00:00Z'));
 // This cleanup is gated by BOTH an explicit flag and a fixed test database name.
 for(const table of [...core.tableNames].reverse())await client[table].deleteMany();
 await store.transaction(async db=>{for(const table of core.tableNames)for(const row of data[table])await db.create(table,row);});
 service=new core.CarpoolService(store,{origin:'http://localhost:3000',demo:true},{now:()=>new Date('2030-04-01T12:00:00Z')});ride='ride-leo-2030-04-02';
});
after(async()=>{if(client)await client.$disconnect();});
test('PostgreSQL last-seat race admits exactly one approval',{skip:!enabled},async()=>{
 await store.transaction(db=>db.update('ride',ride,{capacity:1}));
 const a=await service.requestSeat('user-maya',ride,{},'postgres-one'),b=await service.requestSeat('user-nora',ride,{},'postgres-two');
 const results=await Promise.allSettled([service.actOnBooking('user-leo',a.id,'approve'),service.actOnBooking('user-leo',b.id,'approve')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const r=await client.ride.findUnique({where:{id:ride}});assert.equal(r.seatsUsed,1);
 assert.equal(await client.booking.count({where:{rideId:ride,status:'CONFIRMED'}}),1);
});
test('PostgreSQL rejects impossible capacity even outside the service',{skip:!enabled},async()=>{await assert.rejects(()=>client.ride.update({where:{id:ride},data:{seatsUsed:100}}));});
test('PostgreSQL rollback discards a partial notification',{skip:!enabled},async()=>{
 const before=await client.notification.count();await assert.rejects(()=>store.transaction(async db=>{await service.notify(db,'user-maya','Rollback fixture','Must not persist');throw Error('forced rollback');}));assert.equal(await client.notification.count(),before);
});
test('PostgreSQL unique email constraint prevents duplicate users',{skip:!enabled},async()=>{const existing=await client.user.findUnique({where:{id:'user-maya'}});await assert.rejects(()=>client.user.create({data:{...existing,id:'duplicate-fixture'}}));});
test('Prisma datetime round-trip preserves UTC instants',{skip:!enabled},async()=>{const r=await service.ride('user-maya',ride);assert.equal(r.departureAt,'2030-04-02T15:05:00.000Z');});
