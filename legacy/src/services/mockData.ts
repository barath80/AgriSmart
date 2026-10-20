// Mock data for all features - ensures app works offline/demo mode
export const MOCK_MODE = __DEV__; // Use mock mode in development by default

// Mock Weather Data
export const mockWeatherData = {
  temperature: 28,
  humidity: 65,
  pressure: 1013,
  windSpeed: 12,
  windDirection: 180,
  description: 'Partly cloudy',
  icon: '116.png',
  feelsLike: 30,
  visibility: 10,
  soilMoisture: 45,
  timestamp: new Date().toISOString(),
};

export const mockForecastData = [
  { date: 'Today', temperature: 28, minTemp: 25, maxTemp: 32, description: 'Partly cloudy', icon: '116.png', humidity: 65, windSpeed: 12 },
  { date: 'Tomorrow', temperature: 27, minTemp: 24, maxTemp: 31, description: 'Sunny', icon: '113.png', humidity: 60, windSpeed: 10 },
  { date: 'Day 3', temperature: 29, minTemp: 26, maxTemp: 33, description: 'Clear', icon: '113.png', humidity: 58, windSpeed: 14 },
  { date: 'Day 4', temperature: 26, minTemp: 23, maxTemp: 30, description: 'Light rain', icon: '296.png', humidity: 75, windSpeed: 8 },
  { date: 'Day 5', temperature: 28, minTemp: 25, maxTemp: 32, description: 'Partly cloudy', icon: '116.png', humidity: 62, windSpeed: 11 },
  { date: 'Day 6', temperature: 30, minTemp: 27, maxTemp: 34, description: 'Sunny', icon: '113.png', humidity: 55, windSpeed: 13 },
  { date: 'Day 7', temperature: 27, minTemp: 24, maxTemp: 31, description: 'Cloudy', icon: '119.png', humidity: 68, windSpeed: 9 },
];

// Mock Market Prices
export const mockMarketPrices = [
  { cropName: 'Rice', cropNameTamil: 'அரிசி', currentPrice: 45, unit: 'kg', trend: 'stable' as const, history: [] },
  { cropName: 'Wheat', cropNameTamil: 'கோதுமை', currentPrice: 38, unit: 'kg', trend: 'stable' as const, history: [] },
  { cropName: 'Tomato', cropNameTamil: 'தக்காளி', currentPrice: 60, unit: 'kg', trend: 'stable' as const, history: [] },
  { cropName: 'Onion', cropNameTamil: 'வெங்காயம்', currentPrice: 35, unit: 'kg', trend: 'stable' as const, history: [] },
  { cropName: 'Potato', cropNameTamil: 'உருளைக்கிழங்கு', currentPrice: 25, unit: 'kg', trend: 'stable' as const, history: [] },
  { cropName: 'Cotton', cropNameTamil: 'பருத்தி', currentPrice: 85, unit: 'kg', trend: 'stable' as const, history: [] },
  { cropName: 'Sugarcane', cropNameTamil: 'கரும்பு', currentPrice: 3.5, unit: 'kg', trend: 'stable' as const, history: [] },
];

// Mock Crop Recommendations
export const mockCropRecommendations = [
  {
    name: 'Rice',
    tamilName: 'அரிசி',
    confidence: 0.85,
    description: 'Rice is well-suited for your soil conditions. Requires high water availability and warm temperatures.',
    idealConditions: 'pH: 6-7, Temperature: 20-35°C, Rainfall: 150-200cm',
  },
  {
    name: 'Wheat',
    tamilName: 'கோதுமை',
    confidence: 0.78,
    description: 'Wheat grows well in cool, dry climates with moderate rainfall.',
    idealConditions: 'pH: 6-7.5, Temperature: 10-25°C, Rainfall: 50-100cm',
  },
  {
    name: 'Maize',
    tamilName: 'சோளம்',
    confidence: 0.72,
    description: 'Maize is suitable for warm climates with adequate moisture.',
    idealConditions: 'pH: 6-7, Temperature: 18-27°C, Rainfall: 60-100cm',
  },
];

