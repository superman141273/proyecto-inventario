// ============================================
// Utilidades CRUD (editar, eliminar, agregar)
// ============================================
class CrudManager {
    constructor(uploader) {
        this.uploader = uploader;
    }

    // Edición en la tabla principal
    makeEditable(td) {
        if (td.contentEditable === 'true') return;

        const tr = td.parentElement;
        const rowIndex = parseInt(tr.dataset.rowIndex, 10);
        const cellIndex = parseInt(td.dataset.colIndex, 10);

        if (isNaN(rowIndex) || isNaN(cellIndex)) return;

        const oldValue = td.textContent;
        td.contentEditable = 'true';
        td.focus();

        const range = document.createRange();
        range.selectNodeContents(td);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const finish = (save = true) => {
            if (td.dataset.editing === 'false') return;
            td.dataset.editing = 'false';
            td.contentEditable = 'false';
            td.removeEventListener('blur', onBlur);

            if (!save) {
                td.textContent = oldValue;
                return;
            }

            const newValue = td.textContent.trim();
            if (newValue === oldValue) return;

            const data = this.uploader.currentData[this.uploader.currentSheet];
            if (data && data[rowIndex]) {
                data[rowIndex][cellIndex] = newValue;
                
                // REGISTRAR EL CAMBIO EN EL HISTORIAL
                this.uploader.registrarCambio(rowIndex, cellIndex, oldValue, newValue);
                
                this.uploader.guardarEnLocalStorage();
                this.uploader.showNotification('Celda actualizada', 'success');
            }
        };

        const onBlur = () => finish(true);

        td.dataset.editing = 'true';
        td.addEventListener('blur', onBlur);
        td.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                td.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                td.textContent = oldValue;
                td.blur();
            }
        });
    }

    // Eliminar fila
    eliminarFila(rowIndex) {
        const data = this.uploader.currentData[this.uploader.currentSheet];
        if (!data || !data[rowIndex]) return;
        if (!confirm('¿Eliminar esta fila?')) return;

        data.splice(rowIndex, 1);
        this.uploader.guardarEnLocalStorage();
        this.uploader.renderTable();
        this.uploader.searchResultPanel.classList.remove('visible');
        this.uploader.showNotification('Fila eliminada', 'success');
    }

    // Agregar fila
    agregarFila() {
        const data = this.uploader.currentData[this.uploader.currentSheet];
        const headers = this.uploader.currentHeaders[this.uploader.currentSheet];
        if (!data || !headers) {
            this.uploader.showNotification('Carga un archivo primero', 'error');
            return;
        }

        const nuevaFila = new Array(headers.length).fill('');
        data.push(nuevaFila);
        this.uploader.guardarEnLocalStorage();
        this.uploader.renderTable();
        this.uploader.showNotification('Fila agregada. Doble clic para editar.', 'success');

        setTimeout(() => {
            const rows = document.querySelectorAll('#tableBody tr');
            if (rows.length) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}