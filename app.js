// Configuração e inicialização do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAfk7tS6Z39uYyHnbKlwY1O1zeOx74LlQg",
    authDomain: "banco-de-dados-d253e.firebaseapp.com",
    projectId: "banco-de-dados-d253e",
    storageBucket: "banco-de-dados-d253e.appspot.com",
    messagingSenderId: "1005413315224",
    appId: "1:1005413315224:web:c87d1dd951785ed4f656ed"
};

// Inicializa o Firebase se ainda não foi inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// Variáveis globais
let empresaSelecionada = null;
let servicoAtendenteSelecionado = null;
let servicoSelecionado = null;
let atendenteSelecionado = null;
let dataSelecionada = null;
let horarioSelecionado = null;
let documentoCliente = null;
let agendamentoExistente = null;
let agendamentoConfirmado = false;
let atendentes = [];
let servicosDisponiveis = [];
let calendar = null;

// Configurações padrão de horários
const horariosConfig = {
    duracaoAtendimento: 30,
    horarioAbertura: "08:00",
    horarioFechamento: "18:00",
    intervaloAtendimento: 15
};

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
            
            // Processa os serviços e atendentes do PI
            processarServicosAtendentesPI(empresaSelecionada);
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
            
            // Processa os serviços e atendentes da empresa regular
            processarServicosAtendentesEmpresa(empresaSelecionada);
        })
        .catch(err => {
            console.error("Erro ao carregar empresa:", err);
            mostrarErro("Erro ao carregar dados da empresa.");
        });
}

function processarServicosAtendentesPI(dadosPI) {
    servicosDisponiveis = [];
    atendentes = [];
    
    // Caso 1: servicoAtendente é um array de objetos {servico, atendentes}
    if (Array.isArray(dadosPI.servicoAtendente)) {
        dadosPI.servicoAtendente.forEach(item => {
            if (item && typeof item === 'object' && item.servico && item.atendentes) {
                const servico = item.servico.trim();
                if (!servicosDisponiveis.includes(servico)) {
                    servicosDisponiveis.push(servico);
                }
                
                // Processa os atendentes que podem ser string ou array
                let listaAtendentes = [];
                
                if (Array.isArray(item.atendentes)) {
                    listaAtendentes = item.atendentes;
                } else if (typeof item.atendentes === 'string') {
                    // Tenta parsear se for JSON string
                    try {
                        listaAtendentes = JSON.parse(item.atendentes);
                        if (!Array.isArray(listaAtendentes)) {
                            listaAtendentes = [item.atendentes];
                        }
                    } catch (e) {
                        // Se não for JSON, trata como string simples
                        listaAtendentes = item.atendentes.split(',').map(a => a.trim());
                    }
                }
                
                listaAtendentes.forEach(atendente => {
                    if (atendente && atendente.trim() !== '') {
                        atendentes.push({
                            nome: atendente.trim(),
                            servico: servico,
                            isPI: true
                        });
                    }
                });
            }
        });
    } 
    // Caso 2: servicoAtendente é um objeto (pode acontecer em algumas estruturas)
    else if (dadosPI.servicoAtendente && typeof dadosPI.servicoAtendente === 'object' && !Array.isArray(dadosPI.servicoAtendente)) {
        // Converte o objeto em array
        const servicoAtendenteArray = Object.values(dadosPI.servicoAtendente);
        servicoAtendenteArray.forEach(item => {
            if (item && typeof item === 'object' && item.servico && item.atendentes) {
                const servico = item.servico.trim();
                if (!servicosDisponiveis.includes(servico)) {
                    servicosDisponiveis.push(servico);
                }
                
                let listaAtendentes = [];
                if (Array.isArray(item.atendentes)) {
                    listaAtendentes = item.atendentes;
                } else if (typeof item.atendentes === 'string') {
                    try {
                        listaAtendentes = JSON.parse(item.atendentes);
                        if (!Array.isArray(listaAtendentes)) {
                            listaAtendentes = [item.atendentes];
                        }
                    } catch (e) {
                        listaAtendentes = item.atendentes.split(',').map(a => a.trim());
                    }
                }
                
                listaAtendentes.forEach(atendente => {
                    if (atendente && atendente.trim() !== '') {
                        atendentes.push({
                            nome: atendente.trim(),
                            servico: servico,
                            isPI: true
                        });
                    }
                });
            }
        });
    }
    // Caso 3: Não há servicoAtendente definido - cria um serviço padrão com o próprio PI como atendente
    else {
        const nomeAtendente = dadosPI.nomeCompleto || dadosPI.nomeFantasia || "Prestador";
        servicosDisponiveis = ["Serviço Geral"];
        atendentes.push({
            nome: nomeAtendente,
            servico: "Serviço Geral",
            isPI: true
        });
    }
    
    // Preenche o select de serviços/atendentes
    preencherSelectServicosAtendentes();
}

