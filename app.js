// Configuração e inicialização do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAfk7tS6Z39uYyHnbKlwY1O1zeOx74LlQg",
    authDomain: "banco-de-dados-d253e.firebaseapp.com",
    projectId: "banco-de-dados-d253e",
    storageBucket: "banco-de-dados-d253e.appspot.com",
    messagingSenderId: "1005413315224",
    appId: "1:1005413315224:web:c87d1dd951785ed4f656ed"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variáveis globais
let empresaSelecionada = null;
let servicoSelecionado = null;
let prestadorSelecionado = null;
let dataSelecionada = null;
let horarioSelecionado = null;
let documentoCliente = null;
let agendamentoExistente = null;
let agendamentoConfirmado = false;
let atendentes = [];
let servicosDisponiveis = [];

// Configurações padrão de horários
const horariosConfig = {
    duracaoAtendimento: 30,
    horarioAbertura: "08:00",
    horarioFechamento: "18:00",
    intervaloAtendimento: 15
};

// Inicializa o calendário
const calendar = flatpickr("#calendar-input", {
    locale: "pt",
    minDate: "today",
    dateFormat: "d/m/Y",
    disable: [date => date.getDay() === 0 || date.getDay() === 6],
    onChange: (selectedDates) => {
        dataSelecionada = selectedDates[0];
        document.getElementById('selected-date').textContent = formatarData(dataSelecionada);
        carregarHorariosDisponiveis();
    }
});

// Funções auxiliares
const formatarData = date => new Date(date).toLocaleDateString('pt-BR');
const formatarDataFirestore = date => new Date(date).toISOString().split('T')[0];

