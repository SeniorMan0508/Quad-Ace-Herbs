/**
 * QUAD-ACE HERBS - DEDICATED SHOP PAGE CONTROLLER
 * ================================================
 * Handles sidebar filtering, price ranges, search, sort,
 * and category counters on shop.html.
 */

(function () {
  "use strict";

  // Additional filter state for shop page
  const shopFilterState = {
    selectedCategory: "all",
    searchQuery: "",
    priceRange: "all",
    sortBy: "featured"
  };

  // Helper currency format
  function formatNaira(num) {
    return "₦" + Number(num).toLocaleString("en-NG");
  }

  // Update category counts in the sidebar
  function updateCategoryCounts() {
    const products = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;

    const counts = {
      all: products.length,
      agbo: 0,
      men: 0,
      women: 0,
      raw: 0,
      wellness: 0
    };

    products.forEach(p => {
      if (counts[p.category] !== undefined) {
        counts[p.category]++;
      }
    });

    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };

    setBadge("countAll", counts.all);
    setBadge("countAgbo", counts.agbo);
    setBadge("countMen", counts.men);
    setBadge("countWomen", counts.women);
    setBadge("countRaw", counts.raw);
    setBadge("countWellness", counts.wellness);
  }

  // Filter and sort products for shop.html
  function getShopProducts() {
    let list = typeof getStoreProducts === "function" ? getStoreProducts() : [...PRODUCTS_DATA];

    // Filter by category
    if (shopFilterState.selectedCategory !== "all") {
      list = list.filter(p => p.category === shopFilterState.selectedCategory);
    }

    // Filter by search query
    if (shopFilterState.searchQuery.trim()) {
      const q = shopFilterState.searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
        p.shortDesc.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        (p.healthGoals && p.healthGoals.some(g => g.toLowerCase().includes(q)))
      );
    }

    // Filter by price range
    if (shopFilterState.priceRange === "under-7k") {
      list = list.filter(p => p.price < 7000);
    } else if (shopFilterState.priceRange === "7k-12k") {
      list = list.filter(p => p.price >= 7000 && p.price <= 12000);
    } else if (shopFilterState.priceRange === "above-12k") {
      list = list.filter(p => p.price > 12000);
    }

    // Sort
    if (shopFilterState.sortBy === "price-low") {
      list.sort((a, b) => a.price - b.price);
    } else if (shopFilterState.sortBy === "price-high") {
      list.sort((a, b) => b.price - a.price);
    } else if (shopFilterState.sortBy === "rating") {
      list.sort((a, b) => (b.rating || 5) - (a.rating || 5));
    }

    return list;
  }

  // Render product cards on shop.html
  function renderShopGrid() {
    const grid = document.getElementById("productsGrid");
    const countEl = document.getElementById("shopProductCount");
    if (!grid) return;

    const products = getShopProducts();

    if (countEl) {
      countEl.textContent = `Showing ${products.length} authentic remed${products.length === 1 ? 'y' : 'ies'}`;
    }

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="shop-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 4.5rem 1.5rem; background: #ffffff; border-radius: var(--radius-xl); border: 1px dashed rgba(24, 66, 46, 0.2);">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">🌿</div>
          <h3 style="font-family: var(--font-heading); color: var(--deep-forest); font-size: 1.5rem; margin-bottom: 0.5rem;">No herbal remedies matched your filter</h3>
          <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 1.5rem;">Try clearing your search query or selecting a different category to view our natural remedies.</p>
          <button class="btn-primary" id="emptyStateResetBtn" style="margin: 0 auto;">
            <span>View All Remedies</span>
          </button>
        </div>
      `;
      const resetBtn = document.getElementById("emptyStateResetBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", resetAllFilters);
      }
      return;
    }

    grid.innerHTML = products.map(product => {
      const origPriceHtml = product.originalPrice && product.originalPrice > product.price
        ? `<span class="original-price">${formatNaira(product.originalPrice)}</span>`
        : "";

      return `
        <div class="product-card" data-id="${product.id}">
          <div class="product-thumb-container">
            ${product.badge ? `<span class="product-badge ${product.badgeType || 'standard'}">${product.badge}</span>` : ''}
            <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='images/agbo-jedi.jpg'">
            <button class="quick-view-overlay-btn" onclick="window.app && window.app.openQuickView ? window.app.openQuickView('${product.id}') : null">
              🔍 Quick Details
            </button>
          </div>

          <div class="product-card-body">
            <div class="product-meta-row">
              <span class="product-category-tag">${product.categoryLabel || 'Agbo & Tonics'}</span>
              <span class="product-rating">★ ${(product.rating || 5).toFixed(1)} (${product.reviewsCount || 120})</span>
            </div>

            <h3 class="product-title">${product.name}</h3>
            ${product.subtitle ? `<p class="product-subtitle-tag">${product.subtitle}</p>` : ''}
            <p class="product-desc">${product.shortDesc}</p>

            <div class="product-card-footer">
              <div class="product-price-stack">
                <span class="current-price">${formatNaira(product.price)}</span>
                ${origPriceHtml}
              </div>
              <button class="add-to-cart-btn" onclick="window.app && window.app.addToCart ? window.app.addToCart('${product.id}') : null">
                <span>+ Add</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Reset all filters
  function resetAllFilters() {
    shopFilterState.selectedCategory = "all";
    shopFilterState.searchQuery = "";
    shopFilterState.priceRange = "all";
    shopFilterState.sortBy = "featured";

    const searchInput = document.getElementById("shopSearchInput");
    if (searchInput) searchInput.value = "";

    const sortSelect = document.getElementById("shopSortSelect");
    if (sortSelect) sortSelect.value = "featured";

    const defaultRadio = document.querySelector("#priceFilterGroup input[value='all']");
    if (defaultRadio) defaultRadio.checked = true;

    document.querySelectorAll("#sidebarCategoryList .sidebar-cat-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.category === "all");
    });

    renderShopGrid();
  }

  // Initialize shop page controls
  function initShopPage() {
    // 1. Check for URL category parameter (e.g. shop.html?category=men)
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get("category");
    if (categoryParam) {
      shopFilterState.selectedCategory = categoryParam;
    }

    // 2. Set active sidebar category button
    document.querySelectorAll("#sidebarCategoryList .sidebar-cat-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.category === shopFilterState.selectedCategory);
      btn.addEventListener("click", () => {
        document.querySelectorAll("#sidebarCategoryList .sidebar-cat-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        shopFilterState.selectedCategory = btn.dataset.category;
        renderShopGrid();
      });
    });

    // 3. Search input
    const searchInput = document.getElementById("shopSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        shopFilterState.searchQuery = e.target.value;
        renderShopGrid();
      });
    }

    // 4. Price range radios
    const priceRadios = document.querySelectorAll("#priceFilterGroup input[name='priceRange']");
    priceRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          shopFilterState.priceRange = e.target.value;
          renderShopGrid();
        }
      });
    });

    // 5. Sort select
    const sortSelect = document.getElementById("shopSortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        shopFilterState.sortBy = e.target.value;
        renderShopGrid();
      });
    }

    // 6. Reset button
    const resetBtn = document.getElementById("sidebarResetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", resetAllFilters);
    }

    // 7. Update counts & initial render
    updateCategoryCounts();
    renderShopGrid();

    // 8. Listen for storage updates (e.g. when Admin adds/removes products in another tab or window!)
    window.addEventListener("storage", (e) => {
      if (e.key === "quadace_custom_products" || e.key === "quadace_deleted_products") {
        updateCategoryCounts();
        renderShopGrid();
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShopPage);
  } else {
    initShopPage();
  }

  // Export helper
  window.shopApp = {
    renderShopGrid,
    resetAllFilters,
    updateCategoryCounts
  };
})();
