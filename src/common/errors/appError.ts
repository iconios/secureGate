export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details: string,
    readonly message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
