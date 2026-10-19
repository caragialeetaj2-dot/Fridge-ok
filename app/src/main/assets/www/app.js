/* Watch Weather - ES5 only (works in Android 4.0+ WebView). No fetch, no Promise, no arrow functions. */
(function () {
  'use strict';

  /* ================= CONFIG ================= */
  var LOCATIONS = [
    { id: 'pitesti',    name: 'Pite\u0219ti, Romania',    short: 'Pite\u0219ti',    sub: 'Str. Banat, Arge\u0219 County', lat: 44.8606,   lon: 24.8678 },
    { id: 'valea-mare', name: 'Valea Mare, Romania', short: 'Valea Mare', sub: 'D\u00e2mbovi\u021ba County',         lat: 45.063641, lon: 25.156696 },
    { id: 'arefu',      name: 'Arefu, Romania',      short: 'Arefu',      sub: 'Arge\u0219 County',             lat: 45.3283,   lon: 24.6256 }
  ];
  var SCREEN_MS = 20000;            // clock <-> Pitesti rotation and idle return
  var REFRESH_MS = 15 * 60 * 1000;  // automatic refresh
  var HOURS_SHOWN = 24;

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var RO_DAYS = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'S\u00e2m'];
  var COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var DESC = {
    0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Dense Drizzle', 56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 66: 'Freezing Rain', 67: 'Freezing Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains', 80: 'Rain Showers', 81: 'Rain Showers', 82: 'Violent Showers',
    85: 'Snow Showers', 86: 'Snow Showers', 95: 'Thunderstorm', 96: 'Thunderstorm, Hail', 99: 'Thunderstorm, Hail'
  };

  /* ================= HELPERS ================= */
  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function hasClass(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function addClass(e, c) { if (!hasClass(e, c)) e.className = (e.className + ' ' + c).replace(/^\s+/, ''); }
  function removeClass(e, c) { e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }
  function toggleClass(e, c, on) { if (on) addClass(e, c); else removeClass(e, c); }
  function closest(node, cls) {
    while (node && node.nodeType === 1) { if (hasClass(node, cls)) return node; node = node.parentNode; }
    return null;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  var el = {
    app: $('app'), watch: $('watch'), weather: $('weather'),
    hh: $('hh'), mm: $('mm'), ss: $('ss'), dayname: $('dayname'), datefull: $('datefull'),
    sky: $('sky'), locName: $('locName'), locSub: $('locSub'), curTemp: $('curTemp'), tabs: $('tabs'),
    curIcon: $('curIcon'), curDesc: $('curDesc'), curDetails: $('curDetails'),
    panel: $('forecastPanel'), scroll: $('forecastScroll'), forecast: $('forecast'),
    toggle: $('forecastToggle'), refresh: $('refreshBtn'), refreshLbl: $('refreshLbl'),
    status: $('status'), dots: $('dots'), exit: $('exitBtn')
  };

  /* ================= 720p SCALING ================= */
  function fit() {
    var w = window.innerWidth || document.documentElement.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight;
    var s = Math.min(w / 1280, h / 720);
    var t = 'scale(' + s + ')';
    el.app.style.webkitTransform = t;
    el.app.style.transform = t;
    el.app.style.left = Math.round((w - 1280 * s) / 2) + 'px';
    el.app.style.top = Math.round((h - 720 * s) / 2) + 'px';
  }
  window.addEventListener('resize', fit, false);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 300); }, false);
  fit();
  setTimeout(fit, 500); // old WebViews report the final size a bit later

  /* ================= CLOCK ================= */
  var clockTimer = null;
  function tick() {
    var d = new Date();
    el.hh.innerHTML = pad(d.getHours());
    el.mm.innerHTML = pad(d.getMinutes());
    el.ss.innerHTML = pad(d.getSeconds());
    el.dayname.innerHTML = DAYS[d.getDay()];
    el.datefull.innerHTML = d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function startClock() {
    clearTimeout(clockTimer);
    tick();
    clockTimer = setTimeout(startClock, 1000 - (new Date().getTime() % 1000) + 5);
  }
  startClock();

  /* ================= ICONS ================= */
  function sun(cx, cy, r) {
    var rays = '', i, a;
    for (i = 0; i < 8; i++) {
      a = i * Math.PI / 4;
      rays += '<line x1="' + (cx + Math.cos(a) * (r + 4)) + '" y1="' + (cy + Math.sin(a) * (r + 4)) + '" x2="' + (cx + Math.cos(a) * (r + 10)) + '" y2="' + (cy + Math.sin(a) * (r + 10)) + '" stroke="#FDB813" stroke-width="3.5" stroke-linecap="round"/>';
    }
    return '<g>' + rays + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#FDB813"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.7) + '" fill="#FFD54F"/></g>';
  }
  function moon(cx, cy, s) {
    return '<path transform="translate(' + (cx - 32 * s) + ',' + (cy - 32 * s) + ') scale(' + s + ')" d="M40 12a20 20 0 1 0 14 32 16 16 0 0 1-14-32z" fill="#F4E7B0"/>';
  }
  function cloud(dx, dy, fill) {
    return '<g transform="translate(' + dx + ',' + dy + ')" fill="' + fill + '"><circle cx="22" cy="38" r="10"/><circle cx="34" cy="30" r="13"/><circle cx="46" cy="38" r="9"/><rect x="12" y="36" width="44" height="12" rx="6"/></g>';
  }
  function kind(c) {
    if (c === 0 || c === 1) return 'clear';
    if (c === 2) return 'partly';
    if (c === 3) return 'cloud';
    if (c === 45 || c === 48) return 'fog';
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
    if (c >= 95) return 'storm';
    return 'cloud';
  }
  function iconSVG(code, isDay) {
    var g = '', i, p;
    switch (kind(code)) {
      case 'clear': g = isDay ? sun(32, 32, 12) : moon(32, 32, 0.9); break;
      case 'partly': g = (isDay ? sun(24, 22, 9) : moon(24, 22, 0.55)) + cloud(4, 6, '#F2F4F7'); break;
      case 'cloud': g = cloud(-2, -6, '#CFD6DE') + cloud(2, 2, '#F2F4F7'); break;
      case 'fog':
        g = cloud(0, -8, '#E3E7EB');
        for (i = 46; i <= 58; i += 6) g += '<line x1="12" y1="' + i + '" x2="52" y2="' + i + '" stroke="#E3E7EB" stroke-width="3" stroke-linecap="round"/>';
        break;
      case 'rain':
        g = cloud(0, -8, '#E8ECF0');
        for (i = 20; i <= 40; i += 10) g += '<line x1="' + i + '" y1="46" x2="' + (i - 4) + '" y2="58" stroke="#4FC3F7" stroke-width="3.5" stroke-linecap="round"/>';
        break;
      case 'snow':
        g = cloud(0, -8, '#F2F4F7');
        p = [[20, 50], [32, 56], [44, 50], [26, 60], [38, 62]];
        for (i = 0; i < p.length; i++) g += '<circle cx="' + p[i][0] + '" cy="' + p[i][1] + '" r="2.8" fill="#fff"/>';
        break;
      case 'storm': g = cloud(0, -8, '#9AA5B1') + '<polygon points="32,42 24,54 31,54 27,64 40,49 33,49 37,42" fill="#FFD600"/>'; break;
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + g + '</svg>';
  }
  function theme(code, isDay) {
    var k = kind(code);
    if (k === 'storm' || k === 'rain' || k === 'snow' || k === 'fog') return k;
    if (!isDay) return 'night';
    return k === 'cloud' ? 'cloudy-day' : 'clear-day';
  }

  /* ================= SKY (lighter for old devices) ================= */
  var SKYLINE = (function () {
    var x = 0, r = '', w = '', trees = '', bw, bh, wy, wx, t;
    while (x < 1280) {
      bw = rnd(28, 80); bh = rnd(40, 150);
      r += '<rect x="' + x + '" y="' + (170 - bh) + '" width="' + bw + '" height="' + bh + '"/>';
      for (wy = 170 - bh + 10; wy < 160; wy += 16) {
        for (wx = x + 6; wx < x + bw - 8; wx += 14) {
          if (Math.random() < 0.35) w += '<rect x="' + wx + '" y="' + wy + '" width="5" height="7"/>';
        }
      }
      x += bw + rnd(0, 6);
    }
    for (t = 0; t < 1280; t += rnd(18, 40)) trees += '<circle cx="' + t + '" cy="' + rnd(160, 172) + '" r="' + rnd(10, 20) + '"/>';
    return { r: r, w: w, trees: trees };
  })();
  var lastSkyTheme = null;
  function renderSky(th) {
    if (th === lastSkyTheme) return;
    lastSkyTheme = th;
    el.sky.className = 'sky ' + th;
    var h = '', i, w, dur, sz;
    var nClouds = { 'clear-day': 3, 'cloudy-day': 6, rain: 6, storm: 6, snow: 5, fog: 3, night: 2 }[th];
    var cColor = { rain: '#cfd6dd', storm: '#7d8792', night: '#43557a' }[th] || '#ffffff';
    if (th === 'clear-day') h += '<div class="glow"></div>';
    if (th === 'night') for (i = 0; i < 50; i++) h += '<div class="star" style="left:' + rnd(0, 100) + '%;top:' + rnd(0, 60) + '%;-webkit-animation-delay:' + rnd(0, 3) + 's;animation-delay:' + rnd(0, 3) + 's"></div>';
    for (i = 0; i < nClouds; i++) {
      w = rnd(160, 340); dur = rnd(60, 140);
      h += '<div class="cloudshape" style="width:' + w + 'px;height:' + (w * 0.28) + 'px;top:' + rnd(40, 190) + 'px;background:' + cColor +
        ';-webkit-animation-duration:' + dur + 's;animation-duration:' + dur + 's;-webkit-animation-delay:-' + rnd(0, dur) + 's;animation-delay:-' + rnd(0, dur) + 's"><div class="p1"></div><div class="p2"></div></div>';
    }
    if (th === 'rain' || th === 'storm') for (i = 0; i < 50; i++) {
      dur = rnd(0.5, 0.9);
      h += '<div class="drop" style="left:' + rnd(0, 105) + '%;-webkit-animation-duration:' + dur + 's;animation-duration:' + dur + 's;-webkit-animation-delay:-' + rnd(0, 1) + 's;animation-delay:-' + rnd(0, 1) + 's"></div>';
    }
    if (th === 'snow') for (i = 0; i < 40; i++) {
      dur = rnd(5, 10); sz = rnd(4, 8);
      h += '<div class="flake" style="left:' + rnd(0, 100) + '%;width:' + sz + 'px;height:' + sz + 'px;-webkit-animation-duration:' + dur + 's;animation-duration:' + dur + 's;-webkit-animation-delay:-' + rnd(0, 10) + 's;animation-delay:-' + rnd(0, 10) + 's"></div>';
    }
    if (th === 'fog') for (i = 0; i < 5; i++) h += '<div class="mist" style="top:' + (60 + i * 65) + 'px"></div>';
    if (th === 'storm') h += '<div class="flash"></div>';
    var bld = th === 'night' ? '#0a1428' : 'rgba(30,45,65,.85)';
    var win = th === 'night' ? '#ffd27a' : 'rgba(200,220,240,.35)';
    h += '<svg class="skyline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 170" preserveAspectRatio="none"><g fill="' + bld + '">' + SKYLINE.r +
      '</g><g fill="' + win + '">' + SKYLINE.w + '</g><g fill="' + (th === 'night' ? '#07101f' : '#2f4a3a') + '">' + SKYLINE.trees + '</g></svg>';
    el.sky.innerHTML = h;
  }

  /* ================= WEATHER DATA ================= */
  var cache = {};    // id -> { at, data }
  var offline = {};  // id -> true if last refresh failed
  var pending = 0, pendingOk = true, refreshCallbacks = [];
  var refreshInterval = null;

  function query(loc) {
    return 'latitude=' + loc.lat + '&longitude=' + loc.lon +
      '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day' +
      '&hourly=temperature_2m,weather_code,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&timezone=Europe%2FBucharest&forecast_days=7&wind_speed_unit=kmh';
  }
  function isValid(d) {
    return !!(d && d.current && d.hourly && d.daily && d.hourly.time && d.hourly.time.length && d.daily.time && d.daily.time.length);
  }
  function parseEntry(str) {
    if (!str) return null;
    try { var e = JSON.parse(str); return e && isValid(e.data) ? e : null; } catch (err) { return null; }
  }
  function loadCache() {
    var i, loc, e;
    for (i = 0; i < LOCATIONS.length; i++) {
      loc = LOCATIONS[i];
      try {
        e = parseEntry(window.Native ? window.Native.getCache(loc.id) : window.localStorage.getItem('wx:' + loc.id));
        if (e) cache[loc.id] = e;
      } catch (err) { /* ignore */ }
    }
  }

  function finishOne(id, ok) {
    offline[id] = !ok;
    if (!ok) pendingOk = false;
    pending--;
    if (pending <= 0) {
      pending = 0;
      if (current.screen === 'weather') renderWeather();
      var cbs = refreshCallbacks, result = pendingOk, i;
      refreshCallbacks = [];
      for (i = 0; i < cbs.length; i++) cbs[i](result);
    }
  }

  /* Called by native code when a download finishes */
  function onWeather(id, ok) {
    if (ok) {
      var e = parseEntry(window.Native.take(id));
      if (e) cache[id] = e; else ok = false;
    }
    finishOne(id, ok);
  }

  /* Browser-preview fallback (no native bridge) */
  function xhrFetch(loc) {
    var x = new XMLHttpRequest();
    x.open('GET', 'https://api.open-meteo.com/v1/forecast?' + query(loc), true);
    x.timeout = 15000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var ok = false;
      if (x.status === 200) {
        try {
          var data = JSON.parse(x.responseText);
          if (isValid(data)) {
            cache[loc.id] = { at: new Date().getTime(), data: data };
            try { window.localStorage.setItem('wx:' + loc.id, JSON.stringify(cache[loc.id])); } catch (err) { /* ignore */ }
            ok = true;
          }
        } catch (err) { /* ignore */ }
      }
      finishOne(loc.id, ok);
    };
    try { x.send(); } catch (err) { finishOne(loc.id, false); }
  }

  function refreshAll(cb) {
    if (cb) refreshCallbacks.push(cb);
    if (pending > 0) return; // already running; callback will be called at the end
    pending = LOCATIONS.length;
    pendingOk = true;
    for (var i = 0; i < LOCATIONS.length; i++) {
      if (window.Native) window.Native.fetch(LOCATIONS[i].id, query(LOCATIONS[i]));
      else xhrFetch(LOCATIONS[i]);
    }
  }
  function restartAutoRefresh() {
    clearInterval(refreshInterval);
    refreshInterval = setInterval(function () { refreshAll(); }, REFRESH_MS);
  }

  /* ================= MANUAL UPDATE ================= */
  var refreshFeedbackTimer = null, manualBusy = false;
  function manualRefresh() {
    if (manualBusy) return;
    manualBusy = true;
    clearTimeout(refreshFeedbackTimer);
    removeClass(el.refresh, 'ok'); removeClass(el.refresh, 'fail');
    addClass(el.refresh, 'busy');
    el.refreshLbl.innerHTML = 'Se actualizeaz\u0103...';
    var started = new Date().getTime();
    refreshAll(function (ok) {
      var wait = Math.max(0, 700 - (new Date().getTime() - started));
      setTimeout(function () {
        manualBusy = false;
        removeClass(el.refresh, 'busy');
        addClass(el.refresh, ok ? 'ok' : 'fail');
        el.refreshLbl.innerHTML = ok ? 'Actualizat' : 'F\u0103r\u0103 conexiune';
        restartAutoRefresh();
        postpone();
        refreshFeedbackTimer = setTimeout(function () {
          removeClass(el.refresh, 'ok'); removeClass(el.refresh, 'fail');
          el.refreshLbl.innerHTML = 'Actualizeaz\u0103';
        }, 2500);
      }, wait);
    });
  }

  /* ================= RENDER ================= */
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function indexFrom(times, key) {
    for (var i = 0; i < times.length; i++) if (times[i] >= key) return i;
    return -1;
  }
  function statusText(entry, isOffline) {
    if (!entry) return isOffline ? 'Offline data unavailable' : 'Loading...';
    var t = new Date(entry.at);
    var when = (dateKey(t) === dateKey(new Date()) ? '' : pad(t.getDate()) + '.' + pad(t.getMonth() + 1) + ' ') + pad(t.getHours()) + ':' + pad(t.getMinutes());
    return 'Updated ' + when + ' \u00b7 ' + (isOffline ? 'Offline data' : 'Open-Meteo');
  }

  var forecastMode = 'hours';
  function renderTabs(active) {
    var h = '', j;
    for (j = 0; j < LOCATIONS.length; j++) {
      h += '<span class="tab' + (j === active ? ' on' : '') + '" data-i="' + j + '">' + LOCATIONS[j].short + '</span>';
    }
    el.tabs.innerHTML = h;
  }
  function renderWeather() {
    var i = current.loc, loc = LOCATIONS[i], entry = cache[loc.id], isOffline = !!offline[loc.id];
    el.locName.innerHTML = loc.name;
    el.locSub.innerHTML = loc.sub;
    renderTabs(i);
    el.toggle.innerHTML = forecastMode === 'days' ? 'Prognoz\u0103 pe ore' : 'Zile urm\u0103toare';
    el.status.innerHTML = statusText(entry, isOffline);
    toggleClass(el.status, 'offline', isOffline);

    if (!entry) {
      el.curTemp.innerHTML = '--&deg;C';
      el.curIcon.innerHTML = '';
      el.curDesc.innerHTML = isOffline ? 'No connection' : 'Loading...';
      el.curDetails.innerHTML = '';
      el.forecast.innerHTML = '';
      renderSky('cloudy-day');
      return;
    }

    var d = entry.data, cur = d.current, now = new Date();
    var isDay = cur.is_day === 1 || cur.is_day === true;
    var today = Math.max(0, indexFrom(d.daily.time, dateKey(now)));
    el.curTemp.innerHTML = Math.round(cur.temperature_2m) + '&deg;C';
    el.curIcon.innerHTML = iconSVG(cur.weather_code, isDay);
    el.curDesc.innerHTML = DESC[cur.weather_code] || '-';
    el.curDetails.innerHTML =
      'H: ' + Math.round(d.daily.temperature_2m_max[today]) + '&deg; | L: ' + Math.round(d.daily.temperature_2m_min[today]) + '&deg;<br>' +
      'Wind: ' + Math.round(cur.wind_speed_10m) + ' km/h ' + COMPASS[Math.round(cur.wind_direction_10m / 45) % 8] + '<br>' +
      'Humidity: ' + cur.relative_humidity_2m + '%';
    renderSky(theme(cur.weather_code, isDay));

    var html = '', k, parts, dt, label, start, end;
    if (forecastMode === 'days') {
      for (k = today; k < d.daily.time.length; k++) {
        parts = d.daily.time[k].split('-');
        dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        label = k === today ? 'Azi' : (k === today + 1 ? 'M\u00e2ine' : RO_DAYS[dt.getDay()] + ' ' + (+parts[2]));
        html += '<div class="dcard"><div class="day">' + label + '</div><div class="ic">' + iconSVG(d.daily.weather_code[k], true) + '</div>' +
          '<div class="range">' + Math.round(d.daily.temperature_2m_max[k]) + '&deg; / ' + Math.round(d.daily.temperature_2m_min[k]) + '&deg;</div></div>';
      }
    } else {
      start = indexFrom(d.hourly.time, dateKey(now) + 'T' + pad(now.getHours()) + ':00');
      if (start < 0) start = Math.max(0, d.hourly.time.length - HOURS_SHOWN);
      end = Math.min(d.hourly.time.length, start + HOURS_SHOWN);
      for (k = start; k < end; k++) {
        html += '<div class="hcard"><div class="t">' + d.hourly.time[k].substr(11, 5) + '</div><div class="ic">' +
          iconSVG(d.hourly.weather_code[k], d.hourly.is_day[k] === 1) + '</div><div class="v">' + Math.round(d.hourly.temperature_2m[k]) + '&deg;C</div></div>';
      }
    }
    el.forecast.innerHTML = html;
  }

  /* ================= ROTATION ================= */
  var ROTATION = [{ screen: 'watch', loc: null }, { screen: 'weather', loc: 0 }];
  var pos = 0, current = ROTATION[0], timer = null;
  el.dots.innerHTML = '<span></span><span></span>';

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { show(pos + 1); }, SCREEN_MS);
  }
  function apply(locationChanged) {
    var isWeather = current.screen === 'weather', dots = el.dots.getElementsByTagName('span'), j;
    toggleClass(el.watch, 'active', !isWeather);
    toggleClass(el.weather, 'active', isWeather);
    if (isWeather) {
      if (locationChanged) el.scroll.scrollLeft = 0;
      renderWeather();
    }
    for (j = 0; j < dots.length; j++) toggleClass(dots[j], 'on', j === pos);
    schedule();
  }
  function show(p) {
    var prevLoc = current.loc;
    pos = (p + ROTATION.length) % ROTATION.length;
    current = { screen: ROTATION[pos].screen, loc: ROTATION[pos].loc };
    apply(current.loc !== prevLoc);
  }
  function selectLocation(i) {
    var prevLoc = current.loc;
    pos = 1;
    current = { screen: 'weather', loc: i };
    apply(i !== prevLoc);
  }
  function postpone() { if (current.screen === 'weather') schedule(); }

  /* ================= EXIT (first tap) ================= */
  function exitApp() {
    addClass(el.exit, 'pressed');
    setTimeout(function () {
      if (window.Native) window.Native.exitApp(); else window.close();
    }, 120);
  }

  /* ================= INPUT ================= */
  function flash(btn) {
    addClass(btn, 'pressed');
    setTimeout(function () { removeClass(btn, 'pressed'); }, 150);
  }
  var swiped = false;
  el.app.addEventListener('click', function (e) {
    var t = e.target, tab;
    if (swiped) { swiped = false; return; }

    if (closest(t, 'exitBtn')) { exitApp(); return; }

    tab = closest(t, 'tab');
    if (tab) { selectLocation(+tab.getAttribute('data-i')); return; }
    if (closest(t, 'refreshBtn')) { flash(el.refresh); manualRefresh(); return; }
    if (closest(t, 'toggleBtn')) {
      flash(el.toggle);
      forecastMode = forecastMode === 'hours' ? 'days' : 'hours';
      el.scroll.scrollLeft = 0;
      renderWeather();
      postpone();
      return;
    }
    if (closest(t, 'tabs') || closest(t, 'wbottom')) { postpone(); return; }
    show(pos + 1); // tap anywhere else: clock <-> weather
  }, false);

  // Keep weather open while the forecast strip is used.
  el.scroll.addEventListener('touchstart', postpone, false);
  el.scroll.addEventListener('scroll', postpone, false);

  // Swipe left/right outside the forecast strip.
  var sx = null;
  el.app.addEventListener('touchstart', function (e) {
    var t = e.target;
    sx = (closest(t, 'wbottom') || closest(t, 'tabs') || closest(t, 'exitBtn')) ? null : e.touches[0].clientX;
  }, false);
  el.app.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 60) { swiped = true; setTimeout(function () { swiped = false; }, 400); show(pos + (dx < 0 ? 1 : -1)); }
  }, false);

  /* ================= LIFECYCLE ================= */
  function onResume() {
    startClock();
    fit();
    refreshAll();
  }
  window.addEventListener('online', function () { refreshAll(); }, false);

  window.WW = { onWeather: onWeather, onResume: onResume };

  show(0);
  loadCache();
  refreshAll();
  restartAutoRefresh();
})();
