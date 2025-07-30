// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAfk7tS6Z39uYyHnbKlwY1O1zeOx74LlQg",
    authDomain: "banco-de-dados-d253e.firebaseapp.com",
    projectId: "banco-de-dados-d253e",
    storageBucket: "banco-de-dados-d253e.appspot.com",
    messagingSenderId: "1005413315224",
    appId: "1:1005413315224:web:c87d1dd951785ed4f656ed"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// DOM Elements
const elements = {
    empresaNome: document.getElementById('empresa-nome'),
    empresaServico: document.getElementById('empresa-servico'),
    documento: document.getElementById('documento'),
    servicoAtendente: document.getElementById('servico-atendente'),
    calendarInput: document.getElementById('calendar-input'),
    horarioSection: document.getElementById('horario-section'),
    selectedDate: document.getElementById('selected-date'),
    horariosContainer: document.getElementById('horarios-container'),
    dadosSection: document.getElementById('dados-section'),
    nome: document.getElementById('nome'),
    telefone: document.getElementById('telefone'),
    email: document.getElementById('email'),
    btnConfirmar: document.getElementById('btn-confirmar'),
    resumoAgendamento: document.getElementById('resumo-agendamento'),
    errorMessage: document.getElementById('error-message'),
    infoAgendamentoExistente: document.getElementById('info-agendamento-existente'),
    resumoAgendamentoExistente: document.getElementById('resumo-agendamento-existente'),
    btnCancelarAgendamento: document.getElementById('btn-cancelar-agendamento'),
    btnNovoAgendamento: document.getElementById('btn-novo-agendamento'),
    formularioAgendamento: document.getElementById('formulario-agendamento')
};

// Global variables
let empresaId = null;
let selectedService = null;
let selectedDate = null;
let selectedTime = null;
let empresaData = null;
let servicesData = [];
let blockedDates = [];
let existingAppointment = null;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get empresa ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    empresaId = urlParams.get('id');
    
    if (!empresaId) {
        showError('Nenhuma empresa especificada. Por favor, acesse através do link correto.');
        return;
    }
    
    // Load empresa data
    loadEmpresaData();
    
    // Initialize date picker
    initDatePicker();
    
    // Event listeners
    elements.servicoAtendente.addEventListener('change', onServiceChange);
    elements.documento.addEventListener('change', checkExistingAppointment);
    elements.btnConfirmar.addEventListener('click', confirmAppointment);
    
    if (elements.btnCancelarAgendamento) {
        elements.btnCancelarAgendamento.addEventListener('click', cancelAppointment);
    }
    
    if (elements.btnNovoAgendamento) {
        elements.btnNovoAgendamento.addEventListener('click', startNewAppointment);
    }
});

// Load empresa data from Firestore
function loadEmpresaData() {
    db.collection('empresas').doc(empresaId).get()
        .then(doc => {
            if (!doc.exists) {
                showError('Empresa não encontrada.');
                return;
            }
            
            empresaData = doc.data();
            elements.empresaNome.textContent = empresaData.nome || 'Empresa';
            elements.empresaServico.textContent = empresaData.descricao || '';
            
            // Load services for this empresa
            loadServices();
        })
        .catch(error => {
            console.error('Error loading empresa:', error);
            showError('Erro ao carregar dados da empresa.');
        });
}

