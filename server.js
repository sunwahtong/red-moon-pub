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
const clubRealtimeClients = new Set();
const clubListeners = new Map();

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
  if(migrateCartIds()) await writeDB(db);
}

const CANONICAL_DRINKS = [{"id":"p_kobaltas","name":"Kőbaltás","category":"drink","price":1200,"stock":24,"minStock":8,"image":"assets/menu/drinks/kobaltas.png","active":true},{"id":"p_barracho","name":"Barracho","category":"drink","price":1800,"stock":24,"minStock":8,"image":"assets/menu/drinks/barracho.png","active":true},{"id":"p_sornyito","name":"Sörnyitó","category":"drink","price":2400,"stock":18,"minStock":6,"image":"assets/menu/drinks/sornyito.png","active":true},{"id":"p_syrah","name":"Syrah vörösbor","category":"drink","price":5000,"stock":18,"minStock":6,"image":"assets/menu/drinks/syrah.png","active":true},{"id":"p_two_roosters","name":"Two Roosters rozé","category":"drink","price":5600,"stock":18,"minStock":6,"image":"assets/menu/drinks/two_roosters.png","active":true},{"id":"p_bleuterd","name":"Bleuter'D pezsgő","category":"drink","price":4800,"stock":18,"minStock":6,"image":"assets/menu/drinks/bleuterd.png","active":true},{"id":"p_mount_bourbon","name":"The Mount Bourbon Whiskey","category":"drink","price":11200,"stock":16,"minStock":5,"image":"assets/menu/drinks/mount_bourbon.png","active":true},{"id":"p_vinewood","name":"Vinewood Sauvignon Blanc fehérbor","category":"drink","price":5800,"stock":18,"minStock":6,"image":"assets/menu/drinks/vinewood.png","active":true},{"id":"p_chernekov","name":"Cherenkov Premium Vodka","category":"drink","price":12600,"stock":16,"minStock":5,"image":"assets/menu/drinks/chernekov.png","active":true},{"id":"p_cazafortunas","name":"Cazafortunas Tequila","category":"drink","price":12200,"stock":16,"minStock":5,"image":"assets/menu/drinks/cazafortunas.png","active":true},{"id":"p_sinmisito","name":"Sinmisito Tequila","category":"drink","price":15800,"stock":14,"minStock":4,"image":"assets/menu/drinks/sinmisito.png","active":true},{"id":"p_ragga","name":"Ragga rum","category":"drink","price":11200,"stock":16,"minStock":5,"image":"assets/menu/drinks/ragga.png","active":true},{"id":"p_sprunk","name":"Sprunk (dobozos)","category":"drink","price":1780,"stock":30,"minStock":10,"image":"assets/menu/drinks/sprunk.png","active":true},{"id":"p_ecola","name":"E-Cola (dobozos)","category":"drink","price":1780,"stock":30,"minStock":10,"image":"assets/menu/drinks/ecola.png","active":true},{"id":"p_raine","name":"Rainé ásványvíz","category":"drink","price":1600,"stock":32,"minStock":10,"image":"assets/menu/drinks/raine.png","active":true}];

