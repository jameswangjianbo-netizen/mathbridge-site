/**
 * MathBridge quiz backend — Google Apps Script bound to a Google Sheet.
 *
 * Setup (full steps in backend/SETUP.md):
 *   1. Create a Google Sheet, then Extensions → Apps Script, and paste this file.
 *   2. Run setup() once. It creates the sheets and logs your TEACHER KEY.
 *   3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *   4. Put the web app URL in assets/config.js on the site.
 *
 * Every request is a POST with a JSON body {action, ...}. Teacher actions need
 * {key: TEACHER_KEY}. Student actions need the student's name and PIN.
 */

var SHEET_QUIZZES = 'Quizzes';
var SHEET_SUBS = 'Submissions';
var Q_COLS = ['id', 'title', 'className', 'items', 'minutes', 'showMs', 'allowResubmit', 'open', 'createdAt', 'instructions'];
var S_COLS = ['quizId', 'studentKey', 'name', 'pinHash', 'attempt', 'status', 'score', 'max', 'submittedAt', 'returnedAt',
              'answers', 'feedback', 'history', 'seenAt', 'elapsed'];

var LIMITS = {
  nameLen: 60, answerLen: 6000, answersTotal: 40000, commentLen: 2000, history: 5,
  subsPerQuiz: 400, itemsPerQuiz: 40, titleLen: 120
};

/* ------------------------------------------------------------------ setup */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_QUIZZES, Q_COLS);
  ensureSheet_(ss, SHEET_SUBS, S_COLS);
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('TEACHER_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('TEACHER_KEY', key);
  }
  Logger.log('Your TEACHER KEY is: ' + key);
  Logger.log('Keep it private. Enter it on the teacher dashboard. Change it in Project Settings → Script properties.');
  return key;
}

function ensureSheet_(ss, name, cols) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(cols);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ------------------------------------------------------------- transport */

function doGet(e) {
  return json_({ ok: true, service: 'mathbridge-quiz', version: 1 });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  try {
    var fn = ACTIONS[req.action];
    if (!fn) return json_({ ok: false, error: 'unknown_action' });
    if (TEACHER_ACTIONS[req.action] && !isTeacher_(req.key)) return json_({ ok: false, error: 'bad_key' });
    return json_(fn(req));
  } catch (err) {
    var msg = String(err && err.message || err);
    if (/^E:/.test(msg)) return json_({ ok: false, error: msg.slice(2) });
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code) { throw new Error('E:' + code); }

/* ---------------------------------------------------------------- helpers */

function isTeacher_(key) {
  var real = PropertiesService.getScriptProperties().getProperty('TEACHER_KEY');
  if (!real || typeof key !== 'string' || key.length !== real.length) return false;
  var diff = 0;
  for (var i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ensureSheet_(ss, name, name === SHEET_QUIZZES ? Q_COLS : S_COLS);
}

/** Reads a sheet into [{row, obj}] using the header row. */
function rows_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var head = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var o = {};
    for (var c = 0; c < head.length; c++) o[head[c]] = values[r][c];
    out.push({ row: r + 1, obj: o });
  }
  return { sh: sh, head: head, list: out };
}

