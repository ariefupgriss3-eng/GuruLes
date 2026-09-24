import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob, toPng } from 'html-to-image';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';
const BUCKET = 'gurules-banners';
const TARGET_WIDTH = 1536;

type SessionLike = {
  access_token: string;
  user: { id: string };
};

type PremiumListing = {
  id: string;
  instructor_id: string;
  display_name: string;
  title: string;
  category: string;
  village: string | null;
  district: string | null;
  regency: string | null;
  province: string | null;
  service_methods: string[];
  price_per_session: number;
  years_experience: number;
  avatar_url: string | null;
  tagline: string;
  profile_banner_url?: string | null;
  profile_banner_id?: string | null;
  profile_banner_template?: string | null;
  auto_profile_banner_enabled?: boolean;
};

type BannerRow = {
  id: string;
  instructor_id: string;
  listing_id: string | null;
  template_key: string;
  banner_type: string;
  theme_key: string;
  full_name: string;
  degree_text: string;
  service_title: string;
  category_text: string;
  level_text: string;
  location_text: string;
  whatsapp_text: string;
  price_text: string;
  tagline: string;
  strength_1: string;
  strength_2: string;
  strength_3: string;
  benefit_1: string;
  benefit_2: string;
  benefit_3: string;
  service_item_1: string;
  service_item_2: string;
  service_item_3: string;
  service_item_4: string;
  service_item_5: string;
  quote_left: string;
  quote_top: string;
  quote_right: string;
  promo_badge_text: string;
  show_promo_badge: boolean;
  photo_url: string | null;
  generated_banner_url: string | null;
  is_active_profile_banner: boolean;
  created_at: string;
  updated_at: string;
};

type BannerForm = {
  full_name: string;
  degree_text: string;
  service_title: string;
  category_text: string;
  level_text: string;
  location_text: string;
  whatsapp_text: string;
  price_text: string;
  tagline: string;
  strength_1: string;
  strength_2: string;
  strength_3: string;
  benefit_1: string;
  benefit_2: string;
  benefit_3: string;
  service_item_1: string;
  service_item_2: string;
  service_item_3: string;
  service_item_4: string;
  service_item_5: string;
  quote_left: string;
  quote_top: string;
  quote_right: string;
  promo_badge_text: string;
  show_promo_badge: boolean;
};

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function apiHeaders(token?: string) {
  const headers = new Headers();
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);
  return headers;
}

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers = apiHeaders(token);
  new Headers(options.headers || {}).forEach((value, key) => headers.set(key, value));
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

function publicStorageUrl(path: string) {
  return SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
}

function extensionFor(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

async function uploadObject(
  path: string,
  body: Blob,
  contentType: string,
  token: string,
  upsert = false
) {
  const response = await fetch(
    SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + path,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': contentType,
        'x-upsert': String(upsert),
        'cache-control': '3600',
      },
      body,
    }
  );
  if (!response.ok) {
    let message = 'File banner belum dapat disimpan.';
    try {
      const data = await response.json();
      message = data.message || data.error || message;
    } catch {
      // Pesan default.
    }
    throw new Error(message);
  }
  return publicStorageUrl(path);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Foto tidak dapat dibaca.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

async function imageUrlToDataUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:')) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Foto upload tidak dapat dibaca.');
    return blobToDataUrl(await response.blob());
  }
  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new Error(
      'Foto profil tidak dapat diproses. Silakan upload ulang foto langsung di Banner Profil.'
    );
  }
  return blobToDataUrl(await response.blob());
}

async function waitForImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('Foto terlalu lama dimuat. Silakan upload ulang foto.')),
      8000
    );
    image.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Foto gagal dimuat. Silakan upload ulang foto.'));
    };
  });
}

