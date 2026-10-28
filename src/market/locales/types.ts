export interface MarketMessages {
  title: string;
  searchPlaceholder: string;
  refresh: string;
  allCategories: string;
  uncategorized: string;
  total: string;
  loadMore: string;
  loading: string;
  empty: string;
  emptyHint: string;
  clearFilters: string;
  error: string;
  retry: string;
  close: string;
  detailUse: string;
  previewImage: string;
  detailUsing: string;
  detailVariables: string;
  detailNoVariables: string;
  detailAuthor: string;
  detailPages: string;
  detailPaper: string;
  detailVersion: string;
  detailDescription: string;
  detailCategory: string;
  detailIncompatible: string;
  pageUnit: string;
  toastAdded: string;
  toastAddFailed: string;
  errorNetwork: string;
  errorTimeout: string;
  errorNotFound: string;
  errorServer: string;
  errorInvalidPayload: string;
}

export type MarketMessageKey = keyof MarketMessages;
