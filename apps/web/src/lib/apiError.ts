// the API sends errors as { error: { message } }
export function apiErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || fallback;
}
