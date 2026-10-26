import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, Printer, Package, Clock, ShoppingCart, X, Check, Settings as SettingsIcon, Barcode, AlertCircle, Pencil, Calculator, Monitor, Users } from 'lucide-react';
import { supabase } from './supabaseClient.js';

const TAGLINE = "Shop Smart. Shop Cobby's";

const DEFAULT_SETTINGS = {
  shopName: 'Cobbys Mart',
  address: '',
  phone: '',
  currency: '₦',
  vatEnabled: false,
  vatRate: 7.5,
};

const SAMPLE_PRODUCTS = [
  { barcode: '6001234500011', name: 'Matte Liquid Lipstick', price: 3500, stock: 24 },
  { barcode: '6001234500028', name: 'Hydrating Foundation 30ml', price: 8500, stock: 15 },
  { barcode: '6001234500035', name: 'Eyebrow Pencil', price: 1800, stock: 30 },
  { barcode: '6001234500042', name: 'Setting Spray', price: 5200, stock: 18 },
  { barcode: '6001234500059', name: 'Shea Body Butter 200ml', price: 4200, stock: 20 },
  { barcode: '6001234500066', name: 'Vitamin C Serum', price: 9800, stock: 12 },
  { barcode: '6001234500073', name: 'False Lashes Pack', price: 2200, stock: 25 },
  { barcode: '6001234500080', name: 'Nail Polish - Ruby Red', price: 1500, stock: 40 },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatMoney(amount, currency) {
  const n = Number(amount) || 0;
  const parts = n.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency}${parts.join('.')}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(iso, ref) {
  const a = new Date(iso);
  return a.getFullYear() === ref.getFullYear() && a.getMonth() === ref.getMonth() && a.getDate() === ref.getDate();
}

// --- mappers between DB rows (snake_case) and the app's camelCase shape ---
function rowToProduct(r) {
  return { id: r.id, barcode: r.barcode, name: r.name, price: Number(r.price), stock: r.stock === null ? null : Number(r.stock) };
}
function rowToSale(r) {
  return {
    id: r.id,
    number: r.number,
    timestamp: r.created_at,
    items: r.items,
    subtotal: Number(r.subtotal),
    discountPct: Number(r.discount_pct),
    discountAmt: Number(r.discount_amt),
    vatEnabled: r.vat_enabled,
    vatRate: Number(r.vat_rate),
    vatAmt: Number(r.vat_amt),
    total: Number(r.total),
    paymentMethod: r.payment_method,
    tendered: Number(r.tendered),
    change: Number(r.change),
    cashierName: r.cashier_name || null,
  };
}
function rowToSettings(r) {
  if (!r) return DEFAULT_SETTINGS;
  return {
    shopName: r.shop_name,
    address: r.address || '',
    phone: r.phone || '',
    currency: r.currency,
    vatEnabled: r.vat_enabled,
    vatRate: Number(r.vat_rate),
  };
}
function rowToLiveCart(r) {
  if (!r) return null;
  return {
    items: r.items || [],
    subtotal: Number(r.subtotal) || 0,
    discountAmt: Number(r.discount_amt) || 0,
    vatEnabled: r.vat_enabled,
    vatRate: Number(r.vat_rate) || 0,
    vatAmt: Number(r.vat_amt) || 0,
    total: Number(r.total) || 0,
  };
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      :root {
        --ink: #2B1D12;
        --base: #FFF8F2;
        --surface: #FFFFFF;
        --brand: #E8731E;
        --brand-dark: #C25E14;
        --accent: #F2A33D;
        --line: #F0DCC4;
        --muted: #8A7A6E;
      }
      * { box-sizing: border-box; }
      body { margin: 0; }
      .cpos { font-family: 'Inter', sans-serif; color: var(--ink); background: var(--base); }
      .cpos-display { font-family: 'Fraunces', serif; }
      .cpos-mono { font-family: 'IBM Plex Mono', monospace; }
      .cpos-btn-primary { background: var(--brand); color: #fff; transition: background .15s ease; border: none; }
      .cpos-btn-primary:hover:not(:disabled) { background: var(--brand-dark); }
      .cpos-btn-primary:disabled { background: #E9C9AE; color: #fff; cursor: not-allowed; }
      .cpos-btn-ghost { background: #fff; border: 1px solid var(--line); color: var(--ink); }
      .cpos-btn-ghost:hover { border-color: var(--brand); }
      .cpos-input { border: 1px solid var(--line); background: #fff; }
      .cpos-input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(232,115,30,0.15); }
      .cpos-tab-active { color: var(--brand); border-bottom: 2px solid var(--brand); }
      .cpos-tab { border-bottom: 2px solid transparent; color: var(--muted); }
      .torn-edge {
        height: 14px;
        background-image: radial-gradient(circle at 8px 8px, var(--base) 8px, transparent 8.5px);
        background-size: 16px 16px;
        background-position: -8px -8px;
        background-repeat: repeat-x;
      }
            @page {
        size: 80mm auto;
        margin: 0;
      }

      @media print {
        html, body, #root {
          width: 80mm !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
        }

        body * {
          visibility: hidden;
        }

        #receipt-print-area,
        #receipt-print-area * {
          visibility: visible;
        }

        #receipt-print-area {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 72mm !important;
          max-width: 72mm !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        #receipt-print-area .receipt-paper-print {
          width: 72mm !important;
          max-width: 72mm !important;
          margin: 0 !important;
          padding: 3mm !important;
          box-sizing: border-box !important;
          border: 0 !important;
          box-shadow: none !important;
          color: #000 !important;
          background: #fff !important;
        }

        #receipt-print-area .receipt-paper-print * {
          color: #000 !important;
        }

        .no-print {
          display: none !important;
        }
    `}</style>
  );
}

function Loading() {
  return (
    <div className="cpos" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <GlobalStyle />
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
    </div>
  );
}

function LoginScreen({ shopName, onCustomerView }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password'); return; }
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const onKeyDown = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="cpos" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <GlobalStyle />
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.png" alt="" style={{ width: 88, height: 88, objectFit: 'contain', marginBottom: 8 }} />
          <div className="cpos-display" style={{ fontSize: 24, fontWeight: 700 }}>{shopName}</div>
          <div style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, marginTop: 2 }}>{TAGLINE}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>Staff sign in</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Email</label>
            <input
              className="cpos-input" type="email" autoFocus autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Password</label>
            <input
              className="cpos-input" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }}
            />
          </div>
          {error ? <div style={{ color: 'var(--brand-dark)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><AlertCircle size={14} />{error}</div> : null}
          <button onClick={submit} disabled={loading} className="cpos-btn-primary" style={{ padding: '12px', borderRadius: 12, fontWeight: 600, marginTop: 4 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
        <button onClick={onCustomerView} style={{ display: 'block', margin: '20px auto 0', fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none' }}>
          This is the customer display →
        </button>
      </div>
    </div>
  );
}

function ReceiptPaper({ sale, settings }) {
  return (
    <div className="cpos-mono" style={{ maxWidth: 320, margin: '0 auto' }}>
      <div className="torn-edge no-print" />
      <div className="receipt-paper-print" style={{ padding: '20px 18px', background: '#fff', border: '1px solid var(--line)' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src="/logo.png" alt="" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 4 }} />
          <div className="cpos-display" style={{ fontSize: 20, fontWeight: 700 }}>{settings.shopName}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{TAGLINE}</div>
          {settings.address ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{settings.address}</div> : null}
          {settings.phone ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>{settings.phone}</div> : null}
        </div>
        <div style={{ fontSize: 11, borderTop: '1px dashed var(--line)', borderBottom: '1px dashed var(--line)', padding: '6px 0', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Receipt #</span><span>{String(sale.number).padStart(4, '0')}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Date</span><span>{formatDateTime(sale.timestamp)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Payment</span><span style={{ textTransform: 'capitalize' }}>{sale.paymentMethod}</span></div>
          {sale.cashierName ? <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cashier</span><span>{sale.cashierName}</span></div> : null}
        </div>
        <div style={{ fontSize: 12 }}>
          {sale.items.map((it) => (
            <div key={it.lineId} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{it.name}</span>
                <span>{formatMoney(it.price * it.qty, settings.currency)}</span>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 11 }}>{it.qty} x {formatMoney(it.price, settings.currency)}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px dashed var(--line)', marginTop: 8, paddingTop: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatMoney(sale.subtotal, settings.currency)}</span></div>
          {sale.discountAmt > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount ({sale.discountPct}%)</span><span>-{formatMoney(sale.discountAmt, settings.currency)}</span></div>
          ) : null}
          {sale.vatEnabled ? (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>VAT ({sale.vatRate}%)</span><span>{formatMoney(sale.vatAmt, settings.currency)}</span></div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14, marginTop: 4 }}><span>TOTAL</span><span>{formatMoney(sale.total, settings.currency)}</span></div>
          {sale.paymentMethod === 'cash' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span>Tendered</span><span>{formatMoney(sale.tendered, settings.currency)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Change</span><span>{formatMoney(sale.change, settings.currency)}</span></div>
            </>
          ) : null}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, marginTop: 14, color: 'var(--muted)' }}>Thank you for shopping with us!</div>
      </div>
      <div className="torn-edge no-print" style={{ transform: 'scaleY(-1)' }} />
    </div>
  );
}

function ReceiptModal({ sale, settings, onClose, isNew }) {
  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(43,29,18,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--base)', width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{isNew ? 'Sale complete' : 'Receipt'}</span>
          <button onClick={onClose} className="cpos-btn-ghost" style={{ padding: 6, borderRadius: 8, display: 'flex' }}><X size={18} /></button>
        </div>
        <div id="receipt-print-area">
          <ReceiptPaper sale={sale} settings={settings} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => window.print()} className="cpos-btn-primary" style={{ flex: 1, padding: '12px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 }}>
            <Printer size={16} /> Print receipt
          </button>
          <button onClick={onClose} className="cpos-btn-ghost" style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 600 }}>
            {isNew ? 'New sale' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ initial, onSave, onClose, existingBarcodes }) {
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [stock, setStock] = useState(initial?.stock ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { setError('Product name is required'); return; }
    const priceNum = Number(price);
    if (!price || isNaN(priceNum) || priceNum < 0) { setError('Enter a valid price'); return; }
    const code = barcode.trim();
    if (code && existingBarcodes.includes(code) && code !== initial?.barcode) {
      setError('That barcode is already used by another product');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id || null,
        barcode: code || null,
        name: name.trim(),
        price: priceNum,
        stock: stock === '' ? null : Math.max(0, Number(stock) || 0),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(43,29,18,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 380, borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="cpos-display" style={{ fontSize: 18, fontWeight: 700 }}>{initial ? 'Edit product' : 'Add product'}</span>
          <button onClick={onClose} className="cpos-btn-ghost" style={{ padding: 6, borderRadius: 8, display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Barcode (optional)</label>
            <input className="cpos-input" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type barcode" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Product name</label>
            <input className="cpos-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Matte Liquid Lipstick" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Price</label>
              <input className="cpos-input" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Stock (optional)</label>
              <input className="cpos-input" type="number" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Not tracked" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
            </div>
          </div>
          {error ? <div style={{ color: 'var(--brand-dark)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><AlertCircle size={14} />{error}</div> : null}
          <button onClick={save} disabled={saving} className="cpos-btn-primary" style={{ padding: '12px', borderRadius: 12, fontWeight: 600, marginTop: 4 }}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ settings, onSave, onClose, session, profile, onSignOut }) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const doSave = async () => {
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(43,29,18,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 380, borderRadius: 16, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="cpos-display" style={{ fontSize: 18, fontWeight: 700 }}>Shop settings</span>
          <button onClick={onClose} className="cpos-btn-ghost" style={{ padding: 6, borderRadius: 8, display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Shop name</label>
            <input className="cpos-input" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Address (optional)</label>
            <input className="cpos-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Phone (optional)</label>
            <input className="cpos-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Currency symbol</label>
            <input className="cpos-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Charge VAT</label>
            <button
              onClick={() => setForm({ ...form, vatEnabled: !form.vatEnabled })}
              style={{ width: 44, height: 26, borderRadius: 999, background: form.vatEnabled ? 'var(--brand)' : 'var(--line)', position: 'relative', border: 'none' }}
            >
              <span style={{ position: 'absolute', top: 3, left: form.vatEnabled ? 22 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s ease' }} />
            </button>
          </div>
          {form.vatEnabled ? (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>VAT rate (%)</label>
              <input className="cpos-input" type="number" inputMode="decimal" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 4, fontSize: 14 }} />
            </div>
          ) : null}
          <button onClick={doSave} disabled={saving} className="cpos-btn-primary" style={{ padding: '12px', borderRadius: 12, fontWeight: 600, marginTop: 4 }}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Signed in as</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
              {profile?.display_name || session?.user?.email}
              <span style={{ fontWeight: 400, color: 'var(--muted)', textTransform: 'capitalize' }}> · {profile?.role}</span>
            </div>
            <button onClick={onSignOut} className="cpos-btn-ghost" style={{ marginTop: 10, padding: '10px', borderRadius: 10, fontWeight: 600, fontSize: 13, width: '100%' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamTab({ settings, currentUserId }) {
  const [staff, setStaff] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: sales }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at'),
        supabase.from('sales').select('cashier_id, total, created_at'),
      ]);
      setStaff(profiles || []);
      setSalesRows(sales || []);
      setLoading(false);
    })();
  }, []);

  const today = new Date();
  const statsFor = (id) => {
    const mine = salesRows.filter((s) => s.cashier_id === id);
    const todayMine = mine.filter((s) => isSameDay(s.created_at, today));
    return {
      todayCount: todayMine.length,
      todayTotal: todayMine.reduce((sum, s) => sum + Number(s.total), 0),
      allCount: mine.length,
      allTotal: mine.reduce((sum, s) => sum + Number(s.total), 0),
    };
  };

  const toggleRole = async (person) => {
    setBusyId(person.id);
    const newRole = person.role === 'manager' ? 'cashier' : 'manager';
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', person.id);
    if (!error) setStaff((prev) => prev.map((p) => (p.id === person.id ? { ...p, role: newRole } : p)));
    setBusyId(null);
  };

  if (loading) return <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        To add a staff member, create their login in Supabase (Authentication → Users) — they'll show up here as a cashier automatically.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {staff.map((p) => {
          const stats = statsFor(p.id);
          return (
            <div key={p.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.display_name || p.email}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: p.role === 'manager' ? 'var(--brand-dark)' : 'var(--muted)', background: p.role === 'manager' ? '#FBE7D3' : 'var(--base)', padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>
                  {p.role}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                Today: <strong style={{ color: 'var(--ink)' }}>{stats.todayCount} sale{stats.todayCount === 1 ? '' : 's'} · {formatMoney(stats.todayTotal, settings.currency)}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                All time: <strong style={{ color: 'var(--ink)' }}>{stats.allCount} sale{stats.allCount === 1 ? '' : 's'} · {formatMoney(stats.allTotal, settings.currency)}</strong>
              </div>
              {p.id !== currentUserId ? (
                <button
                  onClick={() => toggleRole(p)}
                  disabled={busyId === p.id}
                  className="cpos-btn-ghost"
                  style={{ marginTop: 10, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}
                >
                  {busyId === p.id ? 'Updating…' : p.role === 'manager' ? 'Demote to cashier' : 'Promote to manager'}
                </button>
              ) : (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>This is you</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomerScreen({ settings, onExit }) {
  const [liveCart, setLiveCart] = useState(null);
  const [completed, setCompleted] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchInitial = async () => {
      const [{ data: lc }, { data: cs }] = await Promise.all([
        supabase.from('live_cart').select('*').eq('id', 1).maybeSingle(),
        supabase.from('last_completed_sale').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (!active) return;
      if (lc) setLiveCart(rowToLiveCart(lc));
      if (cs) setCompleted(cs);
    };
    fetchInitial();

    const channel = supabase
      .channel('pos-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_cart' }, (payload) => {
        if (active) setLiveCart(rowToLiveCart(payload.new));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'last_completed_sale' }, (payload) => {
        if (active) setCompleted(payload.new);
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const hasActiveCart = liveCart && liveCart.items && liveCart.items.length > 0;
  const recentlyCompleted = !hasActiveCart && completed && completed.sale && completed.completed_at &&
    (Date.now() - new Date(completed.completed_at).getTime()) < 15000;

  return (
    <div className="cpos" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GlobalStyle />
      <div style={{ textAlign: 'center', padding: '28px 20px 16px' }}>
        <img src="/logo.png" alt="" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 6 }} />
        <div className="cpos-display" style={{ fontSize: 26, fontWeight: 700 }}>{settings.shopName}</div>
        <div style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, marginTop: 2 }}>{TAGLINE}</div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 90px', display: 'flex', flexDirection: 'column' }}>
        {hasActiveCart ? (
          <>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {liveCart.items.map((it) => (
                <div key={it.lineId} style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{it.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{it.qty} x {formatMoney(it.price, settings.currency)}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{formatMoney(it.price * it.qty, settings.currency)}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}><span>Subtotal</span><span>{formatMoney(liveCart.subtotal, settings.currency)}</span></div>
              {liveCart.discountAmt > 0 ? <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}><span>Discount</span><span>-{formatMoney(liveCart.discountAmt, settings.currency)}</span></div> : null}
              {liveCart.vatEnabled ? <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}><span>VAT ({liveCart.vatRate}%)</span><span>{formatMoney(liveCart.vatAmt, settings.currency)}</span></div> : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, fontWeight: 700, marginTop: 6 }}><span>Total</span><span>{formatMoney(liveCart.total, settings.currency)}</span></div>
            </div>
          </>
        ) : recentlyCompleted ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={30} color="#fff" />
            </div>
            <div className="cpos-display" style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>Thank you!</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{formatMoney(completed.sale.total, settings.currency)}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', textTransform: 'capitalize' }}>Paid by {completed.sale.paymentMethod}</div>
            {completed.sale.paymentMethod === 'cash' && completed.sale.change > 0 ? (
              <div style={{ fontSize: 15, marginTop: 6 }}>Your change: <strong>{formatMoney(completed.sale.change, settings.currency)}</strong></div>
            ) : null}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8 }}>
            <div className="cpos-display" style={{ fontSize: 22, fontWeight: 700 }}>Welcome</div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Your order will appear here as items are scanned.</div>
          </div>
        )}
      </div>

      <button onClick={onExit} className="no-print" style={{ position: 'fixed', bottom: 10, right: 10, fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', opacity: 0.55 }}>
        Switch to staff sign-in
      </button>
    </div>
  );
}

function CalculatorModal({ onClose, onUseResult, showUseResult }) {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waiting, setWaiting] = useState(false);

  const formatResult = (n) => {
    if (!isFinite(n)) return 'Error';
    const rounded = Math.round(n * 1e8) / 1e8;
    return String(rounded);
  };

  const inputDigit = (d) => {
    setDisplay((cur) => {
      if (waiting) { setWaiting(false); return d; }
      if (cur === '0') return d;
      if (cur.replace('-', '').replace('.', '').length >= 12) return cur;
      return cur + d;
    });
  };
  const inputDot = () => {
    setDisplay((cur) => {
      if (waiting) { setWaiting(false); return '0.'; }
      return cur.includes('.') ? cur : cur + '.';
    });
  };
  const clearAll = () => { setDisplay('0'); setStored(null); setOperator(null); setWaiting(false); };
  const toggleSign = () => setDisplay((cur) => (cur === '0' ? cur : cur.startsWith('-') ? cur.slice(1) : '-' + cur));
  const percent = () => setDisplay((cur) => formatResult(Number(cur) / 100));

  const compute = (a, op, b) => {
    switch (op) {
      case '+': return a + b;
      case '−': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const chooseOperator = (op) => {
    const current = Number(display);
    if (operator && stored !== null && !waiting) {
      const result = compute(stored, operator, current);
      setDisplay(formatResult(result));
      setStored(result);
    } else {
      setStored(current);
    }
    setOperator(op);
    setWaiting(true);
  };

  const equals = () => {
    if (operator === null || stored === null) return;
    const current = Number(display);
    const result = compute(stored, operator, current);
    setDisplay(formatResult(result));
    setStored(null);
    setOperator(null);
    setWaiting(true);
  };

  const btnBase = { fontSize: 19, fontWeight: 600, borderRadius: 14, padding: '16px 0', border: 'none' };
  const numBtn = { ...btnBase, background: '#fff', border: '1px solid var(--line)' };
  const opBtn = { ...btnBase, background: 'var(--accent)', color: 'var(--ink)' };
  const fnBtn = { ...btnBase, background: 'var(--line)', color: 'var(--ink)' };

  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(43,29,18,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: 'var(--base)', width: '100%', maxWidth: 400, borderRadius: '20px 20px 0 0', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Calculator</span>
          <button onClick={onClose} className="cpos-btn-ghost" style={{ padding: 6, borderRadius: 8, display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 16px', marginBottom: 12, textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', minHeight: 16 }}>{stored !== null && operator ? `${formatResult(stored)} ${operator}` : '\u00A0'}</div>
          <div className="cpos-mono" style={{ fontSize: 36, fontWeight: 600, overflowX: 'auto', whiteSpace: 'nowrap' }}>{display}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <button onClick={clearAll} style={fnBtn}>C</button>
          <button onClick={toggleSign} style={fnBtn}>+/-</button>
          <button onClick={percent} style={fnBtn}>%</button>
          <button onClick={() => chooseOperator('÷')} style={opBtn}>÷</button>

          <button onClick={() => inputDigit('7')} style={numBtn}>7</button>
          <button onClick={() => inputDigit('8')} style={numBtn}>8</button>
          <button onClick={() => inputDigit('9')} style={numBtn}>9</button>
          <button onClick={() => chooseOperator('×')} style={opBtn}>×</button>

          <button onClick={() => inputDigit('4')} style={numBtn}>4</button>
          <button onClick={() => inputDigit('5')} style={numBtn}>5</button>
          <button onClick={() => inputDigit('6')} style={numBtn}>6</button>
          <button onClick={() => chooseOperator('−')} style={opBtn}>−</button>

          <button onClick={() => inputDigit('1')} style={numBtn}>1</button>
          <button onClick={() => inputDigit('2')} style={numBtn}>2</button>
          <button onClick={() => inputDigit('3')} style={numBtn}>3</button>
          <button onClick={() => chooseOperator('+')} style={opBtn}>+</button>

          <button onClick={() => inputDigit('0')} style={{ ...numBtn, gridColumn: 'span 2' }}>0</button>
          <button onClick={inputDot} style={numBtn}>.</button>
          <button onClick={equals} className="cpos-btn-primary" style={btnBase}>=</button>
        </div>
        {showUseResult ? (
          <button
            onClick={() => onUseResult(display)}
            className="cpos-btn-ghost"
            style={{ width: '100%', padding: '12px', borderRadius: 12, fontWeight: 600, fontSize: 13, marginTop: 12 }}
          >
            Use {display} as amount tendered
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState('cashier');

  // auth
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState(null);

  // data
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [tab, setTab] = useState('checkout');
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountTendered, setAmountTendered] = useState('');

  const [lastSale, setLastSale] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [historySale, setHistorySale] = useState(null);
  const [toast, setToast] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [productModal, setProductModal] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showCalculator, setShowCalculator] = useState(false);

  const barcodeRef = useRef(null);
  const quickAddNameRef = useRef(null);

  // --- auth session ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data, error }) => {
      if (!error) setProfile(data);
    });
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setShowSettings(false);
  };

  // --- public settings (needed by login screen + customer screen too) ---
  useEffect(() => {
    (async () => {
      const { data: cfg, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
      if (!error) setSettings(rowToSettings(cfg));
      setSettingsReady(true);
    })();
  }, []);

  // --- staff-only data, loaded once signed in ---
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const [{ data: p, error: pe }, { data: s, error: se }] = await Promise.all([
          supabase.from('products').select('*').order('name'),
          supabase.from('sales').select('*').order('created_at', { ascending: true }),
        ]);
        if (pe || se) throw pe || se;
        setProducts((p || []).map(rowToProduct));
        setSales((s || []).map(rowToSale));
      } catch (e) {
        setLoadError(e.message || 'Could not load shop data.');
      }
      setDataReady(true);
    })();
  }, [session]);

  useEffect(() => {
    if (tab === 'checkout' && !showReceipt && !productModal && !showSettings) {
      barcodeRef.current?.focus();
    }
  }, [tab, showReceipt, productModal, showSettings, cart]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const addToCart = (product, qty = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.productId === product.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { lineId: uid(), productId: product.id, barcode: product.barcode, name: product.name, price: product.price, qty }];
    });
  };

  const addCustomToCart = () => {
    const priceNum = Number(customPrice);
    if (!customName.trim() || !customPrice || isNaN(priceNum) || priceNum < 0) {
      setToast({ type: 'error', text: 'Enter a name and valid price' });
      return;
    }
    setCart((prev) => [...prev, { lineId: uid(), productId: null, barcode: null, name: customName.trim(), price: priceNum, qty: 1 }]);
    setCustomName('');
    setCustomPrice('');
    setShowCustomItem(false);
  };

  const updateQty = (lineId, delta) => {
    setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, qty: Math.max(1, c.qty + delta) } : c)));
  };
  const removeLine = (lineId) => setCart((prev) => prev.filter((c) => c.lineId !== lineId));

  const handleBarcodeKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    const product = products.find((p) => p.barcode && p.barcode === code);
    if (product) {
      addToCart(product);
      setToast({ type: 'ok', text: `Added ${product.name}` });
      setBarcodeInput('');
      setUnknownBarcode(null);
    } else {
      setUnknownBarcode(code);
      setBarcodeInput('');
      setTimeout(() => quickAddNameRef.current?.focus(), 50);
    }
  };

  const quickAddSubmit = async (name, price) => {
    const priceNum = Number(price);
    if (!name.trim() || !price || isNaN(priceNum) || priceNum < 0) {
      setToast({ type: 'error', text: 'Enter a name and valid price' });
      return;
    }
    const { data, error } = await supabase
      .from('products')
      .insert({ barcode: unknownBarcode, name: name.trim(), price: priceNum, stock: null })
      .select()
      .single();
    if (error) {
      setToast({ type: 'error', text: 'Could not save that product' });
      return;
    }
    const product = rowToProduct(data);
    setProducts((prev) => [...prev, product].sort((a, b) => a.name.localeCompare(b.name)));
    addToCart(product);
    setToast({ type: 'ok', text: `Added ${product.name} to catalog and cart` });
    setUnknownBarcode(null);
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))).slice(0, 6);
  }, [searchQuery, products]);

  const subtotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.qty, 0), [cart]);
  const discountAmt = useMemo(() => subtotal * (Number(discountPct) || 0) / 100, [subtotal, discountPct]);
  const afterDiscount = subtotal - discountAmt;
  const vatAmt = settings.vatEnabled ? afterDiscount * (Number(settings.vatRate) || 0) / 100 : 0;
  const total = afterDiscount + vatAmt;
  const tendered = Number(amountTendered) || 0;
  const change = paymentMethod === 'cash' ? Math.max(0, tendered - total) : 0;
  const canComplete = cart.length > 0 && (paymentMethod !== 'cash' || tendered >= total);

  // Push the in-progress cart to the DB so the customer screen updates live
  useEffect(() => {
    if (!session || viewMode !== 'cashier') return;
    const payload = {
      id: 1,
      items: cart,
      subtotal,
      discount_amt: discountAmt,
      vat_enabled: settings.vatEnabled,
      vat_rate: settings.vatRate,
      vat_amt: vatAmt,
      total,
      updated_at: new Date().toISOString(),
    };
    const t = setTimeout(() => {
      supabase.from('live_cart').upsert(payload).then(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [session, viewMode, cart, subtotal, discountAmt, vatAmt, total, settings.vatEnabled, settings.vatRate]);

  const completeSale = async () => {
    if (!canComplete) {
      if (cart.length === 0) setToast({ type: 'error', text: 'Cart is empty' });
      else setToast({ type: 'error', text: 'Amount tendered is less than total' });
      return;
    }
    const { data: saleRow, error } = await supabase
      .from('sales')
      .insert({
        items: cart,
        subtotal,
        discount_pct: Number(discountPct) || 0,
        discount_amt: discountAmt,
        vat_enabled: settings.vatEnabled,
        vat_rate: settings.vatRate,
        vat_amt: vatAmt,
        total,
        payment_method: paymentMethod,
        tendered: paymentMethod === 'cash' ? tendered : total,
        change,
        cashier_id: session.user.id,
        cashier_name: profile?.display_name || session.user.email,
      })
      .select()
      .single();

    if (error) {
      setToast({ type: 'error', text: 'Could not save this sale — try again' });
      return;
    }
    const sale = rowToSale(saleRow);
    setSales((prev) => [...prev, sale]);

    await supabase.from('last_completed_sale').upsert({ id: 1, sale, completed_at: new Date().toISOString() });

    const stockUpdates = cart
      .filter((line) => line.productId)
      .map((line) => {
        const product = products.find((p) => p.id === line.productId);
        if (product && typeof product.stock === 'number') {
          const newStock = Math.max(0, product.stock - line.qty);
          return supabase.from('products').update({ stock: newStock }).eq('id', product.id).then(() => ({ id: product.id, newStock }));
        }
        return null;
      })
      .filter(Boolean);
    const results = await Promise.all(stockUpdates);
    if (results.length) {
      setProducts((prev) => prev.map((p) => {
        const hit = results.find((r) => r.id === p.id);
        return hit ? { ...p, stock: hit.newStock } : p;
      }));
    }

    setLastSale(sale);
    setShowReceipt(true);
    setCart([]);
    setDiscountPct('');
    setAmountTendered('');
    setPaymentMethod('cash');
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  const saveProduct = async (product) => {
    if (product.id) {
      const { error } = await supabase.from('products').update({
        barcode: product.barcode, name: product.name, price: product.price, stock: product.stock,
      }).eq('id', product.id);
      if (error) { setToast({ type: 'error', text: 'Could not save changes' }); return; }
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...product } : p)));
      setToast({ type: 'ok', text: 'Product updated' });
    } else {
      const { data, error } = await supabase.from('products').insert({
        barcode: product.barcode, name: product.name, price: product.price, stock: product.stock,
      }).select().single();
      if (error) { setToast({ type: 'error', text: 'Could not add product' }); return; }
      setProducts((prev) => [...prev, rowToProduct(data)].sort((a, b) => a.name.localeCompare(b.name)));
      setToast({ type: 'ok', text: 'Product added' });
    }
    setProductModal(null);
  };

  const deleteProduct = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) setProducts((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
  };

  const loadSamples = async () => {
    const { data, error } = await supabase.from('products').insert(SAMPLE_PRODUCTS).select();
    if (error) { setToast({ type: 'error', text: 'Could not load samples' }); return; }
    setProducts((prev) => [...prev, ...data.map(rowToProduct)].sort((a, b) => a.name.localeCompare(b.name)));
    setToast({ type: 'ok', text: 'Sample products added' });
  };

  const saveSettings = async (form) => {
    const { error } = await supabase.from('settings').upsert({
      id: 1,
      shop_name: form.shopName,
      address: form.address,
      phone: form.phone,
      currency: form.currency,
      vat_enabled: form.vatEnabled,
      vat_rate: form.vatRate,
    });
    if (!error) {
      setSettings(form);
      setShowSettings(false);
    } else {
      setToast({ type: 'error', text: 'Could not save settings' });
    }
  };

  const today = new Date();
  const todaySales = sales.filter((s) => isSameDay(s.timestamp, today));
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  const isManager = profile?.role === 'manager';

  if (viewMode === 'customer') {
    return <CustomerScreen settings={settings} onExit={() => setViewMode('cashier')} />;
  }

  if (!settingsReady || !authChecked) {
    return <Loading />;
  }

  if (!session) {
    return <LoginScreen shopName={settings.shopName} onCustomerView={() => setViewMode('customer')} />;
  }

  if (!profile || !dataReady) {
    return <Loading />;
  }

  if (loadError) {
    return (
      <div className="cpos" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <GlobalStyle />
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Couldn't load shop data</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{loadError}</div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'checkout', label: 'Checkout', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'history', label: 'History', icon: Clock },
  ];
  if (isManager) tabs.push({ id: 'team', label: 'Team', icon: Users });

  return (
    <div className="cpos" style={{ minHeight: '100vh', paddingBottom: tab === 'checkout' ? 96 : 24 }}>
      <GlobalStyle />

      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--base)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <img src="/logo.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }} />
            <span className="cpos-display" style={{ fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{settings.shopName}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={() => setShowCalculator(true)} className="cpos-btn-ghost" style={{ padding: 8, borderRadius: 10, display: 'flex' }}>
              <Calculator size={17} />
            </button>
            <button onClick={() => setViewMode('customer')} className="cpos-btn-ghost" style={{ padding: 8, borderRadius: 10, display: 'flex' }}>
              <Monitor size={17} />
            </button>
            <button onClick={() => setShowSettings(true)} className="cpos-btn-ghost" style={{ padding: 8, borderRadius: 10, display: 'flex' }}>
              <SettingsIcon size={17} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', padding: '0 12px' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={tab === t.id ? 'cpos-tab-active' : 'cpos-tab'}
              style={{ flex: 1, padding: '10px 4px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none' }}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {toast ? (
        <div className="no-print" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 70, background: toast.type === 'error' ? 'var(--brand-dark)' : '#2E7D4F', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.text}
        </div>
      ) : null}

      {tab === 'checkout' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
              <Barcode size={18} color="var(--brand)" />
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Scan barcode, then press Enter"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15 }}
                autoComplete="off"
              />
            </div>
            {unknownBarcode ? (
              <div style={{ marginTop: 8, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  No product found for <span className="cpos-mono">{unknownBarcode}</span> — add it now:
                </div>
                <QuickAddInline nameRef={quickAddNameRef} onSubmit={quickAddSubmit} onCancel={() => setUnknownBarcode(null)} />
              </div>
            ) : null}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
              <Search size={17} color="var(--muted)" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14 }}
              />
            </div>
            {searchResults.length > 0 ? (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { addToCart(p); setToast({ type: 'ok', text: `Added ${p.name}` }); setSearchQuery(''); }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 13 }}
                  >
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 600 }}>{formatMoney(p.price, settings.currency)}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <button
              onClick={() => setShowCustomItem((v) => !v)}
              style={{ marginTop: 8, fontSize: 12, color: 'var(--brand-dark)', fontWeight: 600, background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={13} /> Add item not in catalog
            </button>
            {showCustomItem ? (
              <div style={{ marginTop: 8, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'flex', gap: 8 }}>
                <input className="cpos-input" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Item name" style={{ flex: 2, padding: '9px 10px', borderRadius: 8, fontSize: 13 }} />
                <input className="cpos-input" type="number" inputMode="decimal" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Price" style={{ flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 13 }} />
                <button onClick={addCustomToCart} className="cpos-btn-primary" style={{ padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Add</button>
              </div>
            ) : null}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              Cart {cart.length > 0 ? `· ${cart.reduce((n, c) => n + c.qty, 0)} items` : ''}
            </div>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--muted)', fontSize: 13, background: '#fff', border: '1px dashed var(--line)', borderRadius: 12 }}>
                Scan a barcode or search above to start a sale.
                {products.length === 0 ? (
                  <div style={{ marginTop: 6 }}>No products yet — add some in the <button onClick={() => setTab('products')} style={{ color: 'var(--brand-dark)', fontWeight: 600, background: 'none', border: 'none' }}>Products</button> tab.</div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cart.map((c) => (
                  <div key={c.lineId} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatMoney(c.price, settings.currency)} each</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => updateQty(c.lineId, -1)} className="cpos-btn-ghost" style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
                      <span style={{ minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{c.qty}</span>
                      <button onClick={() => updateQty(c.lineId, 1)} className="cpos-btn-ghost" style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, minWidth: 64, textAlign: 'right' }}>{formatMoney(c.price * c.qty, settings.currency)}</div>
                    <button onClick={() => removeLine(c.lineId)} style={{ background: 'none', border: 'none', color: 'var(--brand-dark)', display: 'flex' }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 13, color: 'var(--muted)' }}>Discount %</label>
                <input className="cpos-input" type="number" inputMode="decimal" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0" style={{ width: 80, padding: '6px 8px', borderRadius: 8, fontSize: 13, textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>Subtotal</span><span>{formatMoney(subtotal, settings.currency)}</span></div>
                {discountAmt > 0 ? <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>Discount</span><span>-{formatMoney(discountAmt, settings.currency)}</span></div> : null}
                {settings.vatEnabled ? <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>VAT ({settings.vatRate}%)</span><span>{formatMoney(vatAmt, settings.currency)}</span></div> : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, marginTop: 2 }}><span>Total</span><span>{formatMoney(total, settings.currency)}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['cash', 'card', 'transfer'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12.5, fontWeight: 600, textTransform: 'capitalize',
                      background: paymentMethod === m ? 'var(--brand)' : '#fff', color: paymentMethod === m ? '#fff' : 'var(--ink)',
                      border: paymentMethod === m ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {paymentMethod === 'cash' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 13, color: 'var(--muted)' }}>Amount tendered</label>
                    <input className="cpos-input" type="number" inputMode="decimal" value={amountTendered} onChange={(e) => setAmountTendered(e.target.value)} placeholder="0.00" style={{ width: 110, padding: '6px 8px', borderRadius: 8, fontSize: 13, textAlign: 'right' }} />
                  </div>
                  {tendered > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, color: tendered >= total ? 'var(--muted)' : 'var(--brand-dark)' }}>
                      <span>Change</span><span>{formatMoney(change, settings.currency)}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {tab === 'checkout' && cart.length > 0 ? (
        <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid var(--line)', padding: 12, zIndex: 20 }}>
          <button onClick={completeSale} disabled={!canComplete} className="cpos-btn-primary" style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Check size={17} /> Complete sale · {formatMoney(total, settings.currency)}
          </button>
        </div>
      ) : null}

      {tab === 'products' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => setProductModal({ initial: null })} className="cpos-btn-primary" style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={15} /> Add product
            </button>
          </div>
          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', background: '#fff', border: '1px dashed var(--line)', borderRadius: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>No products yet.</div>
              <button onClick={loadSamples} className="cpos-btn-ghost" style={{ padding: '9px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 600 }}>Load 8 sample products</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {products.map((p) => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 8 }}>
                        {p.barcode ? <span className="cpos-mono">{p.barcode}</span> : <span>No barcode</span>}
                        {typeof p.stock === 'number' ? <span>· {p.stock} in stock</span> : null}
                      </div>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{formatMoney(p.price, settings.currency)}</div>
                    <button onClick={() => setProductModal({ initial: p })} className="cpos-btn-ghost" style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={13} /></button>
                    <button onClick={() => setConfirmDeleteId(p.id)} style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--brand-dark)' }}><Trash2 size={14} /></button>
                  </div>
                  {confirmDeleteId === p.id ? (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>Delete this product?</span>
                      <button onClick={() => deleteProduct(p.id)} style={{ color: 'var(--brand-dark)', fontWeight: 700, background: 'none', border: 'none' }}>Yes, delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ color: 'var(--muted)', background: 'none', border: 'none' }}>Cancel</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div style={{ padding: 16 }}>
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Today</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{todaySales.length} sale{todaySales.length === 1 ? '' : 's'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Total</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{formatMoney(todayTotal, settings.currency)}</div>
            </div>
          </div>
          {sales.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: 13, background: '#fff', border: '1px dashed var(--line)', borderRadius: 12 }}>
              No sales recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...sales].reverse().map((s) => (
                <button key={s.id} onClick={() => setHistorySale(s)} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>#{String(s.number).padStart(4, '0')} · {s.items.reduce((n, i) => n + i.qty, 0)} item{s.items.length === 1 ? '' : 's'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatDateTime(s.timestamp)} · <span style={{ textTransform: 'capitalize' }}>{s.paymentMethod}</span>{s.cashierName ? ` · ${s.cashierName}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(s.total, settings.currency)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'team' && isManager ? <TeamTab settings={settings} currentUserId={session.user.id} /> : null}

      {showReceipt && lastSale ? <ReceiptModal sale={lastSale} settings={settings} onClose={closeReceipt} isNew /> : null}
      {historySale ? <ReceiptModal sale={historySale} settings={settings} onClose={() => setHistorySale(null)} isNew={false} /> : null}
      {productModal ? (
        <ProductModal
          initial={productModal.initial}
          existingBarcodes={products.filter((p) => p.barcode).map((p) => p.barcode)}
          onSave={saveProduct}
          onClose={() => setProductModal(null)}
        />
      ) : null}
      {showSettings ? (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
          session={session}
          profile={profile}
          onSignOut={signOut}
        />
      ) : null}
      {showCalculator ? (
        <CalculatorModal
          onClose={() => setShowCalculator(false)}
          onUseResult={(val) => { setAmountTendered(val); setShowCalculator(false); }}
          showUseResult={tab === 'checkout' && paymentMethod === 'cash' && cart.length > 0}
        />
      ) : null}
    </div>
  );
}

function QuickAddInline({ nameRef, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try { await onSubmit(name, price); } finally { setSaving(false); }
  };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input ref={nameRef} className="cpos-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" style={{ flex: 2, padding: '9px 10px', borderRadius: 8, fontSize: 13 }} />
      <input className="cpos-input" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" style={{ flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 13 }} />
      <button onClick={submit} disabled={saving} className="cpos-btn-primary" style={{ padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Add</button>
      <button onClick={onCancel} className="cpos-btn-ghost" style={{ padding: '0 10px', borderRadius: 8, fontSize: 13 }}>✕</button>
    </div>
  );
}
