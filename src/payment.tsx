import { useEffect, useState } from 'react';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';

export type PaymentSession = {
  access_token: string;
  user: { id: string };
};

export type PaymentBooking = {
  id: string;
  status: string;
  buyer_confirmed_complete: boolean;
  instructor_confirmed_complete: boolean;
  package_sessions_total?: number;
};

type Payment = {
  booking_id: string;
  payment_status: string;
  payout_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  submitted_at: string | null;
  verification_note: string | null;
  payout_reference: string | null;
};

type Settings = {
  platform_fee_percent: number;
  payment_method_label: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  lynk_url: string;
  payment_instructions: string;
  payout_instructions: string;
  launch_mode: boolean;
  launch_title: string;
  launch_message: string;
  future_fee_percent: number;
  founding_teacher_limit: number;
  premium_enabled: boolean;
  boost_enabled: boolean;
  payment_automation_mode: string;
};

const defaultSettings: Settings = {
  platform_fee_percent: 0,
  payment_method_label: 'Lynk.id / QRIS',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  lynk_url: '',
  payment_instructions:
    'Pembayaran dilakukan setelah pengajar menerima pesanan.',
  payout_instructions:
    'Hak pengajar dicairkan setelah sesi selesai dan transaksi dikonfirmasi.',
  launch_mode: true,
  launch_title: 'GuruLes Launching Program',
  launch_message:
    '0% biaya platform. Pengajar menerima 100% tarif sesi selama masa peluncuran.',
  future_fee_percent: 10,
  founding_teacher_limit: 1000,
  premium_enabled: false,
  boost_enabled: true,
  payment_automation_mode: 'manual',
};

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers || {});
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);

  const response = await fetch(SUPABASE_URL + path, { ...options, headers });
  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error_description || data?.error || String(data || response.statusText)
    );
  }
  return data;
}

export async function getPlatformFeePercent() {
  const data = (await api('/functions/v1/gurules-payment-settings', {
    method: 'GET',
  })) as Partial<Settings>;
  const fee = Number(data.platform_fee_percent);
  return Number.isFinite(fee) ? fee : 0;
}

