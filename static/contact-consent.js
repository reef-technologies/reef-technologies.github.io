(function () {
    'use strict';
    const siteKey = document.currentScript.dataset.siteKey;
    const form = document.getElementById('reef-contact-form');
    if (!form) return;
    const status = document.getElementById('reef-contact-status');
    const button = form.querySelector('[type="submit"]');
    button.disabled = false;
    let loading;
    function loadProtection() {
        if (!loading) {
            loading = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey);
                script.onload = () => window.grecaptcha.ready(resolve);
                script.onerror = () => { script.remove(); loading = null; reject(new Error('Protection unavailable')); };
                window.ReefConsent.markExternalLoaded();
                document.head.appendChild(script);
            });
        }
        return loading;
    }
    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!window.ReefConsent?.allows('external')) {
            status.textContent = 'To send this form, enable Contact form protection in Cookie settings, or use the email link above.';
            window.ReefConsent?.open();
            return;
        }
        if (button.disabled) return;
        button.disabled = true;
        status.textContent = 'Checking spam protection…';
        try {
            const token = await Promise.race([
                loadProtection().then(() => {
                    if (!window.ReefConsent.allows('external')) throw new Error('Consent withdrawn');
                    return window.grecaptcha.execute(siteKey, {action: 'contact'});
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Protection timed out')), 15000))
            ]);
            if (!window.ReefConsent.allows('external') || !token) throw new Error('No permission or token');
            document.getElementById('captchaResponse').value = token;
            // Submit only after a fresh token; avoid re-entering this handler.
            HTMLFormElement.prototype.submit.call(form);
        } catch (_) {
            status.textContent = 'The form could not be sent. Please try again or use the email link above.';
            button.disabled = false;
        }
    });
})();
