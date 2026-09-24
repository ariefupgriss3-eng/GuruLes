import { FormEvent, useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';

type SessionLike = { access_token: string; user: { id: string } };

type Product = {
  id: string;
  code: string;
  name: string;
  audience: 'instructor' | 'sponsor';
  product_type: 'boost' | 'premium' | 'featured' | 'sponsor';
  description: string;
  price: number;
  duration_days: number;
  placement: 'home' | 'search' | 'category' | 'profile' | null;
  badge: string;
  is_active: boolean;
  sort_order: number;
};

type Order = {
  id: string;
  product_id: string;
  customer_type: 'instructor' | 'sponsor';
  customer_name: string;
  amount: number;
  status: 'lead' | 'pending' | 'paid' | 'active' | 'completed' | 'cancelled';
  starts_at: string | null;
  ends_at: string | null;
  payment_reference: string | null;
  notes: string;
  created_at: string;
};

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers || {});
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch(SUPABASE_URL + path, { ...options, headers });
  const raw = await response.text();
  let data: any = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }
  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error_description ||
      data?.error ||
      String(data || response.statusText)
    );
  }
  return data;
}

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function productIcon(type: Product['product_type']) {
  if (type === 'boost') return '🚀';
  if (type === 'premium') return '💎';
  if (type === 'featured') return '⭐';
  return '📣';
}

function placementLabel(value: Product['placement']) {
  if (value === 'home') return 'Beranda';
  if (value === 'search') return 'Pencarian';
  if (value === 'category') return 'Kategori';
  if (value === 'profile') return 'Profil';
  return 'GuruLes';
}

export function PublicRateCard() {
  const [rows, setRows] = useState<Product[]>([]);

  useEffect(() => {
    void api(
      '/rest/v1/monetization_products?is_active=eq.true' +
      '&select=id,code,name,audience,product_type,description,price,duration_days,placement,badge,is_active,sort_order' +
      '&order=sort_order.asc'
    ).then(data => setRows(data as Product[])).catch(() => setRows([]));
  }, []);

  if (rows.length === 0) return null;

  const instructor = rows.filter(row => row.audience === 'instructor');
  const sponsor = rows.filter(row => row.audience === 'sponsor');

  return (
    <section className="rate-card-public" id="promosi">
      <div className="rate-card-heading">
        <div>
          <span className="eyebrow">Promosi & Sponsor</span>
          <h2>Tumbuh bersama GuruLes</h2>
          <p>
            Booking tetap 0% komisi. Pengajar dan sponsor dapat memilih promosi
            berbayar secara opsional untuk menambah visibilitas.
          </p>
        </div>
        <span className="beta-price-chip">Harga Public Beta</span>
      </div>

      <div className="rate-card-group">
        <h3>Untuk Pengajar</h3>
        <div className="rate-card-grid">
          {instructor.map(row => (
            <article className="rate-card-item" key={row.id}>
              {row.badge && <span className="rate-badge">{row.badge}</span>}
              <div className="rate-icon">{productIcon(row.product_type)}</div>
              <strong>{row.name}</strong>
              <p>{row.description}</p>
              <div className="rate-price">{rupiah(row.price)}</div>
              <small>{row.duration_days} hari · {placementLabel(row.placement)}</small>
            </article>
          ))}
        </div>
      </div>

      <div className="rate-card-group sponsor-rate-group">
        <h3>Untuk Sponsor / Brand</h3>
        <div className="rate-card-grid">
          {sponsor.map(row => (
            <article className="rate-card-item" key={row.id}>
              {row.badge && <span className="rate-badge">{row.badge}</span>}
              <div className="rate-icon">{productIcon(row.product_type)}</div>
              <strong>{row.name}</strong>
              <p>{row.description}</p>
              <div className="rate-price">{rupiah(row.price)}</div>
              <small>{row.duration_days} hari · {placementLabel(row.placement)}</small>
            </article>
          ))}
        </div>
      </div>

      <div className="rate-card-footnote">
        Harga dapat berubah selama Public Beta. Penayangan sponsor tetap diberi
        label <strong>Disponsori</strong> dan tidak memengaruhi hasil review pengguna.
      </div>
    </section>
  );
}

