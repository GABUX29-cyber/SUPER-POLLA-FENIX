document.addEventListener('DOMContentLoaded', async () => {

    // ----------------------------------------------------------------
    // PARTE 1: Configuración Maestra (Horarios, Ruletas y Reglas)
    // ----------------------------------------------------------------
    let resultadosAdmin = [];
    let participantesData = [];
    let finanzasData = { ventas: 0, recaudado: 0.00, acumulado1: 0.00, acumulado2: 0.00 }; 
    let resultadosDelDiaSet = [];
    
    let juegoActual = 'dia'; 
    let aciertosObjetivo = 5;
    let jugadaSize = 5; 

    const selectorJuego = document.getElementById('select-juego-publico');

    const CONFIG_JUEGOS = {
        dia: {
            titulo: "SORTEO DÍA",
            ruletas: ["LOTTO ACTIVO", "GRANJITA", "SELVA PLUS", "GUACHARO"],
            horas: ["8AM", "9AM", "10AM", "11AM", "12PM"],
            aciertos: 5,
            size: 5
        },
        tarde: {
            titulo: "SORTEO TARDE",
            ruletas: ["LOTTO ACTIVO", "GRANJITA", "SELVA PLUS", "GUACHARO"],
            horas: ["3PM", "4PM", "5PM", "6PM", "7PM"],
            aciertos: 5,
            size: 5
        },
        mini: {
            titulo: "MINI EXPRES",
            ruletas: ["LOTTO ACTIVO", "GRANJITA", "SELVA PLUS"],
            horas: ["5PM", "6PM", "7PM"],
            aciertos: 3,
            size: 3
        }
    };

    // --- FUNCIÓN PARA LA FECHA (Ejecución Inmediata) ---
    function establecerFechaReal() {
        const headerP = document.getElementById('fecha-actual');
        if (headerP) {
            const ahora = new Date();
            const opciones = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
            headerP.innerHTML = `<i class="fas fa-calendar-alt"></i> ${ahora.toLocaleDateString('es-ES', opciones)}`;
        }
    }

    // ----------------------------------------------------------------
    // PARTE 2: Renderizado Dinámico del Cuadro de Resultados
    // ----------------------------------------------------------------

    function renderCuadroResultados() {
        const container = document.getElementById('numeros-ganadores-display');
        if (!container) return;

        const config = CONFIG_JUEGOS[juegoActual];
        const { ruletas, horas } = config;

        const mapa = {};
        resultadosAdmin.forEach(res => {
            if (res.sorteo) {
                const partes = res.sorteo.toUpperCase().trim().split(' ');
                const hora = partes.pop(); 
                const nombreRuleta = partes.join(' '); 
                
                if (!mapa[nombreRuleta]) mapa[nombreRuleta] = {};
                mapa[nombreRuleta][hora] = res.numero;
            }
        });

        let tablaHTML = `
            <div class="tabla-resultados-wrapper">
                <table class="tabla-horarios">
                    <thead>
                        <tr>
                            <th class="th-ruleta">RULETA</th>
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
                tablaHTML += `<td class="${claseNum}">${num}</td>`;
            });
            tablaHTML += `</tr>`;
        });

        tablaHTML += `</tbody></table></div>`;
        container.innerHTML = tablaHTML;
    }

    // ----------------------------------------------------------------
    // PARTE 3: Carga de Datos
    // ----------------------------------------------------------------

    async function cargarDatosDesdeNube() {
        establecerFechaReal();
        
        juegoActual = selectorJuego ? selectorJuego.value : 'dia';
        const config = CONFIG_JUEGOS[juegoActual];
        
        aciertosObjetivo = config.aciertos;
        jugadaSize = config.size;

        document.getElementById('nombre-juego-titulo').textContent = config.titulo;
        const labelGan = document.getElementById('label-ganadores');
        if (labelGan) labelGan.textContent = `Ganadores ${aciertosObjetivo} Aciertos`;

        try {
            if (typeof _supabase === 'undefined') {
                console.error("Supabase no inicializado.");
                inicializarSistema();
                return;
            }

            const [respJugadas, respResultados, respFinanzas] = await Promise.all([
                _supabase.from('jugadas').select('*').eq('juego', juegoActual),
                _supabase.from('resultados').select('*').eq('juego', juegoActual),
                _supabase.from('finanzas').select('*').eq('juego', juegoActual).single()
            ]);

            participantesData = respJugadas.data || [];
            resultadosAdmin = respResultados.data || [];
            resultadosDelDiaSet = resultadosAdmin.map(res => String(res.numero).trim());

            if (respFinanzas.data) finanzasData = respFinanzas.data;

            inicializarSistema();
        } catch (error) {
            console.error("Error en conexión:", error);
            inicializarSistema();
        }
    }

    // ----------------------------------------------------------------
    // PARTE 4: Ranking y Finanzas
    // ----------------------------------------------------------------

    function renderRanking(filtro = "") {
        const tbody = document.getElementById('ranking-body');
        const headerCol = document.getElementById('jugada-header-col');
        if (!tbody) return;

        if (headerCol) headerCol.setAttribute('colspan', jugadaSize);
        tbody.innerHTML = '';

        const term = filtro.toLowerCase();
        
        const ranking = participantesData.map(p => {
            const campoJugada = p.numeros_jugados || p.jugadas || "";
            const jugadas = campoJugada ? campoJugada.split(',') : [];
            let aciertos = 0;
            jugadas.forEach(n => { if(resultadosDelDiaSet.includes(n.trim())) aciertos++; });
            return { ...p, jugadasArray: jugadas, aciertos };
        }).sort((a, b) => b.aciertos - a.aciertos);

        let totalGanadores = 0;
        ranking.forEach((p, index) => {
            if (p.nombre.toLowerCase().includes(term) || (p.refe && p.refe.toString().includes(term))) {
                if (p.aciertos >= aciertosObjetivo) totalGanadores++;

                let jugadasHTML = '';
                for (let i = 0; i < jugadaSize; i++) {
                    const num = p.jugadasArray[i] ? p.jugadasArray[i].trim() : '--';
                    const esHit = (num !== '--' && resultadosDelDiaSet.includes(num));
                    jugadasHTML += `<td><span class="ranking-box ${esHit ? 'hit' : ''}">${num}</span></td>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td class="nombre-participante">${p.nombre}</td>
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
        if (document.getElementById('total-ganadores')) document.getElementById('total-ganadores').textContent = totalGanadores;
    }

    function actualizarFinanzasYEstadisticas() {
        const rec = parseFloat(finanzasData.recaudado) || 0;
        const acumu1 = parseFloat(finanzasData.acumulado1) || 0;
        const repartir75 = rec * 0.75;
        const formatear = (m) => new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(m) + " BS";

        if(document.getElementById('ventas')) document.getElementById('ventas').textContent = finanzasData.ventas || 0;
        if(document.getElementById('recaudado')) document.getElementById('recaudado').textContent = formatear(rec);
        if(document.getElementById('acumulado1')) document.getElementById('acumulado1').textContent = formatear(acumu1);
        if(document.getElementById('repartir75')) document.getElementById('repartir75').textContent = formatear(repartir75);

        const esMini = juegoActual === 'mini';
        const boxDom = document.getElementById('box-domingo');
        const boxAc2 = document.getElementById('box-acumu2');
        
        if(boxDom) boxDom.style.display = esMini ? "none" : "flex";
        if(boxAc2) boxAc2.style.display = esMini ? "none" : "flex";
        
        if(!esMini && document.getElementById('monto-domingo')) 
            document.getElementById('monto-domingo').textContent = formatear(rec * 0.05);
        
        if(document.getElementById('monto-casa')) document.getElementById('monto-casa').textContent = formatear(esMini ? rec * 0.25 : rec * 0.20);
        if(document.getElementById('total-acumu-premio1')) document.getElementById('total-acumu-premio1').textContent = formatear(repartir75 + acumu1);
    }

    function inicializarSistema() {
        actualizarFinanzasYEstadisticas();
        renderCuadroResultados();
        renderRanking();
    }

    // --- EVENTOS ---
    selectorJuego?.addEventListener('change', cargarDatosDesdeNube);
    document.getElementById('filtroParticipantes')?.addEventListener('input', (e) => renderRanking(e.target.value.trim()));
    document.getElementById('btn-descargar-pdf')?.addEventListener('click', () => window.print());

    // Inicio
    establecerFechaReal();
    cargarDatosDesdeNube();
});