function mostrarErro(mensagem) {
    const el = document.getElementById('error-message');
    el.textContent = mensagem;
    el.style.display = 'block';
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

function esconderErro() {
    document.getElementById('error-message').style.display = 'none';
}

// Funções principais
function carregarDadosEmpresa() {
    const empresaId = new URLSearchParams(window.location.search).get('id');

    if (!empresaId) {
        mostrarErro("Nenhuma empresa selecionada. Volte e selecione uma empresa.");
        return;
    }

    // Primeiro tenta carregar com o prefixo "PI -"
    db.collection("usuarios").doc(`PI - ${empresaId}`).get()
        .then(doc => {
            if (doc.exists) {
                processarDadosEmpresa(doc);
            } else {
                // Se não encontrou com o prefixo, tenta sem o prefixo
                return db.collection("usuarios").doc(empresaId).get();
            }
        })
        .then(doc => {
            if (doc && doc.exists) {
                processarDadosEmpresa(doc);
            } else if (!empresaSelecionada) {
                mostrarErro("Empresa não encontrada.");
            }
        })
        .catch(err => {
            console.error("Erro ao carregar empresa:", err);
            mostrarErro("Erro ao carregar dados da empresa.");
        });
}

function processarDadosEmpresa(doc) {
    empresaSelecionada = { id: doc.id, ...doc.data() };
    document.getElementById('empresa-nome').textContent = empresaSelecionada.nomeFantasia || empresaSelecionada.nomeCompleto || "Empresa";

    // Verifica se é um documento com prefixo "PI -" e processa os dados específicos
    if (empresaSelecionada.id.startsWith("PI -")) {
        processarDadosPrestadorIndividual();
    } else {
        carregarServicosEAtendentes();
    }

    if (empresaSelecionada.horariosConfig) {
        Object.assign(horariosConfig, empresaSelecionada.horariosConfig);
    }
}

function processarDadosPrestadorIndividual() {
    // Processa serviços do prestador individual
    if (empresaSelecionada.servicos) {
        servicosDisponiveis = empresaSelecionada.servicos.split('/').map(s => s.trim()).filter(s => s.length > 0);
    } else if (empresaSelecionada.servico) {
        servicosDisponiveis = empresaSelecionada.servico.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    // Adiciona o próprio prestador como atendente para todos os serviços
    if (empresaSelecionada.nomeCompleto) {
        servicosDisponiveis.forEach(servico => {
            atendentes.push({
                nome: empresaSelecionada.nomeCompleto,
                servico: servico
            });
        });
    }

    // Processa horários específicos se existirem
    if (empresaSelecionada.horarios) {
        try {
            const horariosData = JSON.parse(empresaSelecionada.horarios);
            if (horariosData.horarioAbertura) horariosConfig.horarioAbertura = horariosData.horarioAbertura;
            if (horariosData.horarioFechamento) horariosConfig.horarioFechamento = horariosData.horarioFechamento;
            if (horariosData.duracaoAtendimento) horariosConfig.duracaoAtendimento = horariosData.duracaoAtendimento;
            if (horariosData.intervaloAtendimento) horariosConfig.intervaloAtendimento = horariosData.intervaloAtendimento;
        } catch (e) {
            console.error("Erro ao processar horários:", e);
        }
    }

    carregarSelectServicos();
}

function carregarServicosEAtendentes() {
    if (!empresaSelecionada) return;

    if (empresaSelecionada.servicoAtendente) {
        processarServicosAtendentes(empresaSelecionada.servicoAtendente);
    } else if (empresaSelecionada.atendentes) {
        processarAtendentes(empresaSelecionada.atendentes);
    } else if (empresaSelecionada.servico) {
        processarServicos(empresaSelecionada.servico);
    } else {
        mostrarErro("Esta empresa ainda não configurou seus serviços.");
        document.getElementById('servico').innerHTML = '<option value="">Nenhum serviço disponível</option>';
        return;
    }

    carregarSelectServicos();
}

function processarServicosAtendentes(dados) {
    const servicosMap = {};
    
    // Se os dados são um array (vindo do Firestore)
    if (Array.isArray(dados)) {
        dados.forEach(item => {
            const servico = item.servico;
            const atendente = item.atendente;
            
            if (!servicosMap[servico]) {
                servicosMap[servico] = new Set();
            }
            servicosMap[servico].add(atendente);
        });
    } 
    // Se os dados são uma string (formato antigo)
    else if (typeof dados === 'string') {
        const linhas = dados.split('\n').filter(linha => linha.trim() !== '');
        
        linhas.forEach(linha => {
            const partes = linha.split('-').map(p => p.trim());
            if (partes.length >= 2) {
                const servico = partes[0];
                const atendentes = partes[1].split(',').map(a => a.trim());
                
                if (!servicosMap[servico]) {
                    servicosMap[servico] = new Set();
                }
                
                atendentes.forEach(atendente => {
                    servicosMap[servico].add(atendente);
                });
            }
        });
    }

    // Convertemos o mapa em arrays para servicosDisponiveis e atendentes
    servicosDisponiveis = Object.keys(servicosMap).sort((a, b) => a.localeCompare(b));
    
    atendentes = [];
    servicosDisponiveis.forEach(servico => {
        Array.from(servicosMap[servico]).forEach(nome => {
            atendentes.push({ nome, servico });
        });
    });
}

function processarAtendentes(dados) {
    const servicosMap = {};
    const regex = /\(([^)]+)\)\s*-\s*(\[[^\]]+\](?:\s*\[[^\]]+\])*)/g;
    let match;

    while ((match = regex.exec(dados)) !== null) {
        const nomePrestador = match[1].trim();
        const servicos = match[2].match(/\[([^\]]+)\]/g).map(s => s.replace(/[\[\]]/g, '').trim());

        servicos.forEach(servico => {
            if (!servicosMap[servico]) {
                servicosMap[servico] = new Set();
            }
            servicosMap[servico].add(nomePrestador);
        });
    }

    // Convertemos o mapa em arrays para servicosDisponiveis e atendentes
    servicosDisponiveis = Object.keys(servicosMap).sort((a, b) => a.localeCompare(b));
    
    atendentes = [];
    servicosDisponiveis.forEach(servico => {
        Array.from(servicosMap[servico]).forEach(nome => {
            atendentes.push({ nome, servico });
        });
    });
}

