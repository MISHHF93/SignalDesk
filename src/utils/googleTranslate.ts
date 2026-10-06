/**
 * Google Translation Integration Engine
 * Enables deep, full-system automatic translation of all pages, elements, cards,
 * and dynamic text using Google Translate tools alongside the native enterprise dictionary.
 */

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

let isInitialized = false;

export function initializeGoogleTranslate(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (isInitialized && window.google?.translate) return Promise.resolve(true);

  return new Promise((resolve) => {
    // 1. Ensure hidden anchor element exists
    let container = document.getElementById('google_translate_element');
    if (!container) {
      container = document.createElement('div');
      container.id = 'google_translate_element';
      container.style.position = 'fixed';
      container.style.bottom = '10px';
      container.style.right = '10px';
      container.style.zIndex = '99999';
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    // 2. Define callback
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            autoDisplay: false,
            includedLanguages: 'en,es,fr,de,ja,zh-CN,ar,pt,it,hi,ko,ru,nl,he,sv,pl,tr,id,uk,vi',
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          },
          'google_translate_element'
        );
        isInitialized = true;
        resolve(true);
      } else {
        resolve(false);
      }
    };

    // 3. Load script if not already added
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.type = 'text/javascript';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    } else {
      resolve(true);
    }
  });
}

/**
 * Directs Google Translate to apply the designated language to the active DOM
 */
export function applyGoogleTranslation(langCode: string): boolean {
  if (typeof window === 'undefined') return false;

  const codeMap: Record<string, string> = {
    zh: 'zh-CN',
    he: 'iw',
  };
  const targetCode = codeMap[langCode] || langCode;

  // Set the standard Google Translate cookies for persistence across pages
  try {
    document.cookie = `googtrans=/auto/${targetCode}; path=/;`;
    document.cookie = `googtrans=/en/${targetCode}; path=/;`;
    if (window.location.hostname) {
      document.cookie = `googtrans=/auto/${targetCode}; path=/; domain=.${window.location.hostname};`;
      document.cookie = `googtrans=/en/${targetCode}; path=/; domain=.${window.location.hostname};`;
    }
  } catch {
    // ignore cookie errors in sandboxed environments
  }

  // If Google Translate element select dropdown is present, change it
  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (select) {
    select.value = targetCode;
    select.dispatchEvent(new Event('change'));
    return true;
  }

  return false;
}
