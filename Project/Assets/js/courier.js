/* =========================================================
   CMS – Courier Management System
   courier.js: behaviour for courier.html (courier cockpit).
   Needs Leaflet loaded first.
   ========================================================= */

'use strict';

/* ---------- Mobile menu ---------- */
(() => {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
})();

/* ---------- Inline messages (.msg) ---------- */
// type: 'error' (default) | 'success' | 'info'
function showMsg(el, text, type = 'error'){
  if (!el) return;
  el.textContent = text;
  el.classList.remove('error', 'success', 'info');
  el.classList.add(type, 'show');
}

function hideMsg(el){
  if (!el) return;
  el.textContent = '';
  el.classList.remove('show');
}

/* ---------- Validation ---------- */
// A coordinate must be a real number (or numeric text), inside the valid
// lat/lng ranges, and not the 0,0 "Null Island" placeholder.
const toNum = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) ? Number(v) : NaN;
function isValidCoordinate(lat, lng){
  lat = toNum(lat); lng = toNum(lng);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
         lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
         !(lat === 0 && lng === 0);
}

// Returns an error message for the order's GPS data, or '' if it is fine
function coordError(o){
  const ok = p => Array.isArray(p) && p.length === 2 && isValidCoordinate(p[0], p[1]);
  if (!ok(o.origin)) return `Order #${o.id} has an invalid origin GPS coordinate.`;
  if (!ok(o.dest))   return `Order #${o.id} has an invalid destination GPS coordinate.`;
  if (toNum(o.origin[0]) === toNum(o.dest[0]) && toNum(o.origin[1]) === toNum(o.dest[1]))
    return `Order #${o.id} has the same origin and destination.`;
  return '';
}

/* =========================================================
   Sample test data (Sprint 1: no backend yet)
   ========================================================= */
const FEUP = [41.1780, -8.5980];

const vehicles = [
  { id:'v1', model:'Toyota Hilux', plate:'44-XX-44', type:'Van',  maxKg:1000, maxM3:6.0,  insurance:'2027-03-12', inspection:'2027-01-08', approved:true },
  { id:'v2', model:'Honda PCX',    plate:'12-AB-34', type:'Moto', maxKg:25,   maxM3:0.10, insurance:'2027-05-30', inspection:'2026-12-15', approved:true },
  { id:'v3', model:'Cargo Bike',   plate:'CB-0007',  type:'Bike', maxKg:40,   maxM3:0.20, insurance:'2027-02-01', inspection:'2027-02-01', approved:true },
  { id:'v4', model:'Renault Master', plate:'56-CD-78', type:'Van', maxKg:1400, maxM3:10.8, insurance:'2026-09-30', inspection:'2027-04-20', approved:false }
];

// Orders: GPS coordinates for origin/destination, products with weight & volume
let activeOrder = {
  id:2041, from:'Porto', to:'FEUP', origin:[41.1484,-8.6110], dest:FEUP, attempt:1, status:'initiated',
  products:[
    { desc:'27" monitor',   kg:7.5, m3:0.09 },
    { desc:'Documents box', kg:4.0, m3:0.03 },
    { desc:'Keyboard',      kg:1.2, m3:0.01 }
  ]
};

let queue = [
  { id:2042, from:'Bolhão', to:'Casa da Música', origin:[41.1497,-8.6058], dest:[41.1588,-8.6307], attempt:1,
    products:[{ desc:'Concert tickets envelope', kg:0.2, m3:0.001 }, { desc:'Gift box', kg:1.9, m3:0.012 }] },
  { id:2043, from:'Trindade', to:'Matosinhos', origin:[41.1525,-8.6094], dest:[41.1823,-8.6898], attempt:1,
    products:[{ desc:'Office chair', kg:18, m3:0.35 }, { desc:'Desk lamp', kg:2.4, m3:0.03 }] },
  { id:2044, from:'Ribeira', to:'Vila Nova de Gaia', origin:[41.1407,-8.6131], dest:[41.1373,-8.6094], attempt:1,
    products:[{ desc:'Book parcel', kg:0.8, m3:0.004 }] },
  // Test data: broken GPS (latitude out of range) to show the coordinate check
  { id:2045, from:'Boavista', to:'Foz', origin:[141.1620,-8.6390], dest:[41.1530,-8.6780], attempt:1,
    products:[{ desc:'Flower bouquet', kg:1.5, m3:0.02 }] }
];

let completed = [
  { id:2040, to:'Casa da Música',      date:'2026-10-04', status:'completed' },
  { id:2039, to:'Rua Santa Catarina',  date:'2026-10-04', status:'completed' },
  { id:2038, to:'FEUP',                date:'2026-10-03', status:'completed' }
];

