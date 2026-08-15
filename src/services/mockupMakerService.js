/**
 * Design handoff to MockupMaker.
 *
 * The two apps sit on different domains, so nothing shared by the browser —
 * localStorage, sessionStorage, cookies — reaches across. postMessage is the
 * one channel that does, and it carries a data URL of any size, which matters
 * because a generated design is a base64 PNG measured in megabytes.
 *
 * The handshake exists because neither side knows the other's timing. The new
 * tab announces itself once it has mounted; until that arrives the design is
 * re-sent on a short interval, so a missed announcement still lands. Delivery
 * is only reported once MockupMaker acknowledges it.
 */

const MOCKUP_MAKER_URL =
  import.meta.env.VITE_MOCKUP_MAKER_URL || 'https://mockuppmaker.netlify.app';
const MOCKUP_MAKER_ORIGIN = new URL(MOCKUP_MAKER_URL).origin;

const RESEND_INTERVAL_MS = 700;
const HANDOFF_TIMEOUT_MS = 20000;

export const mockupMakerService = {
  async sendDesignToMockupMaker(design) {
    const imageUrl = design?.designImage;
    if (!imageUrl || imageUrl === '/placeholder-design.png') {
      return {
        success: false,
        error: 'No artwork yet — press "Generate Image" before sending.',
        mockup: null,
      };
    }

    const payload = {
      type: 'trendmint:design',
      design: {
        id: `design_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        name: design.designName || 'TrendMint design',
        imageUrl,
        category: design.category || 'apparel',
        colors: design.colors || [],
        source: 'trendmint',
        createdAt: Date.now(),
      },
    };

    // Opened from the click handler, so this is a user gesture and survives
    // pop-up blocking.
    const target = window.open(MOCKUP_MAKER_URL, '_blank');
    if (!target) {
      return {
        success: false,
        error: 'MockupMaker could not be opened — allow pop-ups for this site.',
        mockup: null,
      };
    }

    return new Promise((resolve) => {
      let settled = false;

      // Posts sent before the tab has loaded MockupMaker are dropped by the
      // browser rather than delivered to whatever is there — the targetOrigin
      // has to match. That is why this repeats instead of firing once.
      const send = () => {
        try {
          target.postMessage(payload, MOCKUP_MAKER_ORIGIN);
        } catch {
          // Tab closed mid-flight; the timeout reports it.
        }
      };

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearInterval(resend);
        clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        resolve(result);
      };

      function onMessage(event) {
        if (event.origin !== MOCKUP_MAKER_ORIGIN) return;
        if (event.data?.type === 'mockupmaker:ready') send();
        if (event.data?.type === 'mockupmaker:received') {
          finish({ success: true, mockup: null });
        }
      }

      window.addEventListener('message', onMessage);
      const resend = setInterval(send, RESEND_INTERVAL_MS);
      const timeout = setTimeout(
        () =>
          finish({
            success: false,
            error: 'MockupMaker did not answer. Reload the new tab and try again.',
            mockup: null,
          }),
        HANDOFF_TIMEOUT_MS,
      );

      send();
    });
  },
};