export function AdminPaymentSettings({
  session,
  onFeeChanged,
}: {
  session: PaymentSession;
  onFeeChanged?: (fee: number) => void;
}) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void api(
      '/functions/v1/gurules-payment-settings',
      { method: 'GET' },
      session.access_token
    )
      .then(data => {
        setSettings(current => ({ ...current, ...(data as Partial<Settings>) }));
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Pengaturan gagal dimuat.'));
  }, [session.access_token]);

  async function save() {
    setMessage('');
    const fee = Number(settings.platform_fee_percent);
    if (!Number.isInteger(fee) || fee < 0 || fee > 30) {
      setMessage('Fee GuruLes harus 0 sampai 30 persen.');
      return;
    }

    setBusy(true);
    try {
      const result = (await api(
        '/functions/v1/gurules-payment-settings',
        {
          method: 'POST',
          body: JSON.stringify(settings),
        },
        session.access_token
      )) as { settings: Settings; message?: string };
      setSettings(result.settings);
      onFeeChanged?.(result.settings.platform_fee_percent);
      setMessage(result.message || 'Pengaturan pembayaran berhasil disimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pengaturan belum dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-report-head">
        <div>
          <span className="eyebrow">Model Bisnis & Pembayaran</span>
          <h3>Launching, fee, pertumbuhan & pembayaran</h3>
        </div>
        <span className="verified">
          {settings.launch_mode ? '🎉 Launch 0%' : 'Fee ' + settings.platform_fee_percent + '%'}
        </span>
      </div>

      <div className="launch-admin-box">
        <label className="toggle-setting">
          <input
            type="checkbox"
            checked={settings.launch_mode}
            onChange={event =>
              setSettings(current => ({
                ...current,
                launch_mode: event.target.checked,
                platform_fee_percent: event.target.checked
                  ? 0
                  : current.platform_fee_percent,
              }))
            }
          />
          <span>
            <strong>Masa Peluncuran Gratis</strong>
            <small>Jika aktif, fee transaksi dipaksa 0%.</small>
          </span>
        </label>

        <div className="branding-form-grid">
          <label>
            Judul program
            <input
              value={settings.launch_title}
              onChange={event =>
                setSettings(current => ({ ...current, launch_title: event.target.value }))
              }
            />
          </label>
          <label>
            Rencana fee setelah launch (%)
            <input
              type="number"
              min="0"
              max="30"
              value={settings.future_fee_percent}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  future_fee_percent: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Batas Pengajar Perintis
            <input
              type="number"
              min="1"
              max="100000"
              value={settings.founding_teacher_limit}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  founding_teacher_limit: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="brand-tagline-field">
            Pesan program
            <textarea
              rows={2}
              value={settings.launch_message}
              onChange={event =>
                setSettings(current => ({ ...current, launch_message: event.target.value }))
              }
            />
          </label>
        </div>

        <div className="growth-switches">
          <label>
            <input
              type="checkbox"
              checked={settings.boost_enabled}
              onChange={event =>
                setSettings(current => ({ ...current, boost_enabled: event.target.checked }))
              }
            />
            Boost referral aktif
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.premium_enabled}
              onChange={event =>
                setSettings(current => ({ ...current, premium_enabled: event.target.checked }))
              }
            />
            Premium berbayar aktif
          </label>
        </div>
        <div className="automation-note">
          Pembayaran saat ini: <strong>manual via Lynk.id/QRIS</strong>.
          Mode otomatis baru diaktifkan setelah payment gateway/webhook tersedia.
        </div>
      </div>

      <div className="branding-form-grid">
        <label>
          Fee GuruLes (%)
          <input
            type="number"
            min="0"
            max="30"
            step="1"
            value={settings.platform_fee_percent}
            disabled={settings.launch_mode}
            onChange={event =>
              setSettings(current => ({
                ...current,
                platform_fee_percent: Number(event.target.value),
              }))
            }
          />
        </label>

        <label>
          Metode pembayaran
          <input
            value={settings.payment_method_label}
            onChange={event =>
              setSettings(current => ({
                ...current,
                payment_method_label: event.target.value,
              }))
            }
            placeholder="Lynk.id / QRIS"
          />
        </label>

        <label>
          Nama bank
          <input
            value={settings.bank_name}
            onChange={event =>
              setSettings(current => ({ ...current, bank_name: event.target.value }))
            }
            placeholder="Contoh: BRI"
          />
        </label>

        <label>
          Nomor rekening
          <input
            value={settings.bank_account_number}
            onChange={event =>
              setSettings(current => ({
                ...current,
                bank_account_number: event.target.value,
              }))
            }
            placeholder="Nomor rekening"
          />
        </label>

        <label>
          Nama pemilik rekening
          <input
            value={settings.bank_account_name}
            onChange={event =>
              setSettings(current => ({
                ...current,
                bank_account_name: event.target.value,
              }))
            }
            placeholder="Nama pemilik rekening"
          />
        </label>

        <label>
          Link Pembayaran Lynk.id
          <input
            value={settings.lynk_url}
            onChange={event =>
              setSettings(current => ({ ...current, lynk_url: event.target.value }))
            }
            placeholder="https://lynk.id/..."
          />
          <small>Tempel link checkout / support Lynk.id yang menerima QRIS.</small>
        </label>

        <label className="brand-tagline-field">
          Petunjuk pembayaran
          <textarea
            rows={3}
            value={settings.payment_instructions}
            onChange={event =>
              setSettings(current => ({
                ...current,
                payment_instructions: event.target.value,
              }))
            }
          />
        </label>

        <label className="brand-tagline-field">
          Petunjuk pencairan
          <textarea
            rows={3}
            value={settings.payout_instructions}
            onChange={event =>
              setSettings(current => ({
                ...current,
                payout_instructions: event.target.value,
              }))
            }
          />
        </label>
      </div>

      {message && <div className="form-success">{message}</div>}

      <div className="branding-actions">
        <button className="button primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Menyimpan...' : 'Simpan Pengaturan Pembayaran'}
        </button>
      </div>
    </div>
  );
}

