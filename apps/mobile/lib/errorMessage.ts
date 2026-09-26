import axios from 'axios';

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return 'Request timed out. Please try again.';
    }
    if (!err.response) {
      return "Can't reach the server. Check your connection.";
    }
    if (err.response.status >= 500) {
      return 'The server had a problem. Please try again.';
    }
    return 'Something went wrong loading this data.';
  }
  return 'Something went wrong.';
}
