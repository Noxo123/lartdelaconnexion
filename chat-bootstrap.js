const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Database=require('better-sqlite3');
const multer=require('multer');

const dataDir=path.join(__dirname,'data');
const uploadDir=path.join(dataDir,'chat-uploads');
fs.mkdirSync(uploadDir,{recursive:true});
const db=new Database(path.join(dataDir,'app.db'));
db.pragma('foreign_keys=ON');

function ensureColumn(table,column,definition){
  try{db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()}catch(e){
    if(!/duplicate column name/i.test(String(e.message))) throw e;
  }
}
try{
  db.exec(`CREATE TABLE IF NOT EXISTS chat_messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consultation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    attachment_name TEXT,
    attachment_path TEXT,
    attachment_type TEXT,
    attachment_size INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT,
    FOREIGN KEY(consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
  );CREATE INDEX IF NOT EXISTS idx_chat_consultation ON chat_messages(consultation_id,id);CREATE INDEX IF NOT EXISTS idx_chat_unread ON chat_messages(sender_id,read_at);`);
}catch(e){console.error('[chat] migration:',e.message)}

const upload=multer({
  storage:multer.diskStorage({
    destination:(_,__,cb)=>cb(null,uploadDir),
    filename:(_,file,cb)=>{
      const ext=path.extname(file.originalname||'').toLowerCase();
      cb(null,crypto.randomUUID()+ext);
    }
  }),
  limits:{fileSize:8*1024*1024,files:1},
  fileFilter:(_,file,cb)=>{
    const allowed=new Set(['image/jpeg','image/png','image/webp','image/gif']);
    cb(null,allowed.has(String(file.mimetype||'').toLowerCase()));
  }
});

function attachChat(express){
  const original=express;
  const wrapped=function(){
    const app=original();
    setImmediate(()=>install(app));
    return app;
  };
  Object.assign(wrapped,original);
  return wrapped;
}

function install(app){
  if(app.__chatInstalled)return; app.__chatInstalled=true;
  const auth=(req,res,next)=>req.session?.userId?next():res.status(401).json({error:'Authentification requise.'});
  const csrf=(req,res,next)=>{
    const a=req.get('x-csrf-token'),b=req.session?.csrfToken;
    if(!a||!b||a.length!==b.length||!crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b)))return res.status(403).json({error:'Jeton de sécurité invalide.'});
    next();
  };
  function consultation(req,id){
    const c=db.prepare('SELECT c.*,u.first_name,u.last_name,u.email,s.name service_name FROM consultations c JOIN users u ON u.id=c.user_id JOIN services s ON s.id=c.service_id WHERE c.id=?').get(id);
    if(!c)return null;
    if(req.session.role!=='owner'&&c.user_id!==req.session.userId)return null;
    return c;
  }
  function cleanMessage(row){return {id:row.id,consultationId:row.consultation_id,senderId:row.sender_id,body:row.body,attachment:row.attachment_path?{name:row.attachment_name,type:row.attachment_type,size:row.attachment_size,url:`/api/chat/files/${row.id}`}:null,createdAt:row.created_at,readAt:row.read_at};}

  app.get('/api/chat/unread',auth,(req,res)=>{
    const n=db.prepare(`SELECT COUNT(*) n FROM chat_messages m JOIN consultations c ON c.id=m.consultation_id WHERE m.sender_id<>? AND m.read_at IS NULL AND (c.user_id=? OR ?='owner')`).get(req.session.userId,req.session.userId,req.session.role).n;
    res.json({count:n});
  });

  app.get('/api/chat/:consultationId/messages',auth,(req,res)=>{
    const id=Number(req.params.consultationId),c=consultation(req,id);
    if(!c)return res.status(404).json({error:'Conversation introuvable.'});
    const after=Math.max(0,Number(req.query.after)||0);
    const rows=db.prepare('SELECT * FROM chat_messages WHERE consultation_id=? AND id>? ORDER BY id ASC LIMIT 200').all(id,after);
    db.prepare('UPDATE chat_messages SET read_at=CURRENT_TIMESTAMP WHERE consultation_id=? AND sender_id<>? AND read_at IS NULL').run(id,req.session.userId);
    res.json({messages:rows.map(cleanMessage),consultation:{id:c.id,subject:c.subject,clientId:c.user_id,clientName:`${c.first_name} ${c.last_name}`,service:c.service_name}});
  });

  app.post('/api/chat/:consultationId/messages',auth,csrf,(req,res)=>{
    const id=Number(req.params.consultationId),c=consultation(req,id);
    if(!c)return res.status(404).json({error:'Conversation introuvable.'});
    const body=String(req.body?.body||'').trim();
    if(!body||body.length>3000)return res.status(400).json({error:'Le message doit contenir entre 1 et 3000 caractères.'});
    const i=db.prepare('INSERT INTO chat_messages(consultation_id,sender_id,body) VALUES(?,?,?)').run(id,req.session.userId,body);
    res.status(201).json({message:cleanMessage(db.prepare('SELECT * FROM chat_messages WHERE id=?').get(i.lastInsertRowid))});
  });

  app.post('/api/chat/:consultationId/upload',auth,csrf,upload.single('image'),(req,res)=>{
    const id=Number(req.params.consultationId),c=consultation(req,id);
    if(!c){if(req.file)fs.rmSync(req.file.path,{force:true});return res.status(404).json({error:'Conversation introuvable.'});}
    if(!req.file)return res.status(400).json({error:'Image invalide. Formats acceptés : JPG, PNG, WEBP ou GIF, 8 Mo maximum.'});
    const original=String(req.file.originalname||'image').replace(/[\\/\0]/g,'_').slice(0,180);
    const i=db.prepare('INSERT INTO chat_messages(consultation_id,sender_id,body,attachment_name,attachment_path,attachment_type,attachment_size) VALUES(?,?,?,?,?,?,?)').run(id,req.session.userId,'',original,req.file.filename,req.file.mimetype,req.file.size);
    res.status(201).json({message:cleanMessage(db.prepare('SELECT * FROM chat_messages WHERE id=?').get(i.lastInsertRowid))});
  });

  app.get('/api/chat/files/:messageId',auth,(req,res)=>{
    const m=db.prepare('SELECT m.*,c.user_id FROM chat_messages m JOIN consultations c ON c.id=m.consultation_id WHERE m.id=?').get(Number(req.params.messageId));
    if(!m||!m.attachment_path||(req.session.role!=='owner'&&m.user_id!==req.session.userId))return res.status(404).end();
    const file=path.join(uploadDir,path.basename(m.attachment_path));
    if(!fs.existsSync(file))return res.status(404).end();
    res.setHeader('Content-Type',m.attachment_type||'application/octet-stream');res.setHeader('Content-Disposition',`inline; filename="${String(m.attachment_name||'image').replace(/["\\\r\n]/g,'_')}"`);res.setHeader('X-Content-Type-Options','nosniff');res.sendFile(file);
  });
}

module.exports={attachChat};

// Preload shim: capture Express factory, then install chat routes once server.js has built its app.
try{
  const expressPath=require.resolve('express');
  const expressModule=require(expressPath);
  if(!expressModule.__chatWrapped){
    const wrapped=attachChat(expressModule);
    Object.keys(require.cache[expressPath]?.exports||{}).forEach(()=>{});
    require.cache[expressPath].exports=wrapped;
    wrapped.__chatWrapped=true;
  }
}catch(e){console.error('[chat] preload:',e.message)}
