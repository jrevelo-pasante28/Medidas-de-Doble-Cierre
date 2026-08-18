const API_URL = "https://script.google.com/macros/s/AKfycbwDdIrNg6y0QromhaEejGjrM8uFZnRuKnKAgxaho7pvSIkz9VHrjb4Bqxl7vDvaWYFO/exec"; 

// Definir función antes de usarla
function generarID() { return Math.random().toString(36).substr(2, 9); }

let estado = {
    visita: { id_visita: generarID(), fecha: '', cliente: '', codigo: '', tecnico: '' },
    informes: [], 
    firmaBase64: ''
};

// ==========================================
// BASES DE DATOS (Se llenarán desde Sheets)
// ==========================================
let baseClientes = [];
let baseTecnicos = [];
let baseFormatos = [];

document.addEventListener("DOMContentLoaded", () => {
    cargarEstado();
    initFirma();
    if(estado.informes.length === 0) agregarInforme(); else renderizarInformes();
    cargarListasDesdeServidor();
});

function guardarEstado() {
    estado.visita.fecha = document.getElementById('v-fecha').value;
    estado.visita.cliente = document.getElementById('v-cliente').value;
    estado.visita.codigo = document.getElementById('v-codigo').value;
    estado.visita.tecnico = document.getElementById('v-tecnico').value;
    localStorage.setItem('dobleCierreApp2', JSON.stringify(estado));
}

function cargarEstado() {
    const dataGuardada = localStorage.getItem('dobleCierreApp2');
    if (dataGuardada) {
        const idActual = estado.visita.id_visita;
        const dataCargada = JSON.parse(dataGuardada);
        estado = dataCargada;
        estado.visita.id_visita = idActual;
        document.getElementById('v-fecha').value = estado.visita.fecha;
        document.getElementById('v-cliente').value = estado.visita.cliente;
        document.getElementById('v-codigo').value = document.getElementById('v-codigo').value || estado.visita.codigo;
        document.getElementById('v-tecnico').value = estado.visita.tecnico;
    }
}

// ==========================================
// CARGA DE LISTAS Y AUTOCOMPLETADO
// ==========================================
async function cargarListasDesdeServidor() {
    const statusDiv = document.getElementById('sync-status');
    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando listas...';
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        if (data.status === 'success') {
            baseClientes = data.clientes;
            baseTecnicos = data.tecnicos;
            baseFormatos = data.formatos || []; 
            
            inicializarListas();
            
            statusDiv.innerHTML = '<i class="fa-solid fa-cloud"></i> Listo';
            statusDiv.className = "text-xs font-bold bg-blue-900 px-3 py-1 rounded-full shadow-inner text-white";
        }
    } catch (error) {
        console.error("No se pudieron cargar las listas:", error);
        statusDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Sin conexión';
        statusDiv.className = "text-xs font-bold bg-red-600 px-3 py-1 rounded-full shadow-inner text-white";
    }
}

function inicializarListas() {
    const listClientes = document.getElementById('lista-clientes');
    listClientes.innerHTML = ''; 
    baseClientes.forEach(c => listClientes.innerHTML += `<option value="${c.nombre}">`);

    const listTecnicos = document.getElementById('lista-tecnicos');
    listTecnicos.innerHTML = ''; 
    baseTecnicos.forEach(t => listTecnicos.innerHTML += `<option value="${t}">`);
    
    const listFormatos = document.getElementById('lista-formatos');
    if(listFormatos) {
        listFormatos.innerHTML = ''; 
        baseFormatos.forEach(f => listFormatos.innerHTML += `<option value="${f}">`);
    }
}

function autoCompletarCodigoCliente() {
    const nombreCliente = document.getElementById('v-cliente').value;
    const clienteEncontrado = baseClientes.find(c => c.nombre.toLowerCase() === nombreCliente.toLowerCase());
    
    if(clienteEncontrado) {
        document.getElementById('v-codigo').value = clienteEncontrado.codigo;
    }
    guardarEstado();
}

