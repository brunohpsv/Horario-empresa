// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAfk7tS6Z39uYyHnbKlwY1O1zeOx74LlQg",
    authDomain: "banco-de-dados-d253e.firebaseapp.com",
    projectId: "banco-de-dados-d253e",
    storageBucket: "banco-de-dados-d253e.appspot.com",
    messagingSenderId: "1005413315224",
    appId: "1:1005413315224:web:c87d1dd951785ed4f656ed"
};

// Inicializa o Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variável global para armazenar dados do usuário
let currentUserData = null;

// Verificação de autenticação e carregamento de dados
document.addEventListener('DOMContentLoaded', function() {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // Usuário não autenticado, redireciona para login
            window.location.href = 'https://horario.site/login.html';
        } else {
            try {
                // Busca os dados do usuário no Firestore
                const userDoc = await db.collection('usuarios').where('email', '==', user.email).get();
                
                if (userDoc.empty) {
                    throw new Error('Dados do usuário não encontrados');
                }
                
                // Pega o primeiro documento (deveria ter apenas um com o mesmo email)
                const doc = userDoc.docs[0];
                const userData = doc.data();
                
                // Adiciona o ID do documento aos dados do usuário
                userData.id = doc.id;
                currentUserData = userData;
                
                // Carrega os dados do usuário
                loadUserData(userData);
                loadHorariosConfig(userData);
                document.getElementById('loaderOverlay').style.display = 'none';
                
                // Inicializa o calendário com os agendamentos
                initializeCalendar(userData);
            } catch (error) {
                console.error('Erro ao carregar dados do usuário:', error);
                alert('Erro ao carregar dados do usuário. Por favor, faça login novamente.');
                auth.signOut();
                window.location.href = 'https://horario.site/login.html';
            }
        }
    });
});

// Função para inicializar o calendário com os agendamentos
function initializeCalendar(userData) {
    $('#calendar').fullCalendar({
        header: {
            left: 'prev,next today',
            center: 'title',
            right: 'month,agendaDay'
        },
        defaultView: 'month',
        locale: 'pt-br',
        navLinks: true,
        selectable: true,
        selectHelper: false,
        editable: false,
        eventLimit: false,
        height: 600,
        aspectRatio: 1.8,
        dayRender: function(date, cell) {
            // Verifica se há agendamentos para este dia
            checkDayForAgendamentos(date, cell, userData.id);
            
            if (date.day() === 0 || date.day() === 6) {
                cell.css('background-color', '#f9f9f9');
            }
        },
        dayClick: function(date, jsEvent, view) {
            if (view.name === 'month') {
                $('#calendar').fullCalendar('changeView', 'agendaDay');
                $('#calendar').fullCalendar('gotoDate', date);
            }
        },
        viewRender: function(view, element) {
            if (view.name === 'agendaDay') {
                const date = view.intervalStart;
                const dateStr = date.format('DD/MM/YYYY');
                const dateKey = date.format('YYYY-MM-DD');
                
                // Carrega os agendamentos para este dia
                loadAgendamentosForDay(userData.id, dateKey, dateStr);
            }
        }
    });
}

// Função para verificar se um dia tem agendamentos
async function checkDayForAgendamentos(date, cell, userId) {
    try {
        const dateKey = date.format('YYYY-MM-DD');
        const today = moment().startOf('day');
        
        // Verifica se a data é hoje ou no futuro
        const isFutureOrToday = date.isSameOrAfter(today, 'day');
        
        const agendamentosRef = db.collection('usuarios').doc(userId)
            .collection('agendamentos').where('data', '==', dateKey);
        
        agendamentosRef.get().then(querySnapshot => {
            if (!querySnapshot.empty) {
                const alertIcon = document.createElement('div');
                alertIcon.className = 'day-alert';
                
                // Ícone diferente para datas passadas
                if (isFutureOrToday) {
                    alertIcon.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ff0000; font-size: 28px;"></i>';
                } else {
                    alertIcon.innerHTML = '<i class="fas fa-times-circle" style="color: #cccccc; font-size: 28px;"></i>';
                }
                
                cell[0].appendChild(alertIcon);
                cell.css('background-color', isFutureOrToday ? '#fff6f6' : '#f9f9f9');
            }
        });
    } catch (error) {
        console.error("Erro ao verificar agendamentos:", error);
    }
}

