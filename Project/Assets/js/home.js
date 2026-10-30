// ---------- Mobile menu ----------
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

menuToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});

// ---------- Forms (frontend only for now: no validation, no navigation) ----------
document.getElementById('trackForm').addEventListener('submit', (e) => e.preventDefault());
document.getElementById('searchForm').addEventListener('submit', (e) => e.preventDefault());

// ---------- Animated counters ----------
function animateCount(el) {
  const target = Number(el.dataset.count);
  const duration = 1400;
  const start = performance.now();

  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const value = Math.floor(target * (1 - Math.pow(1 - p, 3)));
    el.textContent = value.toLocaleString('en-US') + '+';
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- Scroll reveal + counters ----------
const reveals = document.querySelectorAll('.reveal');
const counters = document.querySelectorAll('[data-count]');

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  reveals.forEach((el) => revealObserver.observe(el));

  const counterObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach((c) => counterObserver.observe(c));
} else {
  reveals.forEach((el) => el.classList.add('visible'));
}
