  (function(){
    var btn = document.getElementById('menuBtn');
    var nav = document.getElementById('mobileNav');
    btn.addEventListener('click', function(){
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ nav.classList.remove('open'); btn.setAttribute('aria-expanded','false'); });
    });

    // Link ativo no cabeçalho conforme a seção visível
    var navLinks = document.querySelectorAll('nav.primary a');
    var spy = [].map.call(navLinks, function(a){ return document.querySelector(a.getAttribute('href')); });
    function updateActive(){
      var y = window.scrollY + window.innerHeight * 0.35, cur = -1;
      spy.forEach(function(s, i){ if(s && s.offsetTop <= y) cur = i; });
      navLinks.forEach(function(a, i){ a.classList.toggle('is-active', i === cur); });
    }
    window.addEventListener('scroll', updateActive, { passive:true });
    updateActive();

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scroll suave (Lenis). Desligado com prefers-reduced-motion.
    if(!reduced && window.Lenis){
      var lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: true,
        anchors: { offset: -76 }
      });
      function raf(time){ lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
    }

    // Vídeo do Sam: toca ao clicar na capa, pausa ao sair da tela
    var vBox = document.getElementById('aboutVideo');
    if(vBox){
      var vid = vBox.querySelector('video'), vBtn = vBox.querySelector('.about-video-play');
      vBtn.addEventListener('click', function(){
        vid.controls = true;
        vBox.classList.add('is-playing');
        vid.play().catch(function(){});
      });
      vid.addEventListener('ended', function(){
        vid.controls = false; vid.currentTime = 0;
        vBox.classList.remove('is-playing');
      });
      if('IntersectionObserver' in window){
        new IntersectionObserver(function(entries){
          if(!entries[0].isIntersecting && !vid.paused){ vid.pause(); }
        }, { threshold: 0.2 }).observe(vBox);
      }
    }

    // Cards do Back office: o brilho da borda segue o mouse
    document.querySelectorAll('.bo-item').forEach(function(card){
      card.addEventListener('mousemove', function(e){
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        card.classList.add('is-hover');
      });
      card.addEventListener('mouseleave', function(){ card.classList.remove('is-hover'); });
    });

    // Contagem dos números ao entrar na tela
    var counters = document.querySelectorAll('[data-count]');
    function runCount(el){
      var to = parseFloat(el.getAttribute('data-count')), dur = 1800, t0 = null;
      function step(t){
        if(t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e);
        if(p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if(!reduced && 'IntersectionObserver' in window){
      counters.forEach(function(el){
        el.textContent = '0';
      });
      var cio = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            cio.unobserve(entry.target);
            entry.target.querySelectorAll('[data-count]').forEach(runCount);
          }
        });
      }, { threshold: 0.6 });
      document.querySelectorAll('.fit-figure').forEach(function(el){ cio.observe(el); });
    }

    var items = document.querySelectorAll('.reveal');
    if(!('IntersectionObserver' in window)){
      items.forEach(function(el){ el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
      items.forEach(function(el){ io.observe(el); });
    }
  })();