// Função para carregar agendamentos de um dia específico
async function loadAgendamentosForDay(userId, dateKey, dateStr) {
    try {
        const agendamentosRef = db.collection('usuarios').doc(userId)
            .collection('agendamentos').where('data', '==', dateKey);
        
        const querySnapshot = await agendamentosRef.get();
        
        let agendamentosHTML = `
            <div style="margin: 20px auto; max-width: 800px;">
                <button id="voltar-mes" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; cursor: pointer; margin-bottom: 15px;">
                    ← Voltar para o Mês
                </button>
                <h2 style="text-align: center; margin-bottom: 20px; color: #333;">Agendamentos - ${dateStr}</h2>
                <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        `;
        
        if (!querySnapshot.empty) {
            const agendamentos = [];
            querySnapshot.forEach(doc => {
                const agendamento = doc.data();
                agendamento.id = doc.id;
                agendamentos.push(agendamento);
            });
            
            agendamentos.sort((a, b) => a.horario.localeCompare(b.horario));
            
            agendamentos.forEach(agendamento => {
                const statusClass = getStatusClass(agendamento.status);
                
                agendamentosHTML += `
                    <div style="padding: 15px; border-bottom: 1px solid #eee; position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; color: #333;">${agendamento.horario}</span>
                            <span style="font-weight: bold;">${agendamento.servico || 'Serviço não especificado'}</span>
                            <span class="status-badge ${statusClass}" style="padding: 3px 8px; border-radius: 4px;">${agendamento.status || 'confirmado'}</span>
                        </div>
                        <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <strong style="display: block; color: #555;">Cliente</strong>
                                <div>${agendamento.clienteNome || 'Não informado'}</div>
                            </div>
                            <div>
                                <strong style="display: block; color: #555;">Telefone</strong>
                                <div>${agendamento.clienteTelefone || 'Não informado'}</div>
                            </div>
                            <div>
                                <strong style="display: block; color: #555;">E-mail</strong>
                                <div>${agendamento.clienteEmail || 'Não informado'}</div>
                            </div>
                        </div>
                        <button class="btn-concluir" data-id="${agendamento.id}" style="position: absolute; top: 15px; right: 15px; background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                            Concluir
                        </button>
                    </div>
                `;
            });
        } else {
            agendamentosHTML += `
                <div style="padding: 20px; text-align: center; color: #666;">
                    Nenhum agendamento encontrado para este dia.
                </div>
            `;
        }
        
        agendamentosHTML += `
                </div>
            </div>
        `;
        
        $('#calendar').html(agendamentosHTML);
        
        // Adiciona evento para os botões de concluir
        $('.btn-concluir').click(async function() {
            const agendamentoId = $(this).data('id');
            try {
                await db.collection('usuarios').doc(userId)
                    .collection('agendamentos').doc(agendamentoId).update({
                        status: 'concluído',
                        concluidoEm: new Date()
                    });
                
                // Adiciona marcação de concluído
                $(this).replaceWith('<div style="position: absolute; top: 15px; right: 15px; color: #ff0000; font-weight: bold;">X</div>');
            } catch (error) {
                console.error('Erro ao marcar como concluído:', error);
                alert('Erro ao concluir agendamento');
            }
        });
        
        $('#voltar-mes').click(function() {
            location.reload();
        });
    } catch (error) {
        console.error("Erro ao carregar agendamentos:", error);
        $('#calendar').html(`
            <div style="margin: 20px auto; max-width: 800px;">
                <button id="voltar-mes" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; cursor: pointer; margin-bottom: 15px;">
                    ← Voltar para o Mês
                </button>
                <div style="padding: 20px; text-align: center; color: #666;">
                    Ocorreu um erro ao carregar os agendamentos. Tente novamente.
                </div>
            </div>
        `);
        
        $('#voltar-mes').click(function() {
            location.reload();
        });
    }
}

// Função para formatar timestamp do Firestore
function formatFirestoreTimestamp(timestamp) {
    if (!timestamp) return 'Data não disponível';
    
    try {
        // Se for um objeto Timestamp do Firestore
        if (timestamp.toDate) {
            const date = timestamp.toDate();
            return date.toLocaleString('pt-BR');
        }
        
        // Se já for uma string ou outro formato
        return new Date(timestamp).toLocaleString('pt-BR');
    } catch (e) {
        console.error('Erro ao formatar timestamp:', e);
        return 'Data inválida';
    }
}