export function BookingTransactionControls({
  session,
  booking,
  role,
  isAdmin = false,
  onChanged,
}: {
  session: PaymentSession;
  booking: PaymentBooking;
  role: 'parent' | 'student' | 'instructor' | 'admin';
  isAdmin?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refreshPayment() {
    try {
      const rows = (await api(
        '/rest/v1/payments?booking_id=eq.' +
          encodeURIComponent(booking.id) +
          '&select=booking_id,payment_status,payout_status,payment_method,payment_reference,submitted_at,verification_note,payout_reference&limit=1',
        {},
        session.access_token
      )) as Payment[];
      setPayment(rows[0] || null);
    } catch {
      setPayment(null);
    }
  }

  useEffect(() => {
    void refreshPayment();
    void api(
      '/functions/v1/gurules-payment-settings',
      { method: 'GET' },
      session.access_token
    )
      .then(data => {
        setSettings(current => ({ ...current, ...(data as Partial<Settings>) }));
      })
      .catch(() => undefined);
  }, [booking.id, session.access_token]);

  async function action(name: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage('');
    try {
      const result = (await api(
        '/functions/v1/booking-transaction-action',
        {
          method: 'POST',
          body: JSON.stringify({
            booking_id: booking.id,
            action: name,
            ...extra,
          }),
        },
        session.access_token
      )) as { message?: string };
      setMessage(result.message || 'Transaksi berhasil diperbarui.');
      await refreshPayment();
      await onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transaksi belum dapat diproses.');
    } finally {
      setBusy(false);
    }
  }

  const buyer = role === 'parent' || role === 'student';
  const instructor = role === 'instructor';

  return (
    <div className="transaction-box">
      {payment && (
        <div className="transaction-status-row">
          <span>Pembayaran: <strong>{payment.payment_status}</strong></span>
          <span>Pencairan: <strong>{payment.payout_status}</strong></span>
        </div>
      )}

      {instructor && booking.status === 'requested' && (
        <div className="transaction-actions">
          <button
            className="button primary small"
            disabled={busy}
            onClick={() => void action('accept')}
          >
            Terima Booking
          </button>
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() => void action('reject')}
          >
            Tolak
          </button>
        </div>
      )}

      {buyer && booking.status === 'accepted' && payment?.payment_status !== 'paid' && (
        <div className="payment-confirm-box">
          <strong>{settings.payment_method_label}</strong>
          <small>{settings.payment_instructions}</small>

          {(settings.bank_name || settings.bank_account_number) && (
            <div className="payment-account">
              <strong>
                {settings.bank_name} {settings.bank_account_number}
              </strong>
              {settings.bank_account_name && (
                <span>a.n. {settings.bank_account_name}</span>
              )}
            </div>
          )}

          {settings.lynk_url ? (
            <a
              className="button primary small"
              href={settings.lynk_url}
              target="_blank"
              rel="noreferrer"
            >
              Bayar via Lynk.id
            </a>
          ) : (
            <small>Link pembayaran Lynk.id belum diatur Admin.</small>
          )}

          {payment?.verification_note && (
            <span className="form-error">{payment.verification_note}</span>
          )}

          {payment?.submitted_at && payment.payment_status === 'pending' ? (
            <span>Menunggu verifikasi Admin.</span>
          ) : (
            <>
              <input
                value={reference}
                onChange={event => setReference(event.target.value)}
                placeholder="Referensi / nomor transaksi"
              />
              <button
                className="button primary small"
                disabled={busy}
                onClick={() =>
                  void action('submit_payment', {
                    payment_method: settings.payment_method_label,
                    payment_reference: reference.trim(),
                  })
                }
              >
                Saya Sudah Bayar
              </button>
            </>
          )}
        </div>
      )}

      {isAdmin &&
        booking.status === 'accepted' &&
        payment?.submitted_at &&
        payment.payment_status === 'pending' && (
          <div className="transaction-actions">
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => void action('verify_payment')}
            >
              Verifikasi Pembayaran
            </button>
            <button
              className="button secondary small"
              disabled={busy}
              onClick={() => {
                const note = window.prompt(
                  'Alasan penolakan pembayaran:',
                  'Bukti/referensi pembayaran belum sesuai.'
                );
                if (note !== null) {
                  void action('reject_payment', { verification_note: note });
                }
              }}
            >
              Tolak Pembayaran
            </button>
          </div>
        )}

      {Number(booking.package_sessions_total || 1) === 1 &&
        ['paid', 'in_progress'].includes(booking.status) &&
        ((instructor && !booking.instructor_confirmed_complete) ||
          (buyer && !booking.buyer_confirmed_complete)) && (
          <button
            className="button primary small"
            disabled={busy}
            onClick={() => void action('confirm_complete')}
          >
            Konfirmasi Selesai
          </button>
        )}

      {isAdmin &&
        booking.status === 'completed' &&
        payment?.payout_status === 'eligible' && (
          <button
            className="button primary small"
            disabled={busy}
            onClick={() => {
              const payoutReference = window.prompt(
                'Masukkan referensi pencairan ke pengajar:'
              );
              if (payoutReference?.trim()) {
                void action('mark_payout', {
                  payout_reference: payoutReference.trim(),
                });
              }
            }}
          >
            Tandai Pencairan
          </button>
        )}

      {booking.status === 'completed' && !isAdmin && (
        <small>
          {payment?.payout_status === 'paid'
            ? 'Hak pengajar sudah dicairkan.'
            : settings.payout_instructions}
        </small>
      )}

      {message && <small className="transaction-message">{message}</small>}
    </div>
  );
}