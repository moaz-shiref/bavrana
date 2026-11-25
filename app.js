(function () {
  const STORAGE_KEYS = {
    PRODUCTS: 'bavrona_products_v1',
    SETTINGS: 'bavrona_settings_v1',
    CART: 'bavrona_cart_v1'
  };

  const FALLBACK_IMG =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#1E1E1E"/><text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#D4AF37" font-family="Arial, sans-serif" font-size="36" font-weight="bold">BAVRONA</text><text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#ADABAA" font-family="Arial, sans-serif" font-size="18">بافرونا لأدوات الحلاقة</text></svg>'
    );

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(fallback));
    } catch {
      return JSON.parse(JSON.stringify(fallback));
    }
  }

  let products = loadJSON(STORAGE_KEYS.PRODUCTS, window.BAVRONA_DEFAULT_PRODUCTS || []);
  let settings = Object.assign({}, window.BAVRONA_DEFAULT_SETTINGS, loadJSON(STORAGE_KEYS.SETTINGS, {}));
  let cart = loadJSON(STORAGE_KEYS.CART, []);

  // Filter & Pagination State
  let searchQuery = '';
  let selectedCategory = 'all';
  let sortMode = 'default';
  let maxPrice = 25000;
  let visibleLimit = 24;

  // Kit Builder State
  const kitState = {
    clipper: { name: 'بيبي ليس برو جولد إف إكس بوست+', price: 8950 },
    blade: { name: 'موس فيذر أرتيست كلوب SS', price: 4600 },
    care: { name: 'طقم زيت العود وفرشاة اللحية', price: 600 }
  };

  function saveProducts() {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }
  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }
  function saveCart() {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 2600);
  }

  function formatPrice(val) {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + (settings.currency || 'ج.م');
  }

  function normalizeArabic(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '')
      .trim();
  }

  // ==================== APPLY SETTINGS TO UI ====================
  function applySettingsToUI() {
    document.title = `${settings.siteName} — ${settings.siteSubtitle}`;
    const mapText = {
      'header-site-name': settings.siteName,
      'header-site-subtitle': settings.siteSubtitle,
      'footer-site-name': settings.siteName,
      'copyright-name': settings.siteName,
      'hero-badge': settings.heroBadge,
      'hero-title': settings.heroTitle,
      'hero-desc': settings.heroDesc,
      'topbar-phone': settings.vodafoneCashNumber,
      'footer-vfcash-num': settings.vodafoneCashNumber,
      'footer-extra-phones': settings.extraPhones,
      'footer-address': settings.address,
      'footer-hours': settings.workingHours,
      'hero-product-count': `${products.length}+`,
      'admin-prod-count': String(products.length)
    };
    Object.entries(mapText).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });

    const waBase = `https://wa.me/${settings.whatsappNumber}`;
    const topWa = document.getElementById('topbar-wa-link');
    const footWa = document.getElementById('footer-wa-btn');
    const floatWa = document.getElementById('float-wa-btn');
    const vfReceipt = document.getElementById('vfcash-wa-receipt-link');
    const phoneLink = document.getElementById('footer-phone-link');

    if (topWa) topWa.href = waBase;
    if (footWa) footWa.href = waBase;
    if (floatWa) floatWa.href = waBase;
    if (vfReceipt) {
      vfReceipt.href = `${waBase}?text=${encodeURIComponent(`مرحباً ${settings.siteName}، هذا إيصال تحويل فودافون كاش على رقم ${settings.vodafoneCashNumber}`)}`;
      vfReceipt.querySelector('span:last-child').textContent = `إرسال صورة التحويل على واتساب ${settings.vodafoneCashNumber}`;
    }
    if (phoneLink) phoneLink.href = `tel:${settings.displayPhone}`;

    // Update slider max based on highest product price
    const highest = Math.max(25000, ...products.map(p => Number(p.price) || 0));
    const rangeEl = document.getElementById('max-price-range');
    if (rangeEl) {
      rangeEl.max = String(highest);
      if (maxPrice > highest || maxPrice === 25000) {
        maxPrice = highest;
        rangeEl.value = String(highest);
      }
      document.getElementById('max-price-label').textContent = formatPrice(maxPrice);
    }
  }

  // ==================== CATALOG RENDERING & SEARCH ====================
  function getFilteredProducts() {
    const q = normalizeArabic(searchQuery);
    let list = products.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (Number(p.price) > maxPrice) return false;
      if (q) {
        const haystack = normalizeArabic(`${p.name} ${p.brand} ${p.category} ${p.specs}`);
        return q.split(/\s+/).every(term => haystack.includes(term));
      }
      return true;
    });

    if (sortMode === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sortMode === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (sortMode === 'rating-desc') list = [...list].sort((a, b) => b.rating - a.rating);

    return list;
  }

  function renderCatalog() {
    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('results-count');
    const paginationEl = document.getElementById('pagination-controls');
    if (!grid) return;

    const filtered = getFilteredProducts();
    if (countEl) countEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-surface-container border border-outline-variant rounded-xl p-10 text-center space-y-3">
          <span class="material-symbols-outlined text-4xl text-primary">search_off</span>
          <p class="font-headline text-lg font-bold text-on-surface">لم يتم العثور على منتجات مطابقة</p>
          <p class="text-sm text-on-surface-variant">جرّب البحث بكلمة أخرى أو زيادة الحد الأقصى للسعر.</p>
        </div>
      `;
      if (paginationEl) paginationEl.classList.add('hidden');
      return;
    }

    const toShow = searchQuery.trim() ? filtered : filtered.slice(0, visibleLimit);

    grid.innerHTML = toShow
      .map(
        p => `
      <article class="bg-surface-container border border-outline-variant hover:border-primary/70 rounded-lg overflow-hidden flex flex-col justify-between transition-colors h-full group">
        <div>
          <div class="relative aspect-square bg-surface-container-high overflow-hidden">
            <img src="${p.image || FALLBACK_IMG}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'" alt="${p.name}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
            <span class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-surface/85 backdrop-blur text-[11px] font-semibold text-primary border border-outline-variant">${p.category}</span>
          </div>
          <div class="p-4 pb-2">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs font-bold uppercase tracking-wider text-primary">${p.brand}</span>
              <span class="font-mono text-xs text-on-surface-variant tabular-nums">${p.rating} ★ (${p.reviews})</span>
            </div>
            <h3 class="font-title text-base font-bold text-on-surface leading-snug line-clamp-2">${p.name}</h3>
            <p class="text-xs text-on-surface-variant mt-1.5 line-clamp-2">${p.specs}</p>
          </div>
        </div>
        <div>
          <div class="px-4 pt-1">
            <p class="font-mono text-lg font-bold text-primary tabular-nums">${formatPrice(p.price)}</p>
          </div>
          <footer class="p-4 pt-3 flex items-center gap-2">
            <button type="button" data-add-cart="${p.id}" class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-primary text-on-primary hover:bg-primary-hover font-bold text-xs transition-colors cursor-pointer">
              <span class="material-symbols-outlined text-base">add_shopping_cart</span>
              <span>أضف للسلة</span>
            </button>
            <button type="button" data-quick-view="${p.id}" class="inline-flex items-center justify-center px-3 py-2 rounded border border-outline text-on-surface hover:border-primary hover:text-primary text-xs font-semibold transition-colors cursor-pointer">
              التفاصيل
            </button>
          </footer>
        </div>
      </article>
    `
      )
      .join('');

    if (paginationEl) {
      if (!searchQuery.trim() && filtered.length > visibleLimit) {
        paginationEl.classList.remove('hidden');
      } else {
        paginationEl.classList.add('hidden');
      }
    }
  }

  // ==================== CART LOGIC ====================
  function renderCart() {
    const listEl = document.getElementById('cart-items-list');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalQtyEl = document.getElementById('cart-total-qty');
    const badgeEl = document.getElementById('cart-count-badge');

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    if (badgeEl) badgeEl.textContent = String(totalItems);
    if (totalQtyEl) totalQtyEl.textContent = String(totalItems);
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

    if (!listEl) return;

    if (cart.length === 0) {
      listEl.innerHTML = `
        <div class="py-12 text-center space-y-3">
          <span class="material-symbols-outlined text-4xl text-on-surface-variant">shopping_bag</span>
          <p class="text-sm text-on-surface-variant">السلة فارغة حالياً. أضف منتجات الحلاقة أو صمم عدتك الخاصة.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = cart
      .map(
        (item, idx) => `
      <div class="flex items-center gap-3 p-3 rounded-lg bg-surface-container-high border border-outline-variant">
        <img src="${item.image || FALLBACK_IMG}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'" alt="${item.name}" class="w-16 h-16 rounded object-cover shrink-0 bg-surface">
        <div class="flex-1 min-w-0">
          <p class="font-title text-sm font-bold text-on-surface truncate">${item.name}</p>
          <p class="font-mono text-xs text-primary font-semibold tabular-nums mt-0.5">${formatPrice(item.price)} × ${item.qty} = ${formatPrice(item.price * item.qty)}</p>
          <div class="flex items-center gap-2 mt-2">
            <button type="button" data-cart-dec="${idx}" class="w-7 h-7 rounded border border-outline text-on-surface hover:border-primary font-bold cursor-pointer">-</button>
            <span class="font-mono text-xs font-bold tabular-nums w-5 text-center">${item.qty}</span>
            <button type="button" data-cart-inc="${idx}" class="w-7 h-7 rounded border border-outline text-on-surface hover:border-primary font-bold cursor-pointer">+</button>
          </div>
        </div>
        <button type="button" data-cart-remove="${idx}" aria-label="حذف المنتج" class="text-on-surface-variant hover:text-error cursor-pointer p-1">
          <span class="material-symbols-outlined text-lg">delete</span>
        </button>
      </div>
    `
      )
      .join('');
  }

  function addToCart(item) {
    const existing = cart.find(c => c.id === item.id);
    if (existing) existing.qty += 1;
    else cart.push({ ...item, qty: 1 });
    saveCart();
    renderCart();
    showToast(`تمت إضافة "${item.name}" إلى السلة`);
  }

  // ==================== EVENT LISTENERS ====================
  const cartDrawer = document.getElementById('cart-drawer');
  const qvModal = document.getElementById('quick-view-modal');
  const bookingModal = document.getElementById('booking-modal');
  const adminModal = document.getElementById('admin-modal');
  let currentQvProduct = null;

  // Header & Mobile Nav
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-nav')?.classList.toggle('hidden');
  });
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => document.getElementById('mobile-nav')?.classList.add('hidden'));
  });
  document.getElementById('scroll-top-btn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Search Inputs Sync
  function handleSearchInput(val) {
    searchQuery = val;
    const hSearch = document.getElementById('header-search');
    const mSearch = document.getElementById('mobile-search');
    const cSearch = document.getElementById('catalog-search');
    if (hSearch && hSearch.value !== val) hSearch.value = val;
    if (mSearch && mSearch.value !== val) mSearch.value = val;
    if (cSearch && cSearch.value !== val) cSearch.value = val;
    renderCatalog();
  }

  ['header-search', 'mobile-search', 'catalog-search'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', e => {
      handleSearchInput(e.target.value);
      if (id !== 'catalog-search' && e.target.value.trim().length > 0) {
        document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  document.getElementById('category-select')?.addEventListener('change', e => {
    selectedCategory = e.target.value;
    visibleLimit = 24;
    renderCatalog();
  });

  document.getElementById('sort-select')?.addEventListener('change', e => {
    sortMode = e.target.value;
    renderCatalog();
  });

  document.getElementById('max-price-range')?.addEventListener('input', e => {
    maxPrice = Number(e.target.value);
    document.getElementById('max-price-label').textContent = formatPrice(maxPrice);
    renderCatalog();
  });

  document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
    selectedCategory = 'all';
    sortMode = 'default';
    const rangeEl = document.getElementById('max-price-range');
    maxPrice = Number(rangeEl?.max || 25000);
    if (rangeEl) rangeEl.value = String(maxPrice);
    document.getElementById('max-price-label').textContent = formatPrice(maxPrice);
    document.getElementById('category-select').value = 'all';
    document.getElementById('sort-select').value = 'default';
    visibleLimit = 24;
    handleSearchInput('');
  });

  document.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      handleSearchInput(btn.dataset.quickSearch || '');
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.cat-card').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.filterCat || 'all';
      document.getElementById('category-select').value = selectedCategory;
      visibleLimit = 24;
      renderCatalog();
      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.getElementById('load-more-btn')?.addEventListener('click', () => {
    visibleLimit += 24;
    renderCatalog();
  });
  document.getElementById('show-all-btn')?.addEventListener('click', () => {
    visibleLimit = products.length + 100;
    renderCatalog();
  });

  // Grid Click Delegation (Add to Cart & Quick View)
  document.getElementById('products-grid')?.addEventListener('click', e => {
    const addBtn = e.target.closest('[data-add-cart]');
    const qvBtn = e.target.closest('[data-quick-view]');
    if (addBtn) {
      const p = products.find(item => item.id === addBtn.dataset.addCart);
      if (p) addToCart({ id: p.id, name: p.name, price: Number(p.price), image: p.image });
    } else if (qvBtn) {
      const p = products.find(item => item.id === qvBtn.dataset.quickView);
      if (!p) return;
      currentQvProduct = p;
      document.getElementById('qv-brand').textContent = p.brand;
      document.getElementById('qv-title').textContent = p.name;
      const img = document.getElementById('qv-img');
      img.src = p.image || FALLBACK_IMG;
      img.onerror = () => {
        img.src = FALLBACK_IMG;
      };
      document.getElementById('qv-price').textContent = formatPrice(p.price);
      document.getElementById('qv-rating').textContent = `${p.rating} ★ (${p.reviews})`;
      document.getElementById('qv-cat').textContent = p.category;
      document.getElementById('qv-specs').textContent = p.specs;
      document.getElementById('qv-bullets').innerHTML = (p.bullets || []).map(b => `<li>• ${b}</li>`).join('');
      qvModal.showModal();
    }
  });

  document.getElementById('close-qv-btn')?.addEventListener('click', () => qvModal.close());
  document.getElementById('qv-cancel-btn')?.addEventListener('click', () => qvModal.close());
  document.getElementById('qv-add-btn')?.addEventListener('click', () => {
    if (currentQvProduct) {
      addToCart({
        id: currentQvProduct.id,
        name: currentQvProduct.name,
        price: Number(currentQvProduct.price),
        image: currentQvProduct.image
      });
      qvModal.close();
      cartDrawer.showModal();
    }
  });

  // Cart Drawer Events
  document.getElementById('open-cart-btn')?.addEventListener('click', () => {
    renderCart();
    cartDrawer.showModal();
  });
  document.getElementById('close-cart-btn')?.addEventListener('click', () => cartDrawer.close());

  document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
    if (cart.length === 0) return;
    cart = [];
    saveCart();
    renderCart();
    showToast('تم تفريغ السلة بالكامل');
  });

  document.getElementById('cart-items-list')?.addEventListener('click', e => {
    const inc = e.target.closest('[data-cart-inc]');
    const dec = e.target.closest('[data-cart-dec]');
    const rem = e.target.closest('[data-cart-remove]');
    if (inc) {
      cart[Number(inc.dataset.cartInc)].qty += 1;
    } else if (dec) {
      const i = Number(dec.dataset.cartDec);
      if (cart[i].qty > 1) cart[i].qty -= 1;
      else cart.splice(i, 1);
    } else if (rem) {
      cart.splice(Number(rem.dataset.cartRemove), 1);
    } else return;
    saveCart();
    renderCart();
  });

  // WhatsApp Cart Checkout
  document.getElementById('whatsapp-checkout-btn')?.addEventListener('click', () => {
    if (cart.length === 0) {
      showToast('السلة فارغة! أضف منتجات أولاً');
      return;
    }
    const name = document.getElementById('order-name').value.trim();
    const phone = document.getElementById('order-phone').value.trim();
    const address = document.getElementById('order-address').value.trim() || 'غير محدد';
    const payment = document.getElementById('order-payment').value;

    if (!name || !phone) {
      showToast('يرجى كتابة الاسم ورقم الموبايل لإرسال الحجز');
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const lines = [
      `🛍️ *طلب / حجز جديد من متجر ${settings.siteName}*`,
      `━━━━━━━━━━━━━━━`,
      `👤 *الاسم:* ${name}`,
      `📱 *الموبايل:* ${phone}`,
      `📍 *العنوان:* ${address}`,
      `💳 *طريقة الدفع:* ${payment}`,
      `━━━━━━━━━━━━━━━`,
      `📦 *المنتجات المطلوبة:*`
    ];
    cart.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.name} × ${item.qty} = ${formatPrice(item.price * item.qty)}`);
    });
    lines.push(`━━━━━━━━━━━━━━━`);
    lines.push(`💰 *الإجمالي المطلوب:* ${formatPrice(total)}`);

    const url = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');
  });

  // Copy Vodafone Cash Number
  document.getElementById('copy-vfcash-btn')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(settings.vodafoneCashNumber);
    showToast(`تم نسخ رقم فودافون كاش: ${settings.vodafoneCashNumber}`);
  });

  // ==================== KIT BUILDER ====================
  function updateKitSummary() {
    document.getElementById('kit-summary-clipper').textContent = kitState.clipper.name;
    document.getElementById('kit-price-clipper').textContent = formatPrice(kitState.clipper.price);
    document.getElementById('kit-summary-blade').textContent = kitState.blade.name;
    document.getElementById('kit-price-blade').textContent = formatPrice(kitState.blade.price);
    document.getElementById('kit-summary-care').textContent = kitState.care.name;
    document.getElementById('kit-price-care').textContent = formatPrice(kitState.care.price);

    const retail = kitState.clipper.price + kitState.blade.price + kitState.care.price;
    const discount = retail * 0.15;
    const finalTotal = retail - discount;

    document.getElementById('kit-retail-total').textContent = formatPrice(retail);
    document.getElementById('kit-discount').textContent = '-' + formatPrice(discount);
    document.getElementById('kit-final-total').textContent = formatPrice(finalTotal);
  }

  document.querySelectorAll('.kit-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const step = opt.dataset.kitStep;
      document.querySelectorAll(`.kit-option[data-kit-step="${step}"]`).forEach(sib => {
        sib.classList.remove('border-primary', 'bg-primary-container/40');
        sib.classList.add('border-outline-variant', 'bg-surface-container-high');
      });
      opt.classList.remove('border-outline-variant', 'bg-surface-container-high');
      opt.classList.add('border-primary', 'bg-primary-container/40');

      kitState[step] = { name: opt.dataset.kitName, price: Number(opt.dataset.kitPrice) };
      updateKitSummary();
    });
  });

  document.getElementById('add-kit-to-cart')?.addEventListener('click', () => {
    const retail = kitState.clipper.price + kitState.blade.price + kitState.care.price;
    const finalTotal = Math.round(retail * 0.85);
    addToCart({
      id: `kit-${kitState.clipper.price}-${kitState.blade.price}-${kitState.care.price}`,
      name: `باقة بافرونا الخاصة (${kitState.clipper.name.split(' ')[0]} + ${kitState.blade.name.split(' ')[0]})`,
      price: finalTotal,
      image: products[0]?.image || FALLBACK_IMG
    });
    cartDrawer.showModal();
  });

  // ==================== SALON APPOINTMENT BOOKING ====================
  document.getElementById('open-booking-btn')?.addEventListener('click', () => bookingModal.showModal());
  document.getElementById('close-booking-btn')?.addEventListener('click', () => bookingModal.close());
  document.getElementById('booking-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('book-name').value.trim();
    const phone = document.getElementById('book-phone').value.trim();
    const service = document.getElementById('book-service').value;
    const time = document.getElementById('book-time').value.trim() || 'أقرب موعد متاح';
    const msg = `✂️ *حجز موعد حلاقة - ${settings.siteName}*\n👤 الاسم: ${name}\n📱 الموبايل: ${phone}\n💈 الخدمة: ${service}\n🕒 الموعد: ${time}`;
    window.open(`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    bookingModal.close();
  });

  // ==================== NO-CODE ADMIN PANEL ====================
  function openAdminPanel() {
    renderAdminProducts();
    fillSettingsForm();
    adminModal.showModal();
  }

  document.getElementById('open-admin-btn')?.addEventListener('click', openAdminPanel);
  document.getElementById('footer-admin-btn')?.addEventListener('click', openAdminPanel);
  document.getElementById('close-admin-btn')?.addEventListener('click', () => adminModal.close());

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => {
        b.classList.remove('bg-primary', 'text-on-primary');
        b.classList.add('bg-surface-container-high', 'text-on-surface', 'border', 'border-outline-variant');
      });
      btn.classList.add('bg-primary', 'text-on-primary');
      btn.classList.remove('bg-surface-container-high', 'text-on-surface', 'border', 'border-outline-variant');

      document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(`admin-tab-${btn.dataset.adminTab}`)?.classList.remove('hidden');
    });
  });

  function renderAdminProducts(filter = '') {
    const listEl = document.getElementById('admin-products-list');
    if (!listEl) return;
    const q = normalizeArabic(filter);
    const items = q
      ? products.filter(p => normalizeArabic(`${p.name} ${p.brand} ${p.category}`).includes(q))
      : products.slice(0, 40);

    listEl.innerHTML =
      (!q && products.length > 40
        ? `<p class="text-xs text-primary pb-1">يتم عرض أول 40 منتج — ابحث بالأعلى للوصول الفوري لأي منتج من الـ ${products.length} منتج.</p>`
        : '') +
      items
        .map(
          p => `
      <div class="bg-surface-container border border-outline-variant rounded-lg p-3 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
        <div class="md:col-span-4">
          <input type="text" value="${p.name.replace(/"/g, '&quot;')}" data-edit-field="name" data-edit-id="${p.id}" class="w-full bg-surface-container-high border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface">
        </div>
        <div class="md:col-span-2">
          <input type="text" value="${p.brand.replace(/"/g, '&quot;')}" data-edit-field="brand" data-edit-id="${p.id}" class="w-full bg-surface-container-high border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface">
        </div>
        <div class="md:col-span-2">
          <input type="number" value="${p.price}" data-edit-field="price" data-edit-id="${p.id}" class="w-full bg-surface-container-high border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono text-primary font-bold">
        </div>
        <div class="md:col-span-3">
          <input type="text" value="${(p.image || '').replace(/"/g, '&quot;')}" placeholder="رابط الصورة" data-edit-field="image" data-edit-id="${p.id}" class="w-full bg-surface-container-high border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface-variant">
        </div>
        <div class="md:col-span-1 flex justify-end">
          <button type="button" data-admin-del="${p.id}" title="حذف المنتج" class="p-1.5 rounded bg-error-container/60 text-error hover:bg-error-container cursor-pointer">
            <span class="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>
    `
        )
        .join('');
  }

  document.getElementById('admin-search-input')?.addEventListener('input', e => {
    renderAdminProducts(e.target.value);
  });

  document.getElementById('admin-products-list')?.addEventListener('change', e => {
    const input = e.target.closest('[data-edit-id]');
    if (!input) return;
    const p = products.find(item => item.id === input.dataset.editId);
    if (!p) return;
    const field = input.dataset.editField;
    p[field] = field === 'price' ? Math.max(0, Number(input.value) || 0) : input.value;
    saveProducts();
    applySettingsToUI();
    renderCatalog();
    showToast('تم حفظ التعديل تلقائياً');
  });

  document.getElementById('admin-products-list')?.addEventListener('click', e => {
    const del = e.target.closest('[data-admin-del]');
    if (!del) return;
    products = products.filter(item => item.id !== del.dataset.adminDel);
    saveProducts();
    applySettingsToUI();
    renderCatalog();
    renderAdminProducts(document.getElementById('admin-search-input')?.value || '');
    showToast('تم حذف المنتج');
  });

  // Upload local image as base64 for new product
  let uploadedImageData = '';
  document.getElementById('add-image-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadedImageData = String(reader.result || '');
      showToast('تم تجهيز الصورة من جهازك');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('admin-add-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const newProd = {
      id: 'custom-' + Date.now(),
      name: document.getElementById('add-name').value.trim(),
      brand: document.getElementById('add-brand').value.trim() || settings.siteName,
      category: document.getElementById('add-category').value,
      price: Number(document.getElementById('add-price').value) || 100,
      rating: 5.0,
      reviews: 1,
      image: uploadedImageData || document.getElementById('add-image').value.trim() || products[0]?.image || FALLBACK_IMG,
      specs: document.getElementById('add-specs').value.trim() || 'منتج احترافي من بافرونا',
      bullets: ['جودة مضمونة', 'متوفر للشحن الفوري']
    };
    products.unshift(newProd);
    uploadedImageData = '';
    e.target.reset();
    saveProducts();
    applySettingsToUI();
    renderCatalog();
    renderAdminProducts();
    showToast('تمت إضافة المنتج الجديد للمتجر بنجاح!');
  });

  // Settings Form
  function fillSettingsForm() {
    const keys = [
      'siteName',
      'siteSubtitle',
      'heroTitle',
      'heroBadge',
      'heroDesc',
      'whatsappNumber',
      'vodafoneCashNumber',
      'extraPhones',
      'currency',
      'address',
      'workingHours'
    ];
    keys.forEach(k => {
      const el = document.getElementById(`set-${k}`);
      if (el) el.value = settings[k] || '';
    });
  }

  document.getElementById('admin-settings-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const keys = [
      'siteName',
      'siteSubtitle',
      'heroTitle',
      'heroBadge',
      'heroDesc',
      'whatsappNumber',
      'vodafoneCashNumber',
      'extraPhones',
      'currency',
      'address',
      'workingHours'
    ];
    keys.forEach(k => {
      const el = document.getElementById(`set-${k}`);
      if (el) settings[k] = el.value.trim();
    });
    saveSettings();
    applySettingsToUI();
    renderCatalog();
    renderCart();
    updateKitSummary();
    showToast('تم حفظ وتطبيق إعدادات الموقع بنجاح!');
  });

  // Bulk Price Update
  document.getElementById('apply-bulk-price-btn')?.addEventListener('click', () => {
    const cat = document.getElementById('bulk-category').value;
    const pct = Number(document.getElementById('bulk-percent').value);
    if (!pct || Number.isNaN(pct)) {
      showToast('اكتب نسبة مئوية صحيحة (مثلاً 10 أو -10)');
      return;
    }
    products.forEach(p => {
      if (cat === 'all' || p.category === cat) {
        p.price = Math.max(1, Math.round(p.price * (1 + pct / 100)));
      }
    });
    saveProducts();
    applySettingsToUI();
    renderCatalog();
    renderAdminProducts();
    showToast(`تم تعديل الأسعار بنسبة ${pct}%`);
  });

  // Export Backup
  document.getElementById('export-data-btn')?.addEventListener('click', () => {
    const dataStr = JSON.stringify({ settings, products }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bavrona-backup.json';
    a.click();
  });

  // Restore Defaults
  document.getElementById('reset-defaults-btn')?.addEventListener('click', () => {
    if (!confirm('هل أنت متأكد من استعادة الـ 150 منتج والإعدادات الأصلية؟')) return;
    products = JSON.parse(JSON.stringify(window.BAVRONA_DEFAULT_PRODUCTS || []));
    settings = JSON.parse(JSON.stringify(window.BAVRONA_DEFAULT_SETTINGS || {}));
    saveProducts();
    saveSettings();
    applySettingsToUI();
    renderCatalog();
    renderAdminProducts();
    fillSettingsForm();
    showToast('تمت استعادة البيانات الأصلية بنجاح');
  });

  // Initial Boot
  applySettingsToUI();
  renderCatalog();
  renderCart();
  updateKitSummary();
})();
