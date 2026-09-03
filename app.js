const API_URL = "https://script.google.com/macros/s/AKfycbzO4O_WJA8N_-_X0kzU2c7IEB-8yEJvOgybyqpaad0tUGeZHf_F0aUEf4fUdmeu1lPA/exec";

// === VARIABLES GLOBALES Y ESTADO ===
function generarID() {
    return Math.random().toString(36).substr(2, 9);
}

let estado = {
    visita: { id_visita: generarID(), fecha: '', cliente: '', codigo: '', tecnico: '', bitrix: '', unidad: 'milimetros', producto: '', sustrato_tapa: '', proveedor_tapa: '' },
    informes: [],
    firmaBase64: '',
    firmaClienteBase64: '',
    firmaTecnicoBase64: ''
};

let baseClientes = [];
let baseTecnicos = [];
let baseFormatosCuerpo = [];
let baseFormatosTapa = [];

// === INICIALIZACIÓN ===
document.addEventListener("DOMContentLoaded", () => {
    cargarEstado();
    initFirma();
    if (estado.informes.length === 0) agregarInforme(); 
    else renderizarInformes();
    cargarListasDesdeServidor();
});

// === MANEJO DE ESTADO LOCAL ===
function guardarEstado() {
    estado.visita.fecha = document.getElementById('v-fecha').value;
    estado.visita.cliente = document.getElementById('v-cliente').value;
    estado.visita.codigo = document.getElementById('v-codigo').value;
    estado.visita.tecnico = document.getElementById('v-tecnico').value;
    estado.visita.bitrix = document.getElementById('v-bitrix').value;
    estado.visita.unidad = document.getElementById('v-unidad').value;
    estado.visita.sustrato_tapa = document.getElementById('v-sustrato-tapa').value;
    estado.visita.proveedor_tapa = document.getElementById('v-proveedor-tapa').value;

    if (estado.informes.length > 0) {
        estado.visita.producto = estado.informes[0].producto || '';
    }
    localStorage.setItem('dobleCierreApp2', JSON.stringify(estado));
}

function cargarEstado() {
    const dataGuardada = localStorage.getItem('dobleCierreApp2');
    if (!dataGuardada) return;

    try {
        const idActual = estado.visita.id_visita;
        estado = JSON.parse(dataGuardada);
        estado.visita.id_visita = idActual;

        estado.visita.unidad = estado.visita.unidad || 'milimetros';
        estado.visita.producto = estado.visita.producto || '';
        estado.visita.sustrato_tapa = estado.visita.sustrato_tapa || '';
        estado.visita.proveedor_tapa = estado.visita.proveedor_tapa || '';
        estado.informes = Array.isArray(estado.informes) ? estado.informes : [];

        estado.informes.forEach(informe => {
            informe.espesor_cuerpo = informe.espesor_cuerpo || '';
            informe.formato_cuerpo = informe.formato_cuerpo || '';
            informe.formato_tapa = informe.formato_tapa || '';
            informe.producto = informe.producto || '';
        });

        document.getElementById('v-fecha').value = estado.visita.fecha || '';
        document.getElementById('v-cliente').value = estado.visita.cliente || '';
        document.getElementById('v-codigo').value = estado.visita.codigo || '';
        document.getElementById('v-tecnico').value = estado.visita.tecnico || '';
        document.getElementById('v-bitrix').value = estado.visita.bitrix || '';
        document.getElementById('v-unidad').value = estado.visita.unidad || 'milimetros';
        document.getElementById('v-sustrato-tapa').value = estado.visita.sustrato_tapa || '';
        document.getElementById('v-proveedor-tapa').value = estado.visita.proveedor_tapa || '';
    } catch (error) {
        console.error("Error cargando estado local:", error);
    }
}

