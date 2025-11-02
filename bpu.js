// no-popups-total.js
(function() {
    'use strict';
    
    console.log('🚫 Bloqueador total activado - CERO nuevas pestañas');
    
    // 1. Bloquear window.open a nivel de propiedad (irreversible)
    Object.defineProperty(window, 'open', {
        value: function() {
            console.log('🚫 window.open() bloqueado permanentemente');
            return null;
        },
        writable: false,
        configurable: false
    });
    
    // 2. Interceptar TODOS los clics antes de que se procesen
    document.addEventListener('click', function(e) {
        const target = e.target;
        const link = target.closest('a');
        
        if (link && (link.target === '_blank' || 
                     link.getAttribute('onclick') || 
                     link.href?.startsWith('javascript:') ||
                     e.ctrlKey || e.shiftKey || e.button === 1)) {
            
            // PREVENIR COMPLETAMENTE la acción
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // También prevenir el comportamiento por defecto del navegador
            if (e.button === 1) { // Middle click
                e.preventDefault();
            }
            
            console.log('🚫 Clic bloqueado - Nueva pestaña prevenida');
            return false;
        }
    }, true); // Captura phase - se ejecuta PRIMERO
    
    // 3. Bloquear middle-click (rueda del mouse) específicamente
    document.addEventListener('auxclick', function(e) {
        if (e.button === 1) {
            const link = e.target.closest('a');
            if (link) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('🚫 Middle-click bloqueado completamente');
                return false;
            }
        }
    }, true);
    
    // 4. Bloquear eventos de teclado
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        if ((e.ctrlKey || e.metaKey) && activeElement && activeElement.tagName === 'A') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🚫 Ctrl+Click con teclado bloqueado');
        }
    }, true);
    
    // 5. Bloquear cualquier intento desde iframes
    function secureIframes() {
        document.querySelectorAll('iframe').forEach(iframe => {
            // Sandbox máximo - solo permite lo esencial
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            
            try {
                iframe.addEventListener('load', function() {
                    try {
                        // Bloquear window.open dentro del iframe
                        const iframeWindow = iframe.contentWindow;
                        Object.defineProperty(iframeWindow, 'open', {
                            value: function() {
                                console.log('🚫 window.open desde iframe bloqueado');
                                return null;
                            },
                            writable: false,
                            configurable: false
                        });
                    } catch (e) {
                        // CORS error - normal
                    }
                });
            } catch (e) {
                console.log('⚠️ Iframe protegido con sandbox');
            }
        });
    }
    
    // 6. Observar nuevos iframes dinámicamente
    const observer = new MutationObserver(function(mutations) {
        let iframesAdded = false;
        
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    if (node.tagName === 'IFRAME') {
                        iframesAdded = true;
                    }
                    if (node.querySelectorAll) {
                        const iframes = node.querySelectorAll('iframe');
                        if (iframes.length > 0) {
                            iframesAdded = true;
                        }
                    }
                }
            });
        });
        
        if (iframesAdded) {
            setTimeout(secureIframes, 50);
        }
    });
    
    // 7. Interceptar creación de elementos <a> dinámicamente
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        
        if (tagName.toLowerCase() === 'a') {
            // Interceptar cuando le pongan target="_blank"
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function(name, value) {
                if (name === 'target' && value === '_blank') {
                    console.log('🚫 target="_blank" bloqueado en elemento creado dinámicamente');
                    return; // No establecer el atributo
                }
                return originalSetAttribute.call(this, name, value);
            };
        }
        
        return element;
    };
    
    // 8. Inicializar
    function init() {
        secureIframes();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Bloqueador total inicializado - No se abrirán nuevas pestañas');
    }
    
    // Ejecutar inmediatamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 9. Función de emergencia - Re-bloquear cada segundo por si algo se escapa
    setInterval(function() {
        window.open = function() { return null; };
    }, 1000);
    
})();