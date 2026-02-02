document.addEventListener('DOMContentLoaded', async () => {

    // ----------------------------------------------------------------
    // PARTE 1: Configuración Maestra
    // ----------------------------------------------------------------
    let resultadosAdmin = ""; 
    let participantesData = [];
    let finanzasData = { ventas: 0, recaudado: 0.00, acumulado1: 0.00, acumulado2: 0.00 }; 
    let resultadosDelDiaSet = []; 
    
    let juegoActual = 'dia'; 
    let aciertosObjetivo = 5;
    let jugadaSize = 5; 

    const selectorJuego = document.getElementById('select-juego-publico');

    window.seleccionarJuegoPill = function(elemento, juego) {
        // 1. Quitar clase activa de todos los botones
        document.querySelectorAll('.tab-pill').forEach(pill => pill.classList.remove('active'));
        // 2. Agregar clase activa al seleccionado
        elemento.classList.add('active');

        if (selectorJuego) {
            // 3. Cambiar el valor del select oculto
            selectorJuego.value = juego;
            // 4. Disparar evento de cambio para que cargarDatosDesdeNube se ejecute
            selectorJuego.dispatchEvent(new Event('change'));
        }
    };

    const CONFIG_JUEGOS = {
        dia: {
            titulo: "SUPER POLLA FENIX (DIA)",
            ruletas: ["LOTTO ACTIVO", "GRANJITA", "SELVA PLUS", "GUACHARO"],
            horas: ["8AM", "9AM", "10AM", "11AM", "12PM"],
            aciertos: 5,
            size: 5
        },
        tarde: {
            titulo: "SUPER POLLA FENIX (TARDE)",
            ruletas: ["LOTTO ACTIVO", "GRANJITA", "SELVA PLUS", "GUACHARO"],
            horas: ["3PM", "4PM", "5PM", "6PM", "7PM"],
            aciertos: 5,
            size: 5
        },
        mini: {
            titulo: "MINI EXPRES FENIX",
            ruletas: ["LOTTO ACTIVO", "GRANJITA", "SELVA PLUS"],
            horas: ["5PM", "6PM", "7PM"],
            aciertos: 3,
            size: 3
        }
    };

    function establecerFechaReal() {
        const headerP = document.getElementById('fecha-actual');
        if (headerP) {
            const ahora = new Date();
            const opciones = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
            headerP.innerHTML = `<i class="fas fa-calendar-alt"></i> ${ahora.toLocaleDateString('es-ES', opciones)}`;
        }
    }

    // ----------------------------------------------------------------
    // PARTE 2: Renderizado del Cuadro de Resultados
    // ----------------------------------------------------------------

    function renderCuadroResultados() {
        const container = document.getElementById('numeros-ganadores-display');
        if (!container) return;

        const config = CONFIG_JUEGOS[juegoActual];
        const { ruletas, horas } = config;
        const mapa = {};

        if (resultadosAdmin && resultadosAdmin.trim() !== "") {
            const items = resultadosAdmin.split(',');
            items.forEach(item => {
                const partesSeparadoras = item.split(':');
                if (partesSeparadoras.length === 2) {
                    const infoSorteo = partesSeparadoras[0].trim(); 
                    const valorNumero = partesSeparadoras[1].trim(); 
                    
                    const partesInfo = infoSorteo.split(' ');
                    const hora = partesInfo.pop(); 
                    const nombreRuleta = partesInfo.join(' '); 
                    
                    if (!mapa[nombreRuleta]) mapa[nombreRuleta] = {};
                    mapa[nombreRuleta][hora] = valorNumero;
                }
            });
        }

        let tablaHTML = `
            <div class="tabla-resultados-wrapper">
                <table class="tabla-horarios">
                    <thead>
                        <tr>
                            <th class="th-ruleta">RULETAS/SORTEOS</th>
                            ${horas.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        ruletas.forEach(ruleta => {
            tablaHTML += `<tr><td class="col-ruleta"><strong>${ruleta}</strong></td>`;
            horas.forEach(h => {
                const num = (mapa[ruleta] && mapa[ruleta][h]) ? mapa[ruleta][h] : "--";
                const claseNum = (num === "--") ? "sin-resultado" : "celda-numero";
                
                // MODIFICACIÓN: Se eliminó style="color:#d32f2f;" para que la "O" sea negra
                const displayNum = (num === "O") ? '<span style="font-weight:bold;">O</span>' : num;
                
                tablaHTML += `<td class="${claseNum}">${displayNum}</td>`;
            });
            tablaHTML += `</tr>`;
        });

        tablaHTML += `</tbody></table></div>`;
        container.innerHTML = tablaHTML;
    }

    // ----------------------------------------------------------------
    // PARTE 3: Carga de Datos desde Supabase
    // ----------------------------------------------------------------

    async function cargarDatosDesdeNube() {
        establecerFechaReal();
        juegoActual = selectorJuego ? selectorJuego.value : 'dia';
        const config = CONFIG_JUEGOS[juegoActual];
        
        aciertosObjetivo = config.aciertos;
        jugadaSize = config.size;

        const tituloSpan = document.getElementById('nombre-juego-titulo');
        const mainTitle = document.getElementById('main-title'); 
        const footerText = document.getElementById('footer-text'); 

        if (tituloSpan) tituloSpan.textContent = config.titulo;
        if (mainTitle) mainTitle.textContent = config.titulo;
        if (footerText) footerText.innerHTML = `&copy; 2026 ${config.titulo} - Sistema Profesional de Gestión de Resultados.`;
        
        const labelGan = document.getElementById('label-ganadores');
        if (labelGan) labelGan.textContent = `Ganadores ${aciertosObjetivo} Aciertos`;

        try {
            const [respJugadas, respResultados, respFinanzas] = await Promise.all([
                _supabase.from('jugadas').select('*', { count: 'exact' }).eq('juego', juegoActual).order('nro_ticket', { ascending: true }),
                _supabase.from('resultados').select('numeros').eq('juego', juegoActual).maybeSingle(),
                _supabase.from('finanzas').select('*').eq('juego', juegoActual).maybeSingle()
            ]);

            participantesData = respJugadas.data || [];
            const conteoTickets = respJugadas.count || 0;
            
            if (respResultados.data && respResultados.data.numeros) {
                resultadosAdmin = respResultados.data.numeros;
                resultadosDelDiaSet = resultadosAdmin.split(',').map(item => {
                    const partes = item.split(':');
                    return partes[1] ? partes[1].trim().toUpperCase() : null;
                }).filter(n => n !== null);
            } else {
                resultadosAdmin = "";
                resultadosDelDiaSet = [];
            }

            finanzasData = respFinanzas.data || { ventas: 0, recaudado: 0.00, acumulado1: 0.00, acumulado2: 0.00 };
            finanzasData.ventas = conteoTickets; 

            inicializarSistema();
        } catch (error) {
            console.error("Error cargando datos:", error);
            inicializarSistema();
        }
    }

    // ----------------------------------------------------------------
    // PARTE 4: Ranking y Verificación
    // ----------------------------------------------------------------

    function renderRanking(filtro = "") {
        const tbody = document.getElementById('ranking-body');
        const headerCol = document.getElementById('jugada-header-col');
        if (!tbody) return;

        if (headerCol) headerCol.setAttribute('colspan', jugadaSize);
        tbody.innerHTML = '';

        const term = filtro.toLowerCase();
        
        const ranking = participantesData.map(p => {
            const campoJugada = p.numeros_jugados || "";
            const jugadas = campoJugada.split(',').map(n => n.trim().toUpperCase());
            
            let aciertos = 0;
            jugadas.forEach(n => { 
                let numParaComparar = n;
                if (n === "0") numParaComparar = "O"; 
                if(resultadosDelDiaSet.includes(numParaComparar)) aciertos++; 
            });
            return { ...p, jugadasArray: jugadas, aciertos };
        }).sort((a, b) => b.aciertos - a.aciertos);

        let totalGanadores = 0;
        
        ranking.forEach((p) => {
            if (p.nombre.toLowerCase().includes(term) || (p.refe && p.refe.toString().includes(term))) {
                if (p.aciertos >= aciertosObjetivo) totalGanadores++;

                let jugadasHTML = '';
                for (let i = 0; i < jugadaSize; i++) {
                    let numRaw = p.jugadasArray[i] ? p.jugadasArray[i] : '--';
                    let numVisual = numRaw;
                    if (numRaw === "0") numVisual = "O";

                    const esHit = (numVisual !== '--' && resultadosDelDiaSet.includes(numVisual));
                    jugadasHTML += `<td><span class="ranking-box ${esHit ? 'hit' : ''}">${numVisual}</span></td>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.nro_ticket}</td> <td class="nombre-participante">${p.nombre}</td>
                    <td>${p.refe || 'N/A'}</td>
                    ${jugadasHTML}
                    <td>${p.aciertos >= aciertosObjetivo ? 
                        '<span class="ganador-final">GANADOR 🏆</span>' : 
                        `<span class="ranking-box aciertos-box">${p.aciertos}</span>`}
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });

        const totalGanElem = document.getElementById('total-ganadores');
        if (totalGanElem) totalGanElem.textContent = totalGanadores;
    }

    // ----------------------------------------------------------------
    // PARTE 5: Cálculos Financieros y Etiquetas Dinámicas
    // ----------------------------------------------------------------

    function actualizarFinanzasYEstadisticas() {
        const rec = parseFloat(finanzasData.recaudado) || 0;
        const acumu1 = parseFloat(finanzasData.acumulado1) || 0;
        const acumu2 = parseFloat(finanzasData.acumulado2) || 0;
        
        const repartirTotal75 = rec * 0.75;
        
        const formatear = (m) => new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(m) + " BS";
        const esMini = (juegoActual === 'mini');

        if(document.getElementById('ventas')) document.getElementById('ventas').textContent = finanzasData.ventas || 0;
        if(document.getElementById('recaudado')) document.getElementById('recaudado').textContent = formatear(rec);
        if(document.getElementById('acumulado1')) document.getElementById('acumulado1').textContent = formatear(acumu1);
        if(document.getElementById('acumulado2')) document.getElementById('acumulado2').textContent = formatear(acumu2);
        if(document.getElementById('repartir75')) document.getElementById('repartir75').textContent = formatear(repartirTotal75);

        const boxDom = document.getElementById('box-domingo');
        const boxAc2 = document.getElementById('box-acumu2');
        const boxTotal2 = document.getElementById('box-total-2');
        const labelCasa = document.getElementById('label-casa');
        const labelAcumu1 = document.getElementById('label-acumu1');
        const labelTotal1 = document.getElementById('label-total1');
        const labelTotal2 = document.getElementById('label-total2');
        const labelAcumu2 = document.getElementById('label-acumu2');
        
        if(boxDom) boxDom.style.display = esMini ? "none" : "flex";
        if(boxAc2) boxAc2.style.display = esMini ? "none" : "flex";
        if(boxTotal2) boxTotal2.style.display = esMini ? "none" : "flex";
        
        if (esMini) {
            if(labelCasa) labelCasa.textContent = "25% Casa";
            if(labelAcumu1) labelAcumu1.textContent = "Acumu Día Anterior";
            
            if(labelTotal1) labelTotal1.textContent = "ACUMULADO+PREMIO";
            
            if(document.getElementById('monto-casa')) document.getElementById('monto-casa').textContent = formatear(rec * 0.25);
            if(document.getElementById('total-acumu-premio1')) document.getElementById('total-acumu-premio1').textContent = formatear(repartirTotal75 + acumu1);
        } else {
            if(labelCasa) labelCasa.textContent = "20% Casa";
            if(labelAcumu1) labelAcumu1.textContent = "Acumu 1er Premio";
            if(labelAcumu2) labelAcumu2.textContent = "Acumu 2do Premio";
            
            if(labelTotal1) labelTotal1.textContent = "ACUMULADO+1ER PREMIO";
            if(labelTotal2) labelTotal2.textContent = "ACUMULADO+2DO PREMIO";
            
            const premio1DelDia = repartirTotal75 * 0.80;
            const premio2DelDia = repartirTotal75 * 0.20;

            if(document.getElementById('monto-casa')) document.getElementById('monto-casa').textContent = formatear(rec * 0.20);
            if(document.getElementById('monto-domingo')) document.getElementById('monto-domingo').textContent = formatear(rec * 0.05);
            
            if(document.getElementById('total-acumu-premio1')) {
                document.getElementById('total-acumu-premio1').textContent = formatear(premio1DelDia + acumu1);
            }
            if(document.getElementById('total-acumu-premio2')) {
                document.getElementById('total-acumu-premio2').textContent = formatear(premio2DelDia + acumu2);
            }
        }
    }

    function inicializarSistema() {
        actualizarFinanzasYEstadisticas();
        renderCuadroResultados();
        renderRanking();
    }

    // ----------------------------------------------------------------
    // PARTE 6: Eventos y Descarga Dinámica de PDF
    // ----------------------------------------------------------------

    selectorJuego?.addEventListener('change', cargarDatosDesdeNube);
    
    document.getElementById('filtroParticipantes')?.addEventListener('input', (e) => {
        renderRanking(e.target.value.trim());
    });

    document.getElementById('btn-descargar-pdf')?.addEventListener('click', () => {
        const config = CONFIG_JUEGOS[juegoActual];
        const fecha = new Date().toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }).replace(/\//g, '-');

        const tituloOriginal = document.title;
        
        const nombreLimpio = config.titulo.replace(/[()]/g, '').replace(/ /g, '_');
        const nombreArchivo = `RESULTADOS_${nombreLimpio}_${fecha}`;
        
        document.title = nombreArchivo;
        window.print();

        setTimeout(() => {
            document.title = tituloOriginal;
        }, 1000);
    });

    establecerFechaReal();
    cargarDatosDesdeNube();
});