/* =========================================================
   Helpers
   ========================================================= */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = iso => { const [y,m,d] = iso.split('-'); return `${+d}/${+m}/${y}`; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const totals = o => o.products.reduce((t,p) => ({ kg:t.kg+p.kg, m3:t.m3+p.m3 }), { kg:0, m3:0 });
const fmtKg = n => (Math.round(n*10)/10).toLocaleString('en-US') + ' kg';
const fmtM3 = n => (Math.round(n*1000)/1000).toLocaleString('en-US') + ' m³';
const coord = c => `${c[0].toFixed(4)}, ${c[1].toFixed(4)}`;
const isExpired = iso => iso < todayISO();
const STATUS_LABEL = { initiated:'Initiated', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled' };

let toastTimer;
function toast(text){
  const t = $('toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Vehicle usable = approved by staff AND documents still valid
const vehicleUsable = v => v.approved && !isExpired(v.insurance) && !isExpired(v.inspection);
const vehicleFits  = (v, o) => { const t = totals(o); return t.kg <= v.maxKg && t.m3 <= v.maxM3; };
const selectedVehicle = () => vehicles.find(v => v.id === $('vehicleSelect').value) || null;

/* =========================================================
   Vehicle selector
   ========================================================= */
function buildVehicleOptions(){
  const sel = $('vehicleSelect');
  vehicles.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.model} ${v.plate} (${v.type})` + (vehicleUsable(v) ? '' : ' – awaiting staff approval');
    opt.disabled = !vehicleUsable(v);
    sel.appendChild(opt);
  });
  sel.value = 'v1';   // default from the mock-up
}

function renderVehicleMeta(){
  const v = selectedVehicle(), meta = $('vehicleMeta');
  if (!v){ meta.innerHTML = ''; renderLoad(); return; }
  meta.innerHTML =
    `<span class="chip">Max ${fmtKg(v.maxKg)}</span>` +
    `<span class="chip">Max ${fmtM3(v.maxM3)}</span>` +
    `<span class="chip ok">Insurance until ${fmtDate(v.insurance)}</span>` +
    `<span class="chip ok">Inspection until ${fmtDate(v.inspection)}</span>`;
  renderLoad();
}

$('vehicleSelect').addEventListener('change', () => {
  hideMsg($('vehicleMsg'));
  renderVehicleMeta();
  renderStatus();
});

/* =========================================================
   Map (Leaflet + OpenStreetMap)
   ========================================================= */
let map, routeLayer, routeReq = 0;
const fmtKm = m => (m / 1000).toLocaleString('en-US', { maximumFractionDigits:1 }) + ' km';
function initMap(){
  if (!window.L){
    $('map').innerHTML = '<div class="map-fallback">The map could not load. Check your internet connection.</div>';
    return;
  }
  map = L.map('map', { scrollWheelZoom:true }).setView(FEUP, 15);

  // OpenStreetMap tiles (no API key needed).
  // OSM blocks tile requests that come from a page opened straight from disk
  // (file://), so the site must run on a local server, e.g. VS Code "Live Server".
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    referrerPolicy: 'strict-origin-when-cross-origin'
  }).addTo(map);

  if (location.protocol === 'file:'){
    showMsg($('tileMsg'), 'Map tiles only load when the site runs on a local server. Open it with VS Code "Live Server" (or run: python -m http.server) and use http://localhost.', 'info');
  }
  routeLayer = L.layerGroup().addTo(map);
  drawRoute();
}

function drawRoute(){
  // Numeric GPS check: never place markers from bad coordinates
  const badCoords = activeOrder && coordError(activeOrder);
  if (badCoords){
    showMsg($('mapMsg'), `${badCoords} The route can't be drawn.`);
    if (routeLayer) routeLayer.clearLayers();
    return;
  }
  hideMsg($('mapMsg'));

  if (activeOrder){
    $('coordOrigin').textContent = coord(activeOrder.origin);
    $('coordDest').textContent   = coord(activeOrder.dest);
  } else {
    $('coordOrigin').textContent = '—';
    $('coordDest').textContent   = coord(FEUP) + ' (FEUP)';
  }
  $('routeInfo').textContent = '—';
  if (!map) return;
  routeLayer.clearLayers();
  const reqId = ++routeReq;

  if (!activeOrder){
    // No active order: default marker on FEUP
    L.marker(FEUP).addTo(routeLayer).bindPopup('<b>FEUP</b><br>Faculdade de Engenharia');
    map.setView(FEUP, 15);
    return;
  }
  const o = activeOrder;
  // Straight line first, so there is always a route on the map
  const line = L.polyline([o.origin, o.dest], { color:'#2f5d9e', weight:4, dashArray:'8 8', opacity:.9 }).addTo(routeLayer);
  L.circleMarker(o.origin, { radius:8, color:'#14284b', weight:3, fillColor:'#fff', fillOpacity:1 })
    .addTo(routeLayer).bindPopup(`<b>Pick-up:</b> ${esc(o.from)}<br>${coord(o.origin)}`);
  L.marker(o.dest).addTo(routeLayer)
    .bindPopup(`<b>Drop-off:</b> ${esc(o.to)}<br>${coord(o.dest)}`).openPopup();
  map.fitBounds(L.latLngBounds([o.origin, o.dest]), { padding:[50,50], maxZoom:16 });
  $('routeInfo').textContent = `${fmtKm(map.distance(o.origin, o.dest))} straight line`;

  // Then swap it for the real road route (OSRM, free public router, no API key)
  const pts = `${o.origin[1]},${o.origin[0]};${o.dest[1]},${o.dest[0]}`;
  fetch(`https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      const route = data.routes && data.routes[0];
      if (!route || reqId !== routeReq) return;     // no route, or the order changed meanwhile
      const road = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      line.setLatLngs(road).setStyle({ dashArray:null, weight:5 });
      map.fitBounds(line.getBounds(), { padding:[50,50], maxZoom:16 });
      $('routeInfo').textContent = `${fmtKm(route.distance)} · ~${Math.max(1, Math.round(route.duration / 60))} min by road`;
    })
    .catch(() => { /* keep the straight line */ });
}

/* =========================================================
   Active order: load vs vehicle capacity
   ========================================================= */
function renderLoad(){
  if (!activeOrder) return;
  const t = totals(activeOrder), v = selectedVehicle();
  let fit = '';
  if (v){
    fit = vehicleFits(v, activeOrder)
      ? `<p class="fit ok">✓ ${esc(v.model)} can carry this order</p>`
      : `<p class="fit bad">✗ ${esc(v.model)} is too small for this order (max ${fmtKg(v.maxKg)} / ${fmtM3(v.maxM3)})</p>`;
  }
  $('loadBox').innerHTML =
    `<div class="load-row"><strong>Load</strong><span><b>${fmtKg(t.kg)}</b> · <b>${fmtM3(t.m3)}</b></span></div>` +
    `<ul>${activeOrder.products.map(p => `<li>${esc(p.desc)} (${fmtKg(p.kg)}, ${fmtM3(p.m3)})</li>`).join('')}</ul>` + fit;
}

/* =========================================================
   Sequential status: Initiated -> In Progress -> Completed / Cancelled
   ========================================================= */
let pod = null;   // { type:'signature'|'photo' }

function renderStatus(){
  const hasOrder = !!activeOrder;
  $('activeOrder').hidden = !hasOrder;
  $('noOrder').hidden = hasOrder;
  if (!hasOrder){ $('vehicleSelect').disabled = false; return; }

  const s = activeOrder.status;
  $('orderId').textContent = '#' + activeOrder.id;
  $('routeFrom').textContent = activeOrder.from;
  $('routeTo').textContent = activeOrder.to;
  const badge = $('statusBadge');
  badge.textContent = STATUS_LABEL[s];
  badge.className = 'badge ' + s;

  const set = (el, cls, enabled) => {
    el.classList.remove('is-done','is-current','is-next','is-locked');
    el.classList.add(cls);
    el.disabled = !enabled;
  };
  // Initiated is always the starting point (done once we move on)
  set($('stepInit'), s === 'initiated' ? 'is-current' : 'is-done', false);
  set($('stepProg'), s === 'initiated' ? 'is-next' : 'is-current', s === 'initiated');
  set($('stepDone'),   s === 'in_progress' ? 'is-next' : 'is-locked', s === 'in_progress');
  set($('stepCancel'), s === 'in_progress' ? 'is-next' : 'is-locked', s === 'in_progress');
  $('stepInit').setAttribute('aria-current', s === 'initiated' ? 'step' : 'false');
  $('stepProg').setAttribute('aria-current', s === 'in_progress' ? 'step' : 'false');

  // Vehicle can't be swapped mid-route
  $('vehicleSelect').disabled = s !== 'initiated';
  // Proof of delivery only once the parcel is on its way
  $('podCard').classList.toggle('locked', s !== 'in_progress');
  $('podCard').querySelectorAll('button, input').forEach(el => el.disabled = s !== 'in_progress');
}

// Initiated -> In Progress (validates vehicle choice and capacity)
$('stepProg').addEventListener('click', () => {
  const v = selectedVehicle(), msg = $('statusMsg');
  hideMsg(msg);
  if (!v){
    showMsg($('vehicleMsg'), 'Select a vehicle before starting the delivery.');
    $('vehicleSelect').focus();
    return;
  }
  if (!vehicleFits(v, activeOrder)){
    showMsg(msg, `This order doesn't fit in the ${v.model}. Pick a larger vehicle.`);
    return;
  }
  activeOrder.status = 'in_progress';
  activeOrder.vehicle = v.id;
  renderStatus();
  toast(`Order #${activeOrder.id} is now In Progress`);
});

// In Progress -> Completed (requires e-POD)
$('stepDone').addEventListener('click', () => {
  hideMsg($('statusMsg'));
  if (!pod){
    showMsg($('podMsg'), 'Proof of delivery is mandatory: save a signature or upload a photo first.');
    $('podCard').scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  hideMsg($('podMsg'));
  finishOrder('completed');
});

// In Progress -> Cancelled (requires a reason, then returns to the queue)
$('stepCancel').addEventListener('click', () => {
  hideMsg($('statusMsg'));
  $('cancelForm').classList.add('show');
  $('cancelReason').focus();
});
$('cancelBack').addEventListener('click', closeCancel);
function closeCancel(){
  $('cancelForm').classList.remove('show');
  $('cancelReason').value = '';
  $('cancelReason').classList.remove('invalid');
  hideMsg($('cancelMsg'));
}
$('cancelReason').addEventListener('input', e => {
  if (e.target.value.trim()){ e.target.classList.remove('invalid'); hideMsg($('cancelMsg')); }
});
$('cancelForm').addEventListener('submit', e => {
  e.preventDefault();
  const reason = $('cancelReason').value.trim();
  if (!reason){
    $('cancelReason').classList.add('invalid');
    showMsg($('cancelMsg'), 'Please write a reason before cancelling.');
    $('cancelReason').focus();
    return;
  }
  if (reason.length < 5){
    $('cancelReason').classList.add('invalid');
    showMsg($('cancelMsg'), 'The reason is too short (at least 5 characters).');
    return;
  }
  finishOrder('cancelled', reason);
});

function finishOrder(status, reason){
  const o = activeOrder;
  if (status === 'completed'){
    completed.unshift({ id:o.id, to:o.to, date:todayISO(), status:'completed', isNew:true });
    toast(`Order #${o.id} delivered – proof of delivery saved`);
  } else {
    // Cancelled orders go back to the list of orders, with one more attempt counted
    const { status:_s, vehicle:_v, ...rest } = o;
    queue.push({ ...rest, attempt:o.attempt + 1, lastReason:reason });
    toast(`Order #${o.id} cancelled and returned to the queue`);
  }
  activeOrder = null;
  resetPod();
  closeCancel();
  renderAll();
}

/* =========================================================
   Order queue (single active task constraint)
   ========================================================= */
function renderQueue(){
  const body = $('queueBody');
  if (!queue.length){
    body.innerHTML = '<tr><td colspan="4" class="muted">No orders waiting.</td></tr>';
  } else {
    body.innerHTML = queue.map(o => {
      const t = totals(o);
      const att = o.attempt > 1 ? `<span class="attempt" title="${esc(o.lastReason || '')}">Attempt ${o.attempt}</span>` : '';
      return `<tr>
        <td>#${o.id}${att}</td>
        <td>${esc(o.from)} → ${esc(o.to)}</td>
        <td>${fmtKg(t.kg)} · ${fmtM3(t.m3)}</td>
        <td style="text-align:right"><button class="btn btn-blue queue-btn" data-accept="${o.id}" ${activeOrder ? 'disabled' : ''}>Accept</button></td>
      </tr>`;
    }).join('');
  }
  $('queueNote').textContent = activeOrder
    ? `Finish order #${activeOrder.id} before accepting another one.`
    : 'You can accept one order at a time.';
}

$('queueBody').addEventListener('click', e => {
  const btn = e.target.closest('[data-accept]');
  if (!btn || btn.disabled) return;
  if (activeOrder){ toast('You already have an active order.'); return; }
  const id = Number(btn.dataset.accept);
  const idx = queue.findIndex(o => o.id === id);
  // Don't take an order whose GPS data can't be mapped
  const bad = coordError(queue[idx]);
  if (bad){
    showMsg($('queueMsg'), `${bad} It can't be accepted until the client fixes it.`);
    return;
  }
  hideMsg($('queueMsg'));
  const [o] = queue.splice(idx, 1);
  activeOrder = { ...o, status:'initiated' };
  $('vehicleSelect').value = '';                 // courier must choose the right vehicle again
  renderAll();
  hideMsg($('statusMsg'));
  showMsg($('vehicleMsg'), 'Select a vehicle that can carry this order.', 'info');
  toast(`Order #${o.id} accepted`);
  window.scrollTo({ top:0, behavior:'smooth' });
});

/* =========================================================
   Completed orders
   ========================================================= */
function renderCompleted(){
  $('doneBody').innerHTML = completed.map(o =>
    `<tr class="${o.isNew ? 'new' : ''}">
      <td>#${o.id}</td><td>${esc(o.to)}</td><td>${fmtDate(o.date)}</td>
      <td><span class="badge ${o.status}">${STATUS_LABEL[o.status]}</span></td>
    </tr>`).join('');
  completed.forEach(o => delete o.isNew);
}

/* =========================================================
   Proof of delivery: signature canvas + photo upload simulator
   ========================================================= */
const pad = $('sigPad'), ctx = pad.getContext('2d');
let drawing = false, hasInk = false, last = null;

function sizePad(){
  const r = pad.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const old = hasInk ? pad.toDataURL() : null;
  pad.width = Math.max(1, r.width * dpr); pad.height = Math.max(1, r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14284b';
  if (old){ const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = old; }
}
const pos = e => { const r = pad.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; };

pad.addEventListener('pointerdown', e => {
  if ($('podCard').classList.contains('locked')) return;
  e.preventDefault();
  drawing = true; last = pos(e); pad.setPointerCapture(e.pointerId);
  ctx.beginPath(); ctx.arc(last.x, last.y, 1, 0, Math.PI*2); ctx.fillStyle = '#14284b'; ctx.fill();
  hasInk = true;
});
pad.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = pos(e);
  ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  last = p;
});
['pointerup','pointercancel','pointerleave'].forEach(ev => pad.addEventListener(ev, () => drawing = false));

$('sigClear').addEventListener('click', () => {
  ctx.clearRect(0, 0, pad.width, pad.height); hasInk = false;
  if (pod && pod.type === 'signature'){ pod = null; $('podSaved').textContent = ''; }
});
$('sigSave').addEventListener('click', () => {
  if (!hasInk){ showMsg($('podMsg'), 'The signature is empty. Ask the recipient to sign in the box.'); return; }
  hideMsg($('podMsg'));
  pod = { type:'signature', data:pad.toDataURL('image/png') };
  $('podSaved').textContent = '✓ Signature saved';
  toast('Signature saved');
});

$('photoInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')){
    showMsg($('podMsg'), 'That file is not an image. Upload a JPG or PNG photo.');
    e.target.value = ''; return;
  }
  if (file.size > 8 * 1024 * 1024){
    showMsg($('podMsg'), 'The photo is larger than 8 MB. Choose a smaller one.');
    e.target.value = ''; return;
  }
  hideMsg($('podMsg'));
  const reader = new FileReader();
  reader.onload = () => {
    $('photoDrop').innerHTML = `<img src="${reader.result}" alt="Delivery photo preview"><span>Tap to replace</span>`;
    pod = { type:'photo', name:file.name };
    $('podSaved').textContent = `✓ Photo attached (${file.name})`;
    toast('Delivery photo attached');
  };
  reader.readAsDataURL(file);
});

const PHOTO_EMPTY = $('photoDrop').innerHTML;
function resetPod(){
  pod = null; hasInk = false;
  ctx.clearRect(0, 0, pad.width, pad.height);
  $('photoInput').value = '';
  $('photoDrop').innerHTML = PHOTO_EMPTY;
  $('podSaved').textContent = '';
  hideMsg($('podMsg'));
}

// Tabs
const tabs = [$('tabSig'), $('tabPhoto')];
function selectTab(tab){
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute('aria-controls')).hidden = !on;
  });
  if (tab === $('tabSig')) requestAnimationFrame(sizePad);
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ const n = tabs[(i + 1) % 2]; selectTab(n); n.focus(); }
  });
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { sizePad(); map && map.invalidateSize(); }, 150); });

/* =========================================================
   Boot
   ========================================================= */
function renderAll(){
  renderStatus();
  renderLoad();
  renderQueue();
  renderCompleted();
  drawRoute();
}

buildVehicleOptions();
renderVehicleMeta();
renderAll();
sizePad();
window.addEventListener('load', initMap);