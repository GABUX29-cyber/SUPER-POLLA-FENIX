document.addEventListener('DOMContentLoaded', () => {

    // --- CLAVES DE ACCESO VÁLIDAS ---
    const CLAVES_VALIDAS = ['29931335', '24175402'];

    // Funciones de bloqueo y carga (mantenidas)
    function iniciarBloqueo() {
        let accesoConcedido = false;
        let intentos = 0;
        alert("¡Bienvenido al Panel de Administración! Debes ingresar una clave válida para acceder.");
        while (!accesoConcedido && intentos < 3) {
            const claveIngresada = prompt("🔒 Acceso Restringido.\nPor favor, ingresa la clave de administrador para continuar:");
            if (claveIngresada && CLAVES_VALIDAS.includes(claveIngresada.trim())) {
                accesoConcedido = true;
            } else {
                intentos++;
                if (intentos < 3) {
                    alert("Clave incorrecta. Inténtalo de nuevo.");
                } else {
                    document.body.innerHTML = '<h1>❌ ACCESO DENEGADO ❌</h1><p>Se ha superado el límite de intentos.</p>';
                }
            }
        }
        return accesoConcedido;
    }

    if (!iniciarBloqueo()) {
        return;
    }

    let resultados = JSON.parse(localStorage.getItem('pollaFenixResultados')) || [];
    let participantes = JSON.parse(localStorage.getItem('pollaFenixParticipantes')) || [];
    let finanzas = JSON.parse(localStorage.getItem('pollaFenixFinanzas')) || {
        ventas: 197,
        recaudado: 5000.00,
        acumulado1: 2274.00
    };

    const listaResultados = document.getElementById('lista-resultados');
    const listaParticipantes = document.getElementById('lista-participantes');
    const inputBuscarParticipante = document.getElementById('input-buscar-participante');


    // Funciones de Backup, Guardado, y Renderizado (mantenidas)
    function crearBackup() {
        const backup = { participantes: participantes, resultados: resultados, finanzas: finanzas };
        localStorage.setItem('pollaFenixBackup', JSON.stringify(backup));
    }

    function restaurarBackup() {
        const backupString = localStorage.getItem('pollaFenixBackup');
        if (!backupString) {
            alert("No se encontró ninguna copia de seguridad (backup) reciente.");
            return;
        }

        const confirmar = confirm("¿Estás seguro de que quieres restaurar la última copia de seguridad? Esto deshará el último reinicio de datos.");
        if (confirmar) {
            const backup = JSON.parse(backupString);
            participantes = backup.participantes;
            resultados = backup.resultados;
            finanzas = backup.finanzas;
            localStorage.removeItem('pollaFenixBackup');
            guardarYRenderizar();
            alert("¡Copia de seguridad restaurada con éxito! Datos deshechos al estado anterior.");
        }
    }


    function guardarYRenderizar() {
        // Vuelve a numerar los participantes antes de guardar
        participantes.forEach((p, index) => {
            p.nro = index + 1;
        });

        // Actualizar TICKETS VENDIDOS con el conteo de participantes
        finanzas.ventas = participantes.length;

        localStorage.setItem('pollaFenixResultados', JSON.stringify(resultados));
        localStorage.setItem('pollaFenixParticipantes', JSON.stringify(participantes));
        localStorage.setItem('pollaFenixFinanzas', JSON.stringify(finanzas));

        renderFinanzas();
        renderResultados();
        renderParticipantes();
        actualizarBotonDeshacer();
    }

    function renderFinanzas() {
        const inputVentas = document.getElementById('input-ventas');
        const inputRecaudado = document.getElementById('input-recaudado');
        const inputAcumulado = document.getElementById('input-acumulado');

        if (inputVentas) inputVentas.value = finanzas.ventas;
        if (inputRecaudado) inputRecaudado.value = finanzas.recaudado;
        if (inputAcumulado) inputAcumulado.value = finanzas.acumulado1;
    }

    function actualizarBotonDeshacer() {
        const btnDeshacer = document.getElementById('btn-deshacer');
        if (btnDeshacer) {
            if (localStorage.getItem('pollaFenixBackup')) {
                btnDeshacer.style.display = 'inline-block';
            } else {
                btnDeshacer.style.display = 'none';
            }
        }
    }


    // --- A. GESTIÓN DE FINANZAS (mantenida) ---
    const formFinanzas = document.getElementById('form-finanzas');
    if (formFinanzas) {
        formFinanzas.addEventListener('submit', (e) => {
            e.preventDefault();
            // Permite la edición manual, pero se actualizará automáticamente si se agregan/eliminan participantes.
            finanzas.ventas = parseInt(document.getElementById('input-ventas').value);
            finanzas.recaudado = parseFloat(document.getElementById('input-recaudado').value);
            finanzas.acumulado1 = parseFloat(document.getElementById('input-acumulado').value);
            guardarYRenderizar();
            alert('Datos financieros y de ventas guardados.');
        });
    }


    // --- B. GESTIÓN DE RESULTADOS (mantenida) ---
    const formResultados = document.getElementById('form-resultados');
    if (formResultados) {
        formResultados.addEventListener('submit', (e) => {
            e.preventDefault();
            const sorteoHora = document.getElementById('sorteo-hora').value;
            let numero = document.getElementById('numero-ganador').value.trim();

            let numeroGuardado;

            if (numero === '0' || numero.toLowerCase() === 'o') {
                numeroGuardado = 'O';
            } else if (numero === '00') {
                numeroGuardado = '00';
            } else {
                const parsedNum = parseInt(numero);
                if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum <= 99) {
                    numeroGuardado = String(parsedNum).padStart(2, '0');
                } else {
                    alert("Error: El número debe ser 0 (se guarda como O), 00, o un valor entre 1 y 99.");
                    return;
                }
            }

            const nuevoResultado = {
                id: Date.now(),
                sorteo: sorteoHora,
                numero: numeroGuardado
            };

            const index = resultados.findIndex(r => r.sorteo === sorteoHora);
            if (index > -1) {
                resultados[index].numero = numeroGuardado;
                resultados[index].id = Date.now();
            } else {
                resultados.push(nuevoResultado);
            }

            guardarYRenderizar();
            formResultados.reset();
            alert(`Resultado ${numeroGuardado} de ${sorteoHora} guardado.`);
        });
    }

    function habilitarEdicionResultado(liElement, resultadoId) {
        const rIndex = resultados.findIndex(r => r.id === resultadoId);
        if (rIndex === -1) return;
        const r = resultados[rIndex];

        let inputValue = r.numero;
        if (r.numero === 'O') {
            inputValue = '0';
        } else if (r.numero === '00') {
            inputValue = '00';
        }

        const inputsHTML = `
            <span>${r.sorteo}:</span>
            <input type="text" class="editable-input resultado-edit-num" id="edit-resultado-num-${r.id}"
                        value="${inputValue}" min="0" max="99" required style="width: 50px;">
            <button class="btn-guardar" data-id="${r.id}" data-type="resultado">Guardar</button>
        `;
        liElement.innerHTML = inputsHTML;
    }

    function guardarEdicionResultado(resultadoId) {
        const rIndex = resultados.findIndex(r => r.id === resultadoId);
        if (rIndex === -1) return;

        let nuevoNumero = document.getElementById(`edit-resultado-num-${resultadoId}`).value.trim();
        let numeroGuardado;

        if (nuevoNumero === '0' || nuevoNumero.toLowerCase() === 'o') {
            numeroGuardado = 'O';
        } else if (nuevoNumero === '00') {
            numeroGuardado = '00';
        } else {
            const parsedNum = parseInt(nuevoNumero);
            if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum <= 99) {
                numeroGuardado = String(parsedNum).padStart(2, '0');
            } else {
                alert("Error: El número debe ser 0 (se guarda como O), 00, o un valor entre 1 y 99.");
                return;
            }
        }

        resultados[rIndex].numero = numeroGuardado;

        guardarYRenderizar();
        alert(`Resultado ${resultados[rIndex].sorteo} actualizado a ${resultados[rIndex].numero}.`);
    }

    function renderResultados() {
        if (!listaResultados) return;

        listaResultados.innerHTML = '';
        resultados.sort((a, b) => a.sorteo.localeCompare(b.sorteo));
        resultados.forEach(r => {
            const li = document.createElement('li');
            li.setAttribute('data-id', r.id);

            const content = document.createElement('span');
            content.textContent = `${r.sorteo}: ${r.numero}`;
            li.appendChild(content);

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.className = 'btn-editar';
            editBtn.setAttribute('data-id', r.id);
            editBtn.setAttribute('data-type', 'resultado');

            li.appendChild(editBtn);
            listaResultados.appendChild(li);
        });
    }

    if (listaResultados) {
        listaResultados.addEventListener('click', (e) => {
            const target = e.target;
            const resultadoId = parseInt(target.getAttribute('data-id'));
            const dataType = target.getAttribute('data-type');
            const liElement = target.closest('li');

            if (dataType !== 'resultado') return;

            if (target.classList.contains('btn-editar')) {
                habilitarEdicionResultado(liElement, resultadoId);
            } else if (target.classList.contains('btn-guardar')) {
                guardarEdicionResultado(resultadoId);
            }
        });
    }


    // --- C. GESTIÓN DE PARTICIPANTES (mantenida) ---

    /**
     * Procesa una cadena de jugadas. DEVUELVE UN ARRAY PLANO DE TODOS LOS NÚMEROS FORMATEADOS.
     */
    function getJugadasArray(jugadasString) {
        if (!jugadasString) return [];

        const allNumbers = jugadasString
            // Acepta espacios, comas, barras, guiones, igual, dos puntos, AMPERSAND (&), MÁS (+), y BARRA INCLINADA (/)
            .split(/[\s,\|\-=/:&+]+/) 
            .map(num => num.trim())
            .filter(num => num.length > 0)
            .map(num => {

                // ACEPTAR 'O' Y '00' LITERALMENTE PRIMERO
                if (num.toLowerCase() === 'o') {
                    return 'O';
                }
                if (num === '00') {
                    return '00';
                }

                const parsedNum = parseInt(num, 10);

                if (!isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 99) {

                    // Si el número es 0 (y no fue detectado como '00' arriba)
                    if (parsedNum === 0) {
                        return 'O';
                    }
                    // Para el resto (1-9, 10-99)
                    return String(parsedNum).padStart(2, '0');
                }
                return null;
            })
            .filter(num => num !== null);

        return allNumbers;
    }

    /**
     * Filtra la lista de participantes en tiempo real usando el input de búsqueda.
     */
    function filtrarParticipantes() {
        if (!inputBuscarParticipante || !listaParticipantes) return;

        const query = inputBuscarParticipante.value.trim().toLowerCase();
        const items = listaParticipantes.querySelectorAll('li');

        items.forEach(li => {
            const id = li.getAttribute('data-id');
            // Busca el objeto participante en el array principal
            const participante = participantes.find(p => p.id === parseInt(id));

            if (participante) {
                // Combina nombre y refe para la búsqueda
                const nombreRefe = `${participante.nombre} ${participante.refe}`.toLowerCase();

                // Si la consulta está vacía O el nombre/refe incluye la consulta
                if (query === '' || nombreRefe.includes(query)) {
                    li.style.display = 'flex'; // Usar 'flex' para mantener el estilo
                } else {
                    li.style.display = 'none';
                }
            }
        });
    }


    /**
     * FUNCIÓN: ELIMINA UN PARTICIPANTE/REGISTRO
     */
    function eliminarParticipante(participanteId) {
        const confirmar = confirm("🚨 ¿Está seguro de que desea ELIMINAR este registro de participante?");

        if (confirmar) {
            // Busca el índice del participante por ID
            const pIndex = participantes.findIndex(p => p.id === participanteId);
            if (pIndex > -1) {
                // Elimina el participante del array
                participantes.splice(pIndex, 1);
                guardarYRenderizar(); // Esto actualizará el conteo de ventas automáticamente
                alert("Registro eliminado con éxito.");
            }
        }
    }


    function habilitarEdicionParticipante(liElement, participanteId) {
        const pIndex = participantes.findIndex(p => p.id === participanteId);
        if (pIndex === -1) return;
        const p = participantes[pIndex];

        const jugadasStr = p.jugadas.join(',');

        let inputsHTML = `
            ${p.nro}.
            <input type="text" class="editable-input" id="edit-nombre-${p.id}" value="${p.nombre}" style="width: 150px;">
             (REFE:
            <input type="number" class="editable-input" id="edit-refe-${p.id}" value="${p.refe}" style="width: 60px;">
             ) - **1 Jugada**:
            <input type="text" class="editable-input" id="edit-jugadas-${p.id}" value="${jugadasStr}" style="width: 250px;">
            <button class="btn-guardar" data-id="${p.id}" data-type="participante">Guardar</button>
            <button class="btn-eliminar" data-id="${p.id}" data-type="participante" style="margin-left: 5px;">❌ Eliminar</button>`;

        liElement.innerHTML = inputsHTML;
    }

    function guardarEdicionParticipante(participanteId) {
        const pIndex = participantes.findIndex(p => p.id === participanteId);
        if (pIndex === -1) return;

        const inputNombre = document.getElementById(`edit-nombre-${participanteId}`);
        const inputRefe = document.getElementById(`edit-refe-${participanteId}`);
        const inputJugadas = document.getElementById(`edit-jugadas-${participanteId}`);

        if (!inputNombre || !inputRefe || !inputJugadas) return;

        const nuevoNombre = inputNombre.value;
        const nuevoRefe = inputRefe.value;
        const jugadasStringEditadas = inputJugadas.value;

        const allJugadas = getJugadasArray(jugadasStringEditadas);

        if (allJugadas.length !== 5) {
            alert("Error: Para editar un registro, debes ingresar exactamente 5 números (una jugada).");
            return;
        }

        participantes[pIndex].nombre = nuevoNombre;
        participantes[pIndex].refe = nuevoRefe;
        participantes[pIndex].jugadas = allJugadas;

        guardarYRenderizar();
        alert(`Registro ${participantes[pIndex].nro} de ${nuevoNombre} actualizado.`);
    }

    const formParticipante = document.getElementById('form-participante');
    const inputNombre = document.getElementById('nombre');
    const inputRefe = document.getElementById('refe');
    const inputJugadasProcesadas = document.getElementById('jugadas-procesadas');

    if (formParticipante) {
        formParticipante.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = inputNombre.value;
            const refe = inputRefe.value;
            const jugadasString = inputJugadasProcesadas.value;

            const allJugadas = getJugadasArray(jugadasString);

            const jugadasAgrupadas = [];
            for (let i = 0; i < allJugadas.length; i += 5) {
                const grupo = allJugadas.slice(i, i + 5);
                if (grupo.length === 5) {
                    jugadasAgrupadas.push(grupo);
                }
            }

            const numJugadasCompletas = jugadasAgrupadas.length;

            if (numJugadasCompletas === 0) {
                alert("Error: No se detectaron jugadas completas (5 números) válidas. Por favor, revisa el campo de jugadas.");
                return;
            }

            // Se mantiene la validación de REFE obligatorio si se hace el registro manual.
            if (!refe) {
                alert("Error: El código REFE es obligatorio. Por favor, ingrésalo.");
                inputRefe.focus();
                return;
            }

            let registrosCreados = 0;

            jugadasAgrupadas.forEach(jugadaIndividual => {
                const nuevoParticipante = {
                    id: Date.now() + registrosCreados,
                    nombre: nombre,
                    refe: refe,
                    jugadas: jugadaIndividual
                };
                participantes.push(nuevoParticipante);
                registrosCreados++;
            });


            guardarYRenderizar();
            formParticipante.reset();
            alert(`Participante ${nombre} registrado con éxito. Se crearon ${registrosCreados} registros individuales.`);
        });
    }


    function renderParticipantes() {
        if (!listaParticipantes) return;

        listaParticipantes.innerHTML = '';
        participantes.forEach(p => {
            const li = document.createElement('li');
            li.setAttribute('data-id', p.id);

            const jugadaText = p.jugadas.join(', ');

            const content = document.createElement('span');
            content.textContent = `${p.nro}. ${p.nombre} (REFE: ${p.refe}) - Jugada: ${jugadaText}`;
            li.appendChild(content);

            // BOTÓN EDITAR
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.className = 'btn-editar';
            editBtn.setAttribute('data-id', p.id);
            editBtn.setAttribute('data-type', 'participante');

            // BOTÓN ELIMINAR
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '❌ Eliminar';
            deleteBtn.className = 'btn-eliminar';
            deleteBtn.setAttribute('data-id', p.id);
            deleteBtn.setAttribute('data-type', 'participante');

            li.appendChild(editBtn);
            li.appendChild(deleteBtn);
            listaParticipantes.appendChild(li);
        });

        // Aplicar el filtro después de renderizar
        filtrarParticipantes();
    }

    if (listaParticipantes) {
        listaParticipantes.addEventListener('click', (e) => {
            const target = e.target;
            const participanteId = parseInt(target.getAttribute('data-id'));
            const dataType = target.getAttribute('data-type');
            const liElement = target.closest('li');

            if (dataType !== 'participante') return;

            if (target.classList.contains('btn-editar')) {
                habilitarEdicionParticipante(liElement, participanteId);
            } else if (target.classList.contains('btn-guardar')) {
                guardarEdicionParticipante(participanteId);
            } else if (target.classList.contains('btn-eliminar')) {
                eliminarParticipante(participanteId);
            }
        });
    }

    // Activar la búsqueda dinámicamente
    if (inputBuscarParticipante) {
        inputBuscarParticipante.addEventListener('input', renderParticipantes);
    }


    // --- D. LÓGICA PARA PEGAR Y PROCESAR DATOS DE PARTICIPANTE (CORRECCIÓN FINAL) ---
    const inputPasteData = document.getElementById('input-paste-data');
    const btnProcesarPegado = document.getElementById('btn-procesar-pegado');

    if (btnProcesarPegado) {
        btnProcesarPegado.addEventListener('click', () => {
            
            const pastedText = inputPasteData.value.trim();
            if (!pastedText) {
                alert('Por favor, pega los datos del participante en el cuadro de texto.');
                return;
            }

            // Normalizar el texto de entrada para eliminar caracteres de espacio no estándar (como &nbsp; o tabs)
            // Esto previene el error de "No hace nada".
            const normalizedText = pastedText.replace(/\u00A0/g, ' ').replace(/\s{2,}/g, ' ').trim();


            let nombre = '';
            let refe = '';
            let foundRefe = false;

            // Dividir en líneas y normalizar
            let lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            // Regex para REFE explícito (Identificación, ID, CI, Refe, etc.)
            const refeRegex = /(Identificación|ID|CI|Refe|C\.I\.|C.I:)\s*:\s*(\d+)/i;
            
            // Regex para el patrón: Texto que termina en (o contiene) un número (Tito 77)
            const nameWithNumberRegex = /^(.+)\s*(\d{2,})$/i; 
            
            // Regex para detectar Nombre/Alias al final de la línea de jugadas
            const trailingNameRegex = /([0-9O\s,\|\-=/:&+.]+)\s*([^0-9]{3,})$/i; 
            
            // Línea de la cual se podría extraer el nombre
            let textForProcessing = normalizedText; 
            let nameCandidateIndex = -1;
            let jugadasLines = [...lines]; // Copia de las líneas para manipular


            // -------------------------------------------------------------
            // 0. DETECCIÓN PRIORITARIA: NOMBRE/ALIAS SEPARADO EN LA ÚLTIMA LÍNEA (Meye🙏🏼, Paola Reales)
            // -------------------------------------------------------------
            if (jugadasLines.length > 0) {
                 const lastLine = jugadasLines[jugadasLines.length - 1];
                 
                 // 1. Verificar si la línea NO CONTIENE números de jugada válidos.
                 const numbersInLastLine = getJugadasArray(lastLine); 
                 
                 // 2. Verificar que contiene al menos 3 caracteres alfabéticos (sin contar espacios, números o símbolos).
                 const alphaOnly = lastLine.replace(/[^A-ZÁÉÍÓÚÜÑ]/gi, '').trim();

                 if (numbersInLastLine.length === 0 && alphaOnly.length >= 2) { // Bajado a 2 para nombres cortos
                     // ¡Es un alias! Lo sacamos de las jugadas.
                     jugadasLines.pop(); 
                     nombre = lastLine.trim().toUpperCase();
                 }
            }


            // -------------------------------------------------------------
            // 0.5 DETECCIÓN MEDIA: NOMBRE CON NÚMERO AL INICIO (Tito 77)
            // -------------------------------------------------------------
            if (!nombre && jugadasLines.length > 0) {
                const firstLine = jugadasLines[0];
                const nameNumberMatch = firstLine.match(nameWithNumberRegex);

                if (nameNumberMatch && nameNumberMatch[1].replace(/\s/g, '').length >= 3) { // Debe tener al menos 3 letras
                    // Captura el nombre COMPLETO (Tito 77)
                    nombre = firstLine.trim().toUpperCase();
                    // Elimina esta línea de las jugadas a procesar
                    jugadasLines.shift(); 
                }
            }
            
            // Reconstruir el texto de procesamiento después de la limpieza de líneas de nombre separadas
            textForProcessing = jugadasLines.join('\n');


            // -------------------------------------------------------------
            // 0.7 DETECCIÓN BAJA: NOMBRE INMEDIATAMENTE DESPUÉS DE JUGADAS (Jose)
            // -------------------------------------------------------------
            if (!nombre && jugadasLines.length > 0) {
                const lastLine = jugadasLines[jugadasLines.length - 1];
                const trailingMatch = lastLine.match(trailingNameRegex);
                
                if (trailingMatch) {
                    // Captura el nombre original (con acentos/emojis/símbolos si los tiene) y lo pasa a mayúsculas
                    nombre = trailingMatch[2].trim().toUpperCase(); 
                    
                    // Reemplazamos la línea original por solo las jugadas
                    jugadasLines[jugadasLines.length - 1] = trailingMatch[1].trim(); 
                    textForProcessing = jugadasLines.join('\n');
                }
            }
            

            // -------------------------------------------------------------
            // 1. PROCESAR REFE EXPLÍCITO (Puede limpiar el texto para el nombre si no se encontró arriba)
            // -------------------------------------------------------------
            for (let line of lines) { // Usamos el array 'lines' original para buscar REFE
                const refeMatch = line.match(refeRegex);

                if (refeMatch && refeMatch[2]) {
                    refe = refeMatch[2];
                    foundRefe = true;
                    // Si encontramos REFE, podemos limpiar el texto de jugadas de esa referencia
                    textForProcessing = textForProcessing.replace(line, '');
                    break; 
                }
            }
            
            
            // -------------------------------------------------------------
            // 3. PROCESAR LAS JUGADAS
            // -------------------------------------------------------------
            
            // Limpiamos todo el texto restante de jugadas de cualquier texto/símbolo que no sean números/separadores.
            textForProcessing = textForProcessing.replace(/[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]/g, ' ').replace(/[^0-9O\s,\|\-=/:]/g, ' ').trim();
            
            const allJugadas = getJugadasArray(textForProcessing);


            const jugadasAgrupadas = [];
            for (let i = 0; i < allJugadas.length; i += 5) {
                const grupo = allJugadas.slice(i, i + 5);
                jugadasAgrupadas.push(grupo);
            }

            const jugadasStringParaInput = jugadasAgrupadas.map(j => j.join(',')).join(' | ');

            const numJugadasCompletas = allJugadas.length > 0 ? Math.floor(allJugadas.length / 5) : 0;

            // -------------------------------------------------------------
            // 4. ASIGNAR VALORES
            // -------------------------------------------------------------
            inputNombre.value = nombre;
            inputRefe.value = refe;
            inputJugadasProcesadas.value = jugadasStringParaInput;

            inputPasteData.value = '';

            alert(`Datos procesados para ${inputNombre.value || 'participante desconocido'}. Se detectaron ${numJugadasCompletas} jugadas completas listas para ser registradas individualmente.`);

            if (!refe) {
                inputRefe.focus();
            }
        });
    }


    // --- E. FUNCIÓN PARA REINICIAR DATOS (mantenida) ---
    const btnReiniciar = document.getElementById('btn-reiniciar-datos');
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', () => {
            const confirmar = confirm("🚨 ¡ATENCIÓN! ¿Estás seguro de que quieres REINICIAR todos los PARTICIPANTES y RESULTADOS?");

            if (confirmar) {
                const claveReinicio = prompt("Ingresa la clave de administrador para confirmar el reinicio:");

                if (claveReinicio && CLAVES_VALIDAS.includes(claveReinicio.trim())) {
                    crearBackup();

                    participantes = [];
                    resultados = [];

                    finanzas = { ventas: 0, recaudado: 0.00, acumulado1: 0.00 };

                    guardarYRenderizar();
                    alert("✅ ¡Datos reiniciados! Se creó una copia de seguridad para Deshacer. Recuerda actualizar la página principal.");
                } else {
                    alert("❌ Clave incorrecta. El reinicio fue cancelado.");
                }
            }
        });
    }

    // --- F. IMPLEMENTACIÓN BOTÓN DESHACER (mantenida) ---
    if (btnReiniciar) {
        let btnDeshacer = document.getElementById('btn-deshacer');
        if (!btnDeshacer) {
            const reiniciarDiv = btnReiniciar.parentElement;
            btnDeshacer = document.createElement('button');
            btnDeshacer.id = 'btn-deshacer';
            btnDeshacer.textContent = '↩️ Deshacer Último Reinicio';
            btnDeshacer.style.cssText = 'background-color: #6c757d; color: white; margin-top: 10px; padding: 10px; border: none; border-radius: 4px; cursor: pointer; display: none;';
            reiniciarDiv.insertBefore(btnDeshacer, btnReiniciar.nextSibling);
        }
        btnDeshacer.addEventListener('click', restaurarBackup);
    }


    // --- INICIALIZACIÓN (mantenida) ---
    guardarYRenderizar();
});