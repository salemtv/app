// simple-adblocker.js
(function() {
    'use strict';
    
    // Lista de dominios de anuncios conocidos
    const adDomains = [
        'doubleclick.net',
        'googleadsyndication.com',
        'googlesyndication.com',
        'adsystem.com',
        'adservice.google.com',
        'facebook.com/plugins',
        'amazon-adsystem.com',
        'taboola.com',
        'outbrain.com',
        'revcontent.com',
        'ads.',
        'ad.',
        'banner',
        'popup',
        'tracking',
        'analytics',
        'beacon',
        'affiliate',
        'promo'
    ];
    
    function isAdIframe(iframe) {
        const src = iframe.src || '';
        const className = iframe.className || '';
        const id = iframe.id || '';
        
        // Verificar si coincide con dominios de anuncios
        for (let domain of adDomains) {
            if (src.includes(domain) || 
                className.includes(domain) || 
                id.includes(domain)) {
                return true;
            }
        }
        
        // Verificar por dimensiones típicas de anuncios
        const width = iframe.offsetWidth;
        const height = iframe.offsetHeight;
        
        const adSizes = [
            {w: 728, h: 90},   // Leaderboard
            {w: 300, h: 250},  // Medium Rectangle
            {w: 336, h: 280},  // Large Rectangle
            {w: 160, h: 600},  // Wide Skyscraper
            {w: 120, h: 600},  // Skyscraper
            {w: 300, h: 600},  // Half Page
            {w: 970, h: 90},   // Large Leaderboard
            {w: 970, h: 250},  // Billboard
            {w: 250, h: 250},  // Square
            {w: 200, h: 200}   // Small Square
        ];
        
        for (let size of adSizes) {
            if (Math.abs(width - size.w) <= 5 && Math.abs(height - size.h) <= 5) {
                return true;
            }
        }
        
        return false;
    }
    
    function blockAdIframes() {
        const iframes = document.querySelectorAll('iframe');
        let blockedCount = 0;
        
        iframes.forEach(iframe => {
            if (isAdIframe(iframe)) {
                console.log('🚫 Iframe de anuncio bloqueado:', iframe.src);
                iframe.remove();
                blockedCount++;
            }
        });
        
        if (blockedCount > 0) {
            console.log(`✅ Bloqueados ${blockedCount} iframes de anuncios`);
        }
    }
    
    // Observar nuevos iframes que se agreguen
    const observer = new MutationObserver(function(mutations) {
        let newIframes = false;
        
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.tagName === 'IFRAME') {
                    newIframes = true;
                } else if (node.querySelectorAll) {
                    const iframes = node.querySelectorAll('iframe');
                    if (iframes.length > 0) {
                        newIframes = true;
                    }
                }
            });
        });
        
        if (newIframes) {
            setTimeout(blockAdIframes, 100);
        }
    });
    
    // Iniciar
    function init() {
        console.log('🛡️ Bloqueador de anuncios activado');
        
        // Bloquear anuncios existentes
        blockAdIframes();
        
        // Observar cambios en el DOM
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Escanear periódicamente
        setInterval(blockAdIframes, 2000);
    }
    
    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();