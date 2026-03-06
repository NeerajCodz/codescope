// Types for API endpoint analysis (Created vs Used)

export interface APIResponseBody {
  /** HTTP status code (e.g., 200, 400, 404, 500) */
  status: number;
  /** Label for this response (e.g., 'Success', 'Not Found') */
  label: string;
  /** Fields in the response body */
  fields: string[];
  /** Raw example from source code */
  example?: string;
}

export interface CreatedAPI {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  path: string;
  file: string;
  line: number;
  handler: string;
  framework: string;
  middleware?: string[];
  params?: string[];
  description?: string;
  queryParams?: string[];
  bodyFields?: string[];
  /** @deprecated Use responseBodies instead */
  responseFields?: string[];
  /** All detected response bodies with status codes */
  responseBodies?: APIResponseBody[];
}

export interface UsedAPI {
  url: string;
  method: string;
  file: string;
  line: number;
  callerFunction?: string;
  library: 'fetch' | 'axios' | 'got' | 'request' | 'xhr' | 'other';
  headers?: Record<string, string>;
  isAuthenticated?: boolean;
}

export interface APIStats {
  totalCreated: number;
  totalUsed: number;
  uniqueServices: number;
  frameworks: string[];
  methods: Record<string, number>;
  exposedEndpoints: number;
}

export interface ServiceGroup {
  baseUrl: string;
  name: string;
  endpoints: UsedAPI[];
  frequency: number;
  files: string[];
}
