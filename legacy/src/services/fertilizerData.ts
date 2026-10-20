// Comprehensive Indian Agricultural Data for Crop Rotation and Fertilizer Recommendations
// Based on real Indian farming practices and government guidelines

export interface CropRotationRecommendation {
  recommendedCrop: string;
  rotationReason: string;
  fertilizerRecommendation: {
    urea: { min: number; max: number; unit: string };
    superPhosphate: { min: number; max: number; unit: string };
    mop: { min: number; max: number; unit: string };
  };
  organicAlternative: {
    fym: { min: number; max: number; unit: string };
    compost: string;
    additional: string;
  };
}

export interface FertilizerData {
  [crop: string]: {
    [soilType: string]: {
      [region: string]: {
        [season: string]: CropRotationRecommendation[];
      };
    };
  };
}

// Indian States/Regions
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

// Soil Types in India
export const SOIL_TYPES = [
  'Alluvial', 'Black', 'Red', 'Laterite', 'Mountain', 'Desert', 'Saline', 'Peaty'
];

// Seasons
export const SEASONS = ['Kharif', 'Rabi', 'Zaid', 'Year Round'];

// Major Crops in India
export const CROPS = [
  'Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane', 'Groundnut', 'Pulses',
  'Soybean', 'Mustard', 'Sunflower', 'Jute', 'Bajra', 'Jowar', 'Ragi',
  'Barley', 'Gram', 'Tur', 'Moong', 'Urad', 'Lentil', 'Peas', 'Potato',
  'Onion', 'Tomato', 'Chilli', 'Brinjal', 'Okra', 'Cucumber', 'Watermelon',
  'Mango', 'Banana', 'Citrus', 'Coconut', 'Cashew', 'Coffee', 'Tea', 'Tobacco'
];

