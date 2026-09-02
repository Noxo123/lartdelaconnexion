(()=>{
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('motion-enabled');
  document.body.classList.add('motion-ready');

  const reveal=()=>{
    if(reduce)return;
    document.querySelectorAll('#app .section,#app .card,#app .step,#app .panel,#app .stat,#app .consultation,#app .auth-copy,#app .auth-card,#app .video-sidebar > *,.footer > *').forEach(el=>{
      if(el.dataset.motionSeen)return;
      el.dataset.motionSeen='1';el.classList.add('motion-reveal');
      if('IntersectionObserver' in window)observer.observe(el);else el.classList.add('is-visible');
    });
  };
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}
  }),{threshold:.08,rootMargin:'0px 0px -35px'}):null;

  let raf=0;
  const scan=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(reveal)};
  scan();
  new MutationObserver(scan).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

  window.addEventListener('scroll',()=>{
    document.querySelector('.site-header')?.classList.toggle('motion-scrolled',window.scrollY>8);
  },{passive:true});

  document.addEventListener('click',e=>{
    if(reduce)return;
    const button=e.target.closest('.button');
    if(button&&button.tagName==='BUTTON'&&!button.disabled){
      const rect=button.getBoundingClientRect(),r=document.createElement('span');
      r.className='button-ripple';
      r.style.left=`${e.clientX-rect.left-9}px`;r.style.top=`${e.clientY-rect.top-9}px`;
      button.querySelector('.button-ripple')?.remove();button.appendChild(r);
      setTimeout(()=>r.remove(),600);
    }
    const link=e.target.closest('a[data-link]');
    if(link&&link.origin===location.origin){
      document.body.classList.add('is-transitioning');
      setTimeout(()=>document.body.classList.remove('is-transitioning'),220);
    }
  },true);

  document.addEventListener('animationend',e=>{
    if(e.animationName==='ladc-pop'&&e.target.classList.contains('modal'))e.target.style.willChange='auto';
  });
})();
