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

        input.addEventListener('keydown', (e) => {
            if (this.isManualSearchActive) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.buffer.length > 0) {
                    this.processBuffer();
                }
            } else if (e.key.length === 1) {
                this.buffer += e.key;
                this.uploader.updateScanStatus('scanning', 'Escaneando...');

                clearTimeout(this.timeout);
                this.timeout = setTimeout(() => {
                    if (this.buffer.length >= 3) {
                        this.processBuffer();
                    } else {
                        this.buffer = '';
                    }
                }, 300);
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

        document.addEventListener('click', () => {
            const active = document.activeElement;
            if (active === manualSearch) return;
            if (active && active.classList && active.classList.contains('qty-input')) return;
            
            this.refocus();
        });
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