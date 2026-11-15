import {useState} from 'react';
import {Download, Smartphone, X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {usePWAInstall} from '../../hooks/usePWAInstall';
import {Button} from './AarviPrimitives';

export function PWAInstallButton({variant = 'header'}: {variant?: 'header' | 'settings'}) {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const {t} = useTranslation();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <span className="text-sm font-semibold text-[#176D65]">{t('pwa.installedStatus')}</span>
      );
    }
    return null;
  }

  if (isInstallable) {
    return (
      <Button
        size="sm"
        variant={variant === 'header' ? 'navyOutline' : 'teal'}
        onClick={() => void install()}
        data-testid="pwa-install-button"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>{t('pwa.installApp')}</span>
      </Button>
    );
  }

  if (isIOS || variant === 'settings') {
    return (
      <>
        <Button
          size="sm"
          variant={variant === 'header' ? 'navyOutline' : 'secondary'}
          onClick={() => setShowIOSGuide(true)}
          data-testid="pwa-ios-install-button"
        >
          <Smartphone className="w-4 h-4" aria-hidden="true" />
          <span>{isIOS ? t('pwa.installIOS') : t('pwa.installHow')}</span>
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2031]/75 p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#F5F0E6] text-[#172C40] p-6 shadow-2xl border border-[#172C40]/20">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-bold">{t('pwa.guideTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={t('common.close')}
                  className="p-2 rounded-lg hover:bg-[#172C40]/10 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-sm text-[#172C40]/80 leading-relaxed">
                {isIOS ? t('pwa.iosInstructions') : t('pwa.browserInstructions')}
              </p>
              <div className="mt-5 flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setShowIOSGuide(false)}>
                  {t('common.close')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