// ==========================================
// CÁLCULO AUTOMÁTICO DE TRASLAPE
// ==========================================
function calcularTraslapesDeCabezal(infoIdx, cabIdx) {
    const informe = estado.informes[infoIdx];
    const med = informe.mediciones[cabIdx];
    const espesorTapa = parseFloat(String(informe.espesor_tapa).replace(',', '.')) || 0;

    for (let x = 0; x < 3; x++) {
        const gc = parseFloat(String(med.gc[x]).replace(',', '.')) || 0;
        const gt = parseFloat(String(med.gt[x]).replace(',', '.')) || 0;
        const ancho = parseFloat(String(med.ancho[x]).replace(',', '.')) || 0;

        if (gc > 0 && gt > 0 && ancho > 0 && espesorTapa > 0) {
            let traslapeCalculado = gc + gt + (1.1 * espesorTapa) - ancho;
            med.tras[x] = traslapeCalculado.toFixed(3); 
            
            let inputTraslape = document.getElementById(`input_tras_${infoIdx}_${cabIdx}_${x}`);
            if (inputTraslape) inputTraslape.value = med.tras[x];
        }
    }
}

function actualizarCampoMedicion(infoIdx, cabIdx, campo, subIdx, valor) {
    if(subIdx !== null) estado.informes[infoIdx].mediciones[cabIdx][campo][subIdx] = valor;
    else estado.informes[infoIdx].mediciones[cabIdx][campo] = valor;
    
    if (['gc', 'gt', 'ancho'].includes(campo)) {
        calcularTraslapesDeCabezal(infoIdx, cabIdx);
    }
    guardarEstado();
}

function actualizarCampoInfo(infoIdx, campo, valor) {
    estado.informes[infoIdx][campo] = valor;
    
    if (campo === 'espesor_tapa') {
        estado.informes[infoIdx].mediciones.forEach((_, cIdx) => calcularTraslapesDeCabezal(infoIdx, cIdx));
    }
    guardarEstado();
}

// ==========================================
// RENDERIZADO DINÁMICO
// ==========================================
function agregarInforme() {
    estado.informes.push({
        id_informe: generarID(), linea: '', maquina: '', espesor_tapa: '', producto: '', formato: '',
        mediciones: []
    });
    guardarEstado(); renderizarInformes();
}

function eliminarInforme(idx) {
    if(confirm("¿Borrar este informe completo?")) {
        estado.informes.splice(idx, 1);
        guardarEstado(); renderizarInformes();
    }
}

function agregarCabezal(infoIdx) {
    estado.informes[infoIdx].mediciones.push({
        id_medicion: generarID(), num_cabezal: estado.informes[infoIdx].mediciones.length + 1,
        prof: ["","",""], esp: ["","",""], ancho: ["","",""], 
        gc: ["","",""], gt: ["","",""], tras: ["","",""], 
        porc_plan: ""
    });
    guardarEstado(); renderizarInformes();
}

function eliminarCabezal(infoIdx, cabIdx) {
    estado.informes[infoIdx].mediciones.splice(cabIdx, 1);
    estado.informes[infoIdx].mediciones.forEach((m, i) => m.num_cabezal = i + 1); 
    guardarEstado(); renderizarInformes();
}