function initialForm(listing: PremiumListing, phone?: string | null): BannerForm {
  const location = [listing.village, listing.district, listing.regency, listing.province]
    .filter(Boolean)
    .join(', ');
  return {
    full_name: listing.display_name || '',
    degree_text: '',
    service_title: listing.title || 'Pengajar Privat',
    category_text: listing.category || 'Pendidikan',
    level_text: '',
    location_text: location,
    whatsapp_text: phone || '',
    price_text: listing.price_per_session ? rupiah(listing.price_per_session) + '/sesi' : '',
    tagline: listing.tagline || 'Belajar dengan sabar, terarah, dan menyenangkan.',
    strength_1: 'Sabar',
    strength_2: 'Terarah',
    strength_3: 'Menyenangkan',
    benefit_1: 'Dasar yang kuat',
    benefit_2: 'Prestasi lebih baik',
    benefit_3: 'Lebih percaya diri',
    service_item_1: 'Membaca',
    service_item_2: 'Menulis',
    service_item_3: 'Berpikir',
    service_item_4: 'Karakter',
    service_item_5: 'Meraih mimpi',
    quote_left: 'Anak hebat berawal dari bimbingan yang tepat.',
    quote_top: 'Pendidikan membuka lebih banyak kemungkinan.',
    quote_right: 'Bersama tumbuh menuju masa depan cerah.',
    promo_badge_text: 'Konsultasi Gratis',
    show_promo_badge: true,
  };
}

function formFromRow(row: BannerRow): BannerForm {
  return {
    full_name: row.full_name,
    degree_text: row.degree_text,
    service_title: row.service_title,
    category_text: row.category_text,
    level_text: row.level_text,
    location_text: row.location_text,
    whatsapp_text: row.whatsapp_text,
    price_text: row.price_text,
    tagline: row.tagline,
    strength_1: row.strength_1,
    strength_2: row.strength_2,
    strength_3: row.strength_3,
    benefit_1: row.benefit_1,
    benefit_2: row.benefit_2,
    benefit_3: row.benefit_3,
    service_item_1: row.service_item_1,
    service_item_2: row.service_item_2,
    service_item_3: row.service_item_3,
    service_item_4: row.service_item_4,
    service_item_5: row.service_item_5,
    quote_left: row.quote_left,
    quote_top: row.quote_top,
    quote_right: row.quote_right,
    promo_badge_text: row.promo_badge_text,
    show_promo_badge: row.show_promo_badge,
  };
}

function validateForm(form: BannerForm, photoUrl: string) {
  if (!photoUrl) return 'Upload foto atau gunakan foto profil terlebih dahulu.';
  if (!form.full_name.trim()) return 'Nama pengajar wajib diisi.';
  if (!form.service_title.trim()) return 'Judul layanan wajib diisi.';
  if (!form.tagline.trim()) return 'Tagline wajib diisi.';
  if (![form.strength_1, form.strength_2, form.strength_3].some(v => v.trim())) {
    return 'Isi minimal satu keunggulan.';
  }
  if (![form.benefit_1, form.benefit_2, form.benefit_3].some(v => v.trim())) {
    return 'Isi minimal satu manfaat.';
  }
  const limits: Array<[keyof BannerForm, number, string]> = [
    ['full_name', 100, 'Nama'],
    ['degree_text', 100, 'Gelar'],
    ['service_title', 120, 'Judul layanan'],
    ['tagline', 220, 'Tagline'],
    ['strength_1', 40, 'Keunggulan'],
    ['strength_2', 40, 'Keunggulan'],
    ['strength_3', 40, 'Keunggulan'],
    ['benefit_1', 60, 'Manfaat'],
    ['benefit_2', 60, 'Manfaat'],
    ['benefit_3', 60, 'Manfaat'],
    ['promo_badge_text', 60, 'Promo'],
  ];
  for (const [key, max, label] of limits) {
    if (String(form[key]).length > max) return label + ' terlalu panjang (maks. ' + max + ' karakter).';
  }
  return '';
}

export function ProfileHeroBanner({
  url,
  name,
}: {
  url: string;
  name: string;
}) {
  return (
    <div className="profile-hero-banner">
      <img src={url} alt={'Banner profil premium ' + name} loading="lazy" />
    </div>
  );
}

