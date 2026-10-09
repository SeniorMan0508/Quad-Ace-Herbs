/**
 * QUAD-ACE HERBS - SECURE BACKEND SERVER
 * =====================================
 * Handles secure admin authentication, email password resets,
 * and live catalog synchronization.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Load .env configuration file if present
const ENV_PATH = path.join(__dirname, '.env');
if (fs.existsSync(ENV_PATH)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(ENV_PATH);
    } else {
      const envRaw = fs.readFileSync(ENV_PATH, 'utf-8');
      envRaw.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[k]) process.env[k] = v;
          }
        }
      });
    }
  } catch (err) {
    console.warn('[ENV] Could not load .env file:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data Directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'custom-products.json');

// --- CRYPTOGRAPHIC UTILITIES ---
function hashSecret(secret, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifySecret(secret, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'utf-8'), Buffer.from(key, 'utf-8'));
}

// Active session tokens (token -> expiry timestamp)
const activeSessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token || !activeSessions.has(token)) return false;
  const expiry = activeSessions.get(token);
  if (Date.now() > expiry) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// --- EMAIL SENDER CONFIGURATION ---
const DEFAULT_OWNER_EMAIL = "badmusdaniel0508@gmail.com";
const DEFAULT_INITIAL_PASSWORD = "quadace2026";

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'email***@gmail.com';
  const [name, domain] = email.split('@');
  if (name.length <= 3) {
    return `${name[0]}***@${domain}`;
  }
  return `${name.slice(0, 3)}***@${domain}`;
}

function getEmailTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      service: process.env.SMTP_SERVICE || 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return null;
}

// In-memory verification code store (code -> { email, expiresAt })
const activeResetCodes = new Map();
let lastCodeSentTimestamp = 0;

async function sendResetEmail(toEmail, code) {
  const transporter = getEmailTransporter();
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #18422e; margin: 0; font-size: 22px;">🌿 Quad-Ace Herbs</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Admin Security & Password Reset</p>
      </div>
      <p style="color: #1e293b; font-size: 15px;">Hello Store Owner,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        We received a request to reset your admin dashboard passcode. Enter the following 6-digit verification code on your screen to set your new password:
      </p>
      <div style="background: #f4efe4; border: 1.5px solid #d4af37; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #18422e; font-family: monospace;">${code}</div>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.4;">
        ⏳ <strong>Note:</strong> This verification code is valid for <strong>15 minutes</strong>. If you did not request this password reset, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">Quad-Ace Herbs • Authentic Ancestral Remedies</p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Quad-Ace Herbs Security" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: "🌿 Your Quad-Ace Herbs Admin Password Reset Code",
        html: htmlContent
      });
      console.log(`[EMAIL] Verification code successfully sent via SMTP to ${toEmail}`);
      return { sent: true, method: 'smtp' };
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send email via SMTP:`, err.message);
      return { sent: false, error: err.message, method: 'smtp_failed' };
    }
  }

  // Graceful simulation log in console for development/offline testing
  console.log('\n======================================================');
  console.log(`✉️ [EMAIL SENT TO OWNER]`);
  console.log(`📬 To: ${toEmail}`);
  console.log(`🔑 6-Digit Verification Code: ${code}`);
  console.log(`⏳ Valid for: 15 minutes`);
  console.log(`💡 To configure real Gmail delivery, set SMTP_USER & SMTP_PASS in .env`);
  console.log('======================================================\n');
  return { sent: false, method: 'simulated' };
}

// --- INITIALIZE AUTH STORAGE ---
function getAuthData() {
  if (!fs.existsSync(AUTH_FILE)) {
    const initialData = {
      passwordHash: hashSecret(DEFAULT_INITIAL_PASSWORD),
      adminEmail: process.env.ADMIN_EMAIL || DEFAULT_OWNER_EMAIL,
      isDefaultPassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    console.log('\n======================================================');
    console.log('🌿 Quad-Ace Herbs Admin Security Initialized');
    console.log(`🔐 Default Admin Password: ${DEFAULT_INITIAL_PASSWORD}`);
    console.log(`✉️ Registered Owner Email: ${initialData.adminEmail}`);
    console.log('======================================================\n');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.adminEmail) {
      data.adminEmail = process.env.ADMIN_EMAIL || DEFAULT_OWNER_EMAIL;
      saveAuthData(data);
    }
    return data;
  } catch (err) {
    console.error('Error reading auth file, re-initializing:', err);
    return null;
  }
}

function saveAuthData(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Ensure auth file exists on startup
getAuthData();

// --- AUTHENTICATION API ENDPOINTS ---

/**
 * GET /api/auth/status
 * Check if backend is active, default password status, and masked owner email
 */
