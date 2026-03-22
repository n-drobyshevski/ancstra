export class GotenbergClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.GOTENBERG_URL || 'http://localhost:3100';
  }

  async htmlToPdf(html: string): Promise<Buffer> {
    const formData = new FormData();
    formData.append('files', new Blob([html], { type: 'text/html' }), 'index.html');

    const response = await fetch(
      `${this.baseUrl}/forms/chromium/convert/html`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      throw new Error(`Gotenberg error: ${response.status} ${await response.text()}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
