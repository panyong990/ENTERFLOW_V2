// Explicit, loopback-only UI fixture. Never imports a database or auth service.
// All writes below affect disposable process memory only. Not a real API server.
import {createServer} from 'vite';
if(process.argv.slice(2).join(' ')!=='--mock-only')throw Error('Explicit --mock-only is required.');
let signedIn=false,serial=0;
const calls=[];
const employee={id:'9007199254740993',employeeId:'UI-FIXTURE',name:'Browser Fixture',department:'Quality',jobTitle:'Reviewer',email:'fixture@example.invalid',username:'fixture',phone:'',roleCode:'sales',active:true,joinedOn:null,createdAt:'2026-11-15T00:00:00.000Z',revision:'a'.repeat(64)};
const company={id:'30',companyName:'Browser Fixture Company',contactPerson:'Fixture Contact',email:'company@example.invalid',username:'company',phone:'',accountId:'31',active:true,companyActive:true,joinedOn:null,createdAt:'2026-11-15T00:00:00.000Z',revision:'a'.repeat(64)};
const employees=[employee],clients=[company];
const applications=[{id:'40',companyName:'Pending Fixture Company',contactPerson:'Applicant Fixture',email:'applicant@example.invalid',username:'applicant',phone:'',status:'pending',submittedAt:'2026-11-15 01:00:00.000'}];
const json=(response,status,data)=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(data));};
const revision=()=>String(++serial).padStart(64,'0');
const server=await createServer({server:{host:'127.0.0.1',port:5177,strictPort:true},plugins:[{name:'admin-mock-only',configureServer(server){server.middlewares.use('/api',async(request,response)=>{
 try{
 const url=new URL(request.url,'http://127.0.0.1:5177');const route=url.pathname;const method=request.method;
 if(route==='/__test/status')return json(response,200,{calls});
 calls.push({method,route});let body={};
 if(method!=='GET'){let text='';for await(const chunk of request)text+=chunk;if(text)body=JSON.parse(text);}
 const ok=data=>json(response,200,{success:true,data});
 if(route==='/auth/me')return signedIn?ok({userId:'7',roleCode:'admin',accountType:'employee',displayName:'Mock-only Admin'}):json(response,401,{success:false,message:'Authentication required.'});
 if(route==='/auth/login'){signedIn=true;return ok({userId:'7',roleCode:'admin',accountType:'employee',displayName:'Mock-only Admin'});}
 if(route==='/auth/logout'){signedIn=false;return ok({});}
 if(route==='/auth/register'){applications.push({id:String(50+serial++),companyName:body.companyName,contactPerson:body.contactPerson,email:body.email,username:body.username,phone:body.phone,status:'pending',submittedAt:'2026-11-15 02:00:00.000'});return json(response,201,{success:true,data:{status:'pending'}});}
 if(!signedIn)return json(response,401,{success:false,message:'Authentication required.'});
 if(route==='/admin/dashboard')return ok({employees:employees.length,activeEmployees:employees.filter(row=>row.active).length,clients:clients.length,roles:8,pendingApplications:applications.filter(row=>row.status==='pending').length,activity:[],refreshedAt:new Date().toISOString()});
 if(route==='/admin/roles')return ok({roles:[{code:'admin',label:'Admin',modules:[{code:'dashboard',label:'Dashboard'},{code:'clients',label:'Client Management'},{code:'employee-management',label:'Employee Management'},{code:'roles',label:'Roles & Permissions'}],permissions:{users:['read','create','update','activate','deactivate','assignRole'],clientApplications:['read','approve','reject']}}],mismatches:[]});
 if(route==='/client-applications')return ok({applications:applications.filter(row=>row.status==='pending'),nextCursor:null});
 if(route.startsWith('/client-applications/')){const [, ,id,action]=route.split('/');const row=applications.find(row=>row.id===id);if(!row)return json(response,404,{success:false,message:'Not found.'});if(!action)return ok(row);row.status=action==='approve'?'approved':'rejected';return ok({applicationId:id,status:row.status,...(action==='approve'?{clientId:'60',userId:'61'}:{})});}
 const match=route.match(/^\/admin\/(employees|clients)(?:\/([^/]+))?(?:\/(activate|deactivate|role))?$/);
 if(match){const [,kind,id,action]=match;const rows=kind==='employees'?employees:clients;
 if(method==='GET'&&!id){const q=(url.searchParams.get('q')??'').toLowerCase();const items=rows.filter(row=>JSON.stringify(row).toLowerCase().includes(q));return ok({items,total:items.length,page:1,pageSize:10,...(kind==='employees'?{summary:{total:rows.length,active:rows.filter(row=>row.active).length,departments:['Quality']}}:{})});}
 if(method==='POST'&&!id&&kind==='employees'){const {initialPassword,...safe}=body;const row={...safe,id:String(100+serial++),roleCode:body.roleCode,active:true,createdAt:new Date().toISOString(),joinedOn:null,revision:revision()};rows.push(row);return json(response,201,{success:true,data:row});}
 const row=rows.find(row=>row.id===id);if(!row)return json(response,404,{success:false,message:'Not found.'});
 if(method==='PATCH'){Object.assign(row,body,{revision:revision()});return ok(row);}
 if(action){if(action==='role')row.roleCode=body.roleCode;else row.active=action==='activate';row.revision=revision();return ok(row);}return ok(row);
 }
 return json(response,404,{success:false,message:'Mock endpoint not found.'});
 }catch{return json(response,500,{success:false,message:'Mock preview request failed.'});}
 });}}]});
await server.listen();console.log('MOCK ONLY: http://127.0.0.1:5177 — no database imports or connections.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
