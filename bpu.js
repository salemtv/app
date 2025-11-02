// nuclear-iframe-blocker.js
(function() {
    'use strict';
    
    console.log('☢️ BLOQUEADOR NUCLEAR ACTIVADO');
    
    // 1. Hacer window.open completamente inutilizable
    delete window.open;
    Object.defineProperty(window, 'open', {
        get: function() {
            return function() {
                console.log('🚫 VENTANA BLOQUEADA');
                showNuclearNotification();
                return null;
            };
        },
        set: function() {
            console.log('🚫 Intento de modificar bloqueo detectado');
            return function() { return null; };
        },
        configurable: false
    });
    
    // 2. Interceptar TODOS los eventos de clic
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        // Si es un iframe o está dentro de uno, BLOQUEAR COMPLETAMENTE
        if (target.tagName === 'IFRAME' || target.closest('iframe')) {
            console.log('☢️ CLIC EN IFRAME - ACCIÓN NULIFICADA');
            
            // Nuclear: Prevenir todo
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Nuclear: Remover el focus del iframe
            if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
                document.activeElement.blur();
            }
            
            showNuclearNotification();
            
            return false;
        }
    }, true);
    
    // 3. También interceptar mousedown y mouseup
    ['mousedown', 'mouseup', 'auxclick'].forEach(eventType => {
        document.addEventListener(eventType, function(e) {
            if (e.target.tagName === 'IFRAME' || e.target.closest('iframe')) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🚫 ${eventType} en iframe bloqueado`);
            }
        }, true);
    });
    
    // 4. Notificación nuclear
    function showNuclearNotification() {
        const nukeNotification = document.createElement('div');
        nukeNotification.innerHTML = '💥 ACCIÓN BLOQUEADA<br><small>Ventana emergente prevenida</small>';
        
        Object.assign(nukeNotification.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#ff4757',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            fontWeight: 'bold',
            zIndex: '10000',
            textAlign: 'center',
            boxShadow: '0 0 30px rgba(255, 71, 87, 0.8)',
            border: '3px solid #ff6b81'
        });
        
        document.body.appendChild(nukeNotification);
        
        setTimeout(() => {
            nukeNotification.style.opacity = '0';
            nukeNotification.style.transition = 'opacity 0.5s';
            setTimeout(() => nukeNotification.remove(), 500);
        }, 1500);
    }
    
    // 5. Auto-refuerzo cada segundo
    setInterval(() => {
        window.open = function() { 
            showNuclearNotification();
            return null; 
        };
    }, 1000);
    
    console.log('☢️ MODO NUCLEAR: Cero interacciones con iframes permitidas');
    
})();