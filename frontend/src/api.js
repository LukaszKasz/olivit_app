import axios from 'axios';
import { getAppBasePath, withAppBasePath } from './appBase';

function getApiBaseUrl() {
    const appBasePath = getAppBasePath();

    if (appBasePath !== '/') {
        return appBasePath;
    }

    const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
    if (configuredApiBaseUrl) {
        return configuredApiBaseUrl;
    }

    if (import.meta.env.DEV) {
        return 'http://localhost:8001';
    }

    return window.location.origin;
}

const API_BASE_URL = getApiBaseUrl();

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests if available
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add interceptor for handling 401 errors
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            tokenManager.removeToken();
            window.location.href = withAppBasePath('/login');
        }
        return Promise.reject(error);
    }
);

// API functions
export const authAPI = {
    register: async (username, email, password) => {
        const response = await api.post('/register', { username, email, password });
        return response.data;
    },

    login: async (username, password) => {
        const response = await api.post('/login', { username, password });
        return response.data;
    },

    getCurrentUser: async () => {
        const response = await api.get('/me');
        return response.data;
    },
};

export const integrationSettingsAPI = {
    getSettings: async () => {
        const response = await api.get('/api/integrations/settings');
        return response.data;
    },
    updateSettings: async (payload) => {
        const response = await api.put('/api/integrations/settings', payload);
        return response.data;
    },
};

export const diagnosticsAPI = {
    getSystemDiagnostics: async () => {
        const response = await api.get('/api/system/diagnostics');
        return response.data;
    },
    getApiBaseUrl: () => API_BASE_URL,
    getDiagnosticsUrl: () => `${API_BASE_URL}/api/system/diagnostics`,
};

export const asanaAPI = {
    getCurrentUser: async () => {
        const response = await api.get('/api/asana/me');
        return response.data;
    },
    getTask: async (taskGid) => {
        const response = await api.get(`/api/asana/tasks/${taskGid}`);
        return response.data;
    },
    createComment: async (payload) => {
        const response = await api.post('/api/asana/comment', payload);
        return response.data;
    },
};

export const databaseBackupAPI = {
    exportDatabase: async () => {
        const response = await api.get('/api/database/export', {
            responseType: 'blob',
        });
        return response;
    },
    importDatabase: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post('/api/database/import', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
    getTables: async () => {
        const response = await api.get('/api/database/tables');
        return response.data;
    },
    clearTable: async (tableName) => {
        const response = await api.delete(`/api/database/tables/${tableName}`);
        return response.data;
    },
};

export const brdAPI = {
    download: async () => {
        const response = await api.get('/api/brd/download', {
            responseType: 'blob',
        });
        return response;
    },
};

export const mainProductsAPI = {
    getProducts: async (query = '') => {
        const response = await api.get('/api/main-products', {
            params: query ? { q: query } : {},
        });
        return response.data;
    },
    getDetails: async (productId) => {
        const response = await api.get(`/api/main-products/${productId}/details`);
        return response.data;
    },
    orderTests: async (payload) => {
        const response = await api.post('/api/main-products/ordered-tests', payload);
        return response.data;
    },
    getOrderedTests: async () => {
        const response = await api.get('/api/main-products/ordered-tests');
        return response.data;
    },
    updateOrderedTest: async (orderId, payload) => {
        const response = await api.patch(`/api/main-products/ordered-tests/${orderId}`, payload);
        return response.data;
    },
};

export const variantProductsAPI = {
    getProducts: async (query = '', page = 1, pageSize = 50) => {
        const response = await api.get('/api/variant-products', {
            params: {
                ...(query ? { q: query } : {}),
                page,
                page_size: pageSize,
            },
        });
        return response.data;
    },
    orderBatchTests: async (payload) => {
        const response = await api.post('/api/variant-products/batches/ordered-tests', payload);
        return response.data;
    },
    orderBatchTestsBulk: async (payload) => {
        const response = await api.post('/api/variant-products/batches/ordered-tests/bulk', payload);
        return response.data;
    },
    getOrderedBatchTests: async () => {
        const response = await api.get('/api/variant-products/batches/ordered-tests');
        return response.data;
    },
    getReleasedBatchTests: async () => {
        const response = await api.get('/api/variant-products/batches/released');
        return response.data;
    },
    getBatchRelatedLabelControls: async (orderId) => {
        const response = await api.get(`/api/variant-products/batches/${orderId}/related-label-controls`);
        return response.data;
    },
    getClarificationBatchTests: async () => {
        const response = await api.get('/api/variant-products/batches/to-clarify');
        return response.data;
    },
    getArchivedBatchTests: async () => {
        const response = await api.get('/api/variant-products/batches/archive');
        return response.data;
    },
    updateBatchTest: async (orderId, payload) => {
        const response = await api.patch(`/api/variant-products/batches/ordered-tests/${orderId}`, payload);
        return response.data;
    },
    createRetestBatchTest: async (payload) => {
        const response = await api.post('/api/variant-products/batches/retest', payload);
        return response.data;
    },
    archiveBatchTests: async (ids) => {
        const response = await api.post('/api/variant-products/batches/archive', { ids });
        return response.data;
    },
    saveBatchDocuments: async (payload) => {
        const response = await api.post('/api/variant-products/batches/documents', payload);
        return response.data;
    },
    generateBatchCoA: async (payload) => {
        const response = await api.post('/api/variant-products/batches/coa', payload, { responseType: 'blob' });
        return response;
    },
    getProjectDetails: async (projectNumber) => {
        const response = await api.get(`/api/variant-products/projects/${projectNumber}/details`);
        return response.data;
    },
    createFinishedProductControl: async (payload) => {
        const response = await api.post('/api/variant-products/finished-product-controls', payload);
        return response.data;
    },
    updateFinishedProductControlsStatus: async (payload) => {
        const response = await api.patch('/api/variant-products/finished-product-controls/status', payload);
        return response.data;
    },
    saveFinishedProductControlDocuments: async (payload) => {
        const response = await api.post('/api/variant-products/finished-product-controls/documents', payload);
        return response.data;
    },
    relabelFinishedProductControls: async (ids) => {
        const response = await api.post('/api/variant-products/finished-product-controls/relabel', { ids });
        return response.data;
    },
    createFinishedProductControlPlaceholders: async (payload) => {
        const response = await api.post('/api/variant-products/finished-product-controls/placeholders', payload);
        return response.data;
    },
    getFinishedProductControls: async () => {
        const response = await api.get('/api/variant-products/finished-product-controls');
        return response.data;
    },
};

// Token management
export const tokenManager = {
    setToken: (token) => {
        localStorage.setItem('token', token);
    },

    getToken: () => {
        return localStorage.getItem('token');
    },

    removeToken: () => {
        localStorage.removeItem('token');
    },

    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },
};

export default api;
