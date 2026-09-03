const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Database=require('better-sqlite3');
const express=require('express');
const dataDir=path.join(__dirname,'data');fs.mkdirSync(dataDir,{recursive:true});
const db=new Database(path.join(dataDir,'app.db'));db.pragma('foreign_keys=ON');
const validTime=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
function owner(req,res,next){return req.session?.role==='owner'?next():res.status(403).json({error:'Accès propriétaire requis.'})}
function csrf(req,res,next){const a=req.get('x-csrf-token'),b=req.session?.csrfToken;if(!a||!b||a.length!==b.length||!crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b)))return res.status(403).json({error:'Jeton de sécurité invalide.'});next()}
function attach(app){
  if(app.__ladcCalendarInstalled)return;app.__ladcCalendarInstalled=true;
  app.get('/api/admin/calendar',owner,(req,res)=>{
    const availability=db.prepare('SELECT id,weekday,start_time startTime,end_time endTime,active FROM availability ORDER BY weekday,start_time,id').all();
    const blocked=db.prepare("SELECT id,start_at startAt,end_at endAt,reason FROM blocked_slots WHERE end_at>=datetime('now') ORDER BY start_at").all();
    res.json({availability,blocked});
  });
  app.post('/api/admin/calendar/rules',owner,csrf,(req,res)=>{
    const weekday=Number(req.body?.weekday),startTime=String(req.body?.startTime||''),endTime=String(req.body?.endTime||'');
    if(!Number.isInteger(weekday)||weekday<0||weekday>6||!validTime.test(startTime)||!validTime.test(endTime)||startTime>=endTime)return res.status(400).json({error:'Créneau invalide.'});
    const overlap=db.prepare('SELECT id FROM availability WHERE weekday=? AND active=1 AND start_time<? AND end_time>?').get(weekday,endTime,startTime);
    if(overlap)return res.status(409).json({error:'Ce créneau chevauche déjà une disponibilité.'});
    const i=db.prepare('INSERT INTO availability(weekday,start_time,end_time,active) VALUES(?,?,?,1)').run(weekday,startTime,endTime);
    res.status(201).json({rule:db.prepare('SELECT id,weekday,start_time startTime,end_time endTime,active FROM availability WHERE id=?').get(i.lastInsertRowid)});
  });
  app.patch('/api/admin/calendar/rules/:id',owner,csrf,(req,res)=>{
    const id=Number(req.params.id),old=db.prepare('SELECT * FROM availability WHERE id=?').get(id);if(!old)return res.status(404).json({error:'Disponibilité introuvable.'});
    const weekday=req.body?.weekday===undefined?old.weekday:Number(req.body.weekday),startTime=String(req.body?.startTime??old.start_time),endTime=String(req.body?.endTime??old.end_time),active=req.body?.active===undefined?old.active:(req.body.active?1:0);
    if(!Number.isInteger(weekday)||weekday<0||weekday>6||!validTime.test(startTime)||!validTime.test(endTime)||startTime>=endTime)return res.status(400).json({error:'Créneau invalide.'});
    const overlap=db.prepare('SELECT id FROM availability WHERE id<>? AND weekday=? AND active=1 AND start_time<? AND end_time>?').get(id,weekday,endTime,startTime);if(overlap&&active)return res.status(409).json({error:'Ce créneau chevauche déjà une disponibilité.'});
    db.prepare('UPDATE availability SET weekday=?,start_time=?,end_time=?,active=? WHERE id=?').run(weekday,startTime,endTime,active,id);res.json({ok:true});
  });
  app.delete('/api/admin/calendar/rules/:id',owner,csrf,(req,res)=>{const i=db.prepare('DELETE FROM availability WHERE id=?').run(Number(req.params.id));if(!i.changes)return res.status(404).json({error:'Disponibilité introuvable.'});res.json({ok:true})});
  app.post('/api/admin/calendar/block',owner,csrf,(req,res)=>{
    const start=new Date(String(req.body?.startAt||'')),end=new Date(String(req.body?.endAt||'')),reason=String(req.body?.reason||'').trim().slice(0,160);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return res.status(400).json({error:'Période bloquée invalide.'});
    if(end.getTime()-start.getTime()>31*86400000)return res.status(400).json({error:'La période bloquée ne peut pas dépasser 31 jours.'});
    const i=db.prepare('INSERT INTO blocked_slots(start_at,end_at,reason) VALUES(?,?,?)').run(start.toISOString(),end.toISOString(),reason);res.status(201).json({id:Number(i.lastInsertRowid)});
  });
  app.delete('/api/admin/calendar/block/:id',owner,csrf,(req,res)=>{const i=db.prepare('DELETE FROM blocked_slots WHERE id=?').run(Number(req.params.id));if(!i.changes)return res.status(404).json({error:'Blocage introuvable.'});res.json({ok:true})});
}
function wrap(){try{const expressPath=require.resolve('express'),original=require(expressPath);if(original.__ladcCalendarWrapped)return;const wrapped=function(...args){const app=original(...args);attach(app);return app};Object.assign(wrapped,original);wrapped.__ladcCalendarWrapped=true;require.cache[expressPath].exports=wrapped}catch(e){console.error('[calendar] preload:',e.message)}}
wrap();
