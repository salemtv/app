// iframe-click-blocker.js
(function() {
    'use strict';
    
    console.log('🚫 Bloqueador de clics en iframes activado');
    
    // 1. Bloquear completamente la apertura de nuevas ventanas
    window.open = function() {
        console.log('🚫 Ventana emergente bloqueada globalmente');
        showNotification('Ventana emergente bloqueada');
        return null;
    };
    
    // 2. Prevenir el comportamiento por defecto de ANY click en iframes
    document.addEventListener('click', function(e) {
        // Verificar si el clic es en un iframe o dentro de uno
        if (e.target.tagName === 'IFRAME' || e.target.closest('iframe')) {
            console.log('🖱️ Clic en iframe detectado - bloqueando acción');
            
            // Prevenir completamente la acción
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Mostrar notificación
            showNotification('Acción bloqueada - Clic en iframe');
            
            return false;
        }
    }, true); // Usar captura para interceptar ANTES
    
    // 3. También bloquear middle-click en iframes
    document.addEventListener('auxclick', function(e) {
        if (e.target.tagName === 'IFRAME' || e.target.closest('iframe')) {
            console.log('🚫 Middle-click en iframe bloqueado');
            e.preventDefault();
            e.stopPropagation();
            showNotification('Clic secundario bloqueado');
            return false;
        }
    }, true);
    
    // 4. Función de notificación
    function showNotification(message) {
        // Eliminar notificación anterior si existe
        const existing = document.querySelector('.blocker-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'blocker-notification';
        notification.textContent = message;
        
        // Estilos
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
            fontWeight: 'bold',
            zIndex: '10000',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '2px solid #ff6b81'
        });
        
        document.body.appendChild(notification);
        
        // Auto-eliminar después de 2 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 2000);
    }
    
    // 5. Nuclear option: Hacer window.open completamente inmutable
    Object.defineProperty(window, 'open', {
        value: function() {
            console.log('🚫 VENTANA BLOQUEADA PERMANENTEMENTE');
            showNotification('Ventana emergente bloqueada');
            return null;
        },
        writable: false,
        configurable: false
    });
    
    // 6. Bloquear cualquier intento de sobreescribir nuestro bloqueo
    let blockAttempts = 0;
    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
        if (prop === 'open' && obj === window) {
            blockAttempts++;
            console.log(`🚫 Intento ${blockAttempts} de sobreescribir bloqueo detectado`);
            return obj;
        }
        return originalDefineProperty.call(this, obj, prop, descriptor);
    };
    
    console.log('✅ Bloqueador activado - Cero ventanas emergentes permitidas');
    
})();