// === CONEXIÓN CON GOOGLE SHEETS ===
async function cargarListasDesdeServidor() {
    const statusDiv = document.getElementById('sync-status');
    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando listas...';

    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data.status === 'success') {
            baseClientes = data.clientes || [];
            baseTecnicos = data.tecnicos || [];
            baseFormatosCuerpo = data.formatosCuerpo || [];
            baseFormatosTapa = data.formatosTapa || [];

            inicializarListas();
            renderizarInformes(); // Refresca UI para llenar selectores

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
    if (listClientes) {
        listClientes.innerHTML = '';
        baseClientes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.nombre;
            listClientes.appendChild(option);
        });
    }

    const listTecnicos = document.getElementById('lista-tecnicos');
    if (listTecnicos) {
        listTecnicos.innerHTML = '';
        baseTecnicos.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            listTecnicos.appendChild(option);
        });
    }
}

function autoCompletarCodigoCliente() {
    const nombreCliente = document.getElementById('v-cliente').value.toLowerCase();
    const clienteEncontrado = baseClientes.find(c => c.nombre.toLowerCase() === nombreCliente);
    
    if (clienteEncontrado) document.getElementById('v-codigo').value = clienteEncontrado.codigo;
    guardarEstado();
}

// === CÁLCULOS Y ACTUALIZACIÓN DE DATOS ===
function calcularTraslapesDeCabezal(infoIdx, cabIdx) {
    const informe = estado.informes[infoIdx];
    const med = informe.mediciones[cabIdx];
    const espesorTapaIngresado = parseFloat(String(informe.espesor_tapa).replace(',', '.')) || 0;
    const espesorTapa = estado.visita.unidad === 'pulgadas' ? espesorTapaIngresado / 25.4 : espesorTapaIngresado;

    for (let x = 0; x < 3; x++) {
        const gc = parseFloat(String(med.gc[x]).replace(',', '.')) || 0;
        const gt = parseFloat(String(med.gt[x]).replace(',', '.')) || 0;
        const ancho = parseFloat(String(med.ancho[x]).replace(',', '.')) || 0;

        if (gc > 0 && gt > 0 && ancho > 0 && espesorTapa > 0) {
            med.tras[x] = (gc + gt + (1.1 * espesorTapa) - ancho).toFixed(3);
            const inputTraslape = document.getElementById(`input_tras_${infoIdx}_${cabIdx}_${x}`);
            if (inputTraslape) inputTraslape.value = med.tras[x];
        }
    }
}

function actualizarCampoMedicion(infoIdx, cabIdx, campo, subIdx, valor) {
    if (subIdx !== null) estado.informes[infoIdx].mediciones[cabIdx][campo][subIdx] = valor;
    else estado.informes[infoIdx].mediciones[cabIdx][campo] = valor;

    if (['gc', 'gt', 'ancho'].includes(campo)) calcularTraslapesDeCabezal(infoIdx, cabIdx);
    guardarEstado();
}

function actualizarCampoInfo(infoIdx, campo, valor) {
    estado.informes[infoIdx][campo] = valor;
    
    if (campo === 'espesor_tapa') {
        estado.informes[infoIdx].mediciones.forEach((_, cIdx) => calcularTraslapesDeCabezal(infoIdx, cIdx));
    }
    if (campo === 'producto' && infoIdx === 0) estado.visita.producto = valor;
    
    guardarEstado();
}

function actualizarUnidadMedida(valor) {
    estado.visita.unidad = valor;
    estado.informes.forEach((informe, infoIdx) => {
        informe.mediciones.forEach((_, cabIdx) => calcularTraslapesDeCabezal(infoIdx, cabIdx));
    });
    guardarEstado();
}

// === GESTIÓN DE INFORMES Y CABEZALES ===
function agregarInforme() {
    estado.informes.push({
        id_informe: generarID(), linea: '', maquina: '', espesor_tapa: '', espesor_cuerpo: '',
        producto: '', formato_cuerpo: '', formato_tapa: '', mediciones: []
    });
    guardarEstado();
    renderizarInformes();
}

function eliminarInforme(idx) {
    if (confirm("¿Borrar este informe completo?")) {
        estado.informes.splice(idx, 1);
        guardarEstado();
        renderizarInformes();
    }
}