function processarServicos(dados) {
    // Para serviços sem atendentes específicos, apenas listamos os serviços únicos
    servicosDisponiveis = typeof dados === 'string' 
        ? [...new Set(dados.split(/[\n,]/).map(s => s.trim()).filter(s => s.length > 0))]
        : [...new Set(dados)];

    servicosDisponiveis.sort((a, b) => a.localeCompare(b));
}

function carregarSelectServicos() {
    const servicoSelect = document.getElementById('servico');
    servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';

    if (servicosDisponiveis.length === 0) {
        servicoSelect.innerHTML = '<option value="">Nenhum serviço disponível</option>';
        return;
    }

    // Adiciona cada serviço único ao select
    servicosDisponiveis.forEach(servico => {
        servicoSelect.innerHTML += `<option value="${servico}">${servico}</option>`;
    });

    servicoSelect.addEventListener('change', function() {
        servicoSelecionado = this.value;
        atualizarPrestadores();
        if (dataSelecionada) carregarHorariosDisponiveis();
    });

    document.getElementById('prestador').addEventListener('change', function() {
        prestadorSelecionado = this.value;
        if (servicoSelecionado && dataSelecionada) carregarHorariosDisponiveis();
    });
}

function atualizarPrestadores() {
    const prestadorSelect = document.getElementById('prestador');
    prestadorSelect.innerHTML = '<option value="">Selecione um prestador</option>';
    prestadorSelecionado = null;

    if (!servicoSelecionado || atendentes.length === 0) {
        document.getElementById('prestador-group').style.display = 'none';
        return;
    }

    // Filtra atendentes para o serviço selecionado e remove duplicatas
    const prestadores = [...new Set(
        atendentes
            .filter(a => a.servico === servicoSelecionado)
            .map(a => a.nome)
    )].sort((a, b) => a.localeCompare(b));

    if (prestadores.length > 0) {
        prestadores.forEach(nome => {
            prestadorSelect.innerHTML += `<option value="${nome}">${nome}</option>`;
        });

        document.getElementById('prestador-group').style.display = 'block';
        if (prestadores.length === 1) {
            prestadorSelect.value = prestadores[0];
            prestadorSelecionado = prestadores[0];
        }
    } else {
        document.getElementById('prestador-group').style.display = 'none';
    }
}

function verificarAgendamentoExistente(documento) {
    const documentoLimpo = documento.replace(/\D/g, '');

    if (!empresaSelecionada || !documentoLimpo) return;

    // Verifica na coleção principal (sem PI -)
    const empresaId = empresaSelecionada.id.startsWith("PI -") 
        ? empresaSelecionada.id.replace("PI - ", "")
        : empresaSelecionada.id;

    // Primeiro verifica na coleção com PI -
    db.collection("usuarios").doc(empresaSelecionada.id)
        .collection("agendamentos")
        .where("clienteDocumento", "==", documentoLimpo)
        .where("status", "==", "confirmado")
        .get()
        .then(querySnapshot => {
            if (!querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    agendamentoExistente = { id: doc.id, ...doc.data() };
                    exibirAgendamentoExistente(agendamentoExistente);
                });
            } else if (!empresaSelecionada.id.startsWith("PI -")) {
                // Se não encontrou e não é PI -, verifica na coleção sem PI -
                return db.collection("usuarios").doc(empresaId)
                    .collection("agendamentos")
                    .where("clienteDocumento", "==", documentoLimpo)
                    .where("status", "==", "confirmado")
                    .get();
            } else {
                document.getElementById('info-agendamento-existente').style.display = 'none';
                document.getElementById('formulario-agendamento').style.display = 'block';
            }
        })
        .then(querySnapshot => {
            if (querySnapshot && !querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    agendamentoExistente = { id: doc.id, ...doc.data() };
                    exibirAgendamentoExistente(agendamentoExistente);
                });
            } else {
                document.getElementById('info-agendamento-existente').style.display = 'none';
                document.getElementById('formulario-agendamento').style.display = 'block';
            }
        })
        .catch(err => {
            console.error("Erro ao verificar agendamento:", err);
            document.getElementById('info-agendamento-existente').style.display = 'none';
            document.getElementById('formulario-agendamento').style.display = 'block';
        });
}