function renderizarInformes() {
    const container = document.getElementById('informes-container');
    let html = '';
    
    estado.informes.forEach((informe, i) => {
        html += `
        <div class="bg-white p-6 rounded-xl shadow-sm border-t-4 border-t-blue-600 border-x border-b border-slate-200">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-bold text-blue-800"><i class="fa-solid fa-gears mr-2"></i> Informe ${i+1}</h2>
                <button onclick="eliminarInforme(${i})" class="text-red-500 font-bold text-sm"><i class="fa-solid fa-trash"></i> Eliminar Informe</button>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 bg-slate-50 p-4 rounded-lg border">
                <div><label class="text-xs font-bold text-slate-500 uppercase">Línea</label><input type="text" value="${informe.linea}" oninput="actualizarCampoInfo(${i}, 'linea', this.value)" class="w-full border p-2 rounded"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Cerradora</label><input type="text" value="${informe.maquina}" oninput="actualizarCampoInfo(${i}, 'maquina', this.value)" class="w-full border p-2 rounded"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Espesor Tapa</label><input type="number" step="0.001" value="${informe.espesor_tapa}" oninput="actualizarCampoInfo(${i}, 'espesor_tapa', this.value)" class="w-full border p-2 rounded focus:ring-1 focus:ring-blue-400"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Producto (PDF)</label><input type="text" value="${informe.producto}" oninput="actualizarCampoInfo(${i}, 'producto', this.value)" class="w-full border p-2 rounded"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Formato (PDF)</label><input type="text" list="lista-formatos" value="${informe.formato}" oninput="actualizarCampoInfo(${i}, 'formato', this.value)" class="w-full border p-2 rounded"></div>
            </div>

            <h3 class="text-sm font-bold mb-3 text-slate-600 border-b pb-1">Mediciones (Cabezales)</h3>
            <div class="space-y-4 mb-4">
                ${informe.mediciones.map((m, c) => renderizarFilaCabezal(i, c, m)).join('')}
            </div>
            
            <button onclick="agregarCabezal(${i})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-4 rounded-lg w-full border border-blue-200 transition">
                <i class="fa-solid fa-plus"></i> Añadir Cabezal a este Informe
            </button>
        </div>`;
    });
    
    container.innerHTML = html;
}

function renderizarFilaCabezal(i, c, m) {
    const triple = (lbl, cmp) => {
        const esTraslape = cmp === 'tras';
        const readonlyAttr = esTraslape ? 'readonly class="w-full border p-1 rounded text-xs text-center bg-slate-200 text-slate-500 cursor-not-allowed"' : 'class="w-full border p-1 rounded text-xs text-center focus:ring-1 focus:ring-blue-400 outline-none"';
        
        return `
        <div class="w-full">
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1 truncate">${lbl}</label>
            <div class="grid grid-cols-3 gap-1">
                <input type="number" step="0.001" id="input_${cmp}_${i}_${c}_0" value="${m[cmp][0]}" oninput="actualizarCampoMedicion(${i},${c},'${cmp}',0,this.value)" ${readonlyAttr}>
                <input type="number" step="0.001" id="input_${cmp}_${i}_${c}_1" value="${m[cmp][1]}" oninput="actualizarCampoMedicion(${i},${c},'${cmp}',1,this.value)" ${readonlyAttr}>
                <input type="number" step="0.001" id="input_${cmp}_${i}_${c}_2" value="${m[cmp][2]}" oninput="actualizarCampoMedicion(${i},${c},'${cmp}',2,this.value)" ${readonlyAttr}>
            </div>
        </div>`;
    };

    const single = (lbl, cmp) => `
        <div class="w-full">
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1 truncate">${lbl}</label>
            <input type="number" step="0.001" value="${m[cmp]}" oninput="actualizarCampoMedicion(${i},${c},'${cmp}',null,this.value)" class="w-full border p-1 rounded text-xs text-center bg-blue-50 font-bold h-[26px] focus:ring-1 focus:ring-blue-400 outline-none">
        </div>`;

    return `
    <div class="border border-slate-200 rounded-lg p-3 sm:p-4 relative bg-white hover:border-blue-300 transition mt-3 shadow-sm">
        <div class="absolute top-2 right-2">
            <button onclick="eliminarCabezal(${i},${c})" class="text-red-400 hover:text-red-600 text-xs font-bold"><i class="fa-solid fa-xmark fa-lg"></i></button>
        </div>
        <span class="absolute -left-3 -top-3 bg-slate-800 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow-md">${m.num_cabezal}</span>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-2">
            ${triple('Profundidad', 'prof')} 
            ${triple('Espesor', 'esp')} 
            ${triple('Ancho', 'ancho')}
            ${triple('G. Cuerpo', 'gc')}
        </div>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-4 border-t border-dashed border-slate-200">
            ${triple('G. Tapa', 'gt')} 
            ${triple('Traslape', 'tras')}
            ${single('% Planchado', 'porc_plan')}
        </div>
    </div>`;
}

