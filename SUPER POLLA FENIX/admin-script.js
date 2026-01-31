document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SEGURIDAD Y SESIÓN ---
    const loginOverlay = document.getElementById('login-overlay');
    const contenidoPrincipal = document.getElementById('contenido-principal');
    const btnEntrar = document.getElementById('btn-entrar');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

    btnEntrar.addEventListener('click', async () => {
        const { data, error } = await _supabase.auth.signInWithPassword({
            email: loginEmail.value.trim(),
            password: loginPassword.value.trim(),
        });
        if (error) {
            loginError.style.display = 'block';
            loginError.textContent = "Datos incorrectos: " + error.message;
        } else {
            loginOverlay.style.display = 'none';
            contenidoPrincipal.style.display = 'block';
            cargarDatosDesdeNube();
        }
    });

    btnCerrarSesion.addEventListener('click', async () => {
        await _supabase.auth.signOut();
        window.location.reload();
    });

    async function verificarSesion() {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session) {
            loginOverlay.style.display = 'none';
            contenidoPrincipal.style.display = 'block';
            cargarDatosDesdeNube();
        }
    }

    // --- 2. CONFIGURACIÓN DE REGLAS POR JUEGO ---
    let participantes = [];
    let resultadosActuales = "";
    // Estructura de finanzas ampliada para soportar el segundo acumulado
    let finanzas = { ventas: 0, recaudado: 0.00, acumulado1: 0.00, acumulado2: 0.00 };

    const reglasJuegos = {
        'dia': {
            tamaño: 5,
            ruletas: ["GRANJITA", "GUACHARO", "SELVA", "LOTTO ACTIVO"],
            horarios: ["8AM", "9AM", "10AM", "11AM", "12PM"]
        },
        'normal': {
            tamaño: 5,
            ruletas: ["GRANJITA", "GUACHARO", "SELVA", "LOTTO ACTIVO"],
            horarios: ["3PM", "4PM", "5PM", "6PM", "7PM"]
        },
        'mini': {
            tamaño: 3,
            ruletas: ["GRANJITA", "SELVA", "LOTTO ACTIVO"],
            horarios: ["5PM", "6PM", "7PM"]
        }
    };

    // --- 3. PROCESAMIENTO DINÁMICO DE JUGADAS ---
    function procesarYValidarJugada(numerosRaw, nombreParticipante, tamañoRequerido) {
        let numeros = numerosRaw.map(n => {
            let num = n.trim().padStart(2, '0');
            return (num === "00") ? "00" : (parseInt(num) === 0 ? "0" : num);
        }).filter(n => n !== "");

        let avisos = [];
        if (numeros.length > tamañoRequerido) {
            while (numeros.length > tamañoRequerido) numeros.pop();
            avisos.push("Sobrante eliminado");
        }
        if (numeros.length < tamañoRequerido) {
            alert(`❌ Error en ${nombreParticipante}: Faltan números.`);
            return null;
        }

        let counts = {};
        numeros.forEach(n => counts[n] = (counts[n] || 0) + 1);
        for (let n in counts) {
            if (counts[n] > 1) {
                if (!numeros.includes("36")) {
                    numeros[numeros.lastIndexOf(n)] = "36";
                    avisos.push(`Duplicado ${n} por 36`);
                } else {
                    alert(`🚫 Nula ${nombreParticipante}: Duplicados con 36 ya presente.`);
                    return null;
                }
            }
        }
        return { 
            numeros: numeros.join(','), 
            nota: avisos.length > 0 ? `📝 ${avisos.join('. ')}` : "" 
        };
    }

    // --- 4. FUNCIONES DE EDICIÓN MANUAL (NUBE) ---
    
    window.editarParticipanteNube = async (id, nombreAct, refeAct, jugadasAct) => {
        const nuevoNombre = prompt("Editar Nombre del Participante:", nombreAct);
        if (nuevoNombre === null) return;

        const nuevaRefe = prompt("Editar Referencia:", refeAct);
        if (nuevaRefe === null) return;

        const nuevasJugadasStr = prompt("Editar Números (separados por coma):", jugadasAct);
        if (nuevasJugadasStr === null) return;

        const { error } = await _supabase
            .from('jugadas')
            .update({ 
                nombre: nuevoNombre.toUpperCase(), 
                refe: nuevaRefe,
                numeros_jugados: nuevasJugadasStr,
                notas_correccion: "⚠️ Editado manualmente"
            })
            .eq('id', id);

        if (error) {
            alert("Error al actualizar: " + error.message);
        } else {
            cargarDatosDesdeNube();
        }
    };

    window.removerResultadoEspecifico = async (itemCompleto) => {
        if (!confirm(`¿Seguro que deseas eliminar el resultado "${itemCompleto}"?`)) return;
        
        const juego = document.getElementById('select-juego-admin').value;
        let listaArray = resultadosActuales.split(',');
        const index = listaArray.indexOf(itemCompleto);
        
        if (index > -1) {
            listaArray.splice(index, 1);
            const nuevaLista = listaArray.join(',');
            const { error } = await _supabase
                .from('resultados')
                .update({ numeros: nuevaLista })
                .eq('juego', juego);

            if (error) alert("Error: " + error.message);
            else cargarDatosDesdeNube();
        }
    };

    // --- 5. CARGA Y RENDERIZADO ---
    async function cargarDatosDesdeNube() {
        const juegoActivo = document.getElementById('select-juego-admin').value;
        actualizarOpcionesSorteo(juegoActivo);
        ajustarInterfazFinanzas(juegoActivo);

        try {
            // Cargar Participantes
            const { data: p } = await _supabase.from('jugadas').select('*').eq('juego', juegoActivo).order('id', { ascending: true });
            // Cargar Resultados
            const { data: r } = await _supabase.from('resultados').select('*').eq('juego', juegoActivo).single();
            // Cargar Finanzas específicas por juego
            const { data: f } = await _supabase.from('finanzas').select('*').eq('juego', juegoActivo).single();

            participantes = p || [];
            resultadosActuales = r ? r.numeros : "";
            
            if (f) {
                finanzas = f;
                document.getElementById('input-ventas').value = f.ventas || 0;
                document.getElementById('input-recaudado').value = f.recaudado || 0;
                document.getElementById('input-acumulado1').value = f.acumulado1 || 0;
                if (document.getElementById('input-acumulado2')) {
                    document.getElementById('input-acumulado2').value = f.acumulado2 || 0;
                }
                calcularPrevisualizacionFinanzas(f.recaudado, juegoActivo);
            } else {
                document.getElementById('form-finanzas').reset();
                calcularPrevisualizacionFinanzas(0, juegoActivo);
            }

            renderizarListas();
        } catch (e) { console.error(e); }
    }

    function ajustarInterfazFinanzas(juego) {
        const contAcumu2 = document.getElementById('container-acumu2');
        const cardDomingo = document.getElementById('card-domingo');
        const labelCasa = document.getElementById('label-porcentaje-casa');
        const labelAcumu1 = document.getElementById('label-acumu1');

        if (juego === 'mini') {
            if (contAcumu2) contAcumu2.style.display = 'none';
            if (cardDomingo) cardDomingo.style.display = 'none';
            if (labelCasa) labelCasa.textContent = "25% CASA";
            if (labelAcumu1) labelAcumu1.textContent = "Acumulado Único:";
        } else {
            if (contAcumu2) contAcumu2.style.display = 'block';
            if (cardDomingo) cardDomingo.style.display = 'block';
            if (labelCasa) labelCasa.textContent = "20% CASA";
            if (labelAcumu1) labelAcumu1.textContent = "Acumulado Primer Lugar:";
        }
    }

    function calcularPrevisualizacionFinanzas(recaudado, juego) {
        const montoRec = parseFloat(recaudado) || 0;
        const casaVal = document.getElementById('casa-valor');
        const domVal = document.getElementById('domingo-valor');

        if (juego === 'mini') {
            casaVal.textContent = (montoRec * 0.25).toFixed(2) + " BS";
            domVal.textContent = "0.00 BS";
        } else {
            casaVal.textContent = (montoRec * 0.20).toFixed(2) + " BS";
            domVal.textContent = (montoRec * 0.05).toFixed(2) + " BS";
        }
    }

    function actualizarOpcionesSorteo(juego) {
        const selectSorteo = document.getElementById('sorteo-hora');
        selectSorteo.innerHTML = '';
        const conf = reglasJuegos[juego];
        conf.ruletas.forEach(r => {
            conf.horarios.forEach(h => {
                let opt = document.createElement('option');
                opt.value = `${r} ${h}`;
                opt.textContent = `${r} - ${h}`;
                selectSorteo.appendChild(opt);
            });
        });
    }

    function renderizarListas() {
        const listaPart = document.getElementById('lista-participantes');
        listaPart.innerHTML = '';
        const filtro = document.getElementById('input-buscar-participante').value.toLowerCase();

        participantes.filter(p => 
            p.nombre.toLowerCase().includes(filtro) || 
            p.refe.toString().includes(filtro)
        ).forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="flex-grow:1;">
                    <strong>${p.nombre}</strong> (Refe: ${p.refe})<br>
                    <small>${p.numeros_jugados}</small> 
                    ${p.notas_correccion ? '<br><i style="color:red; font-size: 12px;">'+p.notas_correccion+'</i>' : ''}
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-editar" onclick="editarParticipanteNube(${p.id}, '${p.nombre}', '${p.refe}', '${p.numeros_jugados}')">✏️</button>
                    <button class="btn-eliminar" onclick="eliminarJugada(${p.id})">🗑️</button>
                </div>`;
            listaPart.appendChild(li);
        });

        const listaRes = document.getElementById('lista-resultados');
        listaRes.innerHTML = resultadosActuales ? 
            resultadosActuales.split(',').map(n => `
                <li>
                    <span>${n}</span>
                    <button class="btn-eliminar" onclick="removerResultadoEspecifico('${n}')">×</button>
                </li>`).join('') : 
            "<li>Sin resultados</li>";
    }

    // --- 6. EVENTOS DE FORMULARIO ---
    document.getElementById('btn-procesar-pegado').addEventListener('click', () => {
        const juego = document.getElementById('select-juego-admin').value;
        const tamaño = reglasJuegos[juego].tamaño;
        const raw = document.getElementById('input-paste-data').value;
        const lineas = raw.split('\n');
        
        let jugadas = [];
        let nombre = "CLIENTE", refe = "";

        lineas.forEach(l => {
            const m = l.match(/\b\d{1,2}\b/g);
            if (m && m.length >= tamaño) {
                for (let i = 0; i < m.length; i += tamaño) {
                    let g = m.slice(i, i + tamaño);
                    if (g.length === tamaño) jugadas.push(g.join(','));
                }
            } else if (l.toLowerCase().includes("refe")) {
                refe = l.replace(/\D/g, "");
            } else if (l.trim().length > 3 && !refe && !l.includes(',')) {
                nombre = l.trim().toUpperCase();
            }
        });

        document.getElementById('nombre').value = nombre;
        document.getElementById('refe').value = refe;
        document.getElementById('jugadas-procesadas').value = jugadas.join(' | ');
    });

    document.getElementById('form-finanzas').addEventListener('submit', async (e) => {
        e.preventDefault();
        const juego = document.getElementById('select-juego-admin').value;
        const dataFinanzas = {
            juego: juego,
            ventas: parseInt(document.getElementById('input-ventas').value) || 0,
            recaudado: parseFloat(document.getElementById('input-recaudado').value) || 0,
            acumulado1: parseFloat(document.getElementById('input-acumulado1').value) || 0,
            acumulado2: juego !== 'mini' ? (parseFloat(document.getElementById('input-acumulado2').value) || 0) : 0
        };

        const { error } = await _supabase.from('finanzas').upsert(dataFinanzas, { onConflict: 'juego' });
        if (error) alert("Error al guardar finanzas: " + error.message);
        else alert("Finanzas de " + juego.toUpperCase() + " actualizadas ✅");
        cargarDatosDesdeNube();
    });

    document.getElementById('form-participante').addEventListener('submit', async (e) => {
        e.preventDefault();
        const juego = document.getElementById('select-juego-admin').value;
        const tamaño = reglasJuegos[juego].tamaño;
        const jugadasRaw = document.getElementById('jugadas-procesadas').value.split('|');
        const nombreVal = document.getElementById('nombre').value.toUpperCase();
        const refeVal = document.getElementById('refe').value;

        for (let j of jugadasRaw) {
            if (j.trim() === "") continue;
            let proc = procesarYValidarJugada(j.split(','), nombreVal, tamaño);
            if (proc) {
                await _supabase.from('jugadas').insert([{
                    nombre: nombreVal,
                    refe: refeVal,
                    numeros_jugados: proc.numeros,
                    juego: juego,
                    notas_correccion: proc.nota
                }]);
            }
        }
        alert("Participante(s) registrado(s)");
        document.getElementById('form-participante').reset();
        document.getElementById('input-paste-data').value = "";
        cargarDatosDesdeNube();
    });

    document.getElementById('form-resultados').addEventListener('submit', async (e) => {
        e.preventDefault();
        const juego = document.getElementById('select-juego-admin').value;
        const horaSorteo = document.getElementById('sorteo-hora').value;
        const num = document.getElementById('numero-ganador').value.trim().padStart(2, '0');
        
        // Formato: "Ruleta Hora: Numero"
        let nuevoItem = `${horaSorteo}: ${num}`;
        let nuevaLista = resultadosActuales ? `${resultadosActuales},${nuevoItem}` : nuevoItem;
        
        const { error } = await _supabase.from('resultados').upsert({ 
            juego: juego, 
            numeros: nuevaLista 
        }, { onConflict: 'juego' });

        if (error) alert("Error: " + error.message);
        else alert("Resultado agregado");
        
        document.getElementById('numero-ganador').value = "";
        cargarDatosDesdeNube();
    });

    // --- 7. ACCIONES Y FILTROS ---
    document.getElementById('input-buscar-participante').addEventListener('input', renderizarListas);

    window.removerUltimoResultado = async (numAEliminar) => {
        const juego = document.getElementById('select-juego-admin').value;
        let listaArray = resultadosActuales.split(',');
        const index = listaArray.indexOf(numAEliminar);
        if (index > -1) {
            listaArray.splice(index, 1);
            const nuevaLista = listaArray.join(',');
            await _supabase.from('resultados').update({ numeros: nuevaLista }).eq('juego', juego);
            cargarDatosDesdeNube();
        }
    };

    document.getElementById('btn-reiniciar-datos').addEventListener('click', async () => {
        const juego = document.getElementById('select-juego-admin').value;
        if (confirm(`⚠️ ¿BORRAR TODOS LOS DATOS (Jugadores y Resultados) DEL JUEGO ${juego.toUpperCase()}?`)) {
            const confirmacion = prompt("Para confirmar, escribe el nombre del juego:");
            if (confirmacion && confirmacion.toLowerCase() === juego.toLowerCase()) {
                await _supabase.from('jugadas').delete().eq('juego', juego);
                await _supabase.from('resultados').upsert({ juego: juego, numeros: "" }, { onConflict: 'juego' });
                alert("Datos reiniciados.");
                cargarDatosDesdeNube();
            }
        }
    });

    window.eliminarJugada = async (id) => {
        if (confirm("¿Eliminar esta jugada?")) {
            await _supabase.from('jugadas').delete().eq('id', id);
            cargarDatosDesdeNube();
        }
    };

    document.getElementById('select-juego-admin').addEventListener('change', cargarDatosDesdeNube);
    verificarSesion();
});