// Comprehensive Fertilizer and Crop Rotation Data
export const fertilizerData: FertilizerData = {
  // RICE
  Rice: {
    Alluvial: {
      'Punjab': {
        Kharif: [{
          recommendedCrop: 'Wheat',
          rotationReason: 'Wheat helps break pest cycles and improves soil structure. Rice-Wheat rotation is traditional in Punjab.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'Farm Yard Manure (FYM) or Compost: 5-8 tons/acre improves soil organic carbon',
            additional: 'Green Manure (Sesbania/Dhaincha): 20-25 kg seeds/acre before rice planting'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Potato',
          rotationReason: 'Potato helps in soil aeration and nutrient recycling. Good cash crop after rice.',
          fertilizerRecommendation: {
            urea: { min: 55, max: 65, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 20, max: 25, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 6, max: 10, unit: 'tons/acre' },
            compost: 'Well-decomposed FYM: 6-10 tons/acre provides balanced nutrition',
            additional: 'Vermicompost: 2-3 tons/acre or Neem Cake: 200-300 kg/acre'
          }
        }]
      },
      'West Bengal': {
        Kharif: [{
          recommendedCrop: 'Mustard',
          rotationReason: 'Mustard is a good break crop that helps in pest management and soil health.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM or Compost: 5-8 tons/acre enhances soil fertility',
            additional: 'Green Manure crops: Sunhemp or Dhaincha before rice'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Potato',
          rotationReason: 'Potato cultivation after rice improves soil structure and provides good returns.',
          fertilizerRecommendation: {
            urea: { min: 55, max: 65, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 20, max: 25, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 6, max: 10, unit: 'tons/acre' },
            compost: 'FYM: 6-10 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Vermicompost: 2-3 tons/acre for better nutrient availability'
          }
        }]
      },
      'Uttar Pradesh': {
        Kharif: [{
          recommendedCrop: 'Wheat',
          rotationReason: 'Rice-Wheat rotation is most common in UP. Wheat helps in weed control and soil improvement.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre improves soil organic matter',
            additional: 'Green Manure: 20-25 kg seeds/acre of Sesbania or Dhaincha'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Potato',
          rotationReason: 'Potato after rice provides good income and helps in nutrient cycling.',
          fertilizerRecommendation: {
            urea: { min: 55, max: 65, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 20, max: 25, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 6, max: 10, unit: 'tons/acre' },
            compost: 'Well-decomposed FYM: 6-10 tons/acre',
            additional: 'Vermicompost: 2-3 tons/acre or Neem Cake: 200-300 kg/acre'
          }
        }]
      },
      'Bihar': {
        Kharif: [{
          recommendedCrop: 'Wheat',
          rotationReason: 'Traditional rice-wheat rotation maintains soil fertility and provides food security.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM or Compost: 5-8 tons/acre',
            additional: 'Green Manure: Sesbania 20-25 kg/acre before rice'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Lentil',
          rotationReason: 'Lentil fixes nitrogen and improves soil health after rice cultivation.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for better nitrogen fixation'
          }
        }]
      }
    },
    Black: {
      'Maharashtra': {
        Kharif: [{
          recommendedCrop: 'Soybean',
          rotationReason: 'Soybean fixes nitrogen and improves soil fertility. Good break crop after rice.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Wheat',
          rotationReason: 'Wheat after rice helps in weed management and provides stable income.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre improves soil structure',
            additional: 'Green Manure: 20-25 kg/acre of Sunhemp'
          }
        }]
      },
      'Madhya Pradesh': {
        Kharif: [{
          recommendedCrop: 'Soybean',
          rotationReason: 'Soybean is excellent for nitrogen fixation and soil health improvement.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM or Compost: 5-8 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for better nodulation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Wheat',
          rotationReason: 'Wheat cultivation after rice maintains soil productivity and provides food security.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre enhances organic matter',
            additional: 'Green Manure: Sesbania 20-25 kg/acre'
          }
        }]
      }
    },
    Red: {
      'Tamil Nadu': {
        Kharif: [{
          recommendedCrop: 'Groundnut',
          rotationReason: 'Groundnut improves soil structure and fixes nitrogen. Good cash crop after rice.',
          fertilizerRecommendation: {
            urea: { min: 15, max: 20, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Pulses',
          rotationReason: 'Pulses fix atmospheric nitrogen and improve soil fertility after rice.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for better nitrogen fixation'
          }
        }]
      },
      'Karnataka': {
        Kharif: [{
          recommendedCrop: 'Groundnut',
          rotationReason: 'Groundnut is well-suited for red soils and provides good returns.',
          fertilizerRecommendation: {
            urea: { min: 15, max: 20, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM or Compost: 5-8 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Ragi',
          rotationReason: 'Ragi is drought-tolerant and suitable for red soils. Good nutritional crop.',
          fertilizerRecommendation: {
            urea: { min: 40, max: 50, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre improves soil organic carbon',
            additional: 'Vermicompost: 2-3 tons/acre'
          }
        }]
      }
    }
  },

  // WHEAT
  Wheat: {
    Alluvial: {
      'Punjab': {
        Kharif: [{
          recommendedCrop: 'Rice',
          rotationReason: 'Rice-Wheat rotation is traditional. Rice helps in pest and disease management.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Green Manure: Sesbania or Dhaincha 20-25 kg/acre'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Maize',
          rotationReason: 'Maize after wheat helps in breaking pest cycles and provides good yield.',
          fertilizerRecommendation: {
            urea: { min: 55, max: 65, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 6, max: 10, unit: 'tons/acre' },
            compost: 'FYM: 6-10 tons/acre or Compost: 5-7 tons/acre',
            additional: 'Vermicompost: 2-3 tons/acre'
          }
        }]
      },
      'Haryana': {
        Kharif: [{
          recommendedCrop: 'Rice',
          rotationReason: 'Rice-Wheat rotation maintains soil productivity and provides food security.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre improves soil organic matter',
            additional: 'Green Manure: 20-25 kg/acre of Sesbania'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Green Gram',
          rotationReason: 'Green gram fixes nitrogen and improves soil health. Good break crop.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }]
      },
      'Uttar Pradesh': {
        Kharif: [{
          recommendedCrop: 'Rice',
          rotationReason: 'Traditional rice-wheat rotation helps in sustainable agriculture.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM or Compost: 5-8 tons/acre',
            additional: 'Green Manure: Sesbania 20-25 kg/acre'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Maize',
          rotationReason: 'Maize after wheat provides good income and helps in crop diversification.',
          fertilizerRecommendation: {
            urea: { min: 55, max: 65, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 6, max: 10, unit: 'tons/acre' },
            compost: 'FYM: 6-10 tons/acre or Compost: 5-7 tons/acre',
            additional: 'Vermicompost: 2-3 tons/acre'
          }
        }]
      }
    },
    Black: {
      'Maharashtra': {
        Kharif: [{
          recommendedCrop: 'Soybean',
          rotationReason: 'Soybean fixes nitrogen and improves soil fertility after wheat.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Gram',
          rotationReason: 'Bengal gram fixes nitrogen and improves soil health.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for better nodulation'
          }
        }]
      },
      'Madhya Pradesh': {
        Kharif: [{
          recommendedCrop: 'Soybean',
          rotationReason: 'Soybean is excellent for nitrogen fixation and soil health improvement.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM or Compost: 5-8 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Gram',
          rotationReason: 'Bengal gram after wheat helps in nitrogen fixation and soil improvement.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for better nitrogen fixation'
          }
        }]
      }
    }
  },

  // COTTON
  Cotton: {
    Black: {
      'Gujarat': {
        Kharif: [{
          recommendedCrop: 'Gram',
          rotationReason: 'Bengal gram after cotton helps in nitrogen fixation and breaks pest cycles.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Wheat',
          rotationReason: 'Wheat after cotton helps in weed control and provides stable income.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre improves soil organic matter',
            additional: 'Green Manure: 20-25 kg/acre of Sesbania'
          }
        }]
      },
      'Maharashtra': {
        Kharif: [{
          recommendedCrop: 'Soybean',
          rotationReason: 'Soybean fixes nitrogen and improves soil health after cotton cultivation.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Gram',
          rotationReason: 'Bengal gram after cotton helps in nitrogen fixation and pest management.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for better nodulation'
          }
        }]
      },
      'Telangana': {
        Kharif: [{
          recommendedCrop: 'Soybean',
          rotationReason: 'Soybean is good for nitrogen fixation and soil improvement after cotton.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Gram',
          rotationReason: 'Bengal gram after cotton helps in nitrogen fixation and breaks pest cycles.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for better nitrogen fixation'
          }
        }]
      }
    },
    Alluvial: {
      'Punjab': {
        Kharif: [{
          recommendedCrop: 'Wheat',
          rotationReason: 'Wheat after cotton helps in weed management and provides food security.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre improves soil organic matter',
            additional: 'Green Manure: 20-25 kg/acre of Sesbania'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Maize',
          rotationReason: 'Maize after cotton helps in breaking pest cycles and provides good yield.',
          fertilizerRecommendation: {
            urea: { min: 55, max: 65, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 6, max: 10, unit: 'tons/acre' },
            compost: 'FYM: 6-10 tons/acre or Compost: 5-7 tons/acre',
            additional: 'Vermicompost: 2-3 tons/acre'
          }
        }]
      }
    }
  },

  // SUGARCANE
  Sugarcane: {
    Alluvial: {
      'Uttar Pradesh': {
        Kharif: [{
          recommendedCrop: 'Pulses',
          rotationReason: 'Pulses fix nitrogen and improve soil fertility after sugarcane. Good break crop.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Oilseeds',
          rotationReason: 'Oilseeds like mustard after sugarcane help in crop diversification and soil health.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Vermicompost: 2-3 tons/acre'
          }
        }]
      },
      'Maharashtra': {
        Kharif: [{
          recommendedCrop: 'Pulses',
          rotationReason: 'Pulses fix atmospheric nitrogen and improve soil health after sugarcane.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Oilseeds',
          rotationReason: 'Oilseeds after sugarcane help in soil improvement and provide good returns.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Vermicompost: 2-3 tons/acre'
          }
        }]
      }
    },
    Black: {
      'Maharashtra': {
        Kharif: [{
          recommendedCrop: 'Pulses',
          rotationReason: 'Pulses fix nitrogen and improve soil fertility. Essential after sugarcane.',
          fertilizerRecommendation: {
            urea: { min: 20, max: 25, unit: 'kg/acre' },
            superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
            mop: { min: 10, max: 15, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 4, max: 6, unit: 'tons/acre' },
            compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
            additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
          }
        }],
        Rabi: [{
          recommendedCrop: 'Oilseeds',
          rotationReason: 'Oilseeds after sugarcane help in crop diversification and soil health.',
          fertilizerRecommendation: {
            urea: { min: 50, max: 60, unit: 'kg/acre' },
            superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
            mop: { min: 15, max: 20, unit: 'kg/acre' }
          },
          organicAlternative: {
            fym: { min: 5, max: 8, unit: 'tons/acre' },
            compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
            additional: 'Vermicompost: 2-3 tons/acre'
          }
        }]
      }
    }
  }
};

