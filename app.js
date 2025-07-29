// app.js - Código completo para o sistema de agendamento

// Configuração do Firebase (repetida aqui para garantir disponibilidade)
if (!firebase.apps.length) {
    const firebaseConfig = {
        apiKey: "AIzaSyAfk7tS6Z39uYyHnbKlwY1O1zeOx74LlQg",
        authDomain: "banco-de-dados-d253e.firebaseapp.com",
        projectId: "banco-de-dados-d253e",
        storageBucket: "banco-de-dados-d253e.appspot.com",
        messagingSenderId: "1005413315224",
        appId: "1:1005413315224:web:c87d1dd951785ed4f656ed"
    };
    firebase.initializeApp(firebaseConfig);
}

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

// Funções auxiliares
function formatarData(date) {
    return date.toLocaleDateString('pt-BR');
}

function formatarDataFirestore(date) {
    return date.toISOString().split('T')[0];
}

function mostrarErro(mensagem) {
    const el = document.getElementById('error-message');
    el.textContent = mensagem;
    el.style.display = 'block';
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

function esconderErro() {
    document.getElementById('error-message').style.display = 'none';
}

// Função principal para carregar dados da empresa ou prestador individual
function carregarDadosEmpresa() {
    const empresaId = new URLSearchParams(window.location.search).get('id');
    
    if (!empresaId) {
        mostrarErro("Nenhuma empresa selecionada. Volte e selecione uma empresa.");
        return;
    }
    
    // Verifica se é um prestador individual (ID começa com "PI - ")
    if (empresaId.startsWith("PI - ")) {
        carregarDadosPrestadorIndividual(empresaId);
    } else {
        carregarDadosEmpresaRegular(empresaId);
    }
}

// Carrega dados de um prestador individual
function carregarDadosPrestadorIndividual(empresaId) {
    const piId = empresaId.replace("PI - ", "");
    
    db.collection("usuarios").doc(piId).get()
        .then(doc => {
            if (!doc.exists) {
                mostrarErro("Prestador individual não encontrado.");
                return;
            }
            
            empresaSelecionada = {
                ...doc.data(),
                id: empresaId,
                originalId: piId,
                isPI: true
            };
            
            document.getElementById('empresa-nome').textContent = 
                empresaSelecionada.nomeCompleto || empresaSelecionada.nomeFantasia || "Prestador Individual";
            
            // Configurações específicas do PI
            if (empresaSelecionada.horariosConfig) {
                Object.assign(horariosConfig, empresaSelecionada.horariosConfig);
            }
            
            // Carrega serviços e atendentes do PI
            carregarServicosEAtendentesPI();
        })
        .catch(err => {
            console.error("Erro ao carregar PI:", err);
            mostrarErro("Erro ao carregar dados do prestador individual.");
        });
}

// Carrega dados de uma empresa regular
function carregarDadosEmpresaRegular(empresaId) {
    db.collection("usuarios").doc(empresaId).get()
        .then(doc => {
            if (!doc.exists) {
                mostrarErro("Empresa não encontrada.");
                return;
            }
            
            empresaSelecionada = {
                ...doc.data(),
                id: doc.id,
                isPI: false
            };
            
            document.getElementById('empresa-nome').textContent = 
                empresaSelecionada.nomeFantasia || empresaSelecionada.nomeCompleto || "Empresa";
            
            if (empresaSelecionada.horariosConfig) {
                Object.assign(horariosConfig, empresaSelecionada.horariosConfig);
            }
            
            carregarServicosEAtendentes();
        })
        .catch(err => {
            console.error("Erro ao carregar empresa:", err);
            mostrarErro("Erro ao carregar dados da empresa.");
        });
}

// Carrega serviços e atendentes para um prestador individual
function carregarServicosEAtendentesPI() {
    servicosDisponiveis = [];
    atendentes = [];
    
    // Processa serviços do PI
    if (empresaSelecionada.servicos) {
        servicosDisponiveis = empresaSelecionada.servicos.split('/')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    } else if (empresaSelecionada.servico) {
        servicosDisponiveis = empresaSelecionada.servico.split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }
    
    // Adiciona o próprio PI como atendente para todos os serviços
    if (empresaSelecionada.nomeCompleto) {
        servicosDisponiveis.forEach(servico => {
            atendentes.push({
                nome: empresaSelecionada.nomeCompleto,
                servico: servico,
                isPI: true
            });
        });
    }
    
    carregarSelectServicos();
}

// Carrega serviços e atendentes para uma empresa regular
function carregarServicosEAtendentes() {
    servicosDisponiveis = [];
    atendentes = [];
    
    // Processa dados da empresa
    if (empresaSelecionada.servicoAtendente) {
        processarServicosAtendentes(empresaSelecionada.servicoAtendente);
    } else if (empresaSelecionada.atendentes) {
        processarAtendentes(empresaSelecionada.atendentes);
    } else if (empresaSelecionada.servico) {
        processarServicos(empresaSelecionada.servico);
    }
    
    carregarSelectServicos();
}

function processarServicosAtendentes(dados) {
    if (typeof dados === 'string') {
        dados.split('\n').filter(linha => linha.trim() !== '').forEach(linha => {
            const partes = linha.split('-').map(p => p.trim());
            if (partes.length === 2) {
                const servico = partes[0];
                const nomesAtendentes = partes[1].split(',').map(n => n.trim());
                
                if (!servicosDisponiveis.includes(servico)) servicosDisponiveis.push(servico);
                
                nomesAtendentes.forEach(nome => {
                    atendentes.push({ nome, servico, isPI: false });
                });
            }
        });
    } else if (Array.isArray(dados)) {
        dados.forEach(item => {
            if (item.servico && item.atendentes) {
                if (!servicosDisponiveis.includes(item.servico)) servicosDisponiveis.push(item.servico);
                
                item.atendentes.forEach(nome => {
                    atendentes.push({ nome, servico: item.servico, isPI: false });
                });
            }
        });
    }
    
    servicosDisponiveis.sort((a, b) => a.localeCompare(b));
}

function processarAtendentes(dados) {
    if (typeof dados === 'string') {
        const regex = /\(([^)]+)\)\s*-\s*(\[[^\]]+\](?:\s*\[[^\]]+\])*)/g;
        let match;
        
        while ((match = regex.exec(dados)) !== null) {
            const nomePrestador = match[1].trim();
            const servicos = match[2].match(/\[([^\]]+)\]/g).map(s => s.replace(/[\[\]]/g, '').trim());
            
            servicos.forEach(servico => {
                atendentes.push({ nome: nomePrestador, servico, isPI: false });
                if (!servicosDisponiveis.includes(servico)) servicosDisponiveis.push(servico);
            });
        }
    } else if (Array.isArray(dados)) {
        dados.forEach(item => {
            if (item.nome && item.servicos) {
                item.servicos.forEach(servico => {
                    atendentes.push({ nome: item.nome, servico, isPI: false });
                    if (!servicosDisponiveis.includes(servico)) servicosDisponiveis.push(servico);
                });
            }
        });
    }
}

