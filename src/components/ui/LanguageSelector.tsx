import {useEffect, useRef, useState} from 'react';
import {Check, ChevronDown, Globe} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {setAppLanguage} from '../../i18n';
import {SUPPORTED_LANGUAGES, type SupportedLanguage} from '../../i18n/languages';

export function LanguageSelector({
  compact = false,
  tone = 'dark',
}: {
  compact?: boolean;
  tone?: 'dark' | 'cream';
}) {
  const {i18n, t} = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentCode = (
    SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language) ? i18n.language : 'en'
  ) as SupportedLanguage;
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentCode) ?? SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelect = (code: SupportedLanguage) => {
    setAppLanguage(code);
    setOpen(false);
  };

  const triggerClass =
    tone === 'cream'
      ? 'bg-[#FAF6EE] hover:bg-[#EBE3D3] border-[#172C40]/20 text-[#172C40]'
      : 'bg-[#F5F0E6]/10 hover:bg-[#F5F0E6]/18 border-[#F5F0E6]/25 text-[#F5F0E6]';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('language.label')}: ${currentLang.nativeLabel} (${currentLang.englishLabel})`}
        data-testid="language-selector-trigger"
        className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${triggerClass}`}
      >
        <Globe
          className={`w-4 h-4 shrink-0 ${tone === 'cream' ? 'text-[#176D65]' : 'text-[#5EEAD4]'}`}
          aria-hidden="true"
        />
        <span className="font-semibold">{currentLang.nativeLabel}</span>
        {!compact && currentLang.code !== 'en' && (
          <span
            className={`hidden sm:inline text-xs ${
              tone === 'cream' ? 'text-[#172C40]/70' : 'text-[#F5F0E6]/75'
            }`}
          >
            ({currentLang.englishLabel})
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-150 shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language.selectPrompt')}
          data-testid="language-selector-menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#F5F0E6] text-[#172C40] border border-[#172C40]/20 shadow-2xl p-1.5 z-50"
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-[#172C40]/70 border-b border-[#172C40]/12 mb-1">
            {t('language.selectPrompt')}
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = lang.code === currentCode;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={active}
                data-testid={`lang-option-${lang.code}`}
                onClick={() => handleSelect(lang.code)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#172C40] text-[#F5F0E6]'
                    : 'text-[#172C40] hover:bg-[#EBE3D3]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-snug">{lang.nativeLabel}</div>
                  <div
                    className={`text-xs ${
                      active ? 'text-[#F5F0E6]/75' : 'text-[#172C40]/65'
                    }`}
                  >
                    {lang.englishLabel} · {lang.scriptLabel}
                  </div>
                </div>
                {active && (
                  <Check
                    className={`w-4 h-4 shrink-0 ${active ? 'text-[#5EEAD4]' : 'text-[#269B91]'}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