export function ProfileBannerStudio({
  session,
  listing,
  phone,
  onListingChanged,
  embedded = false,
  autoSaveSignal = 0,
  onAutoSaveComplete,
  onAutoEnabledChanged,
}: {
  session: SessionLike;
  listing: PremiumListing;
  phone?: string | null;
  onListingChanged?: () => void | Promise<void>;
  embedded?: boolean;
  autoSaveSignal?: number;
  onAutoSaveComplete?: (ok: boolean, message: string) => void;
  onAutoEnabledChanged?: (enabled: boolean) => void | Promise<void>;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const profilePhoto = listing.avatar_url || '';
  const draftKey = 'gurules_profile_banner_draft_' + session.user.id;
  const [form, setForm] = useState<BannerForm>(() => initialForm(listing, phone));
  const [photoUrl, setPhotoUrl] = useState(profilePhoto);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoObjectUrl, setPhotoObjectUrl] = useState('');
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [editingId, setEditingId] = useState('');
  const [savedBannerId, setSavedBannerId] = useState(listing.profile_banner_id || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [autoEnabled, setAutoEnabled] = useState(
    listing.auto_profile_banner_enabled !== false
  );
  const hydratedExistingRef = useRef(false);
  const lastAutoSaveSignalRef = useRef(0);

  const caption = useMemo(() => {
    const strengths = [form.strength_1, form.strength_2, form.strength_3]
      .filter(Boolean)
      .join(' · ');
    return [
      '🎓 ' + form.service_title,
      '',
      'Belajar bersama ' + form.full_name + (form.degree_text ? ', ' + form.degree_text : ''),
      strengths ? '✨ ' + strengths : '',
      form.location_text ? '📍 ' + form.location_text : '',
      form.price_text ? '💰 Mulai ' + form.price_text : '',
      form.whatsapp_text ? '📱 WhatsApp: ' + form.whatsapp_text : '',
      '',
      form.tagline,
      '',
      'Pesan melalui GuruLes',
      'Guru tepat, belajar lebih cepat.',
      'Arieftoteles Production',
    ].filter(Boolean).join('\n');
  }, [form]);

  useEffect(() => {
    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) setForm(current => ({ ...current, ...JSON.parse(draft) }));
    } catch {
      // Abaikan draft rusak.
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(form));
  }, [draftKey, form]);

  useEffect(() => {
    setAutoEnabled(listing.auto_profile_banner_enabled !== false);
  }, [listing.auto_profile_banner_enabled]);



  useEffect(() => {
    void ensureStorage().catch(() => undefined);
    void loadRows().catch(() => setRows([]));
  }, [session.access_token, listing.id]);

  useEffect(() => {
    return () => {
      if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    };
  }, [photoObjectUrl]);

  function field<K extends keyof BannerForm>(key: K, value: BannerForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setMessage('');
  }

  async function ensureStorage() {
    await api(
      '/functions/v1/profile-banner-action',
      { method: 'POST', body: JSON.stringify({ action: 'ensure_storage' }) },
      session.access_token
    );
  }

  async function updateAutoEnabled(enabled: boolean) {
    const previous = autoEnabled;
    setAutoEnabled(enabled);
    setMessage('');
    try {
      await api(
        '/rest/v1/instructor_listings?id=eq.' + encodeURIComponent(listing.id),
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ auto_profile_banner_enabled: enabled }),
        },
        session.access_token
      );
      await onAutoEnabledChanged?.(enabled);
      setMessage(
        enabled
          ? 'Banner Otomatis aktif. Saat Profil disimpan, banner ikut diperbarui.'
          : 'Banner Otomatis dinonaktifkan. Profil tetap dapat disimpan tanpa mengubah banner.'
      );
    } catch (error) {
      setAutoEnabled(previous);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Pengaturan Banner Otomatis belum dapat disimpan.'
      );
    }
  }

  async function loadRows() {
    const data = await api(
      '/rest/v1/instructor_profile_banners?listing_id=eq.' +
        encodeURIComponent(listing.id) +
        '&select=*&order=created_at.desc',
      {},
      session.access_token
    );
    const list = data as BannerRow[];
    setRows(list);
    const active = list.find(row => row.is_active_profile_banner);
    if (active) {
      setSavedBannerId(active.id);
      setEditingId(active.id);
      if (!hydratedExistingRef.current) {
        const hasLocalDraft = Boolean(localStorage.getItem(draftKey));
        if (!hasLocalDraft) setForm(formFromRow(active));
        setPhotoUrl(active.photo_url || profilePhoto);
        hydratedExistingRef.current = true;
      }
    }
  }

  function useProfilePhoto() {
    if (!profilePhoto) {
      setMessage('Foto profil belum tersedia. Upload foto baru untuk banner premium.');
      return;
    }
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    setPhotoFile(null);
    setPhotoObjectUrl('');
    setPhotoUrl(profilePhoto);
    setMessage('Foto profil digunakan untuk banner.');
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Gunakan foto JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage('Ukuran foto maksimal 8 MB.');
      return;
    }
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    const url = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoObjectUrl(url);
    setPhotoUrl(url);
    setMessage('Foto baru siap digunakan.');
  }

  async function render<T>(
    renderer: (
      node: HTMLDivElement,
      options: {
        cacheBust: boolean;
        pixelRatio: number;
        backgroundColor: string;
        imagePlaceholder: string;
        skipFonts: boolean;
      }
    ) => Promise<T>
  ) {
    const node = previewRef.current;
    if (!node) throw new Error('Preview Banner Profil belum tersedia.');
    const image = node.querySelector('.premium-photo img') as HTMLImageElement | null;
    const originalSrc = image?.getAttribute('src') || '';

    try {
      if (image && originalSrc) {
        const safePhoto = await imageUrlToDataUrl(originalSrc);
        image.src = safePhoto || TRANSPARENT_PIXEL;
        await waitForImage(image);
      }
      const ratio = Math.min(3, TARGET_WIDTH / Math.max(node.offsetWidth, 1));
      return await renderer(node, {
        cacheBust: true,
        pixelRatio: ratio,
        backgroundColor: '#f8f6ec',
        imagePlaceholder: TRANSPARENT_PIXEL,
        skipFonts: true,
      });
    } finally {
      if (image && originalSrc) image.src = originalSrc;
    }
  }

  async function downloadPng() {
    const error = validateForm(form, photoUrl);
    if (error) {
      setMessage(error);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const dataUrl = await render((node, options) => toPng(node, options));
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'gurules-banner-premium-' + Date.now() + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage('Banner Premium PNG berhasil dibuat.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Banner belum dapat dibuat.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadSourcePhoto(fallbackPhotoUrl = photoUrl) {
    if (!photoFile) return fallbackPhotoUrl;
    const path =
      'instructors/' +
      session.user.id +
      '/source-photos/profile-banner-' +
      Date.now() +
      '.' +
      extensionFor(photoFile);
    return await uploadObject(path, photoFile, photoFile.type, session.access_token, false);
  }

  function rowPayload(sourcePhotoUrl: string, formValue: BannerForm = form) {
    return {
      instructor_id: session.user.id,
      listing_id: listing.id,
      template_key: 'premium_edu_green',
      banner_type: 'profile_hero',
      theme_key: 'green_gold',
      ...formValue,
      photo_url: sourcePhotoUrl || null,
      updated_at: new Date().toISOString(),
    };
  }

  async function saveBanner(
    formValue: BannerForm = form,
    photoValue: string = photoUrl
  ) {
    const error = validateForm(formValue, photoValue);
    if (error) {
      setMessage(error);
      return null;
    }

    setBusy(true);
    setMessage('');
    try {
      await ensureStorage();
      const sourcePhotoUrl = await uploadSourcePhoto(photoValue);
      const blob = await render((node, options) => toBlob(node, options));
      if (!blob) throw new Error('File PNG banner belum dapat dibuat.');

      const bannerId = editingId || crypto.randomUUID();
      const bannerPath =
        'instructors/' +
        session.user.id +
        '/profile-banners/profile-banner-' +
        bannerId +
        '.png';

      const bannerUrl = await uploadObject(
        bannerPath,
        blob,
        'image/png',
        session.access_token,
        Boolean(editingId)
      );

      const payload = {
        id: bannerId,
        ...rowPayload(sourcePhotoUrl, formValue),
        generated_banner_url: bannerUrl,
      };

      if (editingId) {
        await api(
          '/rest/v1/instructor_profile_banners?id=eq.' + encodeURIComponent(bannerId),
          {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(payload),
          },
          session.access_token
        );
      } else {
        await api(
          '/rest/v1/instructor_profile_banners',
          {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(payload),
          },
          session.access_token
        );
      }

      setEditingId(bannerId);
      setSavedBannerId(bannerId);
      setPhotoUrl(sourcePhotoUrl || photoValue);
      setPhotoFile(null);
      setMessage('Banner premium berhasil disimpan.');
      await loadRows();
      return bannerId;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Banner premium belum dapat disimpan.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function activateBanner(id?: string) {
    let bannerId = id || savedBannerId || editingId;
    if (!bannerId) {
      const saved = await saveBanner();
      if (!saved) return;
      bannerId = saved;
    }

    setBusy(true);
    setMessage('');
    try {
      const result = await api(
        '/functions/v1/profile-banner-action',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'activate', banner_id: bannerId }),
        },
        session.access_token
      );
      setSavedBannerId(bannerId);
      setMessage(result.message || 'Banner profil premium berhasil dipasang.');
      await loadRows();
      await onListingChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Banner profil belum dapat dipasang.');
    } finally {
      setBusy(false);
    }
  }

  async function deactivateBanner(id: string) {
    setBusy(true);
    try {
      const result = await api(
        '/functions/v1/profile-banner-action',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'deactivate', banner_id: id }),
        },
        session.access_token
      );
      setMessage(result.message || 'Banner profil dinonaktifkan.');
      await loadRows();
      await onListingChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Banner belum dapat dinonaktifkan.');
    } finally {
      setBusy(false);
    }
  }

  function editRow(row: BannerRow) {
    setEditingId(row.id);
    setSavedBannerId(row.id);
    setForm(formFromRow(row));
    setPhotoFile(null);
    setPhotoUrl(row.photo_url || profilePhoto);
    setMessage('Banner lama dimuat untuk diedit.');
    window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  }

  async function saveAndActivateCurrent(
    formValue: BannerForm = form,
    photoValue: string = photoUrl,
    autoMode = false
  ) {
    const saved = await saveBanner(formValue, photoValue);
    if (!saved) {
      if (autoMode) onAutoSaveComplete?.(false, 'Profil tersimpan, tetapi banner otomatis belum dapat diperbarui.');
      return false;
    }
    try {
      await activateBanner(saved);
      const successMessage = autoMode
        ? 'Profil dan banner otomatis berhasil diperbarui.'
        : 'Banner otomatis berhasil diperbarui dan dipasang di profil.';
      setMessage(successMessage);
      if (autoMode) onAutoSaveComplete?.(true, successMessage);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Banner belum dapat diaktifkan.';
      if (autoMode) onAutoSaveComplete?.(false, errorMessage);
      return false;
    }
  }

  useEffect(() => {
    if (!embedded || !autoEnabled || autoSaveSignal <= 0) return;
    if (autoSaveSignal === lastAutoSaveSignalRef.current) return;
    lastAutoSaveSignalRef.current = autoSaveSignal;

    const syncedForm: BannerForm = {
      ...form,
      full_name: listing.display_name || form.full_name,
      service_title: listing.title || form.service_title,
      category_text: listing.category || form.category_text,
      location_text:
        [listing.village, listing.district, listing.regency, listing.province]
          .filter(Boolean)
          .join(', ') || form.location_text,
      price_text: listing.price_per_session
        ? rupiah(listing.price_per_session) + '/sesi'
        : form.price_text,
      tagline: listing.tagline || form.tagline,
      whatsapp_text: phone || form.whatsapp_text,
    };
    const syncedPhoto = photoFile ? photoUrl : (listing.avatar_url || photoUrl);

    setForm(syncedForm);
    setPhotoUrl(syncedPhoto);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        void saveAndActivateCurrent(syncedForm, syncedPhoto, true);
      });
    });
  }, [autoSaveSignal]);

  async function shareBanner() {
    const error = validateForm(form, photoUrl);
    if (error) {
      setMessage(error);
      return;
    }
    setBusy(true);
    try {
      const blob = await render((node, options) => toBlob(node, options));
      if (!blob) throw new Error('File banner belum dapat dibuat.');
      const file = new File([blob], 'gurules-banner-premium.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Banner Profil GuruLes', text: caption, files: [file] });
        setMessage('Banner siap dibagikan.');
      } else {
        await navigator.clipboard.writeText(caption);
        setMessage('Share file belum didukung. Caption sudah disalin.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage(error instanceof Error ? error.message : 'Banner belum dapat dibagikan.');
    } finally {
      setBusy(false);
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setMessage('Caption promosi sudah disalin.');
    } catch {
      setMessage('Caption belum dapat disalin pada perangkat ini.');
    }
  }

  return (
    <section className={'premium-banner-studio' + (embedded ? ' embedded' : '')}>
      <div className="premium-studio-head">
        <div>
          <span className="eyebrow">✨ {embedded ? 'Banner Otomatis Profil' : 'Banner Profil Premium'}</span>
          <h3>{embedded ? 'Banner otomatis menyatu dengan Profil' : 'Premium Edu Green'}</h3>
          <p>
            {embedded
              ? 'Lengkapi foto dan data profil Anda. GuruLes akan membuat banner premium otomatis untuk profil publik Anda.'
              : 'Buat header profesional dari foto dan data Anda, lalu pasang langsung pada profil publik GuruLes.'}
          </p>
        </div>
        <div className="premium-head-controls">
          {listing.profile_banner_url ? (
            <span className="premium-active-badge">✓ Banner Aktif di Profil</span>
          ) : (
            <span className="premium-template-badge">PREMIUM EDU GREEN</span>
          )}
          {embedded && (
            <label className="premium-auto-toggle">
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={event => void updateAutoEnabled(event.target.checked)}
              />
              <span>Aktifkan Banner Otomatis di Profil Publik</span>
            </label>
          )}
        </div>
      </div>

      <div className="premium-studio-grid">
        <form className="premium-form" onSubmit={(event: FormEvent) => event.preventDefault()}>
          <div className="premium-section">
            <strong>1. Foto Pengajar</strong>
            <div className="premium-photo-actions">
              <button type="button" className="button secondary small" onClick={useProfilePhoto}>
                Gunakan Foto Profil
              </button>
              <label className="premium-file-button">
                Upload Foto Baru
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
              </label>
            </div>
            <small>JPG / PNG / WebP · maksimal 8 MB. Foto potret dengan wajah jelas memberi hasil terbaik.</small>
          </div>

          <div className="premium-section">
            <strong>2. Identitas & Layanan</strong>
            <div className="premium-fields">
              <label>Nama lengkap<input maxLength={100} value={form.full_name} onChange={e => field('full_name', e.target.value)} /></label>
              <label>Gelar<input maxLength={100} value={form.degree_text} onChange={e => field('degree_text', e.target.value)} placeholder="S.Pd., M.Pd." /></label>
              <label className="wide">Judul layanan<input maxLength={120} value={form.service_title} onChange={e => field('service_title', e.target.value)} /></label>
              <label>Bidang ajar<input maxLength={80} value={form.category_text} onChange={e => field('category_text', e.target.value)} /></label>
              <label>Jenjang / target siswa<input maxLength={80} value={form.level_text} onChange={e => field('level_text', e.target.value)} placeholder="Contoh: Kelas 1–6 SD" /></label>
              <label className="wide">Tagline<textarea maxLength={220} rows={3} value={form.tagline} onChange={e => field('tagline', e.target.value)} /></label>
              <label className="wide">Lokasi layanan<input maxLength={180} value={form.location_text} onChange={e => field('location_text', e.target.value)} /></label>
              <label>WhatsApp<input maxLength={40} value={form.whatsapp_text} onChange={e => field('whatsapp_text', e.target.value)} /></label>
              <label>Tarif / info harga<input maxLength={80} value={form.price_text} onChange={e => field('price_text', e.target.value)} /></label>
            </div>
          </div>

          <div className="premium-section">
            <strong>3. Keunggulan & Manfaat</strong>
            <div className="premium-fields three">
              {(['strength_1','strength_2','strength_3'] as const).map((key, index) => (
                <label key={key}>Keunggulan {index + 1}<input maxLength={40} value={form[key]} onChange={e => field(key, e.target.value)} /></label>
              ))}
              {(['benefit_1','benefit_2','benefit_3'] as const).map((key, index) => (
                <label key={key}>Manfaat {index + 1}<input maxLength={60} value={form[key]} onChange={e => field(key, e.target.value)} /></label>
              ))}
            </div>
          </div>

          <div className="premium-section">
            <strong>4. Isi Visual Banner</strong>
            <div className="premium-fields">
              {(['service_item_1','service_item_2','service_item_3','service_item_4','service_item_5'] as const).map((key, index) => (
                <label key={key}>Layanan {index + 1}<input maxLength={50} value={form[key]} onChange={e => field(key, e.target.value)} /></label>
              ))}
              <label className="wide">Motivasi kiri<input maxLength={120} value={form.quote_left} onChange={e => field('quote_left', e.target.value)} /></label>
              <label className="wide">Motivasi atas<input maxLength={120} value={form.quote_top} onChange={e => field('quote_top', e.target.value)} /></label>
              <label className="wide">Motivasi kanan<input maxLength={120} value={form.quote_right} onChange={e => field('quote_right', e.target.value)} /></label>
              <label className="premium-check wide">
                <input type="checkbox" checked={form.show_promo_badge} onChange={e => field('show_promo_badge', e.target.checked)} />
                Tampilkan badge promo
              </label>
              {form.show_promo_badge && (
                <label className="wide">Teks promo<input maxLength={60} value={form.promo_badge_text} onChange={e => field('promo_badge_text', e.target.value)} /></label>
              )}
            </div>
          </div>

          <div className="premium-actions">
            <button type="button" className="button secondary" disabled={busy} onClick={() => {
              localStorage.setItem(draftKey, JSON.stringify(form));
              setMessage('Draft teks banner tersimpan di perangkat.');
            }}>Simpan Draft</button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => void downloadPng()}>⬇️ Download PNG</button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => void shareBanner()}>📤 Bagikan</button>
            <button type="button" className="button secondary" onClick={() => void copyCaption()}>📋 Salin Caption</button>
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void saveAndActivateCurrent()}
            >
              {busy ? 'Memproses...' : embedded ? 'Perbarui Banner Sekarang' : 'Simpan & Pasang Banner'}
            </button>
            {!embedded && (
              <button type="button" className="button premium-activate" disabled={busy} onClick={() => void activateBanner()}>
                {listing.profile_banner_url ? 'Ganti Banner Profil' : 'Jadikan Banner Profil'}
              </button>
            )}
          </div>
          {message && <div className="form-success">{message}</div>}
        </form>

        <div className="premium-preview-wrap">
          <div className="premium-preview-head">
            <span>Preview Profile Hero</span>
            <small>Target 1536 × 691</small>
          </div>
          <div ref={previewRef} className="premium-edu-green">
            <div className="premium-wave premium-wave-one" />
            <div className="premium-wave premium-wave-two" />
            <div className="premium-board-note">{form.quote_left}</div>
            <div className="premium-top-note">{form.quote_top}</div>

            <div className="premium-photo">
              {photoUrl ? <img src={photoUrl} alt="Foto pengajar" /> : <div>Upload Foto</div>}
            </div>

            <div className="premium-center">
              <div className="premium-brand">
                <span>🎓</span>
                <b>GuruLes</b>
              </div>
              <h2>{form.full_name || 'Nama Pengajar'}</h2>
              {form.degree_text && <div className="premium-degree">{form.degree_text}</div>}
              <div className="premium-service-title">🎓 {form.service_title || 'Pengajar Privat'}</div>

              <div className="premium-strengths">
                <span>♥ {form.strength_1 || 'Sabar'}</span>
                <span>🎯 {form.strength_2 || 'Terarah'}</span>
                <span>👥 {form.strength_3 || 'Menyenangkan'}</span>
              </div>

              <blockquote>“{form.tagline || 'Belajar lebih terarah dan menyenangkan.'}”</blockquote>

              <div className="premium-benefits">
                <div><b>▣</b><span>{form.benefit_1 || 'Dasar yang kuat'}</span></div>
                <div><b>↗</b><span>{form.benefit_2 || 'Prestasi lebih baik'}</span></div>
                <div><b>🌱</b><span>{form.benefit_3 || 'Lebih percaya diri'}</span></div>
              </div>

              <div className="premium-contact-line">
                {form.location_text && <span>📍 {form.location_text}</span>}
                {form.price_text && <span>💰 {form.price_text}</span>}
                {form.whatsapp_text && <span>📱 {form.whatsapp_text}</span>}
              </div>
            </div>

            <div className="premium-right">
              <div className="premium-right-quote">{form.quote_right}</div>
              <div className="premium-book-stack">
                {[form.service_item_1, form.service_item_2, form.service_item_3, form.service_item_4, form.service_item_5]
                  .filter(Boolean)
                  .map((item, index) => <span key={index}>{item}</span>)}
              </div>
              {form.show_promo_badge && (
                <div className="premium-promo-seal">
                  <small>PROMO</small>
                  <strong>{form.promo_badge_text || 'Konsultasi Gratis'}</strong>
                </div>
              )}
            </div>

            <div className="premium-footer">
              <span><b>GuruLes</b> · Guru tepat, belajar lebih cepat.</span>
              <strong>Arieftoteles Production</strong>
            </div>
          </div>

          {!embedded && (
          <div className="premium-saved">
            <div className="premium-saved-head">
              <strong>Banner tersimpan</strong>
              <span>{rows.length} banner</span>
            </div>
            {rows.length === 0 ? (
              <div className="muted-note">Belum ada Banner Profil Premium tersimpan.</div>
            ) : (
              <div className="premium-saved-list">
                {rows.map(row => (
                  <article key={row.id} className={row.is_active_profile_banner ? 'active' : ''}>
                    {row.generated_banner_url ? (
                      <img src={row.generated_banner_url} alt={'Banner ' + row.full_name} />
                    ) : (
                      <div className="premium-saved-placeholder">Belum dirender</div>
                    )}
                    <div>
                      <strong>{row.service_title || row.full_name}</strong>
                      <small>{new Date(row.updated_at || row.created_at).toLocaleString('id-ID')}</small>
                      {row.is_active_profile_banner && <span>✓ Aktif di profil</span>}
                    </div>
                    <div className="premium-saved-actions">
                      <button type="button" className="text-button" onClick={() => editRow(row)}>Edit</button>
                      {!row.is_active_profile_banner && row.generated_banner_url && (
                        <button type="button" className="text-button" onClick={() => void activateBanner(row.id)}>Jadikan Profil</button>
                      )}
                      {row.is_active_profile_banner && (
                        <button type="button" className="text-button danger-text" onClick={() => void deactivateBanner(row.id)}>Nonaktifkan</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </section>
  );
}


export function AdminProfileBannerPanel({ session }: { session: SessionLike }) {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const data = await api(
      '/rest/v1/instructor_profile_banners?select=*&order=updated_at.desc',
      {},
      session.access_token
    );
    setRows(data as BannerRow[]);
  }

  useEffect(() => {
    void load().catch(error => {
      setMessage(error instanceof Error ? error.message : 'Data banner belum dapat dimuat.');
    });
  }, [session.access_token]);

  return (
    <section className="premium-banner-admin">
      <div className="premium-studio-head">
        <div>
          <span className="eyebrow">🎨 Banner Profil Pengajar</span>
          <h3>Monitoring Banner Premium</h3>
          <p>Admin dapat melihat banner yang dibuat pengajar dan status banner yang aktif di profil publik.</p>
        </div>
        <button className="button secondary small" onClick={() => void load()}>Segarkan</button>
      </div>
      <div className="admin-growth-summary">
        <div><strong>{rows.length}</strong><span>Total banner</span></div>
        <div><strong>{rows.filter(row => row.is_active_profile_banner).length}</strong><span>Aktif di profil</span></div>
        <div><strong>{new Set(rows.map(row => row.instructor_id)).size}</strong><span>Pengajar membuat banner</span></div>
      </div>
      {rows.length === 0 ? (
        <div className="status-box">Belum ada Banner Profil Premium.</div>
      ) : (
        <div className="premium-admin-grid">
          {rows.map(row => (
            <article key={row.id}>
              {row.generated_banner_url ? (
                <img src={row.generated_banner_url} alt={'Banner ' + row.full_name} loading="lazy" />
              ) : (
                <div className="premium-saved-placeholder">Belum dirender</div>
              )}
              <div>
                <strong>{row.full_name}</strong>
                <span>{row.service_title}</span>
                <small>{row.template_key} · {new Date(row.updated_at).toLocaleString('id-ID')}</small>
                {row.is_active_profile_banner && <b>✓ Aktif di profil publik</b>}
              </div>
            </article>
          ))}
        </div>
      )}
      {message && <div className="form-error">{message}</div>}
    </section>
  );
}
