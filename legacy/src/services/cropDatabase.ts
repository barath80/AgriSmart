// Comprehensive Crop Database with detailed parameters for dynamic recommendations

export interface CropParameters {
  name: string;
  tamilName?: string;
  // Nutrient requirements (in kg/hectare or relative scale 0-100)
  nitrogen: { min: number; max: number; optimal: number };
  phosphorus: { min: number; max: number; optimal: number };
  potassium: { min: number; max: number; optimal: number };
  // Environmental requirements
  temperature: { min: number; max: number; optimal: number }; // Celsius
  humidity: { min: number; max: number; optimal: number }; // Percentage
  ph: { min: number; max: number; optimal: number };
  rainfall: { min: number; max: number; optimal: number }; // mm per year
  // Additional info
  description: string;
  idealConditions: string;
  season: string[]; // ['Kharif', 'Rabi', 'Zaid']
  soilType: string[]; // ['Clay', 'Loamy', 'Sandy', 'Alluvial']
  waterRequirement: 'Low' | 'Medium' | 'High';
  duration: string; // Growing period
  yield: string; // Expected yield range
}

// Comprehensive crop database with 50+ crops
export const cropDatabase: CropParameters[] = [
  // Cereals
  {
    name: 'Rice',
    tamilName: 'அரிசி',
    nitrogen: { min: 80, max: 120, optimal: 100 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 30, max: 50, optimal: 40 },
    temperature: { min: 20, max: 35, optimal: 28 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 5.5, max: 7.0, optimal: 6.5 },
    rainfall: { min: 1500, max: 2500, optimal: 2000 },
    description: 'Rice is a staple food crop that requires high water availability and warm temperatures. It is well-suited for regions with high rainfall and humidity.',
    idealConditions: 'pH: 5.5-7.0, Temperature: 20-35°C, Rainfall: 150-250cm, Humidity: 70-90%, High water requirement',
    season: ['Kharif', 'Rabi'],
    soilType: ['Clay', 'Loamy', 'Alluvial'],
    waterRequirement: 'High',
    duration: '120-150 days',
    yield: '4-6 tons/hectare',
  },
  {
    name: 'Wheat',
    tamilName: 'கோதுமை',
    nitrogen: { min: 100, max: 150, optimal: 120 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 30, max: 50, optimal: 40 },
    temperature: { min: 10, max: 25, optimal: 20 },
    humidity: { min: 40, max: 70, optimal: 55 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 500, max: 1000, optimal: 750 },
    description: 'Wheat grows well in cool, dry climates with moderate rainfall. It is a Rabi season crop that requires well-drained soil.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 10-25°C, Rainfall: 50-100cm, Humidity: 40-70%, Medium water requirement',
    season: ['Rabi'],
    soilType: ['Loamy', 'Clay', 'Alluvial'],
    waterRequirement: 'Medium',
    duration: '100-120 days',
    yield: '3-5 tons/hectare',
  },
  {
    name: 'Maize',
    tamilName: 'சோளம்',
    nitrogen: { min: 120, max: 180, optimal: 150 },
    phosphorus: { min: 50, max: 70, optimal: 60 },
    potassium: { min: 40, max: 60, optimal: 50 },
    temperature: { min: 18, max: 27, optimal: 22 },
    humidity: { min: 50, max: 80, optimal: 65 },
    ph: { min: 5.8, max: 7.0, optimal: 6.5 },
    rainfall: { min: 600, max: 1000, optimal: 800 },
    description: 'Maize is suitable for warm climates with adequate moisture. It requires well-drained soil and moderate rainfall.',
    idealConditions: 'pH: 5.8-7.0, Temperature: 18-27°C, Rainfall: 60-100cm, Humidity: 50-80%, Medium water requirement',
    season: ['Kharif', 'Rabi'],
    soilType: ['Loamy', 'Sandy Loam', 'Alluvial'],
    waterRequirement: 'Medium',
    duration: '90-100 days',
    yield: '5-7 tons/hectare',
  },
  {
    name: 'Barley',
    tamilName: 'வாற்கோதுமை',
    nitrogen: { min: 80, max: 120, optimal: 100 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 25, max: 40, optimal: 32 },
    temperature: { min: 12, max: 22, optimal: 18 },
    humidity: { min: 45, max: 65, optimal: 55 },
    ph: { min: 6.5, max: 8.0, optimal: 7.2 },
    rainfall: { min: 400, max: 800, optimal: 600 },
    description: 'Barley is a hardy crop that can tolerate drought and cold temperatures better than wheat. Suitable for Rabi season.',
    idealConditions: 'pH: 6.5-8.0, Temperature: 12-22°C, Rainfall: 40-80cm, Humidity: 45-65%, Low to Medium water requirement',
    season: ['Rabi'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'Low',
    duration: '90-110 days',
    yield: '2-4 tons/hectare',
  },
  {
    name: 'Sorghum',
    tamilName: 'சோளக்கம்பு',
    nitrogen: { min: 60, max: 100, optimal: 80 },
    phosphorus: { min: 25, max: 40, optimal: 32 },
    potassium: { min: 20, max: 35, optimal: 27 },
    temperature: { min: 25, max: 35, optimal: 30 },
    humidity: { min: 40, max: 70, optimal: 55 },
    ph: { min: 6.0, max: 8.5, optimal: 7.0 },
    rainfall: { min: 400, max: 800, optimal: 600 },
    description: 'Sorghum is a drought-tolerant crop suitable for semi-arid regions. It can grow in various soil types and requires less water.',
    idealConditions: 'pH: 6.0-8.5, Temperature: 25-35°C, Rainfall: 40-80cm, Humidity: 40-70%, Low water requirement',
    season: ['Kharif'],
    soilType: ['Sandy', 'Loamy', 'Clay'],
    waterRequirement: 'Low',
    duration: '100-120 days',
    yield: '2-3 tons/hectare',
  },
  {
    name: 'Pearl Millet',
    tamilName: 'கம்பு',
    nitrogen: { min: 50, max: 80, optimal: 65 },
    phosphorus: { min: 20, max: 35, optimal: 27 },
    potassium: { min: 15, max: 30, optimal: 22 },
    temperature: { min: 25, max: 35, optimal: 30 },
    humidity: { min: 35, max: 65, optimal: 50 },
    ph: { min: 6.5, max: 8.5, optimal: 7.5 },
    rainfall: { min: 300, max: 600, optimal: 450 },
    description: 'Pearl millet is highly drought-tolerant and suitable for arid and semi-arid regions. It grows well in poor soils.',
    idealConditions: 'pH: 6.5-8.5, Temperature: 25-35°C, Rainfall: 30-60cm, Humidity: 35-65%, Low water requirement',
    season: ['Kharif'],
    soilType: ['Sandy', 'Sandy Loam'],
    waterRequirement: 'Low',
    duration: '80-100 days',
    yield: '1.5-2.5 tons/hectare',
  },
  
  // Pulses
  {
    name: 'Chickpea',
    tamilName: 'கொண்டைக்கடலை',
    nitrogen: { min: 20, max: 40, optimal: 30 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 20, max: 40, optimal: 30 },
    temperature: { min: 15, max: 25, optimal: 20 },
    humidity: { min: 40, max: 70, optimal: 55 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 400, max: 800, optimal: 600 },
    description: 'Chickpea is a Rabi season pulse crop that fixes nitrogen in the soil. It requires cool temperatures and moderate rainfall.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 15-25°C, Rainfall: 40-80cm, Humidity: 40-70%, Low to Medium water requirement',
    season: ['Rabi'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'Low',
    duration: '90-120 days',
    yield: '1-2 tons/hectare',
  },
  {
    name: 'Pigeon Pea',
    tamilName: 'துவரை',
    nitrogen: { min: 15, max: 30, optimal: 22 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 20, max: 35, optimal: 27 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 50, max: 80, optimal: 65 },
    ph: { min: 5.5, max: 7.5, optimal: 6.5 },
    rainfall: { min: 600, max: 1400, optimal: 1000 },
    description: 'Pigeon pea is a drought-tolerant pulse crop that fixes nitrogen. It is suitable for Kharif season and can grow in various soil types.',
    idealConditions: 'pH: 5.5-7.5, Temperature: 20-30°C, Rainfall: 60-140cm, Humidity: 50-80%, Low to Medium water requirement',
    season: ['Kharif'],
    soilType: ['Loamy', 'Sandy Loam', 'Clay'],
    waterRequirement: 'Low',
    duration: '150-180 days',
    yield: '1-1.5 tons/hectare',
  },
  {
    name: 'Green Gram',
    tamilName: 'பாசிப்பயறு',
    nitrogen: { min: 20, max: 35, optimal: 27 },
    phosphorus: { min: 35, max: 50, optimal: 42 },
    potassium: { min: 20, max: 35, optimal: 27 },
    temperature: { min: 25, max: 35, optimal: 30 },
    humidity: { min: 50, max: 80, optimal: 65 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 600, max: 1000, optimal: 800 },
    description: 'Green gram is a Kharif season pulse crop that matures quickly. It fixes nitrogen and improves soil fertility.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 25-35°C, Rainfall: 60-100cm, Humidity: 50-80%, Medium water requirement',
    season: ['Kharif'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'Medium',
    duration: '60-80 days',
    yield: '0.8-1.2 tons/hectare',
  },
  {
    name: 'Black Gram',
    tamilName: 'உளுந்து',
    nitrogen: { min: 20, max: 35, optimal: 27 },
    phosphorus: { min: 35, max: 50, optimal: 42 },
    potassium: { min: 20, max: 35, optimal: 27 },
    temperature: { min: 25, max: 35, optimal: 30 },
    humidity: { min: 50, max: 80, optimal: 65 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 600, max: 1000, optimal: 800 },
    description: 'Black gram is similar to green gram but has a longer duration. It is a good Kharif season crop for rotation.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 25-35°C, Rainfall: 60-100cm, Humidity: 50-80%, Medium water requirement',
    season: ['Kharif'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'Medium',
    duration: '90-100 days',
    yield: '0.8-1.2 tons/hectare',
  },
  
  // Oilseeds
  {
    name: 'Groundnut',
    tamilName: 'நிலக்கடலை',
    nitrogen: { min: 15, max: 25, optimal: 20 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 30, max: 50, optimal: 40 },
    temperature: { min: 25, max: 35, optimal: 30 },
    humidity: { min: 50, max: 80, optimal: 65 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 500, max: 1000, optimal: 750 },
    description: 'Groundnut is a Kharif season oilseed crop that fixes nitrogen. It requires well-drained sandy loam soil.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 25-35°C, Rainfall: 50-100cm, Humidity: 50-80%, Low to Medium water requirement',
    season: ['Kharif'],
    soilType: ['Sandy Loam', 'Loamy'],
    waterRequirement: 'Low',
    duration: '100-120 days',
    yield: '1.5-2.5 tons/hectare',
  },
  {
    name: 'Soybean',
    tamilName: 'சோயாபீன்ஸ்',
    nitrogen: { min: 20, max: 30, optimal: 25 },
    phosphorus: { min: 50, max: 70, optimal: 60 },
    potassium: { min: 40, max: 60, optimal: 50 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 60, max: 85, optimal: 72 },
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    rainfall: { min: 600, max: 1200, optimal: 900 },
    description: 'Soybean is a high-protein oilseed crop that fixes nitrogen. It requires adequate moisture and well-drained soil.',
    idealConditions: 'pH: 6.0-7.0, Temperature: 20-30°C, Rainfall: 60-120cm, Humidity: 60-85%, Medium water requirement',
    season: ['Kharif'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'Medium',
    duration: '90-110 days',
    yield: '2-3 tons/hectare',
  },
  {
    name: 'Sunflower',
    tamilName: 'சூரியகாந்தி',
    nitrogen: { min: 60, max: 100, optimal: 80 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 40, max: 60, optimal: 50 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 45, max: 75, optimal: 60 },
    ph: { min: 6.0, max: 8.0, optimal: 7.0 },
    rainfall: { min: 400, max: 800, optimal: 600 },
    description: 'Sunflower is a versatile oilseed crop that can be grown in Kharif or Rabi season. It is relatively drought-tolerant.',
    idealConditions: 'pH: 6.0-8.0, Temperature: 20-30°C, Rainfall: 40-80cm, Humidity: 45-75%, Low to Medium water requirement',
    season: ['Kharif', 'Rabi'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'Low',
    duration: '80-100 days',
    yield: '1.5-2.5 tons/hectare',
  },
  {
    name: 'Mustard',
    tamilName: 'கடுகு',
    nitrogen: { min: 60, max: 100, optimal: 80 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 25, max: 40, optimal: 32 },
    temperature: { min: 10, max: 25, optimal: 18 },
    humidity: { min: 45, max: 70, optimal: 57 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 400, max: 800, optimal: 600 },
    description: 'Mustard is a Rabi season oilseed crop that requires cool temperatures. It is suitable for rotation with rice.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 10-25°C, Rainfall: 40-80cm, Humidity: 45-70%, Medium water requirement',
    season: ['Rabi'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'Medium',
    duration: '90-110 days',
    yield: '1.5-2 tons/hectare',
  },
  {
    name: 'Sesame',
    tamilName: 'எள்',
    nitrogen: { min: 40, max: 60, optimal: 50 },
    phosphorus: { min: 25, max: 40, optimal: 32 },
    potassium: { min: 20, max: 35, optimal: 27 },
    temperature: { min: 25, max: 35, optimal: 30 },
    humidity: { min: 50, max: 75, optimal: 62 },
    ph: { min: 5.5, max: 8.0, optimal: 6.8 },
    rainfall: { min: 400, max: 700, optimal: 550 },
    description: 'Sesame is a drought-tolerant oilseed crop suitable for Kharif season. It can grow in various soil types.',
    idealConditions: 'pH: 5.5-8.0, Temperature: 25-35°C, Rainfall: 40-70cm, Humidity: 50-75%, Low water requirement',
    season: ['Kharif'],
    soilType: ['Sandy Loam', 'Loamy'],
    waterRequirement: 'Low',
    duration: '80-100 days',
    yield: '0.5-1 ton/hectare',
  },
  
  // Vegetables
  {
    name: 'Tomato',
    tamilName: 'தக்காளி',
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 50, max: 80, optimal: 65 },
    potassium: { min: 100, max: 150, optimal: 125 },
    temperature: { min: 18, max: 27, optimal: 22 },
    humidity: { min: 60, max: 85, optimal: 72 },
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    rainfall: { min: 600, max: 1200, optimal: 900 },
    description: 'Tomato is a widely grown vegetable crop that requires moderate temperatures and adequate moisture. It needs well-drained fertile soil.',
    idealConditions: 'pH: 6.0-7.0, Temperature: 18-27°C, Rainfall: 60-120cm, Humidity: 60-85%, High water requirement',
    season: ['Kharif', 'Rabi', 'Zaid'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'High',
    duration: '90-120 days',
    yield: '25-40 tons/hectare',
  },
  {
    name: 'Potato',
    tamilName: 'உருளைக்கிழங்கு',
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 60, max: 100, optimal: 80 },
    potassium: { min: 120, max: 180, optimal: 150 },
    temperature: { min: 15, max: 25, optimal: 20 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 5.5, max: 6.5, optimal: 6.0 },
    rainfall: { min: 800, max: 1400, optimal: 1100 },
    description: 'Potato is a cool-season crop that requires high humidity and adequate moisture. It needs well-drained sandy loam soil.',
    idealConditions: 'pH: 5.5-6.5, Temperature: 15-25°C, Rainfall: 80-140cm, Humidity: 70-90%, High water requirement',
    season: ['Rabi'],
    soilType: ['Sandy Loam', 'Loamy'],
    waterRequirement: 'High',
    duration: '90-100 days',
    yield: '20-30 tons/hectare',
  },
  {
    name: 'Onion',
    tamilName: 'வெங்காயம்',
    nitrogen: { min: 80, max: 120, optimal: 100 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 60, max: 100, optimal: 80 },
    temperature: { min: 13, max: 24, optimal: 18 },
    humidity: { min: 60, max: 80, optimal: 70 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 500, max: 1000, optimal: 750 },
    description: 'Onion is a Rabi season vegetable that requires cool temperatures and moderate rainfall. It needs well-drained fertile soil.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 13-24°C, Rainfall: 50-100cm, Humidity: 60-80%, Medium water requirement',
    season: ['Rabi'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'Medium',
    duration: '120-150 days',
    yield: '15-25 tons/hectare',
  },
  {
    name: 'Chili',
    tamilName: 'மிளகாய்',
    nitrogen: { min: 80, max: 120, optimal: 100 },
    phosphorus: { min: 50, max: 70, optimal: 60 },
    potassium: { min: 80, max: 120, optimal: 100 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 50, max: 75, optimal: 62 },
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    rainfall: { min: 600, max: 1000, optimal: 800 },
    description: 'Chili is a warm-season crop that requires moderate temperatures and adequate moisture. It can be grown in Kharif and Rabi seasons.',
    idealConditions: 'pH: 6.0-7.0, Temperature: 20-30°C, Rainfall: 60-100cm, Humidity: 50-75%, Medium water requirement',
    season: ['Kharif', 'Rabi'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'Medium',
    duration: '120-150 days',
    yield: '15-20 tons/hectare',
  },
  {
    name: 'Brinjal',
    tamilName: 'கத்தரி',
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 50, max: 80, optimal: 65 },
    potassium: { min: 80, max: 120, optimal: 100 },
    temperature: { min: 22, max: 32, optimal: 27 },
    humidity: { min: 60, max: 85, optimal: 72 },
    ph: { min: 5.5, max: 6.5, optimal: 6.0 },
    rainfall: { min: 600, max: 1200, optimal: 900 },
    description: 'Brinjal is a warm-season vegetable that requires high temperatures and adequate moisture. It needs well-drained fertile soil.',
    idealConditions: 'pH: 5.5-6.5, Temperature: 22-32°C, Rainfall: 60-120cm, Humidity: 60-85%, High water requirement',
    season: ['Kharif', 'Rabi'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'High',
    duration: '120-150 days',
    yield: '25-35 tons/hectare',
  },
  {
    name: 'Okra',
    tamilName: 'வெண்டை',
    nitrogen: { min: 80, max: 120, optimal: 100 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 60, max: 100, optimal: 80 },
    temperature: { min: 24, max: 35, optimal: 30 },
    humidity: { min: 55, max: 80, optimal: 67 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 600, max: 1000, optimal: 800 },
    description: 'Okra is a warm-season vegetable that requires high temperatures and moderate rainfall. It is suitable for Kharif season.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 24-35°C, Rainfall: 60-100cm, Humidity: 55-80%, Medium water requirement',
    season: ['Kharif'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'Medium',
    duration: '90-100 days',
    yield: '12-15 tons/hectare',
  },
  {
    name: 'Cucumber',
    tamilName: 'வெள்ளரிக்காய்',
    nitrogen: { min: 80, max: 120, optimal: 100 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 80, max: 120, optimal: 100 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    rainfall: { min: 800, max: 1200, optimal: 1000 },
    description: 'Cucumber is a warm-season vegetable that requires high humidity and adequate moisture. It needs well-drained fertile soil.',
    idealConditions: 'pH: 6.0-7.0, Temperature: 20-30°C, Rainfall: 80-120cm, Humidity: 70-90%, High water requirement',
    season: ['Kharif', 'Zaid'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'High',
    duration: '60-70 days',
    yield: '15-20 tons/hectare',
  },
  {
    name: 'Cauliflower',
    tamilName: 'காலிஃப்ளவர்',
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 50, max: 80, optimal: 65 },
    potassium: { min: 80, max: 120, optimal: 100 },
    temperature: { min: 15, max: 22, optimal: 18 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    rainfall: { min: 600, max: 1000, optimal: 800 },
    description: 'Cauliflower is a cool-season vegetable that requires low temperatures and high humidity. It is a Rabi season crop.',
    idealConditions: 'pH: 6.0-7.0, Temperature: 15-22°C, Rainfall: 60-100cm, Humidity: 70-90%, High water requirement',
    season: ['Rabi'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'High',
    duration: '90-120 days',
    yield: '20-25 tons/hectare',
  },
  {
    name: 'Cabbage',
    tamilName: 'முட்டைக்கோசு',
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 50, max: 80, optimal: 65 },
    potassium: { min: 80, max: 120, optimal: 100 },
    temperature: { min: 15, max: 20, optimal: 17 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    rainfall: { min: 600, max: 1000, optimal: 800 },
    description: 'Cabbage is a cool-season vegetable that requires low temperatures and high humidity. It is suitable for Rabi season.',
    idealConditions: 'pH: 6.0-7.0, Temperature: 15-20°C, Rainfall: 60-100cm, Humidity: 70-90%, High water requirement',
    season: ['Rabi'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'High',
    duration: '90-120 days',
    yield: '25-30 tons/hectare',
  },
  
  // Cash Crops
  {
    name: 'Cotton',
    tamilName: 'பருத்தி',
    nitrogen: { min: 80, max: 120, optimal: 100 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 40, max: 60, optimal: 50 },
    temperature: { min: 21, max: 30, optimal: 25 },
    humidity: { min: 50, max: 80, optimal: 65 },
    ph: { min: 5.8, max: 8.0, optimal: 7.0 },
    rainfall: { min: 500, max: 1000, optimal: 750 },
    description: 'Cotton is a Kharif season cash crop that requires warm temperatures and moderate rainfall. It needs deep well-drained soil.',
    idealConditions: 'pH: 5.8-8.0, Temperature: 21-30°C, Rainfall: 50-100cm, Humidity: 50-80%, Medium water requirement',
    season: ['Kharif'],
    soilType: ['Black Cotton', 'Loamy', 'Alluvial'],
    waterRequirement: 'Medium',
    duration: '150-180 days',
    yield: '2-3 tons/hectare (lint)',
  },
  {
    name: 'Sugarcane',
    tamilName: 'கரும்பு',
    nitrogen: { min: 200, max: 300, optimal: 250 },
    phosphorus: { min: 60, max: 100, optimal: 80 },
    potassium: { min: 100, max: 150, optimal: 125 },
    temperature: { min: 26, max: 32, optimal: 29 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 1500, max: 2500, optimal: 2000 },
    description: 'Sugarcane is a long-duration crop that requires high temperatures, high humidity, and abundant water. It needs deep fertile soil.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 26-32°C, Rainfall: 150-250cm, Humidity: 70-90%, High water requirement',
    season: ['Kharif'],
    soilType: ['Alluvial', 'Black Cotton', 'Loamy'],
    waterRequirement: 'High',
    duration: '10-12 months',
    yield: '70-100 tons/hectare',
  },
  {
    name: 'Tobacco',
    tamilName: 'புகையிலை',
    nitrogen: { min: 60, max: 100, optimal: 80 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 80, max: 120, optimal: 100 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 50, max: 75, optimal: 62 },
    ph: { min: 5.5, max: 6.5, optimal: 6.0 },
    rainfall: { min: 500, max: 900, optimal: 700 },
    description: 'Tobacco is a cash crop that requires moderate temperatures and rainfall. It needs well-drained fertile soil.',
    idealConditions: 'pH: 5.5-6.5, Temperature: 20-30°C, Rainfall: 50-90cm, Humidity: 50-75%, Medium water requirement',
    season: ['Kharif', 'Rabi'],
    soilType: ['Sandy Loam', 'Loamy'],
    waterRequirement: 'Medium',
    duration: '120-150 days',
    yield: '1.5-2 tons/hectare',
  },
  
  // Fruits
  {
    name: 'Mango',
    tamilName: 'மாம்பழம்',
    nitrogen: { min: 150, max: 200, optimal: 175 },
    phosphorus: { min: 50, max: 80, optimal: 65 },
    potassium: { min: 100, max: 150, optimal: 125 },
    temperature: { min: 24, max: 30, optimal: 27 },
    humidity: { min: 60, max: 85, optimal: 72 },
    ph: { min: 5.5, max: 7.5, optimal: 6.5 },
    rainfall: { min: 750, max: 2500, optimal: 1625 },
    description: 'Mango is a tropical fruit tree that requires warm temperatures and moderate to high rainfall. It needs deep well-drained soil.',
    idealConditions: 'pH: 5.5-7.5, Temperature: 24-30°C, Rainfall: 75-250cm, Humidity: 60-85%, Medium to High water requirement',
    season: ['Perennial'],
    soilType: ['Alluvial', 'Loamy', 'Sandy Loam'],
    waterRequirement: 'Medium',
    duration: 'Perennial (fruits in 5-8 years)',
    yield: '10-15 tons/hectare (mature trees)',
  },
  {
    name: 'Banana',
    tamilName: 'வாழை',
    nitrogen: { min: 200, max: 300, optimal: 250 },
    phosphorus: { min: 60, max: 100, optimal: 80 },
    potassium: { min: 300, max: 400, optimal: 350 },
    temperature: { min: 22, max: 32, optimal: 27 },
    humidity: { min: 75, max: 90, optimal: 82 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 1500, max: 2500, optimal: 2000 },
    description: 'Banana is a tropical fruit that requires high temperatures, high humidity, and abundant water. It needs deep fertile well-drained soil.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 22-32°C, Rainfall: 150-250cm, Humidity: 75-90%, High water requirement',
    season: ['Perennial'],
    soilType: ['Alluvial', 'Loamy', 'Clay Loam'],
    waterRequirement: 'High',
    duration: '12-15 months',
    yield: '40-50 tons/hectare',
  },
  {
    name: 'Coconut',
    tamilName: 'தேங்காய்',
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 200, max: 300, optimal: 250 },
    temperature: { min: 27, max: 32, optimal: 29 },
    humidity: { min: 80, max: 90, optimal: 85 },
    ph: { min: 5.5, max: 8.0, optimal: 6.5 },
    rainfall: { min: 1500, max: 3000, optimal: 2250 },
    description: 'Coconut is a tropical palm that requires high temperatures, high humidity, and abundant rainfall. It grows well in coastal areas.',
    idealConditions: 'pH: 5.5-8.0, Temperature: 27-32°C, Rainfall: 150-300cm, Humidity: 80-90%, High water requirement',
    season: ['Perennial'],
    soilType: ['Sandy', 'Sandy Loam', 'Alluvial'],
    waterRequirement: 'High',
    duration: 'Perennial (fruits in 5-7 years)',
    yield: '80-100 nuts/palm/year',
  },
  
  // Spices
  {
    name: 'Turmeric',
    tamilName: 'மஞ்சள்',
    nitrogen: { min: 60, max: 100, optimal: 80 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 80, max: 120, optimal: 100 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 5.5, max: 7.5, optimal: 6.5 },
    rainfall: { min: 1000, max: 2000, optimal: 1500 },
    description: 'Turmeric is a spice crop that requires warm temperatures, high humidity, and adequate rainfall. It needs well-drained fertile soil.',
    idealConditions: 'pH: 5.5-7.5, Temperature: 20-30°C, Rainfall: 100-200cm, Humidity: 70-90%, High water requirement',
    season: ['Kharif'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'High',
    duration: '7-9 months',
    yield: '20-25 tons/hectare (fresh)',
  },
  {
    name: 'Ginger',
    tamilName: 'இஞ்சி',
    nitrogen: { min: 60, max: 100, optimal: 80 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 80, max: 120, optimal: 100 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 5.5, max: 6.5, optimal: 6.0 },
    rainfall: { min: 1000, max: 2000, optimal: 1500 },
    description: 'Ginger is a spice crop similar to turmeric. It requires warm temperatures, high humidity, and adequate rainfall.',
    idealConditions: 'pH: 5.5-6.5, Temperature: 20-30°C, Rainfall: 100-200cm, Humidity: 70-90%, High water requirement',
    season: ['Kharif'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'High',
    duration: '8-10 months',
    yield: '15-20 tons/hectare (fresh)',
  },
  {
    name: 'Black Pepper',
    tamilName: 'மிளகு',
    nitrogen: { min: 50, max: 80, optimal: 65 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 100, max: 150, optimal: 125 },
    temperature: { min: 20, max: 30, optimal: 25 },
    humidity: { min: 75, max: 90, optimal: 82 },
    ph: { min: 5.5, max: 6.5, optimal: 6.0 },
    rainfall: { min: 2000, max: 3000, optimal: 2500 },
    description: 'Black pepper is a climbing spice crop that requires warm temperatures, very high humidity, and abundant rainfall. It needs well-drained fertile soil.',
    idealConditions: 'pH: 5.5-6.5, Temperature: 20-30°C, Rainfall: 200-300cm, Humidity: 75-90%, High water requirement',
    season: ['Perennial'],
    soilType: ['Loamy', 'Clay Loam'],
    waterRequirement: 'High',
    duration: 'Perennial (fruits in 3-4 years)',
    yield: '1-2 tons/hectare (dry)',
  },
  
  // Additional crops
  {
    name: 'Jute',
    tamilName: 'சணல்',
    nitrogen: { min: 60, max: 100, optimal: 80 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 40, max: 60, optimal: 50 },
    temperature: { min: 24, max: 35, optimal: 30 },
    humidity: { min: 70, max: 90, optimal: 80 },
    ph: { min: 6.0, max: 7.5, optimal: 6.8 },
    rainfall: { min: 1500, max: 2500, optimal: 2000 },
    description: 'Jute is a fiber crop that requires high temperatures, high humidity, and abundant rainfall. It needs alluvial soil with good drainage.',
    idealConditions: 'pH: 6.0-7.5, Temperature: 24-35°C, Rainfall: 150-250cm, Humidity: 70-90%, High water requirement',
    season: ['Kharif'],
    soilType: ['Alluvial', 'Loamy'],
    waterRequirement: 'High',
    duration: '120-150 days',
    yield: '2-3 tons/hectare (fiber)',
  },
  {
    name: 'Tea',
    tamilName: 'தேயிலை',
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 30, max: 50, optimal: 40 },
    potassium: { min: 50, max: 80, optimal: 65 },
    temperature: { min: 18, max: 25, optimal: 21 },
    humidity: { min: 80, max: 90, optimal: 85 },
    ph: { min: 4.5, max: 5.5, optimal: 5.0 },
    rainfall: { min: 1500, max: 2500, optimal: 2000 },
    description: 'Tea is a plantation crop that requires cool temperatures, very high humidity, and abundant rainfall. It needs acidic well-drained soil.',
    idealConditions: 'pH: 4.5-5.5, Temperature: 18-25°C, Rainfall: 150-250cm, Humidity: 80-90%, High water requirement',
    season: ['Perennial'],
    soilType: ['Loamy', 'Sandy Loam'],
    waterRequirement: 'High',
    duration: 'Perennial (harvestable in 3-4 years)',
    yield: '2-3 tons/hectare (made tea)',
  },
  {
    name: 'Coffee',
    tamilName: 'காபி',
    nitrogen: { min: 100, max: 150, optimal: 125 },
    phosphorus: { min: 40, max: 60, optimal: 50 },
    potassium: { min: 100, max: 150, optimal: 125 },
    temperature: { min: 18, max: 24, optimal: 21 },
    humidity: { min: 70, max: 85, optimal: 77 },
    ph: { min: 5.5, max: 6.5, optimal: 6.0 },
    rainfall: { min: 1500, max: 2500, optimal: 2000 },
    description: 'Coffee is a plantation crop that requires cool temperatures, high humidity, and abundant rainfall. It needs well-drained fertile soil.',
    idealConditions: 'pH: 5.5-6.5, Temperature: 18-24°C, Rainfall: 150-250cm, Humidity: 70-85%, High water requirement',
    season: ['Perennial'],
    soilType: ['Loamy', 'Volcanic'],
    waterRequirement: 'High',
    duration: 'Perennial (fruits in 3-4 years)',
    yield: '1-2 tons/hectare (green beans)',
  },
];

// Helper function to calculate compatibility score for a crop based on input parameters
export function calculateCropScore(
  crop: CropParameters,
  inputs: {
    n: number;
    p: number;
    k: number;
    temperature: number;
    humidity: number;
    ph: number;
    rainfall: number;
  }
): number {
  let totalScore = 0;
  let weightSum = 0;

  // Weight for each parameter (higher weight = more important)
  const weights = {
    nitrogen: 0.15,
    phosphorus: 0.15,
    potassium: 0.15,
    temperature: 0.20,
    humidity: 0.10,
    ph: 0.15,
    rainfall: 0.10,
  };

  // Calculate score for each parameter (0-100 scale)
  const calculateParameterScore = (
    value: number,
    min: number,
    max: number,
    optimal: number
  ): number => {
    // If value is within range
    if (value >= min && value <= max) {
      // Calculate distance from optimal (closer to optimal = higher score)
      const range = max - min;
      const distanceFromOptimal = Math.abs(value - optimal);
      const maxDistance = Math.max(optimal - min, max - optimal);
      
      // Score decreases as we move away from optimal
      // Score is 100 at optimal, decreases to ~70 at min/max
      const score = 100 - (distanceFromOptimal / maxDistance) * 30;
      return Math.max(70, Math.min(100, score));
    } else {
      // If value is outside range, calculate penalty
      let penalty = 0;
      if (value < min) {
        penalty = ((min - value) / min) * 50; // Penalty for being below min
      } else if (value > max) {
        penalty = ((value - max) / max) * 50; // Penalty for being above max
      }
      return Math.max(0, 100 - penalty);
    }
  };

  // Calculate scores for each parameter
  const nScore = calculateParameterScore(
    inputs.n,
    crop.nitrogen.min,
    crop.nitrogen.max,
    crop.nitrogen.optimal
  );
  const pScore = calculateParameterScore(
    inputs.p,
    crop.phosphorus.min,
    crop.phosphorus.max,
    crop.phosphorus.optimal
  );
  const kScore = calculateParameterScore(
    inputs.k,
    crop.potassium.min,
    crop.potassium.max,
    crop.potassium.optimal
  );
  const tempScore = calculateParameterScore(
    inputs.temperature,
    crop.temperature.min,
    crop.temperature.max,
    crop.temperature.optimal
  );
  const humidityScore = calculateParameterScore(
    inputs.humidity,
    crop.humidity.min,
    crop.humidity.max,
    crop.humidity.optimal
  );
  const phScore = calculateParameterScore(
    inputs.ph,
    crop.ph.min,
    crop.ph.max,
    crop.ph.optimal
  );
  const rainfallScore = calculateParameterScore(
    inputs.rainfall,
    crop.rainfall.min,
    crop.rainfall.max,
    crop.rainfall.optimal
  );

  // Calculate weighted average
  totalScore =
    nScore * weights.nitrogen +
    pScore * weights.phosphorus +
    kScore * weights.potassium +
    tempScore * weights.temperature +
    humidityScore * weights.humidity +
    phScore * weights.ph +
    rainfallScore * weights.rainfall;

  weightSum =
    weights.nitrogen +
    weights.phosphorus +
    weights.potassium +
    weights.temperature +
    weights.humidity +
    weights.ph +
    weights.rainfall;

  const finalScore = totalScore / weightSum;
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, finalScore));
}

// Main recommendation function
export function getDynamicCropRecommendations(
  inputs: {
    n: string;
    p: string;
    k: string;
    temperature: string;
    humidity: string;
    ph: string;
    rainfall: string;
  },
  topN: number = 5
): Array<{
  crop: string;
  tamilName?: string;
  confidence: number;
  description: string;
  idealConditions: string;
  score: number;
}> {
  // Parse inputs to numbers
  const n = parseFloat(inputs.n) || 0;
  const p = parseFloat(inputs.p) || 0;
  const k = parseFloat(inputs.k) || 0;
  const temperature = parseFloat(inputs.temperature) || 0;
  const humidity = parseFloat(inputs.humidity) || 0;
  const ph = parseFloat(inputs.ph) || 7;
  const rainfall = parseFloat(inputs.rainfall) || 0;

  // Validate inputs
  if (n === 0 && p === 0 && k === 0 && temperature === 0 && humidity === 0 && ph === 7 && rainfall === 0) {
    return [];
  }

  // Convert rainfall from mm to cm for comparison with database (1 cm = 10 mm)
  // Database stores annual rainfall in cm, user input is typically in mm
  // If rainfall value is > 1000, assume it's in mm and convert to cm
  // Otherwise, assume it's already in cm
  const rainfallCm = rainfall > 1000 ? rainfall / 10 : rainfall;

  // Calculate scores for all crops
  const cropScores = cropDatabase.map((crop) => {
    const score = calculateCropScore(crop, {
      n,
      p,
      k,
      temperature,
      humidity,
      ph,
      rainfall: rainfallCm, // Use cm for rainfall
    });

    return {
      crop: crop.name,
      tamilName: crop.tamilName,
      confidence: Math.round(score),
      description: crop.description,
      idealConditions: crop.idealConditions,
      score: score,
    };
  });

  // Sort by score (descending) and get top N
  const sortedCrops = cropScores
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .filter((crop) => crop.score > 30); // Only return crops with score > 30%

  return sortedCrops;
}

