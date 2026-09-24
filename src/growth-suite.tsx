import { FormEvent, useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';

export type GrowthSession = {
  access_token: string;
  user: { id: string; email?: string };
};

export type GrowthSettings = {
  platform_fee_percent: number;
  launch_mode: boolean;
  launch_title: string;
  launch_message: string;
  future_fee_percent: number;
  founding_teacher_limit: number;
  founding_free_months: number;
  premium_enabled: boolean;
  boost_enabled: boolean;
  payment_automation_mode: string;
  pilot_mode: boolean;
  pilot_teacher_limit: number;
  pilot_buyer_limit: number;
  pilot_title: string;
  pilot_message: string;
};

export type GrowthPackage = {
  id: string;
  listing_id: string;
  instructor_id: string;
  sessions_count: number;
  discount_percent: number;
  is_active: boolean;
};

export type GrowthBooking = {
  id: string;
  buyer_id: string;
  instructor_id: string;
  listing_id: string;
  scheduled_at: string;
  status: string;
  package_sessions_total?: number;
  package_sessions_completed?: number;
  package_discount_percent?: number;
  reschedule_requested_by?: string | null;
  proposed_scheduled_at?: string | null;
  dispute_reason?: string | null;
  no_show_by?: string | null;
};

type Learner = {
  id: string;
  owner_id: string;
  display_name: string;
  relation: 'self' | 'child' | 'other';
  school_level: string;
  grade: string;
  learning_goals: string;
  is_default: boolean;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};

type PackageSession = {
  id: string;
  booking_id: string;
  session_no: number;
  scheduled_at: string;
  status: string;
  buyer_confirmed_complete: boolean;
  instructor_confirmed_complete: boolean;
  reschedule_requested_by: string | null;
  proposed_scheduled_at: string | null;
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

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(value || 0);
}

export async function loadGrowthSettings(token?: string) {
  return (await api('/functions/v1/gurules-payment-settings', { method: 'GET' }, token)) as GrowthSettings;
}

export function LaunchBanner({ settings }: { settings: GrowthSettings | null }) {
  if (settings?.pilot_mode) {
    return (
      <section className="launch-banner" aria-label="Program uji coba terbatas GuruLes">
        <div className="launch-icon">🧪</div>
        <div>
          <strong>{settings.pilot_title || 'Uji Coba Terbatas GuruLes'}</strong>
          <span>
            {settings.pilot_message ||
              'Pilot awal untuk pengajar dan pencari guru. Fee platform tetap 0% selama masa uji coba.'}
          </span>
        </div>
        <b>PILOT · 0% FEE</b>
      </section>
    );
  }
  if (!settings?.launch_mode) return null;
  return (
    <section className="launch-banner" aria-label="Program peluncuran GuruLes">
      <div className="launch-icon">🎉</div>
      <div>
        <strong>{settings.launch_title || 'GuruLes Launching Program'}</strong>
        <span>{settings.launch_message || '0% biaya platform selama masa peluncuran.'}</span>
      </div>
      <b>0% FEE</b>
    </section>
  );
}

export function LessonPackagePicker({
  listingId,
  unitPrice,
  value,
  onChange,
}: {
  listingId: string;
  unitPrice: number;
  value: GrowthPackage | null;
  onChange: (pkg: GrowthPackage | null) => void;
}) {
  const [packages, setPackages] = useState<GrowthPackage[]>([]);

  useEffect(() => {
    void api(
      '/rest/v1/lesson_packages?listing_id=eq.' + encodeURIComponent(listingId) +
      '&is_active=eq.true&select=id,listing_id,instructor_id,sessions_count,discount_percent,is_active&order=sessions_count.asc'
    ).then(data => setPackages(data as GrowthPackage[])).catch(() => setPackages([]));
  }, [listingId]);

  const total = (pkg: GrowthPackage) =>
    Math.round(unitPrice * pkg.sessions_count * (100 - pkg.discount_percent) / 100);

  return (
    <div className="package-picker">
      <div className="package-picker-head">
        <strong>Pilih jumlah sesi</strong>
        <small>Paket dibuat mingguan pada hari dan jam yang sama.</small>
      </div>
      <div className="package-choice-row">
        <button type="button" className={!value ? 'active' : ''} onClick={() => onChange(null)}>
          <b>1x</b><span>{rupiah(unitPrice)}</span><small>Sesi tunggal</small>
        </button>
        {packages.map(pkg => (
          <button
            type="button"
            key={pkg.id}
            className={value?.id === pkg.id ? 'active' : ''}
            onClick={() => onChange(pkg)}
          >
            <b>{pkg.sessions_count}x</b>
            <span>{rupiah(total(pkg))}</span>
            <small>{pkg.discount_percent > 0 ? 'Hemat ' + pkg.discount_percent + '%' : 'Paket belajar'}</small>
          </button>
        ))}
      </div>
      {packages.length === 0 && (
        <small className="muted-note">Pengajar belum mengaktifkan paket. Sesi tunggal tetap tersedia.</small>
      )}
    </div>
  );
}

export function InstructorPackageManager({
  session,
  listingId,
  instructorId,
  unitPrice,
}: {
  session: GrowthSession;
  listingId: string;
  instructorId: string;
  unitPrice: number;
}) {
  const [rows, setRows] = useState<GrowthPackage[]>([]);
  const [message, setMessage] = useState('');
  const defaults = useMemo(() => [
    { sessions_count: 4, discount_percent: 5 },
    { sessions_count: 8, discount_percent: 10 },
    { sessions_count: 12, discount_percent: 15 },
  ], []);

  async function load() {
    const data = await api(
      '/rest/v1/lesson_packages?listing_id=eq.' + encodeURIComponent(listingId) +
      '&select=id,listing_id,instructor_id,sessions_count,discount_percent,is_active&order=sessions_count.asc',
      {}, session.access_token
    );
    setRows(data as GrowthPackage[]);
  }

  useEffect(() => { void load().catch(() => setRows([])); }, [listingId, session.access_token]);

  async function ensureDefaults() {
    setMessage('');
    try {
      for (const item of defaults) {
        if (!rows.some(row => row.sessions_count === item.sessions_count)) {
          await api('/rest/v1/lesson_packages', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              listing_id: listingId,
              instructor_id: instructorId,
              sessions_count: item.sessions_count,
              discount_percent: item.discount_percent,
              is_active: true,
            }),
          }, session.access_token);
        }
      }
      await load();
      setMessage('Paket 4x, 8x, dan 12x sudah disiapkan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Paket belum dapat dibuat.');
    }
  }

  async function update(row: GrowthPackage, patch: Partial<GrowthPackage>) {
    setMessage('');
    try {
      await api('/rest/v1/lesson_packages?id=eq.' + encodeURIComponent(row.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      }, session.access_token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Paket belum dapat diperbarui.');
    }
  }

  return (
    <div className="growth-panel">
      <div className="feature-head">
        <div>
          <span className="eyebrow">Paket Belajar</span>
          <h3>4x · 8x · 12x sesi</h3>
          <p>Paket membantu murid melakukan repeat booking tanpa keluar dari GuruLes.</p>
        </div>
        {rows.length === 0 && (
          <button className="button primary small" onClick={() => void ensureDefaults()}>
            Aktifkan Paket
          </button>
        )}
      </div>
      {rows.length > 0 && (
        <div className="package-admin-grid">
          {rows.map(row => {
            const total = Math.round(unitPrice * row.sessions_count * (100-row.discount_percent)/100);
            return (
              <div key={row.id} className={row.is_active ? 'package-admin-card active' : 'package-admin-card'}>
                <strong>{row.sessions_count} sesi</strong>
                <span>{rupiah(total)}</span>
                <label>
                  Diskon %
                  <input
                    type="number" min="0" max="40" value={row.discount_percent}
                    onChange={event => void update(row, { discount_percent: Math.max(0, Math.min(40, Number(event.target.value))) })}
                  />
                </label>
                <button className="button secondary small" onClick={() => void update(row, { is_active: !row.is_active })}>
                  {row.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {message && <div className="form-success">{message}</div>}
    </div>
  );
}

export function LearnerProfileManager({ session }: { session: GrowthSession }) {
  const [rows, setRows] = useState<Learner[]>([]);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<'self'|'child'|'other'>('child');
  const [level, setLevel] = useState('');
  const [grade, setGrade] = useState('');
  const [goals, setGoals] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const data = await api(
      '/rest/v1/learner_profiles?owner_id=eq.' + encodeURIComponent(session.user.id) +
      '&select=id,owner_id,display_name,relation,school_level,grade,learning_goals,is_default&order=created_at.asc',
      {}, session.access_token
    );
    setRows(data as Learner[]);
  }
  useEffect(() => { void load().catch(() => setRows([])); }, [session.access_token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!name.trim()) { setMessage('Isi nama pelajar.'); return; }
    try {
      await api('/rest/v1/learner_profiles', {
        method:'POST', headers:{Prefer:'return=minimal'},
        body:JSON.stringify({
          owner_id:session.user.id, display_name:name.trim(), relation,
          school_level:level.trim(), grade:grade.trim(), learning_goals:goals.trim(),
          is_default:rows.length===0
        })
      }, session.access_token);
      setName(''); setLevel(''); setGrade(''); setGoals('');
      await load(); setMessage('Profil pelajar tersimpan.');
    } catch(error) {
      setMessage(error instanceof Error ? error.message : 'Profil belum dapat disimpan.');
    }
  }

  async function remove(id:string) {
    if (!window.confirm('Hapus profil pelajar ini?')) return;
    await api('/rest/v1/learner_profiles?id=eq.'+encodeURIComponent(id), {method:'DELETE'}, session.access_token);
    await load();
  }

  return (
    <div className="growth-panel">
      <div className="feature-head">
        <div>
          <span className="eyebrow">Profil Pelajar</span>
          <h3>Satu akun, beberapa kebutuhan belajar</h3>
          <p>Tambahkan diri sendiri atau anak. Saat booking, cukup pilih siapa yang akan belajar.</p>
        </div>
      </div>
      <div className="learner-list">
        {rows.map(row => (
          <div key={row.id} className="learner-card">
            <div><strong>👤 {row.display_name}</strong><span>{row.school_level || 'Jenjang belum diisi'} {row.grade ? '· '+row.grade : ''}</span></div>
            <button className="text-button" onClick={() => void remove(row.id)}>Hapus</button>
          </div>
        ))}
      </div>
      <form className="learner-form" onSubmit={submit}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama pelajar" />
        <select value={relation} onChange={e=>setRelation(e.target.value as any)}>
          <option value="child">Anak</option><option value="self">Saya sendiri</option><option value="other">Lainnya</option>
        </select>
        <input value={level} onChange={e=>setLevel(e.target.value)} placeholder="Jenjang, mis. SD / SMP / SMA" />
        <input value={grade} onChange={e=>setGrade(e.target.value)} placeholder="Kelas" />
        <input value={goals} onChange={e=>setGoals(e.target.value)} placeholder="Tujuan belajar (opsional)" />
        <button className="button primary" type="submit">Tambah Pelajar</button>
      </form>
      {message && <div className="form-success">{message}</div>}
    </div>
  );
}

export function LearnerPicker({
  session,
  value,
  onChange,
}: {
  session: GrowthSession;
  value: string;
  onChange: (value:string)=>void;
}) {
  const [rows,setRows]=useState<Learner[]>([]);
  useEffect(()=>{
    void api(
      '/rest/v1/learner_profiles?owner_id=eq.'+encodeURIComponent(session.user.id)+
      '&select=id,owner_id,display_name,relation,school_level,grade,learning_goals,is_default&order=is_default.desc,created_at.asc',
      {},session.access_token
    ).then(data=>{
      const list=data as Learner[]; setRows(list);
      if(!value&&list.length) onChange(list[0].id);
    }).catch(()=>setRows([]));
  },[session.access_token]);
  if(!rows.length) return <div className="muted-note">Profil pelajar belum dibuat. Booking tetap dapat dilanjutkan.</div>;
  return (
    <label>
      Untuk siapa?
      <select value={value} onChange={e=>onChange(e.target.value)}>
        <option value="">Tanpa profil khusus</option>
        {rows.map(row=><option key={row.id} value={row.id}>{row.display_name}{row.grade?' · '+row.grade:''}</option>)}
      </select>
    </label>
  );
}

export function NotificationCenter({ session }: { session: GrowthSession }) {
  const [rows,setRows]=useState<Notification[]>([]);
  const [open,setOpen]=useState(false);

  async function load(){
    const data=await api(
      '/rest/v1/notifications?user_id=eq.'+encodeURIComponent(session.user.id)+
      '&select=id,type,title,body,booking_id,is_read,created_at&order=created_at.desc&limit=20',
      {},session.access_token
    );
    setRows(data as Notification[]);
  }
  useEffect(()=>{
    void load().catch(()=>setRows([]));
    const timer=window.setInterval(()=>void load().catch(()=>{}),15000);
    return()=>window.clearInterval(timer);
  },[session.access_token]);

  const unread=rows.filter(x=>!x.is_read).length;
  async function markAll(){
    if(!unread) return;
    await api(
      '/rest/v1/notifications?user_id=eq.'+encodeURIComponent(session.user.id)+'&is_read=eq.false',
      {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({is_read:true})},
      session.access_token
    );
    await load();
  }

  return (
    <div className="notification-center">
      <button className="notification-button" onClick={()=>setOpen(v=>!v)} aria-label="Notifikasi">
        🔔{unread>0&&<b>{unread>9?'9+':unread}</b>}
      </button>
      {open&&(
        <div className="notification-popover">
          <div className="notification-head"><strong>Notifikasi</strong><button className="text-button" onClick={()=>void markAll()}>Tandai dibaca</button></div>
          {rows.length===0?<div className="muted-note">Belum ada notifikasi.</div>:
            rows.map(row=>(
              <div key={row.id} className={row.is_read?'notification-row':'notification-row unread'}>
                <strong>{row.title}</strong><span>{row.body}</span>
                <small>{new Date(row.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</small>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

export function ReferralPanel({ session, isInstructor=false }: { session: GrowthSession; isInstructor?:boolean }) {
  const [code,setCode]=useState('');
  const [count,setCount]=useState(0);
  const [message,setMessage]=useState('');

  async function load(){
    let codes=await api(
      '/rest/v1/referral_codes?owner_id=eq.'+encodeURIComponent(session.user.id)+'&select=code&limit=1',
      {},session.access_token
    ) as Array<{code:string}>;
    if(!codes.length){
      const generated=('GL'+session.user.id.replace(/-/g,'').slice(0,8)).toUpperCase();
      await api('/rest/v1/referral_codes',{
        method:'POST',headers:{Prefer:'return=representation'},
        body:JSON.stringify({owner_id:session.user.id,code:generated,is_active:true})
      },session.access_token);
      codes=[{code:generated}];
    }
    setCode(codes[0].code);
    const events=await api(
      '/rest/v1/referral_events?referrer_id=eq.'+encodeURIComponent(session.user.id)+'&select=id',
      {},session.access_token
    ) as Array<{id:string}>;
    setCount(events.length);
  }
  useEffect(()=>{void load().catch(()=>{});},[session.access_token]);

  function referralLink() {
    if (!code) return '';
    return window.location.origin + '/?ref=' + encodeURIComponent(code);
  }

  async function copy(){
    if(!code)return;
    const link=referralLink();
    try{await navigator.clipboard.writeText(link);setMessage('Link referral disalin.');}
    catch{setMessage('Kode referral: '+code);}
  }

  async function share(){
    if(!code)return;
    const link=referralLink();
    if(navigator.share){
      try{
        await navigator.share({
          title:'GuruLes',
          text:'Gabung di GuruLes dengan kode referral saya '+code,
          url:link
        });
        return;
      }catch{
        return;
      }
    }
    await copy();
  }

  return (
    <div className="growth-panel referral-panel">
      <div>
        <span className="eyebrow">Program Referral</span>
        <h3>Ajak pengguna GuruLes</h3>
        <p>{isInstructor?'Setiap 3 referral memberi Boost profil 30 hari.':'Bagikan GuruLes agar komunitas pengajar dan pelajar semakin besar.'}</p>
      </div>
      <div className="referral-code">
        <strong>{code||'...'}</strong>
        <button className="button secondary small" onClick={()=>void copy()}>Salin Link</button>
        <button className="button primary small" onClick={()=>void share()}>Bagikan</button>
      </div>
      <span className="referral-count">{count} referral berhasil</span>
      {message&&<small className="form-success">{message}</small>}
    </div>
  );
}

export function InstructorGrowthStatus({
  listing,
}: {
  listing: {
    founding_teacher_no?:number|null;
    founding_free_until?:string|null;
    identity_verified?:boolean;
    credential_verified?:boolean;
    experience_verified?:boolean;
    payout_verified?:boolean;
    completed_sessions?:number;
    response_rate?:number|string;
    premium_plan?:string;
    boost_until?:string|null;
  };
}) {
  return (
    <div className="growth-status-grid">
      <div>
        <small>Status</small>
        <strong>
          {listing.founding_teacher_no
            ? '🌟 Pengajar Perintis #' + listing.founding_teacher_no
            : 'Pengajar GuruLes'}
        </strong>
        {listing.founding_free_until &&
          new Date(listing.founding_free_until) > new Date() && (
            <span className="founding-free-note">
              0% fee sampai {new Date(listing.founding_free_until).toLocaleDateString('id-ID')}
            </span>
          )}
      </div>
      <div><small>Identitas</small><strong>{listing.identity_verified?'✅ Terverifikasi':'Belum diverifikasi'}</strong></div>
      <div><small>Sertifikat/Pendidikan</small><strong>{listing.credential_verified?'✅ Terverifikasi':'Belum diverifikasi'}</strong></div>
      <div><small>Pengalaman</small><strong>{listing.experience_verified?'✅ Terverifikasi':'Belum diverifikasi'}</strong></div>
      <div><small>Rekening/Payout</small><strong>{listing.payout_verified?'✅ Terverifikasi':'Belum diverifikasi'}</strong></div>
      <div><small>Sesi selesai</small><strong>{listing.completed_sessions||0}</strong></div>
      <div><small>Response rate</small><strong>{Number(listing.response_rate||0).toFixed(0)}%</strong></div>
      <div><small>Paket akun</small><strong>{listing.premium_plan==='premium'?'Premium':'Free'}</strong></div>
      {listing.boost_until&&new Date(listing.boost_until)>new Date()&&(
        <div><small>Boost</small><strong>🚀 sampai {new Date(listing.boost_until).toLocaleDateString('id-ID')}</strong></div>
      )}
    </div>
  );
}

export function AdminTrustControls({
  session,
  listing,
  onChanged,
}: {
  session:GrowthSession;
  listing:{
    id:string;
    identity_verified?:boolean;
    credential_verified?:boolean;
    experience_verified?:boolean;
    payout_verified?:boolean;
  };
  onChanged?:()=>void|Promise<void>;
}) {
  async function set(
    field:
      | 'identity_verified'
      | 'credential_verified'
      | 'experience_verified'
      | 'payout_verified',
    value:boolean
  ){
    await api('/rest/v1/instructor_listings?id=eq.'+encodeURIComponent(listing.id),{
      method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({[field]:value})
    },session.access_token);
    await onChanged?.();
  }
  return (
    <div className="trust-controls">
      <button className={listing.identity_verified?'trust-chip active':'trust-chip'} onClick={()=>void set('identity_verified',!listing.identity_verified)}>
        🪪 Identitas {listing.identity_verified?'✓':''}
      </button>
      <button className={listing.credential_verified?'trust-chip active':'trust-chip'} onClick={()=>void set('credential_verified',!listing.credential_verified)}>
        🎓 Pendidikan {listing.credential_verified?'✓':''}
      </button>
      <button className={listing.experience_verified?'trust-chip active':'trust-chip'} onClick={()=>void set('experience_verified',!listing.experience_verified)}>
        💼 Pengalaman {listing.experience_verified?'✓':''}
      </button>
      <button className={listing.payout_verified?'trust-chip active':'trust-chip'} onClick={()=>void set('payout_verified',!listing.payout_verified)}>
        💳 Rekening {listing.payout_verified?'✓':''}
      </button>
    </div>
  );
}

async function transactionAction(session:GrowthSession,bookingId:string,body:Record<string,unknown>){
  return api('/functions/v1/booking-transaction-action',{
    method:'POST',body:JSON.stringify({booking_id:bookingId,...body})
  },session.access_token);
}

export function BookingIssueControls({
  session,booking,role,isAdmin=false,onChanged
}:{
  session:GrowthSession;
  booking:GrowthBooking;
  role:'parent'|'student'|'instructor'|'admin';
  isAdmin?:boolean;
  onChanged?:()=>void|Promise<void>;
}) {
  const [busy,setBusy]=useState(false);
  async function run(body:Record<string,unknown>){
    setBusy(true);
    try{const result=await transactionAction(session,booking.id,body);window.alert(result.message||'Berhasil.');await onChanged?.();}
    catch(error){window.alert(error instanceof Error?error.message:'Aksi belum dapat diproses.');}
    finally{setBusy(false);}
  }
  const participant=!isAdmin&&(role==='parent'||role==='student'||role==='instructor');
  const requester=booking.reschedule_requested_by;
  const canRespond=booking.status==='reschedule_requested'&&requester&&requester!==session.user.id;

  return (
    <div className="issue-actions">
      {participant&&['requested','accepted','reschedule_requested'].includes(booking.status)&&(
        <button disabled={busy} className="text-button danger-text" onClick={()=>{
          const reason=window.prompt('Alasan pembatalan:'); if(reason) void run({action:'cancel',reason});
        }}>Batalkan</button>
      )}
      {participant&&Number(booking.package_sessions_total||1)===1&&['requested','accepted','paid'].includes(booking.status)&&(
        <button disabled={busy} className="text-button" onClick={()=>{
          const proposed=window.prompt('Jadwal baru (contoh 2026-10-01T16:00):');
          if(proposed){const d=new Date(proposed);if(!Number.isNaN(d.getTime()))void run({action:'request_reschedule',proposed_scheduled_at:d.toISOString()});}
        }}>Ubah Jadwal</button>
      )}
      {participant&&canRespond&&(
        <>
          <button disabled={busy} className="text-button" onClick={()=>void run({action:'respond_reschedule',accept:true})}>Setujui Jadwal</button>
          <button disabled={busy} className="text-button danger-text" onClick={()=>void run({action:'respond_reschedule',accept:false})}>Tolak Jadwal</button>
        </>
      )}
      {participant&&['accepted','paid','in_progress','reschedule_requested'].includes(booking.status)&&(
        <button disabled={busy} className="text-button" onClick={()=>{
          const reason=window.prompt('Jelaskan masalah/sengketa:');if(reason)void run({action:'open_dispute',reason});
        }}>Laporkan Masalah</button>
      )}
      {participant&&['paid','in_progress'].includes(booking.status)&&new Date(booking.scheduled_at)<=new Date()&&(
        <button disabled={busy} className="text-button danger-text" onClick={()=>{
          if(window.confirm('Laporkan pihak lain tidak hadir (no-show)?'))void run({action:'mark_no_show'});
        }}>No-show</button>
      )}
      {isAdmin&&booking.status==='disputed'&&(
        <>
          <button disabled={busy} className="button primary small" onClick={()=>{
            const note=window.prompt('Catatan penyelesaian:');if(note)void run({action:'resolve_dispute',resolution:'completed',resolution_note:note});
          }}>Selesaikan</button>
          <button disabled={busy} className="button secondary small" onClick={()=>{
            const note=window.prompt('Catatan pembatalan/refund:');if(note)void run({action:'resolve_dispute',resolution:'cancelled',resolution_note:note});
          }}>Batalkan + Refund</button>
        </>
      )}
    </div>
  );
}

export function PackageSessionProgress({
  session,booking,role,onChanged
}:{
  session:GrowthSession;
  booking:GrowthBooking;
  role:'parent'|'student'|'instructor'|'admin';
  onChanged?:()=>void|Promise<void>;
}) {
  const [rows,setRows]=useState<PackageSession[]>([]);
  const total=Number(booking.package_sessions_total||1);
  async function load(){
    if(total<=1)return;
    const data=await api(
      '/rest/v1/booking_sessions?booking_id=eq.'+encodeURIComponent(booking.id)+
      '&select=id,booking_id,session_no,scheduled_at,status,buyer_confirmed_complete,instructor_confirmed_complete,reschedule_requested_by,proposed_scheduled_at&order=session_no.asc',
      {},session.access_token
    );
    setRows(data as PackageSession[]);
  }
  useEffect(()=>{void load().catch(()=>setRows([]));},[booking.id,booking.status,session.access_token]);
  if(total<=1)return null;

  const participant=role==='parent'||role==='student'||role==='instructor';
  async function run(row:PackageSession,body:Record<string,unknown>){
    try{
      const result=await transactionAction(session,booking.id,{session_id:row.id,...body});
      window.alert(result.message||'Berhasil.');await load();await onChanged?.();
    }catch(error){window.alert(error instanceof Error?error.message:'Aksi sesi belum dapat diproses.');}
  }

  return (
    <div className="package-progress">
      <div className="package-progress-head"><strong>Paket {total} sesi</strong><span>{booking.package_sessions_completed||0}/{total} selesai</span></div>
      <div className="package-session-list">
        {rows.map(row=>{
          const myConfirmed=role==='instructor'?row.instructor_confirmed_complete:row.buyer_confirmed_complete;
          const canConfirm=participant&&['paid','in_progress'].includes(booking.status)&&!myConfirmed&&row.status!=='completed'&&new Date(row.scheduled_at)<=new Date();
          const canRespond=row.status==='reschedule_requested'&&row.reschedule_requested_by!==session.user.id;
          return (
            <div className="package-session-row" key={row.id}>
              <div><b>#{row.session_no}</b><span>{new Date(row.scheduled_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</span><small>{row.status}</small></div>
              <div>
                {canConfirm&&<button className="text-button" onClick={()=>void run(row,{action:'confirm_package_session'})}>Konfirmasi selesai</button>}
                {participant&&['paid','in_progress'].includes(booking.status)&&row.status!=='completed'&&row.status!=='reschedule_requested'&&new Date(row.scheduled_at)>new Date()&&(
                  <button className="text-button" onClick={()=>{
                    const proposed=window.prompt('Jadwal baru (contoh 2026-10-01T16:00):');
                    if(proposed){const d=new Date(proposed);if(!Number.isNaN(d.getTime()))void run(row,{action:'request_package_reschedule',proposed_scheduled_at:d.toISOString()});}
                  }}>Ubah</button>
                )}
                {participant&&canRespond&&<>
                  <button className="text-button" onClick={()=>void run(row,{action:'respond_package_reschedule',accept:true})}>Setujui</button>
                  <button className="text-button danger-text" onClick={()=>void run(row,{action:'respond_package_reschedule',accept:false})}>Tolak</button>
                </>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export function PilotFeedback({
  session,
  booking,
  role,
  enabled,
}: {
  session: GrowthSession;
  booking: GrowthBooking;
  role: 'parent' | 'student' | 'instructor';
  enabled: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [overall, setOverall] = useState(5);
  const [ease, setEase] = useState(5);
  const [issueType, setIssueType] = useState('none');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const feedbackRole = role === 'instructor' ? 'instructor' : 'buyer';

  useEffect(() => {
    if (!enabled || booking.status !== 'completed') return;
    void api(
      '/rest/v1/pilot_feedback?booking_id=eq.' + encodeURIComponent(booking.id) +
      '&user_id=eq.' + encodeURIComponent(session.user.id) +
      '&select=id&limit=1',
      {},
      session.access_token
    ).then((rows: Array<{id:string}>) => setSubmitted(rows.length > 0))
      .catch(() => undefined);
  }, [enabled, booking.id, booking.status, session.access_token, session.user.id]);

  if (!enabled || booking.status !== 'completed') return null;

  if (submitted) {
    return (
      <div className="muted-note">
        🧪 Terima kasih. Feedback pilot untuk transaksi ini sudah tersimpan.
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api(
        '/rest/v1/pilot_feedback',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            booking_id: booking.id,
            user_id: session.user.id,
            role: feedbackRole,
            overall_rating: overall,
            ease_rating: ease,
            issue_type: issueType,
            comment: comment.trim(),
          }),
        },
        session.access_token
      );
      setSubmitted(true);
      setMessage('Feedback pilot berhasil dikirim. Terima kasih.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Feedback belum dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="growth-panel learner-form" onSubmit={submit}>
      <div className="feature-head">
        <div>
          <span className="eyebrow">🧪 Feedback Pilot</span>
          <h3>Bantu menyempurnakan GuruLes</h3>
          <p>Nilai pengalaman transaksi ini. Masukan Anda dipakai untuk perbaikan sebelum peluncuran luas.</p>
        </div>
      </div>
      <label>
        Kepuasan keseluruhan
        <select value={overall} onChange={e => setOverall(Number(e.target.value))}>
          <option value={5}>5 · Sangat baik</option>
          <option value={4}>4 · Baik</option>
          <option value={3}>3 · Cukup</option>
          <option value={2}>2 · Kurang</option>
          <option value={1}>1 · Buruk</option>
        </select>
      </label>
      <label>
        Kemudahan penggunaan
        <select value={ease} onChange={e => setEase(Number(e.target.value))}>
          <option value={5}>5 · Sangat mudah</option>
          <option value={4}>4 · Mudah</option>
          <option value={3}>3 · Cukup</option>
          <option value={2}>2 · Sulit</option>
          <option value={1}>1 · Sangat sulit</option>
        </select>
      </label>
      <label>
        Bagian yang perlu diperbaiki
        <select value={issueType} onChange={e => setIssueType(e.target.value)}>
          <option value="none">Tidak ada masalah</option>
          <option value="registration">Pendaftaran / login</option>
          <option value="search">Pencarian pengajar / lokasi</option>
          <option value="schedule">Jadwal</option>
          <option value="booking">Booking</option>
          <option value="payment">Pembayaran</option>
          <option value="session">Pelaksanaan sesi</option>
          <option value="other">Lainnya</option>
        </select>
      </label>
      <label className="brand-tagline-field">
        Catatan
        <textarea
          rows={3}
          value={comment}
          maxLength={2000}
          onChange={e => setComment(e.target.value)}
          placeholder="Apa yang sudah baik dan apa yang perlu diperbaiki?"
        />
      </label>
      <button className="button primary small" type="submit" disabled={busy}>
        {busy ? 'Mengirim...' : 'Kirim Feedback Pilot'}
      </button>
      {message && <div className="form-success">{message}</div>}
    </form>
  );
}

export function PilotDashboard({
  session,
  settings,
}: {
  session: GrowthSession;
  settings: GrowthSettings | null;
}) {
  const [profiles, setProfiles] = useState<Array<{id:string;role:string}>>([]);
  const [bookings, setBookings] = useState<Array<{id:string;status:string}>>([]);
  const [feedback, setFeedback] = useState<Array<{overall_rating:number;ease_rating:number;issue_type:string}>>([]);

  async function load() {
    const [profileRows, bookingRows, feedbackRows] = await Promise.all([
      api('/rest/v1/profiles?select=id,role', {}, session.access_token),
      api('/rest/v1/bookings?select=id,status', {}, session.access_token),
      api('/rest/v1/pilot_feedback?select=overall_rating,ease_rating,issue_type', {}, session.access_token),
    ]);
    setProfiles(profileRows as Array<{id:string;role:string}>);
    setBookings(bookingRows as Array<{id:string;status:string}>);
    setFeedback(feedbackRows as Array<{overall_rating:number;ease_rating:number;issue_type:string}>);
  }

  useEffect(() => {
    if (!settings?.pilot_mode) return;
    void load().catch(() => undefined);
  }, [settings?.pilot_mode, session.access_token]);

  if (!settings?.pilot_mode) return null;

  const teachers = profiles.filter(row => row.role === 'instructor').length;
  const buyers = profiles.filter(row => row.role === 'parent' || row.role === 'student').length;
  const completed = bookings.filter(row => row.status === 'completed').length;
  const avgOverall = feedback.length
    ? feedback.reduce((sum, row) => sum + Number(row.overall_rating || 0), 0) / feedback.length
    : 0;
  const avgEase = feedback.length
    ? feedback.reduce((sum, row) => sum + Number(row.ease_rating || 0), 0) / feedback.length
    : 0;
  const issues = feedback.filter(row => row.issue_type && row.issue_type !== 'none').length;

  return (
    <div className="growth-panel">
      <div className="feature-head">
        <div>
          <span className="eyebrow">🧪 Monitoring Pilot</span>
          <h3>Uji coba terbatas GuruLes</h3>
          <p>
            Kuota dikendalikan otomatis: maksimal {settings.pilot_teacher_limit} pengajar
            dan {settings.pilot_buyer_limit} pencari guru.
          </p>
        </div>
        <button className="button secondary small" onClick={() => void load()}>
          Segarkan
        </button>
      </div>
      <div className="admin-growth-summary">
        <div><strong>{teachers}/{settings.pilot_teacher_limit}</strong><span>Pengajar pilot</span></div>
        <div><strong>{buyers}/{settings.pilot_buyer_limit}</strong><span>Pencari guru</span></div>
        <div><strong>{bookings.length}</strong><span>Total booking</span></div>
        <div><strong>{completed}</strong><span>Sesi selesai</span></div>
        <div><strong>{feedback.length}</strong><span>Feedback masuk</span></div>
        <div><strong>{avgOverall ? avgOverall.toFixed(1) : '-'}</strong><span>Kepuasan / 5</span></div>
        <div><strong>{avgEase ? avgEase.toFixed(1) : '-'}</strong><span>Kemudahan / 5</span></div>
        <div><strong>{issues}</strong><span>Feedback bermasalah</span></div>
      </div>
    </div>
  );
}
