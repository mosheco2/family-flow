#!/usr/bin/env node
/**
 * build.js — בונה את public/comic.html כקובץ HTML יחיד, עצמאי לחלוטין.
 *
 * קורא את public/comic-pages/01.* .. 20.*, מזהה סוג ומידות אמיתיות,
 * מקודד base64 ומזריק לתוך תבנית. אין תלויות חיצוניות, אין CDN.
 *
 * הרצה:  node build.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'public', 'comic-pages');
const OUT_FILE = path.join(__dirname, 'public', 'comic.html');
const PAGE_COUNT = 20;
const CHARACTER_PAGES = 4; // 01-04 הן תמונות דמות על רקע לבן

// ---------------------------------------------------------------------------
// זיהוי פורמט ומידות — הקבצים נושאים סיומת .png אך חלקם JPEG בפועל,
// לכן מזהים לפי magic bytes ולא לפי הסיומת.
// ---------------------------------------------------------------------------

function sniff(buf) {
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    return 'png';
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

function pngSize(buf) {
  // IHDR הוא תמיד ה-chunk הראשון: אורך(4) + "IHDR"(4) + width(4) + height(4)
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  let off = 2; // אחרי SOI
  while (off + 3 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }        // דילוג על ריפוד
    const marker = buf[off + 1];
    if (marker === 0xff) { off++; continue; }           // fill bytes
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;                                         // סמנים ללא payload
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;      // SOS / EOI — אין יותר מידות
    const len = buf.readUInt16BE(off + 2);
    // SOFn נושא את המידות (למעט DHT=c4, JPG=c8, DAC=cc)
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  return null;
}

function webpSize(buf) {
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  if (fourcc === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

function resolveSource(index) {
  const stem = String(index).padStart(2, '0');
  for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'PNG', 'JPG', 'JPEG', 'WEBP']) {
    const candidate = path.join(SRC_DIR, `${stem}.${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`לא נמצאה תמונה לעמוד ${stem} בתיקייה ${SRC_DIR}`);
}

function loadPages() {
  const pages = [];
  for (let i = 1; i <= PAGE_COUNT; i++) {
    const file = resolveSource(i);
    const buf = fs.readFileSync(file);
    const kind = sniff(buf);
    if (!kind) throw new Error(`פורמט תמונה לא מזוהה: ${file}`);
    const size = kind === 'png' ? pngSize(buf) : kind === 'jpeg' ? jpegSize(buf) : webpSize(buf);
    if (!size || !size.width || !size.height) throw new Error(`לא הצלחתי לקרוא מידות מ-${file}`);
    pages.push({
      n: i,
      file,
      kind,
      isCharacter: i <= CHARACTER_PAGES,
      width: size.width,
      height: size.height,
      bytes: buf.length,
      dataUri: `data:${MIME[kind]};base64,${buf.toString('base64')}`,
    });
  }
  return pages;
}

// ---------------------------------------------------------------------------
// תבנית ה-HTML
// ---------------------------------------------------------------------------

function renderHtml(pages) {
  // מניפסט קומפקטי: רוחב, גובה, ודגל "כרטיס דמות"
  const manifest = pages.map((p) => [p.width, p.height, p.isCharacter ? 1 : 0]);

  // כל תמונה יושבת ב-<template> — התוכן לא נטען/מפוענח ע"י הדפדפן עד
  // שהעמוד נכנס לחלון הטעינה ואנחנו שולפים את ה-data URI ידנית.
  const imageBank = pages
    .map((p) => `<template class="pg" data-n="${p.n}">${p.dataUri}</template>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#07070a">
<title>עלילות השקרבוטים בעולם הגדול — פרק 2: קומנדו נהוראי בכריתים</title>
<style>
:root{
  --bg:#07070a;
  --ink:#f4f1ea;
  --muted:#8a8a98;
  --accent:#d9b26a;
  --flip-ms:560ms;
  --flip-ease:cubic-bezier(.22,.61,.28,1);
  --sat:env(safe-area-inset-top,0px);
  --sab:env(safe-area-inset-bottom,0px);
  --sal:env(safe-area-inset-left,0px);
  --sar:env(safe-area-inset-right,0px);
}

*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}

html,body{
  margin:0;padding:0;height:100%;width:100%;
  overflow:hidden;overscroll-behavior:none;
  background:var(--bg);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  touch-action:none;
  -webkit-user-select:none;user-select:none;
}

#app{
  position:fixed;inset:0;
  background:radial-gradient(120% 90% at 50% 6%,#15151f 0%,var(--bg) 62%);
}

/* ---------------- מסך טעינה ---------------- */
#loader{
  position:fixed;inset:0;z-index:90;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;
  background:var(--bg);transition:opacity .45s ease;
}
#loader.gone{opacity:0;pointer-events:none}
#loader .series{
  font-size:clamp(11px,3.2vw,13px);font-weight:600;color:var(--muted);
  letter-spacing:.12em;text-align:center;padding:0 24px;
}
#loader h1{
  margin:0;font-size:clamp(20px,6.4vw,32px);font-weight:800;color:var(--accent);
  text-align:center;padding:0 24px;line-height:1.25;
}
#loader .bar{width:min(62vw,260px);height:3px;border-radius:3px;background:#22222e;overflow:hidden}
#loader .bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .16s linear}
#loader .pct{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;direction:ltr}

