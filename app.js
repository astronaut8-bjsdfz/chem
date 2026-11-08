/* ============================================================
   方程式默写 · 看描述写方程式
   ------------------------------------------------------------
   判分原则：
   · 方程式只比「字母 / 数字 / + / = / 括号」，大小写、空格、下标写法、
     ↑ ↓ ⇌ 一律不管——考的是「能不能默出这个反应」，不是排版。
   · 反应条件不让学生打字（打字没法写在等号上方），改成点选按钮。
   · 离子方程式单独一个格子，是否要求由首页的开关决定。
   ============================================================ */

(function () {
  'use strict';

  var D = window.CHEM_DATA;
  var ITEMS = D.items;
  var CONDS = D.conds;
  var LS = { wrong: 'chem.wrong.v1', stat: 'chem.stat.v1', ion: 'chem.ion.v1' };

  var CAT = {};
  D.cats.forEach(function (c) { CAT[c.k] = c.n; });
  var CND = {};
  CONDS.forEach(function (c) { CND[c.k] = c.n; });

  /* ---------------- 存储 ---------------- */

  function load(k, dft) {
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : dft; }
    catch (e) { return dft; }
  }
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  var book = load(LS.wrong, {});            /* id -> {d, eq, n, t} */
  var stat = load(LS.stat, { r: 0, t: 0 });
  var ionOn = load(LS.ion, true) !== false;

  /* ---------------- 归一化 ---------------- */

  /* 全角 ｒ、下标 ₂、上标 ⁺、零宽字符、软连字符 —— 屏幕上长得一样，码点不同。
     中文输入法在中文状态打英文、从别处粘一手，都会带进来，不先折平就判错。 */
  function nfkc(s) {
    try { return String(s == null ? '' : s).normalize('NFKC'); }
    catch (e) { return String(s == null ? '' : s); }
  }
  var ZERO = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028\u2029\uFEFF]/g;

  function norm(s) {
    return nfkc(s).replace(ZERO, '')
      .toLowerCase()
      .replace(/\u2212/g, '-')                 /* − 数学减号 → 连字符 */
      .replace(/[（【]/g, '(').replace(/[）】]/g, ')')
      .replace(/[-—–]+>/g, '=')                /* -> —> 也算等号 */
      .replace(/[⇌⇋⇄]/g, '=')
      .replace(/[→⟶➝]/g, '=')
      .replace(/=+/g, '=')
      .replace(/[↑↓]/g, '')
      .replace(/\(\s*(浓|稀|熔融|g|l|s|aq)\s*\)/g, '')   /* (浓)(稀)(g) 这类标注可省 */
      .replace(/[^a-z0-9+=()\[\]\-]/g, '');             /* 空格 · . 、 全丢 */
  }

  function variants(it) {
    var out = [it.eq];
    if (it.alt) out = out.concat(it.alt);
    return out.map(norm);
  }

  function hitEq(it, v) {
    var k = norm(v);
    if (!k) return false;
    return variants(it).indexOf(k) > -1;
  }

  function hitIon(it, v) {
    var k = norm(v);
    if (!k || !it.ion) return false;
    return norm(it.ion) === k;
  }

  function condText(arr) {
    if (!arr || !arr.length) return '不需要条件';
    return arr.map(function (k) { return CND[k] || k; }).join('、');
  }

  function sameConds(sel, need) {
    var a = sel.slice().sort().join(','), b = (need || []).slice().sort().join(',');
    return a === b;
  }

  /* ---------------- 差异标记 ---------------- */

  var SKIP = /^[\s·.。、，,↑↓⇌⇋⇄→⟶=]$/;

  function lcs(a, b) {
    var n = a.length, m = b.length, i, j;
    var dp = [];
    for (i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1
                                 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var okA = new Array(n).fill(false), okB = new Array(m).fill(false);
    i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { okA[i] = okB[j] = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return { okA: okA, okB: okB };
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 两边都标：他写的里面多余的/写错的字符画红线，标准答案里被漏掉/写错的字符画橙线。
     化学式很密，只标一边等于没标——「2NO₂」与「2NO↑」差一个字符，不并排看不出来。 */
  function diffPair(user, std) {
    var u = String(user || ''), s = String(std || '');
    var ku = [], iu = [], ks = [], is = [], i, k;

    for (i = 0; i < u.length; i++) {
      k = nfkc(u[i]).toLowerCase();
      if (!SKIP.test(k)) { ku.push(k); iu.push(i); }
    }
    for (i = 0; i < s.length; i++) {
      k = nfkc(s[i]).toLowerCase();
      if (!SKIP.test(k)) { ks.push(k); is.push(i); }
    }

    var r = lcs(ku, ks), badU = {}, badS = {};
    iu.forEach(function (pos, n) { if (!r.okA[n]) badU[pos] = 1; });
    is.forEach(function (pos, n) { if (!r.okB[n]) badS[pos] = 1; });

    var a = '', b = '';
    for (i = 0; i < u.length; i++) a += badU[i] ? '<b class="w">' + esc(u[i]) + '</b>' : esc(u[i]);
    for (i = 0; i < s.length; i++) b += badS[i] ? '<b class="m">' + esc(s[i]) + '</b>' : esc(s[i]);
    return { u: a, a: b };
  }

  /* ---------------- DOM ---------------- */

  function $(id) { return document.getElementById(id); }

  var el = {
    home: $('vHome'), quiz: $('vQuiz'), done: $('vDone'), list: $('vList'),
    back: $('btnBack'), backTx: $('backTx'), mini: $('barMini'),
    stDone: $('stDone'), stAcc: $('stAcc'), stWrong: $('stWrong'),
    allN: $('allN'), wrongN: $('wrongN'), listN: $('listN'), footN: $('footN'),
    cats: $('cats'), swIon: $('swIon'),
    qi: $('qi'), qe: $('qe'), pfill: $('pfill'),
    qpos: $('qpos'), qzh: $('qzh'), eq: $('eq'), ion: $('ion'), ionWrap: $('ionWrap'),
    conds: $('conds'), condLab: $('condLab'), fb: $('fb'),
    btnHint: $('btnHint'), btnShow: $('btnShow'), btnSkip: $('btnSkip'), btnNext: $('btnNext'),
    ring: $('ring'), rPct: $('rPct'), rTitle: $('rTitle'), rSub: $('rSub'),
    rWrongSec: $('rWrongSec'), rWrong: $('rWrong'), rWrongN: $('rWrongN'),
    rRetry: $('rRetry'), rRetryN: $('rRetryN'), rAgain: $('rAgain'),
    listBody: $('listBody'), lN: $('lN')
  };

  var CUR = 'home';

  function view(name) {
    CUR = name;
    el.home.hidden = name !== 'home';
    el.quiz.hidden = name !== 'quiz';
    el.done.hidden = name !== 'done';
    el.list.hidden = name !== 'list';

    if (name === 'quiz') {
      el.backTx.textContent = '结果';
      el.back.setAttribute('aria-label', '结束这一轮，看结算');
    } else if (name === 'list') {
      el.backTx.textContent = '首页';
      el.back.setAttribute('aria-label', '回首页');
    } else {
      el.backTx.textContent = '门户';
      el.back.setAttribute('aria-label', '回门户');
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- 首页 ---------------- */

  function wrongCount() {
    var n = 0, k;
    for (k in book) if (book[k]) n++;
    return n;
  }

  function renderHome() {
    /* 必须掐掉「答对 0.6 秒后自动下一题」，否则最后一题答对后立刻返回，
       定时器会把结算页弹出来，看着像回不了首页 */
    clearTimeout(timer);
    S = null;

    view('home');
    el.mini.textContent = ITEMS.length + ' 条';
    el.stDone.textContent = stat.t;
    el.stAcc.textContent = stat.t ? Math.round(stat.r / stat.t * 100) + '%' : '—';
    el.stWrong.textContent = wrongCount();
    el.allN.textContent = ITEMS.length;
    el.wrongN.textContent = wrongCount();
    el.listN.textContent = ITEMS.length;
    el.footN.textContent = ITEMS.length;

    var wb = $('btnWrongMode');
    if (wb) wb.disabled = wrongCount() === 0;

    el.swIon.setAttribute('aria-checked', ionOn ? 'true' : 'false');
    el.swIon.classList.toggle('on', ionOn);

    var html = '';
    D.cats.forEach(function (c) {
      var n = ITEMS.filter(function (x) { return x.cat === c.k; }).length;
      html += '<button class="cat" type="button" data-cat="' + c.k + '">' +
                '<span>' + esc(c.n) + '</span><em>' + n + '</em></button>';
    });
    el.cats.innerHTML = html;
  }

  el.cats.addEventListener('click', function (e) {
    var b = e.target.closest('.cat');
    if (b) startCat(b.dataset.cat);
  });

  document.querySelector('#vHome').addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b || b.disabled) return;
    if (b.dataset.go === 'all') startRound(shuffle(ITEMS.slice()), '全部', 'all');
    if (b.dataset.go === 'wrong') startWrong();
  });

  el.swIon.addEventListener('click', function () {
    ionOn = !ionOn;
    save(LS.ion, ionOn);
    renderHome();
  });

  $('btnList').addEventListener('click', function () { renderList(); });
  $('rHome').addEventListener('click', renderHome);

  /* 左上角箭头：做题页拦下来转成本轮结算，速查页回首页，其余交给 <a href="../"> */
  el.back.addEventListener('click', function (e) {
    if (CUR === 'quiz') { e.preventDefault(); finish(true); return; }
    if (CUR === 'list') { e.preventDefault(); renderHome(); }
  });

  /* ---------------- 一轮 ---------------- */

  var S = null;
  var timer = null;
  var sel = {};          /* 当前题选中的条件 key */

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function startRound(list, label, from, arg) {
    if (!list.length) return;
    clearTimeout(timer);
    S = { q: list, i: 0, right: 0, wrong: [], label: label, from: from, arg: arg,
          t0: Date.now(), done: false };
    view('quiz');
    el.mini.textContent = label;
    ask();
  }

  function startCat(k) {
    startRound(shuffle(ITEMS.filter(function (x) { return x.cat === k; })), CAT[k], 'cat', k);
  }

  function startWrong() {
    var list = ITEMS.filter(function (x) { return book[x.id]; });
    if (!list.length) return;
    startRound(shuffle(list.slice()), '错题本', 'wrong');
  }

  function resetConds() {
    sel = {};
    var chips = el.conds.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.remove('on');
      chips[i].setAttribute('aria-pressed', 'false');
      chips[i].disabled = false;
    }
  }

  function buildChips() {
    el.conds.innerHTML = CONDS.map(function (c) {
      return '<button class="chip" type="button" data-k="' + c.k +
             '" aria-pressed="false">' + esc(c.n) + '</button>';
    }).join('');
  }

  el.conds.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b || b.disabled) return;
    var k = b.dataset.k;
    if (sel[k]) { delete sel[k]; b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }
    else { sel[k] = 1; b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); }
  });

  function ask() {
    var it = S.q[S.i];

    el.qpos.textContent = CAT[it.cat] + ' · ' + (S.i + 1);
    el.qzh.textContent = it.d;
    el.qi.textContent = (S.i + 1) + ' / ' + S.q.length;
    el.qe.textContent = '错 ' + S.wrong.length;
    el.pfill.style.width = (S.i / S.q.length * 100) + '%';

    el.eq.value = '';
    el.ion.value = '';
    el.eq.disabled = false;
    el.ion.disabled = false;
    el.eq.placeholder = '用 = 或 → 连接，下标直接打数字';

    el.ionWrap.hidden = !(it.ion && ionOn);
    el.condLab.hidden = false;
    el.conds.hidden = false;
    resetConds();

    el.fb.hidden = true;
    el.fb.innerHTML = '';
    el.fb.className = 'fb';

    el.btnHint.hidden = false;
    el.btnShow.hidden = false;
    el.btnSkip.hidden = false;
    el.btnNext.hidden = true;
    el.btnHint.disabled = false;
    el.btnShow.disabled = false;
    el.btnSkip.disabled = false;

    S.done = false;
    setTimeout(function () {
      try { el.eq.focus({ preventScroll: true }); } catch (e) { el.eq.focus(); }
    }, 40);
  }

  function selected() { return Object.keys(sel); }

  function judge(it) {
    var eqV = el.eq.value, ionV = el.ion.value;
    var needIon = !!(it.ion && ionOn);
    return {
      eqOK: !!eqV.trim() && hitEq(it, eqV),
      condOK: sameConds(selected(), it.cond),
      needIon: needIon,
      ionOK: needIon ? (!!ionV.trim() && hitIon(it, ionV)) : true,
      sel: selected()
    };
  }

  function allOK(g) { return g.eqOK && g.condOK && g.ionOK; }

  function lockInputs() {
    el.eq.disabled = true;
    el.ion.disabled = true;
    var chips = el.conds.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) chips[i].disabled = true;
    el.btnHint.hidden = true;
    el.btnShow.hidden = true;
    el.btnSkip.hidden = true;
    el.btnNext.hidden = false;
    S.done = true;
  }

  function mark(k, ok) {
    return '<span class="pt ' + (ok ? 'ok' : 'no') + '"><i></i>' + k + '</span>';
  }

  function fbHtml(it, g, kind) {
    var head = g && allOK(g) ? '全对'
             : kind === 'skip' ? '已跳过'
             : kind === 'reveal' ? '看一眼答案'
             : '差一点';

    var html = '<p class="head"><span class="mark"><i class="' +
               (g && allOK(g) ? 'tick' : 'cross') + '"></i></span>' + head + '</p>';

    html += '<p class="parts">' +
      mark('方程式', !!g && g.eqOK) +
      mark('条件', !!g && g.condOK) +
      (g && g.needIon ? mark('离子', g.ionOK) : '') + '</p>';

    /* 你写的（只在他写了而且不对的时候显示） */
    if (!g || !g.eqOK) {
      var u = el.eq.value.trim();
      var d = diffPair(u, it.eq);
      if (u) {
        html += '<p class="row mine"><span>你写的</span><span class="val">' + d.u + '</span></p>';
      }
      html += '<p class="row head-row"><span>应该是</span><span class="val">' + d.a + '</span></p>';
    } else {
      html += '<p class="row head-row"><span>方程式</span><span class="val">' +
              esc(it.eq) + '</span></p>';
    }

    /* 条件 */
    if (!g || !g.condOK) {
      var mine = g && g.sel.length ? g.sel.map(function (k) { return CND[k] || k; }).join('、') : '没选';
      html += '<p class="row"><span>条件</span><span class="val sm">你选的 ' + esc(mine) +
              ' · 应为 ' + esc(condText(it.cond)) + '</span></p>';
    } else {
      html += '<p class="row"><span>条件</span><span class="val sm">' + esc(condText(it.cond)) + '</span></p>';
    }

    /* 离子方程式：要求了才判，但一直给出来当参考 */
    if (it.ion) {
      if (g && g.needIon && g.ionOK) {
        html += '<p class="row"><span>离子</span><span class="val">' + esc(it.ion) + '</span></p>';
      } else if (g && g.needIon) {
        var uv = el.ion.value.trim();
        var di = diffPair(uv, it.ion);
        if (uv) {
          html += '<p class="row mine"><span>你写的离子</span><span class="val">' + di.u + '</span></p>';
        }
        html += '<p class="row head-row"><span>离子</span><span class="val">' + di.a + '</span></p>';
      } else {
        html += '<p class="row"><span>离子</span><span class="val sm">' + esc(it.ion) +
                '<em class="tag">未计入</em></span></p>';
      }
    }

    if (it.tip) html += '<p class="note">易错：' + esc(it.tip) + '</p>';
    if (kind === 'skip') html += '<p class="note">跳过直接记入错题本</p>';
    else if (!g || !allOK(g)) html += '<p class="note">红字＝你多写或写错的，橙字＝标准答案里被你漏掉或写错的 · 已记入错题本</p>';

    return html;
  }

  function remember(it, dir) {
    if (dir > 0) {
      var cur = book[it.id];
      book[it.id] = { d: it.d, eq: it.eq, n: (cur ? cur.n : 0) + 1, t: Date.now() };
    } else if (book[it.id]) {
      delete book[it.id];   /* 答对一次就销账：错题本是「还没记住」的清单 */
    }
    save(LS.wrong, book);
  }

  function good(it) {
    S.right++;
    stat.r++; stat.t++;
    save(LS.stat, stat);
    remember(it, -1);

    el.fb.className = 'fb good';
    el.fb.innerHTML = fbHtml(it, { eqOK: true, condOK: true, needIon: !!(it.ion && ionOn),
                                  ionOK: true, sel: selected() }, 'good');
    el.fb.hidden = false;
    lockInputs();

    clearTimeout(timer);
    timer = setTimeout(next, 1100);       /* 方程式长，给多点时间看答案 */
  }

  function bad(it, kind, g) {
    S.wrong.push(it);
    stat.t++;
    save(LS.stat, stat);
    remember(it, +1);

    el.fb.className = 'fb bad';
    el.fb.innerHTML = fbHtml(it, g, kind);
    el.fb.hidden = false;
    el.qe.textContent = '错 ' + S.wrong.length;
    lockInputs();
  }

  function submit() {
    if (!S) return;
    if (S.done) { next(); return; }

    var v = el.eq.value.trim();
    if (!v) { el.eq.focus(); return; }

    var it = S.q[S.i], g = judge(it);
    if (allOK(g)) good(it); else bad(it, 'wrong', g);
  }

  /* 「看答案」：已经填对的照实给对；不然就当场公布，并记入错题本 */
  function reveal() {
    if (!S || S.done) return;
    var it = S.q[S.i], g = judge(it);
    if (allOK(g)) { good(it); return; }
    bad(it, 'reveal', g);
  }

  /* 跳过＝放弃这道：一律记错，不看他填了什么对的部分 */
  function skip() {
    if (!S || S.done) return;
    var it = S.q[S.i];
    bad(it, 'skip', { eqOK: false, condOK: false, needIon: !!(it.ion && ionOn),
                      ionOK: false, sel: selected() });
  }

  function next() {
    clearTimeout(timer);
    if (!S) return;
    S.i++;
    if (S.i >= S.q.length) finish();
    else ask();
  }

  [el.eq, el.ion].forEach(function (box) {
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  });

  el.btnNext.addEventListener('click', next);
  el.btnShow.addEventListener('click', reveal);
  el.btnSkip.addEventListener('click', skip);

  /* 提示只给结构，不给答案：反应物几种、生成物几种、几个条件、有没有离子式 */
  el.btnHint.addEventListener('click', function () {
    if (!S || S.done) return;
    var it = S.q[S.i];
    var side = it.eq.split('=');
    var l = side[0].split('+').length, r = (side[1] || '').split('+').length;
    el.fb.className = 'fb';
    el.fb.innerHTML = '<p class="note">反应物 <b class="k">' + l + '</b> 种 · 生成物 <b class="k">' +
      r + '</b> 种 · 条件 <b class="k">' + it.cond.length + '</b> 个' +
      (it.ion ? (ionOn ? ' · 需要离子方程式' : ' · 这题有离子式') : ' · 没有离子式') + '</p>';
    el.fb.hidden = false;
    el.eq.focus();
  });

  /* ---------------- 结算 ---------------- */

  function fmtDur(ms) {
    var s = Math.round(ms / 1000), m = Math.floor(s / 60);
    return m ? m + ' 分 ' + (s % 60) + ' 秒' : s + ' 秒';
  }

  function finish(early) {
    clearTimeout(timer);
    if (!S) return;

    var answered = S.right + S.wrong.length;
    if (early && !answered) { renderHome(); return; }

    var partial = early && answered < S.q.length;
    var total = partial ? answered : S.q.length;
    var pct = Math.round(S.right / total * 100);

    el.ring.style.setProperty('--p', pct);
    el.rPct.textContent = pct + '%';
    el.rTitle.textContent = S.right + ' / ' + total + ' 全对';
    el.rSub.textContent = S.label +
      (partial ? ' · 提前结束（做了 ' + answered + ' / ' + S.q.length + '）' : '') +
      ' · 用了 ' + fmtDur(Date.now() - S.t0);

    if (S.wrong.length) {
      el.rWrongSec.hidden = false;
      el.rWrongN.textContent = S.wrong.length + ' 个';
      el.rWrong.innerHTML = S.wrong.map(function (it) {
        return '<div class="wrow"><span class="z">' + esc(it.d) + '</span>' +
               '<span class="e">' + esc(it.eq) + '</span></div>';
      }).join('');
      el.rRetry.hidden = false;
      el.rRetryN.textContent = S.wrong.length;
    } else {
      el.rWrongSec.hidden = true;
      el.rRetry.hidden = true;
    }

    var wrongList = shuffle(S.wrong.slice());
    var from = S.from, arg = S.arg;

    el.rRetry.onclick = function () {
      if (wrongList.length) startRound(wrongList, '重练', 'retry', null);
    };
    el.rAgain.onclick = function () {
      if (from === 'cat') startCat(arg);
      else if (from === 'wrong') startWrong();
      else startRound(shuffle(ITEMS.slice()), '全部', 'all');
    };

    view('done');
  }

  /* ---------------- 答案速查 ---------------- */

  function renderList() {
    var n = 0;
    var html = '';
    D.cats.forEach(function (c) {
      var list = ITEMS.filter(function (x) { return x.cat === c.k; });
      if (!list.length) return;
      html += '<div class="lgrp"><h3>' + esc(c.n) + '<em>' + list.length + '</em></h3>';
      list.forEach(function (it) {
        n++;
        var side = it.eq.split('=');
        html += '<div class="litem">' +
          '<p class="ld">' + esc(it.d) + '</p>' +
          '<p class="leq"><span class="lL">' + esc(side[0]) + '</span>' +
            '<span class="lrun"><em>' + esc(it.cond.length ? condText(it.cond) : '') + '</em><b></b></span>' +
            '<span class="lR">' + esc(side[1] || '') + '</span></p>' +
          (it.ion ? '<p class="lion">离子 ' + esc(it.ion) + '</p>' : '') +
          (it.tip ? '<p class="ltip">' + esc(it.tip) + '</p>' : '') +
          '</div>';
      });
      html += '</div>';
    });
    el.listBody.innerHTML = html;
    el.lN.textContent = n + ' 条';
    el.mini.textContent = n + ' 条';
    view('list');
  }

  /* ---------------- 起 ---------------- */

  /* 调试钩子：只给断言用，不进界面 */
  window.__chem = {
    items: ITEMS,
    norm: norm,
    judgeEq: function (id, v) {
      var it = ITEMS.filter(function (x) { return x.id === id; })[0];
      return it ? hitEq(it, v) : null;
    },
    ion: function (id, v) {
      var it = ITEMS.filter(function (x) { return x.id === id; })[0];
      return it ? hitIon(it, v) : null;
    }
  };

  /* 页脚版本号：从 script[src] 抓 ?v=，用户截图就能看出有没有缓存 */
  (function () {
    var f = $('ver');
    if (!f) return;
    var sc = document.querySelector('script[src*="app.js"]');
    var m = sc && (sc.getAttribute('src') || '').match(/v=([0-9a-z]+)/);
    if (m) f.textContent = ' · ' + m[1];
  })();

  buildChips();
  renderHome();
})();
