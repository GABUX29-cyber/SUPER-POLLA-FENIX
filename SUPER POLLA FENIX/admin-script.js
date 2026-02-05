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

    // --- 2. CONFIGURACIÓN DE REGLAS POR JUEGO (RESPETANDO TUS HORARIOS ORIGINALES) ---
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

    // --- 3. CEREBRO DE VALIDACIÓN GLOBAL (ERRORES Y CAMBIOS) ---
    function procesarYValidarJugada(numerosRaw, nombreParticipante, tamañoRequerido) {
        // Normalización inicial
        let numeros = numerosRaw.map(n => {
            let num = n.trim();
            if (num === "0") return "O";
            if (num === "00") return "00";
            if (num.length === 1 && !isNaN(num)) return num.padStart(2, '0');
            return num.toUpperCase();
        }).filter(n => n !== "");

        let avisos = [];

        // 1. Detectar Sobrantes (Cualquier número de más se elimina)
        if (numeros.length > tamañoRequerido) {
            let eliminados = [];
            while (numeros.length > tamañoRequerido) {
                eliminados.push(numeros.pop());
            }
            avisos.push(`Sobrante eliminado: (${eliminados.join(', ')})`);
        }

        // 2. Detectar Faltantes (Error crítico - No permite guardar)
        if (numeros.length < tamañoRequerido) {
            alert(`❌ ERROR CRÍTICO EN ${nombreParticipante}:\nLa jugada solo tiene ${numeros.length} números. Se requieren ${tamañoRequerido}. Corrija antes de guardar.`);
            return null;
        }

        // 3. Detectar Duplicados
        let counts = {};
        let duplicadosEncontrados = [];
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
                    avisos.push(`Duplicado (${dup}) reemplazado por 36`);
                } else {
                    sePudoCorregir = false;
                }
            });

            if (!sePudoCorregir) {
                alert(`🚫 JUGADA NULA (${nombreParticipante}):\nHay duplicados y el número de emergencia (36) ya existe en la jugada.`);
                return null;
            }
        }

        // MOSTRAR RESUMEN DE CAMBIOS SI EXISTE CUALQUIERA
        if (avisos.length > 0) {
            alert(`📝 CAMBIOS AUTOMÁTICOS EN ${nombreParticipante}:\n\n${avisos.map(a => "• " + a).join('\n')}`);
        }

        return { 
            numeros: numeros.join(','), 
            nota: avisos.length > 0 ? `📝 Auto-corrección: ${avisos.join('. ')}` : "" 
        };
    }

    // --- 4. FUNCIONES DE EDICIÓN Y ELIMINACIÓN ---
    window.editarParticipanteNube = async (id, nombreAct, refeAct, jugadasAct) => {
        const nuevoNombre = prompt("Nombre/Alias:", nombreAct);
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

    // EDITAR RESULTADO INDIVIDUAL
    window.editarResultadoEspecifico = async (itemCompleto) => {
        const partes = itemCompleto.split(':');
        const sorteoInfo = partes[0].trim();
        const valorActual = partes[1].trim();
        
        const nuevoValor = prompt(`Editar resultado para ${sorteoInfo}:`, valorActual);
        if (nuevoValor === null || nuevoValor.trim() === "") return;

        let numFinal = nuevoValor === "0" ? "O" : (nuevoValor === "00" ? "00" : nuevoValor.padStart(2, '0'));

        const juego = document.getElementById('select-juego-admin').value;
        let listaArray = resultadosActuales.split(',').filter(x => x.trim() !== "");
        const index = listaArray.indexOf(itemCompleto);
        
        if (index > -1) {
            listaArray[index] = `${sorteoInfo}: ${numFinal}`;
            await _supabase.from('resultados').update({ numeros: listaArray.join(',') }).eq('juego', juego);
            cargarDatosDesdeNube();
        }
    };

    window.removerResultadoEspecifico = async (itemCompleto) => {
        if (!confirm(`¿Eliminar resultado "${itemCompleto}"?`)) return;
        const juego = document.getElementById('select-juego-admin').value;
        let listaArray = resultadosActuales.split(',').filter(x => x.trim() !== "");
        const index = listaArray.indexOf(itemCompleto);
        if (index > -1) {
            listaArray.splice(index, 1);
            await _supabase.from('resultados').update({ numeros: listaArray.join(',') }).eq('juego', juego);
            cargarDatosDesdeNube();
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
            const { data: p, count: conteoReal } = await _supabase.from('jugadas').select('*', { count: 'exact' }).eq('juego', juegoActivo).order('nro_ticket', { ascending: true });
            const { data: r } = await _supabase.from('resultados').select('*').eq('juego', juegoActivo).maybeSingle();
            const { data: f } = await _supabase.from('finanzas').select('*').eq('juego', juegoActivo).maybeSingle();

            participantes = p || [];
            resultadosActuales = r ? r.numeros : ""; 
            
            document.getElementById('input-ventas').value = conteoReal || 0;

            if (f) {
                finanzas = f;
                document.getElementById('input-recaudado').value = f.recaudado || 0;
                document.getElementById('input-acumulado1').value = f.acumulado1 || 0;
                if (document.getElementById('input-acumulado2')) {
                    document.getElementById('input-acumulado2').value = f.acumulado2 || 0;
                }
                calcularPrevisualizacionFinanzas(f.recaudado, juegoActivo);
            } else {
                document.getElementById('input-recaudado').value = 0;
                document.getElementById('input-acumulado1').value = 0;
                if (document.getElementById('input-acumulado2')) document.getElementById('input-acumulado2').value = 0;
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
        const labelAcumu2 = document.getElementById('label-acumu2');
        
        const tituloPrincipal = document.getElementById('titulo-principal');
        const subtituloAdmin = document.getElementById('subtitulo-admin'); 
        const footerCopy = document.getElementById('footer-copy');

        const nombresJuego = {
            'dia': 'SUPER POLLA FENIX (DIA)',
            'tarde': 'SUPER POLLA FENIX (TARDE)',
            'mini': 'MINI EXPRES FENIX'
        };

        const nombreActual = nombresJuego[juego] || 'SUPER POLLA FENIX';

        if (tituloPrincipal) tituloPrincipal.textContent = `PANEL DE ADMINISTRACIÓN - ${nombreActual}`;
        
        if (subtituloAdmin) {
            subtituloAdmin.textContent = "Gestión de Resultados y Participantes";
        } else {
            const subPorTag = document.querySelector('.admin-header p');
            if (subPorTag) subPorTag.textContent = "Gestión de Resultados y Participantes";
        }

        if (footerCopy) footerCopy.textContent = `© 2026 ${nombreActual} - Sistema Profesional de Gestión de Resultados.`;

        if (juego === 'mini') {
            if (contAcumu2) contAcumu2.style.display = 'none';
            if (cardDomingo) cardDomingo.style.display = 'none';
            if (labelCasa) labelCasa.textContent = "25% CASA";
            if (labelAcumu1) labelAcumu1.textContent = "Acumulado Día Anterior:";
        } else {
            if (contAcumu2) contAcumu2.style.display = 'block';
            if (cardDomingo) cardDomingo.style.display = 'block';
            if (labelCasa) labelCasa.textContent = "20% CASA";
            if (labelAcumu1) labelAcumu1.textContent = "Acumulado Primer Premio:";
            if (labelAcumu2) labelAcumu2.textContent = "Acumulado Segundo Premio:";
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
        selectSorteo.innerHTML = '<option value="">Seleccione Sorteo</option>';
        const conf = reglasJuegos[juego];
        
        conf.ruletas.forEach(r => {
            let grupo = document.createElement('optgroup');
            grupo.label = r;
            conf.horarios.forEach(h => {
                let opt = document.createElement('option');
                opt.value = `${r} ${h}`;
                opt.textContent = h;
                grupo.appendChild(opt);
            });
            selectSorteo.appendChild(grupo);
        });
    }

    function renderizarListas() {
        const listaPart = document.getElementById('lista-participantes');
        if(listaPart) {
            const filtro = document.getElementById('input-buscar-participante').value.toLowerCase();
            listaPart.innerHTML = participantes.filter(p => 
                p.nombre.toLowerCase().includes(filtro) || (p.refe && p.refe.toString().includes(filtro))
            ).map(p => `
                <li style="display: flex; justify-content: space-between; align-items: center; background: white; margin-bottom: 10px; padding: 15px; border-radius: 8px; border-left: 5px solid #ffc107; box-shadow: 0 2px 5px rgba(0,0,0,0.1); width: 100%; box-sizing: border-box;">
                    <div style="flex-grow:1;">
                        <strong>#${p.nro_ticket} - ${p.nombre}</strong> (Refe: ${p.refe || 'N/A'})<br>
                        <span style="font-weight: bold; color: #333;">${p.numeros_jugados}</span>
                        ${p.notas_correccion ? `<br><small style="color: #dc3545; font-weight: bold; font-size: 0.85em;">${p.notas_correccion}</small>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button style="background:#ffc107; color:black; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="editarParticipanteNube(${p.id}, '${p.nombre}', '${p.refe}', '${p.numeros_jugados}')">Editar</button>
                        <button style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="eliminarJugada(${p.id})">Eliminar</button>
                    </div>
                </li>`).join('');
        }

        const listaRes = document.getElementById('lista-resultados');
        if(listaRes) {
            if (!resultadosActuales || resultadosActuales.trim() === "") {
                listaRes.innerHTML = "<li style='text-align:center; color:#999; width: 100%;'>Sin resultados</li>";
            } else {
                listaRes.innerHTML = resultadosActuales.split(',').filter(x => x.trim() !== "").map(n => `
                    <li style="display: flex; justify-content: space-between; align-items: center; background: white; margin-bottom: 10px; padding: 15px; border-radius: 8px; border-left: 5px solid #ffc107; box-shadow: 0 2px 5px rgba(0,0,0,0.1); width: 100%; box-sizing: border-box;">
                        <span style="font-weight: bold; color: #333; font-size: 15px;">${n}</span>
                        <div style="display: flex; gap: 10px;">
                            <button style="background:#ffc107; color:#212529; border:none; padding:6px 15px; border-radius:5px; font-weight:bold; cursor:pointer; font-size:13px;" onclick="editarResultadoEspecifico('${n}')">Editar</button>
                            <button style="background:#dc3545; color:white; border:none; padding:6px 15px; border-radius:5px; font-weight:bold; cursor:pointer; font-size:13px;" onclick="removerResultadoEspecifico('${n}')">Eliminar</button>
                        </div>
                    </li>`).join('');
            }
        }
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

        const { data: ultimas } = await _supabase.from('jugadas').select('nro_ticket').eq('juego', juego).order('nro_ticket', { ascending: false }).limit(1);
        let proximoTicket = ultimas && ultimas.length > 0 ? ultimas[0].nro_ticket + 1 : 1;

        for (let j of jugadasRaw) {
            let proc = procesarYValidarJugada(j.split(','), nombreVal, tamaño);
            if (proc) {
                await _supabase.from('jugadas').insert([{
                    nombre: nombreVal, 
                    refe: refeVal, 
                    numeros_jugados: proc.numeros, 
                    juego: juego, 
                    notas_correccion: proc.nota, 
                    nro_ticket: proximoTicket
                }]);
                proximoTicket++;
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

        if(!horaSorteo) return alert("Seleccione un sorteo");
        
        let listaArray = resultadosActuales ? resultadosActuales.split(',').filter(x => x.trim() !== "") : [];
        
        const yaExiste = listaArray.some(item => item.startsWith(horaSorteo + ":"));
        if (yaExiste) {
            alert(`🚫 Ya ingresaste un resultado para ${horaSorteo}. \n\nPara cambiarlo, búscalo abajo y dale a Editar o Eliminar.`);
            return;
        }

        let numFinal = numRaw === "0" ? "O" : (numRaw === "00" ? "00" : numRaw.padStart(2, '0'));
        listaArray.push(`${horaSorteo}: ${numFinal}`);
        
        const { error } = await _supabase.from('resultados').upsert({ juego: juego, numeros: listaArray.join(',') }, { onConflict: 'juego' });
        if (error) alert("Error: " + error.message);
        else { e.target.reset(); cargarDatosDesdeNube(); }
    });

    document.getElementById('btn-reiniciar-datos').addEventListener('click', async () => {
        const juego = document.getElementById('select-juego-admin').value;
        if (confirm(`¿Borrar definitivamente TODOS los registros de ${juego.toUpperCase()}?`)) {
            if (prompt("Escribe BORRAR para confirmar") === "BORRAR") {
                await _supabase.from('jugadas').delete().eq('juego', juego);
                await _supabase.from('resultados').upsert({ juego: juego, numeros: "" }, { onConflict: 'juego' });
                cargarDatosDesdeNube();
            }
        }
    });

    document.getElementById('input-buscar-participante').addEventListener('input', renderizarListas);
    document.getElementById('select-juego-admin').addEventListener('change', cargarDatosDesdeNube);
    
    verificarSesion();
});