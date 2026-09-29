/* TINA DIGITAL — уведомление о cookie + Яндекс Метрика только после согласия.
   Счётчик 113153676; грузится только после «Принять». */
(function(){
  "use strict";
  var METRIKA_ID = '113153676';
  var KEY = 'tina-cookie-consent-v1'; /* 'all' | 'necessary' */

  var me = document.currentScript;
  var base = me ? me.src.replace(/assets\/legal\/legal\.js.*$/, '') : '/';

  function read(){ try { return localStorage.getItem(KEY); } catch(e){ return null; } }
  function save(v){ try { localStorage.setItem(KEY, v); } catch(e){} }

  var metrikaLoaded = false;
  function loadMetrika(){
    if (metrikaLoaded || !/^\d+$/.test(METRIKA_ID)) return;
    metrikaLoaded = true;
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0];k.async=1;k.src=r;a.parentNode.insertBefore(k,a)})
      (window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + METRIKA_ID, 'ym');
    window.ym(Number(METRIKA_ID), 'init', { ssr:true, webvisor:true, clickmap:true, referrer:document.referrer, url:location.href, accurateTrackBounce:true, trackLinks:true });
  }


  /* цели Метрики: отправляются, только если посетитель дал согласие и Метрика загружена */
  function goal(name){ try { if (metrikaLoaded && window.ym) window.ym(Number(METRIKA_ID), 'reachGoal', name); } catch(e){} }
  window.tinaGoal = goal;
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (/t\.me\//.test(h)) goal('telegram');
    else if (/^mailto:/.test(h)) goal('email');
    else if (/(^|\/)cases\/[a-z]+\/?(#.*)?$/.test(h) || /direct\/#case$/.test(h)) goal('case_open');
    else if (/(^|\/)(turnkey|seo-geo|direct)\/?$/.test(h)) goal('service_open');
    else if (/(^|\/)projects\/?(#.*)?$/.test(h)) goal('cases_list');
  }, true);
  /* вовлечённый визит: минута на сайте или 3-я страница за визит (считается только при согласии) */
  (function(){
    var n = 1, t0 = Date.now(), timer;
    try { if (sessionStorage.getItem('tina-engaged') === '1') return; n = +(sessionStorage.getItem('tina-pages') || 0) + 1; sessionStorage.setItem('tina-pages', n); } catch(e){}
    timer = setInterval(function(){
      if (!metrikaLoaded) return;
      if (n >= 3 || Date.now() - t0 >= 60000){ clearInterval(timer); goal('engaged'); try { sessionStorage.setItem('tina-engaged', '1'); } catch(e){} }
    }, 2000);
  })();
  document.addEventListener('submit', function(e){ if (e.target && e.target.id === 'checkForm') goal('check_site'); }, true);

  var bar = null;
  function hide(){
    if (!bar) return;
    bar.classList.remove('is-in');
    var b = bar; bar = null;
    setTimeout(function(){ b.remove(); }, 400);
  }
  function show(){
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'tl-cookie';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Уведомление о cookie');
    bar.innerHTML =
      '<p class="tl-cookie-text">Сайт использует cookie и&nbsp;Яндекс&nbsp;Метрику, чтобы видеть статистику посещений. ' +
      'Подробнее в&nbsp;<a href="' + base + 'cookies/">политике cookie</a> и&nbsp;<a href="' + base + 'privacy/">политике конфиденциальности</a>.</p>' +
      '<div class="tl-cookie-actions">' +
        '<button type="button" class="tl-btn tl-btn-primary" data-v="all">Принять</button>' +
        '<button type="button" class="tl-btn" data-v="necessary">Только необходимые</button>' +
      '</div>';
    bar.addEventListener('click', function(e){
      var v = e.target.getAttribute && e.target.getAttribute('data-v');
      if (!v) return;
      save(v);
      if (v === 'all') loadMetrika();
      hide();
    });
    document.body.appendChild(bar);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ bar && bar.classList.add('is-in'); }); });
  }

  /* ссылки «Настройки cookie» в подвалах: <a href="#" data-cookie-settings> */
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (!a) return;
    e.preventDefault();
    show();
  });

  function start(){
    var v = read();
    if (v === 'all') loadMetrika();
    else if (v !== 'necessary') setTimeout(show, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