app.get('/api/auth/status', (req, res) => {
  const auth = getAuthData();
  const email = auth ? auth.adminEmail : DEFAULT_OWNER_EMAIL;
  res.json({
    active: true,
    isDefaultPassword: auth ? !!auth.isDefaultPassword : false,
    maskedEmail: maskEmail(email)
  });
});

/**
 * POST /api/auth/login
 * Verify entered password against encrypted hash
 */
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  const auth = getAuthData();
  if (!auth) {
    return res.status(500).json({ success: false, message: 'Server auth data unavailable' });
  }

  const isValid = verifySecret(password, auth.passwordHash);
  if (!isValid) {
    return res.status(401).json({ success: false, message: 'Incorrect admin passcode' });
  }

  const token = createSession();
  res.json({
    success: true,
    token,
    isDefaultPassword: !!auth.isDefaultPassword,
    message: 'Authentication successful'
  });
});

/**
 * POST /api/auth/change-password
 * Change password when current password is known
 */
app.post('/api/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : null;

  const auth = getAuthData();
  if (!auth) {
    return res.status(500).json({ success: false, message: 'Auth data unavailable' });
  }

  let isAuthorized = false;
  if (token && isValidSession(token)) {
    isAuthorized = true;
  } else if (currentPassword && verifySecret(currentPassword, auth.passwordHash)) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return res.status(401).json({ success: false, message: 'Current passcode is incorrect' });
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ success: false, message: 'New passcode must be at least 4 characters' });
  }

  auth.passwordHash = hashSecret(newPassword.trim());
  auth.isDefaultPassword = false;
  saveAuthData(auth);

  const newToken = createSession();
  console.log(`[AUTH] Admin password updated successfully at ${new Date().toISOString()}`);

  res.json({
    success: true,
    token: newToken,
    message: 'Admin passcode updated successfully! Your new password is now active.'
  });
});

/**
 * POST /api/auth/send-reset-code
 * Sends a 6-digit reset code to the owner's email
 */
