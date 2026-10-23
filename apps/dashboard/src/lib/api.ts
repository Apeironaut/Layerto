import { LayertoClient } from '@layerto/api-client';
import { API_URL } from '../config';

/** The one API client instance for the dashboard. */
export const api = new LayertoClient(API_URL);
