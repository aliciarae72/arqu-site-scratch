/* arqu live copy-edit layer — drop onto any page with one line:
 *   <script id="arqu-edit-layer" src="arqu-edit-layer.js"
 *           data-selector="h1, h2, p.lede"  (optional — what is editable)
 *           data-key="arqu-copy-home"       (optional — localStorage bucket)
 *           data-migrate-nodes="61"         (optional — see MIGRATION below)
 *           data-what="the arqu homepage"></script>
 * Injects its own CSS. Edits persist in the browser; "Copy changes" produces a
 * was/now list to hand a Claude. Lifted off the motion-samples page 2026-09-14.
 *
 * MIGRATION, 2026-09-15 — saved copy is keyed by CONTENT, not by DOM position.
 * The original store was `{ "<index into querySelectorAll(SEL)>": html }`, so
 * adding one matching element anywhere above the footer shifted every index
 * after it and pasted saved copy onto the wrong elements. Keys are now derived
 * from each element's ORIGINAL text, so a new section adds new keys and leaves
 * every existing one where it was.
 *
 * The old index store is READ ONCE to build the new one and is then left alone
 * forever — never written, never cleared. It is the rollback, and for edits
 * that live only in somebody's browser it is the only backup there is.
 *
 * The one-time index -> key mapping is only correct if the page still has the
 * same nodes in the same order it had when those edits were typed. Set
 * data-migrate-nodes to the node count at that time and the migration refuses
 * to run if the page has drifted. A refused page applies no saved copy from the
 * old store and says so: its indexes point at nodes this page does not have in
 * that order, so applying them rewrites copy onto the wrong elements.
 */
