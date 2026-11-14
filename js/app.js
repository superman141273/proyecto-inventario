class InventarioApp extends BaseUploader {
    constructor() {
        super();
        this.currentData = {};
        this.currentHeaders = {};
        this.currentFileName = '';
        this.currentWorkbook = null;
        this.currentSheet = '';
        this.lastHighlightedRow = null;
        this.historialCambios = [];
        this.columnFilters = {};
        this.activeSearchTerm = '';
        this.currentEditCell = null;
        this.menuOpenForCol = -1;
        this.currentOpenResultRow = null;

        this.cacheDOM();
        this.initEventListeners();
        this.barcodeReader = new BarcodeReader(this);
        this.crud = new CrudManager(this);
        this.initKeyboardDetector();
    }

    cacheDOM() {
        this.fileInput = document.getElementById('fileInput');
        this.dropZone = document.getElementById('dropZone');
        this.fileInfo = document.getElementById('fileInfo');
        this.sheetsContainer = document.getElementById('sheetsContainer');
        this.sheetsButtons = document.getElementById('sheetsButtons');
        this.contentContainer = document.getElementById('contentContainer');
        this.sheetNameSpan = document.getElementById('sheetName');
        this.tableInfo = document.getElementById('tableInfo');
        this.tableHeader = document.getElementById('tableHeader');
        this.tableBody = document.getElementById('tableBody');
        this.manualSearchInput = document.getElementById('manualSearch');
        this.searchSuggestions = document.getElementById('searchSuggestions');
        this.clearSearchInputBtn = document.getElementById('clearSearchInputBtn');
        this.exportButton = document.getElementById('exportButton');
        this.exportXLSXButton = document.getElementById('exportXLSXButton');
        
        this.dropText = document.getElementById('dropText');
        this.fileBtnLabel = document.getElementById('fileBtnLabel');
    }

    initEventListeners() {
        this.fileBtnLabel.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (this.currentFileName) {
                const confirmar = confirm("¿Seguro que quieres cargar otro archivo? Se perderán los cambios no exportados del archivo actual.");
                if (confirmar) {
                    this.limpiarInterfaz();
                    this.fileInput.click();
                }
            } else {
                this.fileInput.click();
            }
        });

        this.dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT' && e.target !== this.fileBtnLabel) {
                if (this.currentFileName) {
                    const confirmar = confirm("¿Seguro que quieres cargar otro archivo? Se perderán los cambios no exportados del archivo actual.");
                    if (confirmar) {
                        this.limpiarInterfaz();
                        this.fileInput.click();
                    }
                } else {
                    this.fileInput.click();
                }
            }
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
                this.fileInput.value = '';
            }
        });

        this.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); this.dropZone.classList.add('dragover'); });
        this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('dragover'));
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                if (this.currentFileName) {
                    const confirmar = confirm("¿Seguro que quieres cargar otro archivo? Se perderán los cambios no exportados del archivo actual.");
                    if (confirmar) {
                        this.limpiarInterfaz();
                        this.handleFileSelect(e.dataTransfer.files[0]);
                    }
                } else {
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            }
        });

        document.getElementById('searchButton').addEventListener('click', () => this.manualSearch());

        this.manualSearchInput.addEventListener('input', () => {
            this.activeSearchTerm = this.manualSearchInput.value.trim();
            if (this.activeSearchTerm.length > 0) {
                this.clearSearchInputBtn.style.display = 'flex';
            } else {
                this.clearSearchInputBtn.style.display = 'none';
            }
            if (this.activeSearchTerm.length >= 2) {
                this.updateSuggestions(this.activeSearchTerm);
            } else {
                this.searchSuggestions.classList.remove('active');
                if (this.activeSearchTerm.length === 0) this.clearSearch();
            }
        });

        this.clearSearchInputBtn.addEventListener('click', () => {
            this.manualSearchInput.value = '';
            this.clearSearchInputBtn.style.display = 'none';
            this.clearSearch();
            this.manualSearchInput.focus();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-input-container')) {
                this.searchSuggestions.classList.remove('active');
            }
        });

        document.addEventListener('click', (e) => {
            const menu = document.getElementById('floating-filter-menu');
            if (menu && !menu.contains(e.target) && !e.target.closest('.filter-icon')) {
                menu.remove();
                this.menuOpenForCol = -1;
                document.querySelectorAll('.filter-icon').forEach(icon => icon.classList.remove('active'));
            }
        });

        this.exportButton.addEventListener('click', () => this.exportToCSV());
        this.exportXLSXButton.addEventListener('click', () => this.exportToXLSX());
        document.getElementById('scrollTopButton').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

        document.getElementById('tabInventario').addEventListener('click', () => this.switchTab('viewInventario'));
        document.getElementById('tabCambios').addEventListener('click', () => this.switchTab('viewCambios'));
    }

    initKeyboardDetector() {
        if (!window.visualViewport) return;
        const handleResize = () => {
            const isKeyboardOpen = window.visualViewport.height < window.innerHeight - 150;
            if (isKeyboardOpen) {
                document.body.classList.add('keyboard-open');
            } else {
                document.body.classList.remove('keyboard-open');
            }
        };
        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
    }

    switchTab(targetId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        const btn = document.querySelector(`.tab-btn[data-target="${targetId}"]`);
        if (btn) btn.classList.add('active');
        const content = document.getElementById(targetId);
        if (content) content.style.display = 'block';
    }

    refocusBarcode() {
        const active = document.activeElement;
        if (active && (active.contentEditable === 'true' || active === this.manualSearchInput || active.classList.contains('qty-input'))) return;
        if (this.barcodeReader) this.barcodeReader.refocus();
    }

    handleFileSelect(file) {
        if (!file) return;
        const name = file.name.toLowerCase();
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
            this.showError('Formato no válido. Usa .xlsx, .xls o .csv');
            return;
        }
        this.fileInfo.innerHTML = `<p><strong>Archivo:</strong> ${file.name}</p><p><strong>Tamaño:</strong> ${this.formatFileSize(file.size)}</p><p><span class="loading"></span> Procesando archivo...</p>`;
        this.readFile(file);
    }

    readFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.historialCambios = [];
            this.actualizarVistaCambios();
            if (file.name.toLowerCase().endsWith('.csv')) this.processCSV(e.target.result, file.name);
            else this.processExcel(e.target.result, file.name);
            
            this.dropText.textContent = 'Archivo cargado correctamente';
            this.fileBtnLabel.textContent = 'Cambiar archivo';
            this.fileBtnLabel.classList.add('cambiar-archivo');

            setTimeout(() => {
                const tableContainer = document.getElementById('tableContainer');
                if (tableContainer) {
                    tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 500);
        };
        reader.onerror = () => this.showError('Error al leer el archivo.');
        if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file, 'UTF-8');
        else reader.readAsArrayBuffer(file);
    }

    processExcel(data, fileName) {
        try {
            const wb = XLSX.read(data, { type: 'array' });
            this.currentWorkbook = wb;
            this.currentFileName = fileName;
            this.displaySheetButtons(wb.SheetNames);
            if (wb.SheetNames.length > 0) this.displaySheet(wb.SheetNames[0]);
        } catch (err) { this.showError('Error al procesar Excel: ' + err.message); }
    }

    processCSV(data, fileName) {
        try {
            const parsed = Papa.parse(data, { skipEmptyLines: true });
            this.currentWorkbook = { SheetNames: ['CSV'], Sheets: { CSV: null } };
            this.currentFileName = fileName;
            this.currentData['CSV'] = parsed.data;
            this.currentHeaders['CSV'] = parsed.data.length > 0 ? parsed.data[0].map((h, i) => h && h.toString().trim() !== '' ? h.toString().trim() : `Columna ${i + 1}`) : [];
            this.displaySheetButtons(['CSV']);
            this.displaySheet('CSV');
        } catch (err) { this.showError('Error al procesar CSV.'); }
    }

    displaySheetButtons(sheetNames) {
        this.sheetsButtons.innerHTML = '';
        sheetNames.forEach((name, i) => {
            const btn = document.createElement('button');
            btn.className = 'sheet-btn' + (i === 0 ? ' active' : '');
            btn.textContent = name;
            btn.setAttribute('data-sheet', name);
            btn.onclick = () => this.displaySheet(name);
            this.sheetsButtons.appendChild(btn);
        });
        this.sheetsContainer.style.display = 'block';
    }

    displaySheet(sheetName) {
        document.querySelectorAll('.sheet-btn').forEach(b => b.classList.remove('active'));
        const active = Array.from(document.querySelectorAll('.sheet-btn')).find(b => b.getAttribute('data-sheet') === sheetName);
        if (active) active.classList.add('active');

        this.currentSheet = sheetName;
        this.sheetNameSpan.textContent = sheetName;
        this.columnFilters = {};
        this.menuOpenForCol = -1;
        this.currentOpenResultRow = null;
        this.lastHighlightedRow = null;

        let data;
        if (this.currentWorkbook.SheetNames.includes(sheetName) && sheetName !== 'CSV') {
            const ws = this.currentWorkbook.Sheets[sheetName];
            data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            this.currentData[sheetName] = data;
            this.currentHeaders[sheetName] = data.length > 0 ? data[0].map((h, i) => h && h.toString().trim() !== '' ? h.toString().trim() : `Columna ${i + 1}`) : [];
        } else {
            data = this.currentData[sheetName] || [];
        }

        this.renderTable();
        this.contentContainer.style.display = 'block';
        this.updateScanStatus('success', 'Listo para escanear');
        this.switchTab('viewInventario');
    }

    renderTable() {
        const data = this.currentData[this.currentSheet] || [];
        const headers = this.currentHeaders[this.currentSheet] || [];
        this.tableHeader.innerHTML = '';
        this.tableBody.innerHTML = '';
        this.lastHighlightedRow = null;
        this.currentOpenResultRow = null;

        const hr = document.createElement('tr');
        headers.forEach((h, colIdx) => {
            const th = document.createElement('th');
            const container = document.createElement('div');
            container.className = 'th-filter-container';
            const textSpan = document.createElement('span');
            textSpan.textContent = h;
            container.appendChild(textSpan);

            const filterIcon = document.createElement('span');
            filterIcon.className = 'filter-icon';
            filterIcon.textContent = '▼';
            filterIcon.dataset.colIndex = colIdx;
            if (this.columnFilters[colIdx]) {
                filterIcon.classList.add('active');
            }

            filterIcon.onclick = (e) => {
                e.stopPropagation();
                const existingMenu = document.getElementById('floating-filter-menu');
                if (existingMenu && this.menuOpenForCol === colIdx) {
                    existingMenu.remove();
                    this.menuOpenForCol = -1;
                    filterIcon.classList.remove('active');
                } else {
                    if (existingMenu) existingMenu.remove();
                    document.querySelectorAll('.filter-icon').forEach(icon => icon.classList.remove('active'));
                    filterIcon.classList.add('active');
                    this.menuOpenForCol = colIdx;
                    this.openDropdownFilter(e.currentTarget, colIdx);
                }
            };

            container.appendChild(filterIcon);
            th.appendChild(container);
            hr.appendChild(th);
        });

        const thAcciones = document.createElement('th');
        thAcciones.textContent = 'Acción';
        hr.appendChild(thAcciones);
        this.tableHeader.appendChild(hr);

        this.renderTableBodyOnly();
    }

    renderTableBodyOnly() {
        const data = this.currentData[this.currentSheet] || [];
        const headers = this.currentHeaders[this.currentSheet] || [];
        this.tableBody.innerHTML = '';

        let visibleCount = 0;
        for (let i = 1; i < data.length; i++) {
            const rowData = data[i];
            if (!rowData || rowData.length === 0) continue;
            if (!this.checkRowFilters(rowData)) continue;

            visibleCount++;
            const tr = document.createElement('tr');
            tr.dataset.rowIndex = i;
            tr.id = `fila-${i}`;

            for (let j = 0; j < headers.length; j++) {
                const td = document.createElement('td');
                td.dataset.colIndex = j;
                const val = rowData[j] !== undefined && rowData[j] !== null ? rowData[j].toString() : '';
                td.textContent = val;
                if (val.length > 100) { td.textContent = val.substring(0, 100) + '...'; td.title = val; }
                tr.appendChild(td);
            }

            const tdAcc = document.createElement('td');
            tdAcc.className = 'row-actions';
            const btnSel = document.createElement('button');
            btnSel.textContent = 'Seleccionar';
            btnSel.className = 'btn-seleccionar';
            btnSel.onclick = () => this.seleccionarFila(i, 0);
            tdAcc.appendChild(btnSel);
            tr.appendChild(tdAcc);

            this.tableBody.appendChild(tr);
        }

        this.tableInfo.textContent = `${visibleCount} fila${visibleCount !== 1 ? 's' : ''} visibles, ${headers.length} columna${headers.length !== 1 ? 's' : ''}`;
    }

    openDropdownFilter(iconElement, colIdx) {
        const existingMenu = document.getElementById('floating-filter-menu');
        if (existingMenu) existingMenu.remove();

        const rect = iconElement.getBoundingClientRect();
        const data = this.currentData[this.currentSheet] || [];
        const uniqueValues = new Set();

        for (let i = 1; i < data.length; i++) {
            const val = data[i][colIdx];
            if (val !== undefined && val !== null) uniqueValues.add(val.toString().trim());
        }

        let tempFilters = this.columnFilters[colIdx] ? [...this.columnFilters[colIdx]] : Array.from(uniqueValues);

        const menu = document.createElement('div');
        menu.id = 'floating-filter-menu';
        menu.className = 'floating-filter-menu';

        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.left = `${rect.left + window.scrollX}px`;

        const allLabel = document.createElement('label');
        allLabel.className = 'filter-option';
        const allCheck = document.createElement('input');
        allCheck.type = 'checkbox';
        allCheck.checked = tempFilters.length === uniqueValues.size;

        allCheck.onchange = (e) => {
            tempFilters = e.target.checked ? Array.from(uniqueValues) : [];
            list.querySelectorAll('input[type="checkbox"]').forEach(chk => {
                chk.checked = e.target.checked;
            });
        };

        allLabel.appendChild(allCheck);
        allLabel.appendChild(document.createTextNode('Seleccionar todo'));
        menu.appendChild(allLabel);

        const list = document.createElement('div');
        list.className = 'filter-list';

        uniqueValues.forEach(val => {
            const label = document.createElement('label');
            label.className = 'filter-option';

            const check = document.createElement('input');
            check.type = 'checkbox';
            check.value = val;
            check.checked = tempFilters.includes(val);

            check.onchange = () => {
                if (check.checked) {
                    if (!tempFilters.includes(val)) tempFilters.push(val);
                } else {
                    tempFilters = tempFilters.filter(v => v !== val);
                }
                allCheck.checked = tempFilters.length === uniqueValues.size;
            };

            label.appendChild(check);
            label.appendChild(document.createTextNode(val));
            list.appendChild(label);
        });
        menu.appendChild(list);

        const actions = document.createElement('div');
        actions.className = 'filter-actions';

        const btnClear = document.createElement('button');
        btnClear.className = 'filter-btn-sm filter-btn-clear';
        btnClear.textContent = 'Limpiar filtro';
        btnClear.onclick = () => {
            delete this.columnFilters[colIdx];
            this.renderTableBodyOnly();
            menu.remove();
            this.menuOpenForCol = -1;
            document.querySelectorAll('.filter-icon').forEach(icon => icon.classList.remove('active'));
        };

        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'filter-btn-sm filter-btn-confirm';
        btnConfirm.textContent = 'Confirmar';
        btnConfirm.onclick = () => {
            if (tempFilters.length === uniqueValues.size) {
                delete this.columnFilters[colIdx];
            } else {
                this.columnFilters[colIdx] = tempFilters;
            }
            this.renderTableBodyOnly();
            menu.remove();
            this.menuOpenForCol = -1;
            document.querySelectorAll('.filter-icon').forEach(icon => icon.classList.remove('active'));
        };

        actions.appendChild(btnClear);
        actions.appendChild(btnConfirm);
        menu.appendChild(actions);

        document.body.appendChild(menu);
    }

    checkRowFilters(rowData) {
        for (const colIdx in this.columnFilters) {
            const allowedValues = this.columnFilters[colIdx];
            if (allowedValues.length === 0) return false;
            const val = rowData[colIdx] !== undefined && rowData[colIdx] !== null ? rowData[colIdx].toString().trim() : '';
            if (!allowedValues.includes(val)) return false;
        }
        return true;
    }

    updateSuggestions(term) {
        const data = this.currentData[this.currentSheet];
        const headers = this.currentHeaders[this.currentSheet];
        if (!data || !headers) return;

        const termLower = term.toLowerCase();
        const matches = [];

        for (let i = 1; i < data.length; i++) {
            if (!this.checkRowFilters(data[i])) continue;
            for (let j = 0; j < headers.length; j++) {
                const raw = data[i][j];
                if (raw === undefined || raw === null) continue;
                const v = raw.toString().trim();
                if (v.toLowerCase().includes(termLower)) {
                    const descIndex = headers.findIndex(h => h.toLowerCase().includes('descrip') || h.toLowerCase().includes('nombre'));
                    const desc = descIndex !== -1 ? data[i][descIndex] : '';
                    if (!matches.some(m => m.val === v)) {
                        matches.push({ val: v, desc: desc ? desc.toString().substring(0, 40) : '', rowIndex: i, colIndex: j });
                    }
                    if (matches.length >= 8) break;
                }
            }
            if (matches.length >= 8) break;
        }

        this.searchSuggestions.innerHTML = '';
        if (matches.length === 0) {
            this.searchSuggestions.classList.remove('active');
            return;
        }

        matches.forEach(m => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';

            const title = document.createElement('span');
            title.className = 'suggestion-title';
            title.textContent = m.val;

            const subtitle = document.createElement('span');
            subtitle.className = 'suggestion-subtitle';
            subtitle.textContent = m.desc ? `Descripción: ${m.desc}...` : '';

            item.appendChild(title);
            if (m.desc) item.appendChild(subtitle);

            item.onclick = () => {
                this.manualSearchInput.value = m.val;
                this.activeSearchTerm = m.val;
                this.clearSearchInputBtn.style.display = 'flex';
                this.searchSuggestions.classList.remove('active');
                this.manualSearch();
            };

            this.searchSuggestions.appendChild(item);
        });

        this.searchSuggestions.classList.add('active');
    }

    manualSearch() {
        const term = this.activeSearchTerm;
        if (!term || term.length < 2) {
            this.clearSearch();
            return;
        }
        const found = this.searchInData(term);
        if (!found) this.showNotification('No se encontraron coincidencias', 'error');
    }

    processBarcode(code) {
        if (!this.currentData[this.currentSheet]) {
            this.updateScanStatus('error', 'Carga un archivo primero');
            return;
        }

        if (this.currentOpenResultRow) {
            this.currentOpenResultRow.remove();
            this.currentOpenResultRow = null;
        }

        this.activeSearchTerm = code;
        this.manualSearchInput.value = code;
        this.clearSearchInputBtn.style.display = 'flex';
        this.searchSuggestions.classList.remove('active');

        const found = this.searchInData(code);
        if (found) {
            this.updateScanStatus('success', `Encontrado: ${code}`);
            this.showNotification(`Encontrado: ${code}`, 'success');
        } else {
            this.updateScanStatus('error', `No encontrado: ${code}`);
            this.showNotification(`No encontrado: ${code}`, 'error');
        }
        this.refocusBarcode();
    }

    searchInData(term) {
        const data = this.currentData[this.currentSheet];
        const headers = this.currentHeaders[this.currentSheet];
        if (!data || !headers) return false;

        if (this.lastHighlightedRow) {
            this.lastHighlightedRow.classList.remove('highlighted');
            this.lastHighlightedRow = null;
        }

        const termLower = term.toLowerCase();
        let foundRow = -1;
        let foundCol = -1;

        for (let i = 1; i < data.length; i++) {
            if (!this.checkRowFilters(data[i])) continue;
            for (let j = 0; j < headers.length; j++) {
                const raw = data[i][j];
                if (raw === undefined || raw === null) continue;
                const v = raw.toString().trim();
                if (v.toLowerCase().includes(termLower)) {
                    foundRow = i;
                    foundCol = j;
                    break;
                }
            }
            if (foundRow !== -1) break;
        }

        if (foundRow === -1) {
            this.clearSearch();
            return false;
        }

        this.highlightRow(foundRow);
        this.displaySearchResult(foundRow, data[foundRow], headers, term, foundCol);
        return true;
    }

    highlightRow(dataRowIndex) {
        if (this.lastHighlightedRow && this.lastHighlightedRow.id === `fila-${dataRowIndex}`) return;
        if (this.lastHighlightedRow) this.lastHighlightedRow.classList.remove('highlighted');
        const row = document.getElementById(`fila-${dataRowIndex}`);
        if (!row) return;
        row.classList.add('highlighted');
        this.lastHighlightedRow = row;
    }

    seleccionarFila(rowIndex, colIndex) {
        const data = this.currentData[this.currentSheet];
        const headers = this.currentHeaders[this.currentSheet];
        if (!data || !data[rowIndex]) return;

        this.highlightRow(rowIndex);
        this.displaySearchResult(rowIndex, data[rowIndex], headers, '', colIndex);
    }

    displaySearchResult(rowIndex, rowData, headers, term, matchColIndex) {
        if (this.currentOpenResultRow) {
            this.currentOpenResultRow.remove();
            this.currentOpenResultRow = null;
        }

        const targetRow = document.getElementById(`fila-${rowIndex}`);
        if (!targetRow) return;

        let qtyColIndex = -1;
        const qtyKeywords = ['existencia', 'cantidad', 'stock', 'qty', 'unidades'];

        for (let i = 0; i < headers.length; i++) {
            const headerLower = headers[i].toLowerCase();
            if (qtyKeywords.some(kw => headerLower.includes(kw))) {
                qtyColIndex = i;
                break;
            }
        }

        const resultTr = document.createElement('tr');
        resultTr.className = 'inline-result-row';

        const td = document.createElement('td');
        td.colSpan = headers.length + 1;

        const container = document.createElement('div');
        container.className = 'inline-result-container';

        const table = document.createElement('table');
        table.className = 'result-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        headers.forEach((h, idx) => {
            if (h.toLowerCase() !== 'familia') {
                const th = document.createElement('th');
                th.textContent = h;
                headerRow.appendChild(th);
            }
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');

        let qtyInputReference = null;
        let qtyCellReference = null;

        headers.forEach((h, colIdx) => {
            if (h.toLowerCase() === 'familia') return;

            const cell = document.createElement('td');
            cell.dataset.colIndex = colIdx;
            const raw = rowData[colIdx];
            const txt = raw !== undefined && raw !== null ? raw.toString() : '';

            if (term && txt.toLowerCase().includes(term.toLowerCase()) && txt !== '') {
                const regex = new RegExp(`(${term})`, 'gi');
                cell.innerHTML = txt.replace(regex, '<span class="match-highlight">$1</span>');
            } else {
                cell.textContent = txt;
            }

            if (colIdx === qtyColIndex) {
                cell.classList.add('editable-quantity');
                cell.innerHTML = '';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = txt;
                input.className = 'qty-input';
                input.setAttribute('inputmode', 'decimal');
                input.setAttribute('pattern', '[0-9]*');

                let barcodeBuffer = '';
                let barcodeTimeout = null;

                input.addEventListener('input', (e) => {
                    barcodeBuffer += e.data || '';
                    clearTimeout(barcodeTimeout);
                    barcodeTimeout = setTimeout(() => {
                        barcodeBuffer = '';
                    }, 500);

                    if (barcodeBuffer.length >= 5) {
                        const scannedCode = barcodeBuffer;
                        barcodeBuffer = '';
                        input.value = txt;
                        setTimeout(() => {
                            this.processBarcode(scannedCode);
                        }, 50);
                    }
                });

                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        this.confirmQuantityEdit(cell, input, rowIndex, colIdx);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        this.cancelQuantityEdit(cell, txt);
                    }
                };

                cell.addEventListener('mousedown', (e) => {
                    if (e.target !== input) {
                        e.preventDefault();
                        input.focus();
                        input.select();
                    }
                });
                cell.addEventListener('touchstart', (e) => {
                    if (e.target !== input) {
                        e.preventDefault();
                        input.focus();
                        input.select();
                    }
                }, { passive: false });

                cell.appendChild(input);
                qtyInputReference = input;
                qtyCellReference = cell;
            } else {
                cell.style.cursor = 'default';
                cell.style.backgroundColor = '#f9f9f9';
            }

            tr.appendChild(cell);
        });
        tbody.appendChild(tr);
        table.appendChild(tbody);
        container.appendChild(table);

        if (qtyCellReference) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'edit-actions-row';

            const btnCancel = document.createElement('button');
            btnCancel.className = 'edit-action-btn edit-action-cancel';
            btnCancel.innerHTML = '✕';
            btnCancel.onmousedown = (e) => e.preventDefault();
            btnCancel.onclick = (e) => {
                e.stopPropagation();
                this.cancelQuantityEdit(qtyCellReference, rowData[qtyColIndex]);
            };

            const btnConfirm = document.createElement('button');
            btnConfirm.className = 'edit-action-btn edit-action-confirm';
            btnConfirm.innerHTML = '✓';
            btnConfirm.onmousedown = (e) => e.preventDefault();
            btnConfirm.onclick = (e) => {
                e.stopPropagation();
                this.confirmQuantityEdit(qtyCellReference, qtyInputReference, rowIndex, qtyColIndex);
            };

            actionsDiv.appendChild(btnCancel);
            actionsDiv.appendChild(btnConfirm);
            container.appendChild(actionsDiv);
        }

        td.appendChild(container);
        resultTr.appendChild(td);

        targetRow.parentNode.insertBefore(resultTr, targetRow.nextSibling);
        this.currentOpenResultRow = resultTr;

        setTimeout(() => {
            this.scrollToResultBlock(targetRow, resultTr);
            if (qtyInputReference) {
                setTimeout(() => {
                    qtyInputReference.focus({ preventScroll: true });
                    qtyInputReference.select();
                }, 100);
            }
        }, 100);
    }

    scrollToResultBlock(rowElement, resultElement) {
        if (!rowElement || !resultElement) return;

        const scrollContainer = rowElement.closest('.table-scroll');
        if (!scrollContainer) return;

        const rowTop = rowElement.offsetTop;
        const targetScroll = rowTop - 10;

        scrollContainer.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth'
        });
    }

    confirmQuantityEdit(cell, input, rowIndex, colIdx) {
        const nuevoValor = input.value.trim();
        const data = this.currentData[this.currentSheet];

        cell.innerHTML = nuevoValor;

        if (data && data[rowIndex]) {
            const valorAnterior = data[rowIndex][colIdx] !== undefined && data[rowIndex][colIdx] !== null ? data[rowIndex][colIdx].toString() : '';

            if (valorAnterior !== nuevoValor) {
                data[rowIndex][colIdx] = nuevoValor;

                const mainRow = document.getElementById(`fila-${rowIndex}`);
                if (mainRow) {
                    const mainCell = mainRow.querySelector(`td[data-col-index="${colIdx}"]`);
                    if (mainCell) mainCell.textContent = nuevoValor;
                    mainRow.classList.add('highlighted');
                    this.lastHighlightedRow = mainRow;
                }

                this.registrarCambio(rowIndex, colIdx, valorAnterior, nuevoValor);
                this.showNotification('Cantidad actualizada', 'success');
            }
        }

        if (this.currentOpenResultRow) {
            this.currentOpenResultRow.remove();
            this.currentOpenResultRow = null;
        }

        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        this.refocusBarcode();
        
        if (this.lastHighlightedRow) {
            setTimeout(() => {
                this.lastHighlightedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    cancelQuantityEdit(cell, originalValue) {
        cell.innerHTML = originalValue;
        this.showNotification('Edición cancelada', 'warning');

        if (this.currentOpenResultRow) {
            this.currentOpenResultRow.remove();
            this.currentOpenResultRow = null;
        }

        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        this.refocusBarcode();
        
        if (this.lastHighlightedRow) {
            setTimeout(() => {
                this.lastHighlightedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    clearSearch() {
        this.activeSearchTerm = '';
        this.manualSearchInput.value = '';
        this.clearSearchInputBtn.style.display = 'none';
        this.searchSuggestions.classList.remove('active');
        if (this.lastHighlightedRow) {
            this.lastHighlightedRow.classList.remove('highlighted');
            this.lastHighlightedRow = null;
        }
        if (this.currentOpenResultRow) {
            this.currentOpenResultRow.remove();
            this.currentOpenResultRow = null;
        }
    }

    registrarCambio(rowIndex, colIndex, valorAnterior, valorNuevo) {
        const headers = this.currentHeaders[this.currentSheet];
        const nombreColumna = headers[colIndex] || `Columna ${colIndex + 1}`;

        const cambioExistenteIndex = this.historialCambios.findIndex(
            c => c.fila === rowIndex && c.columnaIdx === colIndex
        );

        if (cambioExistenteIndex !== -1) {
            if (valorNuevo === this.historialCambios[cambioExistenteIndex].anterior) {
                this.historialCambios.splice(cambioExistenteIndex, 1);
            } else {
                this.historialCambios[cambioExistenteIndex].nuevo = valorNuevo;
            }
        } else {
            this.historialCambios.push({
                id: Date.now() + Math.random().toString(36).substr(2, 5),
                fila: rowIndex,
                columnaIdx: colIndex,
                columna: nombreColumna,
                anterior: valorAnterior,
                nuevo: valorNuevo
            });
        }
        this.actualizarVistaCambios();
    }

    actualizarVistaCambios() {
        const tbody = document.getElementById('tableCambiosBody');
        const badge = document.getElementById('badgeCambios');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.historialCambios.length > 0) {
            badge.textContent = this.historialCambios.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }

        this.historialCambios.forEach((cambio) => {
            const tr = document.createElement('tr');

            tr.addEventListener('click', (e) => {
                if (e.target.closest('.btn-eliminar-cambio')) return;
                document.querySelectorAll('#tableCambiosBody tr').forEach(r => r.classList.remove('selected-row'));
                tr.classList.add('selected-row');
                this.mostrarDetallesProducto(cambio.fila);
            });

            const tdFila = document.createElement('td');
            tdFila.textContent = cambio.fila;
            tr.appendChild(tdFila);

            const tdCol = document.createElement('td');
            tdCol.textContent = cambio.columna;
            tr.appendChild(tdCol);

            const tdAnt = document.createElement('td');
            tdAnt.textContent = cambio.anterior;
            tdAnt.style.color = '#dc3545';
            tdAnt.style.textDecoration = 'line-through';
            tr.appendChild(tdAnt);

            const tdNuevo = document.createElement('td');
            tdNuevo.textContent = cambio.nuevo;
            tdNuevo.style.color = '#28a745';
            tdNuevo.style.fontWeight = 'bold';
            tr.appendChild(tdNuevo);

            const tdAccion = document.createElement('td');
            const btnEliminar = document.createElement('button');
            btnEliminar.className = 'btn-eliminar-cambio';
            btnEliminar.innerHTML = 'Deshacer';
            btnEliminar.title = 'Revertir al valor original';
            btnEliminar.onclick = () => this.deshacerCambio(cambio.id);
            tdAccion.appendChild(btnEliminar);
            tr.appendChild(tdAccion);

            tbody.appendChild(tr);
        });
    }

    mostrarDetallesProducto(rowIndex) {
        const data = this.currentData[this.currentSheet];
        const headers = this.currentHeaders[this.currentSheet];
        if (!data || !data[rowIndex]) return;

        const producto = data[rowIndex];
        const contenedor = document.getElementById('detallesProducto');
        const grid = document.getElementById('detallesGrid');

        grid.innerHTML = '';

        headers.forEach((header, idx) => {
            const item = document.createElement('div');
            item.className = 'detalles-item';
            const label = document.createElement('span');
            label.className = 'detalles-label';
            label.textContent = header;
            const val = document.createElement('div');
            val.className = 'detalles-value';
            val.textContent = producto[idx] !== undefined && producto[idx] !== null ? producto[idx].toString() : '';
            item.appendChild(label);
            item.appendChild(val);
            grid.appendChild(item);
        });
        contenedor.classList.add('visible');
    }

    deshacerCambio(idCambio) {
        if (!confirm('¿Estás seguro de deshacer este cambio? El valor volverá a como estaba antes.')) return;
        const index = this.historialCambios.findIndex(c => c.id === idCambio);
        if (index === -1) return;
        const cambio = this.historialCambios[index];
        const data = this.currentData[this.currentSheet];

        if (data && data[cambio.fila]) {
            data[cambio.fila][cambio.columnaIdx] = cambio.anterior;
            this.renderTable();

            const detalleContainer = document.getElementById('detallesProducto');
            if (detalleContainer.classList.contains('visible')) {
                this.mostrarDetallesProducto(cambio.fila);
            }
        }
        this.historialCambios.splice(index, 1);
        this.actualizarVistaCambios();
        this.showNotification('Cambio deshecho correctamente', 'success');
    }

    exportToCSV() {
        if (!this.currentData[this.currentSheet]) { this.showNotification('No hay datos para exportar', 'error'); return; }

        const data = this.currentData[this.currentSheet];

        const csv = '\uFEFF' + data.map(row => row.map(cell => {
            const v = cell !== undefined && cell !== null ? cell.toString() : '';
            return (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(',')).join('\r\n');

        const name = this.generarNombreArchivo('csv');
        this.descargarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), name);
    }

    exportToXLSX() {
        if (!this.currentData[this.currentSheet]) { this.showNotification('No hay datos para exportar', 'error'); return; }

        const data = this.currentData[this.currentSheet];

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, this.currentSheet);
        const name = this.generarNombreArchivo('xlsx');
        XLSX.writeFile(wb, name);
        this.showNotification(`Descargado: ${name}`, 'success');
    }

    generarNombreArchivo(ext) {
        const now = new Date();
        const f = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const h = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        const base = (this.currentFileName || 'inventario').replace(/\.[^/.]+$/, '');
        return `${base}_${this.currentSheet}_${f}_${h}.${ext}`;
    }

    descargarBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.showNotification(`Descargado: ${fileName}`, 'success');
    }

    limpiarInterfaz() {
        this.currentData = {}; this.currentHeaders = {}; this.currentFileName = '';
        this.currentWorkbook = null; this.currentSheet = ''; this.lastHighlightedRow = null;
        this.historialCambios = []; this.columnFilters = {}; this.activeSearchTerm = '';
        this.menuOpenForCol = -1;
        this.currentOpenResultRow = null;

        this.actualizarVistaCambios();
        document.getElementById('detallesProducto').classList.remove('visible');

        this.fileInfo.innerHTML = '<p>No se ha seleccionado ningún archivo</p>';
        this.sheetsContainer.style.display = 'none';
        this.contentContainer.style.display = 'none';
        this.manualSearchInput.value = '';
        this.clearSearchInputBtn.style.display = 'none';
        this.searchSuggestions.classList.remove('active');
        this.updateScanStatus('success', 'Esperando archivo...');
        
        this.dropText.textContent = 'Arrastra tu archivo de inventario aquí';
        this.fileBtnLabel.textContent = 'Seleccionar archivo (.xlsx, .xls, .csv)';
        this.fileBtnLabel.classList.remove('cambiar-archivo');
    }

    showError(msg) {
        this.fileInfo.innerHTML = `<p style="color:#dc3545;">${msg}</p>`;
        this.sheetsContainer.style.display = 'none';
        this.contentContainer.style.display = 'none';
        this.updateScanStatus('error', 'Error al cargar archivo');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new InventarioApp();
});