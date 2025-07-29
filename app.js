// Inicialização do calendário
function initCalendar() {
    const calendar = flatpickr("#calendar-input", {
        locale: "pt",
        dateFormat: "d/m/Y",
        minDate: "today",
        disable: [
            function(date) {
                // Desabilita fins de semana por padrão
                return (date.getDay() === 0 || date.getDay() === 6);
            }
        ],
        onChange: function(selectedDates, dateStr, instance) {
            dataSelecionada = selectedDates[0];
            document.getElementById('selected-date').textContent = instance.formatDate(selectedDates[0], "d/m/Y");
            
            // Resetar seleções quando a data muda
            horarioSelecionado = null;
            document.querySelectorAll('.time-slot').forEach(b => b.classList.remove('selected'));
            document.getElementById('dados-section').style.display = 'none';
            document.getElementById('btn-confirmar').style.display = 'none';
            
            if (servicoSelecionado) {
                carregarHorariosDisponiveis();
            }
        },
        onOpen: function(selectedDates, dateStr, instance) {
            // Atualiza os dias desabilitados com base nas configurações da empresa
            updateDisabledDays(instance);
        }
    });

    // Função para atualizar dias desabilitados com base nas configurações da empresa
    function updateDisabledDays(instance) {
        if (!empresaSelecionada || !empresaSelecionada.diasFuncionamento) return;
        
        try {
            const diasFuncionamento = JSON.parse(empresaSelecionada.diasFuncionamento);
            
            // Se houver dias específicos desabilitados
            if (diasFuncionamento.diasDesabilitados) {
                instance.set('disable', [
                    function(date) {
                        // Desabilita fins de semana se não estiverem nos dias de funcionamento
                        const diaSemana = date.getDay();
                        const isFimDeSemana = (diaSemana === 0 || diaSemana === 6);
                        
                        // Verifica se o dia está na lista de desabilitados
                        const dateStr = formatarDataFirestore(date);
                        const isDiaDesabilitado = diasFuncionamento.diasDesabilitados.includes(dateStr);
                        
                        return isDiaDesabilitado || (!diasFuncionamento.trabalhaFimDeSemana && isFimDeSemana);
                    }
                ]);
            }
            
            // Se a empresa não trabalha fins de semana
            if (diasFuncionamento.trabalhaFimDeSemana === false) {
                instance.set('disable', [
                    function(date) {
                        return (date.getDay() === 0 || date.getDay() === 6);
                    }
                ]);
            }
        } catch (e) {
            console.error("Erro ao processar dias de funcionamento:", e);
        }
    }

    return calendar;
}

// Função para formatar a data no formato do Firestore (YYYY-MM-DD)
function formatarDataFirestore(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Função para formatar a data para exibição (DD/MM/YYYY)
function formatarData(date) {
    return new Date(date).toLocaleDateString('pt-BR');
}

// Atualização na função carregarDadosEmpresa()
function carregarDadosEmpresa() {
    const empresaId = new URLSearchParams(window.location.search).get('id');
    
    if (!empresaId) {
        mostrarErro("Nenhuma empresa selecionada. Volte e selecione uma empresa.");
        return;
    }
    
    const empresaIdComPI = `PI - ${empresaId}`;
    
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
        
        empresaSelecionada = empresaPrincipal || empresaPI;
        
        if (!empresaSelecionada) {
            mostrarErro("Empresa não encontrada.");
            return;
        }
        
        document.getElementById('empresa-nome').textContent = empresaSelecionada.nomeFantasia || empresaSelecionada.id.replace("PI - ", "") || "Empresa";
        
        // Combina as configurações de horários
        if (empresaSelecionada.horariosConfig) {
            Object.assign(horariosConfig, empresaSelecionada.horariosConfig);
        }
        
        // Carrega serviços e atendentes
        carregarServicosEAtendentes();
        
        // Inicializa o calendário após carregar os dados da empresa
        initCalendar();
    })
    .catch(err => {
        console.error("Erro ao carregar empresa:", err);
        mostrarErro("Erro ao carregar dados da empresa.");
    });
}