/* ---------------- הבמה ----------------
   #stage מחזיק את ה-perspective. .leaf מרכז את הגיליון ומעביר את
   ה-3D הלאה (preserve-3d), כך שהסיבוב חל על הגיליון עצמו והציר
   יושב על שפת הנייר — לא על שפת המסך.
   pointer-events:none — כל המגע נתפס ע"י #zones שמתחת.            */
#stage{
  position:absolute;z-index:15;
  top:calc(var(--sat) + 10px);
  bottom:calc(var(--sab) + 34px);
  left:calc(var(--sal) + 10px);
  right:calc(var(--sar) + 10px);
  perspective:1500px;
  perspective-origin:50% 50%;
  pointer-events:none;
}

.leaf{
  position:absolute;inset:0;
  display:flex;align-items:center;justify-content:center;
  transform-style:preserve-3d;
}
.leaf[hidden]{display:none}
.leaf.under{z-index:4}
.leaf.rest{z-index:5}
.leaf.turning{z-index:6}

/* הגיליון = "הנייר". הוא הדבר שמסתובב. */
.sheet{
  position:relative;
  max-width:100%;max-height:100%;
  display:flex;align-items:center;justify-content:center;
  backface-visibility:hidden;
  transform-origin:left center;   /* ציר בשפה — נקבע דינמית לפי הכיוון */
  filter:drop-shadow(0 16px 32px rgba(0,0,0,.62));
}
.sheet.settling{transition:transform var(--flip-ms) var(--flip-ease)}
.sheet.moving{will-change:transform}

.sheet img{
  display:block;
  max-width:100%;max-height:100%;
  width:auto;height:auto;
  object-fit:contain;
  border-radius:6px;
}

/* עמודי דמות 1-4: כרטיס לבן מכוון, לא מלבן לבן צף */
.sheet.card{
  background:#fff;
  border-radius:22px;
  padding:14px;
  filter:none;
  box-shadow:0 22px 46px rgba(0,0,0,.62),0 1px 0 rgba(255,255,255,.6) inset;
}
.sheet.card img{border-radius:12px}

/* צל דינמי שנע לאורך ההיפוך */
.gloss{
  position:absolute;inset:0;pointer-events:none;
  border-radius:inherit;
  opacity:0;
  background:linear-gradient(var(--gdir,90deg),rgba(0,0,0,.66),rgba(0,0,0,.06) 58%,rgba(0,0,0,0) 78%);
}

