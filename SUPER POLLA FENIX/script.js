document.addEventListener('DOMContentLoaded', async () => {

    // ----------------------------------------------------------------
    // PARTE 1: Variables Globales y Configuración
    // ----------------------------------------------------------------

    let resultadosAdmin = [];
    let participantesData = [];
    // Actualizado para soportar acumulado2
    let finanzasData = { ventas: 0, recaudado: 0.00, acumulado1: 0.00, acumulado2: 0.00 }; 
    let resultadosDelDia = [];
    
    let juegoActual = 'normal'; 
    let aciertosObjetivo = 5; 
    let jugadaSize = 5; 

    const selectorJuego = document.getElementById('select-juego-publico');

    const formatearBS = (monto) => {
        return new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(monto) + " BS";
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
    // PARTE 2: Carga de Datos Filtrada por Juego
    // ----------------------------------------------------------------

    async function cargarDatosDesdeNube() {
        juegoActual = selectorJuego ? selectorJuego.value : 'normal';
        
        if (juegoActual === 'mini') {
            aciertosObjetivo = 3;
            jugadaSize = 3;
            document.getElementById('nombre-juego-titulo').textContent = "MINI EXPRES";
            document.getElementById('label-ganadores').textContent = "Ganadores 3 Aciertos";
        } else {
            aciertosObjetivo = 5;
            jugadaSize = 5;
            document.getElementById('nombre-juego-titulo').textContent = juegoActual === 'dia' ? "SORTEO DÍA" : "SORTEO TARDE";
            document.getElementById('label-ganadores').textContent = "Ganadores 5 Aciertos";
        }

        try {
            const { data: p } = await _supabase.from('jugadas').select('*').eq('juego', juegoActual);
            const { data: r } = await _supabase.from('resultados').select('*').eq('juego', juegoActual).single();
            // Se asume que en la tabla finanzas hay una fila por cada juego
            const { data: f } = await _supabase.from('finanzas').select('*').eq('juego', juegoActual).single();

            participantesData = p || [];
            
            if (r && r.numeros) {
                resultadosDelDia = r.numeros.split(',').filter(n => n !== "");
            } else {
                resultadosDelDia = [];
            }

            if (f) finanzasData = f;

            inicializarSistema();
        } catch (error) {
            console.error("Error cargando datos:", error);
        }
    }

    function inicializarSistema() {
        establecerFechaReal();
        actualizarFinanzasYEstadisticas();
        renderResultadosBolas(); 
        renderRanking();
        configurarFiltro();
    }

    // ----------------------------------------------------------------
    // PARTE 3: Cálculos y Renderizado
    // ----------------------------------------------------------------

    function calcularAciertos(jugadaString, ganadores) {
        if (!jugadaString) return 0;
        const misNumeros = jugadaString.split(',').map(n => n.trim());
        let aciertos = 0;
        misNumeros.forEach(num => {
            if (ganadores.includes(num)) aciertos++;
        });
        return aciertos;
    }

    // NUEVA LÓGICA DE PREMIOS ADAPTADA
    function actualizarFinanzasYEstadisticas() {
        const rec = parseFloat(finanzasData.recaudado) || 0;
        const acumu1 = parseFloat(finanzasData.acumulado1) || 0;
        const acumu2 = parseFloat(finanzasData.acumulado2) || 0;
        
        const ventasEl = document.getElementById('ventas');
        const recaudadoEl = document.getElementById('recaudado');
        const repartirEl = document.getElementById('repartir75');
        const casaEl = document.getElementById('monto-casa');
        const labelCasa = document.getElementById('label-casa');
        const domEl = document.getElementById('monto-domingo');
        const boxDom = document.getElementById('box-domingo');
        const ac1El = document.getElementById('acumulado1');
        const ac2El = document.getElementById('acumulado2');
        const boxAc2 = document.getElementById('box-acumu2');
        const labelAc1 = document.getElementById('label-acumu1');
        
        // Totales Sumados (Acumu + Premio)
        const total1El = document.getElementById('total-acumu-premio1');
        const total2El = document.getElementById('total-acumu-premio2');
        const boxTotal2 = document.getElementById('box-total-2');

        if (ventasEl) ventasEl.textContent = finanzasData.ventas || 0;
        if (recaudadoEl) recaudadoEl.textContent = formatearBS(rec);
        if (ac1El) ac1El.textContent = formatearBS(acumu1);

        const repartir75 = rec * 0.75;
        if (repartirEl) repartirEl.textContent = formatearBS(repartir75);

        if (juegoActual === 'mini') {
            // AJUSTES MINI EXPRES
            if (casaEl) casaEl.textContent = formatearBS(rec * 0.25);
            if (labelCasa) labelCasa.textContent = "25% Casa";
            if (boxDom) boxDom.style.display = "none";
            if (boxAc2) boxAc2.style.display = "none";
            if (boxTotal2) boxTotal2.style.display = "none";
            if (labelAc1) labelAc1.textContent = "Acumulado";
            if (total1El) total1El.textContent = formatearBS(repartir75 + acumu1);
        } else {
            // AJUSTES DÍA / TARDE
            if (casaEl) casaEl.textContent = formatearBS(rec * 0.20);
            if (labelCasa) labelCasa.textContent = "20% Casa";
            if (boxDom) boxDom.style.display = "flex";
            if (domEl) domEl.textContent = formatearBS(rec * 0.05);
            if (boxAc2) boxAc2.style.display = "flex";
            if (ac2El) ac2El.textContent = formatearBS(acumu2);
            if (boxTotal2) boxTotal2.style.display = "flex";
            if (labelAc1) labelAc1.textContent = "Acumu Primer Lugar";
            if (total1El) total1El.textContent = formatearBS(repartir75 + acumu1);
            if (total2El) total2El.textContent = formatearBS(acumu2); // O la lógica que definas para el 2do
        }
    }

    function renderResultadosBolas() {
        const container = document.getElementById('numeros-ganadores-display');
        if (!container) return;

        if (resultadosDelDia.length === 0) {
            container.innerHTML = '<p style="color:#666">Esperando resultados del sorteo...</p>';
            return;
        }

        container.innerHTML = resultadosDelDia.map(num => `
            <div class="resultado-item">
                <div class="numero-ball">${num}</div>
            </div>
        `).join('');
    }

    function renderRanking(filtro = "") {
        const tbody = document.getElementById('ranking-body');
        const headerCol = document.getElementById('jugada-header-col');
        if (!tbody) return;

        if (headerCol) headerCol.setAttribute('colspan', jugadaSize);

        const term = filtro.toLowerCase();
        let totalGanadores = 0;
        tbody.innerHTML = '';

        const dataConAciertos = participantesData.map(p => ({
            ...p,
            aciertos: calcularAciertos(p.numeros_jugados, resultadosDelDia)
        })).sort((a, b) => b.aciertos - a.aciertos);

        dataConAciertos.forEach((p, index) => {
            if (p.nombre.toLowerCase().includes(term) || p.refe.toString().includes(term)) {
                if (p.aciertos >= aciertosObjetivo) totalGanadores++;

                const numerosArray = p.numeros_jugados ? p.numeros_jugados.split(',') : [];
                let jugadasHTML = '';
                
                for (let i = 0; i < jugadaSize; i++) {
                    const num = numerosArray[i] ? numerosArray[i].trim() : '--';
                    const esHit = resultadosDelDia.includes(num) && num !== '--';
                    jugadasHTML += `<td><span class="ranking-box ${esHit ? 'hit' : ''}">${num}</span></td>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td class="nombre-participante">${p.nombre}</td>
                    <td>${p.refe}</td>
                    ${jugadasHTML}
                    <td>${p.aciertos >= aciertosObjetivo ? 
                        '<span class="ganador-final">¡GANADOR! 🏆</span>' : 
                        `<span class="ranking-box aciertos-box">${p.aciertos}</span>`}
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });

        const totalGanadoresEl = document.getElementById('total-ganadores');
        if (totalGanadoresEl) totalGanadoresEl.textContent = totalGanadores;
    }

    // ----------------------------------------------------------------
    // PARTE 4: Eventos
    // ----------------------------------------------------------------

    if (selectorJuego) {
        selectorJuego.addEventListener('change', cargarDatosDesdeNube);
    }

    function configurarFiltro() {
        const filtroInput = document.getElementById('filtroParticipantes');
        if (filtroInput) {
            filtroInput.addEventListener('input', (e) => {
                renderRanking(e.target.value.trim());
            });
        }
    }

    document.getElementById('btn-descargar-pdf')?.addEventListener('click', () => window.print());

    cargarDatosDesdeNube();
});