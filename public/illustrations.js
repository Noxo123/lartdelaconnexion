(() => {
  const HERO='/assets/illustration-connexion.svg';
  const SECURITY='/assets/illustration-securite.svg';
  const RESERVATION='/assets/illustration-reservation.svg';
  const apply=()=>{
    const hero=document.querySelector('.hero-frame img');
    if(hero){hero.src=HERO;hero.alt='Illustration de connexion à distance';hero.removeAttribute('srcset');}
    const security=document.querySelector('#securite');
    if(security && !security.querySelector('.section-illustration')){
      const figure=document.createElement('div'); figure.className='section-illustration';
      figure.innerHTML=`<img src="${SECURITY}" alt="Illustration de sécurité et de confidentialité" loading="lazy">`;
      security.appendChild(figure);
    }
    const consultation=document.querySelector('#consultation');
    if(consultation && !consultation.querySelector('.section-illustration')){
      const figure=document.createElement('div'); figure.className='section-illustration reservation-illustration';
      figure.innerHTML=`<img src="${RESERVATION}" alt="Illustration de réservation" loading="lazy">`;
      consultation.appendChild(figure);
    }
  };
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
})();
