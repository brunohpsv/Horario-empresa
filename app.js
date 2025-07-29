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
let empresaPrincipal = null;
let empresaPI = null;
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

function inicializarCalendario() {
    const hoje = new Date();
    const config = {
        locale: 'pt',
        dateFormat: 'd/m/Y',
        minDate: hoje,
        disable: [
            function(date) {
                // Desabilita fins de semana
                return (date.getDay() === 0 || date.getDay() === 6);
            }
        ],
        onChange: function(selectedDates, dateStr, instance) {
            dataSelecionada = selectedDates[0];
            document.getElementById('selected-date').textContent = formatarData(dataSelecionada);
            
            if (servicoSelecionado) {
                carregarHorariosDisponiveis();
            }
        }
    };

    calendar = flatpickr("#calendar-input", config);
}

function carregarDadosEmpresa() {
    const empresaId = new URLSearchParams(window.location.search).get('id');
    
    if (!empresaId) {
        mostrarErro("Nenhuma empresa selecionada. Volte e selecione uma empresa.");
        return;
    }
    
    const empresaIdComPI = `PI - ${empresaId}`;
    
    // Carrega os dois documentos (com e sem PI -)
    Promise.all([
        db.collection("usuarios").doc(empresaId).get(),
        db.collection("usuarios").doc(empresaIdComPI).get()
    ])
    .then(([docSemPI, docComPI]) => {
        if (docSemPI.exists) {
            empresaPrincipal = {
                ...docSemPI.data(),
                id: docSemPI.id,
                isPI: false
            };
        }
        
        if (docComPI.exists) {
            empresaPI = {
                ...docComPI.data(),
                id: docComPI.id,
                isPI: true
            };
        }
        
        // Define a empresa selecionada como a principal (sem PI -) por padrão
        empresaSelecionada = empresaPrincipal || empresaPI;
        
        if (!empresaSelecionada) {
            mostrarErro("Empresa não encontrada.");
            return;
        }
        
        // Usa nomeFantasia ou o ID como fallback
        document.getElementById('empresa-nome').textContent = empresaSelecionada.nomeFantasia || empresaSelecionada.id.replace("PI - ", "") || "Empresa";
        
        // Combina as configurações de horários
        if (empresaSelecionada.horariosConfig) {
            Object.assign(horariosConfig, empresaSelecionada.horariosConfig);
        }
        
        // Carrega serviços e atendentes
        carregarServicosEAtendentes();
    })
    .catch(err => {
        console.error("Erro ao carregar empresa:", err);
        mostrarErro("Erro ao carregar dados da empresa.");
    });
}

function carregarServicosEAtendentes() {
    // Limpa os arrays antes de recarregar
    servicosDisponiveis = [];
    atendentes = [];
    
    // Primeiro processa os dados da empresa PI (com "PI -")
    if (empresaPI) {
        processarDadosPI(empresaPI);
    }
    
    // Depois processa os dados da empresa principal (sem "PI -")
    if (empresaPrincipal) {
        processarDadosPrincipal(empresaPrincipal);
    }
    
    // Remove duplicatas e ordena
    servicosDisponiveis = [...new Set(servicosDisponiveis)].sort((a, b) => a.localeCompare(b));
    
    // Carrega os selects
    carregarSelectServicos();
}