// Processa os serviços e atendentes para empresas regulares
function processarServicosAtendentesEmpresa(dadosEmpresa) {
    servicosDisponiveis = [];
    atendentes = [];
    
    // Caso 1: servicoAtendente é um array de objetos {servico, atendentes}
    if (Array.isArray(dadosEmpresa.servicoAtendente)) {
        dadosEmpresa.servicoAtendente.forEach(item => {
            if (item && typeof item === 'object' && item.servico && item.atendentes) {
                const servico = item.servico.trim();
                if (!servicosDisponiveis.includes(servico)) {
                    servicosDisponiveis.push(servico);
                }
                
                // Processa os atendentes que podem ser string ou array
                let listaAtendentes = [];
                
                if (Array.isArray(item.atendentes)) {
                    listaAtendentes = item.atendentes;
                } else if (typeof item.atendentes === 'string') {
                    try {
                        listaAtendentes = JSON.parse(item.atendentes);
                        if (!Array.isArray(listaAtendentes)) {
                            listaAtendentes = [item.atendentes];
                        }
                    } catch (e) {
                        listaAtendentes = item.atendentes.split(',').map(a => a.trim());
                    }
                }
                
                listaAtendentes.forEach(atendente => {
                    if (atendente) {
                        atendentes.push({
                            nome: atendente.trim(),
                            servico: servico,
                            isPI: false
                        });
                    }
                });
            }
        });
    } 
    // Caso 2: servicoAtendente é um objeto (pode acontecer em algumas estruturas)
    else if (dadosEmpresa.servicoAtendente && typeof dadosEmpresa.servicoAtendente === 'object' && !Array.isArray(dadosEmpresa.servicoAtendente)) {
        // Converte o objeto em array
        const servicoAtendenteArray = Object.values(dadosEmpresa.servicoAtendente);
        servicoAtendenteArray.forEach(item => {
            if (item && typeof item === 'object' && item.servico && item.atendentes) {
                const servico = item.servico.trim();
                if (!servicosDisponiveis.includes(servico)) {
                    servicosDisponiveis.push(servico);
                }
                
                let listaAtendentes = [];
                if (Array.isArray(item.atendentes)) {
                    listaAtendentes = item.atendentes;
                } else if (typeof item.atendentes === 'string') {
                    try {
                        listaAtendentes = JSON.parse(item.atendentes);
                        if (!Array.isArray(listaAtendentes)) {
                            listaAtendentes = [item.atendentes];
                        }
                    } catch (e) {
                        listaAtendentes = item.atendentes.split(',').map(a => a.trim());
                    }
                }
                
                listaAtendentes.forEach(atendente => {
                    if (atendente) {
                        atendentes.push({
                            nome: atendente.trim(),
                            servico: servico,
                            isPI: false
                        });
                    }
                });
            }
        });
    }
    // Caso 3: Não há servicoAtendente definido - usa os campos 'servicos' ou 'servico'
    else {
        // Obtém a lista de serviços
        if (dadosEmpresa.servicos) {
            servicosDisponiveis = Array.isArray(dadosEmpresa.servicos) 
                ? [...new Set(dadosEmpresa.servicos.map(s => s.trim()))]
                : [...new Set(dadosEmpresa.servicos.split(/[\n,]/).map(s => s.trim()).filter(s => s))];
        } else if (dadosEmpresa.servico) {
            servicosDisponiveis = Array.isArray(dadosEmpresa.servico)
                ? [...new Set(dadosEmpresa.servico.map(s => s.trim()))]
                : [...new Set(dadosEmpresa.servico.split(/[\n,]/).map(s => s.trim()).filter(s => s))];
        }
        
        // Se não encontrou serviços, usa um padrão
        if (servicosDisponiveis.length === 0) {
            servicosDisponiveis = ["Serviço Geral"];
        }
    }
    
    // Preenche o select de serviços/atendentes
    preencherSelectServicosAtendentes();
}

