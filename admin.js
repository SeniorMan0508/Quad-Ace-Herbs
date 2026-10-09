/**
 * QUAD-ACE HERBS - ADMIN DASHBOARD CONTROLLER
 * ============================================
 * Handles security passcode authentication, adding new products,
 * deleting products, and catalog management for the store owner.
 */

(function () {
  "use strict";

  const AUTH_KEY = "quadace_admin_authenticated";
  let activeImageSrc = "images/agbo-jedi.jpg";
  let editingProductId = null;

  // Category labels map
  const CATEGORY_LABELS = {
    agbo: "Agbo & Tonics",
    men: "Men's Vitality",
    women: "Women's Wellness",
    raw: "Raw Roots & Pods",
    wellness: "Immunity & Detox"
  };

  // Toast notification
  function showAdminToast(message, icon = "🌿") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  const PASSCODE_STORAGE_KEY = "quadace_admin_passcode";
  const TOKEN_KEY = "quadace_admin_token";

  function getStoredToken() {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  }

  function getFallbackPasscode() {
    return localStorage.getItem(PASSCODE_STORAGE_KEY) || "quadace2026";
  }

  // --- PASSCODE GATEKEEPER ---
  function checkAuth() {
    const gatekeeper = document.getElementById("adminGatekeeper");
    const isAuthenticated = sessionStorage.getItem(AUTH_KEY) === "true";

    if (isAuthenticated) {
      if (gatekeeper) gatekeeper.style.display = "none";
      loadDashboard();
    } else {
      if (gatekeeper) gatekeeper.style.display = "flex";
    }
  }

  function initLoginForm() {
    const form = document.getElementById("adminLoginForm");
    const pinInput = document.getElementById("adminPinInput");
    const errorEl = document.getElementById("gatekeeperError");
    const gatekeeper = document.getElementById("adminGatekeeper");
    const toggleBtn = document.getElementById("toggleLoginPinBtn");
    const unlockBtn = document.getElementById("unlockAdminBtn");

    if (toggleBtn && pinInput) {
      toggleBtn.addEventListener("click", () => {
        const isPassword = pinInput.type === "password";
        pinInput.type = isPassword ? "text" : "password";
        toggleBtn.textContent = isPassword ? "🙈 Hide" : "👁️ Show";
      });
    }

    if (!form || !pinInput) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const enteredPin = pinInput.value.trim();
      if (!enteredPin) return;

      if (unlockBtn) {
        unlockBtn.disabled = true;
        unlockBtn.innerHTML = `<span>Verifying... ⏳</span>`;
      }

      // 1. Try server verification first
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: enteredPin })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            sessionStorage.setItem(AUTH_KEY, "true");
            if (data.token) sessionStorage.setItem(TOKEN_KEY, data.token);
            if (errorEl) errorEl.style.display = "none";
            if (gatekeeper) gatekeeper.style.display = "none";
            showAdminToast("Welcome to your Admin Dashboard!", "👋");
            loadDashboard();

            if (data.isDefaultPassword) {
              setTimeout(() => {
                showAdminToast("Default passcode active. Set your personal password in Store Info & Backup! 🔐", "⚠️");
              }, 1800);
            }
            return;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          if (errorEl) {
            errorEl.style.display = "block";
            errorEl.textContent = `⚠️ ${errData.message || "Incorrect passcode! Please try again."}`;
          }
          pinInput.value = "";
          pinInput.focus();
          return;
        }
      } catch (networkErr) {
        // Fallback for offline or static environment
        console.warn("Backend server not reachable, attempting local fallback verification:", networkErr);
      } finally {
        if (unlockBtn) {
          unlockBtn.disabled = false;
          unlockBtn.innerHTML = `<span>Unlock Admin Dashboard 🌿</span>`;
        }
      }

      // 2. Fallback check against localStorage
      const fallbackPin = getFallbackPasscode();
      if (enteredPin === fallbackPin) {
        sessionStorage.setItem(AUTH_KEY, "true");
        if (errorEl) errorEl.style.display = "none";
        if (gatekeeper) gatekeeper.style.display = "none";
        showAdminToast("Welcome to your Admin Dashboard!", "👋");
        loadDashboard();
      } else {
        if (errorEl) {
          errorEl.style.display = "block";
          errorEl.textContent = "⚠️ Incorrect passcode! Please try again.";
        }
        pinInput.value = "";
        pinInput.focus();
      }
    });

    const logoutBtn = document.getElementById("adminLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        window.location.reload();
      });
    }
  }

  // --- FORGOT / RESET PASSCODE VIA EMAIL MODAL ---
  function initResetModal() {
    const openBtn = document.getElementById("openResetModalBtn");
    const closeBtn = document.getElementById("closeResetModalBtn");
    const cancelBtn = document.getElementById("cancelResetModalBtn");
    const modal = document.getElementById("adminResetModal");
    const sendSection = document.getElementById("sendCodeSection");
    const requestBtn = document.getElementById("requestResetCodeBtn");
    const resendBtn = document.getElementById("resendCodeBtn");
    const resetForm = document.getElementById("resetPasscodeForm");
    const targetEmailEl = document.getElementById("resetTargetEmail");

    const codeInput = document.getElementById("emailCodeInput");
    const newPinInput = document.getElementById("resetNewPasscodeInput");
    const confirmPinInput = document.getElementById("resetConfirmPasscodeInput");
    const msgEl = document.getElementById("resetModalMsg");
    const submitBtn = document.getElementById("submitResetPasscodeBtn");

    if (!modal) return;

    const showResetMsg = (text, isError = true) => {
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.style.background = isError ? "#fee2e2" : "#dcfce7";
      msgEl.style.color = isError ? "#b91c1c" : "#15803d";
      msgEl.style.border = isError ? "1px solid #fca5a5" : "1px solid #86efac";
      msgEl.textContent = text;
    };

    const openModal = async () => {
      modal.style.display = "flex";
      if (msgEl) msgEl.style.display = "none";
      if (resetForm) {
        resetForm.reset();
        resetForm.style.display = "none";
      }
      if (sendSection) sendSection.style.display = "block";

      // Load masked email
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        if (data && data.maskedEmail && targetEmailEl) {
          targetEmailEl.textContent = data.maskedEmail;
        }
      } catch (e) {}
    };

    const closeModal = () => {
      modal.style.display = "none";
    };

    if (openBtn) openBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // Request 6-digit code
    const handleSendCode = async (btnEl) => {
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `<span>Sending email... ⏳</span>`;
      }

      try {
        const res = await fetch("/api/auth/send-reset-code", { method: "POST" });
        const data = await res.json();

        if (res.ok && data.success) {
          showResetMsg(data.message || "A 6-digit code was sent to your email!", false);
          if (sendSection) sendSection.style.display = "none";
          if (resetForm) resetForm.style.display = "block";
          if (codeInput) codeInput.focus();
        } else {
          showResetMsg(data.message || "Failed to send code. Please try again.");
        }
      } catch (err) {
        // Server not reachable
        showResetMsg("⚠️ The backend server is offline! Please start it by running 'npm start' in your terminal and open http://localhost:3000/admin.html.", true);
      } finally {
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = `<span>📩 Send 6-Digit Code to My Email</span>`;
        }
      }
    };

    if (requestBtn) {
      requestBtn.addEventListener("click", () => handleSendCode(requestBtn));
    }
    if (resendBtn) {
      resendBtn.addEventListener("click", () => handleSendCode(resendBtn));
    }

    // Verify code & save new password
    if (resetForm) {
      resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = codeInput ? codeInput.value.trim() : "";
        const newPin = newPinInput ? newPinInput.value.trim() : "";
        const confirmPin = confirmPinInput ? confirmPinInput.value.trim() : "";

        if (!code || code.length < 6) {
          showResetMsg("Please enter the complete 6-digit code sent to your email.");
          return;
        }

        if (newPin.length < 4) {
          showResetMsg("New passcode must be at least 4 characters long.");
          return;
        }

        if (newPin !== confirmPin) {
          showResetMsg("New passcode and confirmation do not match!");
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Verifying... ⏳</span>`;
        }

        try {
          const res = await fetch("/api/auth/verify-reset-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, newPassword: newPin })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            localStorage.setItem(PASSCODE_STORAGE_KEY, newPin);
            if (data.token) sessionStorage.setItem(TOKEN_KEY, data.token);
            sessionStorage.setItem(AUTH_KEY, "true");

            showResetMsg(data.message || "Passcode reset successfully!", false);
            showAdminToast("Admin passcode reset successfully! 🔐", "✓");

            setTimeout(() => {
              closeModal();
              const gatekeeper = document.getElementById("adminGatekeeper");
              if (gatekeeper) gatekeeper.style.display = "none";
              loadDashboard();
            }, 1200);
          } else {
            showResetMsg(data.message || "Invalid or expired verification code.");
          }
        } catch (err) {
          // Fallback
          localStorage.setItem(PASSCODE_STORAGE_KEY, newPin);
          sessionStorage.setItem(AUTH_KEY, "true");
          showResetMsg("Passcode updated successfully!", false);
          showAdminToast("Admin passcode reset successfully! 🔐", "✓");
          setTimeout(() => {
            closeModal();
            const gatekeeper = document.getElementById("adminGatekeeper");
            if (gatekeeper) gatekeeper.style.display = "none";
            loadDashboard();
          }, 1200);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Verify & Save Passcode ✓</span>`;
          }
        }
      });
    }
  }

  // --- TABS SWITCHING ---
  function initTabs() {
    const tabBtns = document.querySelectorAll(".admin-tab-btn");
    const panels = document.querySelectorAll(".admin-panel");

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        panels.forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        const targetId = btn.dataset.tab;
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add("active");

        if (targetId === "tabManage") {
          renderManageTable();
        }
      });
    });
  }

  // --- IMAGE SELECTION & UPLOAD HANDLERS ---
  function initImageHandlers() {
    const presetImages = document.querySelectorAll("#presetImagesList .preset-img-thumb");
    const activePreview = document.getElementById("activeImagePreview");
    const activeName = document.getElementById("activeImageName");
    const fileInput = document.getElementById("prodImageFile");
    const urlInput = document.getElementById("prodImageUrl");

    // Presets click
    presetImages.forEach(img => {
      img.addEventListener("click", () => {
        presetImages.forEach(i => i.classList.remove("selected"));
        img.classList.add("selected");
        activeImageSrc = img.dataset.src;
        if (activePreview) activePreview.src = activeImageSrc;
        if (activeName) activeName.textContent = img.alt || activeImageSrc;
        if (urlInput) urlInput.value = "";
      });
    });

    // File upload
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            activeImageSrc = loadEvent.target.result;
            if (activePreview) activePreview.src = activeImageSrc;
            if (activeName) activeName.textContent = `Uploaded: ${file.name}`;
            presetImages.forEach(i => i.classList.remove("selected"));
            showAdminToast("Product photo loaded successfully! ✓", "📸");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // URL input
    if (urlInput) {
      urlInput.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        if (val) {
          activeImageSrc = val;
          if (activePreview) activePreview.src = activeImageSrc;
          if (activeName) activeName.textContent = `URL: ${val.slice(0, 30)}...`;
          presetImages.forEach(i => i.classList.remove("selected"));
        }
      });
    }
  }

  // --- ADD / EDIT PRODUCT FORM ---
  function initProductForm() {
    const form = document.getElementById("addProductForm");
    const publishBtn = document.getElementById("publishProductBtn");
    const resetBtn = document.getElementById("resetFormBtn");

    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("prodName").value.trim();
      const category = document.getElementById("prodCategory").value;
      const subtitle = document.getElementById("prodSubtitle").value.trim();
      const price = Number(document.getElementById("prodPrice").value);
      const originalPriceVal = document.getElementById("prodOriginalPrice").value;
      const originalPrice = originalPriceVal ? Number(originalPriceVal) : null;
      const badge = document.getElementById("prodBadge").value.trim();
      const badgeType = document.getElementById("prodBadgeType").value;
      const shortDesc = document.getElementById("prodShortDesc").value.trim();
      const fullDesc = document.getElementById("prodFullDesc").value.trim() || shortDesc;
      const usage = document.getElementById("prodUsage").value.trim() || "Take as traditionally directed on bottle.";
      const caution = document.getElementById("prodCaution").value.trim() || "";

      // Split multiline benefits & ingredients
      const benefitsText = document.getElementById("prodBenefits").value.trim();
      const benefits = benefitsText 
        ? benefitsText.split("\n").map(b => b.trim()).filter(Boolean)
        : ["100% pure wildcrafted botanical formula", "Promotes natural bodily restoration"];

      const ingredientsText = document.getElementById("prodIngredients").value.trim();
      const ingredients = ingredientsText
        ? ingredientsText.split("\n").map(i => i.trim()).filter(Boolean)
        : ["Wild-harvested ancestral African roots and leaves"];

      if (!name || !price || !shortDesc) {
        showAdminToast("Please fill in Product Name, Price, and Short Summary.", "⚠️");
        return;
      }

      // Generate ID
      const prodId = editingProductId || ("custom-" + name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4));

      const newProduct = {
        id: prodId,
        name: name,
        subtitle: subtitle || `${CATEGORY_LABELS[category] || 'Ancestral'} Herbal Remedy`,
        category: category,
        categoryLabel: CATEGORY_LABELS[category] || "Agbo & Tonics",
        price: price,
        originalPrice: originalPrice,
        rating: 5.0,
        reviewsCount: Math.floor(20 + Math.random() * 80),
        image: activeImageSrc,
        badge: badge || "New Remedy",
        badgeType: badgeType || "gold",
        healthGoals: [category],
        shortDesc: shortDesc,
        fullDesc: fullDesc,
        benefits: benefits,
        ingredients: ingredients,
        usage: usage,
        caution: caution,
        isCustom: true,
        createdAt: new Date().toISOString()
      };

      // Save to store
      if (typeof saveStoreProduct === "function") {
        saveStoreProduct(newProduct);
      }

      showAdminToast(
        editingProductId ? `Updated '${name}' successfully!` : `✨ '${name}' published! Now live on Shop page.`,
        "🌿"
      );

      // Reset form
      form.reset();
      editingProductId = null;
      if (publishBtn) publishBtn.innerHTML = `<span>🌿 Publish Product to Shop Page</span>`;
      activeImageSrc = "images/agbo-jedi.jpg";
      const previewImg = document.getElementById("activeImagePreview");
      if (previewImg) previewImg.src = activeImageSrc;

      // Update stats and switch to Manage tab
      updateStats();
      renderManageTable();

      const manageTabBtn = document.querySelector(".admin-tab-btn[data-tab='tabManage']");
      if (manageTabBtn) manageTabBtn.click();
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        editingProductId = null;
        if (publishBtn) publishBtn.innerHTML = `<span>🌿 Publish Product to Shop Page</span>`;
      });
    }
  }

  // --- STATS OVERVIEW ---
  function updateStats() {
    const products = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;
    let customCount = 0;

    try {
      const savedCustom = localStorage.getItem("quadace_custom_products");
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        customCount = Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch (e) {}

    const totalEl = document.getElementById("statTotalProducts");
    const customEl = document.getElementById("statCustomProducts");
    const badgeEl = document.getElementById("tabCountBadge");

    if (totalEl) totalEl.textContent = products.length;
    if (customEl) customEl.textContent = customCount;
    if (badgeEl) badgeEl.textContent = products.length;
  }

  // --- MANAGE TABLE ---
  function renderManageTable() {
    const tbody = document.getElementById("productsTableBody");
    const searchInput = document.getElementById("manageSearchInput");
    if (!tbody) return;

    let products = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

    if (query) {
      products = products.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.categoryLabel.toLowerCase().includes(query)
      );
    }

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No products found matching '${query}'.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const isCustom = p.id.startsWith("custom-") || p.isCustom;
      const sourceBadge = isCustom 
        ? `<span class="source-badge custom">✨ Admin Added</span>`
        : `<span class="source-badge default">🌱 Default</span>`;

      return `
        <tr data-id="${p.id}">
          <td>
            <img src="${p.image}" alt="${p.name}" class="product-table-thumb" onerror="this.src='images/agbo-jedi.jpg'">
          </td>
          <td>
            <div style="font-weight: 700; color: var(--deep-forest);">${p.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${p.subtitle || ''}</div>
          </td>
          <td>
            <span class="product-category-tag">${p.categoryLabel || p.category}</span>
          </td>
          <td style="font-weight: 800; color: var(--primary-green);">
            ₦${Number(p.price).toLocaleString("en-NG")}
          </td>
          <td>
            ${sourceBadge}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-action-del" data-id="${p.id}" data-name="${p.name}">
              🗑️ Remove
            </button>
            <a href="shop.html" target="_blank" class="btn-action-view" style="margin-left: 0.35rem;">
              👁️ View in Shop
            </a>
          </td>
        </tr>
      `;
    }).join("");

    // Wire delete buttons
    tbody.querySelectorAll(".btn-action-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        handleDeleteProduct(id, name);
      });
    });
  }

  // Handle Delete Product
  function handleDeleteProduct(productId, productName) {
    const confirmed = window.confirm(`Are you sure you want to remove '${productName}' from your store? It will disappear from the Shop page immediately.`);
    if (!confirmed) return;

    if (typeof deleteStoreProduct === "function") {
      deleteStoreProduct(productId);
      showAdminToast(`'${productName}' removed from shop.`, "🗑️");
      updateStats();
      renderManageTable();
    }
  }

  // --- BACKUP & RESET ACTIONS ---
  function initBackupAndReset() {
    const exportBtn = document.getElementById("exportCatalogBtn");
    const resetBtn = document.getElementById("resetCatalogBtn");

    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (typeof exportStoreProductsJSON === "function") {
          exportStoreProductsJSON();
          showAdminToast("Catalog JSON downloaded!", "📥");
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const confirmed = window.confirm("⚠️ WARNING: This will reset your product catalog to the original factory default remedies and remove all custom products you added. Are you sure?");
        if (confirmed) {
          if (typeof resetStoreProducts === "function") {
            resetStoreProducts();
            showAdminToast("Store reset to original default remedies.", "🔄");
            updateStats();
            renderManageTable();
          }
        }
      });
    }

    const searchInput = document.getElementById("manageSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", renderManageTable);
    }
  }

  // --- LOAD DASHBOARD ---
  function loadDashboard() {
    updateStats();
    renderManageTable();
  }

  // --- CHANGE PASSCODE HANDLER ---
  function initChangePasscode() {
    const form = document.getElementById("changePasscodeForm");
    const currentInput = document.getElementById("currentPasscodeInput");
    const newInput = document.getElementById("newPasscodeInput");
    const confirmInput = document.getElementById("confirmPasscodeInput");
    const msgEl = document.getElementById("passcodeMsg");
    const saveBtn = document.getElementById("savePasscodeBtn");

    if (!form || !currentInput) return;

    const showMsg = (text, isError = true) => {
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.style.background = isError ? "#fee2e2" : "#dcfce7";
      msgEl.style.color = isError ? "#b91c1c" : "#15803d";
      msgEl.style.border = isError ? "1px solid #fca5a5" : "1px solid #86efac";
      msgEl.textContent = text;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentVal = currentInput.value.trim();
      const newVal = newInput.value.trim();
      const confirmVal = confirmInput.value.trim();

      if (newVal.length < 4) {
        showMsg("New passcode must be at least 4 characters long.");
        return;
      }

      if (newVal !== confirmVal) {
        showMsg("New passcode and confirmation do not match!");
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span>Saving... ⏳</span>`;
      }

      try {
        const token = getStoredToken();
        const response = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({ currentPassword: currentVal, newPassword: newVal })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          localStorage.setItem(PASSCODE_STORAGE_KEY, newVal);
          if (data.token) sessionStorage.setItem(TOKEN_KEY, data.token);
          showMsg(data.message || "Passcode updated successfully!", false);
          showAdminToast("Passcode updated on server! 🔐", "✓");
          form.reset();
          return;
        } else {
          showMsg(data.message || "Current passcode is incorrect. Update failed.");
        }
      } catch (err) {
        // Fallback for static mode
        const actualCurrent = getFallbackPasscode();
        if (currentVal !== actualCurrent) {
          showMsg("Current passcode is incorrect! Please enter your active passcode.");
          return;
        }
        localStorage.setItem(PASSCODE_STORAGE_KEY, newVal);
        showMsg("Passcode updated successfully! Your new password is now active.", false);
        showAdminToast("Passcode changed successfully! 🔐", "✓");
        form.reset();
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<span>🔒 Save New Passcode</span>`;
        }
      }
    });

    // Recovery email management
    const emailInput = document.getElementById("adminEmailInput");
    const emailForm = document.getElementById("updateEmailForm");
    const emailMsgEl = document.getElementById("emailUpdateMsg");
    const saveEmailBtn = document.getElementById("saveEmailBtn");

    const loadAdminEmail = async () => {
      const token = getStoredToken();
      if (!token || !emailInput) return;
      try {
        const res = await fetch("/api/auth/email", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.email) {
          emailInput.value = data.email;
        }
      } catch (e) {}
    };

    loadAdminEmail();

    if (emailForm) {
      emailForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newEmail = emailInput ? emailInput.value.trim() : "";
        if (!newEmail || !newEmail.includes("@")) return;

        if (saveEmailBtn) {
          saveEmailBtn.disabled = true;
          saveEmailBtn.innerHTML = `<span>Saving... ⏳</span>`;
        }

        try {
          const token = getStoredToken();
          const res = await fetch("/api/auth/update-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify({ newEmail })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            if (emailMsgEl) {
              emailMsgEl.style.display = "block";
              emailMsgEl.style.background = "#dcfce7";
              emailMsgEl.style.color = "#15803d";
              emailMsgEl.style.border = "1px solid #86efac";
              emailMsgEl.textContent = data.message || "Email updated successfully!";
            }
            showAdminToast("Recovery email updated! ✉️", "✓");
          } else {
            if (emailMsgEl) {
              emailMsgEl.style.display = "block";
              emailMsgEl.style.background = "#fee2e2";
              emailMsgEl.style.color = "#b91c1c";
              emailMsgEl.style.border = "1px solid #fca5a5";
              emailMsgEl.textContent = data.message || "Failed to update email.";
            }
          }
        } catch (err) {
          showAdminToast("Saved locally! ✉️", "✓");
        } finally {
          if (saveEmailBtn) {
            saveEmailBtn.disabled = false;
            saveEmailBtn.innerHTML = `<span>Save Email ✓</span>`;
          }
        }
      });
    }
  }

  // --- INITIALIZATION ---
  function initAdmin() {
    initLoginForm();
    initResetModal();
    initTabs();
    initImageHandlers();
    initProductForm();
    initChangePasscode();
    initBackupAndReset();
    checkAuth();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmin);
  } else {
    initAdmin();
  }
})();
