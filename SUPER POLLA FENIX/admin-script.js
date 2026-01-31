document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SEGURIDAD Y SESIÓN (AUTH SUPABASE) ---
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
            if(loginOverlay) loginOverlay.style.display = 'none';
            if(contenidoPrincipal) contenidoPrincipal.style.display = 'block';
            cargarDatosDesdeNube();
        }
    }

    // --- 2. CONFIGURACIÓN DE REGLAS POR JUEGO ---
    let participantes = [];
    let resultadosActuales = "";
    let finanzas = { ventas: 0, recaudado: 0.00, acumulado1: 0.00, acumulado2: 0.00 };

    const reglasJuegos = {
        'dia': {
            tamaño: 5,
            ruletas: ["GRANJITA", "GUACHARO", "SELVA PLUS", "LOTTO ACTIVO"],
            horarios: ["8AM", "9AM", "10AM", "11AM", "12PM"]
        },
        'tarde': { 
            tamaño: 5,
            ruletas: ["GRANJITA", "GUACHARO", "SELVA PLUS", "LOTTO ACTIVO"],
            horarios: ["3PM", "4PM", "5PM", "6PM", "7PM"]
        },
        'mini': {
            tamaño: 3,
            ruletas: ["GRANJITA", "SELVA PLUS", "LOTTO ACTIVO"],
            horarios: ["5PM", "6PM", "7PM"]
        }
    };

    // --- 2.1 LÓGICA DE BOTONES OVALADOS (PILLS) ---
    window.seleccionarJuegoAdminPill = function(elemento, juego) {
        document.querySelectorAll('.tab-pill').forEach(pill => pill.classList.remove('active'));
        elemento.classList.add('active');
        const selector = document.getElementById('select-juego-admin');
        if (selector) {
            selector.value = juego;
            selector.dispatchEvent(new Event('change'));
        }
    };

    // --- 3. CEREBRO DE VALIDACIÓN (REGLA 0 -> O) ---
    function procesarYValidarJugada(numerosRaw, nombreParticipante, tamañoRequerido) {
        let numeros = numerosRaw.map(n => {
            let num = n.trim();
            
            // REGLA SOLICITADA: Solo el 0 sencillo es la letra O
            if (num === "0") return "O";
            if (num === "00") return "00";
            
            // Formatear otros números (ej: 5 -> 05)
            if (num.length === 1 && !isNaN(num)) return num.padStart(2, '0');
            return num.toUpperCase();
        }).filter(n => n !== "");

        let avisos = [];
        let avisosAlert = [];

        // Regla: Sobrante
        if (numeros.length > tamañoRequerido) {
            let eliminados = [];
            while (numeros.length > tamañoRequerido) {
                eliminados.push(numeros.pop());
            }
            let msg = `Sobrante eliminado (${eliminados.join(', ')})`;
            avisos.push(msg);
            avisosAlert.push(`⚠️ ${msg}`);
        }

        // Regla: Faltantes
        if (numeros.length < tamañoRequerido) {
            alert(`❌ ERROR en ${nombreParticipante}: Solo tiene ${numeros.length} números de ${tamañoRequerido} requeridos.`);
            return null;
        }

        // GESTIÓN DE DUPLICADOS (La 'O' puede repetirse)
        let counts = {};
        let duplicadosEncontrados = [];
        // Solo contamos duplicados para lo que NO sea "O"
        numeros.forEach(n => {
            if (n !== "O") counts[n] = (counts[n] || 0) + 1;
        });

        for (let n in counts) {
            if (counts[n] > 1) duplicadosEncontrados.push(n);
        }

        if (duplicadosEncontrados.length > 0) {
            let sePudoCorregir = true;
            duplicadosEncontrados.forEach(dup => {
                if (!numeros.includes("36")) {
                    let index = numeros.lastIndexOf(dup);
                    numeros[index] = "36";
                    let msg = `Duplicado (${dup}) reemplazado por 36`;
                    avisos.push(msg);
                    avisosAlert.push(`🔄 ${msg}`);
                } else {
                    sePudoCorregir = false;
                }
            });

            if (!sePudoCorregir) {
                alert(`🚫 JUGADA NULA (${nombreParticipante}): Hay duplicados (${duplicadosEncontrados.join(', ')}) y el 36 ya existe.`);
                return null;
            }
        }

        return { 
            numeros: numeros.join(','), 
            nota: avisos.length > 0 ? `📝 Auto-corrección: ${avisos.join('. ')}` : "" 
        };
    }

    // --- 4. FUNCIONES DE EDICIÓN Y ELIMINACIÓN ---
    window.editarParticipanteNube = async (id, nombreAct, refeAct, jugadasAct) => {
        const nuevoNombre = prompt("Nombre:", nombreAct);
        if (nuevoNombre === null) return;
        const nuevaRefe = prompt("Referencia (REFE):", refeAct);
        if (nuevaRefe === null) return;
        const nuevasJugadasStr = prompt("Jugadas (separadas por coma):", jugadasAct);
        if (nuevasJugadasStr === null) return;
        const motivo = prompt("Motivo de la edición:", "Manual");

        const { error } = await _supabase.from('jugadas').update({ 
            nombre: nuevoNombre.toUpperCase(), 
            refe: nuevaRefe,
            numeros_jugados: nuevasJugadasStr,
            notas_correccion: `⚠️ Editado: ${motivo}`
        }).eq('id', id);

        if (error) alert("Error: " + error.message);
        else cargarDatosDesdeNube();
    };

    window.removerResultadoEspecifico = async (itemCompleto) => {
        if (!confirm(`¿Eliminar resultado "${itemCompleto}"?`)) return;
        const juego = document.getElementById('select-juego-admin').value;
        let listaArray = resultadosActuales.split(',').filter(x => x.trim() !== "");
        const index = listaArray.indexOf(itemCompleto);
        if (index > -1) {
            listaArray.splice(index, 1);
            const { error } = await _supabase.from('resultados').update({ numeros: listaArray.join(',') }).eq('juego', juego);
            if (error) alert("Error: " + error.message);
            else cargarDatosDesdeNube();
        }
    };

    window.eliminarJugada = async (id) => {
        if (confirm("¿Eliminar definitivamente esta jugada?")) {
            await _supabase.from('jugadas').delete().eq('id', id);
            cargarDatosDesdeNube();
        }
    };

    // --- 5. CARGA Y RENDERIZADO ---
    async function cargarDatosDesdeNube() {
        const juegoActivo = document.getElementById('select-juego-admin').value;
        actualizarOpcionesSorteo(juegoActivo);
        ajustarInterfazFinanzas(juegoActivo);

        try {
            const { data: p } = await _supabase.from('jugadas').select('*').eq('juego', juegoActivo).order('id', { ascending: true });
            const { data: r } = await _supabase.from('resultados').select('*').eq('juego', juegoActivo).maybeSingle();
            const { data: f } = await _supabase.from('finanzas').select('*').eq('juego', juegoActivo).maybeSingle();

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
            }
            renderizarListas();
        } catch (e) { console.error(e); }
    }

    function ajustarInterfazFinanzas(juego) {
        const contAcumu2 = document.getElementById('container-acumu2');
        const cardDomingo = document.getElementById('card-domingo');
        const labelCasa = document.getElementById('label-porcentaje-casa');
        if (juego === 'mini') {
            if (contAcumu2) contAcumu2.style.display = 'none';
            if (cardDomingo) cardDomingo.style.display = 'none';
            if (labelCasa) labelCasa.textContent = "25% CASA";
        } else {
            if (contAcumu2) contAcumu2.style.display = 'block';
            if (cardDomingo) cardDomingo.style.display = 'block';
            if (labelCasa) labelCasa.textContent = "20% CASA";
        }
    }

    function calcularPrevisualizacionFinanzas(recaudado, juego) {
        const montoRec = parseFloat(recaudado) || 0;
        const casaVal = document.getElementById('casa-valor');
        const domVal = document.getElementById('domingo-valor');
        if (!casaVal || !domVal) return;
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
        if(!selectSorteo) return;
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
        if(!listaPart) return;
        listaPart.innerHTML = '';
        const filtro = document.getElementById('input-buscar-participante').value.toLowerCase();

        participantes.filter(p => 
            p.nombre.toLowerCase().includes(filtro) || (p.refe && p.refe.toString().includes(filtro))
        ).forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="flex-grow:1;">
                    <strong>${p.nombre}</strong> (Refe: ${p.refe || 'N/A'})<br>
                    <small>${p.numeros_jugados}</small> 
                    ${p.notas_correccion ? '<br><i style="color:red; font-size: 11px;">'+p.notas_correccion+'</i>' : ''}
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-editar" onclick="editarParticipanteNube(${p.id}, '${p.nombre}', '${p.refe}', '${p.numeros_jugados}')">✏️</button>
                    <button class="btn-eliminar" onclick="eliminarJugada(${p.id})">🗑️</button>
                </div>`;
            listaPart.appendChild(li);
        });

        const listaRes = document.getElementById('lista-resultados');
        if(!listaRes) return;
        listaRes.innerHTML = resultadosActuales ? 
            resultadosActuales.split(',').filter(x => x.trim() !== "").map(n => `
                <li>
                    <span>${n}</span>
                    <button class="btn-eliminar" onclick="removerResultadoEspecifico('${n}')">×</button>
                </li>`).join('') : "<li>Sin resultados</li>";
    }

    // --- 6. GESTIÓN DE FORMULARIOS ---
    document.getElementById('btn-procesar-pegado').addEventListener('click', () => {
        const juego = document.getElementById('select-juego-admin').value;
        const tamaño = reglasJuegos[juego].tamaño;
        const raw = document.getElementById('input-paste-data').value;
        const lineas = raw.split('\n');
        let jugadas = [];
        let nombre = "CLIENTE", refe = "";

        lineas.forEach(l => {
            // Buscamos números o la letra O/00
            const m = l.match(/\b(\d{1,2}|O)\b/gi);
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
        alert("✅ Datos procesados al recuadro.");
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
        if (error) alert("Error: " + error.message);
        else { alert("✅ Finanzas actualizadas."); cargarDatosDesdeNube(); }
    });

    document.getElementById('form-participante').addEventListener('submit', async (e) => {
        e.preventDefault();
        const juego = document.getElementById('select-juego-admin').value;
        const tamaño = reglasJuegos[juego].tamaño;
        const jugadasRaw = document.getElementById('jugadas-procesadas').value.split('|').map(x => x.trim()).filter(x => x !== "");
        const nombreVal = document.getElementById('nombre').value.trim().toUpperCase();
        const refeVal = document.getElementById('refe').value.trim();

        if(!refeVal) return alert("El REFE es obligatorio");

        for (let j of jugadasRaw) {
            let proc = procesarYValidarJugada(j.split(','), nombreVal, tamaño);
            if (proc) {
                await _supabase.from('jugadas').insert([{
                    nombre: nombreVal, refe: refeVal, numeros_jugados: proc.numeros, juego: juego, notas_correccion: proc.nota
                }]);
            }
        }
        e.target.reset();
        document.getElementById('input-paste-data').value = "";
        cargarDatosDesdeNube();
    });

    document.getElementById('form-resultados').addEventListener('submit', async (e) => {
        e.preventDefault();
        const juego = document.getElementById('select-juego-admin').value;
        const horaSorteo = document.getElementById('sorteo-hora').value;
        const numRaw = document.getElementById('numero-ganador').value.trim();
        
        // REGLA APLICADA: 0 es O, 00 es 00
        let numFinal;
        if (numRaw === "0") {
            numFinal = "O";
        } else if (numRaw === "00") {
            numFinal = "00";
        } else {
            numFinal = numRaw.padStart(2, '0');
        }
        
        let nuevoItem = `${horaSorteo}: ${numFinal}`;
        let listaArray = resultadosActuales ? resultadosActuales.split(',').filter(x => x.trim() !== "") : [];
        listaArray.push(nuevoItem);
        
        const { error } = await _supabase.from('resultados').upsert({ juego: juego, numeros: listaArray.join(',') }, { onConflict: 'juego' });
        if (error) alert("Error: " + error.message);
        else { e.target.reset(); cargarDatosDesdeNube(); }
    });

    // --- 7. REINICIO CON DOBLE CANDADO ---
    document.getElementById('btn-reiniciar-datos').addEventListener('click', async () => {
        const juego = document.getElementById('select-juego-admin').value;
        const confirm1 = confirm(`⚠️ ATENCIÓN CRÍTICA:\n¿Borrar definitivamente TODOS los registros de ${juego.toUpperCase()}?`);
        
        if (confirm1) {
            const confirmTexto = prompt("Para confirmar la eliminación permanente, escribe la palabra: BORRAR");
            if (confirmTexto === "BORRAR") {
                await _supabase.from('jugadas').delete().eq('juego', juego);
                await _supabase.from('resultados').upsert({ juego: juego, numeros: "" }, { onConflict: 'juego' });
                alert("✅ Sistema reiniciado con éxito.");
                cargarDatosDesdeNube();
            } else {
                alert("❌ Palabra incorrecta. Acción cancelada.");
            }
        }
    });

    document.getElementById('input-buscar-participante').addEventListener('input', renderizarListas);
    document.getElementById('select-juego-admin').addEventListener('change', cargarDatosDesdeNube);
    
    verificarSesion();
});