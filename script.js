document.addEventListener('DOMContentLoaded', () => {
  function track(eventName, params = {}) {
    try { if (window.gtag) gtag('event', eventName, params); } catch (e) {}
    console.log('[track]', eventName, params);
  }

  // ----- Cart (localStorage) -----
  function getCart() {
    try { return JSON.parse(localStorage.getItem('mage_cart') || '[]'); } catch (e) { return []; }
  }
  function setCart(items) {
    try { localStorage.setItem('mage_cart', JSON.stringify(items)); } catch (e) {}
    updateCartSummary();
  }

  // ----- Nav -----
  const nav = document.querySelector('.nav');
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  }
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => { nav.classList.remove('open'); });
  });

  // ----- Hero: tap to begin (game-style opening) -----
  const hero = document.getElementById('hero');
  const heroTapOverlay = document.getElementById('heroTapOverlay');
  const heroCursorGlow = document.getElementById('heroCursorGlow');
  const heroTapSuitsWrap = document.getElementById('heroTapSuitsWrap');
  const heroParticleBurst = document.getElementById('heroParticleBurst');
  const heroAudio = new Audio('assets/roll.mp3');

  function spawnParticles(container, count) {
    if (!container) return;
    const suits = ['♠', '♥', '♣', '♦'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 100 + Math.random() * 150;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      const el = document.createElement('span');
      el.className = 'hero-particle';
      el.style.setProperty('--px', px + 'px');
      el.style.setProperty('--py', py + 'px');
      el.style.animationDelay = Math.random() * 0.08 + 's';
      if (i % 3 === 0) {
        el.textContent = suits[i % 4];
        el.style.width = el.style.height = '16px';
        el.style.marginLeft = el.style.marginTop = '-8px';
        el.style.fontSize = '12px';
        el.style.background = 'none';
        el.style.boxShadow = 'none';
        el.style.color = 'rgba(255,255,255,0.95)';
      }
      container.appendChild(el);
      setTimeout(() => el.remove(), 850);
    }
  }

  function startHero(ev) {
    if (!hero || hero.classList.contains('hero-started')) return;
    hero.classList.add('hero-started');
    hero.classList.add('hero-shake');
    setTimeout(() => hero.classList.remove('hero-shake'), 500);
    spawnParticles(heroParticleBurst, 28);
    try { heroAudio.currentTime = 0; heroAudio.play().catch(() => {}); } catch (e) {}
    if (window.gtag) gtag('event', 'hero_started');
  }

  if (heroTapOverlay) {
    heroTapOverlay.addEventListener('click', (e) => startHero(e));
    heroTapOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startHero(e); }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (hero && !hero.classList.contains('hero-started') && !e.target.matches('input, textarea')) {
      e.preventDefault();
      startHero(e);
    }
  });
  hero.addEventListener('click', (e) => {
    if (e.target.closest('.hero-tap-overlay') || e.target.closest('a') || e.target.closest('button')) return;
    if (hero.classList.contains('hero-started')) return;
    startHero(e);
  });

  // Cursor-follow glow on overlay (before tap)
  if (heroTapOverlay && heroCursorGlow) {
    heroTapOverlay.addEventListener('mousemove', (e) => {
      if (hero.classList.contains('hero-started')) return;
      const rect = heroTapOverlay.getBoundingClientRect();
      heroCursorGlow.style.left = (e.clientX - rect.left) + 'px';
      heroCursorGlow.style.top = (e.clientY - rect.top) + 'px';
      heroCursorGlow.style.opacity = '1';
    });
    heroTapOverlay.addEventListener('mouseleave', () => { heroCursorGlow.style.opacity = '0'; });
  }

  // Suits follow mouse (parallax) before tap — top, right, bottom, left
  if (heroTapSuitsWrap) {
    const suits = heroTapSuitsWrap.querySelectorAll('.hero-tap-suit');
    const baseTransforms = ['translate(-50%, -50%)', 'translate(50%, -50%)', 'translate(-50%, 50%)', 'translate(-50%, -50%)'];
    heroTapOverlay.addEventListener('mousemove', (e) => {
      if (hero.classList.contains('hero-started')) return;
      const rect = heroTapOverlay.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));
      const push = 14;
      const ax = [0, dx * push, 0, -dx * push];
      const ay = [-dy * push, dy * push * 0.6, dy * push, dy * push * 0.6];
      suits.forEach((s, i) => {
        s.style.transform = `${baseTransforms[i]} translate(${ax[i]}px, ${ay[i]}px)`;
        const d = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (d < 100) {
          s.style.color = 'rgba(255,255,255,0.7)';
          s.style.textShadow = '0 0 16px rgba(255,255,255,0.4)';
        } else {
          s.style.color = '';
          s.style.textShadow = '';
        }
      });
    });
    heroTapOverlay.addEventListener('mouseleave', () => {
      suits.forEach((s, i) => {
        s.style.transform = baseTransforms[i];
        s.style.color = '';
        s.style.textShadow = '';
      });
    });
  }

  // ----- Hero: mouse parallax (logo move with cursor after tap) -----
  const heroParallax = document.querySelector('.hero-logo-parallax');
  if (hero && heroParallax) {
    hero.addEventListener('mousemove', (e) => {
      if (!hero.classList.contains('hero-started')) return;
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const dx = Math.round(x * 18);
      const dy = Math.round(y * 18);
      heroParallax.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    hero.addEventListener('mouseleave', () => { heroParallax.style.transform = ''; });
  }

  // ----- Smooth scroll -----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const id = this.getAttribute('href');
      if (id === '#') return;
      const el = document.querySelector(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // ----- Roll the Mat demo -----
  const rollBtn = document.getElementById('rollBtn');
  const matDemo = document.querySelector('.mat-demo');
  const audio = new Audio('assets/roll.mp3');
  if (rollBtn && matDemo) {
    rollBtn.addEventListener('click', () => {
      const isRolled = matDemo.classList.contains('rolled-out');
      matDemo.classList.toggle('rolled-out', !isRolled);
      try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (e) {}
      if (!isRolled) matDemo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      track(isRolled ? 'mat_folded' : 'mat_rolled');
    });
  }

  // ----- Add to Order (product cards → modal → cart) -----
  const modal = document.getElementById('modal');
  const buyForm = document.getElementById('buyForm');
  const quickSku = document.getElementById('quickSku');
  const quickName = document.getElementById('quickName');
  const qtyInput = document.getElementById('qty');
  const toast = document.getElementById('toast');
  const minusBtn = document.getElementById('minus');
  const plusBtn = document.getElementById('plus');

  function showToast(msg = 'Added to cart!') {
    if (!toast) { alert(msg); return; }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }

  document.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const sku = btn.dataset.sku;
      const name = btn.dataset.name;
      const price = btn.dataset.price;
      if (!sku || !name) return;
      if (quickSku) quickSku.value = sku;
      if (quickName) quickName.textContent = name;
      if (qtyInput) qtyInput.value = 1;
      if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
      }
      track('open_add_modal', { sku, name });
    });
  });

  const closeBtn = document.querySelector('.modal .close');
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  if (minusBtn && qtyInput) {
    minusBtn.addEventListener('click', () => {
      const v = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1);
      qtyInput.value = v;
    });
  }
  if (plusBtn && qtyInput) {
    plusBtn.addEventListener('click', () => {
      const v = Math.max(1, parseInt(qtyInput.value || '1', 10) + 1);
      qtyInput.value = v;
    });
  }

  if (buyForm) {
    buyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const sku = quickSku ? quickSku.value : '';
      const name = quickName ? quickName.textContent : '';
      const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1', 10));
      if (!sku) { showToast('Please select a product'); return; }
      const cart = getCart();
      const price = document.querySelector(`.btn-add[data-sku="${sku}"]`)?.dataset.price || '0';
      cart.push({ sku, name, price: parseFloat(price), qty, ts: Date.now() });
      setCart(cart);
      showToast('Added to cart!');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      track('add_to_cart', { sku, quantity: qty });
    });
  }

  // ----- Cart summary (checkout) -----
  function updateCartSummary() {
    const cart = getCart();
    const cartItemsEl = document.getElementById('cartItems');
    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping');
    const totalEl = document.getElementById('total');
    const countrySelect = document.getElementById('country');

    let subtotal = 0;
    cart.forEach(item => { subtotal += (item.price || 0) * (item.qty || 1); });

    if (cartItemsEl) {
      if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="cart-empty">Cart is empty. Add items from Shop.</p>';
      } else {
        cartItemsEl.innerHTML = cart.map((item, index) =>
          `<div class="cart-line" data-ts="${item.ts || ''}" data-index="${index}">
            <button type="button" class="cart-dec" aria-label="Decrease quantity">−</button>
            <span class="cart-line-text">${item.name} × ${item.qty} — $${(item.price * item.qty).toFixed(2)}</span>
          </div>`
        ).join('');
      }
    }
    if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);

    const country = countrySelect ? countrySelect.value : '';
    let shipping = 0;
    if (country === 'US') shipping = subtotal >= 75 ? 0 : 8;
    else if (country === 'CN') shipping = subtotal >= 100 ? 0 : 12;
    else if (country && country !== '') shipping = 15;
    if (shippingEl) {
      shippingEl.textContent = shipping === 0 ? 'Free' : '$' + shipping.toFixed(2);
    }
    let total = subtotal + shipping;
    const giftWrap = document.getElementById('giftWrap');
    if (giftWrap && giftWrap.checked) total += 5;
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  }

  if (document.getElementById('cartItems')) {
    const cartItemsEl = document.getElementById('cartItems');
    if (cartItemsEl && !cartItemsEl.dataset.bound) {
      cartItemsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.cart-dec');
        if (!btn) return;
        const line = btn.closest('.cart-line');
        if (!line) return;
        const ts = line.dataset.ts;
        const index = parseInt(line.dataset.index || '-1', 10);
        const cart = getCart();
        let idx = -1;
        if (ts) {
          idx = cart.findIndex(item => String(item.ts) === String(ts));
        }
        if (idx === -1 && index >= 0) idx = index;
        if (idx < 0) return;
        const sku = cart[idx]?.sku;
        if ((cart[idx].qty || 1) > 1) {
          cart[idx].qty -= 1;
        } else {
          cart.splice(idx, 1);
        }
        setCart(cart);
        track('cart_decrease', { sku });
      });
      cartItemsEl.dataset.bound = 'true';
    }
  }

  const countrySelect = document.getElementById('country');
  if (countrySelect) countrySelect.addEventListener('change', updateCartSummary);

  const giftWrap = document.getElementById('giftWrap');
  if (giftWrap) giftWrap.addEventListener('change', updateCartSummary);

  updateCartSummary();

  // ----- Testimonial carousel -----
  const slides = document.querySelectorAll('.testimonial-slide');
  let slideIndex = 0;
  function updateTestimonialSlides() {
    slides.forEach((s, i) => {
      s.style.display = i === slideIndex ? 'block' : 'none';
    });
  }
  if (slides && slides.length > 0) {
    updateTestimonialSlides();
    setInterval(() => {
      slideIndex = (slideIndex + 1) % slides.length;
      updateTestimonialSlides();
    }, 4000);
  }

  // ----- Checkout form -----
  // Backend API URL (update this after deploying to Render)
  const PAYMENT_API_URL = 'https://mage-payment-backend.onrender.com';

  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cart = getCart();
      if (cart.length === 0) {
        showToast('Your cart is empty. Add items from Shop.');
        return;
      }

      const placeOrderBtn = document.getElementById('placeOrderBtn');
      const originalText = placeOrderBtn ? placeOrderBtn.textContent : 'Place Order';

      // Get form data
      const formData = new FormData(checkoutForm);
      const customer = {
        name: formData.get('name') || '',
        email: formData.get('email') || '',
        address: formData.get('address') || '',
      };

      // Calculate shipping
      const countrySelect = document.getElementById('country');
      const country = countrySelect ? countrySelect.value : '';
      let subtotal = 0;
      cart.forEach(item => { subtotal += (item.price || 0) * (item.qty || 1); });
      let shipping = 0;
      if (country === 'US') shipping = subtotal >= 75 ? 0 : 8;
      else if (country === 'CN') shipping = subtotal >= 100 ? 0 : 12;
      else if (country && country !== '') shipping = 15;

      const giftWrapEl = document.getElementById('giftWrap');
      const giftWrap = giftWrapEl ? giftWrapEl.checked : false;

      // Show loading state
      if (placeOrderBtn) {
        placeOrderBtn.textContent = 'Processing...';
        placeOrderBtn.disabled = true;
      }

      try {
        const response = await fetch(`${PAYMENT_API_URL}/create-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: cart,
            shipping: shipping,
            gift_wrap: giftWrap,
            customer: customer,
          }),
        });

        const data = await response.json();

        if (response.ok && data.checkout_url) {
          // Clear cart and redirect to Square checkout
          track('checkout_redirect', { total: subtotal + shipping + (giftWrap ? 5 : 0) });
          window.location.href = data.checkout_url;
        } else {
          // Show error or fallback to manual payment modal
          console.error('Checkout error:', data);
          const paymentModal = document.getElementById('paymentModal');
          if (paymentModal) {
            paymentModal.style.display = 'flex';
            paymentModal.setAttribute('aria-hidden', 'false');
          } else {
            showToast('Payment system unavailable. Please contact us to complete your order.');
          }
        }
      } catch (err) {
        console.error('Checkout fetch error:', err);
        // Fallback to manual payment modal
        const paymentModal = document.getElementById('paymentModal');
        if (paymentModal) {
          paymentModal.style.display = 'flex';
          paymentModal.setAttribute('aria-hidden', 'false');
        } else {
          showToast('Payment system unavailable. Please contact us to complete your order.');
        }
      } finally {
        // Restore button state
        if (placeOrderBtn) {
          placeOrderBtn.textContent = originalText;
          placeOrderBtn.disabled = false;
        }
      }

      track('checkout_submit');
    });
  }
  const paymentModal = document.getElementById('paymentModal');
  const paymentClose = document.querySelector('.payment-close');
  const paymentOk = document.getElementById('paymentModalOk');
  if (paymentModal) {
    if (paymentClose) paymentClose.addEventListener('click', () => { paymentModal.style.display = 'none'; paymentModal.setAttribute('aria-hidden', 'true'); });
    if (paymentOk) paymentOk.addEventListener('click', () => { paymentModal.style.display = 'none'; paymentModal.setAttribute('aria-hidden', 'true'); });
    paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) { paymentModal.style.display = 'none'; paymentModal.setAttribute('aria-hidden', 'true'); } });
  }

  // ----- Card Magic: pick a card, reveal -----
  const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = [{ s: '♠', name: 'Spades', red: false }, { s: '♥', name: 'Hearts', red: true }, { s: '♣', name: 'Clubs', red: false }, { s: '♦', name: 'Diamonds', red: true }];
  const VALUE_NAMES = { A: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', J: 'Jack', Q: 'Queen', K: 'King' };

  function buildDeck() {
    const deck = [];
    for (const v of VALUES) for (const suit of SUITS) deck.push({ value: v, suit: suit.s, suitName: suit.name, red: suit.red });
    return deck;
  }

  function shuffleDeck(deck) {
    const a = [...deck];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const magicModal = document.getElementById('magicModal');
  const magicCards = document.getElementById('magicCards');
  const magicReveal = document.getElementById('magicReveal');
  const magicRevealCard = document.getElementById('magicRevealCard');
  const magicPickAgain = document.getElementById('magicPickAgain');
  const magicModalClose = document.querySelector('.magic-modal-close');
  const magicAudio = new Audio('assets/roll.mp3');

  function openMagicModal() {
    if (!magicModal) return;
    magicModal.style.display = 'flex';
    magicModal.setAttribute('aria-hidden', 'false');
    shuffleMagicCards();
    if (magicReveal) magicReveal.classList.remove('visible');
    track('magic_modal_open');
  }

  function closeMagicModal() {
    if (magicModal) {
      magicModal.style.display = 'none';
      magicModal.setAttribute('aria-hidden', 'true');
    }
  }

  function shuffleMagicCards() {
    if (!magicCards) return;
    const deck = shuffleDeck(buildDeck());
    const five = deck.slice(0, 5);
    const cards = magicCards.querySelectorAll('.magic-card');
    cards.forEach((el, i) => {
      el.classList.remove('flipped');
      const card = five[i];
      const valueEl = el.querySelector('.magic-value');
      const suitEl = el.querySelector('.magic-suit');
      const front = el.querySelector('.magic-card-front');
      if (valueEl) valueEl.textContent = card.value;
      if (suitEl) suitEl.textContent = card.suit;
      if (front) front.classList.toggle('red', card.red);
      el.dataset.value = card.value;
      el.dataset.suitName = card.suitName;
      el.dataset.red = card.red ? '1' : '0';
    });
  }

  function onMagicCardClick(el) {
    if (el.classList.contains('flipped')) return;
    el.classList.add('flipped');
    const value = el.dataset.value;
    const suitName = el.dataset.suitName || '';
    const label = `${VALUE_NAMES[value] || value} of ${suitName}`;
    if (magicRevealCard) magicRevealCard.textContent = label;
    if (magicReveal) magicReveal.classList.add('visible');
    try { magicAudio.currentTime = 0; magicAudio.play().catch(() => {}); } catch (e) {}
    track('magic_card_reveal', { card: label });
  }

  document.querySelectorAll('.magic-trigger').forEach(btn => {
    btn.addEventListener('click', openMagicModal);
  });
  if (magicModalClose) magicModalClose.addEventListener('click', closeMagicModal);
  if (magicModal) {
    magicModal.addEventListener('click', (e) => { if (e.target === magicModal) closeMagicModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && magicModal.getAttribute('aria-hidden') === 'false') closeMagicModal();
    });
  }
  if (magicPickAgain) magicPickAgain.addEventListener('click', () => { shuffleMagicCards(); if (magicReveal) magicReveal.classList.remove('visible'); });
  if (magicCards) {
    magicCards.querySelectorAll('.magic-card').forEach(cardEl => {
      cardEl.addEventListener('click', () => onMagicCardClick(cardEl));
    });
  }
});
