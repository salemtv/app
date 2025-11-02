// smart-popup-blocker.js
(function() {
    'use strict';
    
    console.log('🎯 Bloqueador inteligente activado');
    
    // LISTA BLANCA - dominios permitidos para abrir ventanas
    const allowedDomains = [
        'whatsapp.com',
        'twitter.com',
        'facebook.com',
        'sharethis.com',
        'addthis.com',
        'linkedin.com',
        'pinterest.com',
        'mail.google.com',
        'outlook.live.com',
        'youtube.com', // Para compartir videos
        'paypal.com',  // Para pagos
        'stripe.com'   // Para pagos
    ];
    
    // Dominios de video que deben funcionar siempre
    const videoDomains = [
        'youtube.com',
        'youtu.be',
        'vimeo.com',
        'player.vimeo.com',
        'dailymotion.com',
        'twitch.tv',
        'spotify.com',
        'soundcloud.com',
        'wistia.com',
        'netflix.com'
    ];
    
    let popupBlocked = false;
    
    // 1. Sistema de detección inteligente de popups
    function setupPopupDetection() {
        let clickTime = 0;
        let clickTarget = null;
        
        // Detectar clics en iframes
        document.addEventListener('click', function(e) {
            const iframe = e.target.closest('iframe');
            if (iframe) {
                clickTime = Date.now();
                clickTarget = iframe;
                console.log('🎥 Clic en iframe detectado - monitoreando...');
            }
        }, true);
        
        // Detectar cuando se intenta abrir ventana después de clic en iframe
        const originalOpen = window.open;
        window.open = function(url, name, specs) {
            const timeSinceClick = Date.now() - clickTime;
            
            // Si se intenta abrir ventana dentro de 2 segundos después de clic en iframe
            if (timeSinceClick < 2000 && clickTarget) {
                if (isAllowedPopup(url)) {
                    console.log('✅ Popup permitido:', url);
                    showNotification('Ventana emergente permitida', 'success');
                    return originalOpen.call(this, url, name, specs);
                } else {
                    console.log('🚫 Popup bloqueado desde iframe:', url);
                    showNotification('Ventana emergente bloqueada', 'error');
                    popupBlocked = true;
                    return null;
                }
            }
            
            // Para otros casos, usar lista blanca
            if (isAllowedPopup(url)) {
                return originalOpen.call(this, url, name, specs);
            } else {
                console.log('🚫 Popup bloqueado:', url);
                showNotification('Ventana emergente bloqueada', 'error');
                return null;
            }
        };
        
        // Limpiar detección después de 2 segundos
        setInterval(() => {
            if (Date.now() - clickTime > 2000) {
                clickTarget = null;
            }
        }, 1000);
    }
    
    // 2. Verificar si el popup está permitido
    function isAllowedPopup(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            
            // Permitir si está en lista blanca
            for (let domain of allowedDomains) {
                if (urlObj.hostname.includes(domain)) {
                    return true;
                }
            }
            
            // Permitir si es del mismo dominio
            if (urlObj.hostname === window.location.hostname) {
                return true;
            }
            
            // Bloquear patrones de publicidad
            const adPatterns = [
                'popup', 'banner', 'advertisement', 'doubleclick',
                'googleads', 'adsystem', 'tracking', 'affiliate'
            ];
            
            for (let pattern of adPatterns) {
                if (url.toLowerCase().includes(pattern)) {
                    return false;
                }
            }
            
            return false; // Bloquear por defecto
            
        } catch (e) {
            return false; // Bloquear URLs inválidas
        }
    }
    
    // 3. Sistema de notificaciones elegante
    function showNotification(message, type = 'info') {
        // Eliminar notificación anterior si existe
        const existing = document.getElementById('popup-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.id = 'popup-notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">${type === 'error' ? '🚫' : '✅'}</span>
                <span>${message}</span>
            </div>
        `;
        
        const styles = {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? '#ff4757' : '#2ed573',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            zIndex: '10000',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: '300px',
            transition: 'all 0.3s ease',
            opacity: '0',
            transform: 'translateX(100px)'
        };
        
        Object.assign(notification.style, styles);
        
        document.body.appendChild(notification);
        
        // Animación de entrada
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Auto-eliminar después de 3 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // 4. Protección para iframes de video
    function protectVideoIframes() {
        const iframes = document.querySelectorAll('iframe');
        
        iframes.forEach(iframe => {
            if (isVideoIframe(iframe)) {
                // Dar permisos completos a iframes de video
                iframe.setAttribute('sandbox', 
                    'allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-downloads allow-fullscreen'
                );
                console.log('🎥 Iframe de video protegido:', iframe.src);
            } else {
                // Restricciones para otros iframes
                iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            }
        });
    }
    
    function isVideoIframe(iframe) {
        const src = iframe.src || '';
        return videoDomains.some(domain => src.includes(domain));
    }
    
    // 5. Sistema de permisos para enlaces específicos
    function setupLinkProtection() {
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            
            if (link && link.target === '_blank') {
                if (!isAllowedPopup(link.href)) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🚫 Enlace a nueva pestaña bloqueado:', link.href);
                    showNotification('Enlace bloqueado - Ventana emergente no permitida', 'error');
                } else {
                    console.log('✅ Enlace permitido:', link.href);
                    showNotification('Abriendo en nueva pestaña...', 'success');
                }
            }
        }, true);
    }
    
    // 6. Observar iframes nuevos
    function setupMutationObserver() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'IFRAME') {
                            setTimeout(protectVideoIframes, 100);
                        }
                        if (node.querySelectorAll) {
                            const iframes = node.querySelectorAll('iframe');
                            if (iframes.length > 0) {
                                setTimeout(protectVideoIframes, 100);
                            }
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // 7. Inicializar
    function init() {
        setupPopupDetection();
        protectVideoIframes();
        setupLinkProtection();
        setupMutationObserver();
        
        console.log('✅ Bloqueador inteligente inicializado');
        showNotification('Bloqueador activado - Ventanas emergentes bloqueadas', 'info');
    }
    
    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 8. API pública para control manual
    window.popupBlocker = {
        allowDomain: function(domain) {
            allowedDomains.push(domain);
            console.log('✅ Dominio permitido:', domain);
        },
        
        blockDomain: function(domain) {
            const index = allowedDomains.indexOf(domain);
            if (index > -1) {
                allowedDomains.splice(index, 1);
                console.log('🚫 Dominio bloqueado:', domain);
            }
        },
        
        getAllowedDomains: function() {
            return [...allowedDomains];
        },
        
        showMessage: function(message) {
            showNotification(message, 'info');
        }
    };
    
})();