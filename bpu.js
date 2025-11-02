// bloqueador-inteligente.js
(function() {
    'use strict';
    
    console.log('🎯 Bloqueador inteligente activado - Videos permitidos, pop-ups bloqueados');
    
    // Dominios de video confiables
    const dominiosVideoPermitidos = [
        'youtube.com',
        'youtu.be',
        'youtube-nocookie.com',
        'vimeo.com',
        'player.vimeo.com',
        'dailymotion.com',
        'twitch.tv',
        'spotify.com',
        'soundcloud.com',
        'wistia.com',
        'netflix.com',
        'facebook.com/plugins/video.php',
        'streamable.com'
    ];
    
    function esIframeDeVideo(iframe) {
        const src = iframe.src || '';
        return dominiosVideoPermitidos.some(dominio => src.includes(dominio));
    }
    
    function aplicarProteccionSelectiva() {
        const iframes = document.querySelectorAll('iframe');
        
        iframes.forEach(iframe => {
            if (esIframeDeVideo(iframe)) {
                // Para iframes de video: protección ligera
                protegerIframeVideo(iframe);
            } else {
                // Para otros iframes: protección estricta
                protegerIframeEstricto(iframe);
            }
        });
    }
    
    function protegerIframeVideo(iframe) {
        // Sandbox mínimo para videos - permite reproducción pero bloquea pop-ups
        const sandboxVideo = [
            'allow-scripts',
            'allow-same-origin',
            'allow-popups', // IMPORTANTE: Permitir pero controlar
            'allow-presentation',
            'allow-fullscreen'
        ].join(' ');
        
        iframe.setAttribute('sandbox', sandboxVideo);
        iframe.setAttribute('referrerpolicy', 'no-referrer');
        
        // Protección específica para videos
        protegerVentanaIframeVideo(iframe);
    }
    
    function protegerIframeEstricto(iframe) {
        // Sandbox estricto para iframes no-video
        const sandboxEstricto = [
            'allow-scripts',
            'allow-same-origin'
        ].join(' ');
        
        iframe.setAttribute('sandbox', sandboxEstricto);
        iframe.setAttribute('referrerpolicy', 'no-referrer');
        protegerVentanaIframeEstricto(iframe);
    }
    
    function protegerVentanaIframeVideo(iframe) {
        // Protección para iframes de video - permite funcionalidad pero bloquea pop-ups
        iframe.addEventListener('load', function() {
            try {
                const iframeWindow = iframe.contentWindow;
                
                // Interceptar window.open pero de forma más inteligente
                const originalOpen = iframeWindow.open;
                iframeWindow.open = function(url, name, specs) {
                    // Solo bloquear pop-ups no deseados, permitir ventanas legítimas
                    if (url && esPopupNoDeseado(url)) {
                        console.log('🚫 Pop-up de video bloqueado:', url);
                        return null;
                    }
                    return originalOpen.call(this, url, name, specs);
                };
                
                // Bloquear redirecciones automáticas
                iframeWindow.addEventListener('beforeunload', function(e) {
                    if (!e.target.activeElement) {
                        e.preventDefault();
                        return false;
                    }
                });
                
            } catch (e) {
                // Error CORS - normal
            }
        });
    }
    
    function protegerVentanaIframeEstricto(iframe) {
        // Protección estricta para iframes no-video
        iframe.addEventListener('load', function() {
            try {
                const iframeWindow = iframe.contentWindow;
                
                // Bloquear completamente window.open
                iframeWindow.open = function() {
                    console.log('🚫 Pop-up bloqueado (iframe no-video)');
                    return null;
                };
                
                // Bloquear otras APIs de ventana
                ['alert', 'confirm', 'prompt'].forEach(metodo => {
                    iframeWindow[metodo] = function() {
                        console.log(`🚫 ${metodo} bloqueado desde iframe`);
                        return null;
                    };
                });
                
            } catch (e) {
                // Error CORS
            }
        });
    }
    
    function esPopupNoDeseado(url) {
        // Patrones de URLs que definitivamente son pop-ups no deseados
        const patronesNoDeseados = [
            'popup',
            'banner',
            'advertisement',
            'doubleclick',
            'googleads',
            'adsystem',
            'tracking',
            'affiliate',
            'promo',
            'marketing',
            'advertising',
            'offer',
            'deal',
            'discount',
            'win',
            'prize',
            'survey'
        ];
        
        const urlLower = url.toLowerCase();
        return patronesNoDeseados.some(patron => urlLower.includes(patron));
    }
    
    // Interceptar clics inteligentemente
    function interceptarClicsInteligentes() {
        document.addEventListener('click', function(e) {
            const target = e.target;
            
            // Si el clic es directamente en un iframe
            if (target.tagName === 'IFRAME') {
                console.log('🖱️ Clic en iframe detectado - monitoreando...');
                // No prevenir inmediatamente, solo monitorear
                monitorearPopupTemporal();
            }
        }, true);
        
        // También detectar clics que podrían venir desde dentro del iframe
        window.addEventListener('blur', function() {
            setTimeout(function() {
                if (document.activeElement.tagName === 'IFRAME') {
                    console.log('⚠️ Posible pop-up detectado desde iframe');
                    monitorearPopupTemporal();
                }
            }, 100);
        });
    }
    
    function monitorearPopupTemporal() {
        // Monitorear por pop-ups temporales
        const originalOpen = window.open;
        let popupDetectado = false;
        
        window.open = function(url, name, specs) {
            popupDetectado = true;
            console.log('🚫 Pop-up bloqueado (clic en iframe):', url);
            return null;
        };
        
        // Restaurar después de un tiempo
        setTimeout(() => {
            window.open = originalOpen;
            if (popupDetectado) {
                mostrarNotificacionBloqueo();
            }
        }, 1000);
    }
    
    function mostrarNotificacionBloqueo() {
        const notificacion = document.createElement('div');
        notificacion.innerHTML = '🛡️ Ventana emergente bloqueada';
        notificacion.style.cssText = `
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
        
        document.body.appendChild(notificacion);
        setTimeout(() => notificacion.remove(), 3000);
    }
    
    // Bloqueador global de emergencia
    function bloquearWindowOpenGlobal() {
        const originalOpen = window.open;
        
        window.open = function(url, name, specs) {
            // Verificar si es un pop-up no deseado
            if (url && esPopupNoDeseado(url)) {
                console.log('🚫 Pop-up global bloqueado:', url);
                return null;
            }
            
            // Permitir pop-ups legítimos
            return originalOpen.call(this, url, name, specs);
        };
    }
    
    // Observar nuevos iframes dinámicamente
    function observarNuevosIframes() {
        const observer = new MutationObserver(function(mutations) {
            let iframesNuevos = false;
            
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.tagName === 'IFRAME') {
                        iframesNuevos = true;
                    } else if (node.querySelectorAll) {
                        const iframes = node.querySelectorAll('iframe');
                        if (iframes.length > 0) {
                            iframesNuevos = true;
                        }
                    }
                });
            });
            
            if (iframesNuevos) {
                setTimeout(aplicarProteccionSelectiva, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Inicializar
    function inicializar() {
        console.log('🎯 Iniciando bloqueador inteligente...');
        
        aplicarProteccionSelectiva();
        interceptarClicsInteligentes();
        bloquearWindowOpenGlobal();
        observarNuevosIframes();
        
        console.log('✅ Bloqueador inteligente activado - Videos funcionan, pop-ups bloqueados');
    }
    
    // Ejecutar cuando esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
    
})();