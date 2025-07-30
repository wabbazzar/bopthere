import { apiRequest, APIError } from './api-client';
import { RSVPRequest, RSVPResponse, APIResponse } from './types';

export class RSVPService {
  static async submitRSVP(data: RSVPRequest): Promise<RSVPResponse> {
    try {
      const response = await apiRequest<APIResponse<RSVPResponse>>('/rsvp', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.data) {
        throw new APIError('Invalid response from server');
      }

      return response.data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Failed to submit RSVP');
    }
  }

  static async getRSVP(id: string): Promise<RSVPResponse> {
    try {
      const response = await apiRequest<APIResponse<RSVPResponse>>(`/rsvp/${id}`, {
        method: 'GET',
      });

      if (!response.data) {
        throw new APIError('Invalid response from server');
      }

      return response.data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Failed to retrieve RSVP');
    }
  }
}