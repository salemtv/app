// bloqueador-popups.js
(function() {
    'use strict';
    
    console.log('🔒 Bloqueador de pop-ups cargado...');
    
    // Lista de dominios permitidos (personaliza esta lista)
    const dominiosPermitidos = [
        'tudominio.com',
        'google.com',
        'youtube.com',
        'github.com'
        // Agrega aquí tus dominios confiables
    ];
    
    // Guardar referencia original de window.open
    const openOriginal = window.open;
    
    // Sobrescribir window.open para bloquear pop-ups
    window.open = function(url, name, specs) {
        console.log('🚫 Intento de pop-up bloqueado:', url);
        
        // Opcional: Mostrar notificación al usuario
        mostrarNotificacion('Pop-up bloqueado: ' + (url || 'ventana emergente'));
        
        return null; // Bloquear completamente
    };
    
    // Interceptar clics en enlaces
    document.addEventListener('click', function(e) {
        let target = e.target;
        
        // Encontrar el elemento <a> más cercano si se hizo clic en un hijo
        while (target && target.tagName !== 'A') {
            target = target.parentElement;
            if (!target) return;
        }
        
        // Verificar si es un enlace que abre nueva pestaña/ventana
        if (target.tagName === 'A' && target.href) {
            if (target.target === '_blank' || target.hasAttribute('onclick')) {
                if (!esEnlacePermitido(target.href)) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🚫 Enlace externo bloqueado:', target.href);
                    mostrarNotificacion('Enlace sospechoso bloqueado');
                    return false;
                }
            }
        }
    }, true); // Usar captura para interceptar temprano
    
    // Función para verificar enlaces permitidos
    function esEnlacePermitido(url) {
        try {
            const urlObj = new URL(url);
            
            // Permitir enlaces del mismo dominio
            if (urlObj.hostname === window.location.hostname) {
                return true;
            }
            
            // Verificar contra lista blanca
            return dominiosPermitidos.some(dominio => 
                urlObj.hostname === dominio || 
                urlObj.hostname.endsWith('.' + dominio)
            );
        } catch {
            return false;
        }
    }
    
    // Función para mostrar notificaciones al usuario
    function mostrarNotificacion(mensaje) {
        // Crear elemento de notificación
        const notificacion = document.createElement('div');
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4757;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        notificacion.textContent = mensaje;
        
        document.body.appendChild(notificacion);
        
        // Auto-eliminar después de 3 segundos
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.parentNode.removeChild(notificacion);
            }
        }, 3000);
    }
    
    // Bloquear attempts de redirección automática
    window.addEventListener('beforeunload', function(e) {
        // Solo bloquear si no es una acción del usuario
        if (!e.target.tagName) {
            e.preventDefault();
            return e.returnValue = '';
        }
    });
    
    console.log('✅ Bloqueador de pop-ups activado correctamente');
    
})();
