// ============================================
// Clase base con utilidades compartidas
// ============================================
class BaseUploader {
    showNotification(message, type = 'success') {
        const existing = document.getElementById('barcodeNotification');
        if (existing) existing.remove();

        const n = document.createElement('div');
        n.id = 'barcodeNotification';
        n.className = `notification-${type}`;
        n.textContent = message;
        document.body.appendChild(n);

        setTimeout(() => {
            n.style.opacity = '0';
            setTimeout(() => n.remove(), 300);
        }, 3000);
    }

    updateScanStatus(status, message) {
        const scanStatus = document.getElementById('scanStatus');
        if (!scanStatus) return;
        scanStatus.innerHTML = `<span class="status-indicator status-${status}"></span> ${message}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}