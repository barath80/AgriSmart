// Mapping of Indian states to major cities for weather API queries
export const stateToCityMapping: Record<string, string> = {
  'Andhra Pradesh': 'Hyderabad',
  'Arunachal Pradesh': 'Itanagar',
  'Assam': 'Guwahati',
  'Bihar': 'Patna',
  'Chhattisgarh': 'Raipur',
  'Goa': 'Panaji',
  'Gujarat': 'Ahmedabad',
  'Haryana': 'Chandigarh',
  'Himachal Pradesh': 'Shimla',
  'Jharkhand': 'Ranchi',
  'Karnataka': 'Bangalore',
  'Kerala': 'Thiruvananthapuram',
  'Madhya Pradesh': 'Bhopal',
  'Maharashtra': 'Mumbai',
  'Manipur': 'Imphal',
  'Meghalaya': 'Shillong',
  'Mizoram': 'Aizawl',
  'Nagaland': 'Kohima',
  'Odisha': 'Bhubaneswar',
  'Punjab': 'Chandigarh',
  'Rajasthan': 'Jaipur',
  'Sikkim': 'Gangtok',
  'Tamil Nadu': 'Chennai',
  'Telangana': 'Hyderabad',
  'Tripura': 'Agartala',
  'Uttar Pradesh': 'Lucknow',
  'Uttarakhand': 'Dehradun',
  'West Bengal': 'Kolkata',
  'Delhi': 'New Delhi',
  'Jammu and Kashmir': 'Srinagar',
  'Ladakh': 'Leh',
  'Puducherry': 'Puducherry',
  'Andaman and Nicobar Islands': 'Port Blair',
  'Chandigarh': 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu': 'Daman',
  'Lakshadweep': 'Kavaratti',
};

// Get city name for a state (fallback to state name if not found)
export const getCityForState = (stateName: string | null): string => {
  if (!stateName) return 'Delhi'; // Default fallback
  return stateToCityMapping[stateName] || stateName;
};

