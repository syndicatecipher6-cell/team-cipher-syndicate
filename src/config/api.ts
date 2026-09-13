export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '',
  useMockData: import.meta.env.VITE_USE_MOCK_DATA !== 'false',
};
