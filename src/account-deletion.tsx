import { FormEvent, useEffect, useState } from 'react';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';

async function requestApi(path: string, options: RequestInit = {}, token?: string) {
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
    throw new Error(data?.error || data?.message || String(data || response.statusText));
  }
  return data;
}

type DeletionRequest = {
  id: string;
  user_id: string | null;
  phone: string | null;
  full_name: string | null;
  source: 'in_app' | 'web';
  reason: string;
  status: string;
  requested_at: string;
  verified_at: string | null;
  processed_at: string | null;
  admin_note: string;
};

export function AccountDeletionPanel({
  accessToken,
  fullName,
}: {
  accessToken: string;
  fullName: string;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState<DeletionRequest | null>(null);

  useEffect(() => {
    void requestApi(
      '/rest/v1/account_deletion_requests?select=*&order=requested_at.desc&limit=1',
      {},
      accessToken
    )
      .then((rows: DeletionRequest[]) => setCurrent(rows[0] || null))
      .catch(() => undefined);
  }, [accessToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (confirmText.trim().toUpperCase() !== 'HAPUS') {
      setMessage('Ketik HAPUS untuk mengonfirmasi permintaan.');
      return;
    }

    setBusy(true);
    try {
      const result = await requestApi(
        '/functions/v1/request-account-deletion',
        {
          method: 'POST',
          body: JSON.stringify({ reason: reason.trim() }),
        },
        accessToken
      );
      setMessage(result.message || 'Permintaan penghapusan akun berhasil dikirim.');
      setCurrent({
        id: current?.id || 'pending',
        user_id: null,
        phone: null,
        full_name: fullName,
        source: 'in_app',
        reason,
        status: current?.status === 'processing' ? 'processing' : 'verified',
        requested_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        processed_at: null,
        admin_note: '',
      });
      setConfirmText('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Permintaan belum dapat dikirim.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-deletion-panel">
      <div className="account-deletion-head">
        <div>
          <span className="eyebrow">Privasi & Akun</span>
          <h3>Penghapusan akun GuruLes</h3>
          <p>
            Anda dapat meminta akun dan data pribadi terkait dihapus. Transaksi yang wajib
            disimpan untuk keperluan hukum, akuntansi, keamanan, atau penyelesaian sengketa
            dapat dipertahankan dalam bentuk yang dibatasi atau dianonimkan.
          </p>
        </div>
        {current && (
          <span className={'status-pill ' + current.status}>
            {current.status === 'verified'
              ? 'Terverifikasi'
              : current.status === 'pending_verification'
                ? 'Menunggu verifikasi'
                : current.status}
          </span>
        )}
      </div>

      {current && ['pending_verification', 'verified', 'processing'].includes(current.status) ? (
        <div className="status-box">
          Permintaan penghapusan akun sudah tercatat pada{' '}
          {new Date(current.requested_at).toLocaleString('id-ID')}. Admin akan memproses
          permintaan setelah memastikan tidak ada transaksi aktif atau kewajiban yang belum selesai.
        </div>
      ) : (
        <form onSubmit={submit} className="account-deletion-form">
          <label>
            Alasan (opsional)
            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="Contoh: Saya tidak lagi menggunakan GuruLes."
            />
          </label>
          <label>
            Ketik <strong>HAPUS</strong> untuk konfirmasi
            <input
              value={confirmText}
              onChange={event => setConfirmText(event.target.value)}
              placeholder="HAPUS"
              autoComplete="off"
            />
          </label>
          <div className="account-deletion-actions">
            <button
              className="button danger"
              type="submit"
              disabled={busy || confirmText.trim().toUpperCase() !== 'HAPUS'}
            >
              {busy ? 'Mengirim...' : 'Minta Hapus Akun'}
            </button>
            <a href="/delete-account.html" target="_blank" rel="noreferrer">
              Lihat jalur penghapusan akun di web
            </a>
          </div>
        </form>
      )}
      {message && <div className="form-success">{message}</div>}
    </section>
  );
}

export function DeletionRequestsAdminPanel({ accessToken }: { accessToken: string }) {
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const data = await requestApi(
      '/rest/v1/account_deletion_requests?select=*&order=requested_at.desc',
      {},
      accessToken
    );
    setRows(data as DeletionRequest[]);
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, [accessToken]);

  async function updateStatus(id: string, status: 'processing' | 'rejected') {
    setBusyId(id);
    setMessage('');
    try {
      await requestApi(
        '/rest/v1/account_deletion_requests?id=eq.' + encodeURIComponent(id),
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status,
            processed_at: status === 'rejected' ? new Date().toISOString() : null,
          }),
        },
        accessToken
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Status belum dapat diperbarui.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="account-deletion-panel">
      <div className="account-deletion-head">
        <div>
          <span className="eyebrow">Privasi Pengguna</span>
          <h3>Permintaan penghapusan akun</h3>
          <p>Verifikasi identitas dan selesaikan transaksi aktif sebelum penghapusan final.</p>
        </div>
        <button className="button secondary small" onClick={() => void load()}>
          Segarkan
        </button>
      </div>

      <div className="admin-growth-summary">
        <div><strong>{rows.length}</strong><span>Total permintaan</span></div>
        <div><strong>{rows.filter(row => row.status === 'verified').length}</strong><span>Terverifikasi</span></div>
        <div><strong>{rows.filter(row => row.status === 'processing').length}</strong><span>Diproses</span></div>
        <div><strong>{rows.filter(row => row.status === 'pending_verification').length}</strong><span>Perlu verifikasi</span></div>
      </div>

      {rows.length === 0 ? (
        <div className="status-box">Belum ada permintaan penghapusan akun.</div>
      ) : (
        <div className="deletion-request-list">
          {rows.map(row => (
            <div className="deletion-request-row" key={row.id}>
              <div>
                <strong>{row.full_name || 'Pemilik akun GuruLes'}</strong>
                <span>{row.phone || 'Nomor akun tersedia setelah verifikasi'} · {row.source === 'in_app' ? 'Dari aplikasi' : 'Dari web'}</span>
                <small>{new Date(row.requested_at).toLocaleString('id-ID')}</small>
                {row.reason && <p>{row.reason}</p>}
              </div>
              <div className="deletion-request-actions">
                <span className={'status-pill ' + row.status}>{row.status}</span>
                {!['fulfilled', 'rejected'].includes(row.status) && (
                  <button
                    className="button secondary small"
                    disabled={busyId === row.id}
                    onClick={() => void updateStatus(row.id, 'processing')}
                  >
                    Tandai Diproses
                  </button>
                )}
                {!['fulfilled', 'rejected'].includes(row.status) && (
                  <button
                    className="button secondary small"
                    disabled={busyId === row.id}
                    onClick={() => void updateStatus(row.id, 'rejected')}
                  >
                    Tolak
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {message && <div className="form-error">{message}</div>}
    </section>
  );
}