// ==========================================
// FIRMA Y API FETCH
// ==========================================
let canvas, ctx;
function initFirma() {
    canvas = document.getElementById('signature-pad'); ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    let dibujando = false;

    const start = (e) => { e.preventDefault(); dibujando = true; draw(e); };
    const end = () => { dibujando = false; ctx.beginPath(); estado.firmaBase64 = canvas.toDataURL(); guardarEstado(); };
    const draw = (e) => {
        if(!dibujando) return;
        let cX = e.clientX || e.touches[0].clientX; let cY = e.clientY || e.touches[0].clientY;
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(cX - rect.left, cY - rect.top); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cX - rect.left, cY - rect.top);
    };

    canvas.addEventListener('mousedown', start); canvas.addEventListener('mouseup', end); canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', start); canvas.addEventListener('touchend', end); canvas.addEventListener('touchmove', draw);
    
    if(estado.firmaBase64){ let img = new Image(); img.onload = ()=>ctx.drawImage(img,0,0); img.src = estado.firmaBase64; }
}
function limpiarFirma() { ctx.clearRect(0,0,canvas.width,canvas.height); estado.firmaBase64 = ''; guardarEstado(); }

async function enviarAlServidor() {
    const btn = document.getElementById('sync-status');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(estado) });
        btn.innerHTML = '<i class="fa-solid fa-check"></i> OK';
        btn.className = "text-xs font-bold bg-green-600 px-3 py-1 rounded-full shadow-inner text-white";
        alert("Datos enviados a Google Sheets correctamente.");
        
        // Generar nuevo ID de visita para el siguiente registro
        estado.visita.id_visita = generarID();
        estado.informes = [];
        estado.firmaBase64 = '';
        
        // Limpiar campos de la UI
        document.getElementById('v-fecha').value = '';
        document.getElementById('v-cliente').value = '';
        document.getElementById('v-codigo').value = '';
        document.getElementById('v-tecnico').value = '';
        limpiarFirma();
        agregarInforme();
        renderizarInformes();
        guardarEstado();
    } catch(e) { alert("Error de red. Datos guardados localmente."); }
}