function processarDadosPI(empresa) {
    // Verifica se tem servicoAtendente
    if (empresa.servicoAtendente) {
        if (typeof empresa.servicoAtendente === 'string') {
            // Formato: "Serviço - Atendente1, Atendente2"
            const linhas = empresa.servicoAtendente.split('\n').filter(linha => linha.trim() !== '');
            
            linhas.forEach(linha => {
                const partes = linha.split('-').map(p => p.trim());
                if (partes.length === 2) {
                    const servico = partes[0];
                    const nomesAtendentes = partes[1].split(',').map(n => n.trim());
                    
                    servicosDisponiveis.push(servico);
                    
                    nomesAtendentes.forEach(nome => {
                        // Verifica se o nome não é o nomeFantasia da empresa
                        if (nome !== empresa.nomeFantasia) {
                            atendentes.push({ 
                                nome, 
                                servico, 
                                isPI: true,
                                empresaId: empresa.id
                            });
                        }
                    });
                }
            });
        } else if (Array.isArray(empresa.servicoAtendente)) {
            // Formato array de objetos
            empresa.servicoAtendente.forEach(item => {
                if (item.servico && item.atendentes) {
                    servicosDisponiveis.push(item.servico);
                    
                    item.atendentes.forEach(nome => {
                        // Verifica se o nome não é o nomeFantasia da empresa
                        if (nome !== empresa.nomeFantasia) {
                            atendentes.push({ 
                                nome, 
                                servico: item.servico, 
                                isPI: true,
                                empresaId: empresa.id
                            });
                        }
                    });
                }
            });
        }
    }
    
    // Se for um prestador individual, adiciona seus serviços específicos
    if (empresa.servicos) {
        const novosServicos = empresa.servicos.split('/').map(s => s.trim()).filter(s => s.length > 0);
        servicosDisponiveis = [...new Set([...servicosDisponiveis, ...novosServicos])];
    } else if (empresa.servico) {
        const novosServicos = empresa.servico.split(',').map(s => s.trim()).filter(s => s.length > 0);
        servicosDisponiveis = [...new Set([...servicosDisponiveis, ...novosServicos])];
    }
    
    // Processa horários específicos se existirem
    if (empresa.horarios) {
        try {
            const horariosData = JSON.parse(empresa.horarios);
            if (horariosData.horarioAbertura) horariosConfig.horarioAbertura = horariosData.horarioAbertura;
            if (horariosData.horarioFechamento) horariosConfig.horarioFechamento = horariosData.horarioFechamento;
            if (horariosData.duracaoAtendimento) horariosConfig.duracaoAtendimento = horariosData.duracaoAtendimento;
            if (horariosData.intervaloAtendimento) horariosConfig.intervaloAtendimento = horariosData.intervaloAtendimento;
        } catch (e) {
            console.error("Erro ao processar horários:", e);
        }
    }
}

function processarDadosPrincipal(empresa) {
    // Processa servicoAtendente
    if (empresa.servicoAtendente) {
        if (typeof empresa.servicoAtendente === 'string') {
            // Formato: "Serviço - Atendente1, Atendente2"
            const linhas = empresa.servicoAtendente.split('\n').filter(linha => linha.trim() !== '');
            
            linhas.forEach(linha => {
                const partes = linha.split('-').map(p => p.trim());
                if (partes.length === 2) {
                    const servico = partes[0];
                    const nomesAtendentes = partes[1].split(',').map(n => n.trim());
                    
                    servicosDisponiveis.push(servico);
                    
                    nomesAtendentes.forEach(nome => {
                        // Verifica se o nome não é o nomeFantasia da empresa
                        if (nome !== empresa.nomeFantasia) {
                            atendentes.push({ 
                                nome, 
                                servico, 
                                isPI: false,
                                empresaId: empresa.id
                            });
                        }
                    });
                }
            });
        } else if (Array.isArray(empresa.servicoAtendente)) {
            // Formato array de objetos
            empresa.servicoAtendente.forEach(item => {
                if (item.servico && item.atendentes) {
                    servicosDisponiveis.push(item.servico);
                    
                    item.atendentes.forEach(nome => {
                        // Verifica se o nome não é o nomeFantasia da empresa
                        if (nome !== empresa.nomeFantasia) {
                            atendentes.push({ 
                                nome, 
                                servico: item.servico, 
                                isPI: false,
                                empresaId: empresa.id
                            });
                        }
                    });
                }
            });
        }
    }
    
    // Processa atendentes (formato antigo)
    if (empresa.atendentes) {
        if (typeof empresa.atendentes === 'string') {
            // Formato: "(Nome) - [Serviço1][Serviço2]"
            const regex = /\(([^)]+)\)\s*-\s*(\[[^\]]+\](?:\s*\[[^\]]+\])*)/g;
            let match;
            
            while ((match = regex.exec(empresa.atendentes)) !== null) {
                const nomePrestador = match[1].trim();
                const servicos = match[2].match(/\[([^\]]+)\]/g).map(s => s.replace(/[\[\]]/g, '').trim());
                
                // Verifica se o nome não é o nomeFantasia da empresa
                if (nomePrestador !== empresa.nomeFantasia) {
                    servicos.forEach(servico => {
                        atendentes.push({ 
                            nome: nomePrestador, 
                            servico, 
                            isPI: false,
                            empresaId: empresa.id
                        });
                        servicosDisponiveis.push(servico);
                    });
                }
            }
        } else if (Array.isArray(empresa.atendentes)) {
            empresa.atendentes.forEach(item => {
                if (item.nome && item.servicos) {
                    // Verifica se o nome não é o nomeFantasia da empresa
                    if (item.nome !== empresa.nomeFantasia) {
                        item.servicos.forEach(servico => {
                            atendentes.push({ 
                                nome: item.nome, 
                                servico, 
                                isPI: false,
                                empresaId: empresa.id
                            });
                            servicosDisponiveis.push(servico);
                        });
                    }
                }
            });
        }
    }
    
    // Processa serviços diretos (sem atendentes específicos)
    if (empresa.servico) {
        const novosServicos = typeof empresa.servico === 'string' 
            ? empresa.servico.split(/[\n,]/).map(s => s.trim()).filter(s => s.length > 0)
            : [...empresa.servico];
        
        servicosDisponiveis = [...new Set([...servicosDisponiveis, ...novosServicos])];
    }
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
        
        // Atualiza a empresa selecionada com base no prestador
        if (prestadorSelecionado) {
            const prestadorInfo = atendentes.find(a => a.nome === prestadorSelecionado && a.servico === servicoSelecionado);
            if (prestadorInfo) {
                empresaSelecionada = prestadorInfo.isPI ? empresaPI : empresaPrincipal;
                
                // Atualiza as configurações de horário
                if (empresaSelecionada.horariosConfig) {
                    Object.assign(horariosConfig, empresaSelecionada.horariosConfig);
                }
                
                // Recarrega os horários se já tiver uma data selecionada
                if (dataSelecionada) {
                    carregarHorariosDisponiveis();
                }
            }
        }
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
            
            // Atualiza a empresa selecionada para o prestador único
            const prestadorInfo = atendentes.find(a => a.nome === prestadorSelecionado && a.servico === servicoSelecionado);
            if (prestadorInfo) {
                empresaSelecionada = prestadorInfo.isPI ? empresaPI : empresaPrincipal;
                
                // Atualiza as configurações de horário
                if (empresaSelecionada.horariosConfig) {
                    Object.assign(horariosConfig, empresaSelecionada.horariosConfig);
                }
            }
        }
    } else {
        document.getElementById('prestador-group').style.display = 'none';
    }
}

