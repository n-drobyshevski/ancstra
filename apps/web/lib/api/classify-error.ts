export function classifyApiError(res: Response): string {
  if (res.status === 409) return 'This relationship already exists';
  if (res.status === 404) return 'Resource not found — may have been deleted';
  if (res.status === 400) return 'Invalid request data';
  return 'Server error — please try again';
}
