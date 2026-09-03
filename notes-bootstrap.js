const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Database=require('better-sqlite3');
const db=new Database(path.join(__dirname,'data','app.db'));
db.pragma('foreign_keys=ON');

db.exec(`CREATE TABLE IF NOT EXISTS client_notes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id,updated_at DESC);`);

function install(app){
  if(app.__notesInstalled)return; app.__notesInstalled=true;
  const owner=(req,res,next)=>req.session?.userId&&req.session?.role==='owner'?next():res.status(req.session?.userId?403:401).json({error:req.session?.userId?'Accès propriétaire requis.':'Authentification requise.'});
  const csrf=(req,res,next)=>{const a=req.get('x-csrf-token'),b=req.session?.csrfToken;if(!a||!b||a.length!==b.length||!crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b)))return res.status(403).json({error:'Jeton de sécurité invalide.'});next()};
  const validId=x=>Number.isInteger(Number(x))&&Number(x)>0;
  const clean=n=>({id:n.id,clientId:n.client_id,ownerId:n.owner_id,title:n.title,body:n.body,pinned:Boolean(n.pinned),createdAt:n.created_at,updatedAt:n.updated_at});
  const add=(method,url,...handlers)=>app[method](url,...handlers);

  add('get','/api/admin/clients/:clientId/notes',owner,(req,res)=>{
    const clientId=Number(req.params.clientId);if(!validId(clientId))return res.status(400).json({error:'Client invalide.'});
    const client=db.prepare("SELECT id,first_name,last_name,email FROM users WHERE id=? AND role='client'").get(clientId);if(!client)return res.status(404).json({error:'Client introuvable.'});
    const notes=db.prepare('SELECT * FROM client_notes WHERE client_id=? AND owner_id=? ORDER BY pinned DESC,updated_at DESC,id DESC').all(clientId,req.session.userId);
    res.json({client:{id:client.id,firstName:client.first_name,lastName:client.last_name,email:client.email},notes:notes.map(clean)});
  });

  add('post','/api/admin/clients/:clientId/notes',owner,csrf,(req,res)=>{
    const clientId=Number(req.params.clientId);if(!validId(clientId))return res.status(400).json({error:'Client invalide.'});
    const client=db.prepare("SELECT id FROM users WHERE id=? AND role='client'").get(clientId);if(!client)return res.status(404).json({error:'Client introuvable.'});
    const title=String(req.body?.title||'').trim().slice(0,120),body=String(req.body?.body||'').trim().slice(0,5000),pinned=req.body?.pinned?1:0;
    if(!body)return res.status(400).json({error:'La note ne peut pas être vide.'});
    const i=db.prepare('INSERT INTO client_notes(client_id,owner_id,title,body,pinned) VALUES(?,?,?,?,?)').run(clientId,req.session.userId,title,body,pinned);
    res.status(201).json({note:clean(db.prepare('SELECT * FROM client_notes WHERE id=?').get(i.lastInsertRowid))});
  });

  add('patch','/api/admin/client-notes/:noteId',owner,csrf,(req,res)=>{
    const noteId=Number(req.params.noteId);if(!validId(noteId))return res.status(400).json({error:'Note invalide.'});
    const old=db.prepare('SELECT * FROM client_notes WHERE id=? AND owner_id=?').get(noteId,req.session.userId);if(!old)return res.status(404).json({error:'Note introuvable.'});
    const title=String(req.body?.title??old.title).trim().slice(0,120),body=String(req.body?.body??old.body).trim().slice(0,5000),pinned=req.body?.pinned===undefined?old.pinned:(req.body.pinned?1:0);
    if(!body)return res.status(400).json({error:'La note ne peut pas être vide.'});
    db.prepare("UPDATE client_notes SET title=?,body=?,pinned=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").run(title,body,pinned,noteId,req.session.userId);
    res.json({note:clean(db.prepare('SELECT * FROM client_notes WHERE id=?').get(noteId))});
  });

  add('delete','/api/admin/client-notes/:noteId',owner,csrf,(req,res)=>{
    const noteId=Number(req.params.noteId);if(!validId(noteId))return res.status(400).json({error:'Note invalide.'});
    const r=db.prepare('DELETE FROM client_notes WHERE id=? AND owner_id=?').run(noteId,req.session.userId);if(!r.changes)return res.status(404).json({error:'Note introuvable.'});
    res.json({ok:true});
  });
}

try{
  const expressPath=require.resolve('express');const expressModule=require(expressPath);const original=expressModule;
  if(!original.__notesWrapped){
    const wrapped=function(){const app=original();install(app);setImmediate(()=>{try{const stack=app.router?.stack||app._router?.stack;if(!Array.isArray(stack))return;const layers=stack.filter(x=>x.__ladcNotes);if(!layers.length)return;const si=stack.findIndex(x=>x.name==='session');if(si<0)return;layers.forEach(x=>{const i=stack.indexOf(x);if(i>=0)stack.splice(i,1)});const ni=stack.findIndex(x=>x.name==='session');stack.splice(ni+1,0,...layers)}catch(e){console.error('[notes] route reorder:',e.message)}});return app};
    Object.setPrototypeOf(wrapped,Object.getPrototypeOf(original));Object.assign(wrapped,original);
    ['get','post','patch','delete'].forEach(method=>{const orig=wrapped.prototype?.[method]||original.application?.[method];});
    const origInstall=install;
    const wrappedInstall=(app)=>{const before=new Set((app.router?.stack||[]));origInstall(app);const stack=app.router?.stack||app._router?.stack;stack?.forEach(layer=>{if(!before.has(layer))layer.__ladcNotes=true})};
    install=wrappedInstall;
    require.cache[expressPath].exports=wrapped;wrapped.__notesWrapped=true;
  }
}catch(e){console.error('[notes] preload:',e.message)}
