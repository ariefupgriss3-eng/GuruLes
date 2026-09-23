import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AdminPaymentSettings,
  BookingTransactionControls,
  getPlatformFeePercent,
} from './payment';
import {
  BookingAvailabilityPicker,
  BookingTimeline,
  BusinessDashboard,
  ChatInbox,
  ChatLauncher,
  FavoriteButton,
  FavoritesPanel,
  InstructorAvailabilityManager,
  ReviewForm,
} from './marketplace-v2';
import {
  EMPTY_LEARNING_LOCATION,
  LearningLocation,
  LocationFilter,
  LocationScope,
  locationScore,
  matchesLocationScope,
} from './location-filter';

const SUPABASE_URL = 'https://ikumhfuaqqgqrexemkwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nQhV0S4__E_3OgwrhB_QiQ_kDOc9j-E';

type Listing = {
  id: string;
  instructor_id: string;
  display_name: string;
  title: string;
  category: string;
  city: string;
  village: string | null;
  district: string | null;
  regency: string | null;
  province: string | null;
  service_methods: string[];
  price_per_session: number;
  duration_minutes: number;
  years_experience: number;
  verification_status: string;
  is_active: boolean;
  average_rating: number | string;
  review_count: number;
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
  tagline: string;
  branding_updated_at: string | null;
};

type Session = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string };
};

type Profile = {
  id: string;
  role: 'student' | 'parent' | 'instructor';
  full_name: string;
  city: string | null;
  account_status: string;
};

type Booking = {
  id: string;
  buyer_id: string;
  instructor_id: string;
  listing_id: string;
  created_at: string;
  scheduled_at: string;
  location_type: 'Ke rumah' | 'Lokasi latihan' | 'Daring';
  private_location: string | null;
  buyer_notes: string | null;
  status: string;
  session_price: number;
  platform_fee_amount: number;
  platform_fee_percent: number;
  instructor_net_amount: number;
  buyer_confirmed_complete: boolean;
  instructor_confirmed_complete: boolean;
};

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function googleMapsUrl(address: string) {
  return (
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(address)
  );
}

function googleMapsEmbedUrl(address: string) {
  const query = address.trim() || 'Indonesia';
  return (
    'https://www.google.com/maps?q=' +
    encodeURIComponent(query) +
    '&output=embed'
  );
}

function categoryEmoji(value: string) {
  const key = value.toLowerCase();
  if (key.includes('akadem') || key.includes('pelajaran')) return '📚';
  if (key.includes('renang')) return '🏊';
  if (key.includes('musik')) return '🎵';
  if (key.includes('bela') || key.includes('taekwondo') || key.includes('karate')) return '🥋';
  if (key.includes('olahraga') || key.includes('sport')) return '⚽';
  if (key.includes('teknologi') || key.includes('komputer') || key.includes('coding')) return '💻';
  if (key.includes('agama') || key.includes('ngaji')) return '🕌';
  if (key.includes('seni') || key.includes('gambar')) return '🎨';
  return '✨';
}

function brandedImageUrl(url: string | null, updatedAt: string | null) {
  if (!url) return '';
  if (!updatedAt) return url;
  return (
    url +
    (url.includes('?') ? '&' : '?') +
    'v=' +
    encodeURIComponent(updatedAt)
  );
}

function validateBrandImage(file: File) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return 'Gunakan gambar JPG, PNG, atau WebP.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Ukuran gambar maksimal 5 MB.';
  }
  return '';
}

async function uploadBrandFile(
  file: File,
  kind: 'avatar' | 'cover',
  activeSession: Session
) {
  const path = activeSession.user.id + '/' + kind;
  const response = await fetch(
    SUPABASE_URL + '/storage/v1/object/instructor-branding/' + path,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + activeSession.access_token,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    }
  );

  if (!response.ok) {
    let message = 'Unggah gambar belum berhasil.';
    try {
      const data = (await response.json()) as { message?: string; error?: string };
      message = data.message || data.error || message;
    } catch {
      // Gunakan pesan default.
    }
    throw new Error(message);
  }

  return path;
}

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers || {});
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);

  const response = await fetch(SUPABASE_URL + path, { ...options, headers });
  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: unknown }).message)
        : typeof data === 'object' && data && 'error_description' in data
          ? String((data as { error_description: unknown }).error_description)
          : typeof data === 'object' && data && 'error' in data
            ? String((data as { error: unknown }).error)
            : String(data || response.statusText);
    throw new Error(message);
  }

  return data;
}