function verificarAgendamentoExistente(documento) {
    const documentoLimpo = documento.replace(/\D/g, '');
    
    if (!documentoLimpo) return;
    
    // Verifica nas duas empresas (principal e PI)
    const promises = [];
    
    if (empresaPrincipal) {
        promises.push(
            db.collection("usuarios").doc(empresaPrincipal.id)
                .collection("agendamentos")
                .where("clienteDocumento", "==", documentoLimpo)
                .where("status", "==", "confirmado")
                .get()
        );
    }
    
    if (empresaPI) {
        promises.push(
            db.collection("usuarios").doc(empresaPI.id)
                .collection("agendamentos")
                .where("clienteDocumento", "==", documentoLimpo)
                .where("status", "==", "confirmado")
                .get()
        );
    }
    
    Promise.all(promises)
        .then(results => {
            for (const querySnapshot of results) {
                if (!querySnapshot.empty) {
                    querySnapshot.forEach(doc => {
                        agendamentoExistente = { id: doc.id, ...doc.data() };
                        exibirAgendamentoExistente(agendamentoExistente);
                    });
                    break; // Mostra apenas o primeiro agendamento encontrado
                }
            }
            
            if (!agendamentoExistente) {
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
    // Determina em qual empresa está o agendamento
    const empresaId = agendamento.prestador && atendentes.some(a => a.nome === agendamento.prestador && a.isPI) 
        ? empresaPI.id 
        : empresaPrincipal.id;
    
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
    
    const query = db.collection("usuarios").doc(empresaSelecionada.id)
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
    
    // Usa nomeFantasia ou o ID como fallback
    const nomeEmpresa = empresaSelecionada.nomeFantasia || empresaSelecionada.id.replace("PI - ", "") || "Empresa";
    
    document.getElementById('resumo-empresa').textContent = nomeEmpresa;
    document.getElementById('resumo-servico').textContent = servicoSelecionado;
    
    // Atualiza a exibição do prestador apenas se existir
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
        
        // Determina para qual empresa enviar o agendamento com base no prestador
        const prestadorInfo = atendentes.find(a => a.nome === prestadorSelecionado && a.servico === servicoSelecionado);
        if (prestadorInfo) {
            empresaSelecionada = prestadorInfo.isPI ? empresaPI : empresaPrincipal;
        }
    }
    
    if (!empresaSelecionada) {
        mostrarErro("Erro ao determinar a empresa para o agendamento.");
        return;
    }
    
    db.collection("usuarios").doc(empresaSelecionada.id)
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

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o calendário
    inicializarCalendario();
    
    // Carrega os dados da empresa
    carregarDadosEmpresa();
    
    // Configura o botão de confirmação
    document.getElementById('btn-confirmar').addEventListener('click', confirmarAgendamento);
    
    // Configura a máscara do CPF/CNPJ
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
    
    // Configura a máscara do telefone
    document.getElementById('telefone').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        e.target.value = value.substring(0, 15);
    });
});
