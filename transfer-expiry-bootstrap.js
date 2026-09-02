const fs=require('fs'),path=require('path');
const Database=require('better-sqlite3');

const dataDir=path.join(__dirname,'data');
fs.mkdirSync(dataDir,{recursive:true});
const db=new Database(path.join(dataDir,'app.db'));
db.pragma('foreign_keys=ON');

function expirePendingTransfers(){
  try{
    const rows=db.prepare("SELECT id,consultation_id,sender_id FROM money_transfers WHERE status='pending' AND created_at<=datetime('now','-2 minutes')").all();
    if(!rows.length)return;
    const tx=db.transaction(()=>{
      for(const t of rows){
        const changed=db.prepare("UPDATE money_transfers SET status='cancelled' WHERE id=? AND status='pending'").run(t.id);
        if(changed.changes){
          db.prepare('INSERT INTO chat_messages(consultation_id,sender_id,body) VALUES(?,?,?)').run(t.consultation_id,t.sender_id,'Annulé');
        }
      }
    });
    tx();
  }catch(e){console.error('[transfer-expiry]',e.message)}
}

expirePendingTransfers();
const timer=setInterval(expirePendingTransfers,15000);
if(typeof timer.unref==='function')timer.unref();
