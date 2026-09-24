import { useEffect, useMemo, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PWAInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  const ios = useMemo(() => isIos(), []);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowIosTip(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <span className="pwa-installed-badge" title="GuruLes sudah terpasang">
        ✓ App terpasang
      </span>
    );
  }

  if (!promptEvent && !ios) return null;

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      setPromptEvent(null);
      return;
    }

    if (ios) setShowIosTip(value => !value);
  }

  return (
    <div className="pwa-install-wrap">
      <button className="button pwa-install-button small" type="button" onClick={() => void install()}>
        ⬇️ Install GuruLes
      </button>
      {showIosTip && (
        <div className="pwa-ios-tip" role="status">
          Di Safari: tekan <strong>Bagikan</strong> lalu pilih <strong>Tambahkan ke Layar Utama</strong>.
        </div>
      )}
    </div>
  );
}

export function PWAUpdateNotice() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    void navigator.serviceWorker.ready.then(registration => {
      if (registration.waiting) setWaiting(registration.waiting);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(worker);
          }
        });
      });
    });
  }, []);

  if (!waiting) return null;

  return (
    <div className="pwa-update-toast">
      <span>Versi GuruLes terbaru tersedia.</span>
      <button
        type="button"
        onClick={() => {
          waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }}
      >
        Muat ulang
      </button>
    </div>
  );
}
