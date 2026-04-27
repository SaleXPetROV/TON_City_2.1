import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
const API_URL = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Don't redirect, let the app handle it
    }
    return Promise.reject(error);
  }
);

// Auth
export const verifyWallet = async (address, proof = null, language = 'en') => {
  const response = await api.post('/auth/verify-wallet', {
    address,
    proof,
    language,
  });
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
  }
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

// Plots
export const getAllPlots = async () => {
  const response = await api.get('/plots');
  return response.data;
};

export const getPlotByCoords = async (x, y) => {
  const response = await api.get(`/plots/coords/${x}/${y}`);
  return response.data;
};

export const purchasePlot = async (x, y) => {
  const response = await api.post('/plots/purchase', {
    plot_x: x,
    plot_y: y,
  });
  return response.data;
};

export const confirmPlotPurchase = async (transactionId, blockchainHash = null) => {
  const response = await api.post('/plots/confirm-purchase', {
    transaction_id: transactionId,
    blockchain_hash: blockchainHash,
  });
  return response.data;
};

// Businesses
export const getBusinessTypes = async () => {
  const response = await api.get('/businesses/types');
  return response.data;
};

export const getAllBusinesses = async () => {
  const response = await api.get('/businesses');
  return response.data;
};

export const buildBusiness = async (plotId, businessType) => {
  const response = await api.post('/businesses/build', {
    plot_id: plotId,
    business_type: businessType,
  });
  return response.data;
};

export const confirmBusinessBuild = async (transactionId, blockchainHash = null) => {
  const response = await api.post('/businesses/confirm-build', {
    transaction_id: transactionId,
    blockchain_hash: blockchainHash,
  });
  return response.data;
};

// Transactions
export const getTransactions = async () => {
  const response = await api.get('/transactions');
  return response.data;
};

export const getTransaction = async (txId) => {
  const response = await api.get(`/transactions/${txId}`);
  return response.data;
};

// Stats
export const getGameStats = async () => {
  const response = await api.get('/stats');
  return response.data;
};

export const getLeaderboard = async () => {
  const response = await api.get('/leaderboard');
  return response.data;
};

// Trading
export const getUserContracts = async () => {
  const response = await api.get('/trade/contracts');
  return response.data;
};

export const createContract = async (contractData) => {
  const response = await api.post('/trade/contract', {
    seller_business_id: contractData.sellerBusinessId,
    buyer_business_id: contractData.buyerBusinessId,
    resource_type: contractData.resourceType,
    amount_per_hour: contractData.amountPerHour,
    price_per_unit: contractData.pricePerUnit,
    duration_days: contractData.durationDays,
  });
  return response.data;
};

export const acceptContract = async (contractId) => {
  const response = await api.post(`/trade/contract/accept/${contractId}`);
  return response.data;
};

export const spotTrade = async (tradeData) => {
  const response = await api.post('/trade/spot', {
    seller_business_id: tradeData.sellerBusinessId,
    buyer_business_id: tradeData.buyerBusinessId,
    resource_type: tradeData.resourceType,
    amount: tradeData.amount,
  });
  return response.data;
};

// TON Blockchain
export const getTonBalance = async (address) => {
  const response = await api.get(`/ton/balance/${address}`);
  return response.data;
};

export const verifyTonTransaction = async (txHash, expectedAmount, toAddress) => {
  const response = await api.post('/ton/verify-transaction', {
    tx_hash: txHash,
    expected_amount: expectedAmount,
    to_address: toAddress,
  });
  return response.data;
};

export const getTonTransactionHistory = async (address, limit = 10) => {
  const response = await api.get(`/ton/transaction-history/${address}`, {
    params: { limit },
  });
  return response.data;
};

// Income Collection
export const collectAllIncome = async () => {
  const response = await api.post('/income/collect-all');
  return response.data;
};

export const getPendingIncome = async () => {
  const response = await api.get('/income/pending');
  return response.data;
};

// Economy V2.0
export const getEconomyConfig = async () => {
  const response = await api.get('/economy/config');
  return response.data;
};

export const getBusinessLevels = async (businessType) => {
  const response = await api.get(`/economy/business-levels/${businessType}?lang=ru`);
  return response.data;
};

export const getMarketPrices = async () => {
  const response = await api.get('/economy/market-prices');
  return response.data;
};

export const getEconomySnapshots = async (limit = 24) => {
  const response = await api.get(`/economy/snapshots?limit=${limit}`);
  return response.data;
};

export const getMyResources = async () => {
  const response = await api.get('/economy/my-resources');
  return response.data;
};

export const tradeResource = async (resource, amount, pricePerUnit, action) => {
  const response = await api.post(`/economy/trade?resource=${resource}&amount=${amount}&price_per_unit=${pricePerUnit}&action=${action}`);
  return response.data;
};

export const getNpcStatus = async () => {
  const response = await api.get('/economy/npc-status');
  return response.data;
};

export const getIncomeTable = async (lang = 'ru') => {
  const response = await api.get(`/stats/income-table?lang=${lang}`);
  return response.data;
};

// Utils
export const tonToNano = (ton) => Math.floor(ton * 1e9).toString();
export const nanoToTon = (nano) => Number(nano) / 1e9;

export default api;