function processarServicos(dados) {
    const novosServicos = typeof dados === 'string' 
        ? dados.split(/[\n,]/).map(s => s.trim()).filter(s => s.length > 0)
        : [...dados];
    
    servicosDisponiveis = [...new Set([...servicosDisponiveis, ...novosServicos])];
    servicosDisponiveis.sort((a, b) => a.localeCompare(b));
}

function carregarSelectServicos() {
    const servicoSelect = document.getElementById('servico');
    servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';
    
    if (servicosDisponiveis.length === 0) {
        servicoSelect.innerHTML = '<option value="">Nenhum serviço disponível</option>';
        return;
    }
    
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
    
    if (!documentoLimpo || !empresaSelecionada) return;
    
    // Para PIs, usa o originalId (sem o "PI - ")
    const empresaId = empresaSelecionada.isPI 
        ? (empresaSelecionada.originalId || empresaSelecionada.id.replace("PI - ", ""))
        : empresaSelecionada.id;
    
    db.collection("usuarios").doc(empresaId)
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
        <p class="mb-2"><strong>Data:</strong> ${formatarData(new Date(agendamento.data))}</p>
        <p class="mb-3"><strong>Horário:</strong> ${agendamento.horario}</p>
    `;
    
    document.getElementById('info-agendamento-existente').style.display = 'block';
    document.getElementById('formulario-agendamento').style.display = 'none';
    
    document.getElementById('btn-cancelar-agendamento').onclick = () => {
        if (confirm("Cancelar este agendamento?")) {
            cancelarAgendamentoExistente(agendamento);
        }
    };
    
    document.getElementById('btn-novo-agendamento').onclick = () => {
        document.getElementById('info-agendamento-existente').style.display = 'none';
        document.getElementById('formulario-agendamento').style.display = 'block';
        agendamentoExistente = null;
    };
}

function cancelarAgendamentoExistente(agendamento) {
    const empresaId = empresaSelecionada.isPI 
        ? (empresaSelecionada.originalId || empresaSelecionada.id.replace("PI - ", ""))
        : empresaSelecionada.id;
    
    db.collection("usuarios").doc(empresaId)
        .collection("agendamentos")
        .doc(agendamento.id)
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
    
    const query = db.collection("usuarios").doc(empresaSelecionada.isPI 
        ? (empresaSelecionada.originalId || empresaSelecionada.id.replace("PI - ", ""))
        : empresaSelecionada.id)
        .collection("agendamentos")
        .where("data", "==", dataFormatada)
        .where("servico", "==", servicoSelecionado)
        .where("status", "==", "confirmado");
    
    if (prestadorSelecionado) {
        query.where("prestador", "==", prestadorSelecionado);
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
    
    const resumoPrestadorContainer = document.getElementById('resumo-prestador-container');
    if (prestadorSelecionado) {
        document.getElementById('resumo-prestador').textContent = prestadorSelecionado;
        resumoPrestadorContainer.style.display = 'block';
    } else {
        resumoPrestadorContainer.style.display = 'none';
    }
    
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
    
    if (prestadorSelecionado) {
        agendamento.prestador = prestadorSelecionado;
    }
    
    // Determina o ID correto da empresa (remove "PI - " se necessário)
    const empresaId = empresaSelecionada.isPI 
        ? (empresaSelecionada.originalId || empresaSelecionada.id.replace("PI - ", ""))
        : empresaSelecionada.id;
    
    db.collection("usuarios").doc(empresaId)
        .collection("agendamentos")
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

// Inicialização dos event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Configura o input de CPF/CNPJ
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
    
    // Configura o input de telefone
    document.getElementById('telefone').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        e.target.value = value.substring(0, 15);
    });
    
    // Configura o botão de confirmar
    document.getElementById('btn-confirmar').addEventListener('click', confirmarAgendamento);
    
    // Inicia o carregamento dos dados
    carregarDadosEmpresa();
});