// Preenche o select de serviços e atendentes
function preencherSelectServicosAtendentes() {
    const select = document.getElementById('servico-atendente');
    select.innerHTML = '<option value="">Selecione um serviço</option>';
    
    if (atendentes.length === 0 && servicosDisponiveis.length > 0) {
        // Caso não haja atendentes definidos, mas há serviços
        servicosDisponiveis.forEach(servico => {
            const option = document.createElement('option');
            option.value = `${servico}|`;
            option.textContent = servico;
            select.appendChild(option);
        });
        return;
    }
    
    if (atendentes.length === 0) {
        select.innerHTML = '<option value="">Nenhum serviço disponível</option>';
        return;
    }
    
    // Agrupa atendentes por serviço
    const servicosComAtendentes = {};
    atendentes.forEach(atendente => {
        if (!servicosComAtendentes[atendente.servico]) {
            servicosComAtendentes[atendente.servico] = [];
        }
        servicosComAtendentes[atendente.servico].push(atendente.nome);
    });
    
    // Ordena serviços alfabeticamente
    const servicosOrdenados = Object.keys(servicosComAtendentes).sort();
    
    // Adiciona opções ao select
    servicosOrdenados.forEach(servico => {
        const atendentesDoServico = servicosComAtendentes[servico];
        
        atendentesDoServico.forEach(atendente => {
            const option = document.createElement('option');
            option.value = `${servico}|${atendente}`;
            option.textContent = `${servico} - ${atendente}`;
            select.appendChild(option);
        });
    });
    
    // Configura o evento change
    select.addEventListener('change', function() {
        const [servico, atendente] = this.value.split('|');
        servicoAtendenteSelecionado = this.value;
        servicoSelecionado = servico;
        atendenteSelecionado = atendente;
        
        if (dataSelecionada) carregarHorariosDisponiveis();
    });
}

// Função para verificar agendamento existente em prestador individual (com "PI -")
function verificarAgendamentoPrestadorIndividual(documento) {
    const documentoLimpo = documento.replace(/\D/g, '');
    
    if (!documentoLimpo || !empresaSelecionada) return;
    
    // Remove o prefixo "PI - " para obter o ID real do prestador
    const prestadorId = empresaSelecionada.id.replace("PI - ", "");
    
    db.collection("usuarios").doc(prestadorId)
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
            console.error("Erro ao verificar agendamento com PI:", err);
            document.getElementById('info-agendamento-existente').style.display = 'none';
            document.getElementById('formulario-agendamento').style.display = 'block';
        });
}

function verificarAgendamentoExistente(documento) {
    const documentoLimpo = documento.replace(/\D/g, '');
    
    if (!documentoLimpo || !empresaSelecionada) return;
    
    if (empresaSelecionada.id.startsWith("PI - ")) {
        verificarAgendamentoPrestadorIndividual(documento);
    } else {
        // Código original para empresas regulares
        const empresaId = empresaSelecionada.id;
        
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
}

function exibirAgendamentoExistente(agendamento) {
    const resumoDiv = document.getElementById('resumo-agendamento-existente');
    resumoDiv.innerHTML = `
        <p class="mb-2"><strong>Serviço:</strong> ${agendamento.servico}</p>
        ${agendamento.prestador ? `<p class="mb-2"><strong>Atendente:</strong> ${agendamento.prestador}</p>` : ''}
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
        ? empresaSelecionada.id.replace("PI - ", "")
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
    if (!empresaSelecionada || !dataSelecionada || !servicoSelecionado || !atendenteSelecionado) return;
    
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
        ? empresaSelecionada.id.replace("PI - ", "")
        : empresaSelecionada.id)
        .collection("agendamentos")
        .where("data", "==", dataFormatada)
        .where("servico", "==", servicoSelecionado)
        .where("prestador", "==", atendenteSelecionado)
        .where("status", "==", "confirmado");
    
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
    document.getElementById('resumo-atendente').textContent = atendenteSelecionado;
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
        prestador: atendenteSelecionado,
        data: formatarDataFirestore(dataSelecionada),
        horario: horarioSelecionado,
        clienteNome: nome,
        clienteDocumento: documentoCliente.replace(/\D/g, ''),
        clienteTelefone: telefone,
        clienteEmail: email || '',
        status: "confirmado",
        dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Determina o ID correto da empresa (remove "PI - " se necessário)
    const empresaId = empresaSelecionada.isPI 
        ? empresaSelecionada.id.replace("PI - ", "")
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
function init() {
    // Inicializa o calendário
    calendar = flatpickr("#calendar-input", {
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
}

// Inicializa quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', init);