// Helper function to generate recommendations based on crop type
function getRecommendationByCropType(
  crop: string,
  soilType: string,
  season: string
): CropRotationRecommendation {
  const cropLower = crop.toLowerCase();
  
  // Rice-based recommendations
  if (cropLower === 'rice') {
    if (season === 'Rabi' || season === 'Zaid') {
      return {
        recommendedCrop: 'Wheat',
        rotationReason: 'Wheat after rice helps break pest cycles and improves soil structure. Traditional rice-wheat rotation maintains soil productivity.',
        fertilizerRecommendation: {
          urea: { min: 50, max: 60, unit: 'kg/acre' },
          superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
          mop: { min: 15, max: 20, unit: 'kg/acre' }
        },
        organicAlternative: {
          fym: { min: 5, max: 8, unit: 'tons/acre' },
          compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre improves soil organic matter',
          additional: 'Green Manure: Sesbania or Dhaincha 20-25 kg/acre before wheat planting'
        }
      };
    } else {
      return {
        recommendedCrop: 'Groundnut',
        rotationReason: 'Groundnut fixes nitrogen and improves soil structure. Good cash crop after rice in Kharif season.',
        fertilizerRecommendation: {
          urea: { min: 15, max: 20, unit: 'kg/acre' },
          superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
          mop: { min: 15, max: 20, unit: 'kg/acre' }
        },
        organicAlternative: {
          fym: { min: 5, max: 8, unit: 'tons/acre' },
          compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
          additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
        }
      };
    }
  }
  
  // Wheat-based recommendations
  if (cropLower === 'wheat') {
    if (season === 'Kharif') {
      return {
        recommendedCrop: 'Rice',
        rotationReason: 'Rice-Wheat rotation is traditional in India. Rice helps in pest and disease management after wheat.',
        fertilizerRecommendation: {
          urea: { min: 50, max: 60, unit: 'kg/acre' },
          superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
          mop: { min: 15, max: 20, unit: 'kg/acre' }
        },
        organicAlternative: {
          fym: { min: 5, max: 8, unit: 'tons/acre' },
          compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
          additional: 'Green Manure: Sesbania or Dhaincha 20-25 kg/acre before rice planting'
        }
      };
    } else {
      return {
        recommendedCrop: 'Maize',
        rotationReason: 'Maize after wheat helps in breaking pest cycles and provides good yield. Good for crop diversification.',
        fertilizerRecommendation: {
          urea: { min: 55, max: 65, unit: 'kg/acre' },
          superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
          mop: { min: 15, max: 20, unit: 'kg/acre' }
        },
        organicAlternative: {
          fym: { min: 6, max: 10, unit: 'tons/acre' },
          compost: 'FYM: 6-10 tons/acre or Compost: 5-7 tons/acre',
          additional: 'Vermicompost: 2-3 tons/acre for better nutrient availability'
        }
      };
    }
  }
  
  // Cotton-based recommendations
  if (cropLower === 'cotton') {
    return {
      recommendedCrop: 'Gram',
      rotationReason: 'Bengal gram after cotton helps in nitrogen fixation and breaks pest cycles. Essential for sustainable cotton cultivation.',
      fertilizerRecommendation: {
        urea: { min: 20, max: 25, unit: 'kg/acre' },
        superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
        mop: { min: 10, max: 15, unit: 'kg/acre' }
      },
      organicAlternative: {
        fym: { min: 4, max: 6, unit: 'tons/acre' },
        compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
        additional: 'Rhizobium culture: 200g/acre for better nitrogen fixation'
      }
    };
  }
  
  // Sugarcane-based recommendations
  if (cropLower === 'sugarcane') {
    if (season === 'Kharif') {
      return {
        recommendedCrop: 'Pulses',
        rotationReason: 'Pulses fix atmospheric nitrogen and improve soil fertility after sugarcane. Essential break crop for soil health.',
        fertilizerRecommendation: {
          urea: { min: 20, max: 25, unit: 'kg/acre' },
          superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
          mop: { min: 10, max: 15, unit: 'kg/acre' }
        },
        organicAlternative: {
          fym: { min: 4, max: 6, unit: 'tons/acre' },
          compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
          additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
        }
      };
    } else {
      return {
        recommendedCrop: 'Oilseeds',
        rotationReason: 'Oilseeds like mustard after sugarcane help in crop diversification and soil health improvement.',
        fertilizerRecommendation: {
          urea: { min: 50, max: 60, unit: 'kg/acre' },
          superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
          mop: { min: 15, max: 20, unit: 'kg/acre' }
        },
        organicAlternative: {
          fym: { min: 5, max: 8, unit: 'tons/acre' },
          compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
          additional: 'Vermicompost: 2-3 tons/acre'
        }
      };
    }
  }
  
  // Maize-based recommendations
  if (cropLower === 'maize') {
    return {
      recommendedCrop: 'Pulses',
      rotationReason: 'Pulses fix nitrogen and improve soil health after maize. Good break crop for sustainable agriculture.',
      fertilizerRecommendation: {
        urea: { min: 20, max: 25, unit: 'kg/acre' },
        superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
        mop: { min: 10, max: 15, unit: 'kg/acre' }
      },
      organicAlternative: {
        fym: { min: 4, max: 6, unit: 'tons/acre' },
        compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre',
        additional: 'Rhizobium culture: 200g/acre for nitrogen fixation'
      }
    };
  }
  
  // Groundnut-based recommendations
  if (cropLower === 'groundnut') {
    return {
      recommendedCrop: 'Rice',
      rotationReason: 'Rice after groundnut helps in utilizing residual nitrogen and improves soil structure.',
      fertilizerRecommendation: {
        urea: { min: 50, max: 60, unit: 'kg/acre' },
        superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
        mop: { min: 15, max: 20, unit: 'kg/acre' }
      },
      organicAlternative: {
        fym: { min: 5, max: 8, unit: 'tons/acre' },
        compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
        additional: 'Green Manure: Sesbania 20-25 kg/acre'
      }
    };
  }
  
  // Soybean-based recommendations
  if (cropLower === 'soybean') {
    return {
      recommendedCrop: 'Wheat',
      rotationReason: 'Wheat after soybean utilizes residual nitrogen and provides food security. Good rotation for soil health.',
      fertilizerRecommendation: {
        urea: { min: 50, max: 60, unit: 'kg/acre' },
        superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
        mop: { min: 15, max: 20, unit: 'kg/acre' }
      },
      organicAlternative: {
        fym: { min: 5, max: 8, unit: 'tons/acre' },
        compost: 'FYM: 5-8 tons/acre improves soil organic matter',
        additional: 'Green Manure: 20-25 kg/acre of Sesbania'
      }
    };
  }
  
  // Pulses-based recommendations
  if (['pulses', 'gram', 'tur', 'moong', 'urad', 'lentil', 'peas'].includes(cropLower)) {
    return {
      recommendedCrop: 'Wheat',
      rotationReason: 'Wheat after pulses utilizes fixed nitrogen and provides good yield. Traditional rotation in India.',
      fertilizerRecommendation: {
        urea: { min: 50, max: 60, unit: 'kg/acre' },
        superPhosphate: { min: 25, max: 30, unit: 'kg/acre' },
        mop: { min: 15, max: 20, unit: 'kg/acre' }
      },
      organicAlternative: {
        fym: { min: 5, max: 8, unit: 'tons/acre' },
        compost: 'FYM: 5-8 tons/acre or Compost: 4-6 tons/acre',
        additional: 'Green Manure: 20-25 kg/acre of Sesbania'
      }
    };
  }
  
  // Default recommendation for all other crops
  return {
    recommendedCrop: 'Pulses',
    rotationReason: 'Pulses fix atmospheric nitrogen and improve soil fertility. Good break crop for most crop rotations and helps in sustainable agriculture.',
    fertilizerRecommendation: {
      urea: { min: 20, max: 25, unit: 'kg/acre' },
      superPhosphate: { min: 30, max: 35, unit: 'kg/acre' },
      mop: { min: 10, max: 15, unit: 'kg/acre' }
    },
    organicAlternative: {
      fym: { min: 4, max: 6, unit: 'tons/acre' },
      compost: 'FYM: 4-6 tons/acre or Compost: 3-4 tons/acre improves organic carbon',
      additional: 'Rhizobium culture: 200g/acre for better nitrogen fixation. Green Manure: 20-25 kg/acre of Sesbania or Dhaincha'
    }
  };
}

