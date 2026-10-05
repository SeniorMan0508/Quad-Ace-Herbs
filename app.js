/**
 * QUAD-ACE HERBS - APPLICATION LOGIC
 * ==================================
 * E-commerce engine handling cart, real-time filtering,
 * interactive remedy quiz, bank transfer checkout, and WhatsApp order dispatch.
 */

(function () {
  "use strict";

  // --- STATE ---
  const state = {
    cart: [],
    activeCategory: "all",
    activeSearch: "",
    activeSort: "featured",
    selectedShipping: "local",
    selectedPaymentMethod: "bank",
    appliedCoupon: null,
    discountAmount: 0,
    currentQuickViewProduct: null,
    lastOrder: null
  };

  // --- HELPER: FORMAT CURRENCY ---
  function formatMoney(amount) {
    const symbol = STORE_CONFIG.currencySymbol || "₦";
    return symbol + Number(amount).toLocaleString("en-NG");
  }

  // --- LOCAL STORAGE CART PERSISTENCE ---
  function loadCart() {
    try {
      const saved = localStorage.getItem("quadace_cart");
      if (saved) {
        state.cart = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Could not load cart from storage", e);
      state.cart = [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem("quadace_cart", JSON.stringify(state.cart));
    } catch (e) {
      console.warn("Could not save cart", e);
    }
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, icon = "🌿") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Trigger reflow & show
    setTimeout(() => toast.classList.add("show"), 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  // --- INITIALIZE STORE CONFIG DATA INTO UI ---
  function initStoreConfig() {
    // Brand titles
    const navBrand = document.getElementById("navBrandName");
    if (navBrand) navBrand.textContent = STORE_CONFIG.storeName;
    const navTag = document.getElementById("navTagline");
    if (navTag) navTag.textContent = STORE_CONFIG.tagline;

    // Contact info
    const barPhone = document.getElementById("barPhone");
    if (barPhone) barPhone.textContent = STORE_CONFIG.sellerPhone;

    // Current Year in footer
    const currentYear = document.getElementById("currentYear");
    if (currentYear) currentYear.textContent = new Date().getFullYear();

    // Bank Details in Checkout
    const checkoutBankName = document.getElementById("checkoutBankName");
    if (checkoutBankName) checkoutBankName.textContent = STORE_CONFIG.bankDetails.bankName;
    const checkoutAccountNumber = document.getElementById("checkoutAccountNumber");
    if (checkoutAccountNumber) checkoutAccountNumber.textContent = STORE_CONFIG.bankDetails.accountNumber;
    const checkoutAccountName = document.getElementById("checkoutAccountName");
    if (checkoutAccountName) checkoutAccountName.textContent = STORE_CONFIG.bankDetails.accountName;
    const checkoutBankInstructions = document.getElementById("checkoutBankInstructions");
    if (checkoutBankInstructions) checkoutBankInstructions.textContent = STORE_CONFIG.bankDetails.transferInstructions;

    // Shipping Rates in Checkout Step 2
    const rateLocal = document.getElementById("rateLocal");
    if (rateLocal) rateLocal.textContent = formatMoney(STORE_CONFIG.shipping.local.price);
    const rateNationwide = document.getElementById("rateNationwide");
    if (rateNationwide) rateNationwide.textContent = STORE_CONFIG.shipping.nationwide.feeLabel || "Sorted with dispatch rider";
    const rateInternational = document.getElementById("rateInternational");
    if (rateInternational) rateInternational.textContent = STORE_CONFIG.shipping.international.feeLabel || "Sorted with courier";
  }

  // --- RENDER CATEGORY PILLS ---
  function renderCategories() {
    const pillsContainer = document.getElementById("categoryPills");
    if (!pillsContainer) return;

    pillsContainer.innerHTML = CATEGORIES.map(cat => `
      <button class="pill-btn ${cat.id === state.activeCategory ? 'active' : ''}" data-category="${cat.id}">
        <span>${cat.icon}</span>
        <span>${cat.label}</span>
      </button>
    `).join("");

    pillsContainer.querySelectorAll(".pill-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.dataset.category;
        renderCategories();
        renderProducts();
      });
    });
  }

  // --- FILTER & SORT PRODUCTS ---
  function getFilteredProducts() {
    let list = [...PRODUCTS_DATA];

    // Filter by Category
    if (state.activeCategory !== "all") {
      list = list.filter(p => p.category === state.activeCategory);
    }

    // Filter by Search Query
    if (state.activeSearch.trim()) {
      const q = state.activeSearch.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.shortDesc.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        p.healthGoals.some(g => g.toLowerCase().includes(q))
      );
    }

    // Sort
    if (state.activeSort === "price-low") {
      list.sort((a, b) => a.price - b.price);
    } else if (state.activeSort === "price-high") {
      list.sort((a, b) => b.price - a.price);
    } else if (state.activeSort === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }

  // --- RENDER PRODUCTS GRID ---
  function renderProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    const products = getFilteredProducts();

    if (products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🌿</div>
          <h3 style="font-family: var(--font-heading); color: var(--deep-forest); margin-bottom: 0.5rem;">No remedies matched your search</h3>
          <p>Try searching with another keyword or explore our full herbal catalog.</p>
          <button class="btn-primary" style="margin-top: 1.5rem;" onclick="window.app.resetFilters()">View All Herbs</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(product => {
      return `
        <div class="product-card" data-id="${product.id}">
          <div class="product-thumb-container">
            ${product.badge ? `<span class="product-badge ${product.badgeType || 'standard'}">${product.badge}</span>` : ''}
            <img src="${product.image}" alt="${product.name}" loading="lazy">
            <button class="quick-view-overlay-btn" onclick="window.app.openQuickView('${product.id}')">
              🔍 Quick Details
            </button>
          </div>

          <div class="product-card-body">
            <div class="product-meta-row">
              <span class="product-category-tag">${product.categoryLabel}</span>
              <span class="product-rating">★ ${product.rating.toFixed(1)} (${product.reviewsCount})</span>
            </div>

            <h3 class="product-title">${product.name}</h3>
            <p class="product-desc">${product.shortDesc}</p>

            <div class="product-card-footer">
              <div class="product-price-stack">
                <span class="current-price">${formatMoney(product.price)}</span>
                ${product.originalPrice ? `<span class="original-price">${formatMoney(product.originalPrice)}</span>` : ''}
              </div>
              <button class="add-to-cart-btn" onclick="window.app.addToCart('${product.id}')">
                <span>+ Add</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // --- CART MANAGEMENT ---
  function getCartSubtotal() {
    return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  function getCartCount() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function addToCart(productId, quantity = 1) {
    const product = PRODUCTS_DATA.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = state.cart.findIndex(item => item.id === productId);
    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += quantity;
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: quantity
      });
    }

    saveCart();
    updateCartUI();
    showToast(`Added ${product.name} to cart!`, "🛒");
  }

  function changeCartQty(productId, delta) {
    const index = state.cart.findIndex(item => item.id === productId);
    if (index === -1) return;

    state.cart[index].quantity += delta;
    if (state.cart[index].quantity <= 0) {
      state.cart.splice(index, 1);
      showToast("Item removed from cart", "🗑️");
    }
    saveCart();
    updateCartUI();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showToast("Item removed", "🗑️");
  }

  function updateCartUI() {
    // Badges & Counters
    const cartCountEl = document.getElementById("cartCount");
    const drawerItemCount = document.getElementById("drawerItemCount");
    const count = getCartCount();
    if (cartCountEl) cartCountEl.textContent = count;
    if (drawerItemCount) drawerItemCount.textContent = `(${count} item${count === 1 ? '' : 's'})`;

    // Cart Items Container
    const itemsList = document.getElementById("cartItemsList");
    const cartFooter = document.getElementById("cartFooter");
    const freeShippingContainer = document.getElementById("freeShippingContainer");

    if (!itemsList) return;

    if (state.cart.length === 0) {
      itemsList.innerHTML = `
        <div class="empty-cart-message">
          <div class="empty-cart-icon">🌿</div>
          <h4 style="font-family: var(--font-heading); color: var(--deep-forest); margin-bottom: 0.5rem;">Your herbal basket is empty</h4>
          <p style="font-size: 0.88rem; margin-bottom: 1.5rem;">Discover our authentic Agbo, vitality roots, and wildcrafted teas.</p>
          <button class="btn-primary" onclick="window.app.closeCart(); window.location.hash='#catalog';">
            <span>Explore Remedies</span>
          </button>
        </div>
      `;
      if (cartFooter) cartFooter.style.display = "none";
      if (freeShippingContainer) freeShippingContainer.style.display = "none";
      return;
    }

    if (cartFooter) cartFooter.style.display = "block";
    if (freeShippingContainer) freeShippingContainer.style.display = "block";

    // Render items
    itemsList.innerHTML = state.cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-info">
          <h4 class="cart-item-title">${item.name}</h4>
          <span class="cart-item-price">${formatMoney(item.price)}</span>
          <div class="cart-qty-controls">
            <div class="qty-pill">
              <button class="qty-btn" onclick="window.app.changeCartQty('${item.id}', -1)">−</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn" onclick="window.app.changeCartQty('${item.id}', 1)">+</button>
            </div>
            <button class="remove-item-btn" onclick="window.app.removeFromCart('${item.id}')">Remove</button>
          </div>
        </div>
      </div>
    `).join("");

    // Calculate totals
    const subtotal = getCartSubtotal();
    let discount = 0;
    if (state.appliedCoupon) {
      if (state.appliedCoupon.type === "percentage") {
        discount = Math.round((subtotal * state.appliedCoupon.value) / 100);
      } else if (state.appliedCoupon.type === "fixed") {
        discount = Math.min(state.appliedCoupon.value, subtotal);
      }
    }
    state.discountAmount = discount;

    const grandTotal = Math.max(0, subtotal - discount);

    // Update Elements
    const cartSubtotalEl = document.getElementById("cartSubtotal");
    const cartGrandTotalEl = document.getElementById("cartGrandTotal");
    const discountRow = document.getElementById("discountRow");
    const cartDiscountEl = document.getElementById("cartDiscount");

    if (cartSubtotalEl) cartSubtotalEl.textContent = formatMoney(subtotal);
    if (cartGrandTotalEl) cartGrandTotalEl.textContent = formatMoney(grandTotal);

    if (discount > 0) {
      if (discountRow) discountRow.style.display = "flex";
      if (cartDiscountEl) cartDiscountEl.textContent = `-${formatMoney(discount)}`;
    } else {
      if (discountRow) discountRow.style.display = "none";
    }

    // Free shipping threshold progress
    const threshold = STORE_CONFIG.shipping.freeShippingThreshold || 50000;
    const progressFill = document.getElementById("shippingProgressFill");
    const freeShippingText = document.getElementById("freeShippingText");
    if (progressFill && freeShippingText) {
      if (subtotal >= threshold) {
        progressFill.style.width = "100%";
        freeShippingText.innerHTML = `🎉 <strong>Congratulations!</strong> You qualified for FREE Lagos delivery!`;
      } else {
        const remaining = threshold - subtotal;
        const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
        progressFill.style.width = `${pct}%`;
        freeShippingText.innerHTML = `Add <strong>${formatMoney(remaining)}</strong> more for FREE Lagos Delivery!`;
      }
    }
  }

  // --- COUPON APPLICATION ---
  function applyCoupon() {
    const input = document.getElementById("couponInput");
    const msg = document.getElementById("couponMessage");
    if (!input || !msg) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
      msg.textContent = "Please enter a coupon code.";
      msg.style.color = "#c0392b";
      msg.style.display = "block";
      return;
    }

    const promo = STORE_CONFIG.discounts[code];
    if (promo) {
      state.appliedCoupon = promo;
      msg.textContent = `✓ ${promo.label} applied successfully!`;
      msg.style.color = "#27ae60";
      msg.style.display = "block";
      showToast(`${promo.label} applied!`, "🏷️");
      updateCartUI();
    } else {
      msg.textContent = "Invalid code. Try QUADACE10 for 10% off!";
      msg.style.color = "#c0392b";
      msg.style.display = "block";
    }
  }

  // --- CART DRAWER OPEN / CLOSE ---
  function openCart() {
    const overlay = document.getElementById("cartOverlay");
    if (overlay) overlay.classList.add("active");
  }

  function closeCart() {
    const overlay = document.getElementById("cartOverlay");
    if (overlay) overlay.classList.remove("active");
  }

  // --- QUICK VIEW MODAL ---
  function openQuickView(productId) {
    const product = PRODUCTS_DATA.find(p => p.id === productId);
    if (!product) return;

    state.currentQuickViewProduct = product;

    document.getElementById("qvImage").src = product.image;
    document.getElementById("qvImage").alt = product.name;
    document.getElementById("qvCategory").textContent = product.categoryLabel;
    document.getElementById("qvTitle").textContent = product.name;
    document.getElementById("qvSubtitle").textContent = product.subtitle;
    document.getElementById("qvPrice").textContent = formatMoney(product.price);
    document.getElementById("qvFullDesc").textContent = product.fullDesc;

    // Benefits list
    const benefitsEl = document.getElementById("qvBenefits");
    benefitsEl.innerHTML = product.benefits.map(b => `<li>${b}</li>`).join("");

    // Ingredients & Usage
    document.getElementById("qvIngredients").textContent = product.ingredients.join(" • ");
    document.getElementById("qvUsage").textContent = product.usage;

    // Caution
    const cautionEl = document.getElementById("qvCaution");
    if (product.caution) {
      cautionEl.style.display = "block";
      cautionEl.innerHTML = `<strong>⚠️ Traditional Caution:</strong> ${product.caution}`;
    } else {
      cautionEl.style.display = "none";
    }

    // WhatsApp Direct Inquiry link
    const waBtn = document.getElementById("qvWhatsAppBtn");
    const waText = encodeURIComponent(`Hello Quad-Ace Herbs, I would like to inquire about ${product.name} (${formatMoney(product.price)}).`);
    waBtn.href = `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${waText}`;

    // Show modal
    const overlay = document.getElementById("quickViewOverlay");
    if (overlay) overlay.classList.add("active");
  }

  function closeQuickView() {
    const overlay = document.getElementById("quickViewOverlay");
    if (overlay) overlay.classList.remove("active");
  }

  // --- REMEDY QUIZ MATCHER ---
  function initRemedyQuiz() {
    const quizButtons = document.querySelectorAll("#quizOptions .quiz-btn");
    const resultBox = document.getElementById("remedyResultBox");
    const resultTitle = document.getElementById("quizResultTitle");
    const resultDesc = document.getElementById("quizResultDesc");
    const addBtn = document.getElementById("quizAddBtn");

    const remedyMap = {
      digestion: {
        id: "agbo-jedi-extra",
        title: "Agbo Jedi-Jedi Extra Strength",
        desc: "Ancestral detox decoction to flush intestinal sugar buildup, clear hemorrhoids (pile), and relieve stubborn waist stiffness.",
        price: 6500
      },
      stamina: {
        id: "man-power-vitality",
        title: "Man-Power Virility & Stamina Roots Infusion",
        desc: "Wild African root infusion for sustained hardness, enhanced nitric oxide pelvic blood flow, and lasting masculine vitality.",
        price: 9500
      },
      fertility: {
        id: "queens-hormonal-balance",
        title: "Queen's Hormonal Balance & Womb Cleanse",
        desc: "Restorative herbal blend for menstrual regularity, relief from painful cramps, hormonal acne reduction, and natural womb conception preparation.",
        price: 8500
      },
      immunity: {
        id: "immune-booster-elixir",
        title: "Immune Booster & Blood Purifier Elixir",
        desc: "Potent anti-inflammatory herbal shield with wild neem, ginger, and turmeric to detoxify liver and lymphatic fluid.",
        price: 7000
      }
    };

    let selectedRemedy = remedyMap["digestion"];

    quizButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        quizButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const goal = btn.dataset.goal;
        selectedRemedy = remedyMap[goal] || remedyMap["digestion"];

        if (resultTitle) resultTitle.textContent = selectedRemedy.title;
        if (resultDesc) resultDesc.textContent = selectedRemedy.desc;
        if (addBtn) addBtn.innerHTML = `<span>Add to Cart (${formatMoney(selectedRemedy.price)})</span>`;
      });
    });

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        addToCart(selectedRemedy.id);
        openCart();
      });
    }
  }

  // --- ACCORDION LOGIC ---
  function initAccordions() {
    document.querySelectorAll(".accordion-header").forEach(header => {
      header.addEventListener("click", () => {
        const item = header.parentElement;
        const isActive = item.classList.contains("active");

        // Close others
        document.querySelectorAll(".accordion-item").forEach(other => {
          other.classList.remove("active");
          const icon = other.querySelector(".accordion-icon");
          if (icon) icon.textContent = "+";
        });

        if (!isActive) {
          item.classList.add("active");
          const icon = header.querySelector(".accordion-icon");
          if (icon) icon.textContent = "−";
        }
      });
    });
  }

  // --- CHECKOUT FLOW ---
  function openCheckoutModal() {
    if (state.cart.length === 0) {
      showToast("Your cart is empty! Please add an item first.", "⚠️");
      return;
    }
    closeCart();
    updateCheckoutRecap();
    setCheckoutStep(1);

    const overlay = document.getElementById("checkoutModalOverlay");
    if (overlay) overlay.classList.add("active");
  }

  function closeCheckoutModal() {
    const overlay = document.getElementById("checkoutModalOverlay");
    if (overlay) overlay.classList.remove("active");
  }

  function setCheckoutStep(step) {
    document.getElementById("stepSection1").style.display = step === 1 ? "block" : "none";
    document.getElementById("stepSection2").style.display = step === 2 ? "block" : "none";
    document.getElementById("stepSection3").style.display = step === 3 ? "block" : "none";

    const ind1 = document.getElementById("stepIndicator1");
    const ind2 = document.getElementById("stepIndicator2");
    const ind3 = document.getElementById("stepIndicator3");

    [ind1, ind2, ind3].forEach((ind, idx) => {
      if (!ind) return;
      ind.classList.remove("active", "completed");
      if (idx + 1 === step) ind.classList.add("active");
      else if (idx + 1 < step) ind.classList.add("completed");
    });
  }

  function updateCheckoutRecap() {
    const subtotal = getCartSubtotal() - state.discountAmount;
    const shippingMethod = state.selectedShipping;
    let shippingFee = 0;
    let isRiderSettled = false;

    if (shippingMethod === "nationwide" || shippingMethod === "international") {
      shippingFee = 0;
      isRiderSettled = true;
    } else if (shippingMethod === "local") {
      const threshold = STORE_CONFIG.shipping.freeShippingThreshold || 50000;
      shippingFee = getCartSubtotal() >= threshold ? 0 : (STORE_CONFIG.shipping.local.price || 2500);
    }

    const finalTotal = subtotal + shippingFee;

    const checkoutSubtotal = document.getElementById("checkoutSubtotal");
    const checkoutShippingFee = document.getElementById("checkoutShippingFee");
    const checkoutShippingLabel = document.getElementById("checkoutShippingLabel");
    const checkoutFinalTotal = document.getElementById("checkoutFinalTotal");

    if (checkoutSubtotal) checkoutSubtotal.textContent = formatMoney(subtotal);
    if (checkoutShippingFee) {
      if (isRiderSettled) {
        checkoutShippingFee.textContent = shippingMethod === "nationwide" ? "Sorted with dispatch rider" : "Sorted with courier";
        checkoutShippingFee.style.color = "var(--earth-terracotta)";
        checkoutShippingFee.style.fontSize = "0.85rem";
      } else if (shippingFee === 0) {
        checkoutShippingFee.textContent = "FREE";
        checkoutShippingFee.style.color = "var(--primary-green)";
        checkoutShippingFee.style.fontSize = "1rem";
      } else {
        checkoutShippingFee.textContent = formatMoney(shippingFee);
        checkoutShippingFee.style.color = "var(--primary-green)";
        checkoutShippingFee.style.fontSize = "1rem";
      }
    }
    if (checkoutShippingLabel) {
      checkoutShippingLabel.textContent = `Delivery (${shippingMethod.toUpperCase()}):`;
    }
    if (checkoutFinalTotal) checkoutFinalTotal.textContent = formatMoney(finalTotal);
  }

  function initCheckoutForm() {
    // Step Navigation buttons
    document.getElementById("goToStep2Btn").addEventListener("click", () => {
      const name = document.getElementById("custName").value.trim();
      const phone = document.getElementById("custPhone").value.trim();
      const address = document.getElementById("custAddress").value.trim();
      const city = document.getElementById("custCity").value.trim();
      const stateVal = document.getElementById("custState").value.trim();

      if (!name || !phone || !address || !city || !stateVal) {
        showToast("Please fill in your Name, Phone, and Delivery Address!", "⚠️");
        return;
      }
      setCheckoutStep(2);
    });

    document.getElementById("backToStep1Btn").addEventListener("click", () => setCheckoutStep(1));

    document.getElementById("goToStep3Btn").addEventListener("click", () => {
      updateCheckoutRecap();
      setCheckoutStep(3);
    });

    document.getElementById("backToStep2Btn").addEventListener("click", () => setCheckoutStep(2));

    // Shipping radio cards selection
    const shippingCards = document.querySelectorAll("#shippingOptionsList .shipping-card");
    shippingCards.forEach(card => {
      card.addEventListener("click", () => {
        shippingCards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector("input[type='radio']");
        if (radio) radio.checked = true;
        state.selectedShipping = card.dataset.shipping;
        updateCheckoutRecap();
      });
    });

    // Payment tab toggling (Bank Transfer vs WhatsApp)
    const payTabs = document.querySelectorAll(".payment-tabs .payment-tab-btn");
    payTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        payTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        state.selectedPaymentMethod = tab.dataset.paymethod;

        if (state.selectedPaymentMethod === "bank") {
          document.getElementById("bankDetailsView").style.display = "block";
          document.getElementById("whatsappMethodView").style.display = "none";
        } else {
          document.getElementById("bankDetailsView").style.display = "none";
          document.getElementById("whatsappMethodView").style.display = "block";
        }
      });
    });

    // Copy Account Number button
    const copyBtn = document.getElementById("copyAccountBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const num = STORE_CONFIG.bankDetails.accountNumber;
        navigator.clipboard.writeText(num).then(() => {
          showToast(`Account number ${num} copied!`, "📋");
          copyBtn.innerHTML = `<span>✓ Copied!</span>`;
          setTimeout(() => {
            copyBtn.innerHTML = `<span>📋 Copy</span>`;
          }, 2500);
        }).catch(() => {
          showToast(`Account: ${num}`, "📋");
        });
      });
    }

    // Complete Order button
    document.getElementById("completeOrderBtn").addEventListener("click", completeOrder);
  }

  // --- COMPLETE ORDER LOGIC ---
  function completeOrder() {
    const custName = document.getElementById("custName").value.trim();
    const custPhone = document.getElementById("custPhone").value.trim();
    const custEmail = document.getElementById("custEmail").value.trim();
    const custAddress = document.getElementById("custAddress").value.trim();
    const custCity = document.getElementById("custCity").value.trim();
    const custState = document.getElementById("custState").value.trim();
    const custNotes = document.getElementById("custNotes").value.trim();
    const senderBank = document.getElementById("senderBank") ? document.getElementById("senderBank").value.trim() : "";
    const senderName = document.getElementById("senderName") ? document.getElementById("senderName").value.trim() : "";

    if (!custName || !custPhone || !custAddress) {
      showToast("Please complete your delivery details first.", "⚠️");
      setCheckoutStep(1);
      return;
    }

    // Generate unique Order Reference
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const orderRef = `#QA-${randomDigits}`;

    const subtotal = getCartSubtotal() - state.discountAmount;
    let shippingFee = 0;
    let deliveryNote = "";

    if (state.selectedShipping === "nationwide") {
      shippingFee = 0;
      deliveryNote = "Sorted with dispatch rider upon delivery (NATIONWIDE)";
    } else if (state.selectedShipping === "international") {
      shippingFee = 0;
      deliveryNote = "Sorted with courier upon dispatch (INTERNATIONAL)";
    } else {
      if (getCartSubtotal() >= (STORE_CONFIG.shipping.freeShippingThreshold || 50000)) {
        shippingFee = 0;
        deliveryNote = "FREE (Local Promo)";
      } else {
        shippingFee = STORE_CONFIG.shipping.local.price || 2500;
        deliveryNote = `${formatMoney(shippingFee)} (LOCAL DISPATCH)`;
      }
    }
    const finalTotal = subtotal + shippingFee;

    const orderData = {
      orderRef: orderRef,
      customer: {
        name: custName,
        phone: custPhone,
        email: custEmail,
        address: `${custAddress}, ${custCity}, ${custState}`,
        notes: custNotes
      },
      senderDetails: {
        bank: senderBank,
        name: senderName
      },
      items: [...state.cart],
      shippingMethod: state.selectedShipping,
      shippingFee: shippingFee,
      discount: state.discountAmount,
      subtotal: subtotal,
      finalTotal: finalTotal,
      paymentMethod: state.selectedPaymentMethod,
      timestamp: new Date().toISOString()
    };

    state.lastOrder = orderData;

    // Build Formatted WhatsApp Order Message
    const itemsFormatted = orderData.items.map((it, idx) => 
      `${idx + 1}. *${it.name}* x ${it.quantity} (${formatMoney(it.price * it.quantity)})`
    ).join("\n");

    const paymentLabel = state.selectedPaymentMethod === "bank" ? "Direct Bank Transfer" : "WhatsApp Order Confirmation";

    let verificationBlock = "";
    if (state.selectedPaymentMethod === "bank") {
      verificationBlock = 
`⚠️ *PAYMENT STATUS: PENDING VERIFICATION*
*(SELLER NOTICE: Do NOT dispatch until you confirm the credit alert of ${formatMoney(orderData.finalTotal)} in your bank app!)*
• *Customer Sender Bank:* ${senderBank || "Not specified by buyer"}
• *Customer Sender Name:* ${senderName || "Not specified by buyer"}
• *Store Account:* ${STORE_CONFIG.bankDetails.bankName} - ${STORE_CONFIG.bankDetails.accountNumber}`;
    } else {
      verificationBlock = `⚠️ *STATUS: WHATSAPP ORDER INQUIRY*
(Customer placed order directly via WhatsApp)`;
    }

    const waMessageText = 
`🌿 *NEW ORDER FROM QUAD-ACE HERBS* 🌿
━━━━━━━━━━━━━━━━━━━━
*Order Ref:* ${orderData.orderRef}
*Date:* ${new Date().toLocaleDateString('en-GB')}

${verificationBlock}

*CUSTOMER DETAILS:*
• *Name:* ${orderData.customer.name}
• *Phone:* ${orderData.customer.phone}
• *Delivery Address:* ${orderData.customer.address}
${orderData.customer.notes ? `• *Notes:* ${orderData.customer.notes}\n` : ''}
*ITEMS ORDERED:*
${itemsFormatted}

━━━━━━━━━━━━━━━━━━━━
*Subtotal:* ${formatMoney(orderData.subtotal)}
*Delivery:* ${deliveryNote}
${orderData.discount > 0 ? `*Discount:* -${formatMoney(orderData.discount)}\n` : ''}*TOTAL AMOUNT TO VERIFY:* ${formatMoney(orderData.finalTotal)}
━━━━━━━━━━━━━━━━━━━━
*Payment Method:* ${paymentLabel}

Please verify the payment alert and confirm dispatch! Thank you 🌿`;

    const encodedWaMessage = encodeURIComponent(waMessageText);
    const waLink = `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodedWaMessage}`;

    // AUTOMATIC EMAIL DISPATCH TO SELLER'S GMAIL:
    if (STORE_CONFIG.sellerEmail) {
      const emailPayload = {
        _subject: `🌿 New Order from ${orderData.customer.name} (${orderData.orderRef}) - Quad-Ace Herbs`,
        _template: "table",
        _captcha: "false",
        "Order Reference": orderData.orderRef,
        "Customer Name": orderData.customer.name,
        "Customer Phone": orderData.customer.phone,
        "Customer Email": orderData.customer.email || "Not provided",
        "Delivery Address": orderData.customer.address,
        "Delivery Notes": orderData.customer.notes || "None",
        "Items Ordered": itemsFormatted.replace(/\*/g, ""),
        "Subtotal": formatMoney(orderData.subtotal),
        "Delivery Zone": deliveryNote,
        "Total Amount Due": formatMoney(orderData.finalTotal),
        "Payment Method": paymentLabel,
        "Sender Bank (Claimed)": senderBank || "Not specified",
        "Sender Name (Claimed)": senderName || "Not specified",
        "Payment Status": "PENDING VERIFICATION (Check bank app alert before dispatch!)"
      };

      fetch(`https://formsubmit.co/ajax/${STORE_CONFIG.sellerEmail}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(emailPayload)
      })
      .then(res => res.json())
      .then(data => console.log("Order email dispatched to seller:", data))
      .catch(err => console.warn("Order email alert:", err));
    }

    // Close Checkout Modal & Open Receipt
    closeCheckoutModal();
    showReceiptModal(orderData, waLink);

    // Auto-launch WhatsApp so the seller gets both WhatsApp AND Email!
    window.open(waLink, "_blank");

    // Clear cart
    state.cart = [];
    saveCart();
    updateCartUI();
  }

  // --- RECEIPT MODAL ---
  function showReceiptModal(order, waLink) {
    document.getElementById("receiptOrderRef").textContent = order.orderRef;
    document.getElementById("receiptCustName").textContent = order.customer.name;
    document.getElementById("receiptCustPhone").textContent = order.customer.phone;
    document.getElementById("receiptCustAddress").textContent = order.customer.address;
    
    // Status text
    const statusEl = document.getElementById("receiptPaymentStatus");
    if (statusEl) {
      if (order.paymentMethod === "bank") {
        statusEl.textContent = "🟡 Awaiting Bank Alert Verification";
        statusEl.style.color = "#d35400";
      } else {
        statusEl.textContent = "💬 Order via WhatsApp (Pending Confirmation)";
        statusEl.style.color = "#27ae60";
      }
    }

    let receiptDeliveryText = "";
    if (order.shippingMethod === "nationwide") {
      receiptDeliveryText = "NATIONWIDE (Fee sorted with dispatch rider)";
    } else if (order.shippingMethod === "international") {
      receiptDeliveryText = "INTERNATIONAL (Fee sorted with courier)";
    } else if (order.shippingFee === 0) {
      receiptDeliveryText = "LOCAL (FREE Promo)";
    } else {
      receiptDeliveryText = `LOCAL (${formatMoney(order.shippingFee)})`;
    }
    document.getElementById("receiptShippingZone").textContent = receiptDeliveryText;
    document.getElementById("receiptPayMethod").textContent = order.paymentMethod === "bank" ? `Bank Transfer (${STORE_CONFIG.bankDetails.bankName})` : "WhatsApp Direct Order";
    document.getElementById("receiptTotalAmount").textContent = formatMoney(order.finalTotal);

    const waBtn = document.getElementById("receiptWhatsAppNotifyBtn");
    if (waBtn) {
      waBtn.innerHTML = `<span>💬 Send Payment Details to Seller on WhatsApp</span>`;
      waBtn.onclick = () => window.open(waLink, "_blank");
    }

    const receiptOverlay = document.getElementById("receiptModalOverlay");
    if (receiptOverlay) receiptOverlay.classList.add("active");
  }

  // --- FAST 1-CLICK WHATSAPP CART ORDER ---
  function quickCartWhatsAppOrder() {
    if (state.cart.length === 0) {
      showToast("Your cart is empty! Please add herbs first.", "⚠️");
      return;
    }

    // If user has not filled customer info yet, prompt them with the quick checkout modal
    openCheckoutModal();
    showToast("Please enter your name & address for fast WhatsApp dispatch!", "🌿");
  }

  // --- GLOBAL EXPORTS ---
  window.app = {
    addToCart,
    changeCartQty,
    removeFromCart,
    openCart,
    closeCart,
    openQuickView,
    closeQuickView,
    quickAdd: (id) => {
      addToCart(id);
      openCart();
    },
    filterByCategory: (catId) => {
      state.activeCategory = catId;
      renderCategories();
      renderProducts();
      window.location.hash = "#catalog";
    },
    resetFilters: () => {
      state.activeCategory = "all";
      state.activeSearch = "";
      const searchIn = document.getElementById("searchInput");
      if (searchIn) searchIn.value = "";
      renderCategories();
      renderProducts();
    },
    openBankInfoModal: () => {
      openCheckoutModal();
      setCheckoutStep(3);
    }
  };

  // --- DOCUMENT READY EVENT LISTENERS ---
  document.addEventListener("DOMContentLoaded", () => {
    loadCart();
    initStoreConfig();
    renderCategories();
    renderProducts();
    initRemedyQuiz();
    initAccordions();
    initCheckoutForm();
    updateCartUI();

    // Search Input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.activeSearch = e.target.value;
        renderProducts();
      });
    }

    // Sort Select
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        state.activeSort = e.target.value;
        renderProducts();
      });
    }

    // Cart Drawer Toggle
    document.getElementById("openCartBtn").addEventListener("click", openCart);
    document.getElementById("closeCartBtn").addEventListener("click", closeCart);
    document.getElementById("cartOverlay").addEventListener("click", (e) => {
      if (e.target.id === "cartOverlay") closeCart();
    });

    // Quick View Close
    document.getElementById("closeQuickViewBtn").addEventListener("click", closeQuickView);
    document.getElementById("quickViewOverlay").addEventListener("click", (e) => {
      if (e.target.id === "quickViewOverlay") closeQuickView();
    });

    // Quick View Add to Cart
    document.getElementById("qvAddToCartBtn").addEventListener("click", () => {
      if (state.currentQuickViewProduct) {
        addToCart(state.currentQuickViewProduct.id);
        closeQuickView();
        openCart();
      }
    });

    // Coupon Apply
    document.getElementById("applyCouponBtn").addEventListener("click", applyCoupon);
    document.getElementById("couponInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") applyCoupon();
    });

    // Cart Action Buttons
    document.getElementById("cartWhatsAppOrderBtn").addEventListener("click", quickCartWhatsAppOrder);
    document.getElementById("openCheckoutModalBtn").addEventListener("click", openCheckoutModal);
    document.getElementById("closeCheckoutBtn").addEventListener("click", closeCheckoutModal);

    // Receipt Modal Close
    document.getElementById("closeReceiptBtn").addEventListener("click", () => {
      document.getElementById("receiptModalOverlay").classList.remove("active");
    });
  });

})();
