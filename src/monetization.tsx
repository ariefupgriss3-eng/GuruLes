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
  instructor_id?: string | null;
  listing_id?: string | null;
  amount: number;
  status: 'lead' | 'pending' | 'paid' | 'active' | 'completed' | 'cancelled';
  starts_at: string | null;
  ends_at: string | null;
  payment_reference: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  admin_note?: string;
  notes: string;
  created_at: string;
};

type MonetizationSettings = {
  lynk_url?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
};

type InstructorListingStatus = {
  id: string;
  premium_plan?: string;
  premium_until?: string | null;
  boost_until?: string | null;
  featured_until?: string | null;
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


export function InstructorMonetizationShop({
  session,
  listing,
  onChanged,
}: {
  session: SessionLike;
  listing: InstructorListingStatus;
  onChanged?: () => void | Promise<void>;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<MonetizationSettings>({});
  const [referenceByOrder, setReferenceByOrder] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    const [productRows, orderRows, paymentSettings] = await Promise.all([
      api(
        '/rest/v1/monetization_products?audience=eq.instructor&is_active=eq.true' +
        '&select=id,code,name,audience,product_type,description,price,duration_days,placement,badge,is_active,sort_order' +
        '&order=sort_order.asc',
        {},
        session.access_token
      ),
      api(
        '/rest/v1/monetization_orders?instructor_id=eq.' +
        encodeURIComponent(session.user.id) +
        '&select=id,product_id,customer_type,customer_name,instructor_id,listing_id,amount,status,starts_at,ends_at,payment_reference,submitted_at,verified_at,admin_note,notes,created_at' +
        '&order=created_at.desc',
        {},
        session.access_token
      ),
      api('/functions/v1/gurules-payment-settings', { method: 'GET' }, session.access_token),
    ]);
    setProducts(productRows as Product[]);
    setOrders(orderRows as Order[]);
    setSettings(paymentSettings as MonetizationSettings);
  }

  useEffect(() => {
    void load().catch(error =>
      setMessage(error instanceof Error ? error.message : 'Paket promosi belum dapat dimuat.')
    );
  }, [session.access_token]);

  const pendingFor = (productId: string) =>
    orders.find(
      row =>
        row.product_id === productId &&
        ['lead', 'pending', 'paid'].includes(row.status)
    );

  async function choose(product: Product) {
    setBusyId(product.id);
    setMessage('');
    try {
      const orderId = (await api(
        '/rest/v1/rpc/create_instructor_monetization_order',
        {
          method: 'POST',
          body: JSON.stringify({
            p_product_id: product.id,
            p_payment_reference: null,
          }),
        },
        session.access_token
      )) as string;
      await load();
      setMessage(
        'Order ' + product.name +
        ' dibuat. Lakukan pembayaran lalu masukkan nomor invoice/referensi pembayaran.'
      );
      if (settings.lynk_url) {
        window.open(settings.lynk_url, '_blank', 'noopener,noreferrer');
      }
      setReferenceByOrder(current => ({ ...current, [orderId]: '' }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Order belum dapat dibuat.');
    } finally {
      setBusyId('');
    }
  }

  async function submitReference(order: Order) {
    const reference = (referenceByOrder[order.id] ?? order.payment_reference ?? '').trim();
    if (!reference) {
      setMessage('Masukkan nomor invoice atau referensi pembayaran terlebih dahulu.');
      return;
    }
    setBusyId(order.id);
    setMessage('');
    try {
      await api(
        '/rest/v1/rpc/submit_instructor_monetization_payment',
        {
          method: 'POST',
          body: JSON.stringify({
            p_order_id: order.id,
            p_payment_reference: reference,
          }),
        },
        session.access_token
      );
      await load();
      setMessage('Bukti referensi terkirim. Admin akan memverifikasi dan paket aktif otomatis setelah disetujui.');
      await onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Referensi pembayaran belum dapat dikirim.');
    } finally {
      setBusyId('');
    }
  }

  function activeLabel(product: Product) {
    const value =
      product.product_type === 'boost'
        ? listing.boost_until
        : product.product_type === 'featured'
          ? listing.featured_until
          : product.product_type === 'premium'
            ? listing.premium_until
            : null;
    return value && new Date(value) > new Date()
      ? 'Aktif s.d. ' + new Date(value).toLocaleDateString('id-ID')
      : '';
  }

  return (
    <section className="instructor-monetization-shop">
      <div className="growth-panel-head">
        <div>
          <span className="eyebrow">Promosikan Profil</span>
          <h3>Boost, Featured & GuruLes Pro</h3>
          <p>
            Pembayaran les tetap langsung ke pengajar. Paket ini hanya untuk promosi
            profil dan visibilitas di GuruLes.
          </p>
        </div>
        <span className="beta-price-chip">Self-service</span>
      </div>

      <div className="instructor-shop-grid">
        {products.map(product => {
          const pending = pendingFor(product.id);
          const active = activeLabel(product);
          return (
            <article className="instructor-shop-card" key={product.id}>
              {product.badge && <span className="rate-badge">{product.badge}</span>}
              <div className="rate-icon">{productIcon(product.product_type)}</div>
              <strong>{product.name}</strong>
              <p>{product.description}</p>
              <div className="rate-price">{rupiah(product.price)}</div>
              <small>{product.duration_days} hari · {placementLabel(product.placement)}</small>
              {active && <span className="shop-active">✓ {active}</span>}
              {pending ? (
                <span className="shop-pending">⏳ Menunggu verifikasi</span>
              ) : (
                <button
                  className="button primary"
                  disabled={busyId === product.id}
                  onClick={() => void choose(product)}
                >
                  {busyId === product.id ? 'Memproses...' : active ? 'Perpanjang Paket' : 'Pilih Paket'}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {orders.some(row => ['lead', 'pending', 'paid'].includes(row.status)) && (
        <div className="self-service-payment">
          <div>
            <span className="eyebrow">Pembayaran Promosi GuruLes</span>
            <h4>Bayar lalu kirim referensi</h4>
            <p>
              Pembayaran ini untuk paket promosi GuruLes, bukan pembayaran les.
            </p>
          </div>

          {settings.lynk_url && (
            <a
              className="button primary"
              href={settings.lynk_url}
              target="_blank"
              rel="noreferrer"
            >
              Bayar via Lynk.id
            </a>
          )}

          {!settings.lynk_url && settings.bank_account_number && (
            <div className="monetization-bank">
              <strong>{settings.bank_name || 'Transfer Bank'}</strong>
              <span>{settings.bank_account_number}</span>
              <small>a.n. {settings.bank_account_name}</small>
            </div>
          )}

          <div className="self-service-order-list">
            {orders
              .filter(row => ['lead', 'pending', 'paid'].includes(row.status))
              .map(order => {
                const product = products.find(item => item.id === order.product_id);
                return (
                  <div className="self-service-order" key={order.id}>
                    <div>
                      <strong>{product?.name || 'Paket Promosi'}</strong>
                      <span>{rupiah(order.amount)}</span>
                      <small>
                        Order {order.id.slice(0, 8).toUpperCase()}
                        {order.submitted_at ? ' · referensi sudah dikirim' : ''}
                      </small>
                    </div>
                    <div className="self-service-reference">
                      <input
                        value={referenceByOrder[order.id] ?? order.payment_reference ?? ''}
                        onChange={event =>
                          setReferenceByOrder(current => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                        placeholder="Nomor invoice / referensi pembayaran"
                        maxLength={160}
                      />
                      <button
                        className="button secondary"
                        disabled={busyId === order.id}
                        onClick={() => void submitReference(order)}
                      >
                        {busyId === order.id ? 'Mengirim...' : 'Kirim Referensi'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {orders.some(row => ['active', 'completed', 'cancelled'].includes(row.status)) && (
        <details className="monetization-history">
          <summary>Riwayat pembelian promosi</summary>
          <div>
            {orders
              .filter(row => ['active', 'completed', 'cancelled'].includes(row.status))
              .slice(0, 10)
              .map(order => {
                const product = products.find(item => item.id === order.product_id);
                return (
                  <p key={order.id}>
                    <strong>{product?.name || 'Paket'}</strong> · {rupiah(order.amount)} · {order.status}
                    {order.ends_at ? ' · s.d. ' + new Date(order.ends_at).toLocaleDateString('id-ID') : ''}
                  </p>
                );
              })}
          </div>
        </details>
      )}

      {message && <div className="form-success">{message}</div>}
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
        'select=id,product_id,customer_type,customer_name,instructor_id,listing_id,amount,status,starts_at,ends_at,payment_reference,submitted_at,verified_at,admin_note,notes,created_at' +
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

  async function verifyInstructorOrder(row: Order, approve: boolean) {
    const note = approve
      ? 'Pembayaran promosi diverifikasi Admin.'
      : (window.prompt('Alasan penolakan / catatan Admin:', 'Referensi pembayaran belum dapat diverifikasi.') || '');
    if (!approve && !note.trim()) return;

    setMessage('');
    try {
      const result = await api(
        '/rest/v1/rpc/verify_monetization_order',
        {
          method: 'POST',
          body: JSON.stringify({
            p_order_id: row.id,
            p_approve: approve,
            p_admin_note: note,
          }),
        },
        session.access_token
      ) as { active_until?: string; status?: string };

      await load();
      setMessage(
        approve
          ? 'Pembayaran terverifikasi. Benefit pengajar aktif otomatis' +
            (result.active_until
              ? ' sampai ' + new Date(result.active_until).toLocaleDateString('id-ID') + '.'
              : '.')
          : 'Order ditolak.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verifikasi order belum berhasil.');
    }
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
            <h4>Catat penjualan sponsor manual</h4>
          </div>
        </div>

        <label>
          Paket
          <select value={productId} onChange={event => setProductId(event.target.value)}>
            <option value="">Pilih paket</option>
            {products.filter(row => row.is_active && row.audience === 'sponsor').map(row => (
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
                {row.customer_type === 'instructor' && ['pending', 'paid'].includes(row.status) ? (
                  <div className="verify-order-actions">
                    <small>{row.payment_reference ? 'Ref: ' + row.payment_reference : 'Belum ada referensi'}</small>
                    <button
                      className="button primary small"
                      disabled={!row.payment_reference}
                      onClick={() => void verifyInstructorOrder(row, true)}
                    >
                      ✓ Verifikasi & Aktifkan
                    </button>
                    <button
                      className="button secondary small"
                      onClick={() => void verifyInstructorOrder(row, false)}
                    >
                      Tolak
                    </button>
                  </div>
                ) : (
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
                )}
              </article>
            );
          })
        )}
      </div>

      {message && <div className="form-success">{message}</div>}
    </section>
  );
}