/* ---------------- שער וסיום ---------------- */
.sheet.plate{
  width:100%;height:100%;
  flex-direction:column;gap:22px;text-align:center;padding:26px;
  background:linear-gradient(165deg,#1b1b27 0%,#0c0c12 58%,#141420 100%);
  border-radius:16px;filter:none;
  box-shadow:0 18px 40px rgba(0,0,0,.6),0 0 0 1px rgba(217,178,106,.16) inset;
}
.plate .kicker{font-size:12px;letter-spacing:.34em;color:var(--accent);opacity:.85}
.plate .series{
  font-size:clamp(12px,3.6vw,15px);font-weight:700;letter-spacing:.1em;
  color:var(--muted);line-height:1.5;max-width:16em;
}
.plate .chapter{
  font-size:12px;font-weight:800;letter-spacing:.22em;color:var(--accent);
  padding:5px 14px;border-radius:999px;
  border:1px solid rgba(217,178,106,.35);background:rgba(217,178,106,.08);
}
.plate h2{
  margin:0;font-size:clamp(28px,9.5vw,52px);font-weight:900;line-height:1.14;
  max-width:11em;
  background:linear-gradient(180deg,#fff 8%,var(--accent) 116%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.plate .rule{width:54px;height:2px;border-radius:2px;background:var(--accent);opacity:.7}
.plate .names{display:flex;flex-wrap:wrap;gap:8px 10px;justify-content:center;max-width:22em}
.plate .names span{
  font-size:clamp(14px,4.4vw,18px);font-weight:700;color:var(--ink);
  padding:7px 15px;border-radius:999px;
  background:rgba(255,255,255,.06);border:1px solid rgba(217,178,106,.26);
}
.plate .hint{font-size:13px;color:var(--muted);line-height:1.7}
.plate .hint b{color:var(--ink);font-weight:700}

.btn{
  appearance:none;border:0;cursor:pointer;font:inherit;
  font-size:16px;font-weight:800;color:#141018;
  padding:14px 30px;border-radius:999px;
  background:linear-gradient(180deg,#f0d79c,var(--accent));
  box-shadow:0 10px 22px rgba(217,178,106,.26);
  pointer-events:auto;               /* חורג מ-pointer-events:none של הבמה */
}
.btn:active{transform:translateY(1px)}
.btn.ghost{
  background:transparent;color:var(--muted);
  border:1px solid rgba(255,255,255,.18);box-shadow:none;
  font-size:14px;font-weight:600;padding:10px 20px;
}

/* ---------------- אזורי מגע ---------------- */
#zones{position:absolute;inset:0;z-index:10;display:flex}
#zones>div{flex:1}

/* ---------------- ממשק ---------------- */
#chrome{
  position:absolute;z-index:20;left:0;right:0;bottom:0;
  padding-bottom:calc(var(--sab) + 8px);
  display:flex;flex-direction:column;align-items:center;gap:8px;
  transition:opacity .38s ease,transform .38s ease;
  pointer-events:none;
}
#chrome.hidden{opacity:0;transform:translateY(8px)}
#counter{
  font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;
  letter-spacing:.08em;
  /* ltr כדי ש-"7 / 20" לא יתהפך ל-"20 / 7" ע"י אלגוריתם ה-bidi */
  direction:ltr;
  background:rgba(8,8,12,.6);padding:4px 12px;border-radius:999px;
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
}
#progress{width:100%;height:2px;background:rgba(255,255,255,.09);position:relative}
/* RTL: ההתקדמות ממלאת מימין לשמאל */
#progress i{
  position:absolute;top:0;right:0;height:100%;width:0;
  background:var(--accent);transition:width .32s var(--flip-ease);
}

/* שכבת "התחל מחדש" בחזרה לאמצע */
#resume{
  position:absolute;z-index:30;left:0;right:0;
  top:calc(var(--sat) + 12px);
  display:flex;justify-content:center;
  pointer-events:none;transition:opacity .4s ease;
}

/* ---------------- העדפת פחות תנועה ---------------- */
@media (prefers-reduced-motion:reduce){
  .sheet.settling{transition:opacity 200ms ease}
  .gloss{display:none}
}
</style>
</head>
<body>

