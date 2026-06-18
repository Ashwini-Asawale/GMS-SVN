/** Official GMS product component names */
export const PRODUCT_NAMES = {
  platform: 'GMS SVN Platform',
  server: 'GMS SVN SERVER',
  client: 'GMS SVN CLIENT',
  webAdmin: 'GMS SVN Web Admin',
  serverAgent: 'GMS SVN SERVER Agent',
} as const;

export type ProductName = (typeof PRODUCT_NAMES)[keyof typeof PRODUCT_NAMES];