export function AdminMonetizationPanel({ session }: { session: SessionLike }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productId, setProductId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<Order['status']>('lead');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [productRows, orderRows] = await Promise.all([
      api(
        '/rest/v1/monetization_products?' +
        'select=id,code,name,audience,product_type,description,price,duration_days,placement,badge,is_active,sort_order' +
        '&order=sort_order.asc',
        {},
        session.access_token
      ),
      api(
        '/rest/v1/monetization_orders?' +
        'select=id,product_id,customer_type,customer_name,amount,status,starts_at,ends_at,payment_reference,notes,created_at' +
        '&order=created_at.desc',
        {},
        session.access_token
      ),
    ]);
    setProducts(productRows as Product[]);
    setOrders(orderRows as Order[]);
  }

  useEffect(() => {
    void load().catch(error =>
      setMessage(error instanceof Error ? error.message : 'Data monetisasi belum dapat dimuat.')
    );
  }, [session.access_token]);

  const selectedProduct = products.find(row => row.id === productId) || null;

  useEffect(() => {
    if (selectedProduct) setAmount(selectedProduct.price);
  }, [productId, selectedProduct?.price]);

  const recognizedRevenue = useMemo(
    () => orders
      .filter(row => ['paid', 'active', 'completed'].includes(row.status))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [orders]
  );
  const pipeline = useMemo(
    () => orders
      .filter(row => ['lead', 'pending'].includes(row.status))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [orders]
  );
  const activeCount = orders.filter(row => row.status === 'active').length;

  async function saveProduct(row: Product, patch: Partial<Product>) {
    setMessage('');
    try {
      await api(
        '/rest/v1/monetization_products?id=eq.' + encodeURIComponent(row.id),
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
        },
        session.access_token
      );
      await load();
      setMessage('Rate Card berhasil diperbarui.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rate Card belum dapat diperbarui.');
    }
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!selectedProduct || !customerName.trim()) {
      setMessage('Pilih paket dan isi nama pelanggan/sponsor.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage('Nilai order tidak valid.');
      return;
    }

    const now = new Date();
    const end = new Date(now.getTime() + selectedProduct.duration_days * 86400000);
    const activeNow = status === 'active' || status === 'completed';

    setBusy(true);
    try {
      await api(
        '/rest/v1/monetization_orders',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            product_id: selectedProduct.id,
            customer_type: selectedProduct.audience,
            customer_name: customerName.trim(),
            amount: Math.round(amount),
            status,
            starts_at: activeNow ? now.toISOString() : null,
            ends_at: activeNow ? end.toISOString() : null,
            payment_reference: paymentReference.trim() || null,
            notes: notes.trim(),
            created_by: session.user.id,
          }),
        },
        session.access_token
      );
      setCustomerName('');
      setPaymentReference('');
      setNotes('');
      setStatus('lead');
      setAmount(selectedProduct.price);
      await load();
      setMessage('Order monetisasi berhasil dicatat.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Order belum dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function updateOrder(row: Order, nextStatus: Order['status']) {
    const product = products.find(item => item.id === row.product_id);
    const patch: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === 'active' && !row.starts_at) {
      const start = new Date();
      const days = Number(product?.duration_days || 0);
      patch.starts_at = start.toISOString();
      patch.ends_at = new Date(start.getTime() + days * 86400000).toISOString();
    }

    await api(
      '/rest/v1/monetization_orders?id=eq.' + encodeURIComponent(row.id),
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      },
      session.access_token
    );
    await load();
  }

  return (
    <section className="monetization-admin">
      <div className="admin-report-head">
        <div>
          <span className="eyebrow">Rate Card & Revenue</span>
          <h3>Mesin pendapatan GuruLes</h3>
          <p>
            Kelola harga promosi, order sponsor, status pembayaran, masa aktif,
            dan omzet tanpa memotong transaksi les.
          </p>
        </div>
      </div>

      <div className="monetization-summary">
        <div><small>Omzet tercatat</small><strong>{rupiah(recognizedRevenue)}</strong></div>
        <div><small>Pipeline</small><strong>{rupiah(pipeline)}</strong></div>
        <div><small>Order aktif</small><strong>{activeCount}</strong></div>
        <div><small>Total order</small><strong>{orders.length}</strong></div>
      </div>

      <div className="rate-admin-table">
        <div className="rate-admin-head">
          <div>
            <span className="eyebrow">Rate Card Public Beta</span>
            <h4>Harga dapat diedit kapan saja</h4>
          </div>
        </div>

        {products.map(row => (
          <div className="rate-admin-row" key={row.id}>
            <div className="rate-admin-product">
              <span>{productIcon(row.product_type)}</span>
              <div>
                <strong>{row.name}</strong>
                <small>{row.audience === 'instructor' ? 'Pengajar' : 'Sponsor'} · {row.duration_days} hari · {placementLabel(row.placement)}</small>
              </div>
            </div>
            <label>
              Harga
              <input
                type="number"
                min="0"
                step="1000"
                value={row.price}
                onChange={event => {
                  const value = Math.max(0, Number(event.target.value));
                  setProducts(current =>
                    current.map(item => item.id === row.id ? { ...item, price: value } : item)
                  );
                }}
              />
            </label>
            <button
              className="button secondary small"
              onClick={() => void saveProduct(row, { price: row.price })}
            >
              Simpan Harga
            </button>
            <button
              className={row.is_active ? 'button primary small' : 'button secondary small'}
              onClick={() => void saveProduct(row, { is_active: !row.is_active })}
            >
              {row.is_active ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>
        ))}
      </div>

      <form className="monetization-order-form" onSubmit={submitOrder}>
        <div className="rate-admin-head">
          <div>
            <span className="eyebrow">Order Baru</span>
            <h4>Catat penjualan promosi / sponsor</h4>
          </div>
        </div>

        <label>
          Paket
          <select value={productId} onChange={event => setProductId(event.target.value)}>
            <option value="">Pilih paket</option>
            {products.filter(row => row.is_active).map(row => (
              <option value={row.id} key={row.id}>
                {row.name} · {rupiah(row.price)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Pengajar / Sponsor
          <input
            value={customerName}
            onChange={event => setCustomerName(event.target.value)}
            placeholder="Nama pengajar, usaha, brand, atau sponsor"
            maxLength={160}
          />
        </label>

        <label>
          Nilai order
          <input
            type="number"
            min="0"
            step="1000"
            value={amount}
            onChange={event => setAmount(Number(event.target.value))}
          />
        </label>

        <label>
          Status
          <select value={status} onChange={event => setStatus(event.target.value as Order['status'])}>
            <option value="lead">Lead</option>
            <option value="pending">Menunggu Pembayaran</option>
            <option value="paid">Sudah Dibayar</option>
            <option value="active">Aktif</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Batal</option>
          </select>
        </label>

        <label>
          Referensi pembayaran
          <input
            value={paymentReference}
            onChange={event => setPaymentReference(event.target.value)}
            placeholder="Opsional"
            maxLength={160}
          />
        </label>

        <label className="wide">
          Catatan
          <textarea
            rows={2}
            value={notes}
            onChange={event => setNotes(event.target.value)}
            maxLength={1000}
          />
        </label>

        <button className="button primary" disabled={busy}>
          {busy ? 'Menyimpan...' : 'Catat Order'}
        </button>
      </form>

      <div className="monetization-orders">
        <div className="rate-admin-head">
          <div>
            <span className="eyebrow">Pipeline Penjualan</span>
            <h4>Order monetisasi</h4>
          </div>
          <button className="button secondary small" onClick={() => void load()}>
            Segarkan
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="status-box">Belum ada order monetisasi.</div>
        ) : (
          orders.map(row => {
            const product = products.find(item => item.id === row.product_id);
            return (
              <article className="monetization-order-row" key={row.id}>
                <div>
                  <small>{product?.name || 'Paket GuruLes'}</small>
                  <strong>{row.customer_name}</strong>
                  <span>{rupiah(row.amount)}</span>
                  <small>
                    {new Date(row.created_at).toLocaleDateString('id-ID')}
                    {row.ends_at
                      ? ' · aktif s.d. ' + new Date(row.ends_at).toLocaleDateString('id-ID')
                      : ''}
                  </small>
                </div>
                <select
                  value={row.status}
                  onChange={event =>
                    void updateOrder(row, event.target.value as Order['status'])
                  }
                >
                  <option value="lead">Lead</option>
                  <option value="pending">Menunggu Bayar</option>
                  <option value="paid">Sudah Dibayar</option>
                  <option value="active">Aktif</option>
                  <option value="completed">Selesai</option>
                  <option value="cancelled">Batal</option>
                </select>
              </article>
            );
          })
        )}
      </div>

      {message && <div className="form-success">{message}</div>}
    </section>
  );
}