<div id="app">
  <div id="zones">
    <div data-dir="next"></div>
    <div data-dir="toggle"></div>
    <div data-dir="prev"></div>
  </div>

  <div id="stage" aria-live="polite"></div>

  <div id="resume"></div>

  <div id="chrome">
    <div id="counter">&nbsp;</div>
    <div id="progress"><i></i></div>
  </div>
</div>

<div id="loader">
  <div class="series">עלילות השקרבוטים בעולם הגדול</div>
  <h1>קומנדו נהוראי בכריתים</h1>
  <div class="bar"><i id="loadbar"></i></div>
  <div class="pct" id="loadpct">0%</div>
</div>

${imageBank}

<script>
(function(){
'use strict';

/* ===========================================================
   נתונים
   =========================================================== */
var PAGES = ${JSON.stringify(manifest)};        // [w, h, isCharacter]
var TOTAL = PAGES.length;
var NAMES = ['כפיר','אורון','חגיגי','מושיק'];
var STORE_KEY = 'greece-comic-position-v1';

var COVER = 0;                 // שער
var END   = TOTAL + 1;         // מסך סיום
var LAST  = END;

var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

var stage   = document.getElementById('stage');
var zones   = document.getElementById('zones');
var chromeE = document.getElementById('chrome');
var counter = document.getElementById('counter');
var bar     = document.querySelector('#progress i');
var resumeE = document.getElementById('resume');
var loader  = document.getElementById('loader');
var loadbar = document.getElementById('loadbar');
var loadpct = document.getElementById('loadpct');

/* ===========================================================
   מאגר תמונות — data URI נשלף מה-<template> רק לפי דרישה
   =========================================================== */
var srcCache = {};
function srcFor(n){
  if (srcCache[n] !== undefined) return srcCache[n];
  var t = document.querySelector('template.pg[data-n="' + n + '"]');
  srcCache[n] = t ? t.innerHTML.trim() : '';
  return srcCache[n];
}

var warmed = {};
function preload(n){
  if (n < 1 || n > TOTAL || warmed[n]) return;
  warmed[n] = true;
  var im = new Image();
  im.src = srcFor(n);
  if (im.decode) { im.decode().catch(function(){}); }
}

/* ===========================================================
   בניית עמודים
   =========================================================== */
function gloss(){
  var g = document.createElement('div');
  g.className = 'gloss';
  return g;
}

/* התאמת קופסת הגיליון למידות האמיתיות של העמוד.
   נמדד ב-JS ולא ב-CSS: aspect-ratio לבדו לא מספיק כאן, כי כשמצמידים
   ציר אחד ל-100% והשני נחתך ע"י max, הקופסה מפסיקה לשמור על היחס
   ואז נוצר "מלבן לבן" סביב התמונה בכרטיסי הדמויות. */
var CARD_PAD = 14;      // תואם ל-padding של .sheet.card
var CARD_FIT = 0.92;    // כרטיס הדמות מעט קטן מהמסך, כדי שייראה ככרטיס

function fitSheet(sheet, w, h, isCard){
  var sw = stage.clientWidth, sh = stage.clientHeight;
  if (!sw || !sh) return;
  var pad = isCard ? CARD_PAD * 2 : 0;
  var room = isCard ? CARD_FIT : 1;
  var scale = Math.min((sw * room - pad) / w, (sh * room - pad) / h);
  if (!(scale > 0)) return;
  sheet.style.width  = Math.round(w * scale + pad) + 'px';
  sheet.style.height = Math.round(h * scale + pad) + 'px';
}

function fitAll(){
  Object.keys(cache).forEach(function(k){
    var i = Number(k);
    if (i === COVER || i === END) return;
    var m = PAGES[i - 1];
    fitSheet(sheetOf(cache[i]), m[0], m[1], !!m[2]);
  });
}

function buildSheet(index){
  var m = PAGES[index - 1];
  var w = m[0], h = m[1], isCard = !!m[2];

  var sheet = document.createElement('div');
  sheet.className = 'sheet' + (isCard ? ' card' : '');
  fitSheet(sheet, w, h, isCard);

  var img = document.createElement('img');
  img.decoding = 'async';
  img.draggable = false;
  img.alt = 'עמוד ' + index;
  img.src = srcFor(index);
  sheet.appendChild(img);
  sheet.appendChild(gloss());
  return sheet;
}

function namesHtml(){
  return '<div class="names">' + NAMES.map(function(n){
    return '<span>' + n + '</span>';
  }).join('') + '</div>';
}

function buildCover(){
  var s = document.createElement('div');
  s.className = 'sheet plate';
  s.innerHTML =
    '<div class="series">עלילות השקרבוטים בעולם הגדול</div>' +
    '<div class="chapter">פרק 2</div>' +
    '<h2>קומנדו נהוראי בכריתים</h2>' +
    '<div class="rule"></div>' +
    namesHtml() +
    '<div class="hint">החלק <b>משמאל לימין</b> כדי להתקדם</div>';
  s.appendChild(gloss());
  return s;
}

function buildEnd(){
  var s = document.createElement('div');
  s.className = 'sheet plate';
  s.innerHTML =
    '<div class="kicker">סוף פרק 2</div>' +
    '<h2>קומנדו נהוראי בכריתים</h2>' +
    '<div class="rule"></div>' +
    '<div class="series">עלילות השקרבוטים בעולם הגדול</div>' +
    namesHtml();

  var b = document.createElement('button');
  b.className = 'btn';
  b.type = 'button';
  b.textContent = 'לקרוא שוב מהתחלה';
  b.addEventListener('click', function(e){ e.stopPropagation(); restart(); });
  s.appendChild(b);
  s.appendChild(gloss());
  return s;
}

function buildLeaf(index){
  var leaf = document.createElement('div');
  leaf.className = 'leaf';
  leaf.hidden = true;
  if (index === COVER)     leaf.appendChild(buildCover());
  else if (index === END)  leaf.appendChild(buildEnd());
  else                     leaf.appendChild(buildSheet(index));
  return leaf;
}

/* ===========================================================
   מצב + ציור
   רק prev/current/next חיים ב-DOM; מטמון קטן מונע בנייה חוזרת.
   =========================================================== */
var current = COVER;
var cache = {};        // index -> leaf element (מנותק או מחובר)
var CACHE_SPAN = 2;    // שומרים ±2 בזיכרון, מציגים ±1

function leafFor(index){
  if (index < COVER || index > LAST) return null;
  if (!cache[index]) cache[index] = buildLeaf(index);
  return cache[index];
}

function sheetOf(leaf){ return leaf.firstElementChild; }

function render(){
  var live = [current - 1, current, current + 1];

  Object.keys(cache).forEach(function(k){
    var i = Number(k);
    var el = cache[i];
    if (live.indexOf(i) === -1 && el.parentNode) stage.removeChild(el);
    if (Math.abs(i - current) > CACHE_SPAN) delete cache[i];   // שחרור זיכרון
  });

  live.forEach(function(i){
    var el = leafFor(i);
    if (!el) return;
    if (!el.parentNode) stage.appendChild(el);
    el.hidden = (i !== current);
    el.className = 'leaf' + (i === current ? ' rest' : '');
    resetSheet(sheetOf(el));
  });

  fitAll();
  preload(current + 1);   // preload של הבא ברקע
  preload(current - 1);

  paintChrome();
  save();
}

function resetSheet(sh){
  if (!sh) return;
  sh.classList.remove('settling','moving');
  sh.style.transform = '';
  var g = sh.querySelector('.gloss');
  if (g) g.style.opacity = 0;
}

function paintChrome(){
  if (current === COVER)    counter.textContent = 'שער';
  else if (current === END) counter.textContent = 'סוף';
  else                      counter.textContent = current + ' / ' + TOTAL;
  bar.style.width = (current / LAST * 100).toFixed(2) + '%';
}

/* ===========================================================
   שמירת מיקום
   =========================================================== */
function save(){
  try { localStorage.setItem(STORE_KEY, String(current)); } catch(e){}
}
function load(){
  try {
    var v = parseInt(localStorage.getItem(STORE_KEY), 10);
    if (isNaN(v) || v < COVER || v > LAST) return COVER;
    return v;
  } catch(e){ return COVER; }
}
function restart(){
  hideResume();
  if (current === COVER){ wake(); return; }
  current = COVER;
  render();
  wake();
}

/* ===========================================================
   ההיפוך — כמו ספר עברי
   הכריכה מימין, העמוד הבא נמצא משמאל. מחליקים משמאל לימין:
   התופסים את השפה השמאלית החופשית ומסובבים אותה ימינה סביב
   הציר הימני. לכן transform-origin: right ו-rotateY חיובי.
   הסיבוב עוצר ב-90°, שם הנייר ניצב למסך (רוחב אפס) ונעלם בלי
   קפיצה בזכות backface-visibility — משם העמוד שמתחת חשוף.
   =========================================================== */
var MAXDEG = 90;
var busy = false;

function angleAt(dir, t){
  return dir === 'next' ? MAXDEG * t : MAXDEG * (1 - t);
}

function beginTurn(dir){
  if (busy) return null;
  var target = dir === 'next' ? current + 1 : current - 1;
  if (target < COVER || target > LAST) return null;

  var moverLeaf = leafFor(dir === 'next' ? current : target);
  var underLeaf = leafFor(dir === 'next' ? target  : current);
  if (!moverLeaf || !underLeaf) return null;

  [moverLeaf, underLeaf].forEach(function(el){
    if (!el.parentNode) stage.appendChild(el);
  });

  underLeaf.hidden = false;
  underLeaf.className = 'leaf under';
  resetSheet(sheetOf(underLeaf));

  moverLeaf.hidden = false;
  moverLeaf.className = 'leaf turning';

  var sh = sheetOf(moverLeaf);
  sh.classList.add('moving');
  // הציר תמיד בשפה הימנית — שם "נכרך" הספר. שני הכיוונים נעים על
  // אותו מסלול, אחד הפוך לשני.
  sh.style.transformOrigin = 'right center';

  var g = sh.querySelector('.gloss');
  if (g) g.style.setProperty('--gdir', '270deg');   // כהה ליד הכריכה

  return { dir: dir, target: target, sheet: sh, gloss: g, mover: moverLeaf, under: underLeaf };
}

function paint(turn, t){
  var deg = angleAt(turn.dir, t);
  var p = turn.dir === 'next' ? t : 1 - t;          // 0 = שטוח, 1 = ניצב
  // הרמה קלה מהמשטח — נותן עומק לתחושת הנייר
  var lift = Math.sin(Math.PI * Math.min(p, 1) * 0.5) * 22;
  turn.sheet.style.transform = 'translateZ(' + lift.toFixed(2) + 'px) rotateY(' + deg.toFixed(2) + 'deg)';
  if (turn.gloss) turn.gloss.style.opacity = (p * 0.9).toFixed(3);
}

function settle(turn, complete){
  busy = true;

  function done(){
    turn.sheet.removeEventListener('transitionend', done);
    clearTimeout(turn._guard);
    if (complete) current = turn.target;
    busy = false;
    render();
    if (complete) preload(turn.dir === 'next' ? current + 1 : current - 1);
  }

  if (reduced){                       // פחות תנועה: בלי היפוך, מעבר מיידי/דהייה
    resetSheet(turn.sheet);
    done();
    return;
  }

  turn.sheet.classList.add('settling');
  turn.sheet.addEventListener('transitionend', done);
  void turn.sheet.offsetWidth;        // מכריח reflow כדי שה-transition ייקלט
  paint(turn, complete ? 1 : 0);
  turn._guard = setTimeout(function(){ if (busy) done(); }, 1000);   // רשת ביטחון
}

function go(dir){
  if (busy) return;
  wake();
  var turn = beginTurn(dir);
  if (!turn) return;
  if (reduced){ current = turn.target; busy = false; render(); return; }
  paint(turn, 0);
  settle(turn, true);
}

/* ===========================================================
   גרירה — הנייר עוקב אחרי האצבע
   =========================================================== */
var THRESHOLD = 0.40;   // פחות מ-40% → חוזר אחורה
var SLOP = 12;
var drag = null;
var swallowClick = false;

function px(e){ return e.touches ? e.touches[0].clientX : e.clientX; }
function py(e){ return e.touches ? e.touches[0].clientY : e.clientY; }

function onDown(e){
  if (busy || drag) return;
  drag = { x0: px(e), y0: py(e), turn: null, locked: false, t: 0, moved: false, dir: null };
}

function onMove(e){
  if (!drag || busy) return;
  var dx = px(e) - drag.x0;
  var dy = py(e) - drag.y0;

  if (!drag.locked){
    if (Math.abs(dx) < SLOP || Math.abs(dx) <= Math.abs(dy)) return;
    drag.locked = true;
    drag.moved = true;
    // ספר עברי: אצבע משמאל לימין = העמוד הבא
    drag.dir = dx > 0 ? 'next' : 'prev';
    if (!reduced){
      drag.turn = beginTurn(drag.dir);
      if (!drag.turn){ drag.dir = null; return; }
    }
    wake();
  }

  if (e.cancelable) e.preventDefault();
  if (!drag.turn) return;

  var span = Math.max(window.innerWidth * 0.82, 1);
  var raw = drag.turn.dir === 'next' ? dx : -dx;
  drag.t = Math.min(Math.max(raw / span, 0), 1);
  paint(drag.turn, drag.t);
}

function onUp(){
  if (!drag) return;
  var d = drag;
  drag = null;

  if (d.moved){
    swallowClick = true;                      // אחרי גרירה — לא לספור כהקשה
    setTimeout(function(){ swallowClick = false; }, 350);
  }

  if (reduced && d.dir){ go(d.dir); return; }
  if (!d.turn) return;
  settle(d.turn, d.t >= THRESHOLD);
}

zones.addEventListener('touchstart', onDown, {passive:true});
window.addEventListener('touchmove', onMove, {passive:false});
window.addEventListener('touchend', onUp, {passive:true});
window.addEventListener('touchcancel', onUp, {passive:true});

zones.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', function(e){ if (drag) onMove(e); });
window.addEventListener('mouseup', onUp);

/* ===========================================================
   הקשה על שלישים
   קדימה = ימינה, ולכן השליש הימני = הבא, השמאלי = הקודם,
   האמצעי = הצגה/הסתרה של הממשק.
   (ב-dir=rtl הילד הראשון של ה-flex יושב מימין)
   =========================================================== */
zones.addEventListener('click', function(e){
  if (swallowClick){ swallowClick = false; return; }
  var z = e.target.getAttribute && e.target.getAttribute('data-dir');
  if (!z) return;
  if (z === 'toggle'){ toggleChrome(); return; }
  go(z);
});

/* ===========================================================
   מקלדת — ספר עברי: קדימה = ימינה, ולכן חץ ימין = הבא
   =========================================================== */
window.addEventListener('keydown', function(e){
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' '){ e.preventDefault(); go('next'); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp'){ e.preventDefault(); go('prev'); }
  else if (e.key === 'Home'){ e.preventDefault(); restart(); }
});

/* ===========================================================
   ממשק שנעלם אחרי 3 שניות
   =========================================================== */
var idle = null;
function wake(){
  chromeE.classList.remove('hidden');
  clearTimeout(idle);
  idle = setTimeout(function(){ chromeE.classList.add('hidden'); }, 3000);
}
function toggleChrome(){
  if (chromeE.classList.contains('hidden')) wake();
  else chromeE.classList.add('hidden');
}

/* סיבוב מסך / שינוי גודל — מודדים מחדש את קופסאות העמודים */
function relayout(){ fitAll(); paintChrome(); }
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', function(){ setTimeout(relayout, 140); });

/* חסימת זום/bounce. אין כאן שום ניווט חיצוני — בטוח בתוך IFRAME. */
document.addEventListener('gesturestart', function(e){ e.preventDefault(); });
document.addEventListener('dblclick', function(e){ e.preventDefault(); });
document.addEventListener('contextmenu', function(e){ e.preventDefault(); });

/* ===========================================================
   "התחל מחדש" כשחוזרים לאמצע
   =========================================================== */
var resumeTimer = null;
function showResume(){
  var b = document.createElement('button');
  b.className = 'btn ghost';
  b.type = 'button';
  b.textContent = 'התחל מחדש';
  b.addEventListener('click', function(e){ e.stopPropagation(); restart(); });
  resumeE.appendChild(b);
  resumeE.style.opacity = '1';
  resumeTimer = setTimeout(hideResume, 5000);
}
function hideResume(){
  clearTimeout(resumeTimer);
  if (!resumeE.firstChild) return;
  resumeE.style.opacity = '0';
  setTimeout(function(){ resumeE.innerHTML = ''; }, 420);
}

/* ===========================================================
   עלייה
   =========================================================== */
var resumeTo = load();
var booted = false;

function boot(){
  var first = [];
  for (var i = Math.max(1, resumeTo - 1); i <= Math.min(TOTAL, resumeTo + 1); i++) first.push(i);
  if (first.indexOf(1) === -1) first.unshift(1);

  var loaded = 0, need = first.length;
  function tick(){
    loaded++;
    var pct = Math.round(loaded / need * 100);
    loadbar.style.width = pct + '%';
    loadpct.textContent = pct + '%';
    if (loaded >= need) finish();
  }

  first.forEach(function(n){
    warmed[n] = true;
    var im = new Image();
    im.onload = im.onerror = tick;
    im.src = srcFor(n);
  });

  setTimeout(function(){ finish(); }, 4000);   // לא נתקעים על מסך טעינה
}

function finish(){
  if (booted) return;
  booted = true;
  loadbar.style.width = '100%';
  loadpct.textContent = '100%';

  current = resumeTo;
  render();
  if (resumeTo !== COVER) showResume();

  setTimeout(function(){
    loader.classList.add('gone');
    setTimeout(function(){ loader.style.display = 'none'; }, 480);
    wake();
  }, 200);
}

boot();
})();
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  console.log(`קורא תמונות מ-${path.relative(__dirname, SRC_DIR)} ...`);
  const pages = loadPages();

  const srcBytes = pages.reduce((s, p) => s + p.bytes, 0);
  for (const p of pages) {
    console.log(
      `  ${String(p.n).padStart(2, '0')}  ${p.kind.padEnd(4)} ` +
      `${String(p.width).padStart(4)}x${String(p.height).padEnd(4)} ` +
      `${(p.bytes / 1024).toFixed(0).padStart(4)}KB` +
      (p.isCharacter ? '  [כרטיס דמות]' : '')
    );
  }

  const html = renderHtml(pages);
  fs.writeFileSync(OUT_FILE, html, 'utf8');

  const outMB = fs.statSync(OUT_FILE).size / (1024 * 1024);
  console.log('');
  console.log(`מקור:  ${(srcBytes / 1024 / 1024).toFixed(2)} MB (${pages.length} תמונות)`);
  console.log(`פלט:   ${path.relative(__dirname, OUT_FILE)} — ${outMB.toFixed(2)} MB`);

  if (outMB > 15) {
    console.warn('');
    console.warn(`אזהרה: הקובץ חצה 15MB (${outMB.toFixed(2)} MB).`);
    console.warn('דחוס את המקור ל-WebP q80 / רוחב מקסימלי 1200px והרץ שוב.');
  }
}

main();