app.post('/api/auth/send-reset-code', async (req, res) => {
  // Prevent excessive spam (at least 20 seconds between code requests)
  const now = Date.now();
  if (now - lastCodeSentTimestamp < 20000) {
    return res.status(429).json({
      success: false,
      message: 'Please wait a few seconds before requesting another code.'
    });
  }

  const auth = getAuthData();
  const ownerEmail = auth ? auth.adminEmail : DEFAULT_OWNER_EMAIL;

  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = now + 15 * 60 * 1000; // 15 minutes

  activeResetCodes.set(code, {
    email: ownerEmail,
    expiresAt: expiresAt
  });
  lastCodeSentTimestamp = now;

  try {
    const result = await sendResetEmail(ownerEmail, code);
    if (result.sent) {
      res.json({
        success: true,
        sent: true,
        message: `A 6-digit verification code has been sent directly to your Gmail inbox (${maskEmail(ownerEmail)}). Check your inbox and spam folder!`,
        maskedEmail: maskEmail(ownerEmail)
      });
    } else if (result.method === 'simulated') {
      res.json({
        success: true,
        sent: false,
        simulated: true,
        message: `[Development Notice] Real Gmail sending requires a Gmail App Password in .env. We've logged your 6-digit code in the server terminal, or configure .env to deliver directly to ${maskEmail(ownerEmail)}.`,
        maskedEmail: maskEmail(ownerEmail)
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Email sending failed: ${result.error || 'SMTP Error'}. Please check your Gmail App Password in .env.`
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to send verification email. Please try again.'
    });
  }
});

/**
 * POST /api/auth/verify-reset-code
 * Verifies the 6-digit email code and updates the password
 */
app.post('/api/auth/verify-reset-code', (req, res) => {
  const { code, newPassword } = req.body;

  if (!code || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Verification code and new passcode are both required'
    });
  }

  const cleanCode = code.trim();
  const record = activeResetCodes.get(cleanCode);

  if (!record) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code. Please check your email or request a new code.'
    });
  }

  if (Date.now() > record.expiresAt) {
    activeResetCodes.delete(cleanCode);
    return res.status(400).json({
      success: false,
      message: 'This verification code has expired. Please request a fresh code.'
    });
  }

  if (newPassword.trim().length < 4) {
    return res.status(400).json({
      success: false,
      message: 'New passcode must be at least 4 characters long'
    });
  }

  const auth = getAuthData();
  auth.passwordHash = hashSecret(newPassword.trim());
  auth.isDefaultPassword = false;
  saveAuthData(auth);

  // Consume code so it cannot be used again
  activeResetCodes.delete(cleanCode);

  const newToken = createSession();
  console.log(`[AUTH] Admin password was successfully reset via email OTP at ${new Date().toISOString()}`);

  res.json({
    success: true,
    token: newToken,
    message: 'Admin passcode reset successfully! You are now logged in.'
  });
});

/**
 * GET /api/auth/email
 * Get registered recovery email (requires session token)
 */
app.get('/api/auth/email', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : null;

  if (!isValidSession(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const auth = getAuthData();
  res.json({
    success: true,
    email: auth.adminEmail || DEFAULT_OWNER_EMAIL,
    maskedEmail: maskEmail(auth.adminEmail || DEFAULT_OWNER_EMAIL)
  });
});

/**
 * POST /api/auth/update-email
 * Update registered recovery email (requires session token)
 */
app.post('/api/auth/update-email', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/, '') : null;

  if (!isValidSession(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { newEmail } = req.body;
  if (!newEmail || !newEmail.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email address is required' });
  }

  const auth = getAuthData();
  auth.adminEmail = newEmail.trim().toLowerCase();
  saveAuthData(auth);

  res.json({
    success: true,
    email: auth.adminEmail,
    message: 'Recovery email updated successfully! Future password resets will be sent to this email.'
  });
});

// --- PRODUCT CATALOG API ENDPOINTS ---

function getCustomProducts() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveCustomProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

/**
 * GET /api/products
 * Get all custom products stored on server
 */
app.get('/api/products', (req, res) => {
  const products = getCustomProducts();
  res.json({ success: true, products });
});

/**
 * POST /api/products
 * Save a new or edited product
 */
app.post('/api/products', (req, res) => {
  const product = req.body;
  if (!product || !product.id || !product.name) {
    return res.status(400).json({ success: false, message: 'Invalid product data' });
  }

  const products = getCustomProducts();
  const existingIdx = products.findIndex(p => p.id === product.id);
  if (existingIdx >= 0) {
    products[existingIdx] = product;
  } else {
    products.unshift(product);
  }

  saveCustomProducts(products);
  res.json({ success: true, product, message: 'Product saved on server' });
});

/**
 * DELETE /api/products/:id
 * Remove a product
 */
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  let products = getCustomProducts();
  products = products.filter(p => p.id !== id);
  saveCustomProducts(products);
  res.json({ success: true, message: 'Product deleted from server' });
});

// --- STATIC WEBSITE HOSTING ---
app.use(express.static(__dirname));

// Route shortcuts
app.get('/shop', (req, res) => {
  res.sendFile(path.join(__dirname, 'shop.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Quad-Ace Herbs Web Server Running`);
  console.log(`🌐 Local URL:     http://localhost:${PORT}`);
  console.log(`🛍️  Shop Page:     http://localhost:${PORT}/shop.html`);
  console.log(`🔒 Admin Portal:  http://localhost:${PORT}/admin.html`);
  console.log(`======================================================\n`);
});