// Load services from Firestore
function loadServices() {
    db.collection('servicos')
        .where('empresaId', '==', empresaId)
        .where('ativo', '==', true)
        .get()
        .then(querySnapshot => {
            elements.servicoAtendente.innerHTML = '<option value="">Selecione um serviço</option>';
            
            if (querySnapshot.empty) {
                elements.servicoAtendente.innerHTML = '<option value="">Nenhum serviço disponível</option>';
                return;
            }
            
            servicesData = [];
            querySnapshot.forEach(doc => {
                const service = doc.data();
                service.id = doc.id;
                servicesData.push(service);
                
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${service.nome} (${service.duracao} min) - ${service.atendente || 'Atendente não especificado'}`;
                elements.servicoAtendente.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error loading services:', error);
            showError('Erro ao carregar serviços disponíveis.');
        });
}

// Initialize date picker with configuration
function initDatePicker() {
    flatpickr(elements.calendarInput, {
        locale: 'pt',
        minDate: 'today',
        disable: blockedDates,
        onChange: function(selectedDates, dateStr) {
            selectedDate = dateStr;
            elements.selectedDate.textContent = formatDate(selectedDate);
            loadAvailableTimes();
            elements.horarioSection.style.display = 'block';
        }
    });
}

// Handle service selection change
function onServiceChange() {
    selectedService = this.value;
    selectedDate = null;
    selectedTime = null;
    
    elements.calendarInput.value = '';
    elements.horarioSection.style.display = 'none';
    elements.dadosSection.style.display = 'none';
    elements.btnConfirmar.style.display = 'none';
    
    if (!selectedService) return;
    
    // Load blocked dates for this service
    loadBlockedDates();
}

// Load blocked dates (holidays, non-working days, etc.)
function loadBlockedDates() {
    // You might want to load this from Firestore or use a fixed array
    blockedDates = [];
    // Example: blockedDates = ["2023-12-25", "2024-01-01"];
    
    // Reinitialize date picker with new blocked dates
    initDatePicker();
}

// Load available times for selected date and service
function loadAvailableTimes() {
    if (!selectedService || !selectedDate) return;
    
    elements.horariosContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
            <p class="mt-3">Carregando horários...</p>
        </div>
    `;
    
    // Find the selected service data
    const service = servicesData.find(s => s.id === selectedService);
    if (!service) return;
    
    // Calculate available times based on service duration and working hours
    // This is a simplified version - you'll need to adapt to your business logic
    const startHour = 9; // 9 AM
    const endHour = 18; // 6 PM
    const duration = parseInt(service.duracao) || 30;
    const interval = 15; // 15 minutes interval
    
    // Also check for existing appointments that might block times
    db.collection('agendamentos')
        .where('empresaId', '==', empresaId)
        .where('servicoId', '==', selectedService)
        .where('data', '==', selectedDate)
        .get()
        .then(querySnapshot => {
            const bookedTimes = [];
            querySnapshot.forEach(doc => {
                bookedTimes.push(doc.data().horario);
            });
            
            // Generate time slots
            generateTimeSlots(startHour, endHour, duration, interval, bookedTimes);
        })
        .catch(error => {
            console.error('Error loading appointments:', error);
            showError('Erro ao carregar horários disponíveis.');
        });
}

// Generate time slots HTML
function generateTimeSlots(startHour, endHour, duration, interval, bookedTimes) {
    elements.horariosContainer.innerHTML = '';
    
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;
    const serviceEnd = startMinutes + duration;
    
    for (let time = startMinutes; time + duration <= endMinutes; time += interval) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Check if this time is booked
        const isBooked = bookedTimes.includes(timeStr);
        
        const timeSlot = document.createElement('div');
        timeSlot.className = `time-slot ${isBooked ? 'disabled' : ''}`;
        timeSlot.textContent = timeStr;
        
        if (!isBooked) {
            timeSlot.addEventListener('click', function() {
                // Deselect all time slots
                document.querySelectorAll('.time-slot').forEach(slot => {
                    slot.classList.remove('selected');
                });
                
                // Select this time slot
                this.classList.add('selected');
                selectedTime = timeStr;
                
                // Show client data form
                elements.dadosSection.style.display = 'block';
                elements.btnConfirmar.style.display = 'block';
            });
        }
        
        elements.horariosContainer.appendChild(timeSlot);
    }
    
    if (elements.horariosContainer.children.length === 0) {
        elements.horariosContainer.innerHTML = '<div class="text-center py-4 text-muted">Nenhum horário disponível para esta data.</div>';
    }
}

// Check if client already has an appointment
function checkExistingAppointment() {
    const documento = elements.documento.value.trim();
    if (!documento) return;
    
    db.collection('agendamentos')
        .where('empresaId', '==', empresaId)
        .where('documento', '==', documento)
        .where('data', '>=', new Date().toISOString().split('T')[0])
        .limit(1)
        .get()
        .then(querySnapshot => {
            if (!querySnapshot.empty) {
                existingAppointment = querySnapshot.docs[0].data();
                showExistingAppointment();
            } else {
                elements.infoAgendamentoExistente.style.display = 'none';
                elements.formularioAgendamento.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error checking existing appointment:', error);
        });
}

// Show existing appointment information
function showExistingAppointment() {
    if (!existingAppointment) return;
    
    const service = servicesData.find(s => s.id === existingAppointment.servicoId);
    
    elements.resumoAgendamentoExistente.innerHTML = `
        <p><strong>Serviço:</strong> ${service?.nome || 'N/A'}</p>
        <p><strong>Data:</strong> ${formatDate(existingAppointment.data)}</p>
        <p><strong>Horário:</strong> ${existingAppointment.horario}</p>
    `;
    
    elements.infoAgendamentoExistente.style.display = 'block';
    elements.formularioAgendamento.style.display = 'none';
}

// Start new appointment flow (ignore existing one)
function startNewAppointment() {
    existingAppointment = null;
    elements.infoAgendamentoExistente.style.display = 'none';
    elements.formularioAgendamento.style.display = 'block';
}

// Cancel existing appointment
function cancelAppointment() {
    if (!existingAppointment) return;
    
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    
    db.collection('agendamentos').doc(existingAppointment.id).delete()
        .then(() => {
            alert('Agendamento cancelado com sucesso!');
            existingAppointment = null;
            elements.infoAgendamentoExistente.style.display = 'none';
            elements.formularioAgendamento.style.display = 'block';
        })
        .catch(error => {
            console.error('Error canceling appointment:', error);
            showError('Erro ao cancelar agendamento. Por favor, tente novamente.');
        });
}

// Confirm new appointment
function confirmAppointment() {
    if (!validateForm()) return;
    
    const appointmentData = {
        empresaId: empresaId,
        empresaNome: empresaData.nome,
        servicoId: selectedService,
        servicoNome: servicesData.find(s => s.id === selectedService)?.nome || '',
        atendente: servicesData.find(s => s.id === selectedService)?.atendente || '',
        data: selectedDate,
        horario: selectedTime,
        documento: elements.documento.value.trim(),
        nome: elements.nome.value.trim(),
        telefone: elements.telefone.value.trim(),
        email: elements.email.value.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'confirmado'
    };
    
    elements.btnConfirmar.disabled = true;
    elements.btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Confirmando...';
    
    db.collection('agendamentos').add(appointmentData)
        .then(docRef => {
            appointmentData.id = docRef.id;
            showAppointmentSummary(appointmentData);
        })
        .catch(error => {
            console.error('Error adding appointment:', error);
            showError('Erro ao confirmar agendamento. Por favor, tente novamente.');
            elements.btnConfirmar.disabled = false;
            elements.btnConfirmar.textContent = 'Confirmar Agendamento';
        });
}

// Validate form data
function validateForm() {
    let isValid = true;
    
    if (!selectedService) {
        showError('Por favor, selecione um serviço.');
        isValid = false;
    }
    
    if (!selectedDate) {
        showError('Por favor, selecione uma data.');
        isValid = false;
    }
    
    if (!selectedTime) {
        showError('Por favor, selecione um horário.');
        isValid = false;
    }
    
    if (!elements.documento.value.trim()) {
        showError('Por favor, informe seu CPF/CNPJ.');
        isValid = false;
    }
    
    if (!elements.nome.value.trim()) {
        showError('Por favor, informe seu nome completo.');
        isValid = false;
    }
    
    if (!elements.telefone.value.trim()) {
        showError('Por favor, informe seu telefone.');
        isValid = false;
    }
    
    return isValid;
}

// Show appointment summary
function showAppointmentSummary(appointment) {
    elements.formularioAgendamento.style.display = 'none';
    elements.resumoAgendamento.style.display = 'block';
    
    elements.resumoEmpresa.textContent = appointment.empresaNome;
    elements.resumoServico.textContent = appointment.servicoNome;
    elements.resumoAtendente.textContent = appointment.atendente;
    elements.resumoData.textContent = formatDate(appointment.data);
    elements.resumoHorario.textContent = appointment.horario;
    elements.resumoCliente.textContent = appointment.nome;
    elements.resumoDocumento.textContent = appointment.documento;
    elements.resumoContato.textContent = `${appointment.telefone}${appointment.email ? ' | ' + appointment.email : ''}`;
}

// Format date for display
function formatDate(dateStr) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', options);
}

// Show error message
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    
    setTimeout(() => {
        elements.errorMessage.style.display = 'none';
    }, 5000);
}
