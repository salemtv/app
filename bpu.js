// bloqueador-iframe-popups.js
(function() {
    'use strict';
    
    console.log('🛡️ Bloqueador de pop-ups desde iframes activado');
    
    // Estrategia: Sandbox todos los iframes para restringir sus capacidades
    function aplicarSandboxIframes() {
        const iframes = document.querySelectorAll('iframe');
        
        iframes.forEach(iframe => {
            // Agregar atributos sandbox para restringir capacidades
            const sandboxAtributos = [
                'allow-scripts',
                'allow-same-origin',
                'allow-forms',
                'allow-popups-to-escape-sandbox' // IMPORTANTE: Permite popups pero los marca
            ].join(' ');
            
            iframe.setAttribute('sandbox', sandboxAtributos);
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            
            // Prevenir que abran ventanas
            protegerVentanaIframe(iframe);
        });
    }
    
    function protegerVentanaIframe(iframe) {
        try {
            // Esperar a que el iframe cargue
            iframe.addEventListener('load', function() {
                try {
                    const iframeWindow = iframe.contentWindow;
                    
                    // Sobrescribir window.open en el iframe
                    iframeWindow.open = function(url, name, specs) {
                        console.log('🚫 Pop-up bloqueado desde iframe:', url);
                        return null;
                    };
                    
                    // Bloquear otras formas de abrir ventanas
                    iframeWindow.alert = function() { 
                        console.log('🚫 Alert bloqueado desde iframe');
                    };
                    
                    iframeWindow.confirm = function() { 
                        console.log('🚫 Confirm bloqueado desde iframe');
                        return false;
                    };
                    
                } catch (e) {
                    // Error de CORS - normal
                }
            });
        } catch (e) {
            console.log('⚠️ No se pudo proteger iframe (CORS)');
        }
    }
    
    // Bloqueador global de window.open
    function bloquearWindowOpenGlobal() {
        const originalOpen = window.open;
        
        window.open = function(url, name, specs) {
            // Verificar si viene de un iframe
            const stack = new Error().stack;
            if (stack && stack.includes('HTMLIFrameElement')) {
                console.log('🚫 Pop-up bloqueado (origen: iframe):', url);
                return null;
            }
            
            // Permitir solo pop-ups específicos
            if (url && esPopupPermitido(url)) {
                return originalOpen.call(this, url, name, specs);
            }
            
            console.log('🚫 Pop-up bloqueado:', url);
            return null;
        };
    }
    
    function esPopupPermitido(url) {
        // Lista de URLs permitidas para pop-ups
        const permitidos = [
            'whatsapp.com',
            'twitter.com',
            'facebook.com',
            'sharethis.com',
            'addthis.com'
        ];
        
        return permitidos.some(dominio => url.includes(dominio));
    }
    
    // Interceptar clics en iframes
    function interceptarClicsIframes() {
        document.addEventListener('click', function(e) {
            let target = e.target;
            
            // Verificar si el clic es en un iframe o dentro de uno
            while (target && target !== document.documentElement) {
                if (target.tagName === 'IFRAME') {
                    console.log('🖱️ Clic en iframe interceptado');
                    // Prevenir comportamiento por defecto
                    e.stopPropagation();
                    return false;
                }
                target = target.parentElement;
            }
        }, true);
    }
    
    // Observar nuevos iframes
    function observarNuevosIframes() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.tagName === 'IFRAME') {
                        setTimeout(function() {
                            aplicarSandboxIframes();
                            protegerVentanaIframe(node);
                        }, 100);
                    } else if (node.querySelectorAll) {
                        const iframes = node.querySelectorAll('iframe');
                        iframes.forEach(function(iframe) {
                            setTimeout(function() {
                                aplicarSandboxIframes();
                                protegerVentanaIframe(iframe);
                            }, 100);
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Solución nuclear: Reemplazar iframes problemáticos
    function reemplazarIframesProblematicos() {
        const iframes = document.querySelectorAll('iframe');
        
        iframes.forEach(iframe => {
            const src = iframe.src || '';
            
            // Identificar iframes que probablemente generen pop-ups
            if (esIframeProblematico(src)) {
                console.log('🚫 Iframe problemático detectado y bloqueado:', src);
                iframe.remove();
                
                // Opcional: Mostrar mensaje
                const mensaje = document.createElement('div');
                mensaje.innerHTML = 'Contenido bloqueado por seguridad';
                mensaje.style.cssText = `
                    padding: 20px;
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    text-align: center;
                    color: #6c757d;
                `;
                iframe.parentNode.insertBefore(mensaje, iframe);
                iframe.remove();
            }
        });
    }
    
    function esIframeProblematico(src) {
        const problematicos = [
            'ads',
            'banner',
            'popup',
            'tracking',
            'analytics',
            'affiliate',
            'promo',
            'marketing',
            'advertising',
            'doubleclick',
            'googleads',
            'googlesyndication'
        ];
        
        return problematicos.some(patron => src.includes(patron));
    }
    
    // Inicializar todo
    function inicializar() {
        console.log('🛡️ Iniciando bloqueador de pop-ups...');
        
        bloquearWindowOpenGlobal();
        interceptarClicsIframes();
        aplicarSandboxIframes();
        reemplazarIframesProblematicos();
        observarNuevosIframes();
        
        console.log('✅ Bloqueador activado correctamente');
    }
    
    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
    
})();