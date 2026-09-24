import { FormEvent, useEffect, useState } from 'react';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';

type SessionLike = { access_token: string; user: { id: string } };

type SponsorAd = {
  id: string;
  sponsor_name: string;
  title: string;
  body: string;
  image_url: string | null;
  target_url: string | null;
  placement: 'home' | 'search' | 'category' | 'profile';
  category: string;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
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
    throw new Error(data?.message || data?.error_description || data?.error || String(data || response.statusText));
  }
  return data;
}

function safeTarget(value: string | null) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function SponsorAdSlot({
  placement,
  enabled,
}: {
  placement: SponsorAd['placement'];
  enabled: boolean;
}) {
  const [rows, setRows] = useState<SponsorAd[]>([]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return;
    }
    void api(
      '/rest/v1/sponsor_ads?placement=eq.' + encodeURIComponent(placement) +
      '&select=id,sponsor_name,title,body,image_url,target_url,placement,category,priority,is_active,starts_at,ends_at,created_at' +
      '&order=priority.desc,created_at.desc&limit=3'
    ).then(setRows).catch(() => setRows([]));
  }, [enabled, placement]);

  if (!enabled || rows.length === 0) return null;

  return (
    <section className="sponsor-strip" aria-label="Sponsor GuruLes">
      <div className="sponsor-strip-head">
        <span>Disponsori</span>
        <small>Iklan mendukung layanan GuruLes</small>
      </div>
      <div className="sponsor-grid">
        {rows.map(row => {
          const target = safeTarget(row.target_url);
          const content = (
            <>
              {row.image_url ? (
                <img src={row.image_url} alt="" loading="lazy" />
              ) : (
                <div className="sponsor-placeholder">📣</div>
              )}
              <div>
                <small>{row.sponsor_name}</small>
                <strong>{row.title}</strong>
                {row.body && <p>{row.body}</p>}
                {target && <span>Lihat penawaran →</span>}
              </div>
            </>
          );
          return target ? (
            <a key={row.id} href={target} target="_blank" rel="sponsored noreferrer" className="sponsor-card">
              {content}
            </a>
          ) : (
            <article key={row.id} className="sponsor-card">{content}</article>
          );
        })}
      </div>
    </section>
  );
}

export function AdminSponsorManager({ session }: { session: SessionLike }) {
  const [rows, setRows] = useState<SponsorAd[]>([]);
  const [sponsorName, setSponsorName] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [placement, setPlacement] = useState<SponsorAd['placement']>('home');
  const [priority, setPriority] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api(
      '/rest/v1/sponsor_ads?select=id,sponsor_name,title,body,image_url,target_url,placement,category,priority,is_active,starts_at,ends_at,created_at&order=created_at.desc',
      {},
      session.access_token
    );
    setRows(data as SponsorAd[]);
  }

  useEffect(() => {
    void load().catch(error => setMessage(error instanceof Error ? error.message : 'Iklan belum dapat dimuat.'));
  }, [session.access_token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!sponsorName.trim() || !title.trim()) {
      setMessage('Isi nama sponsor dan judul iklan.');
      return;
    }
    if (targetUrl.trim() && !safeTarget(targetUrl.trim())) {
      setMessage('URL tujuan harus http/https yang valid.');
      return;
    }
    setBusy(true);
    try {
      await api('/rest/v1/sponsor_ads', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          sponsor_name: sponsorName.trim(),
          title: title.trim(),
          body: body.trim(),
          image_url: imageUrl.trim() || null,
          target_url: targetUrl.trim() || null,
          placement,
          priority,
          is_active: false,
          created_by: session.user.id,
        }),
      }, session.access_token);
      setSponsorName(''); setTitle(''); setBody(''); setImageUrl(''); setTargetUrl(''); setPriority(0);
      await load();
      setMessage('Materi sponsor dibuat sebagai draft. Aktifkan setelah materi siap.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Materi sponsor belum dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, values: Partial<SponsorAd>) {
    setMessage('');
    try {
      await api('/rest/v1/sponsor_ads?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
      }, session.access_token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Iklan belum dapat diperbarui.');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus materi sponsor ini?')) return;
    await api('/rest/v1/sponsor_ads?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }, session.access_token);
    await load();
  }

  return (
    <section className="sponsor-admin">
      <div className="admin-report-head">
        <div>
          <span className="eyebrow">Monetisasi Iklan</span>
          <h3>Sponsor & Iklan Langsung</h3>
          <p>Jual ruang promosi yang relevan tanpa mengambil komisi transaksi les.</p>
        </div>
      </div>

      <form className="sponsor-admin-form" onSubmit={submit}>
        <label>Nama sponsor<input value={sponsorName} onChange={e => setSponsorName(e.target.value)} maxLength={120} /></label>
        <label>Judul iklan<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} /></label>
        <label className="wide">Isi singkat<textarea rows={2} value={body} onChange={e => setBody(e.target.value)} maxLength={500} /></label>
        <label>URL gambar<input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." /></label>
        <label>URL tujuan<input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://..." /></label>
        <label>Penempatan
          <select value={placement} onChange={e => setPlacement(e.target.value as SponsorAd['placement'])}>
            <option value="home">Beranda</option>
            <option value="search">Hasil pencarian</option>
            <option value="category">Kategori</option>
            <option value="profile">Profil pengajar</option>
          </select>
        </label>
        <label>Prioritas<input type="number" min="0" max="1000" value={priority} onChange={e => setPriority(Number(e.target.value))} /></label>
        <button className="button primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Buat Draft Iklan'}</button>
      </form>

      {message && <div className="form-success">{message}</div>}

      <div className="sponsor-admin-list">
        {rows.length === 0 && <div className="status-box">Belum ada materi sponsor.</div>}
        {rows.map(row => (
          <article key={row.id}>
            <div>
              <small>{row.sponsor_name} · {row.placement}</small>
              <strong>{row.title}</strong>
              {row.body && <p>{row.body}</p>}
            </div>
            <div className="sponsor-admin-actions">
              <span className={row.is_active ? 'verified' : 'status-pill'}>{row.is_active ? 'Aktif' : 'Draft'}</span>
              <button className="button secondary small" onClick={() => void patch(row.id, { is_active: !row.is_active })}>
                {row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button className="text-button danger-text" onClick={() => void remove(row.id)}>Hapus</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
