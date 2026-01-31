document.addEventListener('DOMContentLoaded', async () => {

    // ----------------------------------------------------------------
    // PARTE 1: Variables Globales y Configuración
    // ----------------------------------------------------------------

    let resultadosAdmin = [];
    let participantesData = [];
    let finanzasData = { ventas: 0, recaudado: 0.00, acumulado1: 0.00 };
    let resultadosDelDia = [];
    
    // Variables dinámicas según el juego
    let juegoActual = 'normal'; // 'dia', 'normal', 'mini'
    let aciertosObjetivo = 5; 
    let jugadaSize = 5; 

    const selectorJuego = document.getElementById('select-juego-publico');

    // FORMATO MONEDA
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
        
        // Ajustar reglas según el juego seleccionado
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
            // 1. Cargar Participantes de este juego
            const { data: p } = await _supabase.from('jugadas').select('*').eq('juego', juegoActual);
            
            // 2. Cargar Resultados de este juego (guardados como string separado por comas)
            const { data: r } = await _supabase.from('resultados').select('*').eq('juego', juegoActual).single();
            
            // 3. Cargar Finanzas (puedes tener una tabla por juego o una general, aquí usamos general)
            const { data: f } = await _supabase.from('finanzas').select('*').single();

            participantesData = p || [];
            
            if (r && r.numeros) {
                // Convertimos el string "01,02,05" en un array ["01", "02", "05"]
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
        renderResultadosBolas(); // Cambiado a visualización de bolas para el público
        renderRanking();
        configurarFiltro();
    }

    // ----------------------------------------------------------------
    // PARTE 3: Cálculos y Renderizado
    // ----------------------------------------------------------------

    function calcularAciertos(jugadaString, ganadores) {
        const misNumeros = jugadaString.split(',').map(n => n.trim());
        let aciertos = 0;
        misNumeros.forEach(num => {
            if (ganadores.includes(num)) aciertos++;
        });
        return aciertos;
    }

    function actualizarFinanzasYEstadisticas() {
        const montoRecaudadoHoy = parseFloat(finanzasData.recaudado) || 0;
        const montoAcumuladoAnterior = parseFloat(finanzasData.acumulado1) || 0;
        const GRAN_TOTAL = montoRecaudadoHoy + montoAcumuladoAnterior;

        document.getElementById('ventas').textContent = finanzasData.ventas || 0;
        document.getElementById('recaudado').textContent = formatearBS(montoRecaudadoHoy);
        document.getElementById('acumulado1').textContent = formatearBS(montoAcumuladoAnterior);
        document.getElementById('monto-casa').textContent = formatearBS(GRAN_TOTAL * 0.20);
        document.getElementById('monto-domingo').textContent = formatearBS(GRAN_TOTAL * 0.05);
        document.getElementById('repartir75').textContent = formatearBS(GRAN_TOTAL * 0.75);
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

        // Ajustar el encabezado de la tabla dinámicamente
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

                const numerosArray = p.numeros_jugados.split(',');
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

        document.getElementById('total-ganadores').textContent = totalGanadores;
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