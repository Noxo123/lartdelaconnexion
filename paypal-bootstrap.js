const fs=require('fs'),path=require('path'),crypto=require('crypto');
const session=require('express-session');
const SQLiteStore=require('connect-sqlite3')(session);
const Database=require('better-sqlite3');
const {Client,Environment,OrdersController,CheckoutPaymentIntent}=require('@paypal/paypal-server-sdk');

const originalExpress=require('express');
let capturedApp=null;
const wrappedExpress=function(...args){const app=originalExpress(...args);capturedApp=app;setImmediate(()=>attach(app));return app};
Object.assign(wrappedExpress,originalExpress);
require.cache[require.resolve('express')].exports=wrappedExpress;

function attach(app){
  const enabled=Boolean(process.env.PAYPAL_CLIENT_ID&&process.env.PAYPAL_CLIENT_SECRET);
  const dataDir=path.join(__dirname,'data');
  fs.mkdirSync(dataDir,{recursive:true});
  const db=new Database(path.join(dataDir,'app.db'));
  try{db.exec("ALTER TABLE consultations ADD COLUMN paypal_order_id TEXT; ALTER TABLE consultations ADD COLUMN paypal_capture_id TEXT;")}catch{}
  if(!enabled){
    app.get('/api/paypal/config',(req,res)=>res.json({enabled:false}));
    return;
  }
  const environment=String(process.env.PAYPAL_ENVIRONMENT||'sandbox').toLowerCase()==='production'?Environment.Production:Environment.Sandbox;
  const client=new Client({clientCredentialsAuthCredentials:{oAuthClientId:process.env.PAYPAL_CLIENT_ID,oAuthClientSecret:process.env.PAYPAL_CLIENT_SECRET},environment});
  const orders=new OrdersController(client);
  const paypalSession=session({name:process.env.NODE_ENV==='production'?'__Host-ladc.sid':'ladc.sid',store:new SQLiteStore({db:'sessions.db',dir:dataDir}),secret:process.env.SESSION_SECRET||'dev-only-change-this-secret-before-production',resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:8*60*60*1000,path:'/'}});
  const auth=(req,res,next)=>req.session.userId?next():res.status(401).json({error:'Authentification requise.'});
  const csrf=(req,res,next)=>{const a=req.get('x-csrf-token'),b=req.session.csrfToken;if(!a||!b||a.length!==b.length||!crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b)))return res.status(403).json({error:'Jeton de sécurité invalide.'});next()};
  app.use('/api/paypal',paypalSession);
  app.use('/api/paypal',(req,res,next)=>{if(['POST','PATCH','PUT','DELETE'].includes(req.method))return csrf(req,res,next);next()});
  app.get('/api/paypal/config',(req,res)=>res.json({enabled:true,environment:environment===Environment.Production?'production':'sandbox',currency:String(process.env.PAYPAL_CURRENCY||'EUR')}));
  app.post('/api/paypal/orders',auth,(req,res)=>{
    try{
      const id=Number(req.body?.consultationId);
      const c=db.prepare('SELECT c.*,s.name service_name,s.price_cents FROM consultations c JOIN services s ON s.id=c.service_id WHERE c.id=? AND c.user_id=?').get(id,req.session.userId);
      if(!c)return res.status(404).json({error:'Consultation introuvable.'});
      if(c.status==='cancelled'||c.status==='completed')return res.status(400).json({error:'Cette consultation ne peut plus être payée.'});
      if(c.payment_status==='paid')return res.status(409).json({error:'Cette consultation est déjà payée.'});
      const amount=(Number(c.price_cents||0)/100).toFixed(2);
      if(Number(amount)<=0)return res.status(400).json({error:'Le tarif de cette consultation est invalide.'});
      const collect={body:{intent:CheckoutPaymentIntent.Capture,purchaseUnits:[{referenceId:String(c.id),description:String(c.service_name||'Consultation').slice(0,127),customId:String(c.id),amount:{currencyCode:String(process.env.PAYPAL_CURRENCY||'EUR').toUpperCase(),value:amount}}]},prefer:'return=minimal'};
      orders.createOrder(collect).then(r=>{const order=r.result;if(!order?.id)throw new Error('PayPal order ID manquant.');db.prepare('UPDATE consultations SET paypal_order_id=? WHERE id=?').run(order.id,c.id);res.json({orderId:order.id});}).catch(e=>{console.error('PayPal create order',e);res.status(502).json({error:'Impossible de créer le paiement PayPal.'})});
    }catch(e){res.status(400).json({error:'Demande PayPal invalide.'})}
  });
  app.post('/api/paypal/orders/:orderId/capture',auth,(req,res)=>{
    const orderId=String(req.params.orderId||'');
    const c=db.prepare('SELECT c.*,s.price_cents FROM consultations c JOIN services s ON s.id=c.service_id WHERE c.paypal_order_id=? AND c.user_id=?').get(orderId,req.session.userId);
    if(!c)return res.status(404).json({error:'Commande PayPal introuvable.'});
    orders.captureOrder({id:orderId}).then(r=>{
      const result=r.result||{};
      const capture=result.purchaseUnits?.[0]?.payments?.captures?.[0];
      if(result.status!=='COMPLETED'||!capture?.id)throw new Error('Paiement PayPal non confirmé.');
      db.prepare('UPDATE consultations SET payment_status="paid",paypal_capture_id=? WHERE id=?').run(capture.id,c.id);
      res.json({ok:true,orderId,captureId:capture.id,status:result.status});
    }).catch(e=>{console.error('PayPal capture',e);res.status(502).json({error:'Le paiement PayPal n’a pas pu être confirmé.'})});
  });
  app.get('/api/paypal/client-token',auth,async(req,res)=>{
    try{
      const base=environment===Environment.Production?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
      const basic=Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
      const r=await fetch(`${base}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${basic}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&response_type=client_token'});
      const d=await r.json();if(!r.ok||!d.access_token)throw new Error('client token unavailable');res.json({clientToken:d.access_token});
    }catch(e){res.status(502).json({error:'Impossible d’initialiser PayPal.'})}
  });
}
