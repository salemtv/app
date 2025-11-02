// simple-blocker.js
(function() {
    'use strict';
    
    // 1. BLOQUEAR window.open PARA SIEMPRE
    window.open = function() {
        alert('🚫 VENTANA BLOQUEADA'); // 👈 Esto SÍ se debe ver
        return null;
    };
    
    // 2. Hacer todos los iframes NO CLICABLES
    document.querySelectorAll('iframe').forEach(iframe => {
        iframe.style.pointerEvents = 'none';
    });
    
    // 3. Bloquear nuevos iframes
    new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.tagName === 'IFRAME') {
                    node.style.pointerEvents = 'none';
                }
            });
        });
    }).observe(document.body, { childList: true, subtree: true });
    
    console.log('✅ Bloqueador simple activado');
    
})();