// Helper function to adjust fertilizer based on soil type
function adjustFertilizerForSoil(
  baseRecommendation: CropRotationRecommendation,
  soilType: string
): CropRotationRecommendation {
  const soil = soilType.toLowerCase();
  const adjusted = { ...baseRecommendation };
  
  // Adjust fertilizer based on soil type
  if (soil.includes('black') || soil.includes('alluvial')) {
    // Black and alluvial soils are generally fertile, may need less
    adjusted.fertilizerRecommendation = {
      urea: {
        min: Math.max(adjusted.fertilizerRecommendation.urea.min - 5, 15),
        max: Math.max(adjusted.fertilizerRecommendation.urea.max - 5, 20),
        unit: adjusted.fertilizerRecommendation.urea.unit
      },
      superPhosphate: {
        min: Math.max(adjusted.fertilizerRecommendation.superPhosphate.min - 3, 20),
        max: Math.max(adjusted.fertilizerRecommendation.superPhosphate.max - 3, 25),
        unit: adjusted.fertilizerRecommendation.superPhosphate.unit
      },
      mop: adjusted.fertilizerRecommendation.mop
    };
  } else if (soil.includes('red') || soil.includes('laterite')) {
    // Red and laterite soils may need more phosphorus
    adjusted.fertilizerRecommendation = {
      urea: adjusted.fertilizerRecommendation.urea,
      superPhosphate: {
        min: adjusted.fertilizerRecommendation.superPhosphate.min + 5,
        max: adjusted.fertilizerRecommendation.superPhosphate.max + 5,
        unit: adjusted.fertilizerRecommendation.superPhosphate.unit
      },
      mop: adjusted.fertilizerRecommendation.mop
    };
  } else if (soil.includes('saline') || soil.includes('desert')) {
    // Saline and desert soils need more organic matter
    adjusted.organicAlternative.fym = {
      min: adjusted.organicAlternative.fym.min + 2,
      max: adjusted.organicAlternative.fym.max + 2,
      unit: adjusted.organicAlternative.fym.unit
    };
  }
  
  return adjusted;
}