// Mock Disease Detection Results
export const mockDiseaseResults = [
  {
    name: 'Leaf Blight',
    tamilName: 'இலை பிளைட்',
    accuracy: 0.92,
    cure: [
      'Remove and destroy infected leaves',
      'Apply fungicide spray (Copper-based)',
      'Improve air circulation around plants',
      'Avoid overhead watering',
    ],
    prevention: [
      'Plant disease-resistant varieties',
      'Maintain proper spacing between plants',
      'Water at the base of plants',
      'Use clean tools and equipment',
    ],
  },
  {
    name: 'Powdery Mildew',
    tamilName: 'பவுடரி மில்டியூ',
    accuracy: 0.88,
    cure: [
      'Apply sulfur-based fungicide',
      'Remove heavily infected leaves',
      'Increase air circulation',
      'Reduce nitrogen fertilizer',
    ],
    prevention: [
      'Plant in well-ventilated areas',
      'Avoid overcrowding',
      'Water in the morning to allow leaves to dry',
      'Choose resistant varieties',
    ],
  },
];

// Mock Pest Detection Results - Expanded list
export const mockPestResults = [
  {
    name: 'Aphids',
    tamilName: 'அஃபிட்ஸ்',
    affectedCrop: 'Multiple crops (Rice, Wheat, Vegetables)',
    remedies: [
      'Spray with neem oil solution (2-3ml per liter)',
      'Introduce beneficial insects (ladybugs)',
      'Use insecticidal soap',
      'Remove heavily infested leaves',
    ],
    naturalControl: [
      'Garlic spray (crush 5-6 cloves in 1 liter water)',
      'Mix chili pepper with water and spray',
      'Plant companion plants like marigold',
      'Use reflective mulch',
    ],
  },
  {
    name: 'Whiteflies',
    tamilName: 'வைட் ஃப்ளைஸ்',
    affectedCrop: 'Tomato, Cotton, Vegetables',
    remedies: [
      'Yellow sticky traps',
      'Neem oil spray',
      'Insecticidal soap',
      'Beneficial nematodes',
    ],
    naturalControl: [
      'Plant trap crops like nasturtium',
      'Use yellow-colored plastic sheets',
      'Introduce parasitic wasps',
      'Maintain garden hygiene',
    ],
  },
  {
    name: 'Armyworms',
    tamilName: 'அர்மி புழுக்கள்',
    affectedCrop: 'Rice, Maize, Wheat, Sugarcane',
    remedies: [
      'Apply Bacillus thuringiensis (Bt) based insecticides',
      'Use neem-based pesticides',
      'Handpick and destroy larvae',
      'Use light traps to catch moths',
    ],
    naturalControl: [
      'Encourage natural predators (birds, spiders)',
      'Practice crop rotation',
      'Use pheromone traps',
      'Apply diatomaceous earth around plants',
    ],
  },
  {
    name: 'Brown Plant Hopper',
    tamilName: 'பழுப்பு தாவர ஹாபர்',
    affectedCrop: 'Rice',
    remedies: [
      'Drain water from fields for 2-3 days',
      'Apply insecticides like imidacloprid',
      'Use resistant rice varieties',
      'Maintain proper water level',
    ],
    naturalControl: [
      'Release natural enemies (spiders, mirid bugs)',
      'Avoid excessive nitrogen fertilizer',
      'Use balanced fertilizer application',
      'Practice synchronized planting',
    ],
  },
  {
    name: 'Thrips',
    tamilName: 'த்ரிப்ஸ்',
    affectedCrop: 'Cotton, Onion, Chili, Tomato',
    remedies: [
      'Spray spinosad-based insecticides',
      'Use yellow or blue sticky traps',
      'Apply neem oil spray',
      'Remove and destroy infected plant parts',
    ],
    naturalControl: [
      'Maintain good weed control',
      'Use reflective mulches',
      'Introduce predatory mites',
      'Practice crop rotation',
    ],
  },
  {
    name: 'Mealybugs',
    tamilName: 'மீலிபக்ஸ்',
    affectedCrop: 'Cotton, Sugarcane, Vegetables, Fruits',
    remedies: [
      'Spray with soapy water solution',
      'Apply neem oil with soap',
      'Use systemic insecticides',
      'Remove heavily infested parts',
    ],
    naturalControl: [
      'Release ladybugs and lacewings',
      'Prune infested branches',
      'Use alcohol-soaked cotton swabs',
      'Maintain proper plant spacing',
    ],
  },
  {
    name: 'Red Spider Mites',
    tamilName: 'சிவப்பு சிலந்தி கொசுக்கள்',
    affectedCrop: 'Cotton, Vegetables, Fruits',
    remedies: [
      'Spray with water to increase humidity',
      'Apply miticides (abamectin)',
      'Use neem oil spray',
      'Remove heavily infested leaves',
    ],
    naturalControl: [
      'Increase humidity around plants',
      'Introduce predatory mites',
      'Use sulfur-based sprays',
      'Practice proper irrigation',
    ],
  },
  {
    name: 'Leaf Miners',
    tamilName: 'இலை சுரங்க தொழிலாளர்கள்',
    affectedCrop: 'Tomato, Beans, Peas, Vegetables',
    remedies: [
      'Remove and destroy mined leaves',
      'Apply spinosad-based insecticides',
      'Use yellow sticky traps',
      'Spray neem oil solution',
    ],
    naturalControl: [
      'Introduce parasitic wasps',
      'Practice crop rotation',
      'Remove weeds that host leaf miners',
      'Use floating row covers',
    ],
  },
];

