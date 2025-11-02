// bloqueador-brave.js - Bloqueador tipo Brave para publicidad y pop-ups
(function() {
    'use strict';

    console.log('🛡️ Bloqueador Brave-style activado');

    class BloqueadorBrave {
        constructor() {
            this.dominiosPermitidos = new Set([
                window.location.hostname,
                'youtube.com',
                'vimeo.com',
                'dailymotion.com',
                'twitch.tv'
                // Agrega tus dominios de video confiables
            ]);
            
            this.patronesPublicidad = [
                '/ads/',
                '/advertisement/',
                '/popup/',
                '/banner/',
                'doubleclick.net',
                'googleadsyndication.com',
                'googlesyndication.com',
                'adsystem.com',
                'adservice.google',
                'facebook.com/plugins/', // Pero permitir posts normales
                'tracking',
                'analytics',
                'beacon'
            ];
            
            this.inicializar();
        }

        inicializar() {
            this.bloquearWindowOpen();
            this.bloquearCreateElement();
            this.interceptarIframes();
            this.bloquearEventListeners();
            this.monitorearDOM();
        }

        bloquearWindowOpen() {
            const originalOpen = window.open;
            window.open = (url, name, specs) => {
                if (this.esPopupPermitido(url)) {
                    return originalOpen.call(window, url, name, specs);
                }
                console.log('🚫 Pop-up bloqueado:', url);
                return null;
            };
        }

        bloquearCreateElement() {
            const originalCreateElement = document.createElement;
            document.createElement = function(tagName) {
                const element = originalCreateElement.call(this, tagName);
                
                if (tagName.toLowerCase() === 'iframe') {
                    setTimeout(() => {
                        if (element.src && !this.esIframePermitido(element.src)) {
                            console.log('🚫 Iframe publicitario bloqueado:', element.src);
                            element.remove();
                        }
                    }, 0);
                }
                
                if (tagName.toLowerCase() === 'script') {
                    const originalSrc = element.getAttribute('src');
                    if (originalSrc && this.esScriptPublicitario(originalSrc)) {
                        console.log('🚫 Script publicitario bloqueado:', originalSrc);
                        element.remove();
                        return document.createElement('div'); // Elemento dummy
                    }
                }
                
                return element;
            }.bind(this);
        }

        interceptarIframes() {
            // Observar iframes existentes y nuevos
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.tagName === 'IFRAME') {
                            this.procesarIframe(node);
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll('iframe').forEach(iframe => {
                                this.procesarIframe(iframe);
                            });
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Procesar iframes existentes
            document.querySelectorAll('iframe').forEach(iframe => {
                this.procesarIframe(iframe);
            });
        }

        procesarIframe(iframe) {
            const src = iframe.src;
            
            if (!this.esIframePermitido(src)) {
                console.log('🚫 Iframe publicitario bloqueado:', src);
                iframe.remove();
                return;
            }

            // Aplicar políticas de seguridad al iframe permitido
            this.aplicarPoliticasSeguridad(iframe);
        }

        aplicarPoliticasSeguridad(iframe) {
            // Prevenir comportamientos no deseados en iframes permitidos
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            
            // Interceptar attempts de abrir ventanas desde el iframe
            try {
                const iframeWindow = iframe.contentWindow;
                const iframeDocument = iframe.contentDocument;
                
                if (iframeWindow) {
                    this.protegerVentanaIframe(iframeWindow);
                }
            } catch (e) {
                // Error de CORS - normal para iframes de diferentes dominios
            }
        }

        protegerVentanaIframe(iframeWindow) {
            const originalOpen = iframeWindow.open;
            iframeWindow.open = (url, name, specs) => {
                console.log('🚫 Pop-up desde iframe bloqueado:', url);
                return null;
            };

            // Bloquear alertas y prompts desde iframes
            ['alert', 'confirm', 'prompt'].forEach(metodo => {
                iframeWindow[metodo] = function() {
                    console.log(`🚫 ${metodo} desde iframe bloqueado`);
                    return null;
                };
            });
        }

        bloquearEventListeners() {
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                // Bloquear event listeners sospechosos
                if (this instanceof HTMLIFrameElement) {
                    const tiposBloqueados = ['beforeunload', 'unload'];
                    if (tiposBloqueados.includes(type)) {
                        console.log('🚫 Event listener bloqueado en iframe:', type);
                        return;
                    }
                }
                
                return originalAddEventListener.call(this, type, listener, options);
            };
        }

        monitorearDOM() {
            // Bloquear elementos de publicidad comunes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            this.inspeccionarElemento(node);
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        inspeccionarElemento(element) {
            // Buscar y bloquear elementos publicitarios
            const selectoresPublicidad = [
                '[class*="ad"]',
                '[id*="ad"]',
                '[class*="banner"]',
                '[id*="banner"]',
                '[class*="popup"]',
                '[id*="popup"]',
                'iframe[src*="ads"]',
                'iframe[src*="banner"]'
            ];

            selectoresPublicidad.forEach(selector => {
                element.querySelectorAll?.(selector).forEach(el => {
                    if (!this.esElementoPermitido(el)) {
                        console.log('🚫 Elemento publicitario bloqueado:', selector);
                        el.remove();
                    }
                });
            });

            // Verificar el elemento mismo
            if (this.esElementoPublicitario(element)) {
                console.log('🚫 Elemento publicitario bloqueado (raíz)');
                element.remove();
            }
        }

        esIframePermitido(src) {
            if (!src) return true; // iframes sin src pueden ser legítimos
            
            try {
                const url = new URL(src, window.location.href);
                
                // Permitir iframes del mismo origen
                if (url.hostname === window.location.hostname) {
                    return true;
                }
                
                // Permitir iframes de dominios confiables
                for (let dominio of this.dominiosPermitidos) {
                    if (url.hostname === dominio || url.hostname.endsWith('.' + dominio)) {
                        return true;
                    }
                }
                
                // Bloquear si contiene patrones de publicidad
                return !this.patronesPublicidad.some(patron => 
                    url.href.includes(patron)
                );
            } catch (e) {
                return true; // En caso de error, ser permisivo
            }
        }

        esPopupPermitido(url) {
            if (!url) return false;
            
            try {
                const urlObj = new URL(url, window.location.href);
                return this.dominiosPermitidos.has(urlObj.hostname);
            } catch {
                return false;
            }
        }

        esScriptPublicitario(src) {
            return this.patronesPublicidad.some(patron => 
                src.includes(patron)
            );
        }

        esElementoPublicitario(element) {
            const className = element.className?.toString().toLowerCase() || '';
            const id = element.id?.toLowerCase() || '';
            const src = element.src?.toLowerCase() || '';
            
            const patrones = ['ad', 'banner', 'popup', 'advertisement'];
            
            return patrones.some(patron => 
                className.includes(patron) || 
                id.includes(patron) || 
                src.includes(patron)
            );
        }

        esElementoPermitido(element) {
            // Permitir elementos específicos del sitio
            const permitidos = [
                'navigation',
                'menu',
                'header',
                'footer',
                'content'
            ];
            
            const className = element.className?.toString().toLowerCase() || '';
            const id = element.id?.toLowerCase() || '';
            
            return permitidos.some(perm => 
                className.includes(perm) || id.includes(perm)
            );
        }
    }

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new BloqueadorBrave();
        });
    } else {
        new BloqueadorBrave();
    }

})();
