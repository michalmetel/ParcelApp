/* =========================================================
   CMS – Courier Management System
   staff.js: behaviour for StaffPage.html (staff panel).
   Data below is sample data; replace with an API call later.
   ========================================================= */

'use strict';

/* ---------- Sample data ---------- */
// status: 'pending' | 'review' | 'rejected'
const couriers = [
  {
    id: 1,
    name: 'Maria Silva',
    email: 'mariasilva@gmail.com',
    documents: ['ID card', 'Criminal record'],
    dateReceived: '2026-10-06',
    status: 'pending'
  },
];

// Store expiry DATES (YYYY-MM-DD); Valid/Expired is computed below.
const vehicles = [
  { plate: 'AA-00-XX', model: 'Model', type: 'Van', insuranceExpiry: '2026-10-01', inspectionExpiry: '2027-05-12' },
  { plate: 'AA-99-XX', model: 'Model', type: 'Car', insuranceExpiry: '2027-02-04', inspectionExpiry: '2026-10-01' }
];

const STATUS_LABEL = { pending: 'Pending', review: 'In review', rejected: 'Rejected' };

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);

// Build elements with textContent (never innerHTML with data) to avoid XSS.
function el(tag, props = {}, ...children){
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)){
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function parseISO(iso){
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso){
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isExpired(iso){
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseISO(iso) < today;
}

/* ---------- Mobile menu ---------- */
(() => {
  const toggle = $('menuToggle');
  const nav = $('mainNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
})();

/* ---------- Toast ---------- */
let toastTimer;
function toast(text){
  const t = $('toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Couriers table ---------- */
const FILE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>`;

function docButton(courier, name){
  const btn = el('button', {
    class: 'doc',
    type: 'button',
    'aria-label': `Open ${name} of ${courier.name}`,
    onclick: () => toast(`Opening "${name}" of ${courier.name} (not implemented yet)`)
  });
  btn.innerHTML = FILE_ICON;               // static, trusted markup only
  btn.append(el('span', {}, name));
  return btn;
}

function renderCouriers(){
  const body = $('couriersBody');
  body.replaceChildren();

  if (!couriers.length){
    body.append(el('tr', {}, el('td', { class: 'empty', colspan: '6' }, 'No pending courier approvals.')));
    return;
  }

  couriers.forEach(c => {
    const done = c.status === 'rejected';

    const review = el('button', {
      class: 'btn', type: 'button',
      onclick: () => reviewCourier(c.id)
    }, 'Review');
    const reject = el('button', {
      class: 'btn btn-red', type: 'button',
      onclick: () => rejectCourier(c.id)
    }, 'Reject');
    if (done){ review.disabled = true; reject.disabled = true; }

    body.append(el('tr', {},
      el('td', {}, c.name),
      el('td', {}, c.email),
      el('td', {}, el('div', { class: 'docs' }, ...c.documents.map(d => docButton(c, d)))),
      el('td', {}, formatDate(c.dateReceived)),
      el('td', {}, el('span', { class: `status status-${c.status}` }, STATUS_LABEL[c.status])),
      el('td', {}, el('div', { class: 'actions' }, review, reject))
    ));
  });
}

function reviewCourier(id){
  const c = couriers.find(x => x.id === id);
  if (!c) return;
  c.status = 'review';
  renderCouriers();
  toast(`${c.name} is now in review`);
}

function rejectCourier(id){
  const c = couriers.find(x => x.id === id);
  if (!c) return;
  c.status = 'rejected';
  renderCouriers();
  toast(`${c.name} was rejected`);
}

/* ---------- Vehicles table ---------- */
function validityBadge(iso){
  const expired = isExpired(iso);
  return el('span', { class: `badge ${expired ? 'badge-err' : 'badge-ok'}` },
    `${expired ? 'Expired' : 'Valid'} (${formatDate(iso)})`);
}

function renderVehicles(){
  const body = $('vehiclesBody');
  body.replaceChildren();

  if (!vehicles.length){
    body.append(el('tr', {}, el('td', { class: 'empty', colspan: '5' }, 'No pending vehicle approvals.')));
    return;
  }

  vehicles.forEach(v => {
    body.append(el('tr', {},
      el('td', {}, v.plate),
      el('td', {}, v.model),
      el('td', {}, v.type),
      el('td', {}, validityBadge(v.insuranceExpiry)),
      el('td', {}, validityBadge(v.inspectionExpiry))
    ));
  });
}

/* ---------- Init ---------- */
renderCouriers();
renderVehicles();
