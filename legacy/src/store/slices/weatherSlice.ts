import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WeatherData, ForecastData } from '../../services/weatherService';

interface WeatherState {
  current: WeatherData | null;
  forecast: ForecastData[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  city: string | null;
}

const initialState: WeatherState = {
  current: null,
  forecast: [],
  loading: false,
  error: null,
  lastUpdated: null,
  city: null,
};

const weatherSlice = createSlice({
  name: 'weather',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setWeather: (state, action: PayloadAction<WeatherData>) => {
      state.current = action.payload;
      state.error = null;
      state.lastUpdated = new Date().toISOString();
    },
    setForecast: (state, action: PayloadAction<ForecastData[]>) => {
      state.forecast = action.payload;
    },
    setCity: (state, action: PayloadAction<string | null>) => {
      state.city = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearWeather: (state) => {
      state.current = null;
      state.forecast = [];
      state.error = null;
      state.lastUpdated = null;
      state.city = null;
    },
  },
});

export const { 
  setLoading, 
  setWeather, 
  setForecast, 
  setCity, 
  setError, 
  clearWeather 
} = weatherSlice.actions;

export default weatherSlice.reducer;

