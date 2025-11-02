// detector-popups.js
(function() {
    'use strict';
    
    console.log('🔍 Detector de ventanas emergentes activado');
    
    let popupDetected = false;
    
    // 1. Guardar el window.open original
    const originalOpen = window.open;
    
    // 2. Reemplazar window.open con nuestro detector
    window.open = function(url, name, specs) {
        console.log('🚨 Se intentó abrir ventana:', url);
        popupDetected = true;
        
        // Mostrar notificación inmediatamente
        showNotification('Ventana emergente bloqueada');
        
        // Devolver null para bloquear la ventana
        return null;
    };
    
    // 3. Función para mostrar notificación solo cuando se bloquea
    function showNotification(message) {
        // Eliminar notificación anterior si existe
        const existing = document.querySelector('.popup-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'popup-notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px;">
                <span style="font-size: 24px;">🚫</span>
                <div>
                    <strong style="display: block;">${message}</strong>
                    <small style="opacity: 0.8;">Se detectó y bloqueó una ventana emergente</small>
                </div>
            </div>
        `;
        
        // Estilos de la notificación
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#ff4757',
            color: 'white',
            borderRadius: '8px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            zIndex: '10000',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '2px solid #ff6b81',
            maxWidth: '320px',
            opacity: '0',
            transform: 'translateX(100px)',
            transition: 'all 0.3s ease'
        });
        
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
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // 4. Sistema de monitoreo para iframes
    function monitorIframes() {
        const iframes = document.querySelectorAll('iframe');
        
        iframes.forEach(iframe => {
            try {
                // Cuando el iframe carga, proteger su contenido
                iframe.addEventListener('load', function() {
                    try {
                        const iframeWindow = iframe.contentWindow;
                        
                        // Sobrescribir window.open dentro del iframe
                        iframeWindow.open = function(url) {
                            console.log('🚨 Ventana desde iframe detectada:', url);
                            showNotification('Ventana emergente bloqueada');
                            return null;
                        };
                        
                    } catch (error) {
                        // Error de CORS - normal para iframes de otros dominios
                        console.log('⚠️ Iframe protegido (CORS):', iframe.src);
                    }
                });
            } catch (error) {
                console.log('⚠️ No se pudo monitorear iframe:', iframe.src);
            }
        });
    }
    
    // 5. Observar nuevos iframes
    const observer = new MutationObserver(function(mutations) {
        let newIframes = false;
        
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.tagName === 'IFRAME') {
                    newIframes = true;
                }
            });
        });
        
        if (newIframes) {
            setTimeout(monitorIframes, 100);
        }
    });
    
    // 6. Verificar cada segundo si se abrieron ventanas (como medida de seguridad)
    setInterval(() => {
        // Esta es una protección adicional
        if (popupDetected) {
            popupDetected = false;
        }
    }, 1000);
    
    // 7. Inicializar
    function init() {
        monitorIframes();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Detector listo - Solo bloqueará cuando detecte ventanas');
    }
    
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();