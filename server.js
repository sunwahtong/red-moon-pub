const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DB_FILE = path.join(ROOT, 'data', 'seed.json');
const PORT = Number(process.env.PORT || 8787);
const sessions = new Map();
const realtimeClients = new Set();
const wsClients = new Set();
const liveDJ = { active:false, djId:null, djName:'', title:'', startedAt:null, socket:null };
function publicLiveState(){ return {active:!!liveDJ.active,djName:liveDJ.djName||'',title:liveDJ.title||'',startedAt:liveDJ.startedAt||null}; }
function wsBroadcast(msg){ const raw=JSON.stringify(msg); for(const c of [...wsClients]){ try{if(c.ws.readyState===1)c.ws.send(raw)}catch{wsClients.delete(c)} } }
function stopLiveDJ(reason='offline'){ liveDJ.active=false; liveDJ.djId=null; liveDJ.djName=''; liveDJ.title=''; liveDJ.startedAt=null; liveDJ.socket=null; wsBroadcast({type:'live_state',...publicLiveState(),reason}); }

// Online storage: when DATABASE_URL is present (Render), all staff data lives in PostgreSQL.
// Local development keeps the original db.json fallback so the project still works offline.
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000
}) : null;
let db = null;
let writeQueue = Promise.resolve();

function readLocalDB(){ return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
async function initDB(){
  if(!pool){
    db = readLocalDB();
    return;
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS red_moon_state (id INTEGER PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const result = await pool.query('SELECT data FROM red_moon_state WHERE id=1');
  if(result.rowCount === 0){
    db = readLocalDB();
    // First deployment: create the initial OWNER from Render environment variables.
    // No real password is stored in the Git repository.
    const ownerUsername = String(process.env.OWNER_USERNAME || '').trim();
    const ownerPassword = String(process.env.OWNER_PASSWORD || '');
    const ownerName = String(process.env.OWNER_NAME || 'Red Moon Owner').trim() || 'Red Moon Owner';
    if(ownerUsername && ownerPassword){
      const hp = hashPassword(ownerPassword);
      db.users.unshift({id:'u_owner_'+crypto.randomBytes(6).toString('hex'),username:ownerUsername,name:ownerName,role:'owner',passwordHash:`PBKDF2:310000:sha256:${hp.salt}:${hp.hash}`});
    }
    await pool.query('INSERT INTO red_moon_state (id,data) VALUES (1,$1::jsonb)', [JSON.stringify(db)]);
  } else {
    db = result.rows[0].data;
  }
  await migrateDrinkCatalog();
}

const CANONICAL_DRINKS = [{"id":"p_kobaltas","name":"Kőbaltás","category":"drink","price":1200,"stock":24,"minStock":8,"image":"assets/menu/drinks/kobaltas.png","active":true},{"id":"p_barracho","name":"Barracho","category":"drink","price":1800,"stock":24,"minStock":8,"image":"assets/menu/drinks/barracho.png","active":true},{"id":"p_sornyito","name":"Sörnyitó","category":"drink","price":2400,"stock":18,"minStock":6,"image":"assets/menu/drinks/sornyito.png","active":true},{"id":"p_syrah","name":"Syrah vörösbor","category":"drink","price":5000,"stock":18,"minStock":6,"image":"assets/menu/drinks/syrah.png","active":true},{"id":"p_two_roosters","name":"Two Roosters rozé","category":"drink","price":5600,"stock":18,"minStock":6,"image":"assets/menu/drinks/two_roosters.png","active":true},{"id":"p_bleuterd","name":"Bleuter'D pezsgő","category":"drink","price":4800,"stock":18,"minStock":6,"image":"assets/menu/drinks/bleuterd.png","active":true},{"id":"p_mount_bourbon","name":"The Mount Bourbon Whiskey","category":"drink","price":11200,"stock":16,"minStock":5,"image":"assets/menu/drinks/mount_bourbon.png","active":true},{"id":"p_vinewood","name":"Vinewood Sauvignon Blanc fehérbor","category":"drink","price":5800,"stock":18,"minStock":6,"image":"assets/menu/drinks/vinewood.png","active":true},{"id":"p_chernekov","name":"Cherenkov Premium Vodka","category":"drink","price":12600,"stock":16,"minStock":5,"image":"assets/menu/drinks/chernekov.png","active":true},{"id":"p_cazafortunas","name":"Cazafortunas Tequila","category":"drink","price":12200,"stock":16,"minStock":5,"image":"assets/menu/drinks/cazafortunas.png","active":true},{"id":"p_sinmisito","name":"Sinmisito Tequila","category":"drink","price":15800,"stock":14,"minStock":4,"image":"assets/menu/drinks/sinmisito.png","active":true},{"id":"p_ragga","name":"Ragga rum","category":"drink","price":11200,"stock":16,"minStock":5,"image":"assets/menu/drinks/ragga.png","active":true},{"id":"p_sprunk","name":"Sprunk (dobozos)","category":"drink","price":1780,"stock":30,"minStock":10,"image":"assets/menu/drinks/sprunk.png","active":true},{"id":"p_ecola","name":"E-Cola (dobozos)","category":"drink","price":1780,"stock":30,"minStock":10,"image":"assets/menu/drinks/ecola.png","active":true},{"id":"p_raine","name":"Rainé ásványvíz","category":"drink","price":1600,"stock":32,"minStock":10,"image":"assets/menu/drinks/raine.png","active":true}];

async function migrateDrinkCatalog(){
  db.products ||= [];
  const ids=new Set(CANONICAL_DRINKS.map(p=>p.id));
  const hasSales=Array.isArray(db.sales)&&db.sales.length>0;
  const byName=new Map(db.products.map(p=>[String(p.name||'').trim().toLowerCase(),p]));
  const current=CANONICAL_DRINKS.map(base=>{
    const old=byName.get(base.name.toLowerCase());
    return {...base,stock:Number.isFinite(Number(old?.stock))?Math.max(0,Math.floor(Number(old.stock))):base.stock,minStock:Number.isFinite(Number(old?.minStock))?Math.max(0,Math.floor(Number(old.minStock))):base.minStock,active:true};
  });
  if(hasSales){
    const legacy=db.products.filter(p=>!ids.has(p.id)).map(p=>({...p,active:false}));
    db.products=[...current,...legacy];
  }else db.products=current;
  if(pool) await writeDB(db);
}
function broadcastRealtime(type='state', payload={}){
  const message=`data: ${JSON.stringify({type,...payload,at:new Date().toISOString()})}\n\n`;
  for(const client of [...realtimeClients]){
    try{client.res.write(message)}catch{realtimeClients.delete(client)}
  }
}
function writeDB(next){
  if(!pool){
    const tmp=DB_FILE+'.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next,null,2));
    fs.renameSync(tmp,DB_FILE);
    broadcastRealtime('state');
    return Promise.resolve();
  }
  // Serialize writes so two quick POS actions cannot overwrite one another.
  writeQueue = writeQueue.then(async()=>{
    await pool.query('UPDATE red_moon_state SET data=$1::jsonb, updated_at=NOW() WHERE id=1', [JSON.stringify(next)]);
    broadcastRealtime('state');
  });
  return writeQueue;
}
function json(res,status,obj){ const body=JSON.stringify(obj); const origin=res.req?.headers?.origin; const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'same-origin'}; if(origin==='null' || origin===`http://localhost:${PORT}` || origin===`http://127.0.0.1:${PORT}`){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Credentials']='true';headers['Access-Control-Allow-Headers']='Content-Type';headers['Access-Control-Allow-Methods']='GET,POST,PATCH,DELETE,OPTIONS';} res.writeHead(status,headers); res.end(body); }
function parseCookies(req){ const out={}; (req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('='); if(i>0) out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1));}); return out; }
function sessionUser(req){
  const sid=parseCookies(req).rm_session;
  const s=sid&&sessions.get(sid);
  if(s) s.lastSeen=Date.now();
  return s||null;
}
function onlineUsers(){
  const cutoff=Date.now()-45000;
  const seen=new Map();
  for(const session of sessions.values()){
    if(!session?.id || !session.lastSeen || session.lastSeen<cutoff) continue;
    const current=seen.get(session.id);
    if(!current || session.lastSeen>current.lastSeen){
      seen.set(session.id,{id:session.id,username:session.username,name:session.name,role:session.role,lastSeen:session.lastSeen});
    }
  }
  return [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name,'hu'));
}
function roleAtLeast(role,need){ const r={staff:1,manager:2,owner:3}; return (r[role]||0)>=(r[need]||99); }
function authDJ(req,res){ const u=sessionUser(req); if(!u){json(res,401,{error:'Bejelentkezés szükséges'});return null;} if(u.role!=='dj'){json(res,403,{error:'Csak DJ jogosultság használhatja a DJ pultot.'});return null;} return u; }
function auth(req,res,need='staff'){ const u=sessionUser(req); if(!u){json(res,401,{error:'Bejelentkezés szükséges'});return null;} if(!roleAtLeast(u.role,need)){json(res,403,{error:'Nincs jogosultságod ehhez a művelethez'});return null;} return u; }
function readBody(req){return new Promise((resolve,reject)=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e6) req.destroy();});req.on('end',()=>{try{resolve(d?JSON.parse(d):{})}catch(e){reject(e)}});req.on('error',reject)})}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:crypto.pbkdf2Sync(password,salt,310000,32,'sha256').toString('hex')}}
function verifyPassword(password,encoded){ const [scheme,it,alg,salt,hash]=encoded.split(':'); if(scheme!=='PBKDF2') return false; const got=crypto.pbkdf2Sync(password,salt,Number(it),32,alg); return crypto.timingSafeEqual(got,Buffer.from(hash,'hex')); }
function audit(db,user,action,details){db.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),userId:user.id,user:user.name,role:user.role,action,details}); if(db.audit.length>1000) db.audit.length=1000;}
function notifyManagersOwners(db,title,message,meta={}){db.notifications.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),title,message,meta,readBy:{}});if(db.notifications.length>500)db.notifications.length=500;}
function publicUser(u){return {id:u.id,username:u.username,name:u.name,role:u.role};}
function currency(n){return Number(n)||0}


