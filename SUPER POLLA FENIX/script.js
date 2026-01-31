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
            ruletas: ["LOTTO ACTIVO", "LA GRANJITA", "SELVA PLUS", "EL GUACHARO"],
            horas: ["8AM", "9AM", "10AM", "11AM", "12PM"],
            aciertos: 5,
            size: 5
        },
        tarde: {
            titulo: "SORTEO TARDE",
            ruletas: ["LOTTO ACTIVO", "LA GRANJITA", "SELVA PLUS", "EL GUACHARO"],
            horas: ["3PM", "4PM", "5PM", "6PM", "7PM"],
            aciertos: 5,
            size: 5
        },
        mini: {
            titulo: "MINI EXPRES",
            ruletas: ["LOTTO ACTIVO", "LA GRANJITA", "SELVA PLUS"],
            horas: ["5PM", "6PM", "7PM"],
            aciertos: 3,
            size: 3
        }
    };

    // ----------------------------------------------------------------
    // PARTE 2: Renderizado Dinámico del Cuadro de Resultados
    // ----------------------------------------------------------------

    function renderCuadroResultados() {
        const container = document.getElementById('numeros-ganadores-display');
        if (!container) return;

        const config = CONFIG_JUEGOS[juegoActual];
        const { ruletas, horas } = config;

        // Mapeo: mapa["Nombre Ruleta"]["Hora"] = Numero
        const mapa = {};
        resultadosAdmin.forEach(res => {
            const partes = res.sorteo.split(' ');
            const hora = partes.pop(); 
            const nombreRuleta = partes.join(' ');
            if (!mapa[nombreRuleta]) mapa[nombreRuleta] = {};
            mapa[nombreRuleta][hora] = res.numero;
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
    // PARTE 3: Carga de Datos y Lógica de Negocio
    // ----------------------------------------------------------------

    async function cargarDatosDesdeNube() {
        juegoActual = selectorJuego ? selectorJuego.value : 'dia';
        const config = CONFIG_JUEGOS[juegoActual];
        
        aciertosObjetivo = config.aciertos;
        jugadaSize = config.size;

        document.getElementById('nombre-juego-titulo').textContent = config.titulo;
        const labelGan = document.getElementById('label-ganadores');
        if (labelGan) labelGan.textContent = `Ganadores ${aciertosObjetivo} Aciertos`;

        try {
            // Ajusta los nombres de tus tablas si son diferentes en Supabase ('jugadas' vs 'participantes')
            const { data: p } = await _supabase.from('jugadas').select('*').eq('juego', juegoActual);
            const { data: r } = await _supabase.from('resultados').select('*').eq('juego', juegoActual);
            const { data: f } = await _supabase.from('finanzas').select('*').eq('juego', juegoActual).single();

            participantesData = p || [];
            resultadosAdmin = r || [];
            resultadosDelDiaSet = resultadosAdmin.map(res => String(res.numero));

            if (f) finanzasData = f;

            inicializarSistema();
        } catch (error) {
            console.error("Error cargando Supabase:", error);
        }
    }

    // ----------------------------------------------------------------
    // PARTE 4: Ranking de Participantes
    // ----------------------------------------------------------------

    function renderRanking(filtro = "") {
        const tbody = document.getElementById('ranking-body');
        const headerCol = document.getElementById('jugada-header-col');
        if (!tbody) return;

        if (headerCol) headerCol.setAttribute('colspan', jugadaSize);
        tbody.innerHTML = '';

        const term = filtro.toLowerCase();
        
        const ranking = participantesData.map(p => {
            // Nota: Se usa 'numeros_jugados' basado en tu código previo
            const jugadas = p.numeros_jugados ? p.numeros_jugados.split(',') : [];
            let aciertos = 0;
            jugadas.forEach(n => { if(resultadosDelDiaSet.includes(n.trim())) aciertos++; });
            return { ...p, jugadasArray: jugadas, aciertos };
        }).sort((a, b) => b.aciertos - a.aciertos);

        let totalGanadores = 0;
        ranking.forEach((p, index) => {
            if (p.nombre.toLowerCase().includes(term) || p.refe.toString().includes(term)) {
                if (p.aciertos >= aciertosObjetivo) totalGanadores++;

                let jugadasHTML = '';
                for (let i = 0; i < jugadaSize; i++) {
                    const num = p.jugadasArray[i] ? p.jugadasArray[i].trim() : '--';
                    const esHit = resultadosDelDiaSet.includes(num) && num !== '--';
                    jugadasHTML += `<td><span class="ranking-box ${esHit ? 'hit' : ''}">${num}</span></td>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td class="nombre-participante">${p.nombre}</td>
                    <td>${p.refe}</td>
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
        
        // Ajustar visibilidad de cajas de premios adicionales
        const boxDom = document.getElementById('box-domingo');
        const boxAc2 = document.getElementById('box-acumu2');
        if(boxDom) boxDom.style.display = esMini ? "none" : "flex";
        if(boxAc2) boxAc2.style.display = esMini ? "none" : "flex";
        
        if(!esMini && document.getElementById('monto-domingo')) 
            document.getElementById('monto-domingo').textContent = formatear(rec * 0.05);
        
        document.getElementById('monto-casa').textContent = formatear(esMini ? rec * 0.25 : rec * 0.20);
        document.getElementById('label-casa').textContent = esMini ? "25% Casa" : "20% Casa";
        document.getElementById('total-acumu-premio1').textContent = formatear(repartir75 + acumu1);
    }

    function inicializarSistema() {
        actualizarFinanzasYEstadisticas();
        renderCuadroResultados();
        renderRanking();
    }

    // Eventos de usuario
    selectorJuego?.addEventListener('change', cargarDatosDesdeNube);
    document.getElementById('filtroParticipantes')?.addEventListener('input', (e) => renderRanking(e.target.value.trim()));
    document.getElementById('btn-descargar-pdf')?.addEventListener('click', () => window.print());

    // Carga inicial al abrir la página
    cargarDatosDesdeNube();
});