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
