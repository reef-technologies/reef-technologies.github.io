(function () {
    'use strict';
    const COOKIE = 'reef_consent';
    const MAX_AGE = 180 * 86400;
    function parseConsent(value, now = Math.floor(Date.now() / 1000)) {
        const match = /^v2\.([0-9]{10})\.([01])\.([01])$/.exec(value || '');
        if (!match) return null;
        const timestamp = Number(match[1]);
        if (timestamp > now || now - timestamp >= MAX_AGE) return null;
        return {timestamp, analytics: match[2] === '1', external: match[3] === '1'};
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = {parseConsent};
    if (typeof document === 'undefined') return;
    function read() {
        try {
            const item = document.cookie.split('; ').find(value => value.startsWith(COOKIE + '='));
            return parseConsent(item ? item.slice(COOKIE.length + 1) : '');
        } catch (_) { return null; }
    }
    function allows(purpose) { return read()?.[purpose] === true; }
    function clearAnalyticsStorage() {
        try { sessionStorage.removeItem('_swa'); } catch (_) { /* Storage may be blocked. */ }
    }
    function expire(name) {
        try { document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax'; } catch (_) { /* No storage access. */ }
    }
    const draftKey = 'reef_consent_draft:' + location.pathname;
    const draftForms = ['reef-contact-form', 'submissionForm'];
    function draftFields(form) {
        return Array.from(form.elements).filter(field => field.name && !field.disabled &&
            (field.tagName === 'TEXTAREA' || ['text', 'email', 'tel', 'checkbox', 'radio'].includes(field.type)));
    }
    let unloading = false;
    function unloadTrackers() {
        if (unloading) return;
        unloading = true;
        // Necessary, short-lived storage to avoid losing a message/application
        // when stopping third-party scripts requires a new document.
        const forms = {};
        draftForms.forEach(id => {
            const form = document.getElementById(id);
            if (form) forms[id] = draftFields(form).map(field => ({
                name: field.name, type: field.type, value: field.value, checked: field.checked
            }));
        });
        try {
            sessionStorage.setItem(draftKey, JSON.stringify({time: Date.now(), forms}));
        } catch (_) { /* Withdrawal still takes effect if storage is unavailable. */ }
        // GET the page; reload() could resubmit an application validation POST.
        location.replace(location.href);
    }
    function restoreDraft() {
        try {
            const raw = sessionStorage.getItem(draftKey);
            sessionStorage.removeItem(draftKey);
            if (!raw) return;
            const draft = JSON.parse(raw);
            const age = Date.now() - draft.time;
            if (!Number.isFinite(age) || age < 0 || age > 5 * 60 * 1000) return;
            draftForms.forEach(id => {
                const form = document.getElementById(id);
                if (!form || !Array.isArray(draft.forms?.[id])) return;
                draftFields(form).forEach(field => {
                    const saved = draft.forms[id].find(item => item.name === field.name && item.type === field.type &&
                        (!['checkbox', 'radio'].includes(field.type) || item.value === field.value));
                    if (!saved) return;
                    if (['checkbox', 'radio'].includes(field.type)) field.checked = saved.checked === true;
                    else if (typeof saved.value === 'string') field.value = saved.value;
                });
            });
        } catch (_) { /* Missing or unavailable storage must not block the site. */ }
    }
    const loaded = {analytics: false, external: false};
    window.ReefConsent = {allows, open: () => {}, markExternalLoaded: () => { loaded.external = true; }};
    function startAnalytics() {
        if (!allows('analytics') || loaded.analytics) return;
        loaded.analytics = true;
        const script = document.createElement('script');
        script.src = 'https://cdn.counter.dev/script.js';
        script.dataset.id = 'f525abc7-aecb-4241-8754-d281ee295ed2';
        script.dataset.utcoffset = '1';
        document.head.appendChild(script);
    }
    function mustUnload() {
        return (loaded.analytics && !allows('analytics')) || (loaded.external && !allows('external'));
    }
    // Evaluate before the terminal bundle executes. Legacy acknowledgement is not consent.
    expire('gdpr');
    expire('uid');
    if (!allows('analytics')) clearAnalyticsStorage();

    document.addEventListener('DOMContentLoaded', function () {
        restoreDraft();
        const panel = document.getElementById('reef-cookie-panel');
        if (!panel) return;
        const analytics = panel.querySelector('[name="analytics"]');
        const external = panel.querySelector('[name="external"]');
        const details = panel.querySelector('details');
        let returnFocus;
        function open(showDetails = false) {
            returnFocus = document.activeElement;
            analytics.checked = allows('analytics');
            if (external) external.checked = allows('external');
            details.open = showDetails;
            panel.hidden = false;
            panel.querySelector('[data-consent="reject"]').focus();
        }
        window.ReefConsent.open = () => open(true);
        document.querySelectorAll('[data-cookie-settings]').forEach(button => {
            button.addEventListener('click', () => open(true));
        });
        function save(analyticsEnabled, externalEnabled) {
            const value = `v2.${Math.floor(Date.now() / 1000)}.${Number(analyticsEnabled)}.${Number(externalEnabled)}`;
            document.cookie = `${COOKIE}=${value}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
            if (!analyticsEnabled) clearAnalyticsStorage();
            panel.hidden = true;
            if (returnFocus?.isConnected) returnFocus.focus();
            // Stop already-running third parties on withdrawal.
            if (mustUnload()) {
                unloadTrackers();
            } else {
                startAnalytics();
            }
        }
        panel.querySelector('[data-consent="reject"]').addEventListener('click', () => save(false, false));
        panel.querySelector('[data-consent="accept"]').addEventListener('click', () => save(true, Boolean(external)));
        panel.querySelector('[data-consent="save"]').addEventListener('click', () => save(analytics.checked, Boolean(external?.checked)));
        panel.querySelector('[data-consent="close"]').addEventListener('click', () => {
            panel.hidden = true;
            if (returnFocus?.isConnected) returnFocus.focus();
        });
        if (!read()) open();
        startAnalytics();
        // Cookies are shared across tabs. Re-check on focus and while the page
        // stays open, including expiry and withdrawal of contact protection.
        const check = () => { if (mustUnload()) unloadTrackers(); };
        window.addEventListener('focus', check);
        window.setInterval(check, 1000);
    });
})();
