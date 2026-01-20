import { useState, useEffect, useCallback } from 'react';

/**
 * mCaptcha Widget Component
 * 
 * Dynamically loads and renders mCaptcha proof-of-work widget.
 * 
 * Props:
 * - config: { siteKey, widgetUrl } from backend CAPTCHA_REQUIRED response
 * - onSuccess: (token) => void - Called when user solves CAPTCHA
 * - onError: (error) => void - Called on widget error
 */
const CaptchaWidget = ({ config, onSuccess, onError }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const widgetContainerId = 'mcaptcha-widget';

  // Load mCaptcha script dynamically
  useEffect(() => {
    if (!config?.widgetUrl || !config?.siteKey) {
      setError('CAPTCHA not configured');
      setLoading(false);
      return;
    }

    const scriptId = 'mcaptcha-script';
    let script = document.getElementById(scriptId);

    const initWidget = () => {
      if (window.mcaptcha) {
        try {
          window.mcaptcha.init({
            container: `#${widgetContainerId}`,
            siteKey: config.siteKey,
            callback: (token) => {
              console.log('CAPTCHA solved');
              onSuccess?.(token);
            },
            errorCallback: (err) => {
              console.error('CAPTCHA error:', err);
              setError('CAPTCHA failed. Please try again.');
              onError?.(err);
            }
          });
          setLoading(false);
        } catch (err) {
          setError('Failed to initialize CAPTCHA');
          setLoading(false);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `${config.widgetUrl}/glue.min.js`;
      script.async = true;
      script.onload = initWidget;
      script.onerror = () => {
        setError('Failed to load CAPTCHA');
        setLoading(false);
      };
      document.body.appendChild(script);
    } else {
      initWidget();
    }

    return () => {
      // Cleanup widget on unmount
      if (window.mcaptcha?.destroy) {
        window.mcaptcha.destroy();
      }
    };
  }, [config, onSuccess, onError]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
        <p className="font-semibold">⚠️ Security Verification Error</p>
        <p className="mt-1">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-indigo-400 hover:underline"
        >
          Refresh page
        </button>
      </div>
    );
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
      <p className="text-yellow-400 text-sm font-semibold mb-2">
        🔒 Security Verification Required
      </p>
      <p className="text-gray-400 text-xs mb-3">
        Too many login attempts. Please complete the verification below.
      </p>
      
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="ml-3 text-gray-400 text-sm">Loading verification...</span>
        </div>
      )}
      
      <div 
        id={widgetContainerId}
        className="mcaptcha-widget"
        style={{ minHeight: loading ? '0' : '100px' }}
      ></div>
    </div>
  );
};

/**
 * Custom hook for managing CAPTCHA state in forms
 */
export function useCaptcha() {
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaConfig, setCaptchaConfig] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);

  const handleCaptchaRequired = useCallback((response) => {
    if (response.code === 'CAPTCHA_REQUIRED') {
      setCaptchaRequired(true);
      setCaptchaConfig(response.captcha);
      return true;
    }
    return false;
  }, []);

  const handleCaptchaSuccess = useCallback((token) => {
    setCaptchaToken(token);
  }, []);

  const resetCaptcha = useCallback(() => {
    setCaptchaRequired(false);
    setCaptchaConfig(null);
    setCaptchaToken(null);
  }, []);

  return {
    captchaRequired,
    captchaConfig,
    captchaToken,
    handleCaptchaRequired,
    handleCaptchaSuccess,
    resetCaptcha,
    // For including in login request
    getCaptchaPayload: () => captchaToken ? { captchaToken } : {}
  };
}

export default CaptchaWidget;