function agregarCabezal(infoIdx) {
    estado.informes[infoIdx].mediciones.push({
        id_medicion: generarID(), num_cabezal: estado.informes[infoIdx].mediciones.length + 1,
        prof: ["", "", ""], esp: ["", "", ""], ancho: ["", "", ""], 
        gc: ["", "", ""], gt: ["", "", ""], tras: ["", "", ""], porc_plan: ""
    });
    guardarEstado();
    renderizarInformes();
}

function eliminarCabezal(infoIdx, cabIdx) {
    estado.informes[infoIdx].mediciones.splice(cabIdx, 1);
    estado.informes[infoIdx].mediciones.forEach((m, i) => m.num_cabezal = i + 1);
    guardarEstado();
    renderizarInformes();
}

// === RENDERIZADO HTML DINÁMICO ===
function escaparHTML(valor) {
    return String(valor ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function crearOpcionesFormato(lista, valorActual) {
    let html = `<option value="">Seleccionar...</option>`;
    lista.forEach(formato => {
        const valor = escaparHTML(formato);
        const selected = String(valorActual) === String(formato) ? 'selected' : '';
        html += `<option value="${valor}" ${selected}>${valor}</option>`;
    });
    return html;
}

function renderizarInformes() {
    const container = document.getElementById('informes-container');
    let html = '';

    estado.informes.forEach((informe, i) => {
        html += `
        <div class="bg-white p-6 rounded-xl shadow-sm border-t-4 border-t-blue-600 border-x border-b border-slate-200">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-bold text-blue-800"><i class="fa-solid fa-gears mr-2"></i> Informe ${i + 1}</h2>
                <button onclick="eliminarInforme(${i})" class="text-red-500 font-bold text-sm"><i class="fa-solid fa-trash"></i> Eliminar Informe</button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6 bg-slate-50 p-4 rounded-lg border">
                <div><label class="text-xs font-bold text-slate-500 uppercase">Línea</label><input type="text" value="${escaparHTML(informe.linea)}" oninput="actualizarCampoInfo(${i}, 'linea', this.value)" class="w-full border p-2 rounded"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Cerradora</label><input type="text" value="${escaparHTML(informe.maquina)}" oninput="actualizarCampoInfo(${i}, 'maquina', this.value)" class="w-full border p-2 rounded"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Espesor Tapa</label><input type="number" step="0.001" value="${escaparHTML(informe.espesor_tapa)}" oninput="actualizarCampoInfo(${i}, 'espesor_tapa', this.value)" class="w-full border p-2 rounded focus:ring-1 focus:ring-blue-400"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Espesor Cuerpo</label><input type="number" step="0.001" value="${escaparHTML(informe.espesor_cuerpo)}" oninput="actualizarCampoInfo(${i}, 'espesor_cuerpo', this.value)" class="w-full border p-2 rounded focus:ring-1 focus:ring-blue-400"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Producto</label><input type="text" value="${escaparHTML(informe.producto)}" oninput="actualizarCampoInfo(${i}, 'producto', this.value)" class="w-full border p-2 rounded"></div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Formato Cuerpo</label>
                    <select onchange="actualizarCampoInfo(${i}, 'formato_cuerpo', this.value)" class="w-full border p-3 rounded bg-white focus:ring-1 focus:ring-blue-400">
                        ${crearOpcionesFormato(baseFormatosCuerpo, informe.formato_cuerpo)}
                    </select>
                </div>
                <div><label class="text-xs font-bold text-slate-500 uppercase">Formato Tapa</label>
                    <select onchange="actualizarCampoInfo(${i}, 'formato_tapa', this.value)" class="w-full border p-3 rounded bg-white focus:ring-1 focus:ring-blue-400">
                        ${crearOpcionesFormato(baseFormatosTapa, informe.formato_tapa)}
                    </select>
                </div>
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
        const readonlyAttr = cmp === 'tras' ? `readonly class="w-full border p-1 rounded text-xs text-center bg-slate-200 text-slate-500 cursor-not-allowed"` : `class="w-full border p-1 rounded text-xs text-center focus:ring-1 focus:ring-blue-400 outline-none"`;
        return `
        <div class="w-full">
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1 truncate">${lbl}</label>
            <div class="grid grid-cols-3 gap-1">
                <input type="number" step="0.001" id="input_${cmp}_${i}_${c}_0" value="${escaparHTML(m[cmp][0])}" oninput="actualizarCampoMedicion(${i},${c},'${cmp}',0,this.value)" ${readonlyAttr}>
                <input type="number" step="0.001" id="input_${cmp}_${i}_${c}_1" value="${escaparHTML(m[cmp][1])}" oninput="actualizarCampoMedicion(${i},${c},'${cmp}',1,this.value)" ${readonlyAttr}>
                <input type="number" step="0.001" id="input_${cmp}_${i}_${c}_2" value="${escaparHTML(m[cmp][2])}" oninput="actualizarCampoMedicion(${i},${c},'${cmp}',2,this.value)" ${readonlyAttr}>
            </div>
        </div>`;
    };

    const single = (lbl, cmp) => `
        <div class="w-full">
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1 truncate">${lbl}</label>
            <input type="number" step="0.001" value="${escaparHTML(m[cmp])}" oninput="actualizarCampoMedicion(${i},${c},'${cmp}',null,this.value)" class="w-full border p-1 rounded text-xs text-center bg-blue-50 font-bold h-[26px] focus:ring-1 focus:ring-blue-400 outline-none">
        </div>`;

    return `
    <div class="border border-slate-200 rounded-lg p-3 sm:p-4 relative bg-white hover:border-blue-300 transition mt-3 shadow-sm">
        <div class="absolute top-2 right-2">
            <button onclick="eliminarCabezal(${i},${c})" class="text-red-400 hover:text-red-600 text-xs font-bold"><i class="fa-solid fa-xmark fa-lg"></i></button>
        </div>
        <span class="absolute -left-3 -top-3 bg-slate-800 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow-md">${m.num_cabezal}</span>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-2">
            ${triple('Profundidad', 'prof')} ${triple('Espesor', 'esp')} ${triple('Ancho', 'ancho')} ${triple('G. Cuerpo', 'gc')}
        </div>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-4 border-t border-dashed border-slate-200">
            ${triple('G. Tapa', 'gt')} ${triple('Traslape', 'tras')} ${single('% Planchado', 'porc_plan')}
        </div>
    </div>`;
}

// === GESTIÓN DE FIRMA (CANVAS) ===
let canvas, ctx;

function initFirma() {
    const firmas = [
        document.getElementById('signature-pad'),
        document.getElementById('signature-pad-cliente'),
        document.getElementById('signature-pad-tecnico')
    ].filter(Boolean);

    firmas.forEach((canvasActual) => {
        const ctxActual = canvasActual.getContext('2d');
        canvasActual.width = canvasActual.offsetWidth || 300;
        canvasActual.height = canvasActual.offsetHeight || 160;
        ctxActual.lineWidth = 2;
        ctxActual.lineCap = 'round';
        ctxActual.strokeStyle = '#000';

        let dibujando = false;
        const start = (e) => { e.preventDefault(); dibujando = true; draw(e); };
        const end = () => {
            dibujando = false;
            ctxActual.beginPath();
            if (canvasActual.id === 'signature-pad-cliente') {
                estado.firmaClienteBase64 = canvasActual.toDataURL();
            } else if (canvasActual.id === 'signature-pad-tecnico') {
                estado.firmaTecnicoBase64 = canvasActual.toDataURL();
            } else {
                estado.firmaBase64 = canvasActual.toDataURL();
            }
            guardarEstado();
        };
        const draw = (e) => {
            if (!dibujando) return;
            const rect = canvasActual.getBoundingClientRect();
            const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
            const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
            ctxActual.lineTo(clientX - rect.left, clientY - rect.top);
            ctxActual.stroke();
            ctxActual.beginPath();
            ctxActual.moveTo(clientX - rect.left, clientY - rect.top);
        };

        canvasActual.addEventListener('mousedown', start);
        canvasActual.addEventListener('mouseup', end);
        canvasActual.addEventListener('mousemove', draw);
        canvasActual.addEventListener('touchstart', start);
        canvasActual.addEventListener('touchend', end);
        canvasActual.addEventListener('touchmove', draw);

        const firmaGuardada = canvasActual.id === 'signature-pad-cliente'
            ? estado.firmaClienteBase64
            : canvasActual.id === 'signature-pad-tecnico'
                ? estado.firmaTecnicoBase64
                : estado.firmaBase64;

        if (firmaGuardada) {
            const img = new Image();
            img.onload = () => ctxActual.drawImage(img, 0, 0);
            img.src = firmaGuardada;
        }
    });
}

function limpiarFirma(tipo = 'cliente') {
    const canvasAntiguo = document.getElementById('signature-pad');
    const canvasCliente = document.getElementById('signature-pad-cliente');
    const canvasTecnico = document.getElementById('signature-pad-tecnico');

    const canvasObjetivo = tipo === 'tecnico' ? canvasTecnico : (canvasCliente || canvasAntiguo);
    const ctxObjetivo = canvasObjetivo?.getContext('2d');

    if (!canvasObjetivo || !ctxObjetivo) return;

    ctxObjetivo.clearRect(0, 0, canvasObjetivo.width, canvasObjetivo.height);

    if (canvasObjetivo.id === 'signature-pad-cliente') {
        estado.firmaClienteBase64 = '';
    } else if (canvasObjetivo.id === 'signature-pad-tecnico') {
        estado.firmaTecnicoBase64 = '';
    } else {
        estado.firmaBase64 = '';
    }

    guardarEstado();
}

// === ENVÍO DE DATOS AL BACKEND ===
async function enviarAlServidor() {
    const btn = document.getElementById('sync-status');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        if (estado.informes.length > 0) estado.visita.producto = estado.informes[0].producto || '';
        guardarEstado();

        const datosParaEnviar = {
            ...estado,
            firmaBase64: estado.firmaClienteBase64 || estado.firmaBase64
        };

        await fetch(API_URL, {
            method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosParaEnviar)
        });

        btn.innerHTML = '<i class="fa-solid fa-check"></i> OK';
        btn.className = "text-xs font-bold bg-green-600 px-3 py-1 rounded-full shadow-inner text-white";
        alert("Datos enviados a Google Sheets correctamente.");

        // Limpiar para un nuevo registro
        estado.visita.id_visita = generarID();
        estado.visita.producto = '';
        estado.informes = [];
        estado.firmaBase64 = '';
        estado.firmaClienteBase64 = '';
        estado.firmaTecnicoBase64 = '';

        document.getElementById('v-fecha').value = '';
        document.getElementById('v-cliente').value = '';
        document.getElementById('v-codigo').value = '';
        document.getElementById('v-tecnico').value = '';
        document.getElementById('v-bitrix').value = '';
        document.getElementById('v-sustrato-tapa').value = '';
        document.getElementById('v-proveedor-tapa').value = '';

        limpiarFirma();
        agregarInforme();
        renderizarInformes();
        guardarEstado();
    } catch (e) {
        alert("Error de red. Datos guardados localmente.");
    }
}

async function cargarImagenComoDataURL(ruta) {
    try {
        const respuesta = await fetch(ruta);
        if (!respuesta.ok) throw new Error(`No se pudo cargar la imagen: ${ruta}`);

        const blob = await respuesta.blob();
        return await new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onloadend = () => resolve(lector.result);
            lector.onerror = reject;
            lector.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn('No se pudo cargar la imagen del PDF:', ruta, error);
        return '';
    }
}

function normalizarNombreTecnico(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

async function obtenerLogoTecnicoPorNombre(tecnico) {
    const nombre = normalizarNombreTecnico(tecnico);

    const mapa = {
        'alvaro gamboa': 'Imagenes/Logo-Firma-Alvaro.png',
        'alvara gambo': 'Imagenes/Logo-Firma-Alvaro.png',
        'alvaro gambo': 'Imagenes/Logo-Firma-Alvaro.png',
        'danilo bermeo': 'Imagenes/Logo-Firma-Danilo.png',
        'robinson villao': 'Imagenes/Logo-Firma-Robinson.png',
        'robinzon villao': 'Imagenes/Logo-Firma-Robinson.png',
        'pomerio gilces': 'Imagenes/Logo-Firma-Pomerio.png',
        'pablo ruesta': 'Imagenes/Logo-Firma-Pablo.png',
        'erick mundaca': 'Imagenes/Logo-Firma-Erick.png',
        'jesus barreto': 'Imagenes/Logo-Firma-Jesus.png',
        'roger diaz': 'Imagenes/Logo-Firma-Roger.png'
    };

    const ruta = mapa[nombre];
    if (!ruta) {
        console.warn('No existe una firma asociada para el técnico:', tecnico);
        return '';
    }

    return cargarImagenComoDataURL(ruta);
}

// === GENERACIÓN DE PDF CON jsPDF + AUTOTABLE ===
async function generarPDF() {
    const pdfButton = document.querySelector('button[onclick*="generarPDF"]');
    
    if (!Array.isArray(estado.informes) || estado.informes.length === 0) {
        alert('Debes agregar al menos un informe para generar el PDF.');
        return;
    }

    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        alert('La librería jsPDF no está disponible.');
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
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 8;
        const logoFadesaSrc = await cargarImagenComoDataURL('Imagenes/LOGO2-02.png');
        const logoTecnicoSrc = await obtenerLogoTecnicoPorNombre(estado.visita?.tecnico);

        estado.informes.forEach((informe, idx) => {
            if (idx > 0) doc.addPage();

            if (logoFadesaSrc) {
                try {
                    doc.addImage(logoFadesaSrc, 'PNG', marginX + 2, 5, 34, 14);
                } catch (imgErr) {
                    console.warn('No se pudo insertar el logo del PDF:', imgErr);
                }
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setDrawColor(180, 190, 205);
            doc.setFillColor(245, 248, 252);
            doc.roundedRect(pageWidth - 38, 8, 30, 7, 1.5, 1.5, 'F');
            doc.text('FVE-002', pageWidth - 22, 13, { align: 'right' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Reporte Final de Evaluación de Doble Cierre', pageWidth / 2, 20, { align: 'center' });

            const col1X = marginX;
            const col2X = pageWidth / 3 + 5;
            const col3X = (pageWidth / 3) * 2 + 5;
            let y = 30;

            doc.setFontSize(9);

            const campo = (label, valor, x, yPos, labelWidth, valueWidth) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label, x, yPos);
                doc.setFont('helvetica', 'normal');
                const texto = String(valor ?? '');
                const lineas = valueWidth
                    ? doc.splitTextToSize(texto, valueWidth)
                    : texto;
                doc.text(lineas, x + labelWidth + 3, yPos, {
                    lineHeightFactor: 1.2
                });
            };

            campo('FECHA:', estado.visita?.fecha, col1X, y, 14);
            campo('LÍNEA:', informe.linea, col2X, y, 12);
            campo('CERRADORA:', informe.maquina, col3X, y, 20);
            y += 8;

            campo('CLIENTE:', estado.visita?.cliente, col1X, y, 14);
            campo('PRODUCTO:', informe.producto, col2X, y, 17);
            campo('FORMATO CUERPO:', informe.formato_cuerpo, col3X, y, 28, 56);
            y += 8;

            campo('ESP. CUERPO:', informe.espesor_cuerpo, col1X, y, 23);
            campo('ESP. TAPA:', informe.espesor_tapa, col2X, y, 18);
            campo('FORMATO TAPA:', informe.formato_tapa, col3X, y, 24, 56);

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
                    { content: '% Plan.', rowSpan: 2, styles: { valign: 'middle' } }
                ],
                ['1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3']
            ];

            const body = mediciones.length === 0
                ? [[{ content: 'Sin mediciones registradas', colSpan: 20, styles: { halign: 'center' } }]]
                : mediciones.map(m => [
                    String(m.num_cabezal ?? ''), String(m.prof?.[0] ?? ''), String(m.prof?.[1] ?? ''), String(m.prof?.[2] ?? ''),
                    String(m.esp?.[0] ?? ''), String(m.esp?.[1] ?? ''), String(m.esp?.[2] ?? ''), String(m.ancho?.[0] ?? ''),
                    String(m.ancho?.[1] ?? ''), String(m.ancho?.[2] ?? ''), String(m.gc?.[0] ?? ''), String(m.gc?.[1] ?? ''),
                    String(m.gc?.[2] ?? ''), String(m.gt?.[0] ?? ''), String(m.gt?.[1] ?? ''), String(m.gt?.[2] ?? ''),
                    String(m.tras?.[0] ?? ''), String(m.tras?.[1] ?? ''), String(m.tras?.[2] ?? ''), String(m.porc_plan ?? '')
                ]);

            doc.autoTable({
                head, body, startY: y + 6,
                margin: { left: marginX, right: marginX },
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1.5, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
                headStyles: { fillColor: [232, 232, 232], textColor: [0, 0, 0], fontStyle: 'bold' },
                columnStyles: { 0: { fontStyle: 'bold', fillColor: [241, 241, 241] } }
            });

            const finalY = doc.lastAutoTable.finalY + 18;
            const firmaClienteSrc = typeof estado.firmaClienteBase64 === 'string' && estado.firmaClienteBase64.startsWith('data:image')
                ? estado.firmaClienteBase64
                : (typeof estado.firmaBase64 === 'string' && estado.firmaBase64.startsWith('data:image') ? estado.firmaBase64 : '');
            const firmaTecnicoSrc = typeof estado.firmaTecnicoBase64 === 'string' && estado.firmaTecnicoBase64.startsWith('data:image') ? estado.firmaTecnicoBase64 : '';

            const firmaW = 52;
            const firmaH = 20;
            const firmaClienteX = pageWidth / 4 - firmaW / 2;
            const firmaTecnicoX = (pageWidth * 3) / 4 - firmaW / 2;

            if (firmaClienteSrc) {
                try {
                    doc.addImage(firmaClienteSrc, 'PNG', firmaClienteX, finalY, firmaW, firmaH);
                    doc.line(firmaClienteX, finalY + firmaH + 1, firmaClienteX + firmaW, finalY + firmaH + 1);
                } catch (imgErr) {
                    console.warn('No se pudo insertar la firma del cliente:', imgErr);
                }
            } else {
                doc.line(pageWidth / 4 - 24, finalY + 15, pageWidth / 4 + 24, finalY + 15);
            }

            if (firmaTecnicoSrc) {
                try {
                    doc.addImage(firmaTecnicoSrc, 'PNG', firmaTecnicoX, finalY, firmaW, firmaH);
                    doc.line(firmaTecnicoX, finalY + firmaH + 1, firmaTecnicoX + firmaW, finalY + firmaH + 1);
                } catch (imgErr) {
                    console.warn('No se pudo insertar la firma del técnico:', imgErr);
                }
            } else {
                doc.line((pageWidth * 3) / 4 - 24, finalY + 15, (pageWidth * 3) / 4 + 24, finalY + 15);
            }

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Firma del Cliente', pageWidth / 4, finalY + 27, { align: 'center' });
            doc.text('Firma del Técnico', (pageWidth * 3) / 4, finalY + 27, { align: 'center' });
            doc.setDrawColor(210, 217, 228);
            doc.line(pageWidth / 4 - 20, finalY + 30, pageWidth / 4 + 20, finalY + 30);
            doc.line((pageWidth * 3) / 4 - 20, finalY + 30, (pageWidth * 3) / 4 + 20, finalY + 30);

            if (logoTecnicoSrc) {
                const logoTecnicoW = 50;
                const logoTecnicoH = 28;
                const logoTecnicoX = pageWidth - marginX - logoTecnicoW;
                const logoTecnicoY = pageHeight - 18 - logoTecnicoH;

                try {
                    doc.addImage(logoTecnicoSrc, 'PNG', logoTecnicoX, logoTecnicoY, logoTecnicoW, logoTecnicoH);
                } catch (imgErr) {
                    console.warn('No se pudo insertar la firma del técnico en la esquina inferior derecha:', imgErr);
                }
            }
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