function writeRow_(t, rowNum, obj) {
  // A leading apostrophe stores strings as plain text: no formulas (a name like "=HYPERLINK(...)"),
  // and no auto-conversion of timestamps into dates. getValues() returns the text without it.
  var vals = t.head.map(function (h) {
    var v = obj[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' && v !== '') return "'" + v;
    return v;
  });
  if (rowNum) t.sh.getRange(rowNum, 1, 1, vals.length).setValues([vals]);
  else t.sh.appendRow(vals);
}

function parse_(s, dflt) {
  if (s === '' || s === null || s === undefined) return dflt;
  try { return JSON.parse(s); } catch (e) { return dflt; }
}

function str_(v, max) {
  v = (v === null || v === undefined) ? '' : String(v);
  return v.length > max ? v.slice(0, max) : v;
}

function bool_(v) { return v === true || v === 'TRUE' || v === 'true'; }

function now_() { return new Date().toISOString(); }

function studentKey_(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hashPin_(quizId, key, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'mb1|' + quizId + '|' + key + '|' + pin);
  return Utilities.base64Encode(bytes);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function quizOut_(o) {
  return {
    id: String(o.id), title: String(o.title), className: String(o.className || ''),
    items: parse_(o.items, []), minutes: Number(o.minutes) || 0,
    showMs: bool_(o.showMs), allowResubmit: bool_(o.allowResubmit), open: bool_(o.open),
    createdAt: String(o.createdAt || ''), instructions: String(o.instructions || '')
  };
}

/** Quiz codes are matched without regard to case, so students can type "k7qm2p". */
function findQuiz_(id) {
  var want = String(id || '').trim().toUpperCase();
  if (!want) return null;
  var t = rows_(SHEET_QUIZZES);
  for (var i = 0; i < t.list.length; i++) if (String(t.list[i].obj.id).toUpperCase() === want) return t.list[i];
  return null;
}

/** Six characters with no look-alikes (no 0/O, 1/I/L), unique among existing quizzes. */
function newQuizCode_(t) {
  var abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', taken = {};
  t.list.forEach(function (r) { taken[String(r.obj.id).toUpperCase()] = 1; });
  for (var tries = 0; tries < 50; tries++) {
    var c = '';
    for (var i = 0; i < 6; i++) c += abc.charAt(Math.floor(Math.random() * abc.length));
    if (!taken[c]) return c;
  }
  fail_('server_error');
}

function subOut_(o, forTeacher) {
  var out = {
    quizId: String(o.quizId), name: String(o.name), attempt: Number(o.attempt) || 0,
    status: String(o.status), score: o.score === '' ? null : Number(o.score), max: Number(o.max) || 0,
    submittedAt: String(o.submittedAt || ''), returnedAt: String(o.returnedAt || ''),
    answers: parse_(o.answers, {}), feedback: parse_(o.feedback, null), history: parse_(o.history, []),
    elapsed: Number(o.elapsed) || 0
  };
  if (forTeacher) { out.studentKey = String(o.studentKey); out.seenAt = String(o.seenAt || ''); }
  return out;
}

/** Keeps only {itemId: {partIndex: text}} with bounded sizes. */
function cleanAnswers_(answers, itemIds) {
  var out = {}, total = 0;
  if (!answers || typeof answers !== 'object') return out;
  itemIds.forEach(function (id) {
    var a = answers[id];
    if (!a || typeof a !== 'object') return;
    var o = {};
    Object.keys(a).slice(0, 20).forEach(function (k) {
      if (!/^\d{1,2}$/.test(k)) return;
      var s = str_(a[k], LIMITS.answerLen);
      total += s.length;
      o[k] = s;
    });
    out[id] = o;
  });
  if (total > LIMITS.answersTotal) fail_('answers_too_long');
  return out;
}

/* ---------------------------------------------------------------- actions */

var ACTIONS = {};
var TEACHER_ACTIONS = { listQuizzes: 1, saveQuiz: 1, deleteQuiz: 1, listSubs: 1, saveFeedback: 1, checkKey: 1 };

ACTIONS.ping = function () { return { ok: true }; };

ACTIONS.checkKey = function () { return { ok: true }; };

/* --- student --- */

ACTIONS.getQuiz = function (req) {
  var q = findQuiz_(req.id);
  if (!q) fail_('no_quiz');
  return { ok: true, quiz: quizOut_(q.obj) };
};

ACTIONS.submit = function (req) {
  return withLock_(function () {
    var q = findQuiz_(req.quizId);
    if (!q) fail_('no_quiz');
    var quiz = quizOut_(q.obj);
    if (!quiz.open) fail_('closed');
    var name = str_(req.name, LIMITS.nameLen).trim();
    var key = studentKey_(name);
    var pin = String(req.pin || '');
    if (!key) fail_('no_name');
    if (!/^\d{4,8}$/.test(pin)) fail_('bad_pin');
    var hash = hashPin_(quiz.id, key, pin);
    var answers = cleanAnswers_(req.answers, quiz.items);

    var t = rows_(SHEET_SUBS), existing = null, count = 0;
    t.list.forEach(function (r) {
      if (String(r.obj.quizId) !== quiz.id) return;
      count++;
      if (String(r.obj.studentKey) === key) existing = r;
    });

    var rec;
    if (existing) {
      rec = existing.obj;
      if (rec.pinHash !== hash) fail_('pin_mismatch');
      var st = String(rec.status);
      if ((st === 'returned' || st === 'marking') && !quiz.allowResubmit) fail_('no_resubmit');
      var hist = parse_(rec.history, []);
      if (st === 'returned') {
        hist.push({ attempt: Number(rec.attempt) || 1, answers: parse_(rec.answers, {}),
                    feedback: parse_(rec.feedback, null), score: rec.score, submittedAt: rec.submittedAt });
        while (hist.length > LIMITS.history) hist.shift();
        // A sheet cell holds at most 50,000 characters.
        while (hist.length && JSON.stringify(hist).length > 45000) hist.shift();
        rec.attempt = (Number(rec.attempt) || 1) + 1;
        rec.feedback = '';
        rec.score = '';
        rec.returnedAt = '';
      }
      rec.history = JSON.stringify(hist);
      rec.status = (Number(rec.attempt) || 1) > 1 ? 'resubmitted' : 'submitted';
    } else {
      if (count >= LIMITS.subsPerQuiz) fail_('quiz_full');
      rec = { quizId: quiz.id, studentKey: key, name: name, pinHash: hash, attempt: 1, status: 'submitted',
              score: '', max: '', returnedAt: '', feedback: '', history: '[]', seenAt: '' };
    }
    rec.answers = JSON.stringify(answers);
    rec.submittedAt = now_();
    rec.elapsed = Math.max(0, Math.min(86400, Number(req.elapsed) || 0));
    writeRow_(t, existing ? existing.row : null, rec);
    return { ok: true, sub: subOut_(rec, false) };
  });
};

/** A student's own record. Unknown name → {ok:true, sub:null}; wrong PIN → error. */
ACTIONS.myStatus = function (req) {
  var q = findQuiz_(req.quizId);
  if (!q) fail_('no_quiz');
  var quizId = String(q.obj.id);
  var key = studentKey_(req.name);
  var pin = String(req.pin || '');
  if (!key || !/^\d{4,8}$/.test(pin)) fail_('bad_pin');
  var t = rows_(SHEET_SUBS);
  for (var i = 0; i < t.list.length; i++) {
    var o = t.list[i].obj;
    if (String(o.quizId) === quizId && String(o.studentKey) === key) {
      if (o.pinHash !== hashPin_(quizId, key, pin)) fail_('pin_mismatch');
      var out = subOut_(o, false);
      if (out.status !== 'returned') { out.feedback = null; out.score = null; }
      return { ok: true, sub: out };
    }
  }
  return { ok: true, sub: null };
};

/* --- teacher --- */

ACTIONS.listQuizzes = function () {
  var qs = rows_(SHEET_QUIZZES).list.map(function (r) { return quizOut_(r.obj); });
  var counts = {};
  rows_(SHEET_SUBS).list.forEach(function (r) {
    var id = String(r.obj.quizId), st = String(r.obj.status);
    var c = counts[id] || (counts[id] = { total: 0, waiting: 0, returned: 0 });
    c.total++;
    if (st === 'returned') c.returned++; else c.waiting++;
  });
  qs.forEach(function (q) { q.counts = counts[q.id] || { total: 0, waiting: 0, returned: 0 }; });
  qs.reverse();
  return { ok: true, quizzes: qs };
};

ACTIONS.saveQuiz = function (req) {
  return withLock_(function () {
    var q = req.quiz || {};
    var items = Array.isArray(q.items) ? q.items.map(String).filter(function (s) { return /^[A-Z0-9-]{2,12}$/.test(s); }) : [];
    if (!items.length) fail_('no_items');
    if (items.length > LIMITS.itemsPerQuiz) fail_('too_many_items');
    var t = rows_(SHEET_QUIZZES), existing = null;
    if (q.id) t.list.forEach(function (r) { if (String(r.obj.id) === String(q.id)) existing = r; });
    var rec = existing ? existing.obj : { id: newQuizCode_(t), createdAt: now_() };
    rec.title = str_(q.title, LIMITS.titleLen) || 'Untitled quiz';
    rec.className = str_(q.className, 60);
    rec.items = JSON.stringify(items);
    rec.minutes = Math.max(0, Math.min(300, Number(q.minutes) || 0));
    rec.showMs = !!q.showMs;
    rec.allowResubmit = q.allowResubmit !== false;
    rec.open = q.open !== false;
    rec.instructions = str_(q.instructions, 1000);
    writeRow_(t, existing ? existing.row : null, rec);
    return { ok: true, quiz: quizOut_(rec) };
  });
};

ACTIONS.deleteQuiz = function (req) {
  return withLock_(function () {
    var q = findQuiz_(req.id);
    if (!q) fail_('no_quiz');
    q.obj.open = false;
    // Soft delete: closes the quiz and hides it; rows stay in the sheet for your records.
    q.obj.className = '[archived] ' + String(q.obj.className || '').replace(/^\[archived\] /, '');
    writeRow_(rows_(SHEET_QUIZZES), q.row, q.obj);
    return { ok: true };
  });
};

ACTIONS.listSubs = function (req) {
  var subs = rows_(SHEET_SUBS).list
    .filter(function (r) { return String(r.obj.quizId) === String(req.quizId); })
    .map(function (r) { return subOut_(r.obj, true); });
  return { ok: true, subs: subs, at: now_() };
};

/**
 * req.feedback = {parts: {itemId: {partIndex: {marks, comment}}}, overall, items: {itemId: comment}}
 * req.status   = 'marking' (draft, hidden from student) or 'returned'
 */
ACTIONS.saveFeedback = function (req) {
  return withLock_(function () {
    var t = rows_(SHEET_SUBS), target = null;
    t.list.forEach(function (r) {
      if (String(r.obj.quizId) === String(req.quizId) && String(r.obj.studentKey) === String(req.studentKey)) target = r;
    });
    if (!target) fail_('no_sub');
    var rec = target.obj;
    // The student changed their answers after the teacher opened them: make the teacher reload first.
    if (req.submittedAt && String(req.submittedAt) !== String(rec.submittedAt)) fail_('stale_answers');
    var fb = req.feedback || {};
    var clean = { parts: {}, items: {}, overall: str_(fb.overall, LIMITS.commentLen) };
    var score = 0;
    Object.keys(fb.parts || {}).slice(0, LIMITS.itemsPerQuiz).forEach(function (id) {
      var p = fb.parts[id] || {};
      clean.parts[id] = {};
      Object.keys(p).slice(0, 20).forEach(function (k) {
        if (!/^\d{1,2}$/.test(k)) return;
        var m = p[k] || {};
        var marks = (m.marks === '' || m.marks === null || m.marks === undefined) ? null : Math.max(0, Math.min(99, Number(m.marks) || 0));
        if (marks !== null) score += marks;
        clean.parts[id][k] = { marks: marks, comment: str_(m.comment, LIMITS.commentLen) };
      });
    });
    Object.keys(fb.items || {}).slice(0, LIMITS.itemsPerQuiz).forEach(function (id) {
      clean.items[id] = str_(fb.items[id], LIMITS.commentLen);
    });
    rec.feedback = JSON.stringify(clean);
    rec.score = score;
    rec.max = Math.max(0, Number(req.max) || 0);
    rec.status = req.status === 'returned' ? 'returned' : 'marking';
    rec.returnedAt = rec.status === 'returned' ? now_() : '';
    writeRow_(t, target.row, rec);
    return { ok: true, sub: subOut_(rec, true) };
  });
};
