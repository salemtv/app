// iframe-overlay-blocker.js
(function() {
    'use strict';
    
    console.log('🛡️ Bloqueador por overlay activado');
    
    // 1. BLOQUEAR window.open completamente en la ventana principal
    const originalOpen = window.open;
    window.open = function(url, name, specs) {
        console.log('🚫 Ventana bloqueada desde página principal');
        showNotification('Ventana emergente bloqueada');
        return null;
    };
    
    // 2. Crear overlay transparente sobre TODOS los iframes
    function createOverlayOnIframes() {
        const iframes = document.querySelectorAll('iframe');
        
        iframes.forEach(iframe => {
            // Verificar si ya tiene overlay
            if (iframe.hasAttribute('data-overlay-added')) {
                return;
            }
            
            // Crear contenedor para el iframe
            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.display = 'inline-block';
            
            // Mover el iframe al contenedor
            iframe.parentNode.insertBefore(container, iframe);
            container.appendChild(iframe);
            
            // Crear overlay transparente
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.zIndex = '9999';
            overlay.style.cursor = 'pointer';
            
            // Agregar overlay al contenedor
            container.appendChild(overlay);
            
            // Marcar que ya tiene overlay
            iframe.setAttribute('data-overlay-added', 'true');
            
            console.log('✅ Overlay agregado a iframe');
        });
    }
    
    // 3. Función de notificación
    function showNotification(message) {
        // Eliminar notificación anterior
        const existing = document.querySelector('.blocker-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'blocker-notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px;">
                <span style="font-size: 20px;">🚫</span>
                <div>
                    <strong>${message}</strong>
                    <div style="font-size: 12px; margin-top: 4px;">Clic en iframe bloqueado</div>
                </div>
            </div>
        `;
        
        // Estilos
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
            border: '2px solid #ff6b81'
        });
        
        document.body.appendChild(notification);
        
        // Auto-eliminar
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // 4. Observar nuevos iframes
    const observer = new MutationObserver(function(mutations) {
        let iframesAdded = false;
        
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.tagName === 'IFRAME') {
                    iframesAdded = true;
                }
            });
        });
        
        if (iframesAdded) {
            setTimeout(createOverlayOnIframes, 100);
        }
    });
    
    // 5. Hacer window.open inmutable
    Object.defineProperty(window, 'open', {
        value: function() {
            showNotification('Ventana emergente bloqueada');
            return null;
        },
        writable: false,
        configurable: false
    });
    
    // 6. Inicializar
    function init() {
        createOverlayOnIframes();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Bloqueador por overlay activado');
    }
    
    // Ejecutar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();