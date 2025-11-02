// no-popups.js
(function() {
    'use strict';
    
    console.log('🚫 Bloqueador total de ventanas emergentes activado');
    
    // Bloquear window.open completamente
    window.open = function() {
        console.log('🚫 Ventana emergente bloqueada');
        return null;
    };
    
    // Bloquear clics en enlaces que abren nuevas ventanas
    document.addEventListener('click', function(e) {
        let target = e.target;
        
        // Buscar el enlace más cercano
        while (target && target.tagName !== 'A' && target !== document.body) {
            target = target.parentElement;
        }
        
        if (target && target.tagName === 'A') {
            if (target.target === '_blank' || 
                target.hasAttribute('onclick') || 
                target.getAttribute('href')?.startsWith('javascript:')) {
                
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                console.log('🚫 Enlace a nueva ventana bloqueado:', target.href);
                return false;
            }
        }
    }, true); // Usar captura para interceptar temprano
    
    // Bloquear middle-click (rueda del mouse)
    document.addEventListener('auxclick', function(e) {
        if (e.button === 1) { // Middle click
            let target = e.target;
            while (target && target.tagName !== 'A' && target !== document.body) {
                target = target.parentElement;
            }
            
            if (target && target.tagName === 'A') {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚫 Middle-click bloqueado');
            }
        }
    }, true);
    
    // Bloquear control+click y shift+click
    document.addEventListener('click', function(e) {
        if (e.ctrlKey || e.shiftKey) {
            let target = e.target;
            while (target && target.tagName !== 'A' && target !== document.body) {
                target = target.parentElement;
            }
            
            if (target && target.tagName === 'A') {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚫 Ctrl+Click o Shift+Click bloqueado');
            }
        }
    }, true);
    
    // Bloquear eventos de teclado que abren ventanas
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            console.log('🚫 Ctrl+Enter bloqueado');
        }
    });
    
    // Bloquear beforeunload que podría abrir ventanas
    window.addEventListener('beforeunload', function(e) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    });
    
    // Prevenir que iframes abran ventanas
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.tagName === 'IFRAME') {
                    // Aplicar sandbox estricto a todos los iframes
                    node.setAttribute('sandbox', 'allow-scripts allow-same-origin');
                    
                    // Intentar bloquear window.open dentro del iframe
                    try {
                        node.addEventListener('load', function() {
                            try {
                                const iframeWindow = node.contentWindow;
                                iframeWindow.open = function() {
                                    console.log('🚫 Ventana desde iframe bloqueada');
                                    return null;
                                };
                            } catch (e) {
                                // CORS error - normal
                            }
                        });
                    } catch (e) {
                        // Error al acceder al iframe
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Aplicar a iframes existentes
    document.querySelectorAll('iframe').forEach(function(iframe) {
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    });
    
    console.log('✅ Todas las ventanas emergentes están bloqueadas');
    
})();