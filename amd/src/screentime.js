class Field {
    constructor(selector) {
        this.selector = selector;
        this.element = document.querySelector(selector);
        this.updateMetrics();
    }

    updateMetrics() {
        const rect = this.element.getBoundingClientRect();
        this.top = rect.top + window.scrollY;
        this.bottom = rect.bottom + window.scrollY;
        this.height = rect.height;
    }

    isOnScreen(viewport, percentOnScreen) {
        this.updateMetrics();
        const threshold = this.height * (percentOnScreen / 100);
        return (
            this.bottom - threshold > viewport.top &&
            this.top + threshold < viewport.bottom
        );
    }
}

export default class ScreenTime {
    constructor(options = {}) {
        this.viewport = {
            top: window.scrollY,
            bottom: window.scrollY + window.innerHeight
        };
        this.options = {...ScreenTime.defaults, ...options};
        this.field = new Field(this.options.field.selector);
        this.timer = null;
        this.log = {};
        this.reportTimer = 0;
        this.reportIntervalId = null;
        this.inactivityCounter = 0;
        this.inactivityTimer = 0;
        this.lastReport = 0;
        this.reportInterval = this.options.reportInterval * 1000;
        document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this));
        window.addEventListener('scroll', this.updateViewport.bind(this));
        window.addEventListener('resize', this.updateViewport.bind(this));
        this.start();
    }

    updateViewport() {
        this.viewport.top = window.scrollY;
        this.viewport.bottom = this.viewport.top + window.innerHeight;
    }

    static get defaults() {
        return {
            fields: [],
            percentOnScreen: 50,
            reportInterval: 10,
            googleAnalytics: false,
            everySecondCallback: function () {
            },
            onInactivity: function () {
            },
            onStart: function () {
            },
            onReport: function () {
            }
        };
    }

    start() {
        if (this.options.onStart) {
            this.options.onStart();
        }
        this.clearTimers();
        this.isActive = true;
        this.timer = setInterval(() => {
            this.checkFields();
            this.inactivityTimer++;
            this.reportTimer++;
            if (this.inactivityTimer >= this.options.inactiveInterval) {
                this.handleInactivity();
            }
            if (this.reportTimer >= this.options.reportInterval) {
                this.report();
            }
        }, 1000);
        this.addActivityListeners();
    }

    addActivityListeners() {
        const activityEvents = ['click', 'scroll', 'mousemove', 'keydown', 'touchstart', 'touchmove', 'wheel'];
        const inactivityEvents = ['beforeunload', 'unload', 'pagehide', 'blur'];

        const handleReset = (e) => this.resetInactivityTimer(e);
        activityEvents.forEach(type => {
            window.addEventListener(type, handleReset, { passive: true });
        });

        const handleFinish = (e) => this.handleInactivity(e);
        inactivityEvents.forEach(type => {
            window.addEventListener(type, handleFinish, { passive: true });
        });

        const attachToIframe = (iframe) => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                activityEvents.forEach(type => {
                    iframeDoc.addEventListener(type, handleReset, { passive: true });
                });
                inactivityEvents.forEach(type => {
                    iframeDoc.addEventListener(type, handleFinish, { passive: true });
                });

                const nestedIframes = iframeDoc.querySelectorAll('iframe');

                nestedIframes.forEach(nested => {
                    if (nested.contentDocument && nested.contentDocument.readyState === 'complete') {
                        attachToIframe(nested);
                    }
                    nested.addEventListener('load', () => attachToIframe(nested));
                });
            } catch (e) {
                // it's possible we've encountered a cross-origin iframe. Just ignore, we do the best we can
            }
        };

        // Attach events on all top-level iframes which will then attach recursively to nested iframes
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            // If iframe is already loaded
            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                attachToIframe(iframe);
            }
            // Or when it eventually loads
            iframe.addEventListener('load', () => attachToIframe(iframe));
        });

        // Page visibility logic
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                handleFinish({ type: 'visibilitychange-hidden' });
            } else {
                handleReset({ type: 'visibilitychange-visible' });
            }
        }, { passive: true });
    }

    resetInactivityTimer(/* e */) {
        this.inactivityTimer = 0;
        if (!this.isActive) {
            this.isActive = true;
            this.start();
        }
    }

    handleInactivity(/* e */) {
        if (this.options.onInactivity) {
            this.options.onInactivity();
        }
        this.isActive = false;
        this.report();
        this.clearTimers();
    }

    clearTimers() {
        clearInterval(this.timer);
        this.timer = null;
    }

    checkFields() {
        if (!this.isActive) {
            return;
        }
        if (this.field.isOnScreen(this.viewport, this.options.percentOnScreen)) {
            this.log[this.field.selector] = (this.log[this.field.selector] || 0) + 1;
        }
        if (this.options.everySecondCallback) {
            this.options.everySecondCallback(this.log);
        }
    }

    report() {
        const shouldReport = Date.now() - this.lastReport >= 10;
        if (!shouldReport) {
            return;
        }
        const hasFields = Object.keys(this.log).length > 0;
        if (hasFields && this.options.onReport) {
            this.options.onReport(this.log);
        }
        this.reportTimer = 0;
        this.lastReport = Date.now();
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this.stop();
            this.report();
            return;
        }
        this.start();
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
    }
}