async function api(req,res,url){
  if(req.method==='OPTIONS'){
    const origin=req.headers.origin;
    if(origin==='null' || origin===`http://localhost:${PORT}` || origin===`http://127.0.0.1:${PORT}`){
      res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Vary':'Origin'});
      return res.end();
    }
    res.writeHead(204); return res.end();
  }
  const dbState=db;
  // Lightweight migration so an existing V15 database can be upgraded without losing data.
  dbState.shifts ||= [];
  dbState.documents ||= [];
  dbState.users ||= [];
  dbState.products ||= [];
  dbState.sales ||= [];
  dbState.audit ||= [];
  dbState.notifications ||= [];
  for(const s of dbState.sales){ s.shiftId ??= null; s.documentId ??= null; s.paymentMethod ??= 'cash'; }
  try{
    if(req.method==='GET' && url==='/api/live') return json(res,200,publicLiveState());

    if(req.method==='GET' && url==='/api/health'){
      return json(res,200,{ok:true,service:'red-moon-staff',version:'19.0-realtime-neon',time:new Date().toISOString()});
    }

    if(req.method==='POST' && url==='/api/dj/start'){
      const u=authDJ(req,res); if(!u)return;
      if(liveDJ.active && liveDJ.djId!==u.id)return json(res,409,{error:'Már adásban van egy DJ.'});
      const b=await readBody(req);
      liveDJ.active=true; liveDJ.djId=u.id; liveDJ.djName=u.name; liveDJ.title=String(b.title||'Red Moon Live').trim().slice(0,100)||'Red Moon Live'; liveDJ.startedAt=new Date().toISOString();
      wsBroadcast({type:'live_state',...publicLiveState()});
      return json(res,200,publicLiveState());
    }
    if(req.method==='POST' && url==='/api/dj/stop'){
      const u=authDJ(req,res); if(!u)return;
      if(!liveDJ.active || liveDJ.djId!==u.id)return json(res,400,{error:'Nincs aktív saját DJ adás.'});
      stopLiveDJ('stopped'); return json(res,200,publicLiveState());
    }

    if(req.method==='POST' && url==='/api/login'){
      const b=await readBody(req);
      const u=db.users.find(x=>x.username.toLowerCase()===String(b.username||'').trim().toLowerCase());
      if(!u || !verifyPassword(String(b.password||''),u.passwordHash)) return json(res,401,{error:'Hibás felhasználónév vagy jelszó'});
      const sid=crypto.randomBytes(32).toString('hex');
      sessions.set(sid,{id:u.id,username:u.username,name:u.name,role:u.role,lastSeen:Date.now()});
      res.setHeader('Set-Cookie',`rm_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?' ; Secure':''}`.replace(' ; Secure','; Secure'));
      audit(db,u,'LOGIN','Sikeres belépés'); await writeDB(db);
      return json(res,200,{user:publicUser(u)});
    }

    if(req.method==='POST' && url==='/api/logout'){
      const sid=parseCookies(req).rm_session; const u=sessionUser(req);
      if(u){audit(db,u,'LOGOUT','Kijelentkezés');await writeDB(db)}
      sessions.delete(sid); res.setHeader('Set-Cookie',`rm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV==='production'?'; Secure':''}`);
      return json(res,200,{ok:true});
    }

    if(req.method==='GET' && url==='/api/me'){
      const u=sessionUser(req); return json(res,200,{user:u||null});
    }

    // ---------- REALTIME STAFF CHANNEL ----------
    if(req.method==='GET' && url==='/api/events'){
      const u=auth(req,res); if(!u)return;
      res.writeHead(200,{
        'Content-Type':'text/event-stream; charset=utf-8',
        'Cache-Control':'no-cache, no-store, must-revalidate',
        'Connection':'keep-alive',
        'X-Accel-Buffering':'no'
      });
      res.write(`data: ${JSON.stringify({type:'connected',at:new Date().toISOString()})}\n\n`);
      const client={res,userId:u.id};
      realtimeClients.add(client);
      const keepAlive=setInterval(()=>{try{res.write(': keepalive\\n\\n')}catch{}},20000);
      req.on('close',()=>{clearInterval(keepAlive);realtimeClients.delete(client);try{res.end()}catch{}});
      return;
    }

    if(req.method==='POST' && url==='/api/presence/heartbeat'){
      const u=auth(req,res); if(!u)return;
      const sid=parseCookies(req).rm_session;
      const session=sid&&sessions.get(sid);
      if(session) session.lastSeen=Date.now();
      broadcastRealtime('presence');
      return json(res,200,{ok:true,at:new Date().toISOString()});
    }

    if(req.method==='GET' && url==='/api/presence'){
      const u=auth(req,res); if(!u)return;
      const online=onlineUsers();
      return json(res,200,{online,onlineCount:online.length,generatedAt:new Date().toISOString()});
    }

    if(req.method==='GET' && url==='/api/products'){
      const u=auth(req,res); if(!u)return;
      return json(res,200,{products:db.products});
    }

    if(req.method==='GET' && url==='/api/dashboard'){
      const u=auth(req,res); if(!u)return;
      const today=new Date().toISOString().slice(0,10);
      const todaySales=db.sales.filter(s=>s.at.slice(0,10)===today);
      const revenue=todaySales.reduce((a,s)=>a+s.total,0);
      const items=todaySales.reduce((a,s)=>a+s.qty,0);
      const low=db.products.filter(p=>p.active&&p.stock<=p.minStock);
      const byProduct={}; todaySales.forEach(s=>byProduct[s.productId]=(byProduct[s.productId]||0)+s.qty);
      const top=Object.entries(byProduct).map(([id,qty])=>({product:db.products.find(p=>p.id===id)?.name||id,qty})).sort((a,b)=>b.qty-a.qty).slice(0,6);
      const openShift=db.shifts.find(s=>s.status==='open')||null;
      return json(res,200,{today:{revenue,items,salesCount:todaySales.length},lowStock:low,topSales:top,recentSales:db.sales.slice(0,20),openShift});
    }

    if(req.method==='GET' && url==='/api/sales'){
      const u=auth(req,res); if(!u)return;
      return json(res,200,{sales:db.sales.slice(0,500)});
    }

    if(req.method==='GET' && url==='/api/audit'){
      const u=auth(req,res,'manager'); if(!u)return;
      return json(res,200,{audit:db.audit.slice(0,500)});
    }

    if(req.method==='GET' && url==='/api/notifications'){
      const u=auth(req,res,'manager'); if(!u)return;
      const notifications=db.notifications.slice(0,100).map(n=>({...n,read:!!n.readBy?.[u.id]}));
      return json(res,200,{notifications});
    }

    if(req.method==='POST' && url==='/api/notifications/read'){
      const u=auth(req,res,'manager'); if(!u)return;
      const b=await readBody(req);
      const n=db.notifications.find(x=>x.id===b.id);
      if(!n)return json(res,404,{error:'Értesítés nem található'});
      n.readBy ||= {};
      n.readBy[u.id]=new Date().toISOString();
      await writeDB(db);
      return json(res,200,{ok:true});
    }

    // ---------- SHIFTS / CASH REGISTER ----------
    if(req.method==='GET' && url==='/api/shifts'){
      const u=auth(req,res,'owner'); if(!u)return;
      return json(res,200,{shifts:db.shifts.slice(0,500)});
    }

    if(req.method==='GET' && url==='/api/shifts/current'){
      const u=auth(req,res); if(!u)return;
      const open=db.shifts.find(s=>s.status==='open')||null;
      return json(res,200,{shift:open});
    }

    if(req.method==='POST' && url==='/api/shifts/open'){
      const u=auth(req,res);
      if(!u)return;
      const existing=db.shifts.find(s=>s.status==='open');
      if(existing) return json(res,409,{error:`Már van nyitott műszak: ${existing.startedByName}. Zárd le előbb.`});
      const b=await readBody(req);
      const openingCash=Number(b.openingCash)||0;
      const members=Array.isArray(b.members)?b.members.map(String).filter(Boolean):[];
      if(!members.includes(u.name)) members.unshift(u.name);
      const shift={
        id:'sh_'+crypto.randomBytes(7).toString('hex'),
        status:'open',
        startedAt:new Date().toISOString(),
        endedAt:null,
        startedById:u.id,
        startedByName:u.name,
        members:[...new Set(members)],
        openingCash,
        closingCash:null,
        revenue:0,
        salesCount:0,
        items:0,
        notes:String(b.notes||'')
      };
      db.shifts.unshift(shift);
      audit(db,u,'SHIFT_OPEN',`Műszak nyitva · kezdő kassza ${openingCash} Ft · ${shift.members.join(', ')}`);
      await writeDB(db);
      return json(res,201,{shift});
    }

    if(req.method==='POST' && url==='/api/shifts/close'){
      const u=auth(req,res);
      if(!u)return;
      const shift=db.shifts.find(s=>s.status==='open');
      if(!shift)return json(res,409,{error:'Nincs nyitott műszak.'});
      const b=await readBody(req);
      const sales=db.sales.filter(s=>s.shiftId===shift.id);
      const revenue=sales.reduce((a,s)=>a+s.total,0);
      const items=sales.reduce((a,s)=>a+s.qty,0);
      const closingCash=Number(b.closingCash);
      if(!Number.isFinite(closingCash)||closingCash<0)return json(res,400,{error:'Adj meg érvényes záró kassza összeget.'});
      shift.status='closed';
      shift.endedAt=new Date().toISOString();
      shift.closedById=u.id;
      shift.closedByName=u.name;
      shift.closingCash=closingCash;
      shift.revenue=revenue;
      shift.salesCount=sales.length;
      shift.items=items;
      shift.notes=String(b.notes||shift.notes||'');
      audit(db,u,'SHIFT_CLOSE',`Műszak zárva · bevétel ${revenue} Ft · záró kassza ${closingCash} Ft`);
      await writeDB(db);
      return json(res,200,{shift,transfer:{
        amount:revenue,
        account:'21541444-70524373',
        name:'Zhen Yu Xiao'
      }});
    }

    // ---------- OWNER: DELETE CLOSED SHIFT + ITS SHIFT DATA ----------
    if(req.method==='DELETE' && url.startsWith('/api/shifts/')){
      const u=auth(req,res,'owner'); if(!u)return;
      const id=decodeURIComponent(url.split('/').pop());
      const idx=db.shifts.findIndex(s=>s.id===id);
      if(idx<0)return json(res,404,{error:'A műszak nem található'});
      const shift=db.shifts[idx];
      if(shift.status!=='closed')return json(res,400,{error:'Csak lezárt műszak törölhető.'});
      const shiftSales=db.sales.filter(x=>x.shiftId===id);
      const saleIds=new Set(shiftSales.map(x=>x.id));
      const shiftDocs=db.documents.filter(x=>saleIds.has(x.saleId) || shiftSales.some(s=>s.documentId===x.id));
      // A műszak törlésekor az ahhoz tartozó eladások is törlődnek,
      // a készlet pedig visszaáll az eladások előtti állapotra.
      for(const sale of shiftSales){
        const product=db.products.find(p=>p.id===sale.productId);
        if(product) product.stock += Number(sale.qty)||0;
      }
      db.documents=db.documents.filter(x=>!shiftDocs.includes(x));
      db.sales=db.sales.filter(x=>x.shiftId!==id);
      db.shifts.splice(idx,1);
      audit(db,u,'SHIFT_DELETE',`Lezárt műszak törölve · ${id} · ${shiftSales.length} eladás · ${shiftDocs.length} számla · készlet visszaállítva`);
      await writeDB(db);
      return json(res,200,{ok:true,deletedShiftId:id,deletedSales:shiftSales.length,deletedInvoices:shiftDocs.length});
    }

    if(req.method==='GET' && url.startsWith('/api/shifts/')){
      const u=auth(req,res); if(!u)return;
      const id=url.split('/').pop();
      const shift=db.shifts.find(s=>s.id===id);
      if(!shift)return json(res,404,{error:'Műszak nem található'});
      const sales=db.sales.filter(s=>s.shiftId===shift.id);
      return json(res,200,{shift,sales});
    }

    // ---------- SALES + RECEIPTS / INVOICES ----------
    if(req.method==='POST' && url==='/api/sales'){
      const u=auth(req,res);
      if(!u)return;
      const shift=db.shifts.find(s=>s.status==='open');
      if(!shift)return json(res,409,{error:'Eladás előtt nyisd meg a kasszát / műszakot.'});
      const b=await readBody(req);
      const p=db.products.find(x=>x.id===b.productId && x.active);
      const qty=Math.floor(Number(b.qty));
      if(!p)return json(res,400,{error:'A termék nem található'});
      if(!Number.isInteger(qty)||qty<1)return json(res,400,{error:'Érvénytelen mennyiség'});
      if(p.stock<qty)return json(res,400,{error:`Nincs elég készlet. Jelenleg ${p.stock} db van.`});
      const total=p.price*qty;
      p.stock-=qty;
      const paymentMethod=['cash','card','transfer'].includes(b.paymentMethod)?b.paymentMethod:'cash';
      const sale={
        id:crypto.randomUUID(),at:new Date().toISOString(),userId:u.id,user:u.name,
        productId:p.id,product:p.name,category:p.category,qty,unitPrice:p.price,total,
        shiftId:shift.id,paymentMethod,documentId:null
      };
      db.sales.unshift(sale);
      audit(db,u,'SALE',`${p.name} × ${qty} · ${total} Ft · ${paymentMethod} · műszak ${shift.id}`);
      await writeDB(db);
      return json(res,201,{sale,product:p,shift});
    }

    if(req.method==='DELETE' && url.startsWith('/api/sales/')){
      const u=auth(req,res,'manager');
      if(!u)return;
      const id=decodeURIComponent(url.split('/').pop());
      const idx=db.sales.findIndex(x=>x.id===id);
      if(idx<0)return json(res,404,{error:'Az eladás nem található'});
      const sale=db.sales[idx];
      const doc=db.documents.find(x=>x.id===sale.documentId);
      // MANAGER és OWNER is törölhet eladást. A számlát külön dokumentumként megtartjuk.
      const product=db.products.find(x=>x.id===sale.productId);
      if(product){
        product.stock += sale.qty;
        audit(db,u,'SALE_DELETE_STOCK_RESTORE',`${product.name}: +${sale.qty} db visszahelyezve`);
      }
      db.sales.splice(idx,1);
      // A számla megmarad, mert azt csak OWNER törölheti a számlalistából.
      audit(db,u,'SALE_DELETE',`${sale.product} × ${sale.qty} · ${sale.total} Ft · ${sale.id}${doc?' · kapcsolt számla: '+doc.id:''}`);
      await writeDB(db);
      return json(res,200,{ok:true,deletedSaleId:sale.id,deletedInvoiceId:null,restoredStock:sale.qty,invoicePreserved:!!doc});
    }

    if(req.method==='POST' && url==='/api/documents'){
      const u=auth(req,res);
      if(!u)return;
      const b=await readBody(req);
      const sale=db.sales.find(s=>s.id===b.saleId);
      if(!sale)return json(res,404,{error:'Az eladás nem található'});
      const type='invoice';
      const doc={
        id:'DOC-'+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(),
        type,
        createdAt:new Date().toISOString(),
        createdById:u.id,createdByName:u.name,
        saleId:sale.id,shiftId:sale.shiftId,
        customer:{
          name:String(b.customer?.name||'Vásárló'),
          address:String(b.customer?.address||''),
          taxNumber:String(b.customer?.taxNumber||'')
        },
        seller:{name:'Red Moon Pub',owner:'Zhen Yu Xiao'},
        items:[{product:sale.product,qty:sale.qty,unitPrice:sale.unitPrice,total:sale.total}],
        total:sale.total,
        paymentMethod:sale.paymentMethod
      };
      db.documents.unshift(doc);
      sale.documentId=doc.id;
      audit(db,u,'INVOICE_CREATE',`${doc.id} · ${sale.product} · ${sale.total} Ft`);
      notifyManagersOwners(db,'Új számla készült',`${u.name} számlát készített: ${doc.id} · ${sale.product} · ${sale.total} Ft`,{documentId:doc.id,saleId:sale.id,createdBy:u.name});
      await writeDB(db);
      return json(res,201,{document:doc});
    }

    if(req.method==='DELETE' && url.startsWith('/api/documents/')){
      const u=auth(req,res,'owner');
      if(!u)return;
      const id=decodeURIComponent(url.split('/').pop());
      const idx=db.documents.findIndex(x=>x.id===id);
      if(idx<0)return json(res,404,{error:'A számla nem található'});
      const doc=db.documents[idx];
      const sale=db.sales.find(x=>x.id===doc.saleId);
      if(sale && sale.documentId===doc.id)sale.documentId=null;
      db.documents.splice(idx,1);
      audit(db,u,'INVOICE_DELETE',`${doc.id} · ${doc.total} Ft`);
      await writeDB(db);
      return json(res,200,{ok:true,deletedInvoiceId:doc.id});
    }

    if(req.method==='GET' && url==='/api/documents'){
      const u=auth(req,res,'manager'); if(!u)return;
      return json(res,200,{documents:db.documents.slice(0,500)});
    }

    // ---------- INVENTORY / PRODUCTS ----------
    if(req.method==='POST' && url==='/api/inventory/adjust'){
      const u=auth(req,res,'manager'); if(!u)return;
      const b=await readBody(req); const p=db.products.find(x=>x.id===b.productId); const stock=Math.floor(Number(b.stock));
      if(!p || !Number.isInteger(stock) || stock<0)return json(res,400,{error:'Érvénytelen készletadat'});
      const old=p.stock; p.stock=stock; audit(db,u,'INVENTORY_ADJUST',`${p.name}: ${old} → ${stock}`); await writeDB(db);
      return json(res,200,{product:p});
    }

    if(req.method==='POST' && url==='/api/products'){
      const u=auth(req,res,'manager'); if(!u)return;
      const b=await readBody(req);
      if(!b.name||!b.category)return json(res,400,{error:'Név és kategória kötelező'});
      const p={id:'p_'+crypto.randomBytes(6).toString('hex'),name:String(b.name),category:b.category==='food'?'food':'drink',price:currency(b.price),stock:Math.max(0,Math.floor(currency(b.stock))),minStock:Math.max(0,Math.floor(currency(b.minStock))),image:String(b.image||''),active:true};
      db.products.push(p); audit(db,u,'PRODUCT_CREATE',p.name); await writeDB(db); return json(res,201,{product:p});
    }

    if(req.method==='PATCH' && url.startsWith('/api/products/')){
      const u=auth(req,res,'manager'); if(!u)return;
      const id=url.split('/').pop(); const p=db.products.find(x=>x.id===id);
      if(!p)return json(res,404,{error:'Termék nem található'});
      const b=await readBody(req);
      if(b.name!==undefined)p.name=String(b.name);
      if(b.price!==undefined)p.price=currency(b.price);
      if(b.minStock!==undefined)p.minStock=Math.max(0,Math.floor(currency(b.minStock)));
      if(b.active!==undefined)p.active=!!b.active;
      audit(db,u,'PRODUCT_UPDATE',p.name); await writeDB(db); return json(res,200,{product:p});
    }

    // ---------- USERS / OWNER ----------
    if(req.method==='GET' && url==='/api/users'){
      const u=auth(req,res,'owner'); if(!u)return;
      return json(res,200,{users:db.users.map(publicUser)});
    }

    if(req.method==='POST' && url==='/api/users'){
      const u=auth(req,res,'owner'); if(!u)return;
      const b=await readBody(req);
      if(!b.username||!b.password||!b.name)return json(res,400,{error:'Név, felhasználónév és jelszó kötelező'});
      if(db.users.some(x=>x.username.toLowerCase()===String(b.username).toLowerCase()))return json(res,409,{error:'Ez a felhasználónév már létezik'});
      const role=['staff','manager','owner','dj'].includes(b.role)?b.role:'staff';
      const hp=hashPassword(String(b.password));
      const nu={id:'u_'+crypto.randomBytes(6).toString('hex'),username:String(b.username),name:String(b.name),role,passwordHash:`PBKDF2:310000:sha256:${hp.salt}:${hp.hash}`};
      db.users.push(nu);
      audit(db,u,'USER_CREATE',`${nu.name} (${nu.role})`);
      await writeDB(db);
      return json(res,201,{user:publicUser(nu)});
    }

    if(req.method==='PATCH' && url.startsWith('/api/users/')){
      const u=auth(req,res,'owner'); if(!u)return;
      const id=decodeURIComponent(url.split('/').pop());
      const target=db.users.find(x=>x.id===id);
      if(!target)return json(res,404,{error:'Felhasználó nem található'});
      const b=await readBody(req);
      const nextName=String(b.name??target.name).trim();
      const nextUsername=String(b.username??target.username).trim();
      const nextRole=String(b.role??target.role).toLowerCase();
      const newPassword=String(b.password??'');
      if(!nextName||!nextUsername)return json(res,400,{error:'A név és a felhasználónév kötelező'});
      if(!['staff','manager','owner','dj'].includes(nextRole))return json(res,400,{error:'Érvénytelen jogosultsági szint'});
      const duplicate=db.users.find(x=>x.id!==id && x.username.toLowerCase()===nextUsername.toLowerCase());
      if(duplicate)return json(res,409,{error:'Ez a felhasználónév már használatban van'});
      if(target.role==='owner' && nextRole!=='owner' && db.users.filter(x=>x.role==='owner').length<=1){
        return json(res,400,{error:'Az utolsó OWNER jogosultság nem vehető el.'});
      }
      target.name=nextName;
      target.username=nextUsername;
      target.role=nextRole;
      let passwordChanged=false;
      if(newPassword){
        const hp=hashPassword(newPassword);
        target.passwordHash=`PBKDF2:310000:sha256:${hp.salt}:${hp.hash}`;
        passwordChanged=true;
      }
      const revokedSessionIds=[];
      for(const [sid,session] of sessions.entries()){
        if(session.id===target.id){
          if(passwordChanged){
            revokedSessionIds.push(sid);
            sessions.delete(sid);
          } else {
            session.username=target.username;
            session.name=target.name;
            session.role=target.role;
            session.lastSeen=Date.now();
          }
        }
      }
      audit(db,u,'USER_UPDATE',`${target.name} (${target.username}) · ${target.role}${passwordChanged?' · jelszó frissítve · aktív munkamenetek kiléptetve':''}`);
      await writeDB(db);
      if(passwordChanged){
        broadcastRealtime('session_revoked',{targetUserId:target.id,reason:'password_changed'});
      }
      return json(res,200,{user:publicUser(target),sessionRevoked:passwordChanged});
    }

    if(req.method==='DELETE' && url.startsWith('/api/users/')){
      const u=auth(req,res,'owner'); if(!u)return;
      const id=decodeURIComponent(url.split('/').pop());
      if(id===u.id)return json(res,400,{error:'A saját OWNER fiókodat nem törölheted.'});
      const target=db.users.find(x=>x.id===id);
      if(!target)return json(res,404,{error:'Felhasználó nem található'});
      if(target.role==='owner' && db.users.filter(x=>x.role==='owner').length<=1)return json(res,400,{error:'Az utolsó OWNER fiók nem törölhető.'});
      db.users=db.users.filter(x=>x.id!==id);
      for(const [sid,session] of sessions.entries()) if(session.id===id) sessions.delete(sid);
      audit(db,u,'USER_DELETE',`${target.name} (${target.username})`);
      await writeDB(db);
      return json(res,200,{ok:true});
    }

    // ---------- OWNER PERFORMANCE ----------
    if(req.method==='GET' && url==='/api/owner/performance'){
      const u=auth(req,res,'owner'); if(!u)return;
      const now=Date.now();
      const shifts=db.shifts.filter(s=>s.status==='closed');
      const userMap={};
      for(const s of shifts){
        const sales=db.sales.filter(x=>x.shiftId===s.id);
        const duration=Math.max(0,(new Date(s.endedAt)-new Date(s.startedAt))/3600000);
        for(const name of (s.members||[s.startedByName])){
          userMap[name] ||= {name,shifts:0,revenue:0,sales:0,items:0,hours:0};
          userMap[name].shifts++;
          userMap[name].revenue+=s.revenue||sales.reduce((a,x)=>a+x.total,0);
          userMap[name].sales+=sales.filter(x=>x.user===name).length;
          userMap[name].items+=sales.filter(x=>x.user===name).reduce((a,x)=>a+x.qty,0);
          userMap[name].hours+=duration;
        }
      }
      const staff=Object.values(userMap).map(x=>({...x,revenuePerHour:x.hours?Math.round(x.revenue/x.hours):0}));
      const shiftBreakdown=shifts.map(s=>{
        const ss=db.sales.filter(x=>x.shiftId===s.id);
        const byUser={};
        for(const x of ss){
          byUser[x.user] ||= {name:x.user,revenue:0,sales:0,items:0};
          byUser[x.user].revenue+=x.total; byUser[x.user].sales++; byUser[x.user].items+=x.qty;
        }
        return {...s,employees:Object.values(byUser)};
      });
      const productMap={};
      for(const s of db.sales){productMap[s.product]=(productMap[s.product]||0)+s.qty}
      const topProducts=Object.entries(productMap).map(([product,qty])=>({product,qty})).sort((a,b)=>b.qty-a.qty).slice(0,12);
      return json(res,200,{staff,shifts:shifts.slice(0,100),shiftBreakdown:shiftBreakdown.slice(0,100),topProducts,generatedAt:new Date().toISOString()});
    }

    return json(res,404,{error:'API útvonal nem található'});
  }catch(e){
    console.error(e);
    return json(res,500,{error:'Szerverhiba',detail:process.env.NODE_ENV==='development'?e.message:undefined});
  }
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(url.pathname.startsWith('/api/')) return api(req,res,url.pathname);
  let p=decodeURIComponent(url.pathname); if(p==='/' )p='/index.html'; if(p==='/staff')p='/staff.html';
  const file=path.normalize(path.join(PUBLIC,p)); if(!file.startsWith(PUBLIC)) return res.writeHead(403).end('Forbidden');
  fs.stat(file,(err,st)=>{if(err||!st.isFile())return res.writeHead(404).end('Not found'); const ext=path.extname(file).toLowerCase(); res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(file).pipe(res)});
});
// Minimal WebSocket signaling server (text frames only) so the project needs no extra runtime package.
function wsFrame(text){
  const data=Buffer.from(String(text)); const len=data.length; let head;
  if(len<126) head=Buffer.from([0x81,len]);
  else if(len<65536){ head=Buffer.alloc(4); head[0]=0x81; head[1]=126; head.writeUInt16BE(len,2); }
  else { head=Buffer.alloc(10); head[0]=0x81; head[1]=127; head.writeBigUInt64BE(BigInt(len),2); }
  return Buffer.concat([head,data]);
}
function wsSend(client,obj){ try{if(!client.socket.destroyed)client.socket.write(wsFrame(JSON.stringify(obj)))}catch{} }
function wsClose(client,code=1000){ try{const b=Buffer.alloc(2);b.writeUInt16BE(code);client.socket.write(Buffer.from([0x88,2,b[0],b[1]]));client.socket.end()}catch{} }
function parseWsFrames(client,chunk){
  client.buf=Buffer.concat([client.buf||Buffer.alloc(0),chunk]);
  while(client.buf.length>=2){
    const b0=client.buf[0], b1=client.buf[1], opcode=b0&15, masked=!!(b1&128); let len=b1&127, off=2;
    if(len===126){if(client.buf.length<4)break;len=client.buf.readUInt16BE(2);off=4}
    else if(len===127){if(client.buf.length<10)break;const n=client.buf.readBigUInt64BE(2);if(n>BigInt(1e7)){wsClose(client,1009);return}len=Number(n);off=10}
    if(masked)off+=4; if(client.buf.length<off+len)break;
    let payload=client.buf.subarray(off,off+len); if(masked){const key=client.buf.subarray(off-4,off);const out=Buffer.alloc(len);for(let i=0;i<len;i++)out[i]=payload[i]^key[i%4];payload=out}
    client.buf=client.buf.subarray(off+len);
    if(opcode===8){try{client.socket.end()}catch{};return}
    if(opcode===9){try{client.socket.write(Buffer.from([0x8A,0]))}catch{};continue}
    if(opcode!==1)continue;
    let m;try{m=JSON.parse(payload.toString('utf8'))}catch{continue}
    handleWsMessage(client,m);
  }
}
function handleWsMessage(client,m){
  if(client.mode==='dj' && m.type==='offer' && m.viewerId){ const v=[...wsClients].find(x=>x.id===m.viewerId&&x.mode==='viewer'); if(v)wsSend(v,{type:'offer',offer:m.offer,viewerId:client.id}); return; }
  if(client.mode==='viewer' && m.type==='answer' && liveDJ.socket){ wsSend(liveDJ.socket,{type:'answer',answer:m.answer,viewerId:client.id}); return; }
  if(m.type==='ice' && m.targetId){ const target=[...wsClients].find(x=>x.id===m.targetId); if(target)wsSend(target,{type:'ice',candidate:m.candidate,viewerId:client.id}); }
}
function upgradeWebSocket(req,socket){
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(u.pathname!=='/ws'){socket.destroy();return;}
  const mode=u.searchParams.get('mode')==='dj'?'dj':'viewer'; let user=null;
  if(mode==='dj'){ const sid=parseCookies(req).rm_session; const sess=sid&&sessions.get(sid); if(!sess||sess.role!=='dj'){socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');socket.destroy();return;} user=sess; }
  const key=req.headers['sec-websocket-key']; if(!key){socket.destroy();return;}
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const client={socket,mode,id:crypto.randomUUID(),userId:user?.id||null,buf:Buffer.alloc(0)}; wsClients.add(client);
  if(mode==='dj'){if(liveDJ.socket&&liveDJ.socket!==client)wsClose(liveDJ.socket,4001);liveDJ.socket=client;}
  wsSend(client,{type:'live_state',...publicLiveState()});
  if(mode==='viewer'&&liveDJ.active&&liveDJ.socket)wsSend(liveDJ.socket,{type:'viewer_joined',viewerId:client.id});
  socket.on('data',chunk=>parseWsFrames(client,chunk));
  const cleanup=()=>{wsClients.delete(client);if(mode==='viewer'&&liveDJ.socket&&liveDJ.active)wsSend(liveDJ.socket,{type:'viewer_left',viewerId:client.id});if(mode==='dj'&&liveDJ.socket===client)stopLiveDJ('dj_disconnected')};
  socket.on('close',cleanup);socket.on('error',cleanup);
}
server.on('upgrade',(req,socket,head)=>{ upgradeWebSocket(req,socket); if(head&&head.length) socket.emit('data',head); });

initDB().then(()=>{
  server.listen(PORT,()=>console.log(`Red Moon Pub V17 online server running on port ${PORT}${pool?' · PostgreSQL':' · local db.json'}`));
}).catch(err=>{
  console.error('Red Moon database initialization failed:',err);
  process.exit(1);
});
