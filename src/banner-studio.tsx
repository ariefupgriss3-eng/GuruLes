import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toBlob, toPng } from 'html-to-image';

type BannerListing = {
  display_name: string;
  title: string;
  category: string;
  village: string | null;
  district: string | null;
  regency: string | null;
  province: string | null;
  service_methods: string[];
  price_per_session: number;
  avatar_url: string | null;
  tagline: string;
  years_experience: number;
};

type BannerSizeKey = 'square' | 'portrait' | 'story';
type TemplateKey = 'formal' | 'ceria' | 'sport' | 'premium';

const SIZE_MAP: Record<BannerSizeKey, { label: string; width: number; height: number }> = {
  square: { label: 'Feed 1:1', width: 1080, height: 1080 },
  portrait: { label: 'Flyer 4:5', width: 1080, height: 1350 },
  story: { label: 'Story 9:16', width: 1080, height: 1920 },
};

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'pengajar';
}

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

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

  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new Error('Foto profil tidak dapat diproses untuk ekspor.');
  }
  return await blobToDataUrl(await response.blob());
}

async function waitForImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('Foto terlalu lama dimuat.')),
      8000
    );
    image.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Foto gagal dimuat untuk ekspor.'));
    };
  });
}

export function InstructorBannerStudio({
  userId,
  listing,
  phone,
}: {
  userId: string;
  listing: BannerListing;
  phone?: string | null;
}) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [photoUrl, setPhotoUrl] = useState(listing.avatar_url || '');
  const [photoObjectUrl, setPhotoObjectUrl] = useState('');
  const [name, setName] = useState(listing.display_name || '');
  const [headline, setHeadline] = useState(listing.title || listing.category || '');
  const [levels, setLevels] = useState('');
  const [location, setLocation] = useState(
    [listing.village, listing.district, listing.regency, listing.province]
      .filter(Boolean)
      .join(', ')
  );
  const [methods, setMethods] = useState((listing.service_methods || []).join(' · '));
  const [price, setPrice] = useState(String(listing.price_per_session || ''));
  const [whatsapp, setWhatsapp] = useState(phone || '');
  const [tagline, setTagline] = useState(
    listing.tagline || 'Belajar lebih terarah, nyaman, dan percaya diri.'
  );
  const [promo, setPromo] = useState('');
  const [template, setTemplate] = useState<TemplateKey>('formal');
  const [sizeKey, setSizeKey] = useState<BannerSizeKey>('square');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const size = SIZE_MAP[sizeKey];
  const draftKey = 'gurules_banner_draft_' + userId;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft.name) setName(draft.name);
      if (draft.headline) setHeadline(draft.headline);
      if (draft.levels) setLevels(draft.levels);
      if (draft.location) setLocation(draft.location);
      if (draft.methods) setMethods(draft.methods);
      if (draft.price) setPrice(draft.price);
      if (draft.whatsapp) setWhatsapp(draft.whatsapp);
      if (draft.tagline) setTagline(draft.tagline);
      if (draft.promo) setPromo(draft.promo);
      if (draft.template) setTemplate(draft.template);
      if (draft.sizeKey) setSizeKey(draft.sizeKey);
    } catch {
      // Abaikan draft yang tidak valid.
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        name,
        headline,
        levels,
        location,
        methods,
        price,
        whatsapp,
        tagline,
        promo,
        template,
        sizeKey,
      })
    );
  }, [draftKey, name, headline, levels, location, methods, price, whatsapp, tagline, promo, template, sizeKey]);

  useEffect(() => {
    return () => {
      if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    };
  }, [photoObjectUrl]);

  const caption = useMemo(() => {
    const lines = [
      '🎓 ' + (headline || 'Layanan belajar privat'),
      name ? 'Bersama ' + name : '',
      levels ? 'Untuk: ' + levels : '',
      location ? '📍 ' + location : '',
      methods ? '🧭 ' + methods : '',
      Number(price) > 0 ? '💰 Mulai ' + rupiah(Number(price)) + '/sesi' : '',
      promo ? '🎁 ' + promo : '',
      whatsapp ? '📱 WhatsApp: ' + whatsapp : '',
      '',
      tagline || '',
      '',
      'Pesan melalui GuruLes — Guru tepat, belajar lebih cepat.',
      'Arieftoteles Production',
    ];
    return lines.filter((line, index) => line || (index > 0 && lines[index - 1] !== '')).join('\n').trim();
  }, [headline, name, levels, location, methods, price, promo, whatsapp, tagline]);

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
    setPhotoObjectUrl(url);
    setPhotoUrl(url);
    setMessage('Foto siap digunakan pada banner.');
  }

  async function renderBanner<T>(
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
    const node = bannerRef.current;
    if (!node) throw new Error('Preview banner belum tersedia.');

    const image = node.querySelector('.banner-photo-zone img') as HTMLImageElement | null;
    const originalSrc = image?.getAttribute('src') || '';
    let usedPhotoFallback = false;

    try {
      if (image && originalSrc) {
        try {
          const safePhoto = await imageUrlToDataUrl(originalSrc);
          image.src = safePhoto || TRANSPARENT_PIXEL;
          await waitForImage(image);
        } catch {
          image.src = TRANSPARENT_PIXEL;
          usedPhotoFallback = true;
          await waitForImage(image).catch(() => undefined);
        }
      }

      const ratio = Math.min(3, size.width / Math.max(node.offsetWidth, 1));
      const output = await renderer(node, {
        cacheBust: true,
        pixelRatio: ratio,
        backgroundColor: '#ffffff',
        imagePlaceholder: TRANSPARENT_PIXEL,
        skipFonts: true,
      });

      return { output, usedPhotoFallback };
    } finally {
      if (image && originalSrc) image.src = originalSrc;
    }
  }

  async function renderPng() {
    return await renderBanner((node, options) => toPng(node, options));
  }

  async function download() {
    setBusy(true);
    setMessage('');
    try {
      const { output: dataUrl, usedPhotoFallback } = await renderPng();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'gurules-banner-' + safeFileName(name) + '-' + sizeKey + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage(
        usedPhotoFallback
          ? 'Banner berhasil dibuat tanpa foto karena foto profil tidak dapat diekspor. Upload ulang foto langsung di menu Banner agar foto ikut masuk.'
          : 'Banner PNG berhasil dibuat.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Banner belum dapat dibuat.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setMessage('');
    try {
      const { output: blob, usedPhotoFallback } = await renderBanner((node, options) =>
        toBlob(node, options)
      );
      if (!blob) throw new Error('File banner belum dapat dibuat.');
      const file = new File([blob], 'gurules-banner-' + safeFileName(name) + '.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Banner GuruLes - ' + name,
          text: caption,
          files: [file],
        });
        setMessage(
          usedPhotoFallback
            ? 'Banner siap dibagikan tanpa foto. Upload ulang foto langsung di menu Banner agar foto ikut masuk.'
            : 'Banner siap dibagikan.'
        );
      } else {
        await navigator.clipboard.writeText(caption);
        setMessage('Perangkat belum mendukung share file langsung. Caption sudah disalin.');
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
    <section className="banner-studio">
      <div className="banner-studio-head">
        <div>
          <span className="eyebrow">🎨 Banner Promosi</span>
          <h3>Buat banner pengajar otomatis</h3>
          <p>Upload foto, isi data, pilih desain, lalu download atau bagikan banner siap promosi.</p>
        </div>
        <span className="banner-auto-badge">AUTO DESIGN</span>
      </div>

      <div className="banner-studio-layout">
        <div className="banner-form-panel">
          <label className="banner-photo-upload">
            <span>Foto utama</span>
            <small>JPG/PNG/WebP · maks. 8 MB</small>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
          </label>

          <div className="banner-form-grid">
            <label>Nama pengajar<input value={name} onChange={e => setName(e.target.value)} /></label>
            <label>Bidang / judul layanan<input value={headline} onChange={e => setHeadline(e.target.value)} /></label>
            <label>Jenjang / target siswa<input value={levels} onChange={e => setLevels(e.target.value)} placeholder="Contoh: SD–SMP" /></label>
            <label>Lokasi layanan<input value={location} onChange={e => setLocation(e.target.value)} /></label>
            <label>Metode belajar<input value={methods} onChange={e => setMethods(e.target.value)} /></label>
            <label>Tarif per sesi<input inputMode="numeric" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} /></label>
            <label>WhatsApp<input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="08xxxxxxxxxx" /></label>
            <label>Promo / info tambahan<input value={promo} onChange={e => setPromo(e.target.value)} placeholder="Contoh: Konsultasi awal gratis" /></label>
            <label className="banner-wide">Tagline<textarea rows={2} value={tagline} onChange={e => setTagline(e.target.value)} /></label>
          </div>

          <div className="banner-choice-block">
            <strong>Template</strong>
            <div className="banner-choice-row">
              {([
                ['formal', 'Formal Edu'],
                ['ceria', 'Ceria Anak'],
                ['sport', 'Sport / Skill'],
                ['premium', 'Premium'],
              ] as Array<[TemplateKey, string]>).map(([key, label]) => (
                <button key={key} className={template === key ? 'active' : ''} onClick={() => setTemplate(key)} type="button">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="banner-choice-block">
            <strong>Ukuran</strong>
            <div className="banner-choice-row">
              {(Object.keys(SIZE_MAP) as BannerSizeKey[]).map(key => (
                <button key={key} className={sizeKey === key ? 'active' : ''} onClick={() => setSizeKey(key)} type="button">
                  {SIZE_MAP[key].label}
                </button>
              ))}
            </div>
          </div>

          <div className="banner-actions">
            <button className="button primary" type="button" disabled={busy} onClick={() => void download()}>
              {busy ? 'Memproses...' : '⬇️ Download PNG'}
            </button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => void share()}>
              📤 Bagikan
            </button>
            <button className="button secondary" type="button" onClick={() => void copyCaption()}>
              📋 Salin Caption
            </button>
          </div>
          {message && <div className="form-success">{message}</div>}
        </div>

        <div className="banner-preview-panel">
          <div className="banner-preview-label">
            <span>Preview</span>
            <small>{size.width} × {size.height}px</small>
          </div>
          <div
            ref={bannerRef}
            className={'gurules-banner template-' + template + ' size-' + sizeKey}
            style={{ aspectRatio: size.width + ' / ' + size.height }}
          >
            <div className="banner-top-brand">
              <span>🎓 GuruLes</span>
              <small>Guru tepat, belajar lebih cepat.</small>
            </div>

            <div className="banner-photo-zone">
              {photoUrl ? (
                <img src={photoUrl} alt="Foto pengajar untuk banner" />
              ) : (
                <div className="banner-photo-placeholder">Upload Foto</div>
              )}
              {promo && <span className="banner-promo-chip">{promo}</span>}
            </div>

            <div className="banner-copy-zone">
              <span className="banner-kicker">{listing.category || 'Pengajar Privat'}</span>
              <h2>{headline || 'Layanan Belajar Privat'}</h2>
              <h3>{name || 'Nama Pengajar'}</h3>
              {tagline && <p>{tagline}</p>}

              <div className="banner-meta-grid">
                {levels && <span>🎯 {levels}</span>}
                {location && <span>📍 {location}</span>}
                {methods && <span>🧭 {methods}</span>}
                {listing.years_experience > 0 && <span>⭐ {listing.years_experience} tahun pengalaman</span>}
              </div>

              <div className="banner-bottom-row">
                <div>
                  <small>Mulai dari</small>
                  <strong>{Number(price) > 0 ? rupiah(Number(price)) : 'Tarif fleksibel'}</strong>
                  <small>/sesi</small>
                </div>
                <div className="banner-contact">
                  <small>Hubungi / Booking</small>
                  <strong>{whatsapp || 'melalui GuruLes'}</strong>
                </div>
              </div>
            </div>

            <div className="banner-footer-brand">
              <span>gurules-beta.vercel.app</span>
              <strong>Arieftoteles Production</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
