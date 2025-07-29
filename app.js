// app.js - Código para lidar com prestadores individuais (PI)

// Função para carregar dados do prestador individual
function carregarDadosPrestadorIndividual(empresaId) {
    return new Promise((resolve, reject) => {
        // Verifica se o ID começa com "PI -"
        if (empresaId.startsWith("PI - ")) {
            const piId = empresaId.replace("PI - ", "");
            
            db.collection("usuarios").doc(piId).get()
                .then(doc => {
                    if (!doc.exists) {
                        reject("Prestador individual não encontrado.");
                        return;
                    }
                    
                    const piData = {
                        ...doc.data(),
                        id: empresaId, // Mantém o ID original com "PI -"
                        originalId: piId, // Guarda o ID sem o prefixo
                        isPI: true
                    };
                    
                    resolve(piData);
                })
                .catch(err => {
                    console.error("Erro ao carregar prestador individual:", err);
                    reject("Erro ao carregar dados do prestador.");
                });
        } else {
            reject("Não é um ID de prestador individual");
        }
    });
}

// Função modificada para carregar dados da empresa ou prestador individual
function carregarDadosEmpresaComPI() {
    const empresaId = new URLSearchParams(window.location.search).get('id');
    
    if (!empresaId) {
        mostrarErro("Nenhuma empresa selecionada. Volte e selecione uma empresa.");
        return;
    }
    
    // Verifica se é um prestador individual (começa com "PI -")
    if (empresaId.startsWith("PI - ")) {
        carregarDadosPrestadorIndividual(empresaId)
            .then(piData => {
                empresaSelecionada = piData;
                empresaPI = piData; // Guarda como PI
                
                document.getElementById('empresa-nome').textContent = 
                    piData.nomeCompleto || piData.nomeFantasia || "Prestador Individual";
                
                // Configurações específicas do PI
                if (piData.horariosConfig) {
                    Object.assign(horariosConfig, piData.horariosConfig);
                }
                
                // Carrega serviços e atendentes do PI
                carregarServicosEAtendentesPI(piData);
            })
            .catch(err => {
                console.error(err);
                mostrarErro("Erro ao carregar dados do prestador individual.");
            });
    } else {
        // Código original para empresas regulares
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
                
                empresaPrincipal = empresaSelecionada;
                
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
}

// Função para carregar serviços e atendentes de um prestador individual
function carregarServicosEAtendentesPI(piData) {
    servicosDisponiveis = [];
    atendentes = [];
    
    // Processa serviços do PI
    if (piData.servicos) {
        const servicosArray = piData.servicos.split('/').map(s => s.trim()).filter(s => s.length > 0);
        servicosDisponiveis = [...new Set(servicosArray)];
    } else if (piData.servico) {
        const servicosArray = piData.servico.split(',').map(s => s.trim()).filter(s => s.length > 0);
        servicosDisponiveis = [...new Set(servicosArray)];
    }
    
    // Adiciona o próprio PI como atendente para todos os serviços
    if (piData.nomeCompleto && servicosDisponiveis.length > 0) {
        servicosDisponiveis.forEach(servico => {
            atendentes.push({
                nome: piData.nomeCompleto,
                servico: servico,
                isPI: true
            });
        });
    }
    
    // Ordena serviços
    servicosDisponiveis.sort((a, b) => a.localeCompare(b));
    
    // Carrega o select de serviços
    carregarSelectServicos();
}

// Função modificada para criar agendamentos em PIs
function criarAgendamentoPI(agendamento) {
    // Para PIs, usamos o originalId (sem o "PI -") para criar na subcoleção
    const empresaId = empresaSelecionada.originalId || empresaSelecionada.id.replace("PI - ", "");
    
    return db.collection("usuarios").doc(empresaId)
        .collection("agendamentos")
        .add(agendamento);
}

// Função modificada para confirmar agendamento (compatível com PIs)
function confirmarAgendamentoComPI() {
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
    
    // Verifica se é um PI para usar a função específica
    const criarAgendamento = empresaSelecionada.isPI ? criarAgendamentoPI : 
        () => db.collection("usuarios").doc(empresaSelecionada.id).collection("agendamentos").add(agendamento);
    
    criarAgendamento(agendamento)
        .then(() => {
            agendamentoConfirmado = true;
            preencherResumoAgendamento();
        })
        .catch(err => {
            console.error("Erro ao confirmar:", err);
            mostrarErro("Erro ao confirmar agendamento.");
        });
}

// Função modificada para verificar agendamentos existentes em PIs
function verificarAgendamentoExistenteComPI(documento) {
    const documentoLimpo = documento.replace(/\D/g, '');
    
    if (!documentoLimpo || !empresaSelecionada) return;
    
    // Para PIs, usamos o originalId (sem o "PI -")
    const empresaId = empresaSelecionada.isPI ? 
        (empresaSelecionada.originalId || empresaSelecionada.id.replace("PI - ", "")) : 
        empresaSelecionada.id;
    
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

// Substitui as funções originais pelas modificadas
document.addEventListener('DOMContentLoaded', () => {
    // Substitui a função de carregar dados
    carregarDadosEmpresa = carregarDadosEmpresaComPI;
    
    // Substitui a função de confirmar agendamento
    document.getElementById('btn-confirmar').addEventListener('click', confirmarAgendamentoComPI);
    
    // Substitui a função de verificar agendamento existente
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
            verificarAgendamentoExistenteComPI(documentoCliente);
        }
    });
    
    // Mantém o restante do código original
    document.getElementById('telefone').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        e.target.value = value.substring(0, 15);
    });
    
    // Inicializa carregando os dados
    carregarDadosEmpresaComPI();
});