// ==========================================
// GENERACIÓN DE PDF 100% VECTORIAL (jsPDF + AutoTable)
// Ya NO se usa html2canvas/html2pdf: se dibuja el PDF directamente,
// por lo que es inmune al scroll, al z-index, al viewport y al
// tamaño de la tabla. Esto elimina de raíz el problema de PDFs en
// blanco o recortados.
//
// Requiere en el <head> del HTML (reemplazando el script de html2pdf):
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
// ==========================================
async function generarPDF() {
    const pdfButton = document.querySelector('button[onclick*="generarPDF"]');

    if (!Array.isArray(estado.informes) || estado.informes.length === 0) {
        alert('Debes agregar al menos un informe para generar el PDF.');
        return;
    }

    // jsPDF UMD expone la clase en window.jspdf.jsPDF
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        alert('La librería jsPDF no está disponible. Revisa que el script esté incluido en el HTML y tu conexión a internet.');
        return;
    }

    const { jsPDF } = window.jspdf;

    if (pdfButton) {
        pdfButton.disabled = true;
        pdfButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Generando PDF...';
    }

    try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = 8;

        estado.informes.forEach((informe, idx) => {
            if (idx > 0) doc.addPage();

            // --- Título ---
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Reporte Final de Evaluación de Doble Cierre', pageWidth / 2, 12, { align: 'center' });

            // --- Datos base (3 columnas x 2 filas) ---
            const col1X = marginX, col2X = pageWidth / 3 + 5, col3X = (pageWidth / 3) * 2 + 5;
            let y = 20;
            doc.setFontSize(9);

            const campo = (label, valor, x, yPos, labelWidth) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label, x, yPos);
                doc.setFont('helvetica', 'normal');
                doc.text(String(valor ?? ''), x + labelWidth + 3, yPos);
            };

            campo('FECHA:', estado.visita?.fecha, col1X, y, 14);
            campo('LÍNEA:', informe.linea, col2X, y, 12);
            campo('CERRADORA:', informe.maquina, col3X, y, 20);

            y += 8;
            campo('CLIENTE:', estado.visita?.cliente, col1X, y, 14);
            campo('PRODUCTO:', informe.producto, col2X, y, 17);
            campo('FORMATO:', informe.formato, col3X, y, 16);

            // --- Tabla de mediciones (dibujada con vectores, no capturada) ---
            const mediciones = Array.isArray(informe.mediciones) ? informe.mediciones : [];

            const head = [
                [
                    { content: 'Cabezal', rowSpan: 2, styles: { valign: 'middle' } },
                    { content: 'Profundidad', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'Espesor', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'Ancho', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'G. Cuerpo', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'G. Tapa', colSpan: 3, styles: { halign: 'center' } },
                    { content: 'Traslape', colSpan: 3, styles: { halign: 'center' } },
                    { content: '% Plan.', rowSpan: 2, styles: { valign: 'middle' } },
                ],
                ['1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3'],
            ];

            const body = mediciones.length === 0
                ? [[{ content: 'Sin mediciones registradas', colSpan: 20, styles: { halign: 'center' } }]]
                : mediciones.map(m => ([
                    String(m.num_cabezal ?? ''),
                    String(m.prof?.[0] ?? ''), String(m.prof?.[1] ?? ''), String(m.prof?.[2] ?? ''),
                    String(m.esp?.[0] ?? ''), String(m.esp?.[1] ?? ''), String(m.esp?.[2] ?? ''),
                    String(m.ancho?.[0] ?? ''), String(m.ancho?.[1] ?? ''), String(m.ancho?.[2] ?? ''),
                    String(m.gc?.[0] ?? ''), String(m.gc?.[1] ?? ''), String(m.gc?.[2] ?? ''),
                    String(m.gt?.[0] ?? ''), String(m.gt?.[1] ?? ''), String(m.gt?.[2] ?? ''),
                    String(m.tras?.[0] ?? ''), String(m.tras?.[1] ?? ''), String(m.tras?.[2] ?? ''),
                    String(m.porc_plan ?? ''),
                ]));

            doc.autoTable({
                head,
                body,
                startY: y + 6,
                margin: { left: marginX, right: marginX },
                theme: 'grid',
                styles: {
                    fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle',
                    lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0]
                },
                headStyles: { fillColor: [232, 232, 232], textColor: [0, 0, 0], fontStyle: 'bold' },
                columnStyles: { 0: { fontStyle: 'bold', fillColor: [241, 241, 241] } },
            });

            // --- Firma (imagen base64 insertada directamente como imagen del PDF) ---
            const finalY = doc.lastAutoTable.finalY + 15;
            const firmaSrc = typeof estado.firmaBase64 === 'string' && estado.firmaBase64.startsWith('data:image')
                ? estado.firmaBase64 : '';

            if (firmaSrc) {
                const imgW = 55, imgH = 22;
                const imgX = pageWidth / 2 - imgW / 2;
                try {
                    // canvas.toDataURL() por defecto genera PNG; si cambias el formato del canvas, ajusta este string.
                    doc.addImage(firmaSrc, 'PNG', imgX, finalY, imgW, imgH);
                    doc.line(imgX, finalY + imgH + 1, imgX + imgW, finalY + imgH + 1);
                } catch (imgErr) {
                    console.warn('No se pudo insertar la firma en el PDF:', imgErr);
                    doc.text('(No se pudo cargar la firma)', pageWidth / 2, finalY + imgH / 2, { align: 'center' });
                }
            } else {
                doc.line(pageWidth / 2 - 30, finalY + 15, pageWidth / 2 + 30, finalY + 15);
            }

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Firma del Cliente', pageWidth / 2, finalY + 27, { align: 'center' });
        });

        const cliente = String(estado.visita?.cliente || 'General').replace(/[\\/:*?"<>|]/g, '_').trim();
        doc.save(`Reporte_DobleCierre_${cliente}.pdf`);

        alert('PDF generado correctamente.');

    } catch (error) {
        console.error("Error al generar PDF:", error);
        alert('No se pudo generar el PDF.\n\nDetalle: ' + (error?.message || error));
    } finally {
        if (pdfButton) {
            pdfButton.disabled = false;
            pdfButton.innerHTML = '<i class="fa-solid fa-file-pdf mr-2"></i> Generar PDF(s)';
        }
    }
}