import { FormEvent, useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';

export type MarketplaceSession = {
  access_token: string;
  user: { id: string; email?: string };
};

export type MarketplaceListing = {
  id: string;
  instructor_id: string;
  display_name: string;
  title: string;
  category: string;
  price_per_session: number;
  duration_minutes: number;
  average_rating: number | string;
  review_count: number;
  avatar_url?: string | null;
  branding_updated_at?: string | null;
};

export type MarketplaceBooking = {
  id: string;
  buyer_id: string;
  instructor_id: string;
  listing_id: string;
  scheduled_at: string;
  status: string;
  session_price: number;
  platform_fee_amount: number;
  instructor_net_amount: number;
};

type AvailabilityRow = {
  id: string;
  instructor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
};

type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  instructor_id: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type PaymentRow = {
  booking_id: string;
  gross_amount: number;
  platform_fee: number;
  instructor_net: number;
  payment_status: string;
  payout_status: string;
  submitted_at: string | null;
};

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const TIMEZONE_OPTIONS = [
  ['Asia/Jakarta', 'WIB'],
  ['Asia/Makassar', 'WITA'],
  ['Asia/Jayapura', 'WIT'],
] as const;

async function marketApi(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers || {});
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);

  const response = await fetch(SUPABASE_URL + path, { ...options, headers });
  const raw = await response.text();
  let data: any = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
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
  }).format(value || 0);
}

function timezoneShort(value: string) {
  return TIMEZONE_OPTIONS.find(item => item[0] === value)?.[1] || 'WIB';
}

function timezoneOffsetHours(value: string) {
  if (value === 'Asia/Makassar') return 8;
  if (value === 'Asia/Jayapura') return 9;
  return 7;
}

function zonedToday(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const pick = (type: string) =>
    Number(parts.find(part => part.type === type)?.value || 0);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

function addDateDays(
  date: { year: number; month: number; day: number },
  add: number
) {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + add));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

function timeMinutes(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function slotIso(
  date: { year: number; month: number; day: number },
  minuteOfDay: number,
  timezone: string
) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const offset = timezoneOffsetHours(timezone);
  return new Date(
    Date.UTC(date.year, date.month - 1, date.day, hour - offset, minute, 0, 0)
  ).toISOString();
}

