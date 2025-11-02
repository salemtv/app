// professional-popup-blocker.js
(function() {
    'use strict';

    class ProfessionalPopupBlocker {
        constructor() {
            this.trustedVideoDomains = new Set([
                'youtube.com', 'youtu.be', 'youtube-nocookie.com',
                'vimeo.com', 'player.vimeo.com', 
                'dailymotion.com', 'dmcdn.net',
                'twitch.tv', 'ttvnw.net',
                'spotify.com', 'scdn.co',
                'wistia.com', 'fast.wistia.net',
                'netflix.com', 'nflxso.net',
                'soundcloud.com',
                'facebook.com/plugins/video.php',
                'streamable.com'
            ]);

            this.adPatterns = [
                /(?:^|\.)doubleclick\.net$/i,
                /(?:^|\.)googleadsyndication\.com$/i,
                /(?:^|\.)googlesyndication\.com$/i,
                /(?:^|\.)adsystem\.com$/i,
                /(?:^|\.)adservice\.google\./i,
                /\/ads?\//i,
                /\/banners?\//i,
                /\/popups?\//i,
                /_ad\./i,
                /\.ads?\./i,
                /tracking/i,
                /analytics/i,
                /beacon/i,
                /affiliate/i,
                /promo/i,
                /marketing/i
            ];

            this.init();
        }

        init() {
            this.overrideWindowOpen();
            this.overrideEventTarget();
            this.setupMutationObserver();
            this.setupMessageInterceptor();
            this.setupBlurHandler();
            this.sandboxAllIframes();
            
            console.log('🛡️ Professional Popup Blocker activated');
        }

        overrideWindowOpen() {
            const originalOpen = window.open;
            
            Object.defineProperty(window, 'open', {
                value: (url, name, features) => {
                    if (this.shouldBlockPopup(url, 'window.open')) {
                        this.logBlockedPopup(url, 'window.open');
                        return null;
                    }
                    return originalOpen.call(window, url, name, features);
                },
                writable: false,
                configurable: false
            });
        }

        overrideEventTarget() {
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                // Block beforeunload events that might trigger popups
                if (type === 'beforeunload' && this instanceof HTMLIFrameElement) {
                    this.logBlockedEvent('beforeunload', this.src);
                    return;
                }
                
                // Intercept click events on iframes
                if (type === 'click' && this instanceof HTMLIFrameElement) {
                    const wrappedListener = (event) => {
                        this.handleIframeClick(event, this);
                        listener.call(this, event);
                    };
                    return originalAddEventListener.call(this, type, wrappedListener, options);
                }
                
                return originalAddEventListener.call(this, type, listener, options);
            }.bind(this);
        }

        handleIframeClick(event, iframe) {
            // Set up temporary popup blocking for iframe clicks
            this.temporaryPopupBlock(1000);
            this.logIframeInteraction(iframe);
        }

        temporaryPopupBlock(duration) {
            const originalOpen = window.open;
            let blocked = false;
            
            window.open = (url, name, features) => {
                blocked = true;
                this.logBlockedPopup(url, 'iframe-click');
                return null;
            };
            
            setTimeout(() => {
                window.open = originalOpen;
                if (blocked) {
                    this.showBlockNotification();
                }
            }, duration);
        }

        sandboxAllIframes() {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => this.applySandboxPolicy(iframe));
        }

        applySandboxPolicy(iframe) {
            if (this.isTrustedVideo(iframe)) {
                // Minimal restrictions for trusted video platforms
                iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-presentation allow-forms allow-pointer-lock allow-downloads allow-fullscreen';
            } else {
                // Strict restrictions for unknown iframes
                iframe.sandbox = 'allow-scripts allow-same-origin';
            }
            
            iframe.referrerPolicy = 'no-referrer';
            this.secureIframeContent(iframe);
        }

        secureIframeContent(iframe) {
            iframe.addEventListener('load', () => {
                try {
                    this.injectIframeProtection(iframe);
                } catch (e) {
                    // CORS policy restriction
                    this.monitorIframeBehavior(iframe);
                }
            });
        }

        injectIframeProtection(iframe) {
            const iframeWindow = iframe.contentWindow;
            const iframeDocument = iframe.contentDocument;
            
            if (!iframeWindow || !iframeDocument) return;

            // Override iframe's window.open
            Object.defineProperty(iframeWindow, 'open', {
                value: (url, name, features) => {
                    this.logBlockedPopup(url, 'iframe-window.open');
                    return null;
                },
                writable: false,
                configurable: false
            });

            // Block alert dialogs from iframe
            ['alert', 'confirm', 'prompt'].forEach(method => {
                iframeWindow[method] = () => {
                    this.logBlockedEvent(method, iframe.src);
                    return null;
                };
            });

            // Intercept iframe link clicks
            iframeDocument.addEventListener('click', (event) => {
                const target = event.target.closest('a');
                if (target && target.target === '_blank') {
                    event.preventDefault();
                    event.stopPropagation();
                    this.logBlockedPopup(target.href, 'iframe-link');
                }
            }, true);
        }

        monitorIframeBehavior(iframe) {
            // Monitor for behavioral patterns when direct injection isn't possible
            const checkForPopups = setInterval(() => {
                if (!document.body.contains(iframe)) {
                    clearInterval(checkForPopups);
                    return;
                }
                
                // Check if iframe triggered window blur (possible popup)
                if (document.activeElement === iframe) {
                    this.temporaryPopupBlock(500);
                }
            }, 1000);

            // Auto-cleanup
            setTimeout(() => clearInterval(checkForPopups), 30000);
        }

        setupMutationObserver() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'IFRAME') {
                                setTimeout(() => this.applySandboxPolicy(node), 0);
                            }
                            node.querySelectorAll?.('iframe').forEach(iframe => {
                                setTimeout(() => this.applySandboxPolicy(iframe), 0);
                            });
                        }
                    });
                });
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }

        setupMessageInterceptor() {
            window.addEventListener('message', (event) => {
                // Block postMessage calls that might trigger popups
                if (typeof event.data === 'string' && 
                    (event.data.includes('open') || event.data.includes('popup'))) {
                    event.stopPropagation();
                    this.logBlockedEvent('postMessage', event.data);
                }
            }, true);
        }

        setupBlurHandler() {
            let lastFocusTime = Date.now();
            
            window.addEventListener('blur', () => {
                const now = Date.now();
                // If blur happens quickly after focus, it's likely a popup
                if (now - lastFocusTime < 100) {
                    this.logBlockedPopup('window-blur', 'auto-popup');
                    // Force focus back
                    setTimeout(() => window.focus(), 10);
                }
            });

            window.addEventListener('focus', () => {
                lastFocusTime = Date.now();
            });
        }

        isTrustedVideo(iframe) {
            const src = iframe.src || '';
            return Array.from(this.trustedVideoDomains).some(domain => 
                src.includes(domain)
            );
        }

        shouldBlockPopup(url, source) {
            if (!url) return true;
            
            // Allow same-origin popups
            try {
                const urlObj = new URL(url, window.location.href);
                if (urlObj.origin === window.location.origin) {
                    return false;
                }
            } catch (e) {
                return true;
            }

            // Block ad patterns
            return this.adPatterns.some(pattern => pattern.test(url));
        }

        logBlockedPopup(url, source) {
            console.warn(`🚫 Popup blocked [${source}]:`, url);
        }

        logBlockedEvent(eventType, source) {
            console.warn(`🚫 Event blocked [${eventType}]:`, source);
        }

        logIframeInteraction(iframe) {
            console.log(`🎥 Iframe interaction:`, iframe.src);
        }

        showBlockNotification() {
            // Optional: Show subtle notification
            const existing = document.getElementById('popup-block-notification');
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.id = 'popup-block-notification';
            notification.innerHTML = '🛡️ Popup blocked';
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #2ed573;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-family: system-ui, sans-serif;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s;
            `;

            document.body.appendChild(notification);
            
            setTimeout(() => notification.style.opacity = '1', 10);
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }
    }

    // Initialize immediately
    new ProfessionalPopupBlocker();

})();