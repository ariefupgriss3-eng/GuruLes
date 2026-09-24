import { FormEvent, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type LearningLocation = {
  village: string;
  district: string;
  regency: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
};

type RegionListing = {
  village: string | null;
  district: string | null;
  regency: string | null;
  province: string | null;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type LocationScope = 'nearby' | 'regency' | 'province' | 'all';

async function readDevicePosition() {
  if (Capacitor.isNativePlatform()) {
    await Geolocation.requestPermissions();
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    });
    return position.coords;
  }

  if (!navigator.geolocation) {
    throw new Error('GPS_UNSUPPORTED');
  }

  return await new Promise<GeolocationCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
}

export const EMPTY_LEARNING_LOCATION: LearningLocation = {
  village: '',
  district: '',
  regency: '',
  province: '',
  latitude: null,
  longitude: null,
};

export function normalizeRegion(value: string | null | undefined) {
  return (value || '')
    .trim()
    .toLocaleLowerCase('id-ID')
    .replace(/\s+/g, ' ');
}

export function distanceKm(
  aLat: number | null | undefined,
  aLng: number | null | undefined,
  bLat: number | null | undefined,
  bLng: number | null | undefined
) {
  if (
    aLat == null || aLng == null || bLat == null || bLng == null ||
    ![aLat, aLng, bLat, bLng].every(Number.isFinite)
  ) return null;
  const rad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function locationScore(
  listing: RegionListing,
  location: LearningLocation
) {
  const same = (a: string | null | undefined, b: string) =>
    Boolean(b && normalizeRegion(a) === normalizeRegion(b));

  if (same(listing.village, location.village)) return 40;
  if (same(listing.district, location.district)) return 30;
  if (
    same(listing.regency, location.regency) ||
    same(listing.city, location.regency)
  ) {
    return 20;
  }
  if (same(listing.province, location.province)) return 10;
  return 0;
}

export function matchesLocationScope(
  listing: RegionListing,
  location: LearningLocation,
  scope: LocationScope
) {
  if (scope === 'all') return true;

  if (scope === 'province') {
    return Boolean(
      location.province &&
        normalizeRegion(listing.province) === normalizeRegion(location.province)
    );
  }

  if (scope === 'regency') {
    return Boolean(
      location.regency &&
        (normalizeRegion(listing.regency) === normalizeRegion(location.regency) ||
          normalizeRegion(listing.city) === normalizeRegion(location.regency))
    );
  }

  return true;
}

function locationLabel(location: LearningLocation) {
  return (
    location.village ||
    location.district ||
    location.regency ||
    location.province ||
    'Atur lokasi belajar'
  );
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map(value => (value || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'id-ID'));
}

export function LocationFilter({
  listings,
  value,
  scope,
  onScopeChange,
  onSave,
}: {
  listings: RegionListing[];
  value: LearningLocation;
  scope: LocationScope;
  onScopeChange: (scope: LocationScope) => void;
  onSave: (location: LearningLocation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LearningLocation>(value);
  const [gpsMessage, setGpsMessage] = useState('');

  const provinces = useMemo(
    () => unique(listings.map(item => item.province)),
    [listings]
  );

  const regencies = useMemo(
    () =>
      unique(
        listings
          .filter(
            item =>
              !draft.province ||
              normalizeRegion(item.province) === normalizeRegion(draft.province)
          )
          .map(item => item.regency || item.city)
      ),
    [listings, draft.province]
  );

  const districts = useMemo(
    () =>
      unique(
        listings
          .filter(item => {
            const sameProvince =
              !draft.province ||
              normalizeRegion(item.province) === normalizeRegion(draft.province);
            const sameRegency =
              !draft.regency ||
              normalizeRegion(item.regency || item.city) ===
                normalizeRegion(draft.regency);
            return sameProvince && sameRegency;
          })
          .map(item => item.district)
      ),
    [listings, draft.province, draft.regency]
  );

  const villages = useMemo(
    () =>
      unique(
        listings
          .filter(item => {
            const sameProvince =
              !draft.province ||
              normalizeRegion(item.province) === normalizeRegion(draft.province);
            const sameRegency =
              !draft.regency ||
              normalizeRegion(item.regency || item.city) ===
                normalizeRegion(draft.regency);
            const sameDistrict =
              !draft.district ||
              normalizeRegion(item.district) === normalizeRegion(draft.district);
            return sameProvince && sameRegency && sameDistrict;
          })
          .map(item => item.village)
      ),
    [listings, draft.province, draft.regency, draft.district]
  );

  const hasLocation = Boolean(
    value.village || value.district || value.regency || value.province ||
    (value.latitude != null && value.longitude != null)
  );

  function editLocation() {
    setDraft(value);
    setOpen(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      village: draft.village.trim(),
      district: draft.district.trim(),
      regency: draft.regency.trim(),
      province: draft.province.trim(),
      latitude: draft.latitude,
      longitude: draft.longitude,
    };
    onSave(next);
    onScopeChange(
      next.regency ||
        next.province ||
        (next.latitude != null && next.longitude != null)
        ? 'nearby'
        : 'all'
    );
    setOpen(false);
  }

  return (
    <>
      <div className="location-market-bar">
        <button className="location-current" type="button" onClick={editLocation}>
          <span>📍</span>
          <div>
            <small>Lokasi belajar</small>
            <strong>{locationLabel(value)}</strong>
          </div>
          <b>Ubah</b>
        </button>

        <div className="location-scopes" aria-label="Jangkauan lokasi">
          <button
            className={scope === 'nearby' ? 'active' : ''}
            onClick={() => (hasLocation ? onScopeChange('nearby') : editLocation())}
          >
            Terdekat
          </button>
          <button
            className={scope === 'regency' ? 'active' : ''}
            disabled={!value.regency}
            onClick={() => onScopeChange('regency')}
          >
            Kab/Kota Saya
          </button>
          <button
            className={scope === 'province' ? 'active' : ''}
            disabled={!value.province}
            onClick={() => onScopeChange('province')}
          >
            Provinsi
          </button>
          <button
            className={scope === 'all' ? 'active' : ''}
            onClick={() => onScopeChange('all')}
          >
            Semua
          </button>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form
            className="location-modal"
            onSubmit={submit}
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="location-modal-head">
              <div>
                <span className="eyebrow">Lokasi Belajar</span>
                <h3>Sesuaikan wilayah pencarian</h3>
                <p>
                  Lokasi ini hanya dipakai untuk memprioritaskan pengajar dan
                  tidak menampilkan alamat rumah Anda.
                </p>
              </div>
              <button
                className="location-modal-close"
                type="button"
                aria-label="Tutup"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="gps-location-box">
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setGpsMessage('');
                  void readDevicePosition()
                    .then(coords => {
                      setDraft(current => ({
                        ...current,
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                      }));
                      setGpsMessage('✓ Lokasi perangkat aktif untuk perhitungan jarak.');
                    })
                    .catch(error => {
                      setGpsMessage(
                        error instanceof Error && error.message === 'GPS_UNSUPPORTED'
                          ? 'Perangkat ini tidak mendukung lokasi GPS.'
                          : 'Izin lokasi tidak diberikan. Anda tetap dapat memilih wilayah manual.'
                      );
                    });
                }}
              >
                📍 Gunakan Lokasi Perangkat
              </button>
              {(draft.latitude != null && draft.longitude != null) && (
                <span>GPS aktif</span>
              )}
              {gpsMessage && <small>{gpsMessage}</small>}
            </div>

            <div className="location-fields">
              <label>
                Provinsi
                <input
                  list="gurules-provinces"
                  value={draft.province}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      province: event.target.value,
                      regency: '',
                      district: '',
                      village: '',
                    }))
                  }
                  placeholder="Contoh: Jawa Tengah"
                />
                <datalist id="gurules-provinces">
                  {provinces.map(item => <option value={item} key={item} />)}
                </datalist>
              </label>

              <label>
                Kabupaten / Kota
                <input
                  list="gurules-regencies"
                  value={draft.regency}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      regency: event.target.value,
                      district: '',
                      village: '',
                    }))
                  }
                  placeholder="Contoh: Kabupaten Batang"
                />
                <datalist id="gurules-regencies">
                  {regencies.map(item => <option value={item} key={item} />)}
                </datalist>
              </label>

              <label>
                Kecamatan
                <input
                  list="gurules-districts"
                  value={draft.district}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      district: event.target.value,
                      village: '',
                    }))
                  }
                  placeholder="Contoh: Batang"
                />
                <datalist id="gurules-districts">
                  {districts.map(item => <option value={item} key={item} />)}
                </datalist>
              </label>

              <label>
                Desa / Kelurahan
                <input
                  list="gurules-villages"
                  value={draft.village}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      village: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Kecepak"
                />
                <datalist id="gurules-villages">
                  {villages.map(item => <option value={item} key={item} />)}
                </datalist>
              </label>
            </div>

            <div className="location-modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() =>
                  setDraft({
                    village: '',
                    district: '',
                    regency: '',
                    province: '',
                    latitude: null,
                    longitude: null,
                  })
                }
              >
                Reset
              </button>
              <button className="button primary" type="submit">
                Gunakan Lokasi
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
