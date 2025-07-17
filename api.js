// api.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializa o Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Função para formatar valores especiais (datas, objetos, arrays)
function formatValue(value) {
    if (value === null || value === undefined) return value;
    
    if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
    }
    
    if (typeof value === 'object' && !Array.isArray(value)) {
        let obj = {};
        for (const [key, val] of Object.entries(value)) {
            obj[key] = formatValue(val);
        }
        return obj;
    }
    
    if (Array.isArray(value)) {
        return value.map(item => formatValue(item));
    }
    
    return value;
}

// Endpoint principal da API
exports.getEmpresas = functions.https.onRequest(async (req, res) => {
    try {
        // Configura CORS para permitir requisições de qualquer origem
        res.set('Access-Control-Allow-Origin', '*');
        
        if (req.method === 'OPTIONS') {
            // Envia resposta para pré-voo CORS
            res.set('Access-Control-Allow-Methods', 'GET');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            res.set('Access-Control-Max-Age', '3600');
            return res.status(204).send('');
        }

        // Busca todas as empresas na coleção 'usuarios'
        const snapshot = await db.collection('usuarios')
            .where('tipo', '==', 'empresa')
            .get();

        const empresas = [];
        snapshot.forEach(doc => {
            empresas.push({
                id: doc.id,
                ...formatValue(doc.data())
            });
        });

        // Retorna os dados formatados como JSON
        const responseData = {
            empresas: empresas,
            lastUpdated: new Date().toISOString(),
            count: empresas.length
        };

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('Erro ao buscar empresas:', error);
        return res.status(500).json({
            error: 'Ocorreu um erro ao processar sua requisição',
            details: error.message
        });
    }
});

// Endpoint para buscar uma empresa específica por ID
exports.getEmpresaById = functions.https.onRequest(async (req, res) => {
    try {
        // Configura CORS
        res.set('Access-Control-Allow-Origin', '*');
        
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Methods', 'GET');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            res.set('Access-Control-Max-Age', '3600');
            return res.status(204).send('');
        }

        const empresaId = req.query.id || req.body.id;
        
        if (!empresaId) {
            return res.status(400).json({
                error: 'Parâmetro "id" é obrigatório'
            });
        }

        const doc = await db.collection('usuarios').doc(empresaId).get();
        
        if (!doc.exists) {
            return res.status(404).json({
                error: 'Empresa não encontrada'
            });
        }

        const data = doc.data();
        if (data.tipo !== 'empresa') {
            return res.status(404).json({
                error: 'O ID fornecido não corresponde a uma empresa'
            });
        }

        return res.status(200).json({
            ...formatValue(data),
            id: doc.id,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erro ao buscar empresa:', error);
        return res.status(500).json({
            error: 'Ocorreu um erro ao processar sua requisição',
            details: error.message
        });
    }
});
