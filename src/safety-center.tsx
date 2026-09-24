import { FormEvent, useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';

type SessionLike = {
  access_token: string;
  user: { id: string };
};

type ListingLike = {
  id: string;
  instructor_id: string;
  display_name: string;
};

type SafetyReport = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  listing_id: string | null;
  booking_id: string | null;
  category: string;
  description: string;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
  reporter?: { full_name?: string | null } | null;
  reported?: { full_name?: string | null } | null;
  listing?: { display_name?: string | null } | null;
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
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    throw new Error(data?.message || data?.error || String(data || response.statusText));
  }
  return data;
}

const categories = [
  ['inappropriate_content', 'Konten tidak pantas'],
  ['fraud_payment', 'Penipuan / pembayaran'],
  ['harassment', 'Pelecehan / perilaku'],
  ['identity', 'Identitas mencurigakan'],
  ['safety', 'Keselamatan'],
  ['spam', 'Spam'],
  ['other', 'Lainnya'],
] as const;

export function SafetyActions({
  session,
  listing,
  blocked,
  onBlockChanged,
}: {
  session: SessionLike;
  listing: ListingLike;
  blocked: boolean;
  onBlockChanged: (blocked: boolean) => void | Promise<void>;
}) {
  const [showReport, setShowReport] = useState(false);
  const [category, setCategory] = useState('safety');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!description.trim()) {
      setMessage('Tuliskan kronologi singkat agar laporan dapat ditinjau.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api('/rest/v1/safety_reports', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          reporter_id: session.user.id,
          reported_user_id: listing.instructor_id,
          listing_id: listing.id,
          category,
          description: description.trim(),
        }),
      }, session.access_token);
      setDescription('');
      setShowReport(false);
      setMessage('Laporan berhasil dikirim kepada Admin GuruLes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Laporan belum dapat dikirim.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!blocked && !window.confirm(
      'Blokir pengajar ini? Anda tidak akan dapat melakukan booking kepadanya sampai blokir dibuka.'
    )) return;

    setBusy(true);
    setMessage('');
    try {
      if (blocked) {
        await api(
          '/rest/v1/user_blocks?blocker_id=eq.' + encodeURIComponent(session.user.id) +
          '&blocked_user_id=eq.' + encodeURIComponent(listing.instructor_id),
          { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
          session.access_token
        );
      } else {
        await api('/rest/v1/user_blocks', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            blocker_id: session.user.id,
            blocked_user_id: listing.instructor_id,
          }),
        }, session.access_token);
      }
      await onBlockChanged(!blocked);
      setMessage(blocked ? 'Blokir dibuka.' : 'Pengajar diblokir.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pengaturan blokir belum dapat diproses.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="safety-actions">
      <button
        type="button"
        className="text-button safety-report-button"
        onClick={() => setShowReport(true)}
      >
        ⚑ Laporkan
      </button>
      <button
        type="button"
        className={'text-button ' + (blocked ? 'safety-unblock-button' : 'danger-text')}
        disabled={busy}
        onClick={() => void toggleBlock()}
      >
        {blocked ? 'Buka Blokir' : 'Blokir'}
      </button>

      {message && <small className="safety-message">{message}</small>}

      {showReport && (
        <div className="safety-modal-backdrop" onMouseDown={() => setShowReport(false)}>
          <div
            className="safety-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="safety-report-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Tutup"
              onClick={() => setShowReport(false)}
            >
              ×
            </button>
            <span className="eyebrow">Keamanan GuruLes</span>
            <h3 id="safety-report-title">Laporkan {listing.display_name}</h3>
            <p>Laporan hanya dapat dibaca oleh Admin dan digunakan untuk peninjauan keamanan/penyalahgunaan.</p>
            <form onSubmit={submitReport}>
              <label>
                Kategori
                <select value={category} onChange={event => setCategory(event.target.value)}>
                  {categories.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Kronologi
                <textarea
                  rows={5}
                  maxLength={2000}
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder="Jelaskan apa yang terjadi, kapan, dan informasi penting lainnya."
                />
              </label>
              {message && <div className="form-error">{message}</div>}
              <button className="button primary wide" disabled={busy}>
                {busy ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function BlockedUsersPanel({
  session,
  listings,
  onChanged,
}: {
  session: SessionLike;
  listings: ListingLike[];
  onChanged: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<Array<{ blocked_user_id: string; created_at: string }>>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const data = await api(
      '/rest/v1/user_blocks?blocker_id=eq.' + encodeURIComponent(session.user.id) +
      '&select=blocked_user_id,created_at&order=created_at.desc',
      {},
      session.access_token
    );
    setRows(data);
  }

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, [session.access_token, session.user.id]);

  const listingMap = useMemo(() => new Map(
    listings.map(item => [item.instructor_id, item.display_name])
  ), [listings]);

  async function unblock(userId: string) {
    try {
      await api(
        '/rest/v1/user_blocks?blocker_id=eq.' + encodeURIComponent(session.user.id) +
        '&blocked_user_id=eq.' + encodeURIComponent(userId),
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
        session.access_token
      );
      await load();
      await onChanged();
      setMessage('Blokir berhasil dibuka.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Blokir belum dapat dibuka.');
    }
  }

  return (
    <section className="blocked-users-panel">
      <div className="safety-panel-head">
        <div>
          <span className="eyebrow">Privasi & Keamanan</span>
          <h3>Pengguna Diblokir</h3>
        </div>
        <a href="/help.html" target="_blank" rel="noreferrer">Pusat Bantuan</a>
      </div>
      {rows.length === 0 ? (
        <div className="muted-note">Belum ada pengguna yang Anda blokir.</div>
      ) : (
        <div className="blocked-list">
          {rows.map(row => (
            <div key={row.blocked_user_id}>
              <strong>{listingMap.get(row.blocked_user_id) || 'Pengguna GuruLes'}</strong>
              <small>Diblokir {new Date(row.created_at).toLocaleDateString('id-ID')}</small>
              <button
                type="button"
                className="button secondary small"
                onClick={() => void unblock(row.blocked_user_id)}
              >
                Buka Blokir
              </button>
            </div>
          ))}
        </div>
      )}
      {message && <div className="form-success">{message}</div>}
    </section>
  );
}

export function AdminSafetyPanel({ session }: { session: SessionLike }) {
  const [rows, setRows] = useState<SafetyReport[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const select = [
      '*',
      'reporter:profiles!safety_reports_reporter_id_fkey(full_name)',
      'reported:profiles!safety_reports_reported_user_id_fkey(full_name)',
      'listing:instructor_listings!safety_reports_listing_id_fkey(display_name)',
    ].join(',');
    const data = await api(
      '/rest/v1/safety_reports?select=' + encodeURIComponent(select) + '&order=created_at.desc',
      {},
      session.access_token
    );
    setRows(data);
  }

  useEffect(() => {
    void load().catch(error => {
      setMessage(error instanceof Error ? error.message : 'Laporan keamanan belum dapat dimuat.');
    });
  }, [session.access_token]);

  async function updateStatus(row: SafetyReport, status: string) {
    try {
      await api('/rest/v1/safety_reports?id=eq.' + encodeURIComponent(row.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      }, session.access_token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Status laporan belum dapat diperbarui.');
    }
  }

  const openCount = rows.filter(row => ['open', 'reviewing'].includes(row.status)).length;

  return (
    <section className="admin-safety-panel">
      <div className="safety-panel-head">
        <div>
          <span className="eyebrow">Trust & Safety</span>
          <h3>Laporan Pengguna</h3>
          <p>Laporan baru dan kasus yang sedang ditinjau oleh Admin GuruLes.</p>
        </div>
        <div className="safety-head-actions">
          <span className={openCount ? 'pending-count' : 'verified'}>{openCount} aktif</span>
          <button className="button secondary small" onClick={() => void load()}>↻ Segarkan</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="status-box">Belum ada laporan pengguna.</div>
      ) : (
        <div className="safety-report-list">
          {rows.map(row => (
            <article key={row.id}>
              <div>
                <strong>{row.listing?.display_name || row.reported?.full_name || 'Pengguna GuruLes'}</strong>
                <span>{categories.find(([value]) => value === row.category)?.[1] || row.category}</span>
                <small>
                  Pelapor: {row.reporter?.full_name || 'Pengguna'} · {new Date(row.created_at).toLocaleString('id-ID')}
                </small>
                <p>{row.description}</p>
              </div>
              <div className="safety-admin-actions">
                <span className={'status-pill ' + row.status}>{row.status}</span>
                {row.status !== 'reviewing' && (
                  <button className="text-button" onClick={() => void updateStatus(row, 'reviewing')}>Tinjau</button>
                )}
                {row.status !== 'resolved' && (
                  <button className="text-button" onClick={() => void updateStatus(row, 'resolved')}>Selesaikan</button>
                )}
                {row.status !== 'dismissed' && (
                  <button className="text-button danger-text" onClick={() => void updateStatus(row, 'dismissed')}>Tutup</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {message && <div className="form-error">{message}</div>}
    </section>
  );
}


export function LegalAcceptanceGate({ session }: { session: SessionLike }) {
  const [required, setRequired] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');

  async function checkAcceptance() {
    try {
      const rows = await api(
        '/rest/v1/user_legal_acceptances?user_id=eq.' +
          encodeURIComponent(session.user.id) +
          '&policy_version=eq.2026-09-24&policy_key=in.(terms,privacy)&select=policy_key',
        {},
        session.access_token
      ) as Array<{ policy_key: string }>;
      const keys = new Set(rows.map(row => row.policy_key));
      setRequired(!(keys.has('terms') && keys.has('privacy')));
    } catch {
      setRequired(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void checkAcceptance();
  }, [session.access_token, session.user.id]);

  async function accept() {
    if (!checked) {
      setMessage('Centang persetujuan untuk melanjutkan.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const url =
        '/rest/v1/user_legal_acceptances?on_conflict=' +
        encodeURIComponent('user_id,policy_key,policy_version');
      await api(url, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([
          {
            user_id: session.user.id,
            policy_key: 'terms',
            policy_version: '2026-09-24',
            source: 'app',
          },
          {
            user_id: session.user.id,
            policy_key: 'privacy',
            policy_version: '2026-09-24',
            source: 'app',
          },
        ]),
      }, session.access_token);
      setRequired(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Persetujuan belum dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  if (busy && !required) return null;
  if (!required) return null;

  return (
    <div className="legal-gate-backdrop">
      <section className="legal-gate" role="dialog" aria-modal="true" aria-labelledby="legal-gate-title">
        <span className="eyebrow">GuruLes Public Beta</span>
        <h2 id="legal-gate-title">Persetujuan ketentuan terbaru</h2>
        <p>
          Sebelum melanjutkan, baca ketentuan penggunaan dan kebijakan privasi GuruLes.
        </p>
        <div className="legal-gate-links">
          <a href="/terms.html" target="_blank" rel="noreferrer">Syarat & Ketentuan</a>
          <a href="/privacy.html" target="_blank" rel="noreferrer">Kebijakan Privasi</a>
          <a href="/transaction-policy.html" target="_blank" rel="noreferrer">Kebijakan Transaksi</a>
        </div>
        <label className="legal-consent">
          <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />
          <span>Saya telah membaca dan menyetujui Syarat & Ketentuan serta Kebijakan Privasi GuruLes.</span>
        </label>
        {message && <div className="form-error">{message}</div>}
        <button className="button primary wide" disabled={busy} onClick={() => void accept()}>
          {busy ? 'Menyimpan...' : 'Setuju & Lanjutkan'}
        </button>
      </section>
    </div>
  );
}