// Generate dynamic mock pest data based on description
export const getDynamicMockPestData = (description?: string): any => {
  const desc = (description || '').toLowerCase();
  
  // Select pest based on keywords in description
  let selectedPest;
  
  if (desc.includes('aphid') || desc.includes('small green') || desc.includes('sucking')) {
    selectedPest = mockPestResults[0]; // Aphids
  } else if (desc.includes('whitefly') || desc.includes('white fly') || desc.includes('tiny white')) {
    selectedPest = mockPestResults[1]; // Whiteflies
  } else if (desc.includes('armyworm') || desc.includes('caterpillar') || desc.includes('worm')) {
    selectedPest = mockPestResults[2]; // Armyworms
  } else if (desc.includes('hopper') || desc.includes('rice') || desc.includes('brown')) {
    selectedPest = mockPestResults[3]; // Brown Plant Hopper
  } else if (desc.includes('thrip') || desc.includes('silver') || desc.includes('striped')) {
    selectedPest = mockPestResults[4]; // Thrips
  } else if (desc.includes('mealybug') || desc.includes('white cotton') || desc.includes('woolly')) {
    selectedPest = mockPestResults[5]; // Mealybugs
  } else if (desc.includes('mite') || desc.includes('spider') || desc.includes('web')) {
    selectedPest = mockPestResults[6]; // Red Spider Mites
  } else if (desc.includes('miner') || desc.includes('tunnel') || desc.includes('line')) {
    selectedPest = mockPestResults[7]; // Leaf Miners
  } else {
    // Random selection if no match
    selectedPest = mockPestResults[Math.floor(Math.random() * mockPestResults.length)];
  }
  
  // Generate dynamic "why occurring" based on pest type
  const whyOccurringOptions: Record<string, string[]> = {
    'Aphids': [
      'Aphids are occurring due to high nitrogen levels in the soil, warm and dry weather conditions, and lack of natural predators. They thrive in stressed plants and are attracted to tender new growth.',
      'Common causes include over-fertilization with nitrogen, dry weather conditions, absence of beneficial insects, and poor plant health management.',
    ],
    'Whiteflies': [
      'Whiteflies are occurring due to warm and humid conditions, lack of natural enemies, excessive use of nitrogen fertilizers, and poor ventilation in the growing area.',
      'They thrive in protected environments, on stressed plants, and when natural predators are eliminated by broad-spectrum pesticides.',
    ],
    'Armyworms': [
      'Armyworms are occurring due to favorable weather conditions (moderate temperature and humidity), presence of host plants, and lack of natural predators. They are more common during rainy seasons.',
      'Causes include high weed populations, continuous cropping of preferred hosts, and absence of natural enemies like birds and beneficial insects.',
    ],
    'Brown Plant Hopper': [
      'Brown Plant Hopper is occurring due to excessive nitrogen application, continuous rice cultivation, high humidity, and dense plant populations. They are common in irrigated rice fields.',
      'Favored by high nitrogen levels, continuous water logging, lack of natural enemies, and planting of susceptible rice varieties.',
    ],
    'Thrips': [
      'Thrips are occurring due to dry and hot weather conditions, lack of natural predators, and stressed plants. They prefer warm, dry environments.',
      'Common causes include low humidity, excessive use of nitrogen, lack of beneficial insects, and poor irrigation practices.',
    ],
    'Mealybugs': [
      'Mealybugs are occurring due to warm and humid conditions, over-fertilization, and lack of natural predators. They are common in protected cultivation.',
      'Favored by high nitrogen levels, warm temperatures, lack of natural enemies, and stressed or over-watered plants.',
    ],
    'Red Spider Mites': [
      'Red Spider Mites are occurring due to hot and dry weather conditions, low humidity, and lack of natural predators. They thrive in stressed plants.',
      'Common causes include water stress, high temperatures, low humidity, excessive use of pesticides that kill beneficial mites, and dusty conditions.',
    ],
    'Leaf Miners': [
      'Leaf Miners are occurring due to favorable weather conditions, presence of host plants, and lack of natural enemies. They are common in vegetable crops.',
      'Favored by moderate temperatures, high humidity, continuous cropping, and absence of natural predators like parasitic wasps.',
    ],
  };
  
  const whyOccurring = whyOccurringOptions[selectedPest.name]?.[0] || 
    `This pest is occurring due to favorable environmental conditions, presence of host plants, and lack of natural predators. Proper pest management practices can help control the infestation.`;
  
  // Convert mock data to API response format
  return {
    pestName: selectedPest.name,
    whyOccurring: whyOccurring,
    recommendations: [
      ...selectedPest.remedies.slice(0, 2),
      ...selectedPest.naturalControl.slice(0, 2),
    ],
  };
};