function exibirAgendamentoExistente(agendamento) {
    const resumoDiv = document.getElementById('resumo-agendamento-existente');
    resumoDiv.innerHTML = `
        <p class="mb-2"><strong>Serviço:</strong> ${agendamento.servico}</p>
        ${agendamento.prestador ? `<p class="mb-2"><strong>Prestador:</strong> ${agendamento.prestador}</p>` : ''}
        <p class="mb-2"><strong>Data:</strong> ${formatarData(agendamento.data)}</p>
        <p class="mb-3"><strong>Horário:</strong> ${agendamento.horario}</p>
    `;

    document.getElementById('info-agendamento-existente').style.display = 'block';
    document.getElementById('formulario-agendamento').style.display = 'none';

    document.getElementById('btn-cancelar-agendamento').onclick = () => {
        if (confirm("Cancelar este agendamento?")) {
            cancelarAgendamentoExistente(agendamento.id);
        }
    };

    document.getElementById('btn-novo-agendamento').onclick = () => {
        document.getElementById('info-agendamento-existente').style.display = 'none';
        document.getElementById('formulario-agendamento').style.display = 'block';
        agendamentoExistente = null;
    };
}

function cancelarAgendamentoExistente(id) {
    const empresaRef = empresaSelecionada.id.startsWith("PI -")
        ? db.collection("usuarios").doc(empresaSelecionada.id)
        : db.collection("usuarios").doc(empresaSelecionada.id.replace("PI - ", ""));

    empresaRef.collection("agendamentos")
        .doc(id)
        .update({ status: "cancelado" })
        .then(() => {
            alert("Agendamento cancelado!");
            document.getElementById('info-agendamento-existente').style.display = 'none';
            document.getElementById('formulario-agendamento').style.display = 'block';
            agendamentoExistente = null;
        })
        .catch(err => {
            console.error("Erro ao cancelar:", err);
            mostrarErro("Erro ao cancelar agendamento.");
        });
}

function calcularHorariosDisponiveis() {
    const horarios = [];
    const toMinutes = timeStr => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const toTimeStr = minutes => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const inicio = toMinutes(horariosConfig.horarioAbertura);
    const fim = toMinutes(horariosConfig.horarioFechamento);
    const duracao = horariosConfig.duracaoAtendimento;
    const intervalo = horariosConfig.intervaloAtendimento;
    const totalPorAtendimento = duracao + intervalo;

    for (let time = inicio; time + duracao <= fim; time += totalPorAtendimento) {
        horarios.push(toTimeStr(time));
    }

    return horarios;
}

function carregarHorariosDisponiveis() {
    if (!empresaSelecionada || !dataSelecionada || !servicoSelecionado) return;

    const container = document.getElementById('horarios-container');
    container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" style="width: 3rem; height: 3rem;"></div><p class="mt-3">Carregando...</p></div>';

    document.getElementById('horario-section').style.display = 'block';
    document.getElementById('dados-section').style.display = 'none';
    document.getElementById('btn-confirmar').style.display = 'none';

    const dataFormatada = formatarDataFirestore(dataSelecionada);
    const hojeFormatado = formatarDataFirestore(new Date());
    const isHoje = dataFormatada === hojeFormatado;
    const agora = new Date();

    const empresaRef = empresaSelecionada.id.startsWith("PI -")
        ? db.collection("usuarios").doc(empresaSelecionada.id)
        : db.collection("usuarios").doc(empresaSelecionada.id);

    let query = empresaRef.collection("agendamentos")
        .where("data", "==", dataFormatada)
        .where("servico", "==", servicoSelecionado)
        .where("status", "==", "confirmado");

    if (prestadorSelecionado) {
        query = query.where("prestador", "==", prestadorSelecionado);
    }

    query.get()
        .then(querySnapshot => {
            const horariosOcupados = querySnapshot.docs.map(doc => doc.data().horario);
            const horariosBase = calcularHorariosDisponiveis();

            const horariosDisponiveis = horariosBase.map(horario => {
                const [h, m] = horario.split(':').map(Number);
                const horarioValido = !isHoje || (h > agora.getHours() || (h === agora.getHours() && m > agora.getMinutes()));

                return {
                    horario,
                    disponivel: horarioValido && !horariosOcupados.includes(horario)
                };
            });

            exibirHorariosDisponiveis(horariosDisponiveis);
        })
        .catch(err => {
            console.error("Erro ao carregar horários:", err);
            container.innerHTML = '<div class="alert alert-danger">Erro ao carregar horários.</div>';
        });
}