// Função para obter a classe CSS baseada no status
function getStatusClass(status) {
    if (!status) return 'status-confirmado';
    
    status = status.toLowerCase();
    
    if (status.includes('confirmado')) {
        return 'status-confirmado';
    } else if (status.includes('pendente')) {
        return 'status-pendente';
    } else if (status.includes('cancelado')) {
        return 'status-cancelado';
    }
    
    return 'status-confirmado';
}

// Carrega os dados do usuário
function loadUserData(userData) {
    try {
        displayUserData(userData);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao carregar dados do usuário');
    }
}

// Carrega as configurações de horários do usuário
async function loadHorariosConfig(userData) {
    try {
        if (userData.horariosConfig) {
            loadHorariosData(userData.horariosConfig);
        } else {
            // Tenta buscar do Firestore
            const userDoc = await db.collection('usuarios').doc(userData.id).get();
            if (userDoc.exists && userDoc.data().horariosConfig) {
                loadHorariosData(userDoc.data().horariosConfig);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar configurações de horários:', error);
    }
}

// Preenche o formulário com os dados de horários
function loadHorariosData(horariosData) {
    if (horariosData.diasFuncionamento) {
        horariosData.diasFuncionamento.forEach(dia => {
            const checkbox = document.querySelector(`.dias-semana input[value="${dia}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    if (horariosData.horarioAbertura) {
        document.getElementById('horarioAbertura').value = horariosData.horarioAbertura;
    }
    
    if (horariosData.horarioFechamento) {
        document.getElementById('horarioFechamento').value = horariosData.horarioFechamento;
    }
    
    if (horariosData.duracaoAtendimento) {
        document.getElementById('duracaoAtendimento').value = horariosData.duracaoAtendimento;
    }
    
    if (horariosData.intervaloAtendimento) {
        document.getElementById('intervaloAtendimento').value = horariosData.intervaloAtendimento;
    }
}

// Salva as configurações de horários no Firebase
async function saveHorariosConfig(userData, config) {
    try {
        // Caminho específico para salvar as configurações
        const horariosRef = db.collection('usuarios').doc('WT907JdcaDXCyGd1DvzTOnpEHyA2')
                          .collection('horarios').doc('config');
        
        // Salva ou atualiza o documento
        await horariosRef.set(config, { merge: true });
        
        // Mostra mensagem de sucesso
        const successMessage = document.getElementById('successMessage');
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
        
        return true;
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        alert('Erro ao salvar configurações. Tente novamente.');
        return false;
    }
}

// Exibe os dados do usuário na página
function displayUserData(userData) {
    const container = document.getElementById('userInfoContainer');
    
    // Remove o loader
    const loader = document.getElementById('userDataLoader');
    if (loader) loader.remove();
    
    // Preenche os dados do usuário
    container.innerHTML = `
        <h2>INFORMAÇÕES CADASTRAIS</h2>
        
        <div class="info-item">
            <strong>Tipo de Pessoa</strong>
            <div>${userData.tipoPessoa === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica' || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>${userData.tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}</strong>
            <div>${userData.identificacao || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>Endereço</strong>
            <div>${userData.endereco || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>Bairro/Setor</strong>
            <div>${userData.bairro || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>Cidade</strong>
            <div>${userData.cidade || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>Estado</strong>
            <div>${userData.estado || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>CEP</strong>
            <div>${userData.cep || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>Telefone/Celular</strong>
            <div>${userData.telefone || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>E-mail</strong>
            <div>${userData.email || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>${userData.tipoPessoa === 'pf' ? 'Nome Completo' : 'Nome Fantasia'}</strong>
            <div>${userData.nomeFantasia || 'Não informado'}</div>
        </div>
        
        <div class="info-item">
            <strong>Número de Máquinas em Uso</strong>
            <div>${userData.maquinas || '0'}</div>
        </div>
        
        <div class="info-item">
            <strong>Serviços Prestados</strong>
            <div>${userData.servicos || 'Não informado'}</div>
        </div>
        
        <div class="info-contato">
            <p>Para alterar estas informações, entre em contato pelo e-mail: <strong>suporte@horario.site</strong></p>
            <p>Inclua no assunto: "Alteração de Cadastro - ${userData.identificacao || 'Seu CNPJ/CPF'}"</p>
        </div>
        
        <button type="button" class="btn-cancelar">Cancelar Assinatura</button>
    `;
}

// Gerenciamento de Máquinas
document.getElementById('btnGerarMaquinas').addEventListener('click', async function() {
    if (!currentUserData) return;
    
    const quantidade = parseInt(document.getElementById('quantidadeMaquinas').value);
    if (quantidade < 1 || quantidade > 10) {
        alert('Por favor, insira um número entre 1 e 10');
        return;
    }
    
    try {
        const maquinasList = document.getElementById('maquinasList');
        maquinasList.innerHTML = '';
        
        // Gera credenciais para cada máquina
        for (let i = 1; i <= quantidade; i++) {
            const login = `maquina${i}_${currentUserData.identificacao.substring(0, 4)}`;
            const senha = Math.random().toString(36).substring(2, 10);
            
            // Salva no Firestore
            await db.collection('usuarios').doc(currentUserData.id)
                .collection('maquinas').doc(login).set({
                    login,
                    senha,
                    criadoEm: new Date(),
                    ativo: false, // Só ficará ativo no próximo dia
                    identificacao: `Máquina ${i} - ${currentUserData.nomeFantasia}`
                });
            
            // Mostra para o usuário
            maquinasList.innerHTML += `
                <div style="margin-bottom: 10px; padding: 10px; background: white; border-radius: 4px;">
                    <strong>Máquina ${i}:</strong><br>
                    <strong>Login:</strong> ${login}<br>
                    <strong>Senha:</strong> ${senha}
                </div>
            `;
        }
        
        document.getElementById('maquinasResult').style.display = 'block';
        
        // Atualiza o número de máquinas no perfil
        await db.collection('usuarios').doc(currentUserData.id).update({
            maquinas: firebase.firestore.FieldValue.increment(quantidade)
        });
        
    } catch (error) {
        console.error('Erro ao gerar máquinas:', error);
        alert('Erro ao gerar acessos para máquinas');
    }
});

// Event Listeners
function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        auth.signOut().then(() => {
            window.location.href = 'https://horario.site/login.html';
        }).catch(error => {
            console.error('Erro ao fazer logout:', error);
        });
    });

    // Sistema de abas
    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');
            
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Formulário de Configuração de Horários
    document.getElementById('horariosForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!currentUserData) return;
        
        try {
            // Coletar dados do formulário
            const diasSelecionados = Array.from(document.querySelectorAll('.dias-semana input:checked')).map(el => el.value);
            const horarioAbertura = document.getElementById('horarioAbertura').value;
            const horarioFechamento = document.getElementById('horarioFechamento').value;
            const duracaoAtendimento = document.getElementById('duracaoAtendimento').value;
            const intervaloAtendimento = document.getElementById('intervaloAtendimento').value;
            
            // Validação básica
            if (diasSelecionados.length === 0) {
                alert('Selecione pelo menos um dia de funcionamento');
                return;
            }
            
            if (!horarioAbertura || !horarioFechamento) {
                alert('Preencha os horários de abertura e fechamento');
                return;
            }
            
            // Criar objeto de configuração
            const config = {
                diasFuncionamento: diasSelecionados,
                horarioAbertura,
                horarioFechamento,
                duracaoAtendimento: parseInt(duracaoAtendimento),
                intervaloAtendimento: parseInt(intervaloAtendimento),
                ultimaAtualizacao: new Date().toISOString()
            };
            
            // Salvar no Firebase
            await saveHorariosConfig(currentUserData, config);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            alert('Erro ao salvar configurações. Tente novamente.');
        }
    });
    
    // Formulário de Solicitação de Relatório
    document.getElementById('relatorioForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!currentUserData) return;
        
        const periodo = document.getElementById('periodoRelatorio').value;
        
        // Mostra mensagem de sucesso
        alert(`Relatório solicitado com sucesso! Você receberá um e-mail com o relatório dos últimos ${periodo} dias em até 24 horas.`);
        
        // Aqui você pode adicionar lógica para enviar a solicitação para o backend
        // Por exemplo, criar um documento em uma coleção de solicitações de relatório
    });
}

// Inicializa os event listeners quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});