// Mock Profit/Loss Analysis
export const mockProfitLossData = {
  productionTons: 5.2,
  estimatedYield: 5200,
  marketPricePerKg: 45,
  expectedRevenue: 234000,
  profitOrLoss: 84000,
  profitPercentage: 56.0,
  alertLevel: 'high' as const,
};

// Mock Chat Assistant Responses
export const mockChatResponses = [
  "Rice cultivation requires warm temperatures (20-35°C) and high water availability. Ensure proper irrigation and maintain soil pH between 6-7.",
  "For organic pest control, use neem oil spray (2-3ml per liter of water). You can also introduce beneficial insects like ladybugs.",
  "The best time to plant tomatoes in Tamil Nadu is during February-March (Rabi season) or September-October (Kharif season).",
  "To improve soil fertility, add organic compost, use crop rotation, and consider planting leguminous crops that fix nitrogen.",
  "For maximum yield, ensure adequate spacing (for rice: 20x15 cm), proper irrigation, timely weeding, and balanced fertilization.",
];

// Check if API is available (for fallback logic)
export const isApiAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch('https://www.google.com', { method: 'HEAD', mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
};

// Get mock response for chat (simulates AI)
export const getMockChatResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('rice') || lowerMessage.includes('அரிசி')) {
    return mockChatResponses[0];
  }
  if (lowerMessage.includes('pest') || lowerMessage.includes('பூச்சி')) {
    return mockChatResponses[1];
  }
  if (lowerMessage.includes('tomato') || lowerMessage.includes('தக்காளி')) {
    return mockChatResponses[2];
  }
  if (lowerMessage.includes('soil') || lowerMessage.includes('மண்')) {
    return mockChatResponses[3];
  }
  if (lowerMessage.includes('yield') || lowerMessage.includes('விளைச்சல்')) {
    return mockChatResponses[4];
  }
  
  // Default helpful response
  return "Thank you for your question! For specific farming advice, please provide more details about your crop, location, and specific concern. You can also use the Crop Recommendation, Disease Detection, or Market Prices features for specialized information.";
};

