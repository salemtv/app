// bloqueador-iframes.js
(function() {
    'use strict';
    
    console.log('🛡️ Bloqueador de iframes publicitarios activado');
    
    // Lista de patrones de publicidad conocidos
    const patronesPublicidad = [
        'doubleclick.net',
        'googleadsyndication.com',
        'googlesyndication.com',
        'adsystem.com',
        'adservice.google',
        'facebook.com/plugins',
        'ads.',
        'ad.',
        'banner',
        'popup',
        'tracking',
        'analytics',
        'beacon',
        'affiliate',
        'promo',
        'marketing',
        'advertising',
        'pub.',
        '/ads/',
        '/ad/',
        '/banners/'
    ];
    
    // Lista de dominios permitidos (video y contenido legítimo)
    const dominiosPermitidos = [
        'youtube.com',
        'youtu.be',
        'vimeo.com',
        'dailymotion.com',
        'twitch.tv',
        'spotify.com',
        'soundcloud.com',
        'wistia.com',
        'player.vimeo.com',
        'www.youtube.com',
        'youtube-nocookie.com'
    ];
    
    function esIframePublicitario(iframe) {
        const src = iframe.src || '';
        const className = iframe.className || '';
        const id = iframe.id || '';
        
        // Si no tiene src, probablemente no es publicidad
        if (!src) return false;
        
        // Verificar si es un dominio permitido (video legítimo)
        for (let dominio of dominiosPermitidos) {
            if (src.includes(dominio)) {
                return false; // Es contenido legítimo, no bloquear
            }
        }
        
        // Verificar patrones de publicidad
        for (let patron of patronesPublicidad) {
            if (src.includes(patron) || 
                className.includes(patron) || 
                id.includes(patron)) {
                return true;
            }
        }
        
        // Verificar dimensiones típicas de publicidad
        const width = iframe.offsetWidth;
        const height = iframe.offsetHeight;
        
        // Dimensiones comunes de banners publicitarios
        const dimensionesPublicidad = [
            {w: 728, h: 90},   // Leaderboard
            {w: 300, h: 250},  // Medium Rectangle
            {w: 336, h: 280},  // Large Rectangle
            {w: 160, h: 600},  // Wide Skyscraper
            {w: 120, h: 600},  // Skyscraper
            {w: 300, h: 600},  // Half Page Ad
            {w: 970, h: 90},   // Large Leaderboard
            {w: 970, h: 250},  // Billboard
            {w: 250, h: 250},  // Square
            {w: 200, h: 200}   // Small Square
        ];
        
        // Si coincide con dimensiones publicitarias comunes, bloquear
        for (let dim of dimensionesPublicidad) {
            if (Math.abs(width - dim.w) <= 10 && Math.abs(height - dim.h) <= 10) {
                return true;
            }
        }
        
        return false;
    }
    
    function bloquearIframePublicitario(iframe) {
        console.log('🚫 Iframe publicitario bloqueado:', iframe.src);
        iframe.style.display = 'none';
        iframe.remove();
        
        // Opcional: Mostrar mensaje
        mostrarMensajeBloqueo();
    }
    
    function mostrarMensajeBloqueo() {
        // Solo mostrar un mensaje por sesión
        if (sessionStorage.getItem('bloqueadorMensajeMostrado')) return;
        
        const mensaje = document.createElement('div');
        mensaje.innerHTML = '🛡️ Bloqueador: Publicidad eliminada';
        mensaje.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2ed573;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(mensaje);
        setTimeout(() => mensaje.remove(), 3000);
        sessionStorage.setItem('bloqueadorMensajeMostrado', 'true');
    }
    
    function escanearIframes() {
        const iframes = document.querySelectorAll('iframe');
        let iframesBloqueados = 0;
        
        iframes.forEach(iframe => {
            if (esIframePublicitario(iframe)) {
                bloquearIframePublicitario(iframe);
                iframesBloqueados++;
            }
        });
        
        if (iframesBloqueados > 0) {
            console.log(`✅ Bloqueados ${iframesBloqueados} iframes publicitarios`);
        }
    }
    
    // Escanear iframes existentes
    escanearIframes();
    
    // Observar nuevos iframes que se agreguen dinámicamente
    const observer = new MutationObserver((mutations) => {
        let iframesAgregados = false;
        
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'IFRAME') {
                    iframesAgregados = true;
                } else if (node.querySelectorAll) {
                    const iframes = node.querySelectorAll('iframe');
                    if (iframes.length > 0) {
                        iframesAgregados = true;
                    }
                }
            });
        });
        
        if (iframesAgregados) {
            setTimeout(escanearIframes, 100);
        }
    });
    
    // Iniciar observación
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Escanear periódicamente por si algo se escapó
    setInterval(escanearIframes, 5000);
    
})();