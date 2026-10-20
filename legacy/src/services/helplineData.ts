// AI Smart Helpline - State Consumer Helpline Numbers
// Supported by Department of Consumer Affairs, Government of India

export interface HelplineInfo {
  state: string;
  numbers: string[];
  department: string;
  website?: string;
}

export const helplineData: HelplineInfo[] = [
  {
    state: 'Andhra Pradesh',
    numbers: ['1800-425-0082', '1800-425-2977'],
    department: 'Consumer Affairs',
    website: 'cphfs.in'
  },
  {
    state: 'Arunachal Pradesh',
    numbers: ['1800-345-3601'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Assam',
    numbers: ['1800-345-3611'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Bihar',
    numbers: ['1800-345-6188'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Chhattisgarh',
    numbers: ['1800-233-3663'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Delhi',
    numbers: ['011-23379266'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Gujarat',
    numbers: ['1800-233-0222'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Haryana',
    numbers: ['1800-180-2087'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Himachal Pradesh',
    numbers: ['1800-180-8087'],
    department: 'Consumer Affairs',
    website: 'cphfs.in'
  },
  {
    state: 'Jharkhand',
    numbers: ['1800-3456-598'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Karnataka',
    numbers: ['1800-425-9339', '1967'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Kerala',
    numbers: ['1800-425-1550'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Madhya Pradesh',
    numbers: ['155343', '0755-2559778', '0755-2559993'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Maharashtra',
    numbers: ['1800-2222-62'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Mizoram',
    numbers: ['1800-231-1792'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Nagaland',
    numbers: ['1800-345-3701'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Odisha',
    numbers: ['1800-345-6724', '6760'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Puducherry',
    numbers: ['1800-425-1082', '1083', '1084', '1085'],
    department: 'Consumer Affairs',
    website: 'mahe.gov.in'
  },
  {
    state: 'Rajasthan',
    numbers: ['1800-180-6030'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Sikkim',
    numbers: ['1800-345-3209', '1800-345-3236'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Tamil Nadu',
    numbers: ['044-2859-2828'],
    department: 'Consumer Affairs'
  },
  {
    state: 'Uttar Pradesh',
    numbers: ['1800-180-0300'],
    department: 'Consumer Affairs'
  },
  {
    state: 'West Bengal',
    numbers: ['1800-345-2808'],
    department: 'Consumer Affairs'
  }
];

export const INDIAN_STATES_HELPLINE = helplineData.map(item => item.state);

