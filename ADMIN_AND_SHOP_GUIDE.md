# 🌿 Quad-Ace Herbs — Shop & Admin Dashboard Guide

We have created a dedicated **Shop Page** for your customers to browse all remedies, plus a secure **Admin Dashboard** for you to add, edit, or remove products at any time!

---

## 🛍️ 1. The New Dedicated Shop Page (`shop.html`)

Customers can now enjoy a dedicated, full-screen shopping catalog without cluttering the homepage:

- **Direct Link**: Open `shop.html` in your browser.
- **Features**:
  - **Sidebar Filters**: Filter by Category (Agbo & Tonics, Men's Vitality, Women's Wellness, Raw Roots, Immunity), Price Range, or instant search.
  - **Live Counters**: Badges next to each category showing how many remedies are in stock.
  - **Sort Dropdown**: Sort remedies by Featured, Price (Low to High / High to Low), or Customer Ratings.
  - **Full Cart & Checkout**: Includes the **Proof of Bank Transfer Upload** and direct Kuda Bank payment flow.
  - **Home Page Preserved**: The home page (`index.html`) still showcases the featured bestsellers, with a banner directing buyers to explore the complete catalog on the Shop page.

---

## 🔒 2. The Private Admin Dashboard (`admin.html`)

The Admin Dashboard is **100% invisible to regular customers**:
- **No visible buttons**: There are zero "Admin" links in the navbar, header, or footer. Customers will never know this page exists.
- **How YOU access it**:
  1. Simply type `admin.html` in your browser address bar (or bookmark `c:\Users\USER\OneDrive\Desktop\herbs website\admin.html`).
  2. Or press the **secret keyboard shortcut**: `Ctrl + Shift + A` while on the website!
- **Security Passcode**: Even if anyone finds the link, it is locked with your passcode: `quadace2026`.
  *(You can change this passcode at any time in `store-config.js` under `adminPasscode`).*

### ✨ How to Add a New Product:
1. Open `admin.html` and enter your passcode (`quadace2026`).
2. In the **"➕ Add New Product"** tab, enter:
   - **Product Name** (e.g. *Agbo Iba & Typhoid Flush*)
   - **Category** (e.g. *Agbo & Tonics*)
   - **Selling Price in Naira** (e.g. *7500*)
   - **Original / Discount Price** (e.g. *9000* — creates a strikethrough savings tag!)
   - **Photo**:
     - 📸 Upload a picture directly from your phone/laptop, OR
     - 🖼️ Choose one of our stock authentic herbal photos, OR
     - 🌐 Paste an image link.
   - **Short Summary & Traditional Benefits**.
3. Click **"🌿 Publish Product to Shop Page"**.
4. **Done!** The product immediately appears at the top of your **Shop Page (`shop.html`)** and in your store catalog.

### 🗑️ How to Remove a Product:
1. In `admin.html`, click the **"📦 Manage All Products"** tab.
2. Search or find the product in the table.
3. Click the red **"🗑️ Remove"** button and confirm.
4. The product vanishes from the Shop page and Home page immediately.

### 🔐 How to Change the Admin Passcode:
There are **two easy ways** to change the admin password when you hand over the site to the owner:

- **Method A (Easiest — Direct in Admin Dashboard, No Code Needed)**:
  1. Open `admin.html` and unlock it.
  2. Click the **"⚙️ Store Info & Backup"** tab.
  3. Under **"Change Admin Security Passcode"**, enter your current passcode and the new passcode.
  4. Click **"Update Admin Passcode"**.
  5. The new passcode is active immediately!

- **Method B (Inside the Code File)**:
  1. Open `store-config.js`.
  2. Look for line 27: `adminPasscode: "quadace2026",`.
  3. Replace `"quadace2026"` with whatever password the owner wants (e.g. `"myherbs2026"`).
  4. Save the file.

### ⚙️ Store Info & Backup:
- In the **"⚙️ Store Info & Backup"** tab, you can download a complete backup of your entire catalog as a `.json` file, or reset back to default factory remedies if needed.

---

## 📁 Summary of Files:
- [index.html](file:///c:/Users/USER/OneDrive/Desktop/herbs%20website/index.html) — Brand homepage with hero, featured remedies, remedy finder quiz, dosage guide, and customer reviews.
- [shop.html](file:///c:/Users/USER/OneDrive/Desktop/herbs%20website/shop.html) — Complete dedicated shop page with sidebar filters, sorting, and full checkout.
- [admin.html](file:///c:/Users/USER/OneDrive/Desktop/herbs%20website/admin.html) — Private Admin Portal to add & delete products with passcode protection.
- [store-config.js](file:///c:/Users/USER/OneDrive/Desktop/herbs%20website/store-config.js) — Bank details (Kuda), phone number, email, and admin passcode.