function initialsFromName(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  const letters=parts.map(part=>{
    const clean=part.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'');
    return clean ? clean[0].toUpperCase() : '';
  }).filter(Boolean);
  if(letters.length>=2) return letters.slice(0,6).join('');
  const fallback=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  return (fallback.slice(0,3) || 'RED');
}
function makeCartId(shift,user,number){
  return `${initialsFromName(user.name)}${String(number).padStart(2,'0')}`;
}
function migrateCartIds(){
  db.sales ||= [];
  db.shifts ||= [];
  const valid=/^[A-Z]{2,8}\d{2,}$/;
  const counters=new Map();
  let changed=false;
  const groups=new Map();
  for(const sale of db.sales){
    const key=`${sale.shiftId||'legacy'}::${sale.userId||sale.user||'unknown'}::${sale.transactionId||sale.id}`;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(sale);
  }
  const ordered=[...groups.values()].sort((a,b)=>new Date(a[0].at||0)-new Date(b[0].at||0));
  for(const group of ordered){
    const first=group[0];
    const shift=db.shifts.find(x=>x.id===first.shiftId);
    const name=first.user||shift?.startedByName||'Red Moon';
    const counterKey=`${first.shiftId||'legacy'}::${first.userId||name}`;
    let n=counters.get(counterKey)||0;
    const existing=String(first.cartId||'');
    if(valid.test(existing)){
      const m=existing.match(/(\d+)$/); n=Math.max(n,Number(m[1])||0); counters.set(counterKey,n);
      if(shift){ shift.cartCounters ||= {}; shift.cartCounters[String(first.userId||name)] = Math.max(Number(shift.cartCounters[String(first.userId||name)])||0,n); }
      continue;
    }
    n+=1; counters.set(counterKey,n);
    if(shift){ shift.cartCounters ||= {}; shift.cartCounters[String(first.userId||name)] = n; }
    const cartId=makeCartId(shift,{name},n);
    for(const sale of group){ sale.cartId=cartId; changed=true; }
  }
  return changed;
}

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
function broadcastClub(type='club_state', payload={}){
  const message=`data: ${JSON.stringify({type,...payload,at:new Date().toISOString()})}\n\n`;
  for(const client of [...clubRealtimeClients]){ try{client.res.write(message)}catch{clubRealtimeClients.delete(client)} }
}
function clubDefaults(){ return {live:false,dj:null,title:'',current:null,queue:[],chat:[],requests:[],nameRequests:[],approvedNames:[],bans:[],startedAt:null,library:[],provider:'gocast',providerUrl:'https://gocast.fm/station/red-moon-pub'}; }
function ensureMusicDir(){ const dir=path.join(PUBLIC,'assets','dj-music'); fs.mkdirSync(dir,{recursive:true}); return dir; }
function sanitizeFilename(name){ let n=String(name||'track').normalize('NFKC').replace(/[^a-zA-Z0-9._ -]+/g,'_').trim(); if(!n)n='track'; return n.slice(0,100); }
function extAllowed(name){ return ['.mp3','.wav','.ogg','.m4a','.aac','.webm'].includes(path.extname(name).toLowerCase()); }
function readMultipartAudio(req){ return new Promise((resolve,reject)=>{ const ct=String(req.headers['content-type']||''); const m=ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i); if(!m)return reject(new Error('Multipart feltöltés szükséges')); const boundary=Buffer.from('--'+(m[1]||m[2])); const chunks=[]; let total=0; req.on('data',c=>{ total+=c.length; if(total>80*1024*1024){reject(new Error('A zene maximum 80 MB lehet.')); req.destroy(); return;} chunks.push(c); }); req.on('end',()=>{ try{ const buf=Buffer.concat(chunks); const start=buf.indexOf(Buffer.from('Content-Disposition:'),'utf8'); if(start<0)throw new Error('Fájl nem található a feltöltésben'); const headerEnd=buf.indexOf(Buffer.from('\r\n\r\n'),start); if(headerEnd<0)throw new Error('Érvénytelen feltöltés'); const header=buf.slice(start,headerEnd).toString('utf8'); const fm=header.match(/filename="([^"]*)"/i); const filename=fm?fm[1]:''; const dataStart=headerEnd+4; const end=buf.indexOf(Buffer.concat([Buffer.from('\r\n'),boundary]),dataStart); if(end<0)throw new Error('Érvénytelen fájlhatár'); resolve({filename,data:buf.slice(dataStart,end)}); }catch(e){reject(e)} }); req.on('error',reject); }); }
function ensureClub(){ db.club ||= clubDefaults(); db.club.library ||= []; db.club.nameRequests ||= []; db.club.approvedNames ||= []; db.club.bans ||= []; db.club.chat ||= []; db.club.requests ||= []; db.club.queue ||= []; return db.club; }
function getClientIP(req){ const x=String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||req.socket.remoteAddress||'').split(',')[0].trim(); return x.replace(/^::ffff:/,'') || 'unknown'; }
function activeBan(ip){ const c=ensureClub(), now=Date.now(); c.bans=c.bans.filter(b=>!b.until || b.until>now); return c.bans.find(b=>b.ip===ip)||null; }
function cleanNameToken(raw){ return String(raw||'').trim().slice(0,160); }
function approvedIdentity(req,name,token){ const c=ensureClub(), ip=getClientIP(req), n=String(name||'').trim().slice(0,32), t=cleanNameToken(token); if(!n||!t)return false; const ban=activeBan(ip); if(ban)return false; const hash=crypto.createHash('sha256').update(t).digest('hex'); return c.approvedNames.some(x=>x.tokenHash===hash && x.ip===ip && x.name===n && x.expiresAt>Date.now()); }
function clubState(){
  const c=ensureClub();
  purgeExpiredChat();
  const active=[...clubListeners.entries()].filter(([id,x])=>!id.startsWith('chat:')&&!id.startsWith('request:')&&x.lastSeen>Date.now()-30000);
  for(const [id,x] of clubListeners) if(x.lastSeen<=Date.now()-30000) clubListeners.delete(id);
  c.nameRequests=c.nameRequests.filter(x=>x.status==='pending').slice(0,80);
  c.approvedNames=c.approvedNames.filter(x=>x.expiresAt>Date.now()).slice(-300);
  c.bans=c.bans.filter(x=>!x.until||x.until>Date.now()).slice(-200);
  return {serverNow:Date.now(),live:!!c.live,dj:c.dj||null,title:c.title||'',provider:c.provider||'gocast',providerUrl:c.providerUrl||'https://gocast.fm/station/red-moon-pub',current:null,queue:[],library:[],chat:(c.chat||[]).slice(0,8).map(publicChatMessage),requests:[],nameRequests:[],listenerCount:active.length,startedAt:c.startedAt||null};
}
function broadcastClubState(){ broadcastClub('club_state',{state:clubState()}); }
function authDJ(req,res){ const u=sessionUser(req); if(!u){json(res,401,{error:'Bejelentkezés szükséges'});return null;} if(!['dj','manager','owner'].includes(u.role)){json(res,403,{error:'Ehhez a DJ jogosultság szükséges'});return null;} return u; }
function parseYoutubeLink(raw){
  const value=String(raw||'').trim(); if(!value)return null;
  let u; try{u=new URL(value)}catch{return null;}
  const host=u.hostname.replace(/^www\./,'').toLowerCase();
  let videoId=null, playlistId=u.searchParams.get('list');
  if(host==='youtu.be') videoId=u.pathname.split('/').filter(Boolean)[0]||null;
  else if(host==='youtube.com'||host==='m.youtube.com'||host==='music.youtube.com'){
    if(u.pathname==='/watch') videoId=u.searchParams.get('v');
    else if(u.pathname.startsWith('/shorts/')) videoId=u.pathname.split('/')[2]||null;
    else if(u.pathname.startsWith('/embed/')) videoId=u.pathname.split('/')[2]||null;
  }
  const clean=id=>id&&/^[A-Za-z0-9_-]{6,20}$/.test(id)?id:null; videoId=clean(videoId);
  if(playlistId && !/^[A-Za-z0-9_-]{6,100}$/.test(playlistId)) playlistId=null;
  if(!videoId && !playlistId)return null;
  return {type:videoId?'video':'playlist',videoId,playlistId,url:value,label:videoId?`YouTube · ${videoId}`:`YouTube playlist · ${playlistId}`};
}
function publicChatMessage(m){return {id:m.id,at:m.at,name:m.name,text:m.text,kind:m.kind||'chat',requestId:m.requestId||null};}
function djChatMessage(m){return {...publicChatMessage(m),ip:m.ip||null};}
function purgeExpiredChat(){ const c=ensureClub(); const cutoff=Date.now()-60000; c.chat=(c.chat||[]).filter(m=>new Date(m.at).getTime()>cutoff); }
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
  for(const s of dbState.sales){ s.shiftId ??= null; s.documentId ??= null; s.paymentMethod ??= 'cash'; s.transactionId ??= s.id; }
  try{
    if(req.method==='GET' && url==='/api/health'){
      return json(res,200,{ok:true,service:'red-moon-staff',version:'19.0-realtime-neon',time:new Date().toISOString()});
    }

    if(req.method==='POST' && url==='/api/login'){
      const b=await readBody(req);
      const u=db.users.find(x=>x.username.toLowerCase()===String(b.username||'').trim().toLowerCase());
      if(!u || !verifyPassword(String(b.password||''),u.passwordHash)) return json(res,401,{error:'Hibás felhasználónév vagy jelszó'});
      const sid=crypto.randomBytes(32).toString('hex');
      sessions.set(sid,{id:u.id,username:u.username,name:u.name,role:u.role,lastSeen:Date.now(),ip:getClientIP(req)});
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
    // ---------- RED MOON CLUB PUBLIC REALTIME ----------
    if(req.method==='GET' && url==='/api/club/state'){ return json(res,200,{state:clubState()}); }
    if(req.method==='GET' && url==='/api/club/events'){
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-store, must-revalidate','Connection':'keep-alive','X-Accel-Buffering':'no-store'});
      res.write(`data: ${JSON.stringify({type:'connected',state:clubState(),at:new Date().toISOString()})}\n\n`);
      const client={res}; clubRealtimeClients.add(client);
      const keepAlive=setInterval(()=>{try{res.write(': keepalive\n\n')}catch{}},20000);
      req.on('close',()=>{clearInterval(keepAlive);clubRealtimeClients.delete(client);try{res.end()}catch{}});
      return;
    }
    if(req.method==='POST' && url==='/api/club/listener'){
      const b=await readBody(req); const id=String(b.id||'').trim(); if(!id)return json(res,400,{error:'Hiányzó listener azonosító'});
      clubListeners.set(id,{lastSeen:Date.now()}); broadcastClubState(); return json(res,200,{ok:true});
    }
    if(req.method==='GET' && url.startsWith('/api/club/name-status')){
      const q=new URL('http://red-moon.local'+url).searchParams; const clientId=String(q.get('clientId')||'').trim();
      if(!clientId)return json(res,400,{error:'Hiányzó kliens azonosító'}); const c=ensureClub(); const nr=c.nameRequests.find(x=>x.clientId===clientId);
      if(!nr)return json(res,200,{status:'none'});
      const approved=c.approvedNames.find(x=>x.ip===getClientIP(req)&&x.name===nr.name&&x.expiresAt>Date.now());
      if(nr.status==='accepted'&&approved){ const fresh=crypto.randomBytes(32).toString('hex'); approved.tokenHash=crypto.createHash('sha256').update(fresh).digest('hex'); return json(res,200,{status:'accepted',name:nr.name,token:fresh}); }
      return json(res,200,{status:nr.status,name:nr.name});
    }
    if(req.method==='POST' && url==='/api/club/name-request'){
      const b=await readBody(req); const name=String(b.name||'').trim().slice(0,32); const clientId=String(b.clientId||'').trim().slice(0,80);
      if(!name||!clientId)return json(res,400,{error:'Megjelenési név szükséges'});
      const ban=activeBan(getClientIP(req)); if(ban)return json(res,403,{error:`A chat tiltva van${ban.until?` ${new Date(ban.until).toLocaleString('hu-HU')}-ig`:''}. Indok: ${ban.reason||'nincs megadva'}`});
      const c=ensureClub(); const existing=c.nameRequests.find(x=>x.clientId===clientId&&x.status==='pending');
      if(existing){broadcastClubState();return json(res,200,{pending:true});}
      const approved=c.approvedNames.find(x=>x.ip===getClientIP(req)&&x.name===name&&x.expiresAt>Date.now()); if(approved){ const fresh=crypto.randomBytes(32).toString('hex'); approved.tokenHash=crypto.createHash('sha256').update(fresh).digest('hex'); return json(res,200,{approved:true,token:fresh,name}); }
      const request={id:crypto.randomUUID(),clientId,name,ip:getClientIP(req),at:new Date().toISOString(),status:'pending'}; c.nameRequests.unshift(request); c.nameRequests=c.nameRequests.slice(0,100); await writeDB(db); broadcastClub('name_request',{request:{id:request.id,clientId,name,at:request.at}}); broadcastClubState(); return json(res,201,{pending:true,requestId:request.id});
    }
    if(req.method==='POST' && url==='/api/club/chat'){
      const b=await readBody(req); const name=String(b.name||'').trim().slice(0,32); const text=String(b.text||'').trim().slice(0,500); const token=cleanNameToken(b.token);
      const djSession=sessionUser(req); const isDJ=djSession?.role==='dj';
      if(!name||!text||(!isDJ&&!approvedIdentity(req,name,token)))return json(res,403,{error:'Előbb kérd a megjelenési neved jóváhagyását a DJ-től.'});
      const ip=getClientIP(req), ban=activeBan(ip); if(ban)return json(res,403,{error:`Chat tiltás aktív. Indok: ${ban.reason||'nincs megadva'}`});
      const last=clubListeners.get(`chat:${ip}`)?.lastChat||0; if(Date.now()-last<5000)return json(res,429,{error:`Várj még ${Math.ceil((5000-(Date.now()-last))/1000)} mp-et az új üzenetig.`});
      clubListeners.set(`chat:${ip}`,{lastChat:Date.now(),lastSeen:Date.now()}); const c=ensureClub(); const msg={id:crypto.randomUUID(),at:new Date().toISOString(),name,text,kind:'chat'}; c.chat.unshift(msg); c.chat=c.chat.slice(0,120); await writeDB(db); broadcastClub('chat_message',{message:publicChatMessage(msg)}); broadcastClubState(); return json(res,201,{ok:true});
    }
    if(req.method==='DELETE' && url.startsWith('/api/club/chat/')){
      const u=authDJ(req,res); if(!u)return; const id=decodeURIComponent(url.slice('/api/club/chat/'.length)); const c=ensureClub(); const idx=c.chat.findIndex(x=>x.id===id); if(idx<0)return json(res,404,{error:'Üzenet nem található'}); const [removed]=c.chat.splice(idx,1); audit(db,u,'DJ_CHAT_DELETE',`${removed.name}: ${removed.text}`); await writeDB(db); broadcastClub('chat_deleted',{id}); broadcastClubState(); return json(res,200,{ok:true});
    }
    if(req.method==='POST' && url==='/api/club/request'){
      const b=await readBody(req); const name=String(b.name||'').trim().slice(0,32); const token=cleanNameToken(b.token);
      if(!name||!approvedIdentity(req,name,token))return json(res,403,{error:'Érvényes névjóváhagyás szükséges'});
      const ip=getClientIP(req), ban=activeBan(ip); if(ban)return json(res,403,{error:`Chat tiltás aktív. Indok: ${ban.reason||'nincs megadva'}`});
      const last=clubListeners.get(`request:${ip}`)?.lastRequest||0; if(Date.now()-last<5000)return json(res,429,{error:`Várj még ${Math.ceil((5000-(Date.now()-last))/1000)} mp-et az új kérésig.`});
      const c=ensureClub(); let item=null;
      if(b.trackId) item=(c.library||[]).find(x=>x.id===String(b.trackId))||null;
      if(!item && b.title){ const q=String(b.title).trim().slice(0,120); if(q)item={id:'text_'+crypto.randomUUID(),name:q,url:'',requestOnly:true}; }
      if(!item)return json(res,400,{error:'Válassz egy feltöltött zenét.'});
      const request={id:crypto.randomUUID(),at:new Date().toISOString(),name,ip,item:{id:item.id,name:item.name,url:item.url||''},status:'pending'}; c.requests.unshift(request); c.requests=c.requests.slice(0,100);
      const msg={id:crypto.randomUUID(),at:request.at,name,text:`Zenei kérés: ${item.name}`,kind:'request',requestId:request.id}; c.chat.unshift(msg); c.chat=c.chat.slice(0,120);
      clubListeners.set(`request:${ip}`,{lastRequest:Date.now(),lastSeen:Date.now()}); await writeDB(db); broadcastClub('chat_message',{message:publicChatMessage(msg)}); broadcastClub('music_request',{request:{id:request.id,name,item:item.name}}); broadcastClubState(); return json(res,201,{request});
    }
    if(req.method==='POST' && url==='/api/club/name-decision'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const id=String(b.id||''); const action=String(b.action||'').toLowerCase(); const c=ensureClub(); const nr=c.nameRequests.find(x=>x.id===id); if(!nr)return json(res,404,{error:'Névkérelem nem található'}); if(!['accept','decline'].includes(action))return json(res,400,{error:'Érvénytelen művelet'});
      nr.status=action==='accept'?'accepted':'declined'; nr.handledBy=u.name; nr.handledAt=new Date().toISOString(); let token=null;
      if(action==='accept'){ token=crypto.randomBytes(32).toString('hex'); c.approvedNames.push({tokenHash:crypto.createHash('sha256').update(token).digest('hex'),name:nr.name,ip:nr.ip,approvedAt:nr.handledAt,expiresAt:Date.now()+12*60*60*1000}); }
      await writeDB(db); broadcastClub('name_decision',{clientId:nr.clientId,accepted:action==='accept',name:nr.name,token}); broadcastClubState(); return json(res,200,{ok:true});
    }
    if(req.method==='POST' && url==='/api/club/ban'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const ip=String(b.ip||'').trim(); const minutes=Math.max(1,Math.min(10080,Number(b.minutes)||60)); const reason=String(b.reason||'').trim().slice(0,240); if(!ip||!reason)return json(res,400,{error:'IP-cím és indok kötelező'}); const c=ensureClub(); c.bans=c.bans.filter(x=>x.ip!==ip); c.bans.push({id:crypto.randomUUID(),ip,until:Date.now()+minutes*60000,minutes,reason,by:u.name,at:new Date().toISOString()}); await writeDB(db); broadcastClub('user_banned',{until:Date.now()+minutes*60000,reason}); broadcastClubState(); return json(res,200,{ok:true});
    }
    // ---------- DJ CONSOLE ----------
    if(req.method==='GET' && url==='/api/dj/state'){ const u=authDJ(req,res); if(!u)return; const c=ensureClub(); const st=clubState(); purgeExpiredChat(); st.chat=(c.chat||[]).slice(0,8).map(djChatMessage); st.requests=(c.requests||[]).slice(0,100).map(r=>({...r,ip:r.ip||null})); st.nameRequests=(c.nameRequests||[]).slice(0,80); return json(res,200,{state:st,me:publicUser(db.users.find(x=>x.id===u.id)||u)}); }
    if(req.method==='GET' && url==='/api/dj/events'){
      const u=authDJ(req,res); if(!u)return;
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-store, must-revalidate','Connection':'keep-alive','X-Accel-Buffering':'no-store'});
      res.write(`data: ${JSON.stringify({type:'connected',state:clubState(),at:new Date().toISOString()})}\n\n`);
      const client={res,userId:u.id}; clubRealtimeClients.add(client);
      const keepAlive=setInterval(()=>{try{res.write(': keepalive\n\n')}catch{}},20000);
      req.on('close',()=>{clearInterval(keepAlive);clubRealtimeClients.delete(client);try{res.end()}catch{}});
      return;
    }
    if(req.method==='POST' && url==='/api/dj/live'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const c=ensureClub();
      const on=!!b.live; c.live=on; c.dj=on?{id:u.id,name:u.name}:null; c.title=on?String(b.title||'Red Moon Live').trim().slice(0,80):''; c.startedAt=on?new Date().toISOString():null;
      if(!on){c.current=null;c.queue=[];} audit(db,u,on?'DJ_LIVE_START':'DJ_LIVE_STOP',on?c.title:'Live leállítva'); await writeDB(db); broadcastClub('live_status',{live:on,dj:on?{id:u.id,name:u.name}:null,title:on?db.club.title:''}); broadcastClubState(); return json(res,200,{state:clubState()});
    }
    if(req.method==='POST' && url==='/api/dj/upload'){
      const u=authDJ(req,res); if(!u)return;
      try{
        const file=await readMultipartAudio(req); if(!file.filename||!extAllowed(file.filename))return json(res,400,{error:'Csak MP3, WAV, OGG, M4A, AAC vagy WEBM hangfájl tölthető fel.'});
        if(file.data.length<1000)return json(res,400,{error:'A feltöltött fájl üres vagy hibás.'});
        ensureMusicDir(); const id='track_'+crypto.randomBytes(8).toString('hex'); const safe=`${id}_${sanitizeFilename(file.filename)}`; const abs=path.join(ensureMusicDir(),safe); fs.writeFileSync(abs,file.data);
        const item={id,name:sanitizeFilename(file.filename).replace(/\.[^.]+$/,''),url:`assets/dj-music/${safe}`,size:file.data.length,addedAt:new Date().toISOString(),addedBy:u.name}; const c=ensureClub(); c.library.unshift(item); c.library=c.library.slice(0,200); await writeDB(db); broadcastClubState(); return json(res,201,{track:item,state:clubState()});
      }catch(e){ return json(res,400,{error:e.message||'Feltöltési hiba'}); }
    }
    if(req.method==='DELETE' && url.startsWith('/api/dj/library/')){
      const u=authDJ(req,res); if(!u)return; const id=decodeURIComponent(url.slice('/api/dj/library/'.length)); const c=ensureClub(); const idx=(c.library||[]).findIndex(x=>x.id===id); if(idx<0)return json(res,404,{error:'A zene nem található'}); const [item]=c.library.splice(idx,1); try{fs.unlinkSync(path.join(PUBLIC,item.url.replace(/^assets\//,'assets/')))}catch{} c.queue=(c.queue||[]).filter(x=>x.trackId!==id); if(c.current?.id===id)c.current=null; await writeDB(db); broadcastClubState(); return json(res,200,{ok:true});
    }
    if(req.method==='POST' && url==='/api/dj/queue'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const item=ensureClub().library.find(x=>x.id===String(b.trackId)); if(!item)return json(res,404,{error:'A feltöltött zene nem található'});
      const q={...item,trackId:item.id,id:crypto.randomUUID(),addedBy:u.name,addedAt:new Date().toISOString()}; ensureClub().queue.push(q); ensureClub().queue=ensureClub().queue.slice(-50); await writeDB(db); broadcastClubState(); return json(res,201,{item:q,state:clubState()});
    }
    if(req.method==='POST' && url==='/api/dj/play'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const c=ensureClub(); let item=null;
      if(b.queueId)item=(c.queue||[]).find(x=>x.id===String(b.queueId))||null; else if(b.trackId)item=(c.library||[]).find(x=>x.id===String(b.trackId))||null;
      if(!item)return json(res,404,{error:'A lejátszandó zene nem található'});
      c.current={id:item.id,trackId:item.trackId||item.id,name:item.name,url:item.url,addedBy:item.addedBy||u.name,playbackPosition:0,playbackPlaying:true,playbackAt:Date.now()}; c.live=true; c.dj={id:u.id,name:u.name}; c.startedAt=new Date().toISOString(); c.queue=(c.queue||[]).filter(x=>x.id!==item.id); audit(db,u,'DJ_TRACK_START',item.name); await writeDB(db); broadcastClub('player_sync',{serverNow:Date.now(),sync:{id:c.current.id,trackId:c.current.trackId,url:c.current.url,name:c.current.name,position:0,playing:true,at:c.current.playbackAt}}); broadcastClubState(); return json(res,200,{state:clubState()});
    }
    if(req.method==='POST' && url==='/api/dj/control'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const c=ensureClub(); if(!c.current)return json(res,400,{error:'Nincs lejátszott zene'});
      const action=String(b.action||''); const currentPos=Number.isFinite(Number(b.position))?Math.max(0,Number(b.position)):Number(c.current.playbackPosition)||0;
      if(action==='play'){c.current.playbackPosition=currentPos;c.current.playbackPlaying=true;c.current.playbackAt=Date.now();}
      else if(action==='pause'){c.current.playbackPosition=currentPos;c.current.playbackPlaying=false;c.current.playbackAt=null;}
      else if(action==='seek'){c.current.playbackPosition=currentPos;c.current.playbackAt=c.current.playbackPlaying?Date.now():null;}
      else if(action==='next'){const n=c.queue.shift(); if(!n){c.current=null;} else {c.current={id:n.id,trackId:n.trackId||n.id,name:n.name,url:n.url,addedBy:n.addedBy||u.name,playbackPosition:0,playbackPlaying:true,playbackAt:Date.now()};}}
      else return json(res,400,{error:'Ismeretlen lejátszó művelet'});
      await writeDB(db); broadcastClub('player_sync',{serverNow:Date.now(),sync:{id:c.current?.id||null,trackId:c.current?.trackId||null,url:c.current?.url||null,name:c.current?.name||null,position:c.current?Number(c.current.playbackPosition)||0:0,playing:!!c.current?.playbackPlaying,at:c.current?.playbackAt||Date.now()}}); broadcastClubState(); return json(res,200,{state:clubState()});
    }
    if(req.method==='POST' && url==='/api/dj/player-sync'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const c=ensureClub(); if(!c.current)return json(res,200,{state:clubState()});
      const pos=Math.max(0,Number(b.position)||0); c.current.playbackPosition=pos; c.current.playbackPlaying=!!b.playing; c.current.playbackAt=c.current.playbackPlaying?Date.now():null; await writeDB(db); broadcastClub('player_sync',{serverNow:Date.now(),sync:{id:c.current.id,trackId:c.current.trackId,url:c.current.url,name:c.current.name,position:pos,playing:c.current.playbackPlaying,at:c.current.playbackAt||Date.now()}}); return json(res,200,{state:clubState()});
    }
    if(req.method==='POST' && url==='/api/dj/chat'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const text=String(b.text||'').trim().slice(0,500);
      if(!text)return json(res,400,{error:'Az üzenet nem lehet üres.'});
      const c=ensureClub(); const msg={id:crypto.randomUUID(),at:new Date().toISOString(),name:u.name,text,kind:'dj'};
      c.chat.unshift(msg); purgeExpiredChat(); await writeDB(db); broadcastClub('chat_message',{message:publicChatMessage(msg)}); broadcastClubState(); return json(res,201,{ok:true,state:clubState()});
    }
    if(req.method==='POST' && url==='/api/dj/request'){
      const u=authDJ(req,res); if(!u)return; const b=await readBody(req); const id=String(b.id||''); const reqItem=(db.club?.requests||[]).find(x=>x.id===id); if(!reqItem)return json(res,404,{error:'Kérés nem található'});
      const action=String(b.action||'').toLowerCase(); if(!['accept','decline'].includes(action))return json(res,400,{error:'Érvénytelen művelet'}); reqItem.status=action==='accept'?'accepted':'declined'; reqItem.handledBy=u.name; reqItem.handledAt=new Date().toISOString();
      if(action==='accept' && reqItem.item?.id){ const lib=(db.club.library||[]).find(x=>x.id===reqItem.item.id); if(lib){const item={...lib,trackId:lib.id,id:crypto.randomUUID(),addedBy:reqItem.name,requestId:reqItem.id,addedAt:reqItem.handledAt}; db.club.queue.push(item); db.club.queue=db.club.queue.slice(-50);}}
      db.club.chat.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),name:'Red Moon',text:action==='accept'?`${u.name} elfogadta a kérést: ${reqItem.item.name}`:`${u.name} elutasította a kérést: ${reqItem.item.name}`,kind:action==='accept'?'request-accepted':'request-declined',requestId:reqItem.id}); db.club.chat=db.club.chat.slice(0,120); await writeDB(db); broadcastClubState(); return json(res,200,{state:clubState()});
    }
    if(req.method==='DELETE' && url.startsWith('/api/dj/request/')){
      const u=authDJ(req,res); if(!u)return; const id=decodeURIComponent(url.slice('/api/dj/request/'.length)); const c=ensureClub(); const idx=c.requests.findIndex(x=>x.id===id); if(idx<0)return json(res,404,{error:'Kérés nem található'}); const [removed]=c.requests.splice(idx,1); c.chat=(c.chat||[]).filter(m=>m.requestId!==id); audit(db,u,'DJ_REQUEST_DELETE',`${removed.name}: ${removed.item?.name||''}`); await writeDB(db); broadcastClub('request_deleted',{id}); broadcastClubState(); return json(res,200,{ok:true,state:clubState()});
    }

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
        notes:String(b.notes||''),
        cartCounters:{}
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
      const rawItems=Array.isArray(b.items)?b.items:[{productId:b.productId,qty:b.qty}];
      const items=rawItems.map(x=>({productId:String(x.productId||''),qty:Math.floor(Number(x.qty))})).filter(x=>x.productId);
      if(!items.length)return json(res,400,{error:'A kosár üres.'});
      const paymentMethod=['cash','card','transfer'].includes(b.paymentMethod)?b.paymentMethod:'cash';
      const checked=[];
      for(const item of items){
        if(!Number.isInteger(item.qty)||item.qty<1)return json(res,400,{error:'Érvénytelen mennyiség a kosárban.'});
        const p=db.products.find(x=>x.id===item.productId && x.active);
        if(!p)return json(res,400,{error:'A kosár egyik terméke már nem elérhető.'});
        if(p.category!=='drink')return json(res,400,{error:'Csak ital értékesíthető.'});
        const already=checked.find(x=>x.p.id===p.id);
        if(already)already.qty+=item.qty; else checked.push({p,qty:item.qty});
      }
      for(const item of checked){
        if(item.p.stock<item.qty)return json(res,400,{error:`Nincs elég készlet. ${item.p.name}: jelenleg ${item.p.stock} db van.`});
      }
      const transactionId=crypto.randomUUID();
      const at=new Date().toISOString();
      shift.cartCounters ||= {};
      const cartKey=String(u.id);
      const nextCartNumber=(Number(shift.cartCounters[cartKey])||0)+1;
      shift.cartCounters[cartKey]=nextCartNumber;
      const cartId=makeCartId(shift,u,nextCartNumber);
      const sales=checked.map(item=>{
        const p=item.p, qty=item.qty, total=p.price*qty;
        p.stock-=qty;
        return {
          id:crypto.randomUUID(),transactionId,cartId,at,userId:u.id,user:u.name,
          productId:p.id,product:p.name,category:p.category,qty,unitPrice:p.price,total,
          shiftId:shift.id,paymentMethod,documentId:null
        };
      });
      db.sales.unshift(...sales);
      const total=sales.reduce((sum,s)=>sum+s.total,0);
      audit(db,u,'SALE',`${sales.map(s=>`${s.product} × ${s.qty}`).join(' + ')} · ${total} Ft · ${paymentMethod} · műszak ${shift.id}`);
      await writeDB(db);
      return json(res,201,{sales,product:checked[0]?.p,shift,total,transactionId,cartId});
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
      const transactionId=sale.transactionId||sale.id;
      const transactionSales=db.sales.filter(s=>((s.transactionId||s.id)===transactionId));
      const type='invoice';
      const doc={
        id:'DOC-'+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(),
        type,
        createdAt:new Date().toISOString(),
        createdById:u.id,createdByName:u.name,
        saleId:sale.id,transactionId,shiftId:sale.shiftId,
        customer:{
          name:String(b.customer?.name||'Vásárló'),
          address:String(b.customer?.address||''),
          taxNumber:String(b.customer?.taxNumber||'')
        },
        seller:{name:'Red Moon Pub',owner:'Zhen Yu Xiao'},
        items:transactionSales.map(s=>({product:s.product,qty:s.qty,unitPrice:s.unitPrice,total:s.total})),
        total:transactionSales.reduce((sum,s)=>sum+s.total,0),
        paymentMethod:sale.paymentMethod
      };
      db.documents.unshift(doc);
      transactionSales.forEach(s=>{s.documentId=doc.id});
      audit(db,u,'INVOICE_CREATE',`${doc.id} · ${transactionSales.map(s=>s.product).join(', ')} · ${doc.total} Ft`);
      notifyManagersOwners(db,'Új számla készült',`${u.name} számlát készített: ${doc.id} · ${transactionSales.length} tétel · ${doc.total} Ft`,{documentId:doc.id,saleId:sale.id,createdBy:u.name});
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
      db.sales.filter(x=>(x.transactionId||x.id)===(doc.transactionId||doc.saleId)).forEach(s=>{if(s.documentId===doc.id)s.documentId=null});
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
initDB().then(()=>{
  server.listen(PORT,()=>console.log(`Red Moon Pub V17 online server running on port ${PORT}${pool?' · PostgreSQL':' · local db.json'}`));
}).catch(err=>{
  console.error('Red Moon database initialization failed:',err);
  process.exit(1);
});
