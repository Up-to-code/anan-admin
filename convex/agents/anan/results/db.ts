/**
 * DB-related types for property search.
 */

export type DbPropertyResult = {
  _id?: string;
  title?: string;
  address?: string;
  description?: string;
  location?: string;
  area?: string;
  baths?: string | number;
  bathrooms?: string | number;
  beds?: string | number;
  price?: string | number;
  imageUrl?: string;
  imageUrls?: string[];
  externalUrl?: string;
  url?: string;
  searchText?: string;
};
