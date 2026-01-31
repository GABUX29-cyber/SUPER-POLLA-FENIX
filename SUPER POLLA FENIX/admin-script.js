document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SEGURIDAD Y SESIÓN (Tus funciones originales) ---
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
    verificarSesion();

    // --- 2. CONFIGURACIÓN DE REGLAS POR JUEGO ---
    let participantes = [];
    let resultadosActuales = "";
    let finanzas = { ventas: 0, recaudado: 0.00, acumulado1: 0.00 };

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
            return (num === "00") ? "00" : (parseInt(num) === 0 ? "O" : num);
        });

        let avisos = [];
        if (numeros.length > tamañoRequerido) {
            while (numeros.length > tamañoRequerido) numeros.pop();
            avisos.push("Sobrante eliminado");
        }
        if (numeros.length < tamañoRequerido) {
            alert(`❌ Error en ${nombreParticipante}: Faltan números.`);
            return null;
        }

        // Lógica del 36 para duplicados
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

    // --- 4. CARGA Y RENDERIZADO ---
    async function cargarDatosDesdeNube() {
        const juegoActivo = document.getElementById('select-juego-admin').value;
        actualizarOpcionesSorteo(juegoActivo);

        try {
            const { data: p } = await _supabase.from('jugadas').select('*').eq('juego', juegoActivo);
            const { data: r } = await _supabase.from('resultados').select('*').eq('juego', juegoActivo).single();
            const { data: f } = await _supabase.from('finanzas').select('*').single();

            participantes = p || [];
            resultadosActuales = r ? r.numeros : "";
            if (f) finanzas = f;

            renderizarListas();
        } catch (e) { console.error(e); }
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
        // Render participantes
        const listaPart = document.getElementById('lista-participantes');
        listaPart.innerHTML = '';
        participantes.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<div><strong>${p.nombre}</strong><br><small>${p.numeros_jugados}</small></div>
                            <button onclick="eliminarJugada(${p.id})">🗑️</button>`;
            listaPart.appendChild(li);
        });

        // Render resultados actuales
        const listaRes = document.getElementById('lista-resultados');
        listaRes.innerHTML = resultadosActuales ? `<li>Ganadores: ${resultadosActuales}</li>` : "<li>Sin resultados</li>";
    }

    // --- 5. EVENTOS DE FORMULARIO ---
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
            } else if (l.toLowerCase().includes("refe")) refe = l.replace(/\D/g, "");
            else if (l.length > 3 && !refe) nombre = l.toUpperCase();
        });

        document.getElementById('nombre').value = nombre;
        document.getElementById('refe').value = refe;
        document.getElementById('jugadas-procesadas').value = jugadas.join(' | ');
    });

    document.getElementById('form-participante').addEventListener('submit', async (e) => {
        e.preventDefault();
        const juego = document.getElementById('select-juego-admin').value;
        const tamaño = reglasJuegos[juego].tamaño;
        const jugadasRaw = document.getElementById('jugadas-procesadas').value.split('|');

        for (let j of jugadasRaw) {
            let proc = procesarYValidarJugada(j.split(','), document.getElementById('nombre').value, tamaño);
            if (proc) {
                await _supabase.from('jugadas').insert([{
                    nombre: document.getElementById('nombre').value,
                    refe: document.getElementById('refe').value,
                    numeros_jugados: proc.numeros,
                    juego: juego,
                    notas_correccion: proc.nota
                }]);
            }
        }
        alert("Guardado");
        cargarDatosDesdeNube();
    });

    document.getElementById('form-resultados').addEventListener('submit', async (e) => {
        e.preventDefault();
        const juego = document.getElementById('select-juego-admin').value;
        const num = document.getElementById('numero-ganador').value.trim().padStart(2, '0');
        
        let nuevaLista = resultadosActuales ? `${resultadosActuales},${num}` : num;
        
        await _supabase.from('resultados').update({ numeros: nuevaLista }).eq('juego', juego);
        alert("Resultado agregado");
        cargarDatosDesdeNube();
    });

    // --- 6. REINICIO DE DATOS ---
    document.getElementById('btn-reiniciar-datos').addEventListener('click', async () => {
        const juego = document.getElementById('select-juego-admin').value;
        if (confirm(`¿BORRAR TODO EL JUEGO ${juego.toUpperCase()}?`)) {
            if (prompt("Escribe BORRAR") === "BORRAR") {
                await _supabase.from('jugadas').delete().eq('juego', juego);
                await _supabase.from('resultados').update({ numeros: "" }).eq('juego', juego);
                cargarDatosDesdeNube();
            }
        }
    });

    window.eliminarJugada = async (id) => {
        if (confirm("¿Eliminar?")) {
            await _supabase.from('jugadas').delete().eq('id', id);
            cargarDatosDesdeNube();
        }
    };

    document.getElementById('select-juego-admin').addEventListener('change', cargarDatosDesdeNube);
    verificarSesion();
});