function exibirHorariosDisponiveis(horarios) {
    const container = document.getElementById('horarios-container');
    container.innerHTML = '';

    if (horarios.length === 0) {
        container.innerHTML = '<div class="alert alert-danger">Nenhum horário disponível.</div>';
        return;
    }

    horarios.forEach(item => {
        const btn = document.createElement('button');
        btn.className = `time-slot ${item.disponivel ? '' : 'disabled'}`;
        btn.textContent = item.horario;
        btn.disabled = !item.disponivel;

        if (item.disponivel) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.time-slot').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                horarioSelecionado = item.horario;
                document.getElementById('dados-section').style.display = 'block';
                document.getElementById('btn-confirmar').style.display = 'block';

                setTimeout(() => {
                    document.getElementById('dados-section').scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }, 300);
            });
        }

        container.appendChild(btn);
    });
}

function preencherResumoAgendamento() {
    const nome = document.getElementById('nome').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const email = document.getElementById('email').value.trim();

    document.getElementById('resumo-empresa').textContent = empresaSelecionada.nomeFantasia || empresaSelecionada.nomeCompleto || "Empresa";
    document.getElementById('resumo-servico').textContent = servicoSelecionado;
    document.getElementById('resumo-prestador').textContent = prestadorSelecionado || "Não especificado";
    document.getElementById('resumo-data').textContent = formatarData(dataSelecionada);
    document.getElementById('resumo-horario').textContent = horarioSelecionado;
    document.getElementById('resumo-cliente').textContent = nome;
    document.getElementById('resumo-documento').textContent = documentoCliente;
    document.getElementById('resumo-contato').textContent = telefone + (email ? ` (${email})` : '');

    document.getElementById('formulario-agendamento').style.display = 'none';
    document.getElementById('resumo-agendamento').style.display = 'block';

    setTimeout(() => {
        document.getElementById('resumo-agendamento').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

function confirmarAgendamento() {
    if (agendamentoConfirmado) return;

    const nome = document.getElementById('nome').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const email = document.getElementById('email').value.trim();

    if (!nome || !telefone) {
        mostrarErro("Preencha todos os campos obrigatórios.");
        return;
    }

    const agendamento = {
        servico: servicoSelecionado,
        data: formatarDataFirestore(dataSelecionada),
        horario: horarioSelecionado,
        clienteNome: nome,
        clienteDocumento: documentoCliente.replace(/\D/g, ''),
        clienteTelefone: telefone,
        clienteEmail: email || '',
        status: "confirmado",
        dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (prestadorSelecionado) agendamento.prestador = prestadorSelecionado;

    const empresaRef = empresaSelecionada.id.startsWith("PI -")
        ? db.collection("usuarios").doc(empresaSelecionada.id)
        : db.collection("usuarios").doc(empresaSelecionada.id);

    empresaRef.collection("agendamentos")
        .add(agendamento)
        .then(() => {
            agendamentoConfirmado = true;
            preencherResumoAgendamento();
        })
        .catch(err => {
            console.error("Erro ao confirmar:", err);
            mostrarErro("Erro ao confirmar agendamento.");
        });
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarDadosEmpresa();

    document.getElementById('btn-confirmar').addEventListener('click', confirmarAgendamento);

    document.getElementById('documento').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');

        if (value.length <= 11) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else {
            value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }

        e.target.value = value.substring(0, value.length > 14 ? 18 : 14);
        documentoCliente = e.target.value;

        if (value.replace(/\D/g, '').length >= 11) {
            verificarAgendamentoExistente(documentoCliente);
        }
    });

    document.getElementById('telefone').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        e.target.value = value.substring(0, 15);
    });
});
