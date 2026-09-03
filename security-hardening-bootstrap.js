const express=require('express');
const rateLimit=require('express-rate-limit');

// Hardening loaded before server.js so every response gets a defensive baseline.
const securityMiddleware=(req,res,next)=>{
  const isApi=req.path.startsWith('/api');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=(), payment=(self)');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  if(isApi){
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Pragma','no-cache');
  }
  if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  if(String(req.url||'').length>8192)return res.status(414).json({error:'URL trop longue.'});
  if(String(req.url||'').includes('\u0000'))return res.status(400).json({error:'Requête invalide.'});
  next();
};

// Express is instantiated by server.js after this preload. Inject the baseline
// middleware exactly once before the application's first middleware.
const originalUse=express.application.use;
express.application.use=function(...args){
  if(!this.__ladcSecurityInjected){
    this.__ladcSecurityInjected=true;
    originalUse.call(this,securityMiddleware);
  }
  return originalUse.apply(this,args);
};

// Add focused limits to sensitive operations without weakening the existing
// global API limiter.
const passwordLimiter=rateLimit({windowMs:15*60*1000,limit:6,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Trop de tentatives. Réessayez plus tard.'}});
const paymentLimiter=rateLimit({windowMs:60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Trop de requêtes de paiement. Réessayez dans quelques secondes.'}});
const originalPatch=express.application.patch;
express.application.patch=function(path,...handlers){
  if(path==='/api/profile/password')handlers.unshift(passwordLimiter);
  return originalPatch.call(this,path,...handlers);
};
const originalPost=express.application.post;
express.application.post=function(path,...handlers){
  if(typeof path==='string'&&(/^\/api\/paypal\/orders(?:\/|$)/.test(path)||path==='/api/payments/create-checkout'))handlers.unshift(paymentLimiter);
  return originalPost.call(this,path,...handlers);
};
