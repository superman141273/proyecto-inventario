// ============================================
// Lector de código de barras (corregido)
// ============================================
class BarcodeReader {
    constructor(uploader) {
        this.uploader = uploader;
        this.buffer = '';
        this.timeout = null;
        this.isManualSearchActive = false;
        this.lastProcessed = '';       // anti-duplicado
        this.lastProcessedTime = 0;    // anti-duplicado con timestamp
        this.init();
    }

    init() {
        const input = document.getElementById('barcodeInput');
        const manualSearch = document.getElementById('manualSearch');

        // Capturar teclas del lector USB (que se comporta como teclado)
        input.addEventListener('keydown', (e) => {
            if (this.isManualSearchActive) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                // Procesar solo si hay contenido y no se procesó hace <500ms
                if (this.buffer.length > 0) {
                    this.processBuffer();
                }
            } else if (e.key.length === 1) {
                this.buffer += e.key;
                this.uploader.updateScanStatus('scanning', 'Escaneando...');

                // Timeout de seguridad: si el lector no envía Enter, procesar tras 150ms
                clearTimeout(this.timeout);
                this.timeout = setTimeout(() => {
                    if (this.buffer.length >= 3) {
                        this.processBuffer();
                    } else {
                        this.buffer = '';
                    }
                }, 150);
            }
        });

        // Búsqueda manual
        if (manualSearch) {
            manualSearch.addEventListener('focus', () => { this.isManualSearchActive = true; });
            manualSearch.addEventListener('blur', () => { this.isManualSearchActive = false; });
            manualSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.uploader.manualSearch();
                }
            });
        }
    }

    processBuffer() {
        const code = this.buffer.trim();
        this.buffer = '';
        clearTimeout(this.timeout);

        if (!code) return;

        // Anti-duplicado: mismo código en <500ms = ignorar
        const now = Date.now();
        if (code === this.lastProcessed && (now - this.lastProcessedTime) < 500) {
            return;
        }
        this.lastProcessed = code;
        this.lastProcessedTime = now;

        this.uploader.processBarcode(code);
    }

    // Devuelve el foco al input oculto para que el lector siga funcionando
    refocus() {
        const input = document.getElementById('barcodeInput');
        if (input && !this.isManualSearchActive) {
            input.focus();
        }
    }
}