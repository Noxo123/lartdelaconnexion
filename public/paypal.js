(() => {
  let sdkPromise=null, config=null;
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const getConfig=async()=>config||(config=await fetch('/api/paypal/config',{credentials:'same-origin'}).then(r=>r.json()));
  async function loadSdk(){
    if(sdkPromise)return sdkPromise;
    sdkPromise=(async()=>{
      const c=await getConfig(); if(!c.enabled)return null;
      if(window.paypal)return window.paypal;
      const src=c.environment==='production'?'https://www.paypal.com/web-sdk/v6/core':'https://www.sandbox.paypal.com/web-sdk/v6/core';
      await new Promise((resolve,reject)=>{const s=document.createElement('script');s.async=true;s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('PayPal SDK indisponible.'));document.head.appendChild(s)});
      return window.paypal;
    })();
    return sdkPromise;
  }
  async function mount(button){
    if(button.tagName==='BUTTON'&&!button.hasAttribute('data-paypal-widget'))return;
    if(button.dataset.paypalMounted)return;
    button.dataset.paypalMounted='loading';
    try{
      const c=await getConfig();if(!c.enabled){button.dataset.paypalMounted='disabled';return}
      const sdk=await loadSdk();
      if(!sdk)throw new Error('PayPal est désactivé.');
      const methods=await sdk.createInstance({clientId:c.clientId,components:['paypal-payments'],pageType:'checkout').then(x=>x.findEligibleMethods({currencyCode:c.currency}).then(m=>({sdk:x,methods:m})));
      if(!methods.methods.isEligible('paypal')){button.dataset.paypalMounted='ineligible';return}
      const consultationId=button.dataset.pay;
      const host=document.createElement('div');host.className='paypal-button-wrap';
      const paypalButton=document.createElement('paypal-button');paypalButton.type='pay';paypalButton.setAttribute('aria-label','Payer avec PayPal');host.appendChild(paypalButton);
      button.insertAdjacentElement('afterend',host);button.dataset.paypalMounted='ready';
      const session=methods.sdk.createPayPalOneTimePaymentSession({
        onApprove:async({orderId})=>{const token=await fetch('/api/csrf',{credentials:'same-origin'}).then(r=>r.json());const r=await fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':token.csrfToken}});const d=await r.json();if(!r.ok)throw Error(d.error||'Paiement refusé.');window.dispatchEvent(new CustomEvent('paypal:paid',{detail:d}));return d},
        onCancel:()=>window.dispatchEvent(new CustomEvent('paypal:cancelled')),
        onError:e=>{console.error(e);window.dispatchEvent(new CustomEvent('paypal:error',{detail:e}))}
      });
      paypalButton.addEventListener('click',async()=>{try{const token=await fetch('/api/csrf',{credentials:'same-origin'}).then(r=>r.json());const orderPromise=fetch('/api/paypal/orders',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':token.csrfToken},body:JSON.stringify({consultationId})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Impossible de créer la commande PayPal.');return {orderId:d.orderId}});await session.start({presentationMode:'auto'},orderPromise)}catch(e){console.error(e);window.dispatchEvent(new CustomEvent('paypal:error',{detail:e}))}});
    }catch(e){console.error('PayPal init',e);button.dataset.paypalMounted='error'}
  }
  const scan=()=>document.querySelectorAll('[data-pay]:not([data-paypal-mounted])').forEach(mount);
  const obs=new MutationObserver(scan);obs.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('paypal:paid',()=>{if(window.toast)window.toast('Paiement PayPal confirmé.');setTimeout(()=>location.reload(),700)});
  window.addEventListener('paypal:error',e=>{if(window.toast)window.toast(e.detail?.message||'Le paiement PayPal a échoué.')});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
})();