(function(){
  var st = document.createElement('style');
  st.id = 'arqu-edit-layer-css';
  st.textContent = "#edbar{position:fixed;bottom:14px;right:14px;z-index:9999;display:flex;gap:6px;align-items:center;\n  background:#fff;border:1px solid #d5cec5;border-radius:10px;padding:6px 8px;\n  box-shadow:0 6px 24px rgba(34,31,32,.12);font:500 12px/1.2 Lato,system-ui,sans-serif;color:#221f20}\n#edbar button{font:500 12px/1.2 Lato,system-ui,sans-serif;border:1px solid #d5cec5;background:#fbfaf7;\n  color:#221f20;border-radius:7px;padding:6px 9px;cursor:pointer}\n#edbar button:hover{background:#f2efe9}\n#edbar button.on{background:#8c82fa;border-color:#5e54c8;color:#fff}\n#edbar .cnt{color:#8d8785;padding:0 2px}\n#edbar .cnt.has{color:#5e54c8;font-weight:700}\nbody.editing [data-ed]{outline:1px dashed #b9b2f5;outline-offset:3px;border-radius:3px}\nbody.editing [data-ed]:focus{outline:2px solid #8c82fa;background:#f3f1ff}\n[data-ed].changed{background:#f3f1ff}\n#edtoast{position:fixed;bottom:66px;right:18px;z-index:10000;background:#221f20;color:#fbfaf7;\n  border-radius:9px;padding:9px 13px;font:500 12px/1.35 Lato,system-ui,sans-serif;max-width:340px;\n  opacity:0;transform:translateY(6px);transition:opacity .18s,transform .18s;pointer-events:none}\n#edtoast.show{opacity:1;transform:none}\n@media print{#edbar,#edtoast{display:none}}";
  (document.head || document.documentElement).appendChild(st);

  var ME  = document.currentScript || document.getElementById('arqu-edit-layer');
  var SEL = (ME && ME.getAttribute('data-selector')) ||
            'h1, h2, h3, p, .eyebrow, .lede, .meta, .sub, li';
  var KEY = (ME && ME.getAttribute('data-key')) || ('arqu-copy-' + location.pathname);
  var KEY2 = KEY + ':bykey';
  var WHAT = (ME && ME.getAttribute('data-what')) || 'this page';
  var nodes = [], orig = [], keys = [], saved = {}, editing = false;

  function readStore(k){
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
  }

  // Key off the element's ORIGINAL words, not its position. Same text in two
  // places gets a ~1, ~2 suffix in document order — a tie-break that only has
  // to be stable, not meaningful.
  function keyFor(el, html){
    var explicit = el.getAttribute('data-edit-key');
    if (explicit) return explicit;
    var d = document.createElement('div'); d.innerHTML = html;
    var txt = (d.textContent || '').replace(/\s+/g,' ').trim().slice(0, 160);
    var h = 5381;
    for (var j=0;j<txt.length;j++) h = (((h * 33) ^ txt.charCodeAt(j)) >>> 0);
    return el.tagName.toLowerCase() + '-' + h.toString(36) + '-' + txt.length;
  }

  // True when every old index points at a node this page has in the order it was typed on.
  function indexesMap(idx){
    if (!idx.length) return true;
    var expect = ME && ME.getAttribute('data-migrate-nodes');
    if (expect && +expect !== nodes.length) return false;
    return idx.every(function(i){ return /^[0-9]+$/.test(i) && +i < nodes.length; });
  }

  // Runs once per browser. Returns false if it cannot prove the mapping.
  function migrate(){
    var v2 = readStore(KEY2);
    if (v2 && typeof v2 === 'object'){ saved = v2; return true; }

    var v1 = readStore(KEY) || {};
    var idx = Object.keys(v1);
    if (!indexesMap(idx)) return false;
    var out = {};
    for (var k=0;k<idx.length;k++) out[keys[+idx[k]]] = v1[idx[k]];
    try { localStorage.setItem(KEY2, JSON.stringify(out)); } catch { return false; }
    saved = out;
    return true;
  }

  function whereOf(el){
    var p = el.closest('section, header, footer, article');
    if (p){
      var h = p.querySelector('h1, h2, h3');
      if (h && h !== el) return h.textContent.trim();
      return p.id || p.className.split(' ')[0] || 'section';
    }
    return 'page header';
  }
  function persist(){
    try { localStorage.setItem(KEY2, JSON.stringify(saved)); }
    catch { toast("Couldn't save that edit — the browser is out of room for this page."); }
  }
  function changedList(){
    var out = [];
    for (var i=0;i<nodes.length;i++){
      var now = nodes[i].innerHTML.trim();
      if (now !== orig[i].trim()) out.push({i:i, el:nodes[i], was:orig[i].trim(), now:now});
    }
    return out;
  }
  function paint(){
    var c = changedList();
    for (var i=0;i<nodes.length;i++) nodes[i].classList.remove('changed');
    c.forEach(function(x){ x.el.classList.add('changed'); });
    var cnt = document.getElementById('edcount');
    cnt.textContent = c.length ? (c.length + (c.length===1?' edit':' edits')) : 'no edits';
    cnt.className = 'cnt' + (c.length ? ' has' : '');
    return c;
  }
  function strip(h){
    var d = document.createElement('div'); d.innerHTML = h;
    return (d.textContent || '').replace(/\s+/g,' ').trim();
  }
  function toast(msg){
    var t = document.getElementById('edtoast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function(){ t.classList.remove('show'); }, 3200);
  }
  function report(){
    var c = changedList();
    if (!c.length) return null;
    var L = ['Copy changes from ' + WHAT + '.',
             'Apply each one to the matching text. ' + c.length + ' change' + (c.length===1?'':'s') + '.', ''];
    c.forEach(function(x, n){
      L.push((n+1) + '. In "' + whereOf(x.el) + '"');
      L.push('   WAS: ' + strip(x.was));
      L.push('   NOW: ' + strip(x.now));
      L.push('');
    });
    return L.join('\n');
  }

  // The original wording and the key it implies. It has to finish before anything is
  // applied, because the migration maps old indexes onto this whole key list.
  function captureKeys(){
    var seen = {};
    nodes.forEach(function(el, i){
      orig[i] = el.innerHTML;
      var base = keyFor(el, orig[i]);
      var n = seen[base] = (seen[base] == null ? 0 : seen[base] + 1);
      keys[i] = n ? base + '~' + n : base;
    });
  }

  function loadSaved(){
    if (migrate()) return;
    saved = {};
    setTimeout(function(){
      toast('Edits saved on the old one-page homepage cannot be placed on this page, so none are shown. They are kept as they were. Tell Alicia before editing.');
    }, 700);
  }

  function wireNode(el, i){
    var slot = keys[i];
    el.setAttribute('data-ed', i);
    el.setAttribute('data-edit-slot', slot);
    if (saved[slot] != null) el.innerHTML = saved[slot];
    el.addEventListener('input', function(){
      if (el.innerHTML.trim() === orig[i].trim()) delete saved[slot];
      else saved[slot] = el.innerHTML;
      persist(); paint();
    });
    el.addEventListener('paste', function(ev){
      ev.preventDefault();
      var txt = (ev.clipboardData || window.clipboardData).getData('text');
      document.execCommand('insertText', false, txt);
    });
  }

  function addBar(){
    var bar = document.createElement('div');
    bar.id = 'edbar';
    bar.innerHTML =
      '<button id="edtoggle">Edit copy</button>' +
      '<span class="cnt" id="edcount">no edits</span>' +
      '<button id="edcopy">Copy changes</button>' +
      '<button id="edreset">Reset</button>';
    document.body.appendChild(bar);
    var t = document.createElement('div'); t.id = 'edtoast'; document.body.appendChild(t);
  }

  function toggleEditing(){
    editing = !editing;
    document.body.classList.toggle('editing', editing);
    nodes.forEach(function(el){ el.contentEditable = editing ? 'true' : 'false'; });
    this.classList.toggle('on', editing);
    this.textContent = editing ? 'Editing — click to stop' : 'Edit copy';
    if (editing) toast('Click any headline or paragraph and type. Your edits stay here after you refresh.');
  }

  // While editing, a click inside an editable region must not fire the button
  // or link that region sits in — otherwise you cannot place a cursor in the
  // copy on any page whose headlines double as controls. Registered in the
  // capture phase, so it runs before the host page's own handler.
  function holdClicksWhileEditing(ev){
    if (!editing) return;
    var t = ev.target;
    var ed = t && t.closest ? t.closest('[data-ed]') : null;
    if (!ed) return;
    if (ed.closest('button, a')){ ev.preventDefault(); ev.stopPropagation(); }
  }

  function copyFallback(text, ok){
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); }
    catch { toast("Couldn't reach the clipboard — select the text in the box and copy it by hand."); ta.style.opacity='1'; ta.style.inset='20% 10%'; ta.style.width='80%'; ta.style.height='50%'; return; }
    document.body.removeChild(ta);
  }

  function copyChanges(){
    var r = report();
    if (!r){ toast('Nothing changed yet — turn on Edit copy and change some words first.'); return; }
    function ok(){ toast('Copied. Paste it to a Claude and it can make the same changes for real.'); }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(r).then(ok, function(){ copyFallback(r, ok); });
    } else copyFallback(r, ok);
  }

  function resetAll(){
    if (!changedList().length){ toast('Already back to the original wording.'); return; }
    if (!confirm('Put every headline and paragraph back to the original wording? Your edits are lost.')) return;
    nodes.forEach(function(el, i){ el.innerHTML = orig[i]; });
    saved = {}; persist(); paint();
    toast('Back to the original wording.');
  }

  function build(){
    nodes = Array.prototype.slice.call(document.querySelectorAll(SEL));
    captureKeys();
    loadSaved();
    nodes.forEach(wireNode);
    addBar();
    document.getElementById('edtoggle').addEventListener('click', toggleEditing);
    document.addEventListener('click', holdClicksWhileEditing, true);
    document.getElementById('edcopy').addEventListener('click', copyChanges);
    document.getElementById('edreset').addEventListener('click', resetAll);
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