function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [adminListings, setAdminListings] = useState<Listing[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [publicError, setPublicError] = useState('');
  const [query, setQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gurules_search_history');
      return saved ? (JSON.parse(saved) as string[]).slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const [category, setCategory] = useState('Semua');
  const [learningLocation, setLearningLocation] = useState<LearningLocation>(() => {
    try {
      const saved = localStorage.getItem('gurules_learning_location');
      return saved
        ? { ...EMPTY_LEARNING_LOCATION, ...(JSON.parse(saved) as LearningLocation) }
        : EMPTY_LEARNING_LOCATION;
    } catch {
      return EMPTY_LEARNING_LOCATION;
    }
  });
  const [locationScope, setLocationScope] = useState<LocationScope>(() => {
    try {
      return localStorage.getItem('gurules_learning_location')
        ? 'nearby'
        : 'all';
    } catch {
      return 'all';
    }
  });
  const [showLogin, setShowLogin] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [registerRole, setRegisterRole] =
    useState<'parent' | 'student' | 'instructor'>('parent');
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerCity, setRegisterCity] = useState('');
  const [registerVillage, setRegisterVillage] = useState('');
  const [registerDistrict, setRegisterDistrict] = useState('');
  const [registerRegency, setRegisterRegency] = useState('');
  const [registerProvince, setRegisterProvince] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerCategory, setRegisterCategory] = useState('Akademik');
  const [registerTitle, setRegisterTitle] = useState('');
  const [registerMethod, setRegisterMethod] = useState('Ke rumah');
  const [registerPrice, setRegisterPrice] = useState('50000');
  const [registerError, setRegisterError] = useState('');
  const [registerBusy, setRegisterBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminBusyId, setAdminBusyId] = useState('');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDateTime, setBookingDateTime] = useState('');
  const [bookingLocationType, setBookingLocationType] =
    useState<'Ke rumah' | 'Lokasi latihan' | 'Daring'>('Ke rumah');
  const [bookingAddress, setBookingAddress] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dashboardTab, setDashboardTab] = useState('summary');
  const [platformFeePercent, setPlatformFeePercent] = useState(10);
  const [ownListing, setOwnListing] = useState<Listing | null>(null);
  const [brandAvatarFile, setBrandAvatarFile] = useState<File | null>(null);
  const [brandCoverFile, setBrandCoverFile] = useState<File | null>(null);
  const [brandAvatarPreview, setBrandAvatarPreview] = useState('');
  const [brandCoverPreview, setBrandCoverPreview] = useState('');
  const [brandTagline, setBrandTagline] = useState('');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [profileVillage, setProfileVillage] = useState('');
  const [profileDistrict, setProfileDistrict] = useState('');
  const [profileRegency, setProfileRegency] = useState('');
  const [profileProvince, setProfileProvince] = useState('');
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandError, setBrandError] = useState('');
  const [brandSuccess, setBrandSuccess] = useState('');

  async function loadPublicListings() {
    setLoading(true);
    setPublicError('');
    try {
      const data = (await api(
        '/functions/v1/public-instructors',
        { method: 'GET' }
      )) as Listing[];
      setListings(data);
    } catch (error) {
      setPublicError(
        error instanceof Error ? error.message : 'Daftar pengajar gagal dimuat.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminListings(activeSession: Session) {
    const select =
      'id,instructor_id,display_name,title,category,city,village,district,regency,province,service_methods,price_per_session,duration_minutes,years_experience,verification_status,is_active,average_rating,review_count,bio,avatar_url,cover_url,tagline,branding_updated_at';
    const data = (await api(
      '/rest/v1/instructor_listings?select=' +
        encodeURIComponent(select) +
        '&order=created_at.desc',
      {},
      activeSession.access_token
    )) as Listing[];
    setAdminListings(data);
  }

  async function loadBookings(activeSession: Session) {
    const data = (await api(
      '/rest/v1/bookings?select=' +
        encodeURIComponent(
          'id,buyer_id,instructor_id,listing_id,created_at,scheduled_at,location_type,private_location,buyer_notes,status,session_price,platform_fee_percent,platform_fee_amount,instructor_net_amount,buyer_confirmed_complete,instructor_confirmed_complete'
        ) +
        '&order=created_at.desc',
      {},
      activeSession.access_token
    )) as Booking[];
    setBookings(data);
  }

  async function loadAdminProfiles(activeSession: Session) {
    const data = (await api(
      '/rest/v1/profiles?select=' +
        encodeURIComponent('id,role,full_name,city,account_status') +
        '&order=full_name.asc',
      {},
      activeSession.access_token
    )) as Profile[];
    setAdminProfiles(data);
  }

  async function loadOwnInstructorListing(activeSession: Session) {
    const select =
      'id,instructor_id,display_name,title,category,city,village,district,regency,province,service_methods,price_per_session,duration_minutes,years_experience,verification_status,is_active,average_rating,review_count,bio,avatar_url,cover_url,tagline,branding_updated_at';
    const data = (await api(
      '/rest/v1/instructor_listings?instructor_id=eq.' +
        encodeURIComponent(activeSession.user.id) +
        '&select=' +
        encodeURIComponent(select) +
        '&limit=1',
      {},
      activeSession.access_token
    )) as Listing[];

    const listing = data[0] || null;
    setOwnListing(listing);
    setBrandTagline(listing?.tagline || '');
    setYearsExperience(String(listing?.years_experience ?? 0));
    setProfileVillage(listing?.village || '');
    setProfileDistrict(listing?.district || '');
    setProfileRegency(listing?.regency || '');
    setProfileProvince(listing?.province || '');
    return listing;
  }

  async function hydrateSession(activeSession: Session) {
    const adminResult = (await api(
      '/rest/v1/rpc/is_current_user_admin',
      { method: 'POST', body: '{}' },
      activeSession.access_token
    )) as boolean;

    setIsAdmin(Boolean(adminResult));

    const profiles = (await api(
      '/rest/v1/profiles?id=eq.' +
        encodeURIComponent(activeSession.user.id) +
        '&select=id,role,full_name,city,account_status',
      {},
      activeSession.access_token
    )) as Profile[];

    const currentProfile = profiles[0] || null;
    setProfile(currentProfile);

    if (adminResult) {
      await Promise.all([
        loadAdminListings(activeSession),
        loadBookings(activeSession),
        loadAdminProfiles(activeSession),
      ]);
    } else if (currentProfile?.role === 'instructor') {
      await Promise.all([
        loadBookings(activeSession),
        loadOwnInstructorListing(activeSession),
      ]);
    } else {
      await loadBookings(activeSession);
    }

    return { isAdmin: Boolean(adminResult), profile: currentProfile };
  }

  useEffect(() => {
    void loadPublicListings();
    void getPlatformFeePercent()
      .then(setPlatformFeePercent)
      .catch(() => setPlatformFeePercent(10));
    const saved = localStorage.getItem('gurules_session');
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Session;
      setSession(parsed);
      void hydrateSession(parsed).catch(() => {
        localStorage.removeItem('gurules_session');
        setSession(null);
        setProfile(null);
        setIsAdmin(false);
      });
    } catch {
      localStorage.removeItem('gurules_session');
    }
  }, []);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;
    const timer = window.setTimeout(() => {
      setSearchHistory(current => {
        const next = [
          needle,
          ...current.filter(item => item.toLowerCase() !== needle.toLowerCase()),
        ].slice(0, 6);
        localStorage.setItem('gurules_search_history', JSON.stringify(next));
        return next;
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [query]);

  const categories = useMemo(
    () => [
      'Semua',
      ...Array.from(new Set(listings.map(item => item.category))).sort(),
    ],
    [listings]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matches = listings.filter(item => {
      const matchesText =
        !needle ||
        [
          item.display_name,
          item.title,
          item.category,
          item.city,
          item.village,
          item.district,
          item.regency,
          item.province,
          item.bio,
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      const matchesCategory =
        category === 'Semua' || item.category === category;
      const matchesRegion = matchesLocationScope(
        item,
        learningLocation,
        locationScope
      );

      return matchesText && matchesCategory && matchesRegion;
    });

    if (locationScope === 'nearby') {
      return [...matches].sort(
        (a, b) =>
          locationScore(b, learningLocation) -
          locationScore(a, learningLocation)
      );
    }

    return matches;
  }, [listings, query, category, learningLocation, locationScope]);

  function openRegister() {
    setShowLogin(false);
    setShowRegister(true);
    setRegisterStep(1);
    setRegisterError('');
  }

  function chooseRegisterRole(role: 'parent' | 'student' | 'instructor') {
    setRegisterRole(role);
    setRegisterError('');
    setRegisterStep(2);
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setRegisterError('');

    if (
      !registerName.trim() ||
      !registerPhone.trim() ||
      !registerPassword ||
      (registerRole !== 'instructor' && !registerCity.trim())
    ) {
      setRegisterError(
        registerRole === 'instructor'
          ? 'Lengkapi nama, nomor HP, dan password.'
          : 'Lengkapi nama, nomor HP, Kabupaten/Kota dan Provinsi, serta password.'
      );
      return;
    }

    if (registerPassword.length < 8) {
      setRegisterError('Password minimal 8 karakter.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setRegisterError('Konfirmasi password tidak sama.');
      return;
    }

    if (
      registerRole === 'instructor' &&
      (!registerVillage.trim() ||
        !registerDistrict.trim() ||
        !registerRegency.trim() ||
        !registerProvince.trim())
    ) {
      setRegisterError(
        'Lengkapi Desa/Kelurahan, Kecamatan, Kabupaten/Kota, dan Provinsi.'
      );
      return;
    }

    if (
      registerRole === 'instructor' &&
      (!registerCategory ||
        !registerTitle.trim() ||
        !registerMethod ||
        Number(registerPrice) < 10000)
    ) {
      setRegisterError('Lengkapi data jasa pengajar dan tarif minimal Rp10.000.');
      return;
    }

    setRegisterBusy(true);
    try {
      const result = (await api('/functions/v1/register-gurules', {
        method: 'POST',
        body: JSON.stringify({
          role: registerRole,
          full_name: registerName.trim(),
          phone: registerPhone.trim(),
          city:
            registerRole === 'instructor' ? undefined : registerCity.trim(),
          village:
            registerRole === 'instructor' ? registerVillage.trim() : undefined,
          district:
            registerRole === 'instructor' ? registerDistrict.trim() : undefined,
          regency:
            registerRole === 'instructor' ? registerRegency.trim() : undefined,
          province:
            registerRole === 'instructor' ? registerProvince.trim() : undefined,
          password: registerPassword,
          category: registerRole === 'instructor' ? registerCategory : undefined,
          title: registerRole === 'instructor' ? registerTitle.trim() : undefined,
          method: registerRole === 'instructor' ? registerMethod : undefined,
          price: registerRole === 'instructor' ? Number(registerPrice) : undefined,
        }),
      })) as { ok: boolean; login: string; message?: string };

      setPhone(registerPhone.trim());
      setPassword('');
      setLoginNotice(
        result.message ||
          (registerRole === 'instructor'
            ? 'Pendaftaran berhasil. Profil menunggu verifikasi Admin.'
            : 'Pendaftaran berhasil. Silakan masuk.')
      );
      setShowRegister(false);
      setShowLogin(true);
      setRegisterStep(1);
      setRegisterName('');
      setRegisterPhone('');
      setRegisterCity('');
      setRegisterVillage('');
      setRegisterDistrict('');
      setRegisterRegency('');
      setRegisterProvince('');
      setRegisterPassword('');
      setRegisterConfirmPassword('');
      setRegisterTitle('');
      setRegisterError('');
    } catch (error) {
      setRegisterError(
        error instanceof Error ? error.message : 'Pendaftaran belum berhasil.'
      );
    } finally {
      setRegisterBusy(false);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError('');
    setLoginNotice('');

    if (!phone.trim() || !password) {
      setLoginError('Nomor HP / Email Admin dan password wajib diisi.');
      return;
    }

    setLoginBusy(true);
    try {
      const data = (await api('/functions/v1/login-gurules', {
        method: 'POST',
        body: JSON.stringify({ identifier: phone.trim(), password }),
      })) as Session;

      localStorage.setItem('gurules_session', JSON.stringify(data));
      setSession(data);
      const account = await hydrateSession(data);
      setShowLogin(false);
      setPassword('');

      if (
        selectedListing &&
        !account.isAdmin &&
        (account.profile?.role === 'parent' || account.profile?.role === 'student')
      ) {
        setShowBooking(true);
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login gagal.');
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('gurules_session');
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setAdminListings([]);
    setAdminProfiles([]);
    setBookings([]);
    setOwnListing(null);
    setBrandAvatarFile(null);
    setBrandCoverFile(null);
    setBrandAvatarPreview('');
    setBrandCoverPreview('');
    setBrandTagline('');
    setYearsExperience('0');
    setProfileVillage('');
    setProfileDistrict('');
    setProfileRegency('');
    setProfileProvince('');
    setBrandError('');
    setBrandSuccess('');
    setSelectedListing(null);
    setShowBooking(false);
  }

  function beginBooking(item: Listing) {
    setSelectedListing(item);
    setBookingError('');
    const allowedMethods = (item.service_methods || []).filter(
      method =>
        method === 'Ke rumah' ||
        method === 'Lokasi latihan' ||
        method === 'Daring'
    ) as Array<'Ke rumah' | 'Lokasi latihan' | 'Daring'>;
    setBookingLocationType(allowedMethods[0] || 'Ke rumah');
    setBookingDateTime('');
    setBookingAddress('');
    setBookingNotes('');

    if (!session) {
      setShowLogin(true);
      return;
    }

    if (
      isAdmin ||
      (profile?.role !== 'parent' && profile?.role !== 'student')
    ) {
      window.alert('Pemesanan dilakukan melalui akun Murid atau Orang Tua.');
      return;
    }

    setShowBooking(true);
  }

  async function submitBooking(event: FormEvent) {
    event.preventDefault();
    if (!session || !profile || !selectedListing) return;

    setBookingError('');

    if (profile.role !== 'parent' && profile.role !== 'student') {
      setBookingError('Pemesanan hanya dapat dilakukan oleh Murid atau Orang Tua.');
      return;
    }

    if (!bookingDateTime) {
      setBookingError('Pilih jadwal belajar terlebih dahulu.');
      return;
    }

    const scheduledDate = new Date(bookingDateTime);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      setBookingError('Jadwal harus berada di waktu yang akan datang.');
      return;
    }

    if (bookingLocationType === 'Ke rumah' && !bookingAddress.trim()) {
      setBookingError('Isi alamat belajar untuk layanan ke rumah.');
      return;
    }

    setBookingBusy(true);
    try {
      await api(
        '/rest/v1/bookings',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            buyer_id: profile.id,
            instructor_id: selectedListing.instructor_id,
            listing_id: selectedListing.id,
            scheduled_at: scheduledDate.toISOString(),
            location_type: bookingLocationType,
            private_location:
              bookingLocationType === 'Daring'
                ? null
                : bookingAddress.trim() || null,
            buyer_notes: bookingNotes.trim() || null,
            status: 'requested',
            session_price: selectedListing.price_per_session,
            platform_fee_percent: platformFeePercent,
          }),
        },
        session.access_token
      );

      await loadBookings(session);
      setShowBooking(false);
      setSelectedListing(null);
      window.alert('Permintaan belajar berhasil dikirim ke pengajar.');
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : 'Pemesanan gagal dikirim.'
      );
    } finally {
      setBookingBusy(false);
    }
  }

  function selectBrandImage(
    file: File | undefined,
    kind: 'avatar' | 'cover'
  ) {
    if (!file) return;
    const validationError = validateBrandImage(file);
    if (validationError) {
      setBrandError(validationError);
      return;
    }

    setBrandError('');
    setBrandSuccess('');
    const preview = URL.createObjectURL(file);

    if (kind === 'avatar') {
      setBrandAvatarFile(file);
      setBrandAvatarPreview(preview);
    } else {
      setBrandCoverFile(file);
      setBrandCoverPreview(preview);
    }
  }

  async function saveBranding() {
    if (!session || profile?.role !== 'instructor' || !ownListing) return;

    if (brandTagline.trim().length > 120) {
      setBrandError('Tagline maksimal 120 karakter.');
      return;
    }

    const experience = Number(yearsExperience);
    if (!Number.isInteger(experience) || experience < 0 || experience > 60) {
      setBrandError('Pengalaman mengajar harus 0 sampai 60 tahun.');
      return;
    }

    if (
      !profileVillage.trim() ||
      !profileDistrict.trim() ||
      !profileRegency.trim() ||
      !profileProvince.trim()
    ) {
      setBrandError(
        'Lengkapi Desa/Kelurahan, Kecamatan, Kabupaten/Kota, dan Provinsi.'
      );
      return;
    }

    setBrandBusy(true);
    setBrandError('');
    setBrandSuccess('');

    try {
      const avatarPath = brandAvatarFile
        ? await uploadBrandFile(brandAvatarFile, 'avatar', session)
        : undefined;
      const coverPath = brandCoverFile
        ? await uploadBrandFile(brandCoverFile, 'cover', session)
        : undefined;

      const result = (await api(
        '/functions/v1/update-instructor-branding',
        {
          method: 'POST',
          body: JSON.stringify({
            tagline: brandTagline.trim(),
            years_experience: experience,
            village: profileVillage.trim(),
            district: profileDistrict.trim(),
            regency: profileRegency.trim(),
            province: profileProvince.trim(),
            avatar_path: avatarPath,
            cover_path: coverPath,
          }),
        },
        session.access_token
      )) as { listing: Listing; message?: string };

      setOwnListing(result.listing);
      setBrandTagline(result.listing.tagline || '');
      setYearsExperience(String(result.listing.years_experience ?? 0));
      setProfileVillage(result.listing.village || '');
      setProfileDistrict(result.listing.district || '');
      setProfileRegency(result.listing.regency || '');
      setProfileProvince(result.listing.province || '');
      setBrandAvatarFile(null);
      setBrandCoverFile(null);
      setBrandAvatarPreview('');
      setBrandCoverPreview('');
      setBrandSuccess(result.message || 'Branding berhasil disimpan.');
      await loadPublicListings();    } catch (error) {
      setBrandError(
        error instanceof Error ? error.message : 'Branding belum dapat disimpan.'
      );
    } finally {
      setBrandBusy(false);
    }
  }

  async function moderateListing(
    id: string,
    action: 'verify' | 'reject' | 'unverify'
  ) {
    if (!session) return;

    if (
      action === 'unverify' &&
      !window.confirm(
        'Batalkan verifikasi pengajar ini? Profil akan berhenti tampil di daftar publik.'
      )
    ) {
      return;
    }

    setAdminBusyId(id);

    try {
      const body =
        action === 'verify'
          ? {
              verification_status: 'verified',
              is_active: true,
              verification_note: null,
            }
          : action === 'unverify'
            ? {
                verification_status: 'submitted',
                is_active: false,
                verification_note: 'Verifikasi dibatalkan oleh admin.',
              }
            : {
                verification_status: 'rejected',
                is_active: false,
                verification_note: 'Belum memenuhi verifikasi admin.',
              };

      await api(
        '/rest/v1/instructor_listings?id=eq.' + encodeURIComponent(id),
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(body),
        },
        session.access_token
      );

      await Promise.all([loadAdminListings(session), loadPublicListings()]);

      window.alert(
        action === 'verify'
          ? 'Pengajar berhasil diverifikasi dan sekarang tampil di daftar publik.'
          : action === 'unverify'
            ? 'Verifikasi dibatalkan. Pengajar tidak lagi tampil di daftar publik.'
            : 'Pengajuan pengajar ditolak.'
      );
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : 'Pembaruan status gagal.'
      );
    } finally {
      setAdminBusyId('');
    }
  }

  const roleLabel = isAdmin
    ? 'Admin GuruLes'
    : profile?.role === 'instructor'
      ? 'Pengajar'
      : profile?.role === 'parent'
        ? 'Orang Tua'
        : profile?.role === 'student'
          ? 'Murid'
          : '';

  useEffect(() => {
    setDashboardTab('summary');
  }, [session?.user.id, isAdmin, profile?.role]);

  const dashboardTabs = isAdmin
    ? [
        { id: 'summary', icon: '📊', label: 'Ringkasan' },
        { id: 'orders', icon: '📦', label: 'Pesanan' },
        { id: 'instructors', icon: '🎓', label: 'Pengajar' },
        { id: 'payment', icon: '💳', label: 'Pembayaran' },
      ]
    : profile?.role === 'instructor'
      ? [
          { id: 'summary', icon: '📊', label: 'Ringkasan' },
          { id: 'orders', icon: '📦', label: 'Pesanan' },
          { id: 'chat', icon: '💬', label: 'Chat' },
          { id: 'schedule', icon: '📅', label: 'Jadwal' },
          { id: 'profile', icon: '👤', label: 'Profil' },
        ]
      : [
          { id: 'summary', icon: '🏠', label: 'Ringkasan' },
          { id: 'orders', icon: '📦', label: 'Pesanan' },
          { id: 'favorites', icon: '❤️', label: 'Favorit' },
          { id: 'chat', icon: '💬', label: 'Chat' },
          { id: 'find', icon: '🔎', label: 'Cari Guru' },
        ];

  function openDashboardTab(tab: string) {
    setDashboardTab(tab);
    window.setTimeout(() => {
      document.getElementById('akun')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="GuruLes">
          <span className="brand-mark">🎓</span>
          <span>GuruLes</span>
        </a>

        <label className="top-search">
          <span>⌕</span>
          <input
            aria-label="Cari guru, pelatih, atau keterampilan"
            placeholder="Cari guru, pelajaran, renang, musik..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            onFocus={() => {
              window.location.hash = 'pengajar';
            }}
          />
        </label>

        <nav className="topnav">
          <a href="#pengajar">Cari Guru</a>
          <a href="#cara-kerja">Cara Kerja</a>
        </nav>

        {session ? (
          <div className="account-strip">
            <div>
              <strong>
                {profile?.full_name || session.user.email || 'Pengguna'}
              </strong>
              <span>{roleLabel}</span>
            </div>
            <button className="button secondary small" onClick={logout}>
              Keluar
            </button>
          </div>
        ) : (
          <div className="guest-actions">
            <button className="button secondary small" onClick={openRegister}>
              Daftar
            </button>
            <button
              className="button primary small"
              onClick={() => {
                setLoginNotice('');
                setShowLogin(true);
              }}
            >
              Masuk
            </button>
          </div>
        )}
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Marketplace Guru & Pelatih Indonesia</span>
            <h1>
              Guru tepat,
              <span> belajar lebih cepat.</span>
            </h1>
            <p>
              Temukan guru dan pelatih terverifikasi untuk akademik, olahraga,
              seni, teknologi, agama, dan keterampilan.
            </p>
            <div className="hero-actions">
              <a className="button primary marketplace-cta" href="#pengajar">
                Cari Pengajar
              </a>
              {!session && (
                <button className="button secondary" onClick={openRegister}>
                  Daftar sebagai Pengajar
                </button>
              )}
            </div>
            <div className="trust-row">
              <span>🛡️ Terverifikasi</span>
              <span>💳 Tarif transparan</span>
              <span>📍 Sesuai wilayah</span>
            </div>
          </div>

          <div className="hero-media" aria-label="Ilustrasi layanan GuruLes">
            <img
              src="/gurules-hero.webp"
              alt="Guru mengajar, pelatih renang, dan pelatih musik di GuruLes"
            />
            <div className="hero-media-shine" aria-hidden="true" />
            <div className="hero-media-meta">
              <span className="live-dot">● LIVE</span>
              <strong>{loading ? '...' : listings.length} pengajar aktif</strong>
            </div>
          </div>
        </section>

        <section className="quick-categories" aria-label="Kategori populer">
          <div className="quick-category-head">
            <div>
              <span className="eyebrow">Kategori Populer</span>
              <h2>Belajar apa hari ini?</h2>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setCategory('Semua');
                document.getElementById('pengajar')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Lihat semua
            </button>
          </div>
          <div className="quick-category-grid">
            {categories.slice(1, 9).map(item => (
              <button
                key={item}
                className={'quick-category-card' + (category === item ? ' active' : '')}
                onClick={() => {
                  setCategory(item);
                  document.getElementById('pengajar')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span>{categoryEmoji(item)}</span>
                <strong>{item}</strong>
              </button>
            ))}
            {categories.length <= 1 && (
              <>
                {['Akademik', 'Renang', 'Musik', 'Bela Diri', 'Teknologi', 'Agama', 'Seni', 'Olahraga'].map(item => (
                  <button
                    key={item}
                    className="quick-category-card placeholder"
                    onClick={() => {
                      setQuery(item);
                      document.getElementById('pengajar')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <span>{categoryEmoji(item)}</span>
                    <strong>{item}</strong>
                  </button>
                ))}
              </>
            )}
          </div>
        </section>

        <section className="market-promo-strip">
          <div><span>✅</span><strong>Pengajar Terverifikasi</strong><small>Profil diperiksa admin</small></div>
          <div><span>💬</span><strong>Langsung Booking</strong><small>Pilih jadwal & metode</small></div>
          <div><span>💳</span><strong>Pembayaran Transparan</strong><small>Fee terlihat sebelum pesan</small></div>
          <div><span>📱</span><strong>Mudah di HP</strong><small>Cari dan pesan kapan saja</small></div>
        </section>

        <section className="directory" id="pengajar">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Cari Pengajar</span>
              <h2>Pengajar yang benar-benar terdaftar</h2>
            </div>
            <span className="result-count">
              {filtered.length} pengajar ditemukan
            </span>
          </div>

          <LocationFilter
            listings={listings}
            value={learningLocation}
            scope={locationScope}
            onScopeChange={setLocationScope}
            onSave={location => {
              setLearningLocation(location);
              localStorage.setItem(
                'gurules_learning_location',
                JSON.stringify(location)
              );
            }}
          />

          <div className="filters location-aware-filters">
            <label className="search-box">
              <span>⌕</span>
              <input
                aria-label="Cari pengajar atau keterampilan"
                placeholder="Cari nama, pelajaran, atau keterampilan"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </label>

            <select
              aria-label="Filter kategori"
              value={category}
              onChange={event => setCategory(event.target.value)}
            >
              {categories.map(item => (
                <option key={item}>{item}</option>
              ))}
            </select>

          </div>

          {searchHistory.length > 0 && (
            <div className="recent-searches">
              <span>Terakhir dicari:</span>
              {searchHistory.map(item => (
                <button key={item} onClick={() => setQuery(item)}>
                  {item}
                </button>
              ))}
              <button
                className="clear-search-history"
                onClick={() => {
                  setSearchHistory([]);
                  localStorage.removeItem('gurules_search_history');
                }}
              >
                Hapus
              </button>
            </div>
          )}

          {loading && (
            <div className="status-box">Memuat pengajar dari GuruLes...</div>
          )}
          {publicError && (
            <div className="status-box error">
              Data pengajar belum dapat dimuat. {publicError}
              <button
                className="text-button"
                onClick={() => void loadPublicListings()}
              >
                Coba lagi
              </button>
            </div>
          )}

          {!loading && !publicError && filtered.length === 0 && (
            <div className="status-box">
              Belum ada pengajar yang cocok dengan filter ini.
            </div>
          )}

          <div className="teacher-grid">
            {filtered.map(item => (
              <article className="teacher-card" key={item.id}>
                {(!session || profile?.role === 'parent' || profile?.role === 'student') && (
                  <FavoriteButton
                    session={session}
                    listingId={item.id}
                    onRequireLogin={() => {
                      setLoginNotice('Masuk untuk menyimpan pengajar favorit.');
                      setShowLogin(true);
                    }}
                  />
                )}
                {item.cover_url && (
                  <div className="teacher-cover">
                    <img
                      src={brandedImageUrl(
                        item.cover_url,
                        item.branding_updated_at
                      )}
                      alt={'Banner ' + item.display_name}
                    />
                  </div>
                )}
                <div className="teacher-card-head">
                  {item.avatar_url ? (
                    <img
                      className="avatar avatar-image"
                      src={brandedImageUrl(
                        item.avatar_url,
                        item.branding_updated_at
                      )}
                      alt={'Foto ' + item.display_name}
                    />
                  ) : (
                    <div className="avatar">
                      {item.display_name
                        .split(' ')
                        .slice(0, 2)
                        .map(part => part.charAt(0))
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3>{item.display_name}</h3>
                    <div className="teacher-badge-row">
                      <span className="verified">✓ Terverifikasi</span>
                      {Number(item.average_rating) > 0 && (
                        <span className="teacher-rating">
                          ★ {Number(item.average_rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="teacher-main">
                  <span className="category-chip">{item.category}</span>
                  <h4>{item.title}</h4>
                  {item.tagline && (
                    <p className="teacher-tagline">“{item.tagline}”</p>
                  )}
                  <p>{item.bio || 'Pengajar terverifikasi GuruLes.'}</p>
                </div>

                <div className="facts">
                  <span>
                    📍 {item.district ? item.district + ', ' : ''}
                    {item.regency || item.city || item.province || 'Indonesia'}
                  </span>
                  {locationScope === 'nearby' &&
                    locationScore(item, learningLocation) > 0 && (
                      <span className="nearby-match">
                        ✓ Sesuai lokasi Anda
                      </span>
                    )}
                  <span>💼 {item.years_experience} th pengalaman</span>
                  <span>⏱ {item.duration_minutes} menit</span>
                  {Number(item.average_rating) > 0 && (
                    <span>{item.review_count} ulasan</span>
                  )}
                </div>

                <div className="method-row">
                  {(item.service_methods || []).map(method => (
                    <span key={method}>{method}</span>
                  ))}
                </div>

                <div className="price-row">
                  <div>
                    <small>Mulai dari</small>
                    <strong>{rupiah(item.price_per_session)}</strong>
                    <small>/sesi</small>
                  </div>
                  <div className="teacher-card-actions">
                    {(!session ||
                      profile?.role === 'parent' ||
                      profile?.role === 'student') && (
                      <ChatLauncher
                        session={session}
                        listing={item}
                        userRole={profile?.role}
                        onRequireLogin={() => {
                          setLoginNotice('Masuk untuk bertanya kepada pengajar.');
                          setShowLogin(true);
                        }}
                      />
                    )}
                    <button
                      className="button primary"
                      onClick={() => beginBooking(item)}
                    >
                      Pesan Sekarang
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {session && (
          <section className="dashboard-section" id="akun">
            <div className="section-heading dashboard-heading">
              <div>
                <span className="eyebrow">Akun Saya</span>
                <h2>{roleLabel || 'Pengguna GuruLes'}</h2>
              </div>
              <span className="dashboard-user-name">
                {isAdmin ? 'Admin' : profile?.full_name}
              </span>
            </div>

            <div className="account-tabs" role="tablist" aria-label="Menu akun">
              {dashboardTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={dashboardTab === tab.id}
                  className={dashboardTab === tab.id ? 'active' : ''}
                  onClick={() => setDashboardTab(tab.id)}
                >
                  <span>{tab.icon}</span>
                  <small>{tab.label}</small>
                  {tab.id === 'orders' && bookings.length > 0 && (
                    <b>{bookings.length}</b>
                  )}
                </button>
              ))}
            </div>

            {isAdmin ? (
              <>
                <div hidden={dashboardTab !== 'summary'}>
                  <BusinessDashboard
                    session={session}
                    role="admin"
                    bookings={bookings}
                    totalUsers={adminProfiles.length}
                    totalInstructors={adminListings.length}
                  />
                </div>

                <div
                  className="admin-panel"
                  hidden={dashboardTab !== 'instructors'}
                >
                <div className="admin-summary">
                  <strong>{adminListings.length}</strong>
                  <span>total listing pengajar</span>
                </div>

                <div className="admin-list">
                  {adminListings.map(item => (
                    <div className="admin-row" key={item.id}>
                      <div>
                        <strong>{item.display_name}</strong>
                        <span>
                          {item.title} · {item.regency || item.city}
                          {item.province ? ', ' + item.province : ''} ·{' '}
                          {rupiah(item.price_per_session)}
                        </span>
                      </div>
                      <div className="admin-actions">
                        <span
                          className={'status-pill ' + item.verification_status}
                        >
                          {item.verification_status}
                        </span>
                        {item.verification_status === 'verified' ? (
                          <button
                            className="button secondary small"
                            disabled={adminBusyId === item.id}
                            onClick={() =>
                              void moderateListing(item.id, 'unverify')
                            }
                          >
                            Batalkan Verifikasi
                          </button>
                        ) : (
                          <>
                            <button
                              className="button primary small"
                              disabled={adminBusyId === item.id}
                              onClick={() =>
                                void moderateListing(item.id, 'verify')
                              }
                            >
                              Verifikasi
                            </button>
                            {item.verification_status !== 'rejected' && (
                              <button
                                className="button secondary small"
                                disabled={adminBusyId === item.id}
                                onClick={() =>
                                  void moderateListing(item.id, 'reject')
                                }
                              >
                                Tolak
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div hidden={dashboardTab !== 'payment'}>
                <AdminPaymentSettings
                  session={session}
                  onFeeChanged={setPlatformFeePercent}
                />
              </div>

              <div
                className="admin-booking-report"
                hidden={dashboardTab !== 'orders'}
              >
                <div className="admin-report-head">
                  <div>
                    <span className="eyebrow">Laporan Pemesanan</span>
                    <h3>Transaksi Parent / Murid</h3>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={() =>
                      void Promise.all([
                        loadBookings(session),
                        loadAdminListings(session),
                        loadAdminProfiles(session),
                      ])
                    }
                  >
                    Segarkan
                  </button>
                </div>

                <div className="admin-report-stats">
                  <div>
                    <small>Total pesanan</small>
                    <strong>{bookings.length}</strong>
                  </div>
                  <div>
                    <small>Menunggu</small>                    <strong>
                      {bookings.filter(item => item.status === 'requested').length}
                    </strong>
                  </div>
                  <div>
                    <small>Nilai transaksi</small>
                    <strong>
                      {rupiah(
                        bookings.reduce(
                          (total, item) => total + Number(item.session_price || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                  <div>
                    <small>Fee GuruLes</small>
                    <strong>
                      {rupiah(
                        bookings.reduce(
                          (total, item) =>
                            total + Number(item.platform_fee_amount || 0),
                          0
                        )
                      )}
                    </strong>
                  </div>
                </div>

                {bookings.length === 0 ? (
                  <div className="status-box">
                    Belum ada pemesanan dari Orang Tua atau Murid.
                  </div>
                ) : (
                  <div className="admin-booking-list">
                    {bookings.map(booking => {
                      const buyer = adminProfiles.find(
                        item => item.id === booking.buyer_id
                      );
                      const instructor = adminProfiles.find(
                        item => item.id === booking.instructor_id
                      );
                      const listing = adminListings.find(
                        item => item.id === booking.listing_id
                      );

                      return (
                        <div className="admin-booking-row" key={booking.id}>
                          <div className="admin-booking-main">
                            <strong>
                              {buyer?.full_name || 'Pemesan GuruLes'}
                              {' → '}
                              {listing?.display_name ||
                                instructor?.full_name ||
                                'Pengajar GuruLes'}
                            </strong>
                            <span>
                              {listing?.title || 'Layanan GuruLes'} ·{' '}
                              {new Date(booking.scheduled_at).toLocaleString(
                                'id-ID',
                                {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                }
                              )}
                            </span>
                            <span>
                              {booking.location_type}
                              {booking.private_location
                                ? ' · ' + booking.private_location
                                : ''}
                            </span>
                            {booking.private_location && (
                              <a
                                className="map-link"
                                href={googleMapsUrl(booking.private_location)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                📍 Buka di Google Maps
                              </a>
                            )}
                            {booking.buyer_notes && (
                              <small>Catatan: {booking.buyer_notes}</small>
                            )}
                          </div>

                          <div className="admin-booking-money">
                            <BookingTimeline booking={booking} />
                            <strong>{rupiah(booking.session_price)}</strong>
                            <span>
                              Fee {rupiah(booking.platform_fee_amount)}
                            </span>
                            <span>
                              Pengajar {rupiah(booking.instructor_net_amount)}
                            </span>
                            <span className={'status-pill ' + booking.status}>
                              {booking.status === 'requested'
                                ? 'Menunggu'
                                : booking.status}
                            </span>
                            <BookingTransactionControls
                              session={session}
                              booking={booking}
                              role="admin"
                              isAdmin
                              onChanged={() => loadBookings(session)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </>
            ) : (
              <>
                <div
                  className="user-panel"
                  hidden={dashboardTab !== 'summary'}
                >
                  <strong>{profile?.full_name}</strong>
                  <p>
                    {profile?.role === 'instructor'
                      ? 'Kelola pesanan, pendapatan, jadwal, chat, dan profil pengajar dari satu dashboard.'
                      : 'Kelola pesanan, pengajar favorit, chat, dan pencarian dari satu dashboard.'}
                  </p>
                </div>

                {(profile?.role === 'parent' || profile?.role === 'student') && (
                  <div
                    className="account-overview-grid"
                    hidden={dashboardTab !== 'summary'}
                  >
                    <button onClick={() => openDashboardTab('orders')}>
                      <span>📦</span>
                      <strong>{bookings.length}</strong>
                      <small>Total Pesanan</small>
                    </button>
                    <button onClick={() => openDashboardTab('orders')}>
                      <span>⏳</span>
                      <strong>
                        {bookings.filter(item =>
                          ['requested', 'accepted', 'paid', 'in_progress'].includes(
                            item.status
                          )
                        ).length}
                      </strong>
                      <small>Pesanan Aktif</small>
                    </button>
                    <button onClick={() => openDashboardTab('find')}>
                      <span>🎓</span>
                      <strong>{listings.length}</strong>
                      <small>Pengajar Tersedia</small>
                    </button>
                    <button onClick={() => openDashboardTab('chat')}>
                      <span>💬</span>
                      <strong>Chat</strong>
                      <small>Tanya Pengajar</small>
                    </button>
                  </div>
                )}

                {profile?.role === 'instructor' && (
                  <>
                    <div hidden={dashboardTab !== 'summary'}>
                      <BusinessDashboard
                        session={session}
                        role="instructor"
                        bookings={bookings}
                        rating={Number(ownListing?.average_rating || 0)}
                      />
                    </div>
                    <div hidden={dashboardTab !== 'schedule'}>
                      {ownListing ? (
                        <InstructorAvailabilityManager
                          session={session}
                          instructorId={profile.id}
                        />
                      ) : (
                        <div className="status-box">
                          Profil jasa pengajar belum ditemukan.
                        </div>
                      )}
                    </div>
                    <div hidden={dashboardTab !== 'chat'}>
                      <ChatInbox
                        session={session}
                        listings={listings}
                        role="instructor"
                      />
                    </div>
                  </>
                )}

                {profile?.role === 'instructor' && (
                  <div
                    className="branding-panel"
                    hidden={dashboardTab !== 'profile'}
                  >
                    <div className="branding-head">
                      <div>
                        <span className="eyebrow">Profil & Branding Pengajar</span>
                        <h3>Lengkapi profil agar lebih meyakinkan</h3>
                        <p>
                          Atur pengalaman mengajar, foto/logo, banner, dan
                          tagline. Perubahan ini tidak mengubah status
                          verifikasi Anda.
                        </p>
                      </div>
                      {ownListing && (
                        <span
                          className={
                            'status-pill ' + ownListing.verification_status
                          }
                        >
                          {ownListing.verification_status}
                        </span>
                      )}
                    </div>

                    {!ownListing ? (
                      <div className="status-box">
                        Profil jasa pengajar belum ditemukan.
                      </div>
                    ) : (
                      <>
                        <div className="brand-preview-card">
                          <div className="brand-preview-cover">
                            {brandCoverPreview || ownListing.cover_url ? (
                              <img
                                src={
                                  brandCoverPreview ||
                                  brandedImageUrl(
                                    ownListing.cover_url,
                                    ownListing.branding_updated_at
                                  )
                                }
                                alt="Preview banner pengajar"
                              />
                            ) : (
                              <span>Banner layanan Anda</span>
                            )}
                          </div>
                          <div className="brand-preview-body">
                            {brandAvatarPreview || ownListing.avatar_url ? (
                              <img
                                className="brand-preview-avatar"
                                src={
                                  brandAvatarPreview ||
                                  brandedImageUrl(
                                    ownListing.avatar_url,
                                    ownListing.branding_updated_at
                                  )
                                }
                                alt="Preview foto pengajar"
                              />
                            ) : (
                              <div className="brand-preview-avatar fallback">
                                {ownListing.display_name
                                  .split(' ')
                                  .slice(0, 2)
                                  .map(part => part.charAt(0))
                                  .join('')
                                  .toUpperCase()}
                              </div>
                            )}
                            <div>
                              <strong>{ownListing.display_name}</strong>
                              <span>{ownListing.title}</span>
                              <p>
                                {brandTagline.trim() ||
                                  'Tambahkan tagline singkat yang meyakinkan.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="branding-form-grid">
                          <label className="brand-upload">                            <span>Foto / Logo Profil</span>
                            <small>JPG, PNG, WebP · maks. 5 MB</small>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={event =>
                                selectBrandImage(
                                  event.target.files?.[0],
                                  'avatar'
                                )
                              }
                            />
                          </label>

                          <label className="brand-upload">
                            <span>Banner / Cover</span>
                            <small>Gunakan gambar horizontal · maks. 5 MB</small>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={event =>
                                selectBrandImage(
                                  event.target.files?.[0],
                                  'cover'
                                )
                              }
                            />
                          </label>

                          <label className="brand-tagline-field">
                            <span>Desa / Kelurahan</span>
                            <input
                              value={profileVillage}
                              onChange={event => {
                                setProfileVillage(event.target.value);
                                setBrandSuccess('');
                              }}
                              placeholder="Contoh: Sambong"
                            />
                          </label>

                          <label className="brand-tagline-field">
                            <span>Kecamatan</span>
                            <input
                              value={profileDistrict}
                              onChange={event => {
                                setProfileDistrict(event.target.value);
                                setBrandSuccess('');
                              }}
                              placeholder="Contoh: Batang"
                            />
                          </label>

                          <label className="brand-tagline-field">
                            <span>Kabupaten / Kota</span>
                            <input
                              value={profileRegency}
                              onChange={event => {
                                setProfileRegency(event.target.value);
                                setBrandSuccess('');
                              }}
                              placeholder="Contoh: Kabupaten Batang"
                            />
                          </label>

                          <label className="brand-tagline-field">
                            <span>Provinsi</span>
                            <input
                              value={profileProvince}
                              onChange={event => {
                                setProfileProvince(event.target.value);
                                setBrandSuccess('');
                              }}
                              placeholder="Contoh: Jawa Tengah"
                            />
                          </label>

                          <label className="brand-tagline-field">
                            <span>Pengalaman Mengajar (tahun)</span>
                            <input
                              type="number"
                              min="0"
                              max="60"
                              step="1"
                              value={yearsExperience}
                              onChange={event => {
                                setYearsExperience(event.target.value);
                                setBrandSuccess('');
                              }}
                              placeholder="Contoh: 12"
                            />
                            <small>
                              Isi jumlah tahun pengalaman mengajar, 0–60 tahun.
                            </small>
                          </label>

                          <label className="brand-tagline-field">
                            <span>Tagline promosi</span>
                            <input
                              value={brandTagline}
                              maxLength={120}
                              onChange={event => {
                                setBrandTagline(event.target.value);
                                setBrandSuccess('');
                              }}
                              placeholder="Contoh: Belajar Matematika jadi mudah, sabar, dan menyenangkan."
                            />
                            <small>{brandTagline.length}/120 karakter</small>
                          </label>
                        </div>

                        {brandError && (
                          <div className="form-error">{brandError}</div>
                        )}
                        {brandSuccess && (
                          <div className="form-success">{brandSuccess}</div>
                        )}

                        <div className="branding-actions">
                          <button
                            className="button primary"
                            disabled={brandBusy}
                            onClick={() => void saveBranding()}
                          >
                            {brandBusy
                              ? 'Menyimpan...'
                              : 'Simpan Profil & Branding'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {(profile?.role === 'parent' ||
                  profile?.role === 'student') && (
                  <div
                    className="parent-directory"
                    hidden={dashboardTab !== 'find'}
                  >
                    <div className="parent-directory-head">
                      <div>
                        <span className="eyebrow">Daftar Guru / Pengajar</span>
                        <h3>Pilih pengajar sesuai kebutuhan</h3>
                      </div>
                      <span className="result-count">
                        {listings.length} pengajar tersedia
                      </span>
                    </div>

                    {listings.length === 0 ? (
                      <div className="status-box">
                        Belum ada pengajar terverifikasi yang tersedia.
                      </div>
                    ) : (
                      <div className="parent-teacher-list">
                        {listings.map(item => (
                          <article
                            className="parent-teacher-card"
                            key={item.id}
                          >
                            <div className="parent-teacher-main">
                              {item.avatar_url ? (
                                <img
                                  className="avatar avatar-image"
                                  src={brandedImageUrl(
                                    item.avatar_url,
                                    item.branding_updated_at
                                  )}
                                  alt={'Foto ' + item.display_name}
                                />
                              ) : (
                                <div className="avatar">
                                  {item.display_name
                                    .split(' ')
                                    .slice(0, 2)
                                    .map(part => part.charAt(0))
                                    .join('')
                                    .toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="parent-teacher-name-row">
                                  <strong>{item.display_name}</strong>
                                  <span className="verified">
                                    ✓ Terverifikasi
                                  </span>
                                </div>
                                <h4>{item.title}</h4>
                                {item.tagline && (
                                  <p className="parent-teacher-tagline">
                                    “{item.tagline}”
                                  </p>                                )}
                                <span className="parent-teacher-meta">
                                  {item.category} · {item.years_experience} th pengalaman
                                </span>
                                <div className="parent-region">
                                  <span>🏘 Desa/Kel.: {item.village || '—'}</span>
                                  <span>📌 Kecamatan: {item.district || '—'}</span>
                                  <span>
                                    🏙 Kab./Kota: {item.regency || item.city || '—'}
                                  </span>
                                  <span>🗺 Provinsi: {item.province || '—'}</span>
                                </div>
                                <div className="method-row compact">
                                  {(item.service_methods || []).map(method => (
                                    <span key={method}>{method}</span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="parent-teacher-action">
                              <small>Tarif per sesi</small>
                              <strong>
                                {rupiah(item.price_per_session)}
                              </strong>
                              <button
                                className="button primary small"
                                onClick={() => beginBooking(item)}
                              >
                                Pilih
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(profile?.role === 'parent' || profile?.role === 'student') && (
                  <>
                    <div hidden={dashboardTab !== 'favorites'}>
                      <FavoritesPanel
                        session={session}
                        listings={listings}
                        onBook={item => beginBooking(item as Listing)}
                      />
                    </div>
                    <div hidden={dashboardTab !== 'chat'}>
                      <ChatInbox
                        session={session}
                        listings={listings}
                        role={profile.role}
                      />
                    </div>
                  </>
                )}

                <div
                  className="booking-history"
                  hidden={dashboardTab !== 'orders'}
                >
                  <div className="booking-history-head">
                    <div>
                      <span className="eyebrow">
                        {profile?.role === 'instructor'
                          ? 'Permintaan Mengajar'
                          : 'Pesanan Saya'}
                      </span>
                      <h3>
                        {profile?.role === 'instructor'
                          ? 'Sesi yang diminta murid'
                          : 'Riwayat permintaan belajar'}
                      </h3>
                    </div>
                    <span className="result-count">{bookings.length} booking</span>
                  </div>

                  {bookings.length === 0 ? (
                    <div className="status-box">
                      Belum ada permintaan belajar pada akun ini.
                    </div>
                  ) : (
                    <div className="booking-list">
                      {bookings.map(booking => {
                        const listing = listings.find(
                          item => item.id === booking.listing_id
                        );
                        return (
                          <div className="booking-row" key={booking.id}>
                            <div>
                              <strong>
                                {listing?.display_name || 'Pengajar GuruLes'}
                              </strong>
                              <span>
                                {new Date(booking.scheduled_at).toLocaleString(
                                  'id-ID',
                                  { dateStyle: 'medium', timeStyle: 'short' }
                                )}
                                {' · '}
                                {booking.location_type}
                              </span>
                              {booking.private_location && (
                                <>
                                  <small>{booking.private_location}</small>
                                  <a
                                    className="map-link"
                                    href={googleMapsUrl(booking.private_location)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    📍 Buka di Google Maps
                                  </a>
                                </>
                              )}
                            </div>
                            <div className="booking-money">
                              <BookingTimeline booking={booking} />
                              <strong>{rupiah(booking.session_price)}</strong>
                              <span>
                                Fee GuruLes {rupiah(booking.platform_fee_amount)}
                              </span>
                              <span>
                                Pengajar {rupiah(booking.instructor_net_amount)}
                              </span>
                              <span className={'status-pill ' + booking.status}>
                                {booking.status}
                              </span>
                              {profile && (
                                <BookingTransactionControls
                                  session={session}
                                  booking={booking}
                                  role={profile.role}
                                  onChanged={() => loadBookings(session)}
                                />
                              )}
                              <ReviewForm
                                session={session}
                                booking={booking}
                                onReviewed={() => loadPublicListings()}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        <section className="how" id="cara-kerja">
          <span className="eyebrow">Cara Kerja</span>
          <h2>4 langkah, langsung belajar</h2>
          <div className="steps">
            <div>
              <strong>1</strong>
              <h3>Pengajar daftar</h3>
              <p>Buat profil, layanan, dan tarif.</p>
            </div>
            <div>
              <strong>2</strong>
              <h3>Diverifikasi</h3>
              <p>Admin memeriksa profil pengajar.</p>
            </div>
            <div>
              <strong>3</strong>
              <h3>Pilih & booking</h3>
              <p>Pilih pengajar, jadwal, dan metode.</p>
            </div>
            <div>
              <strong>4</strong>
              <h3>Bayar & belajar</h3>
              <p>Pembayaran transparan, sesi dimulai.</p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <strong>🎓 GuruLes</strong>
        <span>Marketplace pengajar privat · Arieftoteles Production</span>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Navigasi utama">
        <a href="#top"><span>🏠</span><small>Beranda</small></a>
        <a href="#pengajar"><span>🔎</span><small>Cari</small></a>
        {session ? (
          <>
            <button
              onClick={() => openDashboardTab('orders')}
              aria-label="Buka pesanan"
            >
              <span>📋</span><small>Pesanan</small>
            </button>
            <button
              onClick={() => openDashboardTab('summary')}
              aria-label="Buka akun"
            >
              <span>👤</span><small>Akun</small>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setShowLogin(true)}><span>📋</span><small>Pesanan</small></button>
            <button onClick={() => setShowLogin(true)}><span>👤</span><small>Masuk</small></button>
          </>
        )}
      </nav>

      {showBooking && selectedListing && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowBooking(false)}
        >
          <div
            className="login-modal booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Tutup"
              onClick={() => setShowBooking(false)}
            >
              ×
            </button>
            <span className="eyebrow">Pesan Pengajar</span>
            <h2 id="booking-title">{selectedListing.display_name}</h2>
            <p>
              {selectedListing.title} · {selectedListing.city}
            </p>

            <div className="booking-price-box">
              <div>
                <span>Tarif sesi</span>
                <strong>{rupiah(selectedListing.price_per_session)}</strong>
              </div>
              <div>
                <span>Fee GuruLes {platformFeePercent}%</span>
                <strong>
                  {rupiah(
                    Math.floor(
                      (selectedListing.price_per_session * platformFeePercent) /
                        100
                    )
                  )}
                </strong>
              </div>
              <div>
                <span>Diterima pengajar</span>
                <strong>
                  {rupiah(
                    selectedListing.price_per_session -
                      Math.floor(
                        (selectedListing.price_per_session *
                          platformFeePercent) /
                          100
                      )
                  )}
                </strong>
              </div>
            </div>

            <form onSubmit={submitBooking}>
              <BookingAvailabilityPicker
                instructorId={selectedListing.instructor_id}
                durationMinutes={selectedListing.duration_minutes}
                value={bookingDateTime}
                onChange={setBookingDateTime}
              />

              <label>
                Metode belajar
                <select
                  value={bookingLocationType}
                  onChange={event =>
                    setBookingLocationType(
                      event.target.value as
                        | 'Ke rumah'
                        | 'Lokasi latihan'
                        | 'Daring'
                    )
                  }
                >
                  {(selectedListing.service_methods || ['Ke rumah'])
                    .filter(
                      method =>
                        method === 'Ke rumah' ||
                        method === 'Lokasi latihan' ||
                        method === 'Daring'
                    )
                    .concat(
                      selectedListing.service_methods?.some(
                        method =>
                          method === 'Ke rumah' ||
                          method === 'Lokasi latihan' ||
                          method === 'Daring'
                      )
                        ? []
                        : ['Ke rumah']
                    )
                    .map(method => (
                      <option key={method}>{method}</option>
                    ))}
                </select>
              </label>

              {bookingLocationType !== 'Daring' && (
                <label>
                  {bookingLocationType === 'Ke rumah'
                    ? 'Alamat belajar'
                    : 'Lokasi latihan / titik temu'}
                  <input
                    value={bookingAddress}
                    onChange={event => setBookingAddress(event.target.value)}
                    placeholder={
                      bookingLocationType === 'Ke rumah'
                        ? 'Alamat lengkap murid'
                        : 'Lokasi yang disepakati'
                    }
                  />
                  <div className="map-preview">
                    <div className="map-preview-head">
                      <strong>📍 Peta lokasi belajar</strong>
                      <span>
                        {bookingAddress.trim()
                          ? 'Menampilkan alamat yang Anda isi'
                          : 'Ketik alamat untuk memperbarui peta'}
                      </span>
                    </div>
                    <iframe
                      title="Google Maps lokasi belajar"
                      src={googleMapsEmbedUrl(bookingAddress)}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                    {bookingAddress.trim() && (
                      <a
                        className="map-link map-link-form"
                        href={googleMapsUrl(bookingAddress.trim())}
                        target="_blank"
                        rel="noreferrer"
                      >
                        📍 Buka di Google Maps
                      </a>
                    )}
                  </div>
                </label>
              )}

              <label>
                Catatan untuk pengajar
                <textarea
                  value={bookingNotes}
                  onChange={event => setBookingNotes(event.target.value)}
                  placeholder="Contoh: fokus Matematika kelas 5, persiapan ulangan."
                  rows={3}
                />
              </label>

              {bookingError && (
                <div className="form-error">{bookingError}</div>
              )}

              <button className="button primary wide" disabled={bookingBusy}>
                {bookingBusy ? 'Mengirim...' : 'Kirim Permintaan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showRegister && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowRegister(false)}
        >
          <div
            className="login-modal register-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Tutup"
              onClick={() => setShowRegister(false)}
            >
              ×
            </button>
            <span className="eyebrow">Daftar GuruLes</span>
            <h2 id="register-title">Buat akun baru</h2>

            <div className="register-progress" aria-label="Langkah pendaftaran">
              <span className={registerStep === 1 ? 'active' : 'done'}>
                1. Jenis akun
              </span>
              <span className={registerStep === 2 ? 'active' : ''}>
                2. Data akun
              </span>
            </div>

            {registerStep === 1 ? (
              <div className="role-choice-grid">
                <button
                  type="button"
                  className="role-choice"
                  onClick={() => chooseRegisterRole('parent')}
                >
                  <strong>👨‍👩‍👧 Orang Tua</strong>
                  <span>Mencari dan memesan pengajar untuk anak.</span>
                </button>
                <button
                  type="button"
                  className="role-choice"
                  onClick={() => chooseRegisterRole('student')}
                >
                  <strong>🎒 Murid</strong>
                  <span>Mencari pengajar untuk kebutuhan belajar sendiri.</span>
                </button>
                <button
                  type="button"
                  className="role-choice"
                  onClick={() => chooseRegisterRole('instructor')}
                >
                  <strong>👩‍🏫 Guru / Pengajar / Pelatih</strong>
                  <span>Menawarkan jasa belajar, olahraga, seni, atau keterampilan.</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="chosen-role">
                  {registerRole === 'parent'
                    ? '👨‍👩‍👧 Orang Tua'
                    : registerRole === 'student'
                      ? '🎒 Murid'
                      : '👩‍🏫 Guru / Pengajar / Pelatih'}
                </div>

                <label>
                  Nama lengkap
                  <input
                    value={registerName}
                    onChange={event => setRegisterName(event.target.value)}
                    placeholder="Nama lengkap"
                  />
                </label>
                <label>
                  Nomor HP / WhatsApp
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={registerPhone}
                    onChange={event => setRegisterPhone(event.target.value)}
                    placeholder="08xxxxxxxxxx"
                  />
                </label>
                {registerRole !== 'instructor' && (
                  <label>
                    Kabupaten/Kota, Provinsi
                    <input
                      value={registerCity}
                      onChange={event => setRegisterCity(event.target.value)}
                      placeholder="Contoh: Surabaya, Jawa Timur"
                    />
                  </label>
                )}
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={registerPassword}
                    onChange={event => setRegisterPassword(event.target.value)}
                    placeholder="Minimal 8 karakter"
                  />
                </label>
                <label>
                  Ulangi password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={registerConfirmPassword}
                    onChange={event =>
                      setRegisterConfirmPassword(event.target.value)
                    }
                    placeholder="Ketik ulang password"
                  />
                </label>

                {registerRole === 'instructor' && (
                  <div className="instructor-fields">
                    <div className="section-divider">
                      Wilayah layanan pengajar
                    </div>
                    <label>
                      Desa / Kelurahan
                      <input
                        value={registerVillage}
                        onChange={event => setRegisterVillage(event.target.value)}
                        placeholder="Contoh: Sambong"
                      />
                    </label>
                    <label>
                      Kecamatan
                      <input
                        value={registerDistrict}
                        onChange={event => setRegisterDistrict(event.target.value)}
                        placeholder="Contoh: Batang"
                      />
                    </label>
                    <label>
                      Kabupaten / Kota
                      <input
                        value={registerRegency}
                        onChange={event => setRegisterRegency(event.target.value)}
                        placeholder="Contoh: Kabupaten Batang"
                      />
                    </label>
                    <label>
                      Provinsi
                      <input
                        value={registerProvince}
                        onChange={event => setRegisterProvince(event.target.value)}
                        placeholder="Contoh: Jawa Tengah"
                      />
                    </label>

                    <div className="section-divider">
                      Data jasa yang ditawarkan
                    </div>
                    <label>
                      Kategori
                      <select
                        value={registerCategory}
                        onChange={event =>
                          setRegisterCategory(event.target.value)
                        }
                      >
                        <option>Akademik</option>
                        <option>Renang</option>
                        <option>Musik</option>
                        <option>Bela Diri</option>
                        <option>Olahraga</option>
                        <option>Teknologi</option>
                        <option>Agama</option>
                        <option>Seni</option>
                        <option>Keterampilan</option>
                      </select>
                    </label>
                    <label>
                      Judul layanan
                      <input
                        value={registerTitle}
                        onChange={event => setRegisterTitle(event.target.value)}
                        placeholder="Contoh: Matematika SD kelas 1–6"
                      />
                    </label>
                    <label>
                      Metode utama
                      <select
                        value={registerMethod}
                        onChange={event => setRegisterMethod(event.target.value)}
                      >                        <option>Ke rumah</option>
                        <option>Lokasi latihan</option>
                        <option>Daring</option>
                      </select>
                    </label>
                    <label>
                      Tarif per sesi
                      <input
                        type="number"
                        min="10000"
                        step="5000"
                        value={registerPrice}
                        onChange={event => setRegisterPrice(event.target.value)}
                      />
                    </label>
                    <div className="register-note">
                      Profil pengajar akan tampil setelah diverifikasi Admin.
                    </div>
                  </div>
                )}

                {registerError && (
                  <div className="form-error">{registerError}</div>
                )}

                <div className="register-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setRegisterError('');
                      setRegisterStep(1);
                    }}
                  >
                    Kembali
                  </button>
                  <button
                    className="button primary"
                    disabled={registerBusy}
                  >
                    {registerBusy ? 'Mendaftarkan...' : 'Daftar Akun'}
                  </button>
                </div>
              </form>
            )}

            <div className="auth-switch">
              Sudah punya akun?{' '}
              <button
                type="button"
                onClick={() => {
                  setShowRegister(false);
                  setLoginNotice('');
                  setShowLogin(true);
                }}
              >
                Masuk
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogin && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowLogin(false)}
        >
          <div
            className="login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Tutup"
              onClick={() => setShowLogin(false)}
            >
              ×
            </button>
            <span className="eyebrow">Akses GuruLes</span>
            <h2 id="login-title">Masuk ke akun</h2>
            <p>
              Orang tua, murid, dan pengajar masuk dengan nomor HP/WhatsApp.
              Admin juga dapat menggunakan email Admin.
            </p>

            <form onSubmit={handleLogin}>
              <label>
                Nomor HP / Email Admin
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  placeholder="08xxxxxxxxxx atau email Admin"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </label>
              {loginNotice && <div className="form-success">{loginNotice}</div>}
              {loginError && <div className="form-error">{loginError}</div>}
              <button className="button primary wide" disabled={loginBusy}>
                {loginBusy ? 'Memeriksa...' : 'Masuk'}
              </button>
            </form>

            <div className="auth-switch">
              Belum punya akun?{' '}
              <button type="button" onClick={openRegister}>
                Daftar sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;