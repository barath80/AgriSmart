// Farming Courses Data Structure

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option (0-based)
  explanation: string;
}

export interface CourseModule {
  id: string;
  title: string;
  content: string[];
  type: 'lesson' | 'quiz';
  quizQuestions?: QuizQuestion[];
  videoUrl?: string;
  imageUrl?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  duration: string;
  modules: CourseModule[];
}

export const farmingCourses: Course[] = [
  {
    id: 'organic-farming',
    title: 'Organic Farming Fundamentals',
    description: 'Learn the principles and practices of organic farming for sustainable agriculture',
    icon: 'leaf',
    color: '#22c55e',
    duration: '4-5 hours',
    modules: [
      {
        id: 'module-1',
        title: 'Introduction to Organic Farming',
        type: 'lesson',
        content: [
          'Organic farming is a method of crop and livestock production that involves much more than choosing not to use pesticides, fertilizers, genetically modified organisms, antibiotics and growth hormones.',
          'Organic farming focuses on maintaining soil health, ecosystem management, and promoting biodiversity.',
          'Key principles include crop rotation, green manures, compost, biological pest control, and mechanical cultivation.',
          'Organic farming systems rely on crop rotation, crop residues, animal manures, legumes, green manure, off-farm organic wastes, and biological pest control to maintain soil productivity and tilth.',
          'The goal is to optimize the health and productivity of interdependent communities of soil life, plants, animals and people.',
        ],
        videoUrl: 'https://youtu.be/SOcxRMOjXWY?si=Wdc2_qTl3TVZyG44',
        imageUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80',
      },
      {
        id: 'module-2',
        title: 'Soil Management in Organic Farming',
        type: 'lesson',
        content: [
          'Healthy soil is the foundation of organic farming. Soil should be rich in organic matter and teeming with beneficial microorganisms.',
          'Composting is essential: Create compost from crop residues, animal manure, kitchen waste, and other organic materials.',
          'Green manuring involves growing specific crops and plowing them back into the soil to improve fertility.',
          'Crop rotation prevents soil depletion by alternating different crops in the same field across seasons.',
          'Avoid synthetic fertilizers. Use natural alternatives like bone meal, rock phosphate, and seaweed extracts.',
          'Maintain proper soil pH (6.0-7.0 for most crops) using natural amendments like lime or sulfur.',
          'Practice minimum tillage to preserve soil structure and reduce erosion.',
        ],
        videoUrl: 'https://youtu.be/heTxEsrPVdQ?si=Dse7l-qlYKHzCjJB',
        imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80',
      },
      {
        id: 'module-3',
        title: 'Pest and Disease Management',
        type: 'lesson',
        content: [
          'Integrated Pest Management (IPM) is crucial in organic farming. Focus on prevention rather than cure.',
          'Biological control: Introduce beneficial insects like ladybugs, lacewings, and predatory mites to control pests.',
          'Companion planting: Some plants naturally repel pests. For example, marigolds repel nematodes, and basil repels flies.',
          'Crop rotation breaks pest and disease cycles by preventing pests from finding their host plants.',
          'Use organic pesticides only as a last resort: Neem oil, pyrethrin, and diatomaceous earth are approved organic options.',
          'Proper spacing and pruning improve air circulation, reducing fungal diseases.',
          'Remove and destroy infected plant parts immediately to prevent disease spread.',
          'Encourage biodiversity in your farm to create a balanced ecosystem that naturally controls pests.',
        ],
        videoUrl: 'https://youtu.be/m28inqnDKp8?si=oUe8dHaKiHv8mt_N',
        imageUrl: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80',
      },
      {
        id: 'module-4',
        title: 'Organic Certification and Marketing',
        type: 'lesson',
        content: [
          'Organic certification ensures that products meet strict organic standards set by regulatory bodies.',
          'In India, NPOP (National Programme for Organic Production) and PGS-India (Participatory Guarantee System) are the main certification systems.',
          'Transition period: Land must be managed organically for at least 3 years before certification.',
          'Maintain detailed records of all farming practices, inputs used, and harvest dates.',
          'Regular inspections by certification agencies are required to maintain certification.',
          'Marketing organic products: Emphasize health benefits, environmental sustainability, and premium quality.',
          'Price premium: Organic products typically command 20-50% higher prices than conventional products.',
          'Build trust with consumers through transparency and clear labeling.',
        ],
        videoUrl: 'https://youtu.be/3JX2xE8p2I4',
        imageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80',
      },
      {
        id: 'quiz-1',
        title: 'Organic Farming Quiz',
        type: 'quiz',
        content: [],
        quizQuestions: [
          {
            id: 'q1',
            question: 'What is the minimum transition period required for organic certification?',
            options: ['1 year', '2 years', '3 years', '5 years'],
            correctAnswer: 2,
            explanation: 'Land must be managed organically for at least 3 years before it can be certified as organic.',
          },
          {
            id: 'q2',
            question: 'Which of the following is NOT a principle of organic farming?',
            options: [
              'Crop rotation',
              'Use of synthetic fertilizers',
              'Biological pest control',
              'Green manuring',
            ],
            correctAnswer: 1,
            explanation: 'Organic farming strictly avoids synthetic fertilizers. It relies on natural methods like crop rotation, green manuring, and biological pest control.',
          },
          {
            id: 'q3',
            question: 'What is the ideal soil pH range for most crops in organic farming?',
            options: ['4.0-5.0', '5.0-6.0', '6.0-7.0', '7.0-8.0'],
            correctAnswer: 2,
            explanation: 'Most crops grow best in slightly acidic to neutral soil, with a pH range of 6.0-7.0.',
          },
          {
            id: 'q4',
            question: 'Which beneficial insect is commonly used for biological pest control?',
            options: ['Honeybee', 'Ladybug', 'Butterfly', 'Dragonfly'],
            correctAnswer: 1,
            explanation: 'Ladybugs are natural predators of aphids and other soft-bodied pests, making them valuable in organic pest management.',
          },
          {
            id: 'q5',
            question: 'What is the main purpose of companion planting in organic farming?',
            options: [
              'Increase yield',
              'Repel pests naturally',
              'Reduce water usage',
              'Improve soil structure',
            ],
            correctAnswer: 1,
            explanation: 'Companion planting helps repel pests naturally. For example, marigolds repel nematodes, and basil repels flies.',
          },
        ],
      },
    ],
  },
  {
    id: 'crop-management',
    title: 'Modern Crop Management Techniques',
    description: 'Master advanced crop management for maximum yield and quality',
    icon: 'stats-chart',
    color: '#3b82f6',
    duration: '5-6 hours',
    modules: [
      {
        id: 'module-1',
        title: 'Soil Preparation and Seed Selection',
        type: 'lesson',
        content: [
          'Proper soil preparation is crucial for successful crop production. Start with soil testing to determine pH, nutrient levels, and organic matter content.',
          'Primary tillage: Deep plowing (20-25 cm) breaks hardpan and improves soil aeration. Best done during summer for solarization.',
          'Secondary tillage: Harrowing and leveling create a fine seedbed. Ensure uniform soil texture and remove weeds.',
          'Seed selection: Choose high-yielding, disease-resistant varieties suitable for your region and season.',
          'Seed treatment: Treat seeds with fungicides and insecticides to prevent seed-borne diseases and early pest attacks.',
          'Seed rate: Follow recommended seed rates. Over-seeding wastes resources, while under-seeding reduces yield potential.',
          'Sowing time: Optimal sowing time varies by crop and region. Consult agricultural extension services for local recommendations.',
          'Sowing depth: Generally 2-3 times the seed diameter. Deeper for larger seeds, shallower for small seeds.',
        ],
        videoUrl: 'https://youtu.be/8Y9vV5w5mR4',
        imageUrl: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&q=80',
      },
      {
        id: 'module-2',
        title: 'Irrigation and Water Management',
        type: 'lesson',
        content: [
          'Efficient water management is essential for crop productivity and water conservation.',
          'Critical stages: Identify critical growth stages when water stress significantly impacts yield (e.g., flowering, grain filling).',
          'Drip irrigation: Most efficient method, delivering water directly to root zone, reducing water loss and weed growth.',
          'Sprinkler irrigation: Suitable for various crops, provides uniform water distribution, but higher evaporation losses.',
          'Flood irrigation: Traditional method, less efficient but suitable for rice and other water-loving crops.',
          'Water scheduling: Apply water based on soil moisture levels, not on fixed schedules. Use tensiometers or soil moisture sensors.',
          'Rainwater harvesting: Collect and store rainwater for irrigation during dry periods.',
          'Mulching: Reduces evaporation, maintains soil moisture, and controls weeds. Use organic mulch like straw or plastic mulch.',
        ],
        videoUrl: 'https://youtu.be/qKzJz7a-7r8',
        imageUrl: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800&q=80',
      },
      {
        id: 'module-3',
        title: 'Nutrient Management and Fertilization',
        type: 'lesson',
        content: [
          'Balanced nutrition is key to achieving optimal crop yields and quality.',
          'Essential nutrients: Crops need 17 essential elements. Major nutrients (NPK), secondary nutrients (Ca, Mg, S), and micronutrients (Fe, Zn, Cu, Mn, B, Mo, Cl).',
          'Soil testing: Regular soil testing (every 2-3 years) helps determine nutrient deficiencies and fertilizer requirements.',
          'Fertilizer application methods:',
          '  - Basal application: Apply at sowing/transplanting (50-60% of total)',
          '  - Top dressing: Apply during active growth (remaining 40-50%)',
          '  - Foliar application: Spray nutrients directly on leaves for quick absorption',
          'NPK ratio: Follow recommended NPK ratios for different crops (e.g., Rice: 4:2:1, Wheat: 4:2:1, Cotton: 3:2:1).',
          'Organic fertilizers: Combine with inorganic fertilizers. FYM, compost, and green manure improve soil health.',
          'Timing: Apply fertilizers at right growth stages. Nitrogen during vegetative growth, phosphorus at early stages, potassium during reproductive stage.',
        ],
        videoUrl: 'https://youtu.be/x6jq3yZv2o4',
        imageUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80',
      },
      {
        id: 'module-4',
        title: 'Weed, Pest and Disease Control',
        type: 'lesson',
        content: [
          'Effective weed, pest, and disease management protects crop yield and quality.',
          'Weed management:',
          '  - Pre-emergence herbicides: Applied before weeds germinate',
          '  - Post-emergence herbicides: Applied after crop and weeds emerge',
          '  - Mechanical weeding: Hand weeding, hoeing, or cultivation',
          '  - Cultural practices: Crop rotation, proper spacing, mulching',
          'Pest management:',
          '  - Monitor fields regularly for pest populations',
          '  - Use economic threshold levels (ETL) to decide when to spray',
          '  - Integrated Pest Management (IPM): Combine biological, cultural, and chemical methods',
          '  - Use selective pesticides that target specific pests without harming beneficial insects',
          'Disease management:',
          '  - Use disease-resistant varieties',
          '  - Practice crop rotation to break disease cycles',
          '  - Apply preventive fungicides at critical growth stages',
          '  - Remove and destroy infected plant parts',
          '  - Maintain proper plant spacing for air circulation',
        ],
        videoUrl: 'https://youtu.be/X8HjyXk7qTk',
        imageUrl: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80',
      },
      {
        id: 'quiz-2',
        title: 'Crop Management Quiz',
        type: 'quiz',
        content: [],
        quizQuestions: [
          {
            id: 'q1',
            question: 'What is the recommended depth for primary tillage?',
            options: ['10-15 cm', '15-20 cm', '20-25 cm', '25-30 cm'],
            correctAnswer: 2,
            explanation: 'Primary tillage should be done at 20-25 cm depth to break hardpan and improve soil aeration.',
          },
          {
            id: 'q2',
            question: 'Which irrigation method is most water-efficient?',
            options: ['Flood irrigation', 'Sprinkler irrigation', 'Drip irrigation', 'Furrow irrigation'],
            correctAnswer: 2,
            explanation: 'Drip irrigation is the most efficient method, delivering water directly to the root zone with minimal losses.',
          },
          {
            id: 'q3',
            question: 'What percentage of total fertilizer should be applied as basal application?',
            options: ['30-40%', '40-50%', '50-60%', '60-70%'],
            correctAnswer: 2,
            explanation: 'Typically, 50-60% of total fertilizer is applied as basal application at sowing/transplanting, with the remainder as top dressing.',
          },
          {
            id: 'q4',
            question: 'Which growth stage is most critical for water requirement in most crops?',
            options: ['Seedling', 'Vegetative', 'Flowering', 'Maturity'],
            correctAnswer: 2,
            explanation: 'Flowering and grain filling stages are most critical, as water stress during these periods significantly reduces yield.',
          },
          {
            id: 'q5',
            question: 'What does IPM stand for in pest management?',
            options: [
              'Intensive Pest Management',
              'Integrated Pest Management',
              'Internal Pest Management',
              'Individual Pest Management',
            ],
            correctAnswer: 1,
            explanation: 'IPM stands for Integrated Pest Management, which combines biological, cultural, and chemical methods for effective pest control.',
          },
        ],
      },
    ],
  },
  {
    id: 'sustainable-agriculture',
    title: 'Sustainable Agriculture Practices',
    description: 'Learn sustainable farming methods for long-term productivity and environmental protection',
    icon: 'earth',
    color: '#10b981',
    duration: '4-5 hours',
    modules: [
      {
        id: 'module-1',
        title: 'Principles of Sustainable Agriculture',
        type: 'lesson',
        content: [
          'Sustainable agriculture meets present food needs without compromising future generations ability to meet their needs.',
          'Three pillars: Environmental health, economic profitability, and social equity.',
          'Key principles:',
          '  - Maintain and enhance soil health',
          '  - Conserve water resources',
          '  - Promote biodiversity',
          '  - Reduce chemical inputs',
          '  - Enhance farm profitability',
          '  - Improve quality of life for farmers',
          'Sustainable practices help combat climate change by reducing greenhouse gas emissions and sequestering carbon in soil.',
          'Long-term benefits include improved soil fertility, reduced input costs, and increased resilience to climate variability.',
        ],
        videoUrl: 'https://youtu.be/RlGH3qy3cJs',
        imageUrl: 'https://images.unsplash.com/photo-1478146896985-b7a3f92e48b6?w=800&q=80',
      },
      {
        id: 'module-2',
        title: 'Conservation Agriculture',
        type: 'lesson',
        content: [
          'Conservation agriculture is based on three principles: minimum soil disturbance, permanent soil cover, and crop diversification.',
          'Zero tillage (No-till): Reduces soil erosion, improves water retention, and saves fuel and labor costs.',
          'Crop residues: Leave crop residues on field surface to protect soil from erosion and maintain moisture.',
          'Cover crops: Grow cover crops between main crops to improve soil health, suppress weeds, and fix nitrogen.',
          'Crop rotation: Diversify crops to break pest cycles, improve soil fertility, and reduce risk.',
          'Benefits:',
          '  - Improved soil structure and organic matter',
          '  - Reduced soil erosion by 50-90%',
          '  - Water savings of 20-30%',
          '  - Lower fuel and labor costs',
          '  - Increased carbon sequestration',
        ],
        videoUrl: 'https://youtu.be/3o8pYJz6QbY',
        imageUrl: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&q=80',
      },
      {
        id: 'module-3',
        title: 'Water Conservation Techniques',
        type: 'lesson',
        content: [
          'Water is a precious resource. Efficient water use is essential for sustainable agriculture.',
          'Rainwater harvesting: Collect and store rainwater in ponds, tanks, or underground reservoirs.',
          'Watershed management: Implement measures to capture and store rainwater in the watershed.',
          'Drip and sprinkler irrigation: Use efficient irrigation systems to reduce water wastage.',
          'Mulching: Apply organic or plastic mulch to reduce evaporation and maintain soil moisture.',
          'Crop selection: Choose drought-tolerant varieties and crops suitable for local climate.',
          'Soil moisture conservation:',
          '  - Improve organic matter content',
          '  - Practice conservation tillage',
          '  - Use contour farming on slopes',
          '  - Implement bunding and terracing',
          'Scheduling: Apply water based on crop needs and soil moisture levels, not on fixed schedules.',
        ],
        videoUrl: 'https://youtu.be/w6d2R6c7xRk',
        imageUrl: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&q=80',
      },
      {
        id: 'module-4',
        title: 'Climate-Smart Agriculture',
        type: 'lesson',
        content: [
          'Climate-smart agriculture helps farmers adapt to climate change while reducing agriculture\'s contribution to greenhouse gas emissions.',
          'Adaptation strategies:',
          '  - Use climate-resilient crop varieties',
          '  - Adjust planting dates based on weather patterns',
          '  - Diversify crops and income sources',
          '  - Implement water-saving technologies',
          '  - Practice agroforestry',
          'Mitigation strategies:',
          '  - Reduce tillage to sequester carbon',
          '  - Use organic fertilizers and manures',
          '  - Practice crop rotation and intercropping',
          '  - Implement agroforestry systems',
          '  - Optimize fertilizer use to reduce nitrous oxide emissions',
          'Weather-based advisories: Use weather forecasts and agricultural advisories to make informed decisions.',
          'Crop insurance: Protect against climate risks through crop insurance schemes.',
        ],
        videoUrl: 'https://youtu.be/1aQ9ZaLD3jE',
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80',
      },
      {
        id: 'quiz-3',
        title: 'Sustainable Agriculture Quiz',
        type: 'quiz',
        content: [],
        quizQuestions: [
          {
            id: 'q1',
            question: 'What are the three pillars of sustainable agriculture?',
            options: [
              'Soil, water, air',
              'Environmental health, economic profitability, social equity',
              'Crops, livestock, fisheries',
              'Production, processing, marketing',
            ],
            correctAnswer: 1,
            explanation: 'Sustainable agriculture is built on three pillars: environmental health, economic profitability, and social equity.',
          },
          {
            id: 'q2',
            question: 'What is the main benefit of zero tillage (no-till) farming?',
            options: [
              'Higher yields',
              'Reduced soil erosion and improved water retention',
              'Faster planting',
              'Lower seed costs',
            ],
            correctAnswer: 1,
            explanation: 'Zero tillage reduces soil erosion by 50-90%, improves water retention, and saves fuel and labor costs.',
          },
          {
            id: 'q3',
            question: 'How much water can be saved by using efficient irrigation methods?',
            options: ['5-10%', '10-20%', '20-30%', '30-40%'],
            correctAnswer: 2,
            explanation: 'Conservation agriculture practices, including efficient irrigation, can save 20-30% of water compared to traditional methods.',
          },
          {
            id: 'q4',
            question: 'What is the purpose of cover crops in sustainable agriculture?',
            options: [
              'Increase yield',
              'Improve soil health, suppress weeds, and fix nitrogen',
              'Reduce irrigation needs',
              'Control pests',
            ],
            correctAnswer: 1,
            explanation: 'Cover crops improve soil health, suppress weeds, fix nitrogen, and protect soil from erosion.',
          },
          {
            id: 'q5',
            question: 'Which practice helps sequester carbon in agriculture?',
            options: [
              'Increased tillage',
              'Reduced tillage and organic matter addition',
              'Higher fertilizer use',
              'Monocropping',
            ],
            correctAnswer: 1,
            explanation: 'Reduced tillage, crop residues, cover crops, and organic matter addition help sequester carbon in soil, mitigating climate change.',
          },
        ],
      },
    ],
  },
];