// Helper function to adjust recommendation based on region
function adjustRecommendationForRegion(
  baseRecommendation: CropRotationRecommendation,
  region: string
): CropRotationRecommendation {
  const reg = region.toLowerCase();
  const adjusted = { ...baseRecommendation };
  
  // Adjust rotation reason to include region-specific information
  if (reg.includes('punjab') || reg.includes('haryana')) {
    adjusted.rotationReason = `${adjusted.rotationReason} This rotation is particularly effective in the fertile Indo-Gangetic plains of ${region}.`;
  } else if (reg.includes('maharashtra') || reg.includes('gujarat')) {
    adjusted.rotationReason = `${adjusted.rotationReason} Well-suited for the agro-climatic conditions of ${region}.`;
  } else if (reg.includes('tamil nadu') || reg.includes('karnataka')) {
    adjusted.rotationReason = `${adjusted.rotationReason} This rotation works well in the southern regions like ${region}.`;
  } else if (reg.includes('west bengal') || reg.includes('bihar')) {
    adjusted.rotationReason = `${adjusted.rotationReason} Traditional rotation pattern for ${region} region.`;
  }
  
  return adjusted;
}

// Helper function to get recommendations
export function getFertilizerRecommendation(
  currentCrop: string,
  soilType: string,
  region: string,
  season: string
): CropRotationRecommendation[] {
  const crop = currentCrop.trim();
  const soil = soilType.trim();
  const reg = region.trim();
  const sea = season.trim();

  let recommendation: CropRotationRecommendation | null = null;

  // Priority 1: Try exact match first (crop, soil, region, season)
  if (fertilizerData[crop]?.[soil]?.[reg]?.[sea]) {
    recommendation = fertilizerData[crop][soil][reg][sea][0];
  }
  // Priority 2: Try same crop, soil, region but any season
  else if (fertilizerData[crop]?.[soil]?.[reg]) {
    const seasons = Object.keys(fertilizerData[crop][soil][reg]);
    if (seasons.length > 0) {
      // Prefer matching season if available, otherwise use first available
      const preferredSeason = seasons.includes(sea) ? sea : seasons[0];
      recommendation = fertilizerData[crop][soil][reg][preferredSeason][0];
    }
  }
  // Priority 3: Try same crop, any soil type, same region
  else if (fertilizerData[crop]) {
    for (const st of Object.keys(fertilizerData[crop])) {
      if (fertilizerData[crop][st]?.[reg]) {
        const seasons = Object.keys(fertilizerData[crop][st][reg]);
        if (seasons.length > 0) {
          const preferredSeason = seasons.includes(sea) ? sea : seasons[0];
          recommendation = fertilizerData[crop][st][reg][preferredSeason][0];
          // Adjust for different soil type
          recommendation = adjustFertilizerForSoil(recommendation, soil);
          break;
        }
      }
    }
  }
  // Priority 4: Try same crop, same soil, any region
  else if (fertilizerData[crop]?.[soil]) {
    const regions = Object.keys(fertilizerData[crop][soil]);
    if (regions.length > 0) {
      const firstRegion = regions[0];
      const seasons = Object.keys(fertilizerData[crop][soil][firstRegion]);
      if (seasons.length > 0) {
        const preferredSeason = seasons.includes(sea) ? sea : seasons[0];
        recommendation = fertilizerData[crop][soil][firstRegion][preferredSeason][0];
        // Adjust for different region
        recommendation = adjustRecommendationForRegion(recommendation, reg);
      }
    }
  }
  // Priority 5: Try same crop, any soil, any region
  else if (fertilizerData[crop]) {
    for (const st of Object.keys(fertilizerData[crop])) {
      const regions = Object.keys(fertilizerData[crop][st]);
      if (regions.length > 0) {
        const firstRegion = regions[0];
        const seasons = Object.keys(fertilizerData[crop][st][firstRegion]);
        if (seasons.length > 0) {
          const preferredSeason = seasons.includes(sea) ? sea : seasons[0];
          recommendation = fertilizerData[crop][st][firstRegion][preferredSeason][0];
          // Adjust for different soil and region
          recommendation = adjustFertilizerForSoil(recommendation, soil);
          recommendation = adjustRecommendationForRegion(recommendation, reg);
          break;
        }
      }
    }
  }

  // Priority 6: Fallback - Generate recommendation based on crop type and season
  if (!recommendation) {
    recommendation = getRecommendationByCropType(crop, soil, sea);
    // Adjust for soil and region
    recommendation = adjustFertilizerForSoil(recommendation, soil);
    recommendation = adjustRecommendationForRegion(recommendation, reg);
  } else {
    // Even if we found a match, adjust for soil and region to make it more dynamic
    recommendation = adjustFertilizerForSoil(recommendation, soil);
    recommendation = adjustRecommendationForRegion(recommendation, reg);
  }

  return [recommendation];
}

