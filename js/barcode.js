class BarcodeReader {
    constructor(uploader) {
        this.uploader = uploader;
        this.buffer = '';
        this.timeout = null;
        this.isManualSearchActive = false;
        this.lastProcessed = '';
        this.lastProcessedTime = 0;
        this.init();
    }

    init() {
        const input = document.getElementById('barcodeInput');
        const manualSearch = document.getElementById('manualSearch');

        // 1. Captura tradicional (cuando el input oculto tiene el foco)
        input.addEventListener('keydown', (e) => {
            if (this.isManualSearchActive) return;
            this.handleKey(e);
        });

        // 2. Captura GLOBAL (Para lectores Bluetooth que pierden el foco)
        document.addEventListener('keydown', (e) => {
            const active = document.activeElement;

            // Si el usuario está escribiendo en el buscador o en la cantidad, no interferir
            if (active === manualSearch) return;
            if (active && active.classList && active.classList.contains('qty-input')) return;

            // Si el evento ya se manejó en el input oculto, evitar duplicados
            if (e.target === input) return;

            // Si la tecla es un carácter imprimible (letra o número) y viene rápido
            if (e.key.length === 1) {
                this.handleKey(e);
            } else if (e.key === 'Enter') {
                // Si se presiona Enter en la página, procesamos lo que haya en el buffer
                if (this.buffer.length > 0) {
                    e.preventDefault();
                    this.processBuffer();
                }
            }
        });

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

        // 3. Guardián del foco (Para mantener el input oculto listo)
        document.addEventListener('click', () => {
            const active = document.activeElement;
            if (active === manualSearch) return;
            if (active && active.classList && active.classList.contains('qty-input')) return;
            this.refocus();
        });
    }

    handleKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (this.buffer.length > 0) {
                this.processBuffer();
            }
        } else if (e.key.length === 1) {
            // Evitar que el navegador haga scroll o active atajos con teclas sueltas
            if (document.activeElement !== document.getElementById('manualSearch')) {
                e.preventDefault();
            }
            
            this.buffer += e.key;
            this.uploader.updateScanStatus('scanning', 'Escaneando...');

            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                if (this.buffer.length >= 3) {
                    this.processBuffer();
                } else {
                    this.buffer = '';
                }
            }, 300); // 300ms de tolerancia para Bluetooth
        }
    }

    processBuffer() {
        const code = this.buffer.trim();
        this.buffer = '';
        clearTimeout(this.timeout);

        if (!code) return;

        const now = Date.now();
        if (code === this.lastProcessed && (now - this.lastProcessedTime) < 500) {
            return;
        }
        this.lastProcessed = code;
        this.lastProcessedTime = now;

        this.uploader.processBarcode(code);
    }

    refocus() {
        const input = document.getElementById('barcodeInput');
        if (input && !this.isManualSearchActive) {
            input.focus({ preventScroll: true });
        }
    }
}