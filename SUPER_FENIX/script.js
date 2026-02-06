document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------------
    // PARTE 1: Carga y Preparación de Datos desde localStorage
    // ----------------------------------------------------------------

    // Cargar datos de localStorage
    const resultadosAdmin = JSON.parse(localStorage.getItem('pollaFenixResultados')) || [];
    const participantesData = JSON.parse(localStorage.getItem('pollaFenixParticipantes')) || [];
    const finanzasData = JSON.parse(localStorage.getItem('pollaFenixFinanzas')) || {
        ventas: 0, 
        recaudado: 0.00,
        acumulado1: 0.00
    };
    
    const resultadosDelDia = resultadosAdmin.map(r => r.numero);

    // ----------------------------------------------------------------
    // PARTE 2: Funciones Lógicas y de Cálculo
    // ----------------------------------------------------------------

    /**
     * Función que calcula el número de aciertos de un jugador.
     */
    function calcularAciertos(jugadorJugadas, ganadores) {
        let aciertos = 0;
        const ganadoresSet = new Set(ganadores);
        
        jugadorJugadas.forEach(num => {
            if (ganadoresSet.has(num)) {
                aciertos++;
            }
        });
        return aciertos;
    }

    /**
     * Función que actualiza los montos financieros y estadísticas en las tarjetas.
     */
    function actualizarFinanzasYEstadisticas() {
        const totalVentas = finanzasData.ventas;
        const totalRecaudado = finanzasData.recaudado;
        const acumPrimerLugar = finanzasData.acumulado1;
        
        const casa20 = totalRecaudado * 0.20;
        const repartir75 = totalRecaudado * 0.75; 

        const formatoBs = (monto) => `Bs.${monto.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
        const formatoNum = (num) => num.toLocaleString('es-VE'); 

        // Rellenar las tarjetas de ESTADÍSTICAS
        document.getElementById('ventas').textContent = formatoNum(totalVentas);
        document.getElementById('recaudado').textContent = formatoBs(totalRecaudado);
        document.getElementById('casa20').textContent = formatoBs(casa20); 
        document.getElementById('repartir75').textContent = formatoBs(repartir75);
        document.getElementById('acumulado1').textContent = formatoBs(acumPrimerLugar); 

        // Calcular y rellenar la tarjeta de Ganadores (SOLO 5 ACIERTOS)
        const rankingCalculado = participantesData.map(p => {
            const aciertos = calcularAciertos(p.jugadas, resultadosDelDia);
            return { ...p, aciertos };
        });

        // REGLA: Ganador es solo con 5 aciertos
        const totalGanadores = rankingCalculado.filter(p => p.aciertos >= 5).length;

        document.getElementById('total-ganadores').textContent = formatoNum(totalGanadores);
    }

    // ----------------------------------------------------------------
    // PARTE 3: Renderizado de la Página Principal 
    // ----------------------------------------------------------------

    /**
     * Muestra los resultados del día en formato de tabla-grilla.
     */
    function renderResultadosDia() {
        const displayDiv = document.getElementById('numeros-ganadores-display');
        displayDiv.innerHTML = ''; 

        if (resultadosAdmin.length === 0) {
            displayDiv.innerHTML = '<p>No se han seleccionado números ganadores</p>';
            return;
        }

        const resultadosAgrupados = {};
        const horasSet = new Set();
        
        resultadosAdmin.forEach(r => {
            const parts = r.sorteo.split(' ');
            const horaRaw = parts.pop();
            const sorteoName = parts.join(' '); 
            const hora = horaRaw.toUpperCase();
            
            if (!resultadosAgrupados[sorteoName]) {
                resultadosAgrupados[sorteoName] = {};
            }
            resultadosAgrupados[sorteoName][hora] = r.numero;
            horasSet.add(hora);
        });

        const ordenHorasBase = ['3PM', '4PM', '5PM', '6PM', '7PM'];
        const ordenHoras = ordenHorasBase.filter(h => horasSet.has(h) || true); 

        const tabla = document.createElement('table');
        tabla.classList.add('resultados-grilla');

        const thead = tabla.createTHead();
        const headerRow = thead.insertRow();
        headerRow.insertCell().textContent = ''; 
        ordenHoras.forEach(hora => {
            const th = document.createElement('th');
            th.textContent = hora;
            headerRow.appendChild(th);
        });

        const tbody = tabla.createTBody();
        const sorteosFijos = [
            'LOTTO ACTIVO', 
            'GRANJITA', 
            'SELVA PLUS', 
            'GUACHARO'
        ];
        
        sorteosFijos.forEach(sorteoName => {
            const bodyRow = tbody.insertRow();
            
            const sorteoCell = bodyRow.insertCell();
            sorteoCell.textContent = sorteoName;
            sorteoCell.classList.add('sorteo-name');

            ordenHoras.forEach(hora => {
                const cell = bodyRow.insertCell();
                cell.textContent = (resultadosAgrupados[sorteoName] && resultadosAgrupados[sorteoName][hora]) ? 
                                   resultadosAgrupados[sorteoName][hora] : '--';
                cell.classList.add('numero-resultado');
            });
        });

        displayDiv.appendChild(tabla);
    }


    /**
     * Rellena la tabla de ranking (Participantes).
     */
    function renderRanking() {
        const rankingBody = document.getElementById('ranking-body');
        rankingBody.innerHTML = ''; 
        
        if (participantesData.length === 0) {
            rankingBody.innerHTML = '<tr><td colspan="9">No hay participantes registrados.</td></tr>';
            return;
        }

        const rankingCalculado = participantesData.map(p => {
            const aciertos = calcularAciertos(p.jugadas, resultadosDelDia);
            return { ...p, aciertos };
        });

        // Ordenar por aciertos (mayor a menor)
        rankingCalculado.sort((a, b) => b.aciertos - a.aciertos);

        rankingCalculado.forEach(p => {
            const row = rankingBody.insertRow();
            
            row.insertCell().textContent = p.nro;
            row.insertCell().textContent = p.nombre;
            row.insertCell().textContent = p.refe;
            
            p.jugadas.forEach(jugada => {
                const cell = row.insertCell();
                cell.textContent = jugada;
                // Marcar jugadas que aciertan (aunque no sean 5)
                if (resultadosDelDia.includes(jugada)) {
                    cell.classList.add('acierto-individual');
                }
            });
            
            // Asegurar que haya 5 celdas de jugadas
            for (let i = p.jugadas.length; i < 5; i++) {
                row.insertCell().textContent = '';
            }
            
            const aciertosCell = row.insertCell();
            
            // LÓGICA DE GANADOR: Muestra "GANADOR" y aplica clases
            if (p.aciertos >= 5) {
                aciertosCell.textContent = 'GANADOR'; 
                aciertosCell.classList.add('ganador-final');
                row.classList.add('fila-ganadora'); 
            } else {
                aciertosCell.textContent = p.aciertos;
                aciertosCell.classList.add('aciertos');
            }
            
        });
    }

    // ----------------------------------------------------------------
    // PARTE 4: Inicialización
    // ----------------------------------------------------------------
    
    actualizarFinanzasYEstadisticas(); 
    renderResultadosDia();
    renderRanking();
});