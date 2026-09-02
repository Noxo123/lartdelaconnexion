const path=require('path');
const Database=require('better-sqlite3');
const express=require('express');

// This preload replaces the legacy availability handler without touching
// existing consultation/user data or the rest of server.js.
const dataDir=path.join(__dirname,'data');
const db=new Database(path.join(dataDir,'app.db'));
db.pragma('journal_mode=WAL');

function minutes(value){
  const [h,m]=String(value||'').split(':').map(Number);
  return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:0;
}

function localDayKey(date){
  // Date is interpreted in the Node process timezone, matching the server UI.
  return date.getDay();
}

function slotIso(date, totalMinutes){
  const d=new Date(date);
  d.setHours(Math.floor(totalMinutes/60),totalMinutes%60,0,0);
  return d;
}

const originalGet=express.application.get;
express.application.get=function(route,...handlers){
  if(route==='/api/availability'){
    return originalGet.call(this,route,async(req,res)=>{
      if(!req.session?.userId)return res.status(401).json({error:'Authentification requise.'});

      const serviceId=Number(req.query.serviceId)||1;
      const service=db.prepare('SELECT * FROM services WHERE id=? AND active=1').get(serviceId);
      if(!service)return res.status(404).json({error:'Service introuvable.'});

      const requestedDays=Number(req.query.days||14);
      const days=Math.min(31,Math.max(1,Number.isFinite(requestedDays)?requestedDays:14));
      const from=req.query.from?new Date(String(req.query.from)):new Date();
      if(Number.isNaN(from.getTime()))return res.status(400).json({error:'Date de départ invalide.'});

      const rules=db.prepare('SELECT id,weekday,start_time,end_time FROM availability WHERE active=1 ORDER BY weekday,start_time').all();
      const blockedRows=db.prepare('SELECT start_at,end_at FROM blocked_slots WHERE end_at>? AND start_at<?').all(
        new Date(from.getTime()-86400000).toISOString(),
        new Date(from.getTime()+days*86400000+86400000).toISOString()
      );
      const busyRows=db.prepare("SELECT requested_at,duration FROM consultations WHERE status IN ('pending','confirmed') AND requested_at<? AND datetime(requested_at,'+'||duration||' minutes')>?").all(
        new Date(from.getTime()+days*86400000+86400000).toISOString(),
        new Date(from.getTime()-86400000).toISOString()
      );

      const out=[];
      const now=Date.now()+30*60000;
      const hasRules=rules.length>0;

      for(let i=0;i<days;i++){
        const day=new Date(from);
        day.setHours(0,0,0,0);
        day.setDate(day.getDate()+i);
        const dayRules=hasRules?rules.filter(r=>Number(r.weekday)===localDayKey(day)):[];

        for(const rule of dayRules){
          const start=minutes(rule.start_time);
          const end=minutes(rule.end_time);
          if(end<=start||end-start<service.duration)continue;

          for(let m=start;m+service.duration<=end;m+=30){
            const slot=slotIso(day,m);
            const slotEnd=new Date(slot.getTime()+service.duration*60000);
            if(slot.getTime()<now)continue;

            const overlapsConsultation=busyRows.some(c=>{
              const cs=new Date(c.requested_at);
              const ce=new Date(cs.getTime()+Number(c.duration)*60000);
              return cs<slotEnd&&ce>slot;
            });
            if(overlapsConsultation)continue;

            const overlapsBlocked=blockedRows.some(b=>{
              const bs=new Date(b.start_at),be=new Date(b.end_at);
              return bs<slotEnd&&be>slot;
            });
            if(overlapsBlocked)continue;

            out.push({start:slot.toISOString(),end:slotEnd.toISOString()});
          }
        }
      }

      res.json({slots:out,service});
    });
  }
  return originalGet.call(this,route,...handlers);
};
