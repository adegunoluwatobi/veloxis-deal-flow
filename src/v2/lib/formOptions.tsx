import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ID_TYPES = [
  'International Passport',
  'National ID (NIN)',
  "Driver's Licence",
  "Voter's Card",
] as const;

export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia',
  'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
  'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad',
  'Chile', 'China', 'Colombia', 'Comoros', 'Congo (Brazzaville)', 'Congo (Kinshasa)', 'Costa Rica', 'Croatia',
  'Cuba', 'Cyprus', 'Czechia', "Côte d'Ivoire", 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji',
  'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
  'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya',
  'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
  'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta',
  'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
  'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand',
  'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau',
  'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar',
  'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
  'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
  'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa',
  'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
  'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen',
  'Zambia', 'Zimbabwe',
] as const;

/** Nationality is expressed as the country of citizenship. */
export const NATIONALITIES = COUNTRIES;

export const INDUSTRIES = [
  'Agriculture & Agro-processing',
  'Automotive & Parts',
  'Chemicals & Petrochemicals',
  'Construction & Building Materials',
  'Consumer Goods (FMCG)',
  'Cosmetics & Personal Care',
  'Electronics & Electrical Equipment',
  'Energy & Renewables',
  'Financial Services',
  'Fisheries & Seafood',
  'Food & Beverage',
  'Forestry & Timber',
  'Furniture & Wood Products',
  'Leather & Footwear',
  'Logistics & Freight Forwarding',
  'Machinery & Industrial Equipment',
  'Manufacturing (General)',
  'Metals & Steel',
  'Mining & Solid Minerals',
  'Oil & Gas Services',
  'Packaging & Paper',
  'Pharmaceuticals & Medical Supplies',
  'Plastics & Rubber',
  'Recycling & Scrap Metal',
  'Technology & Software',
  'Telecommunications',
  'Textiles & Apparel',
  'Trading & Commodity Distribution',
  'Transport & Shipping',
  'Other',
] as const;

export const NIGERIAN_BANKS = [
  'Access Bank',
  'Citibank Nigeria',
  'Ecobank Nigeria',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'First City Monument Bank (FCMB)',
  'Globus Bank',
  'Guaranty Trust Bank (GTBank)',
  'Heritage Bank',
  'Keystone Bank',
  'Optimus Bank',
  'Parallex Bank',
  'Polaris Bank',
  'Premium Trust Bank',
  'Providus Bank',
  'Signature Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered Bank Nigeria',
  'Sterling Bank',
  'SunTrust Bank',
  'Titan Trust Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Unity Bank',
  'Wema Bank',
  'Zenith Bank',
] as const;

export function OptionSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
}: {
  value?: string | null;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
