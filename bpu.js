// iframe-popup-blocker.js
(function() {
    'use strict';
    
    console.log('🛡️ Bloqueador de iframes activado');
    
    // 1. BLOQUEAR window.open COMPLETAMENTE a nivel del navegador
    const originalOpen = window.open;
    window.open = function(url, name, specs) {
        console.log('🚫 VENTANA BLOQUEADA:', url || 'sin URL');
        showNotification('Ventana emergente bloqueada');
        return null;
    };
    
    // 2. Hacerlo permanente e inmutable
    Object.defineProperty(window, 'open', {
        value: function() {
            showNotification('Ventana emergente bloqueada');
            return null;
        },
        writable: false,
        configurable: false
    });
    
    // 3. Aplicar sandbox RESTRICTIVO a TODOS los iframes
    function sandboxAllIframes() {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            // Sandbox MÁXIMO - solo permite lo esencial para videos
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            iframe.style.pointerEvents = 'none'; // 👈 Esto BLOQUEA los clics
        });
        console.log(`✅ ${iframes.length} iframes protegidos`);
    }
    
    // 4. Observar nuevos iframes y aplicar sandbox inmediatamente
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'IFRAME') {
                        setTimeout(() => {
                            node.setAttribute('sandbox', 'allow-scripts allow-same-origin');
                            node.style.pointerEvents = 'none';
                        }, 100);
                    }
                    // Buscar iframes dentro de elementos nuevos
                    const iframes = node.querySelectorAll ? node.querySelectorAll('iframe') : [];
                    iframes.forEach(iframe => {
                        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
                        iframe.style.pointerEvents = 'none';
                    });
                }
            });
        });
    });
    
    // 5. Función de notificación
    function showNotification(message) {
        // Crear notificación
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px;">
                <span style="font-size: 20px;">🚫</span>
                <div>
                    <strong>${message}</strong>
                    <div style="font-size: 12px; opacity: 0.8;">Se ha prevenido una ventana emergente</div>
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
            borderRadius: '10px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            zIndex: '10000',
            boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
            border: '2px solid #ff6b81',
            maxWidth: '350px',
            animation: 'slideIn 0.3s ease-out'
        });
        
        // Agregar estilos de animación
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Auto-eliminar
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // 6. Bloquear cualquier intento de modificar window.open
    let protectionLevel = 0;
    setInterval(() => {
        protectionLevel++;
        window.open = function() {
            console.log(`🚫 VENTANA BLOQUEADA (Protección nivel ${protectionLevel})`);
            showNotification('Ventana emergente bloqueada');
            return null;
        };
    }, 500);
    
    // 7. Inicializar
    function init() {
        sandboxAllIframes();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Bloqueador completamente activado');
        showNotification('Bloqueador activado');
    }
    
    // Ejecutar inmediatamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();