function formatSlot(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function InstructorAvailabilityManager({
  session,
  instructorId,
}: {
  session: MarketplaceSession;
  instructorId: string;
}) {
  const [rows, setRows] = useState<AvailabilityRow[]>([]);
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState('16:00');
  const [end, setEnd] = useState('20:00');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const data = (await marketApi(
      '/rest/v1/instructor_availability?instructor_id=eq.' +
        encodeURIComponent(instructorId) +
        '&select=id,instructor_id,weekday,start_time,end_time,timezone,is_active&order=weekday.asc,start_time.asc',
      {},
      session.access_token
    )) as AvailabilityRow[];
    setRows(data);
  }

  useEffect(() => {
    void load().catch(error =>
      setMessage(error instanceof Error ? error.message : 'Jadwal gagal dimuat.')
    );
  }, [instructorId, session.access_token]);

  async function addOne(day = weekday, startValue = start, endValue = end) {
    await marketApi(
      '/rest/v1/instructor_availability',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          instructor_id: instructorId,
          weekday: day,
          start_time: startValue,
          end_time: endValue,
          timezone,
          is_active: true,
        }),
      },
      session.access_token
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (start >= end) {
      setMessage('Jam selesai harus lebih akhir dari jam mulai.');
      return;
    }
    setBusy(true);
    try {
      await addOne();
      await load();
      setMessage('Jadwal tersedia berhasil ditambahkan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Jadwal gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function quickWeekdays() {
    setBusy(true);
    setMessage('');
    try {
      for (const day of [1, 2, 3, 4, 5]) {
        if (
          rows.some(
            row =>
              row.weekday === day &&
              row.start_time.startsWith('16:00') &&
              row.end_time.startsWith('20:00')
          )
        ) {
          continue;
        }
        await addOne(day, '16:00', '20:00');
      }
      await load();
      setMessage('Senin–Jumat 16.00–20.00 berhasil ditambahkan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Jadwal cepat gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await marketApi(
        '/rest/v1/instructor_availability?id=eq.' + encodeURIComponent(id),
        { method: 'DELETE' },
        session.access_token
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="market-feature-panel">
      <div className="feature-head">
        <div>
          <span className="eyebrow">Jadwal Mengajar</span>
          <h3>Atur waktu tersedia</h3>
        </div>
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() => void quickWeekdays()}
        >
          Sen–Jum 16–20
        </button>
      </div>

      <div className="availability-chips">
        {rows.length === 0 ? (
          <span className="feature-empty">Belum ada jadwal tersedia.</span>
        ) : (
          rows.map(row => (
            <span className="availability-chip" key={row.id}>
              <strong>{DAY_LABELS[row.weekday]}</strong>{' '}
              {row.start_time.slice(0, 5)}–{row.end_time.slice(0, 5)}{' '}
              {timezoneShort(row.timezone)}
              <button
                aria-label="Hapus jadwal"
                disabled={busy}
                onClick={() => void remove(row.id)}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <form className="availability-form" onSubmit={submit}>
        <select value={weekday} onChange={e => setWeekday(Number(e.target.value))}>
          {DAY_LABELS.map((label, index) => (
            <option value={index} key={label}>
              {label}
            </option>
          ))}
        </select>
        <input type="time" value={start} onChange={e => setStart(e.target.value)} />
        <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
        <select value={timezone} onChange={e => setTimezone(e.target.value)}>
          {TIMEZONE_OPTIONS.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="button primary small" disabled={busy}>
          + Tambah
        </button>
      </form>
      {message && <small className="feature-message">{message}</small>}
    </div>
  );
}

export function BookingAvailabilityPicker({
  instructorId,
  durationMinutes,
  value,
  onChange,
}: {
  instructorId: string;
  durationMinutes: number;
  value: string;
  onChange: (iso: string) => void;
}) {
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    async function run() {
      const rows = (await marketApi(
        '/rest/v1/instructor_availability?instructor_id=eq.' +
          encodeURIComponent(instructorId) +
          '&is_active=eq.true&select=id,instructor_id,weekday,start_time,end_time,timezone,is_active&order=weekday.asc,start_time.asc'
      )) as AvailabilityRow[];

      const from = new Date();
      const to = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const occupied = (await marketApi('/rest/v1/rpc/get_busy_slots', {
        method: 'POST',
        body: JSON.stringify({
          p_instructor_id: instructorId,
          p_from: from.toISOString(),
          p_to: to.toISOString(),
        }),
      })) as Array<{ slot: string }>;

      if (alive) {
        setAvailability(rows);
        setBusySlots(occupied.map(item => item.slot));
        setLoading(false);
      }
    }

    void run().catch(() => {
      if (alive) {
        setAvailability([]);
        setBusySlots([]);
        setLoading(false);
      }
    });

    return () => {
      alive = false;
    };
  }, [instructorId]);

  const slots = useMemo(() => {
    if (availability.length === 0) return [];
    const timezone = availability[0].timezone || 'Asia/Jakarta';
    const today = zonedToday(timezone);
    const occupied = new Set(
      busySlots.map(item => Math.floor(new Date(item).getTime() / 60000))
    );
    const result: Array<{ iso: string; label: string; timezone: string }> = [];
    const duration = Math.max(30, durationMinutes || 60);

    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const date = addDateDays(today, dayOffset);
      const windows = availability.filter(row => row.weekday === date.weekday);
      for (const window of windows) {
        const start = timeMinutes(window.start_time);
        const end = timeMinutes(window.end_time);
        for (let minute = start; minute + duration <= end; minute += duration) {
          const iso = slotIso(date, minute, window.timezone);
          const time = new Date(iso).getTime();
          if (time <= Date.now() + 30 * 60 * 1000) continue;
          if (occupied.has(Math.floor(time / 60000))) continue;
          result.push({
            iso,
            label: formatSlot(iso, window.timezone),
            timezone: timezoneShort(window.timezone),
          });
        }
      }
    }
    return result.slice(0, 56);
  }, [availability, busySlots, durationMinutes]);

  if (loading) {
    return <div className="slot-box">Memuat jadwal pengajar...</div>;
  }

  if (availability.length === 0) {
    return (
      <div className="slot-box warning">
        Pengajar belum mengatur jadwal tersedia. Booking belum dapat dilakukan.
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="slot-box warning">
        Belum ada slot kosong dalam 14 hari ke depan.
      </div>
    );
  }

  return (
    <label className="slot-picker">
      Pilih jadwal tersedia
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">Pilih hari & jam</option>
        {slots.map(slot => (
          <option value={slot.iso} key={slot.iso}>
            {slot.label} {slot.timezone}
          </option>
        ))}
      </select>
      <small>Hanya waktu yang dibuka pengajar dan belum dibooking yang tampil.</small>
    </label>
  );
}

export function FavoriteButton({
  session,
  listingId,
  onRequireLogin,
}: {
  session: MarketplaceSession | null;
  listingId: string;
  onRequireLogin: () => void;
}) {
  const [favoriteId, setFavoriteId] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!session) {
      setFavoriteId('');
      return;
    }
    const data = (await marketApi(
      '/rest/v1/favorites?listing_id=eq.' +
        encodeURIComponent(listingId) +
        '&select=id&limit=1',
      {},
      session.access_token
    )) as Array<{ id: string }>;
    setFavoriteId(data[0]?.id || '');
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, [listingId, session?.access_token]);

  async function toggle() {
    if (!session) {
      onRequireLogin();
      return;
    }
    setBusy(true);
    try {
      if (favoriteId) {
        await marketApi(
          '/rest/v1/favorites?id=eq.' + encodeURIComponent(favoriteId),
          { method: 'DELETE' },
          session.access_token
        );
        setFavoriteId('');
        window.dispatchEvent(new Event('gurules:favorites-changed'));
      } else {
        const result = (await marketApi(
          '/rest/v1/favorites',
          {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({
              user_id: session.user.id,
              listing_id: listingId,
            }),
          },
          session.access_token
        )) as Array<{ id: string }>;
        setFavoriteId(result[0]?.id || '');
        window.dispatchEvent(new Event('gurules:favorites-changed'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={'favorite-button' + (favoriteId ? ' active' : '')}
      aria-label={favoriteId ? 'Hapus dari favorit' : 'Simpan pengajar'}
      disabled={busy}
      onClick={event => {
        event.stopPropagation();
        void toggle();
      }}
    >
      {favoriteId ? '♥' : '♡'}
    </button>
  );
}

function ChatWindow({
  session,
  conversation,
  title,
  onClose,
}: {
  session: MarketplaceSession;
  conversation: Conversation;
  title: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = (await marketApi(
      '/rest/v1/messages?conversation_id=eq.' +
        encodeURIComponent(conversation.id) +
        '&select=id,conversation_id,sender_id,body,created_at,read_at&order=created_at.asc',
      {},
      session.access_token
    )) as Message[];
    setMessages(data);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [conversation.id, session.access_token]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await marketApi(
        '/rest/v1/messages',
        {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: conversation.id,
            sender_id: session.user.id,
            body: text,
          }),
        },
        session.access_token
      );
      setBody('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop chat-backdrop" onMouseDown={onClose}>
      <div className="chat-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="chat-head">
          <div>
            <span>💬 Tanya Pengajar</span>
            <strong>{title}</strong>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              Mulai percakapan tentang kebutuhan, lokasi, usia murid, atau jadwal.
            </div>
          )}
          {messages.map(message => (
            <div
              className={
                'chat-bubble ' +
                (message.sender_id === session.user.id ? 'mine' : 'theirs')
              }
              key={message.id}
            >
              <p>{message.body}</p>
              <small>
                {new Date(message.created_at).toLocaleString('id-ID', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </small>
            </div>
          ))}
        </div>
        <form className="chat-compose" onSubmit={send}>
          <input
            value={body}
            maxLength={2000}
            onChange={event => setBody(event.target.value)}
            placeholder="Tulis pesan..."
          />
          <button className="button primary small" disabled={busy || !body.trim()}>
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
}

export function ChatLauncher({
  session,
  listing,
  userRole,
  onRequireLogin,
}: {
  session: MarketplaceSession | null;
  listing: MarketplaceListing;
  userRole: string | undefined;
  onRequireLogin: () => void;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [busy, setBusy] = useState(false);

  async function open() {
    if (!session) {
      onRequireLogin();
      return;
    }
    if (userRole !== 'parent' && userRole !== 'student') return;

    setBusy(true);
    try {
      const existing = (await marketApi(
        '/rest/v1/conversations?listing_id=eq.' +
          encodeURIComponent(listing.id) +
          '&buyer_id=eq.' +
          encodeURIComponent(session.user.id) +
          '&select=id,listing_id,buyer_id,instructor_id,created_at,updated_at&limit=1',
        {},
        session.access_token
      )) as Conversation[];

      if (existing[0]) {
        setConversation(existing[0]);
        return;
      }

      const created = (await marketApi(
        '/rest/v1/conversations',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            listing_id: listing.id,
            buyer_id: session.user.id,
            instructor_id: listing.instructor_id,
          }),
        },
        session.access_token
      )) as Conversation[];
      setConversation(created[0]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="button secondary small" disabled={busy} onClick={() => void open()}>
        💬 Tanya
      </button>
      {session && conversation && (
        <ChatWindow
          session={session}
          conversation={conversation}
          title={listing.display_name}
          onClose={() => setConversation(null)}
        />
      )}
    </>
  );
}

export function ChatInbox({
  session,
  listings,
  role,
}: {
  session: MarketplaceSession;
  listings: MarketplaceListing[];
  role: string;
}) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);

  async function load() {
    const data = (await marketApi(
      '/rest/v1/conversations?select=id,listing_id,buyer_id,instructor_id,created_at,updated_at&order=updated_at.desc',
      {},
      session.access_token
    )) as Conversation[];
    setItems(data);
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, [session.access_token]);

  if (items.length === 0) return null;

  const titleFor = (conversation: Conversation) => {
    const listing = listings.find(item => item.id === conversation.listing_id);
    if (role === 'instructor') return 'Calon murid · ' + (listing?.title || 'Layanan');
    return listing?.display_name || 'Pengajar GuruLes';
  };

  return (
    <div className="market-feature-panel">
      <div className="feature-head">
        <div>
          <span className="eyebrow">Chat</span>
          <h3>Percakapan GuruLes</h3>
        </div>
        <span className="result-count">{items.length} percakapan</span>
      </div>
      <div className="inbox-list">
        {items.slice(0, 8).map(item => (
          <button className="inbox-item" key={item.id} onClick={() => setActive(item)}>
            <span>💬</span>
            <div>
              <strong>{titleFor(item)}</strong>
              <small>
                {new Date(item.updated_at).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </small>
            </div>
            <b>›</b>
          </button>
        ))}
      </div>
      {active && (
        <ChatWindow
          session={session}
          conversation={active}
          title={titleFor(active)}
          onClose={() => {
            setActive(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

export function BookingTimeline({
  booking,
}: {
  booking: MarketplaceBooking;
}) {
  const labels = [
    'Menunggu',
    'Diterima',
    'Bayar',
    'Dibayar',
    'Berlangsung',
    'Selesai',
  ];

  let current = 0;
  if (booking.status === 'accepted') current = 2;
  if (booking.status === 'paid') {
    current =
      new Date(booking.scheduled_at).getTime() <= Date.now() ? 4 : 3;
  }
  if (booking.status === 'in_progress') current = 4;
  if (booking.status === 'completed') current = 5;

  if (booking.status === 'rejected' || booking.status === 'cancelled') {
    return (
      <div className="booking-timeline cancelled">
        Pesanan {booking.status === 'rejected' ? 'ditolak' : 'dibatalkan'}.
      </div>
    );
  }

  return (
    <div className="booking-timeline">
      {labels.map((label, index) => (
        <div
          key={label}
          className={
            'timeline-step ' +
            (index < current ? 'done' : index === current ? 'active' : '')
          }
        >
          <span>{index < current ? '✓' : index + 1}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

export function ReviewForm({
  session,
  booking,
  onReviewed,
}: {
  session: MarketplaceSession;
  booking: MarketplaceBooking;
  onReviewed?: () => void | Promise<void>;
}) {
  const [existing, setExisting] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const isBuyer = booking.buyer_id === session.user.id;

  useEffect(() => {
    if (booking.status !== 'completed' || !isBuyer) return;
    void marketApi(
      '/rest/v1/reviews?booking_id=eq.' +
        encodeURIComponent(booking.id) +
        '&select=id&limit=1',
      {},
      session.access_token
    )
      .then(data => setExisting(Boolean((data as any[])[0])))
      .catch(() => undefined);
  }, [booking.id, booking.status, isBuyer, session.access_token]);

  if (booking.status !== 'completed' || !isBuyer) return null;

  if (existing) {
    return <small className="review-done">⭐ Ulasan sudah diberikan.</small>;
  }

  async function submit() {
    setBusy(true);
    try {
      await marketApi(
        '/rest/v1/reviews',
        {
          method: 'POST',
          body: JSON.stringify({
            booking_id: booking.id,
            buyer_id: booking.buyer_id,
            instructor_id: booking.instructor_id,
            rating,
            comment: comment.trim(),
          }),
        },
        session.access_token
      );
      setExisting(true);
      await onReviewed?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-form">
      <strong>Beri ulasan</strong>
      <div className="rating-choice">
        {[1, 2, 3, 4, 5].map(value => (
          <button
            key={value}
            className={value <= rating ? 'active' : ''}
            onClick={() => setRating(value)}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        maxLength={500}
        value={comment}
        onChange={event => setComment(event.target.value)}
        placeholder="Bagaimana pengalaman belajar Anda?"
      />
      <button className="button primary small" disabled={busy} onClick={() => void submit()}>
        Kirim Ulasan
      </button>
    </div>
  );
}

export function FavoritesPanel({
  session,
  listings,
  onBook,
}: {
  session: MarketplaceSession;
  listings: MarketplaceListing[];
  onBook: (listing: MarketplaceListing) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const load = () => {
      void marketApi(
        '/rest/v1/favorites?select=listing_id&order=created_at.desc',
        {},
        session.access_token
      )
        .then(data =>
          setIds((data as Array<{ listing_id: string }>).map(item => item.listing_id))
        )
        .catch(() => undefined);
    };

    load();
    window.addEventListener('gurules:favorites-changed', load);
    return () => window.removeEventListener('gurules:favorites-changed', load);
  }, [session.access_token]);

  const favorites = listings.filter(item => ids.includes(item.id));
  if (favorites.length === 0) return null;

  return (
    <div className="market-feature-panel">
      <div className="feature-head">
        <div>
          <span className="eyebrow">Favorit Saya</span>
          <h3>Pengajar tersimpan</h3>
        </div>
        <span className="result-count">{favorites.length}</span>
      </div>
      <div className="favorite-list">
        {favorites.map(item => (
          <div className="favorite-list-item" key={item.id}>
            <div>
              <strong>{item.display_name}</strong>
              <small>{item.title}</small>
            </div>
            <button className="button primary small" onClick={() => onBook(item)}>
              Pesan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BusinessDashboard({
  session,
  role,
  bookings,
  rating,
  totalUsers = 0,
  totalInstructors = 0,
}: {
  session: MarketplaceSession;
  role: 'admin' | 'instructor';
  bookings: MarketplaceBooking[];
  rating?: number;
  totalUsers?: number;
  totalInstructors?: number;
}) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  useEffect(() => {
    void marketApi(
      '/rest/v1/payments?select=booking_id,gross_amount,platform_fee,instructor_net,payment_status,payout_status,submitted_at&order=created_at.desc',
      {},
      session.access_token
    )
      .then(data => setPayments(data as PaymentRow[]))
      .catch(() => setPayments([]));
  }, [session.access_token, bookings]);

  const gross = payments
    .filter(item => item.payment_status === 'paid')
    .reduce((sum, item) => sum + item.gross_amount, 0);
  const fees = payments
    .filter(item => item.payment_status === 'paid')
    .reduce((sum, item) => sum + item.platform_fee, 0);
  const net = payments
    .filter(item => item.payment_status === 'paid')
    .reduce((sum, item) => sum + item.instructor_net, 0);
  const pendingPayment = payments.filter(
    item => item.payment_status === 'pending' && item.submitted_at
  ).length;
  const payoutReady = payments.filter(item => item.payout_status === 'eligible').length;
  const completed = bookings.filter(item => item.status === 'completed').length;

  const cards =
    role === 'admin'
      ? [
          ['GMV', rupiah(gross)],
          ['Fee Platform', rupiah(fees)],
          ['Pengguna', String(totalUsers)],
          ['Pengajar', String(totalInstructors)],
          ['Verifikasi Bayar', String(pendingPayment)],
          ['Pencairan', String(payoutReady)],
        ]
      : [
          ['Booking', String(bookings.length)],
          ['Selesai', String(completed)],
          ['Pendapatan Bruto', rupiah(gross)],
          ['Fee GuruLes', rupiah(fees)],
          ['Pendapatan Bersih', rupiah(net)],
          ['Rating', rating ? '⭐ ' + rating.toFixed(1) : 'Belum ada'],
        ];

  return (
    <div className="business-dashboard">
      <div className="feature-head">
        <div>
          <span className="eyebrow">Ringkasan Bisnis</span>
          <h3>{role === 'admin' ? 'Kinerja Marketplace' : 'Kinerja Pengajar'}</h3>
        </div>
      </div>
      <div className="business-metrics">
        {cards.map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
