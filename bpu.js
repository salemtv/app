// click-iframe-blocker.js
(function() {
    'use strict';
    
    console.log('🎯 Bloqueador de clics en iframes activado');
    
    let iframeClickDetected = false;
    let originalWindowOpen = window.open;
    
    // 1. Detectar cuando se hace clic en cualquier iframe
    document.addEventListener('click', function(e) {
        const iframe = e.target.closest('iframe');
        if (iframe) {
            iframeClickDetected = true;
            console.log('🖱️ Clic en iframe detectado - monitoreando ventanas...');
            
            // Activar protección temporal por 3 segundos
            setTimeout(() => {
                iframeClickDetected = false;
            }, 3000);
        }
    }, true);
    
    // 2. Interceptar window.open solo cuando viene de clic en iframe
    window.open = function(url, name, specs) {
        if (iframeClickDetected) {
            console.log('🚫 Ventana bloqueada - Origen: clic en iframe');
            showNotification('Ventana emergente bloqueada');
            return null;
        }
        
        // Permitir ventanas que no vienen de iframes
        return originalWindowOpen.call(this, url, name, specs);
    };
    
    // 3. Función para mostrar notificación flotante
    function showNotification(message) {
        // Eliminar notificación anterior si existe
        const existing = document.querySelector('.iframe-blocker-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'iframe-blocker-notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">🚫</span>
                <span>${message}</span>
            </div>
        `;
        
        // Estilos de la notificación
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#ff4757',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: '300px',
            transition: 'all 0.3s ease',
            opacity: '0',
            transform: 'translateX(100px)'
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
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // 4. Proteger iframes existentes SIN afectar videos
    function protectExistingIframes() {
        const iframes = document.querySelectorAll('iframe');
        
        iframes.forEach(iframe => {
            // NO aplicar sandbox para no afectar videos
            // Solo agregar un atributo de identificación
            iframe.setAttribute('data-iframe-protected', 'true');
        });
        
        console.log(`✅ ${iframes.length} iframes protegidos`);
    }
    
    // 5. Observar nuevos iframes que se agreguen
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1 && node.tagName === 'IFRAME') {
                    node.setAttribute('data-iframe-protected', 'true');
                    console.log('✅ Nuevo iframe protegido:', node.src);
                }
            });
        });
    });
    
    // 6. Inicializar
    function init() {
        protectExistingIframes();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Bloqueador listo - Solo bloquea ventanas de clics en iframes');
    }
    
    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();