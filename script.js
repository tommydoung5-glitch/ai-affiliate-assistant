// หน้าเว็บนี้ไม่มี API Key ใดๆ: ทุกปุ่มเรียก /api/generate บนเซิร์ฟเวอร์ ซึ่งเป็นผู้เรียก Anthropic API
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var platform = 'shopee', busy = false, results = {}, toastTimer, accessCode = '';
  try { accessCode = sessionStorage.getItem('ac') || ''; } catch (e) { /* ใช้ต่อได้ แค่ไม่จำรหัส */ }
  var TITLES = { pain: 'ปัญหาที่ลูกค้าพบ', script: 'บทพูดขายสินค้า 10 วินาที', head: 'พาดหัวคลิป', fb: 'แคปชั่น Facebook', tag: 'Hashtag', vid: 'Prompt วิดีโอ AI 3 ฉาก' };
  var ORDER = ['pain', 'script', 'head', 'fb', 'tag', 'vid'];

  function getData() {
    var name = $('name').value.trim();
    var raw = $('price').value.trim();
    var num = Number(raw.replace(/[,฿\s]|บาท/g, ''));
    var price = raw ? (isFinite(num) && num > 0 ? '฿' + num.toLocaleString('th-TH') : raw) : '';
    var feats = $('feat').value.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    return { name: name, price: price, feats: feats };
  }

  // ---------- เรียกเซิร์ฟเวอร์ ----------
  function api(task, d) {
    return fetch('/api/generate', {
      method: 'POST',
      headers: accessCode ? { 'Content-Type': 'application/json', 'x-access-code': accessCode } : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: task, name: d.name, price: d.price, features: d.feats, platform: platform })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var err = new Error(j.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
          err.code = j.code;
          throw err;
        }
        return j.items;
      });
    }, function () {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต และดูว่าเซิร์ฟเวอร์ยังเปิดอยู่ (npm start)');
    });
  }

  // ---------- แสดงผล ----------
  function toast(m) {
    var t = $('toast'); t.textContent = m; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }
  function copy(text) {
    function fallback() {
      try {
        var a = document.createElement('textarea');
        a.value = text; a.style.position = 'fixed'; a.style.opacity = '0';
        document.body.appendChild(a); a.select(); document.execCommand('copy'); document.body.removeChild(a);
        toast('คัดลอกแล้ว');
      } catch (e) { toast('คัดลอกไม่สำเร็จ ลองกดค้างที่ข้อความ'); }
    }
    try {
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast('คัดลอกแล้ว'); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function showLoading(body) {
    body.textContent = '';
    var s = el('div', 'status');
    s.appendChild(el('span', 'spin'));
    s.appendChild(el('span', null, 'AI กำลังเขียนให้ รอสักครู่…'));
    body.appendChild(s);
  }
  function showError(body, msg, retry) {
    body.textContent = '';
    var e = el('div', 'errbox');
    e.appendChild(el('div', null, '⚠️ ' + msg));
    var b = el('button', 'cp', 'ลองใหม่');
    b.type = 'button';
    b.addEventListener('click', retry);
    e.appendChild(b);
    body.appendChild(e);
  }
  function showItems(body, items) {
    body.textContent = '';
    items.forEach(function (it) {
      var box = el('div', 'item');
      box.appendChild(el('div', 'lab', it.label));
      box.appendChild(el('div', 'txt', it.text));
      var b = el('button', 'cp', 'คัดลอก');
      b.type = 'button';
      b.addEventListener('click', function () { copy(it.text); });
      box.appendChild(b);
      body.appendChild(box);
    });
  }

  function setBusy(on, activeBtn) {
    busy = on;
    document.querySelectorAll('.act').forEach(function (b) {
      b.disabled = on;
      b.classList.toggle('loading', on && b === activeBtn);
    });
  }

  function runTask(key, body, d) {
    showLoading(body);
    return api(key, d).then(function (items) {
      results[key] = items;
      showItems(body, items);
      $('copyall').disabled = false;
    }, function (e) {
      delete results[key];
      if (e.code === 'BAD_CODE') showGate(true);
      showError(body, e.message, function () {
        if (busy) return;
        var dd = getData();
        if (!dd.name) { $('err').textContent = 'กรุณากรอกชื่อสินค้าก่อน'; return; }
        setBusy(true);
        runTask(key, body, dd).then(function () { setBusy(false); });
      });
    });
  }

  function start(k, btn) {
    if (busy) return;
    var d = getData();
    if (!d.name) { $('err').textContent = 'กรุณากรอกชื่อสินค้าก่อน'; $('name').focus(); return; }
    $('err').textContent = '';
    results = {};
    var keys = k === 'all' ? ORDER : [k];
    var list = $('list'); list.textContent = '';
    $('rtitle').textContent = k === 'all' ? 'ครบทุกอย่างสำหรับ ' + d.name : TITLES[k];
    $('copyall').disabled = true;
    document.querySelectorAll('.act').forEach(function (b) { b.classList.remove('on'); });
    if (k !== 'all') btn.classList.add('on');
    var jobs = keys.map(function (key) {
      var sec = el('div', 'sec');
      if (keys.length > 1) sec.appendChild(el('h3', 'grp', TITLES[key]));
      var body = el('div', 'body');
      sec.appendChild(body); list.appendChild(sec);
      return runTask(key, body, d);
    });
    $('result').hidden = false;
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    $('result').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    setBusy(true, btn);
    Promise.all(jobs).then(function () { setBusy(false); });
  }

  document.querySelectorAll('.act').forEach(function (btn) {
    btn.addEventListener('click', function () { start(btn.dataset.k, btn); });
  });
  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      platform = c.dataset.p;
      document.querySelectorAll('.chip').forEach(function (x) {
        var on = x === c; x.classList.toggle('on', on); x.setAttribute('aria-checked', on);
      });
    });
  });
  $('copyall').addEventListener('click', function () {
    var parts = [];
    ORDER.forEach(function (key) {
      if (!results[key]) return;
      if (Object.keys(results).length > 1) parts.push('== ' + TITLES[key] + ' ==');
      results[key].forEach(function (it) { parts.push(it.label + '\n' + it.text); });
    });
    copy(parts.join('\n\n'));
  });
  $('name').addEventListener('input', function () { $('err').textContent = ''; });
  $('clear').addEventListener('click', function () {
    if (busy) return;
    ['name', 'price', 'feat'].forEach(function (id) { $(id).value = ''; });
    $('err').textContent = ''; $('result').hidden = true; results = {};
    document.querySelectorAll('.act').forEach(function (b) { b.classList.remove('on'); });
    $('name').focus();
  });

  function showGate(wrong) {
    $('gate').hidden = false;
    $('gateerr').textContent = wrong ? 'รหัสไม่ถูกต้อง กรุณากรอกใหม่แล้วกดสร้างอีกครั้ง' : '';
    $('code').focus();
  }
  $('gatebtn').addEventListener('click', function () {
    var v = $('code').value.trim();
    if (!v) { $('gateerr').textContent = 'กรุณากรอกรหัส'; return; }
    accessCode = v;
    try { sessionStorage.setItem('ac', v); } catch (e) { /* ไม่เป็นไร */ }
    $('gate').hidden = true; $('code').value = '';
    toast('บันทึกรหัสแล้ว กดสร้างได้เลย');
  });

  // ตรวจสถานะเซิร์ฟเวอร์ตอนเปิดหน้า
  fetch('/api/health').then(function (r) { return r.json(); }).then(function (j) {
    if (j.needCode && !accessCode) showGate(false);
    if (!j.hasKey) { $('banner').textContent = '⚙️ เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ปุ่มสร้างข้อความจะยังใช้งานไม่ได้ ดูวิธีตั้งค่าใน README'; $('banner').hidden = false; }
  }, function () {
    $('banner').textContent = '⚙️ เปิดหน้านี้ผ่านเซิร์ฟเวอร์ (รัน npm start แล้วเข้า http://localhost:3000) จึงจะใช้ AI ได้';
    $('banner').hidden = false;
  });
})();
